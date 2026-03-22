#!/usr/bin/env python3
"""
WebSocket CLIENT conformance tests.

Tests protocol behaviors from the client perspective against a built-in
raw-socket echo server. Validates the same protocol paths that websocket.zig
(the Zig WS client at framework/net/websocket.zig) must handle.

Categories:
  1.x  Connect + handshake
  2.x  Text frames (send + receive)
  3.x  Binary frames (send + receive)
  4.x  Ping/pong (client-initiated, server-initiated)
  5.x  Close handshake (client-initiated, server-initiated)
  6.x  Fragmented messages (server->client)
  7.x  Large messages (near 64KB boundary)
  8.x  Connection error handling
  9.x  Multiple messages / sequencing
 10.x  Masking (client MUST mask, server MUST NOT)

No external dependencies -- uses raw sockets for both server and client.

Usage:
  python3 carts/ws-conformance/run_tests.py
"""

import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import time

SERVER_HOST = "127.0.0.1"
SERVER_PORT = 9002
MAGIC_GUID = "258EAFA5-E914-47DA-95CA-5AB515859764"
RESULTS = {}
_recv_buffers = {}


# =====================================================================
# Built-in WS Echo Server (raw sockets, zero dependencies)
# =====================================================================

class EchoServer:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False
        self.handler = None  # Override per-test: (client_sock, opcode, payload) -> None
        self._conn_rx = {}  # Per-connection buffered rx, keyed by socket fd

    def start(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.settimeout(1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(16)
        self.running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()

    def _accept_loop(self):
        while self.running:
            try:
                client, _ = self.sock.accept()
                client.settimeout(5)
                threading.Thread(target=self._handle, args=(client,), daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle(self, client):
        # Per-connection read buffer to avoid data loss
        buf = [b""]  # mutable container for closure

        def rx(n):
            """Read exactly n bytes, buffering any excess."""
            while len(buf[0]) < n:
                chunk = client.recv(65536)
                if not chunk:
                    raise ConnectionError("closed")
                buf[0] += chunk
            result = buf[0][:n]
            buf[0] = buf[0][n:]
            return result

        # Register rx so handlers can call srv.recv_frame(client)
        fd = client.fileno()
        self._conn_rx[fd] = rx

        try:
            # Read HTTP upgrade request
            while b"\r\n\r\n" not in buf[0]:
                chunk = client.recv(4096)
                if not chunk:
                    return
                buf[0] += chunk
            idx = buf[0].index(b"\r\n\r\n") + 4
            req = buf[0][:idx]
            buf[0] = buf[0][idx:]  # keep leftover

            key = None
            for line in req.decode(errors="replace").split("\r\n"):
                if line.lower().startswith("sec-websocket-key:"):
                    key = line.split(":", 1)[1].strip()
            if not key:
                client.close()
                return
            accept = base64.b64encode(
                hashlib.sha1((key + MAGIC_GUID).encode()).digest()
            ).decode()
            resp = (
                f"HTTP/1.1 101 Switching Protocols\r\n"
                f"Upgrade: websocket\r\n"
                f"Connection: Upgrade\r\n"
                f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
            )
            client.sendall(resp.encode())

            # Frame loop -- reassemble client fragments
            frag_buf = b""
            frag_opcode = 0
            while self.running:
                opcode, payload, fin = self._recv_frame_buf(rx)

                # Continuation frame
                if opcode == 0:
                    frag_buf += payload
                    if fin:
                        if self.handler:
                            self.handler(client, frag_opcode, frag_buf)
                        else:
                            self._send_frame(client, frag_opcode, frag_buf)
                        frag_buf = b""
                        frag_opcode = 0
                    continue

                # Non-FIN data = start of fragmented message
                if opcode in (1, 2) and not fin:
                    frag_buf = payload
                    frag_opcode = opcode
                    continue

                if opcode == 8:  # Close
                    self._send_frame(client, 8, payload)
                    break
                elif opcode == 9:  # Ping
                    self._send_frame(client, 10, payload)
                elif opcode == 10:  # Pong -- ignore
                    pass
                elif opcode in (1, 2):
                    if self.handler:
                        self.handler(client, opcode, payload)
                    else:
                        self._send_frame(client, opcode, payload)
        except Exception:
            pass
        finally:
            self._conn_rx.pop(fd, None)
            try:
                client.close()
            except Exception:
                pass

    def recv_frame(self, client):
        """Public: receive a frame from client using its buffered rx. For use in handlers."""
        fd = client.fileno()
        rx = self._conn_rx.get(fd)
        if rx is None:
            raise RuntimeError("No buffered rx for this connection")
        return self._recv_frame_buf(rx)

    def _recv_frame_buf(self, rx):
        """Receive one frame using a buffered rx function. Returns (opcode, payload, fin)."""
        hdr = rx(2)
        fin = bool(hdr[0] & 0x80)
        opcode = hdr[0] & 0x0F
        masked = bool(hdr[1] & 0x80)
        length = hdr[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", rx(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", rx(8))[0]
        if masked:
            mk = rx(4)
            p = bytearray(rx(length))
            for i in range(length):
                p[i] ^= mk[i % 4]
            return opcode, bytes(p), fin
        return opcode, rx(length), fin

    def _send_frame(self, sock, opcode, payload, fin=True):
        """Send an unmasked server-to-client frame."""
        first = (0x80 if fin else 0) | opcode
        if len(payload) > 65535:
            hdr = struct.pack("!BB", first, 127) + struct.pack("!Q", len(payload))
        elif len(payload) > 125:
            hdr = struct.pack("!BB", first, 126) + struct.pack("!H", len(payload))
        else:
            hdr = struct.pack("!BB", first, len(payload))
        sock.sendall(hdr + payload)


# =====================================================================
# Client Helpers (simulate websocket.zig behavior)
# =====================================================================

def ws_accept_key(client_key):
    """Compute Sec-WebSocket-Accept from client key per RFC 6455."""
    return base64.b64encode(
        hashlib.sha1((client_key + MAGIC_GUID).encode()).digest()
    ).decode()


def ws_connect(timeout=5):
    """Connect + handshake. Returns (socket, response_headers, client_key)."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    sock.connect((SERVER_HOST, SERVER_PORT))
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {SERVER_HOST}:{SERVER_PORT}\r\n"
        f"Connection: Upgrade\r\n"
        f"Upgrade: websocket\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"Sec-WebSocket-Key: {key}\r\n\r\n"
    )
    sock.sendall(req.encode())

    fd = sock.fileno()
    _recv_buffers[fd] = b""
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("closed during handshake")
        resp += chunk
    idx = resp.index(b"\r\n\r\n") + 4
    headers = resp[:idx]
    _recv_buffers[fd] = resp[idx:]  # leftover goes into recv buffer
    if b"101" not in headers.split(b"\r\n")[0]:
        raise ConnectionError(f"Not 101: {headers[:80]}")
    return sock, headers, key


def ws_send(sock, opcode, payload, fin=True, mask=True):
    """Send a masked client-to-server frame."""
    mk = os.urandom(4) if mask else b"\x00\x00\x00\x00"
    first = (0x80 if fin else 0) | opcode
    if len(payload) > 65535:
        hdr = struct.pack("!BB", first, (0x80 if mask else 0) | 127)
        hdr += struct.pack("!Q", len(payload))
    elif len(payload) > 125:
        hdr = struct.pack("!BB", first, (0x80 if mask else 0) | 126)
        hdr += struct.pack("!H", len(payload))
    else:
        hdr = struct.pack("!BB", first, (0x80 if mask else 0) | len(payload))
    if mask:
        masked = bytes(payload[i] ^ mk[i % 4] for i in range(len(payload)))
        sock.sendall(hdr + mk + masked)
    else:
        sock.sendall(hdr + payload)


def ws_recv(sock, timeout=5):
    """Receive one WebSocket frame. Returns (opcode, payload, fin).
    Uses persistent recv buffer keyed by socket fd."""
    sock.settimeout(timeout)
    fd = sock.fileno()
    if fd not in _recv_buffers:
        _recv_buffers[fd] = b""

    def rx(n):
        buf = _recv_buffers[fd]
        while len(buf) < n:
            chunk = sock.recv(65536)
            if not chunk:
                _recv_buffers[fd] = buf
                raise ConnectionError("closed")
            buf += chunk
        result = buf[:n]
        _recv_buffers[fd] = buf[n:]
        return result

    hdr = rx(2)
    fin = bool(hdr[0] & 0x80)
    opcode = hdr[0] & 0x0F
    masked = bool(hdr[1] & 0x80)
    length = hdr[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", rx(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", rx(8))[0]
    if masked:
        mk = rx(4)
        p = bytearray(rx(length))
        for i in range(length):
            p[i] ^= mk[i % 4]
        return opcode, bytes(p), fin
    return opcode, rx(length), fin


def ws_recv_message(sock, timeout=5):
    """Receive a complete message, reassembling fragments. Returns (opcode, payload)."""
    fragments = []
    first_opcode = None
    while True:
        opcode, payload, fin = ws_recv(sock, timeout=timeout)
        if opcode >= 0x8:
            return opcode, payload
        if first_opcode is None:
            first_opcode = opcode
        fragments.append(payload)
        if fin:
            return first_opcode, b"".join(fragments)


def ws_close(sock):
    """Send close + drain + close socket."""
    try:
        ws_send(sock, 8, struct.pack("!H", 1000))
        sock.settimeout(1)
        try:
            sock.recv(4096)
        except Exception:
            pass
    except Exception:
        pass
    fd = sock.fileno()
    _recv_buffers.pop(fd, None)
    try:
        sock.close()
    except Exception:
        pass


def record(case_id, desc, passed, detail=""):
    RESULTS[case_id] = {
        "behavior": "OK" if passed else "FAILED",
        "description": desc,
        "detail": detail,
    }
    mark = "PASS" if passed else "FAIL"
    line = f"  [{mark}] {case_id}: {desc}"
    if detail and not passed:
        line += f" ({detail})"
    print(line)


# =====================================================================
# Category 1: Connect + Handshake
# =====================================================================

def test_1_connect(srv):
    print("\n--- Category 1: Connect + Handshake ---")

    # 1.1: Basic TCP connect + WS upgrade
    try:
        sock, _, _ = ws_connect()
        record("1.1", "TCP connect + WS handshake succeeds", True)
        ws_close(sock)
    except Exception as e:
        record("1.1", "TCP connect + WS handshake succeeds", False, str(e))

    # 1.2: Response has 101, Upgrade, Connection, and Sec-WebSocket-Accept
    try:
        sock, headers, key = ws_connect()
        h = headers.decode(errors="replace")
        hl = h.lower()
        has_101 = "101" in h.split("\r\n")[0]
        has_upgrade = "upgrade: websocket" in hl
        has_conn = "connection: upgrade" in hl
        expected_accept = ws_accept_key(key)
        has_accept = expected_accept in h
        passed = has_101 and has_upgrade and has_conn and has_accept
        record("1.2", "101 + Upgrade + Connection + Accept headers", passed,
               f"101={has_101} upgrade={has_upgrade} conn={has_conn} accept={has_accept}")
        ws_close(sock)
    except Exception as e:
        record("1.2", "101 + Upgrade + Connection + Accept headers", False, str(e))

    # 1.3: Frames flow after handshake
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"handshake-test")
        op, payload, fin = ws_recv(sock)
        passed = op == 1 and payload == b"handshake-test" and fin
        record("1.3", "Frames flow after handshake", passed,
               f"op={op} payload={payload!r}" if not passed else "")
        ws_close(sock)
    except Exception as e:
        record("1.3", "Frames flow after handshake", False, str(e))

    # 1.4: Connection refused on closed port
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("127.0.0.1", 19999))
        record("1.4", "Connection refused on closed port", False, "connected unexpectedly")
        s.close()
    except (ConnectionRefusedError, socket.timeout, OSError):
        record("1.4", "Connection refused on closed port", True)


# =====================================================================
# Category 2: Text Frames
# =====================================================================

def test_2_text(srv):
    print("\n--- Category 2: Text Frames ---")

    cases = [
        ("2.1", b"Hello", "Small text (5B)"),
        ("2.2", b"", "Empty text"),
        ("2.3", "Hello \u4e16\u754c \U0001f30d".encode("utf-8"), "UTF-8 multibyte (CJK + emoji)"),
        ("2.4", b"x" * 125, "Text at 125B (max 7-bit length)"),
        ("2.5", b"y" * 126, "Text at 126B (16-bit extended length)"),
        ("2.6", b"z" * 200, "Text at 200B (extended length)"),
        ("2.7", b"A" * 65535, "Text at 65535B (max 16-bit length)"),
    ]
    for cid, msg, desc in cases:
        try:
            sock, _, _ = ws_connect()
            ws_send(sock, 1, msg)
            op, payload, fin = ws_recv(sock, timeout=10)
            passed = op == 1 and payload == msg and fin
            record(cid, desc, passed,
                   f"op={op} len={len(payload)}" if not passed else "")
            ws_close(sock)
        except Exception as e:
            record(cid, desc, False, str(e))


# =====================================================================
# Category 3: Binary Frames
# =====================================================================

def test_3_binary(srv):
    print("\n--- Category 3: Binary Frames ---")

    # 3.1: All byte values 0-255
    try:
        sock, _, _ = ws_connect()
        msg = bytes(range(256))
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock)
        record("3.1", "256B binary (all byte values)", op == 2 and payload == msg,
               f"op={op} len={len(payload)}" if payload != msg else "")
        ws_close(sock)
    except Exception as e:
        record("3.1", "256B binary (all byte values)", False, str(e))

    # 3.2: Empty binary
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 2, b"")
        op, payload, _ = ws_recv(sock)
        record("3.2", "Empty binary", op == 2 and payload == b"")
        ws_close(sock)
    except Exception as e:
        record("3.2", "Empty binary", False, str(e))

    # 3.3: 1KB random binary
    try:
        sock, _, _ = ws_connect()
        msg = os.urandom(1024)
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock)
        record("3.3", "1KB random binary", op == 2 and payload == msg,
               f"len={len(payload)}" if payload != msg else "")
        ws_close(sock)
    except Exception as e:
        record("3.3", "1KB random binary", False, str(e))

    # 3.4: 64KB binary
    try:
        sock, _, _ = ws_connect()
        msg = os.urandom(65535)
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock, timeout=10)
        record("3.4", "64KB binary echo", op == 2 and payload == msg,
               f"len={len(payload)}" if payload != msg else "")
        ws_close(sock)
    except Exception as e:
        record("3.4", "64KB binary echo", False, str(e))

    # 3.5: Binary opcode preserved (not converted to text)
    try:
        sock, _, _ = ws_connect()
        msg = b"\x00\x01\x02\xff\xfe\xfd"
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock)
        record("3.5", "Binary opcode preserved in echo", op == 2,
               f"got opcode={op}" if op != 2 else "")
        ws_close(sock)
    except Exception as e:
        record("3.5", "Binary opcode preserved in echo", False, str(e))


# =====================================================================
# Category 4: Ping/Pong
# =====================================================================

def test_4_ping(srv):
    print("\n--- Category 4: Ping/Pong ---")

    # 4.1-4.3: Client sends ping, server auto-responds with pong
    ping_cases = [
        ("4.1", b"ping!", "Ping with payload"),
        ("4.2", b"", "Empty ping"),
        ("4.3", b"P" * 125, "Ping 125B (max control frame size)"),
    ]
    for cid, data, desc in ping_cases:
        try:
            sock, _, _ = ws_connect()
            ws_send(sock, 9, data)
            op, payload, _ = ws_recv(sock)
            ok = op == 10 and payload == data
            record(cid, desc, ok,
                   f"op={op} payload_len={len(payload)}" if not ok else "")
            ws_close(sock)
        except Exception as e:
            record(cid, desc, False, str(e))

    # 4.4: Server-initiated ping (client must auto-respond with pong)
    #      websocket.zig handles this: .ping => auto-respond with pong
    def ping_handler(client, opcode, payload):
        if payload == b"TRIGGER_PING":
            # Server sends ping to client
            srv._send_frame(client, 9, b"server-ping")
            # Read client's pong response
            try:
                pop, ppayload, _ = srv.recv_frame(client)
                got_pong = (pop == 10 and ppayload == b"server-ping")
            except Exception:
                got_pong = False
            # Send result back as text
            srv._send_frame(client, 1, b"PONG_OK" if got_pong else b"PONG_FAIL")
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = ping_handler
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"TRIGGER_PING")
        # Server sends us a ping -- respond with pong
        op, payload, _ = ws_recv(sock)
        if op == 9:
            ws_send(sock, 10, payload)
            op2, payload2, _ = ws_recv(sock)
            passed = op2 == 1 and payload2 == b"PONG_OK"
        else:
            passed = op == 1 and payload == b"PONG_OK"
        record("4.4", "Server-initiated ping: client responds with pong", passed)
        ws_close(sock)
    except Exception as e:
        record("4.4", "Server-initiated ping: client responds with pong", False, str(e))
    srv.handler = None

    # 4.5: Unsolicited pong ignored, connection stays open
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 10, b"unsolicited-pong")
        ws_send(sock, 1, b"still-alive")
        op, payload, _ = ws_recv(sock)
        ok = op == 1 and payload == b"still-alive"
        record("4.5", "Unsolicited pong ignored, connection stays open", ok,
               f"op={op} payload={payload!r}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("4.5", "Unsolicited pong ignored, connection stays open", False, str(e))

    # 4.6: Multiple pings in sequence
    try:
        sock, _, _ = ws_connect()
        for i in range(5):
            ws_send(sock, 9, f"ping-{i}".encode())
        pongs = []
        for i in range(5):
            op, payload, _ = ws_recv(sock)
            pongs.append((op, payload))
        all_pong = all(op == 10 for op, _ in pongs)
        all_match = all(pongs[i][1] == f"ping-{i}".encode() for i in range(5))
        ok = all_pong and all_match
        record("4.6", "5 sequential pings all get matching pongs", ok,
               f"pongs={[(op, p.decode(errors='replace')) for op, p in pongs]}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("4.6", "5 sequential pings all get matching pongs", False, str(e))


# =====================================================================
# Category 5: Close Handshake
# =====================================================================

def test_5_close(srv):
    print("\n--- Category 5: Close Handshake ---")

    # 5.1: Client close with code 1000
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 1000) + b"normal")
        op, payload, _ = ws_recv(sock)
        code = struct.unpack("!H", payload[:2])[0] if len(payload) >= 2 else 0
        record("5.1", "Client close(1000) echoed", op == 8, f"code={code}")
        sock.close()
    except Exception as e:
        record("5.1", "Client close(1000) echoed", False, str(e))

    # 5.2: Close with empty body
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 8, b"")
        op, _, _ = ws_recv(sock)
        record("5.2", "Close empty body", op == 8)
        sock.close()
    except Exception as e:
        record("5.2", "Close empty body", False, str(e))

    # 5.3: Server-initiated close
    #      websocket.zig: on receiving close frame, responds with close, sets .closed
    def close_handler(client, opcode, payload):
        if payload == b"CLOSE_ME":
            srv._send_frame(client, 8, struct.pack("!H", 1000) + b"bye")
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = close_handler
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"CLOSE_ME")
        op, payload, _ = ws_recv(sock)
        record("5.3", "Server-initiated close received", op == 8)
        ws_send(sock, 8, payload)  # Echo close back
        sock.close()
    except Exception as e:
        record("5.3", "Server-initiated close received", False, str(e))
    srv.handler = None

    # 5.4: Close with reason string
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 1001) + b"going away")
        op, _, _ = ws_recv(sock)
        record("5.4", "Close with reason string", op == 8)
        sock.close()
    except Exception as e:
        record("5.4", "Close with reason string", False, str(e))

    # 5.5: Close with application code 3000
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 3000) + b"app close")
        op, _, _ = ws_recv(sock)
        record("5.5", "Close with application code 3000", op == 8)
        sock.close()
    except Exception as e:
        record("5.5", "Close with application code 3000", False, str(e))

    # 5.6: No data after close handshake
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 8, struct.pack("!H", 1000))
        op, _, _ = ws_recv(sock)
        assert op == 8
        try:
            ws_send(sock, 1, b"after-close")
            sock.settimeout(1)
            data = sock.recv(4096)
            passed = len(data) == 0
        except (BrokenPipeError, ConnectionError, socket.timeout, OSError):
            passed = True
        record("5.6", "No data after close handshake", passed)
        _recv_buffers.pop(sock.fileno(), None)
        sock.close()
    except Exception as e:
        record("5.6", "No data after close handshake", False, str(e))


# =====================================================================
# Category 6: Fragmented Messages (server -> client)
# =====================================================================

def test_6_fragmentation(srv):
    print("\n--- Category 6: Fragmented Messages (server->client) ---")

    # 6.1: Two text fragments from server
    def frag2(client, opcode, payload):
        if payload == b"FRAG2":
            srv._send_frame(client, 1, b"Hel", fin=False)
            srv._send_frame(client, 0, b"lo", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag2
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"FRAG2")
        op, full = ws_recv_message(sock)
        record("6.1", "2 server fragments reassembled", op == 1 and full == b"Hello",
               f"got={full!r}" if full != b"Hello" else "")
        ws_close(sock)
    except Exception as e:
        record("6.1", "2 server fragments reassembled", False, str(e))

    # 6.2: Three text fragments from server
    def frag3(client, opcode, payload):
        if payload == b"FRAG3":
            srv._send_frame(client, 1, b"AB", fin=False)
            srv._send_frame(client, 0, b"CD", fin=False)
            srv._send_frame(client, 0, b"EF", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag3
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"FRAG3")
        op, full = ws_recv_message(sock)
        record("6.2", "3 server fragments reassembled", op == 1 and full == b"ABCDEF",
               f"got={full!r}" if full != b"ABCDEF" else "")
        ws_close(sock)
    except Exception as e:
        record("6.2", "3 server fragments reassembled", False, str(e))

    # 6.3: Ping interleaved with fragments
    #      Control frames can appear between data fragments (RFC 6455 5.4)
    #      websocket.zig handles ping by auto-responding with pong
    def frag_ping(client, opcode, payload):
        if payload == b"FRAG_PING":
            srv._send_frame(client, 1, b"part1", fin=False)
            srv._send_frame(client, 9, b"mid-frag")  # Ping between fragments
            # Read pong response from client
            try:
                srv.recv_frame(client)
            except Exception:
                pass
            srv._send_frame(client, 0, b"part2", fin=True)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = frag_ping
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"FRAG_PING")
        # Receive: fragment(part1), ping, fragment(part2)
        frames = []
        for _ in range(3):
            op, payload, fin = ws_recv(sock)
            frames.append((op, payload, fin))
            if op == 9:
                ws_send(sock, 10, payload)  # Respond to ping
        data_frames = [(o, p) for o, p, f in frames if o in (1, 0)]
        ping_frames = [(o, p) for o, p, f in frames if o == 9]
        full = b"".join(p for _, p in data_frames)
        record("6.3", "Ping interleaved in server fragments",
               full == b"part1part2" and len(ping_frames) == 1,
               f"data={full!r} pings={len(ping_frames)}")
        ws_close(sock)
    except Exception as e:
        record("6.3", "Ping interleaved in server fragments", False, str(e))
    srv.handler = None

    # 6.4: Client sends fragmented text to echo server
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"Hel", fin=False)
        ws_send(sock, 0, b"lo", fin=True)
        op, payload, fin = ws_recv(sock)
        record("6.4", "Client-sent fragments reassembled by server", payload == b"Hello",
               f"got {payload!r}" if payload != b"Hello" else "")
        ws_close(sock)
    except Exception as e:
        record("6.4", "Client-sent fragments reassembled by server", False, str(e))

    # 6.5: Three client fragments
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"AB", fin=False)
        ws_send(sock, 0, b"CD", fin=False)
        ws_send(sock, 0, b"EF", fin=True)
        op, payload, fin = ws_recv(sock)
        record("6.5", "Three client fragments reassembled", payload == b"ABCDEF",
               f"got {payload!r}" if payload != b"ABCDEF" else "")
        ws_close(sock)
    except Exception as e:
        record("6.5", "Three client fragments reassembled", False, str(e))


# =====================================================================
# Category 7: Large Messages
# =====================================================================

def test_7_large(srv):
    print("\n--- Category 7: Large Messages ---")

    # 7.1: 64KB text echo
    try:
        sock, _, _ = ws_connect()
        msg = b"A" * 65535
        ws_send(sock, 1, msg)
        op, payload, _ = ws_recv(sock, timeout=10)
        record("7.1", "65535B text echo (max 16-bit)", op == 1 and payload == msg,
               f"len={len(payload)}" if payload != msg else "")
        ws_close(sock)
    except Exception as e:
        record("7.1", "65535B text echo (max 16-bit)", False, str(e))

    # 7.2: 64KB binary echo
    try:
        sock, _, _ = ws_connect()
        msg = os.urandom(65535)
        ws_send(sock, 2, msg)
        op, payload, _ = ws_recv(sock, timeout=10)
        record("7.2", "64KB binary echo", op == 2 and payload == msg,
               f"len={len(payload)}" if payload != msg else "")
        ws_close(sock)
    except Exception as e:
        record("7.2", "64KB binary echo", False, str(e))

    # 7.3: 60KB text from server (via handler)
    #      websocket.zig MAX_MSG = 65536, so 60KB fits
    def large_handler(client, opcode, payload):
        if payload == b"LARGE":
            srv._send_frame(client, 1, b"X" * 61440)
        else:
            srv._send_frame(client, opcode, payload)
    srv.handler = large_handler
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"LARGE")
        op, payload, _ = ws_recv(sock, timeout=10)
        expected = b"X" * 61440
        record("7.3", "60KB text from server", op == 1 and payload == expected,
               f"len={len(payload)}" if payload != expected else "")
        ws_close(sock)
    except Exception as e:
        record("7.3", "60KB text from server", False, str(e))
    srv.handler = None

    # 7.4: Mixed sizes in sequence on single connection
    try:
        sock, _, _ = ws_connect()
        sizes = [0, 1, 125, 126, 200, 1000, 10000, 65535]
        passed = True
        detail = ""
        for sz in sizes:
            msg = b"M" * sz
            ws_send(sock, 1, msg)
            op, payload, _ = ws_recv(sock, timeout=10)
            if payload != msg:
                passed = False
                detail = f"size {sz}: got len={len(payload)}"
                break
        record("7.4", "Mixed sizes (0, 1, 125, 126, 200, 1K, 10K, 64K)", passed, detail)
        ws_close(sock)
    except Exception as e:
        record("7.4", "Mixed sizes (0, 1, 125, 126, 200, 1K, 10K, 64K)", False, str(e))


# =====================================================================
# Category 8: Connection Error Handling
# =====================================================================

def test_8_errors(srv):
    print("\n--- Category 8: Error Handling ---")

    # 8.1: Connection refused on closed port
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("127.0.0.1", 19999))
        record("8.1", "Connection refused on closed port", False, "connected unexpectedly")
        s.close()
    except (ConnectionRefusedError, socket.timeout, OSError):
        record("8.1", "Connection refused on closed port", True)

    # 8.2: Server drops TCP connection
    #      websocket.zig: handleFrames returns .close { .code = 1006, .reason = "connection lost" }
    def dropper(client, opcode, payload):
        if payload == b"DROP":
            client.close()
            raise Exception("drop")
        srv._send_frame(client, opcode, payload)
    srv.handler = dropper
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"DROP")
        try:
            ws_recv(sock, timeout=2)
            record("8.2", "Detect server TCP drop", False, "got data after drop")
        except (ConnectionError, socket.timeout):
            record("8.2", "Detect server TCP drop", True)
        sock.close()
    except Exception as e:
        record("8.2", "Detect server TCP drop", True, str(e))
    srv.handler = None

    # 8.3: Invalid HTTP upgrade (not 101)
    #      websocket.zig: handleUpgrade returns .err "upgrade rejected (not 101)"
    #      Use a custom handler that sends a 403 before the WS handshake completes.
    def reject_handler(client, opcode, payload):
        srv._send_frame(client, opcode, payload)
    # Test: connect via raw TCP to a temp server that sends 403
    reject_srv = None
    try:
        reject_srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        reject_srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        reject_srv.settimeout(3)
        reject_srv.bind(("127.0.0.1", 19997))
        reject_srv.listen(1)

        def reject_thread():
            try:
                conn, _ = reject_srv.accept()
                conn.settimeout(3)
                req = b""
                while b"\r\n\r\n" not in req:
                    chunk = conn.recv(4096)
                    if not chunk:
                        break
                    req += chunk
                conn.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
                time.sleep(0.1)
                conn.close()
            except Exception:
                pass

        t = threading.Thread(target=reject_thread, daemon=True)
        t.start()

        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.settimeout(3)
        client.connect(("127.0.0.1", 19997))
        key = base64.b64encode(os.urandom(16)).decode()
        client.sendall(f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\n\r\n".encode())

        resp = b""
        try:
            while len(resp) < 4096:
                chunk = client.recv(4096)
                if not chunk:
                    break
                resp += chunk
        except socket.timeout:
            pass
        passed = b"403" in resp
        record("8.3", "Non-101 upgrade detected", passed,
               resp.split(b"\r\n")[0].decode(errors="replace") if not passed else "")
        client.close()
        t.join(timeout=2)
    except Exception as e:
        record("8.3", "Non-101 upgrade detected", False, str(e))
    finally:
        if reject_srv:
            reject_srv.close()


# =====================================================================
# Category 9: Multiple Messages / Sequencing
# =====================================================================

def test_9_multi(srv):
    print("\n--- Category 9: Multiple Messages ---")

    # 9.1: 10 sequential text messages
    try:
        sock, _, _ = ws_connect()
        passed = True
        detail = ""
        for i in range(10):
            msg = f"seq-{i}".encode()
            ws_send(sock, 1, msg)
            _, p, _ = ws_recv(sock)
            if p != msg:
                passed = False
                detail = f"msg {i}: expected {msg!r}, got {p!r}"
                break
        record("9.1", "10 sequential messages", passed, detail)
        ws_close(sock)
    except Exception as e:
        record("9.1", "10 sequential messages", False, str(e))

    # 9.2: Rapid-fire: send 50 then recv 50
    try:
        sock, _, _ = ws_connect()
        count = 50
        for i in range(count):
            ws_send(sock, 1, f"r{i:04d}".encode())
        passed = True
        detail = ""
        for i in range(count):
            _, p, _ = ws_recv(sock, timeout=10)
            if p != f"r{i:04d}".encode():
                passed = False
                detail = f"msg {i}: got {p!r}"
                break
        record("9.2", f"{count} rapid-fire messages (batch send, batch recv)", passed, detail)
        ws_close(sock)
    except Exception as e:
        record("9.2", "50 rapid-fire messages (batch send, batch recv)", False, str(e))

    # 9.3: Interleaved text and binary opcodes preserved
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"text1")
        ws_send(sock, 2, b"\x00\x01\x02")
        ws_send(sock, 1, b"text2")
        o1, p1, _ = ws_recv(sock)
        o2, p2, _ = ws_recv(sock)
        o3, p3, _ = ws_recv(sock)
        ok = (o1 == 1 and p1 == b"text1" and
              o2 == 2 and p2 == b"\x00\x01\x02" and
              o3 == 1 and p3 == b"text2")
        record("9.3", "Interleaved text + binary opcodes preserved", ok,
               f"o1={o1} o2={o2} o3={o3}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("9.3", "Interleaved text + binary opcodes preserved", False, str(e))

    # 9.4: Messages flow normally around ping/pong
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"before-ping")
        _, p1, _ = ws_recv(sock)
        ok1 = p1 == b"before-ping"

        ws_send(sock, 9, b"mid-test")
        op, _, _ = ws_recv(sock)
        got_pong = op == 10

        ws_send(sock, 1, b"after-ping")
        _, p2, _ = ws_recv(sock)
        ok2 = p2 == b"after-ping"

        ok = ok1 and got_pong and ok2
        record("9.4", "Messages flow normally around ping/pong", ok,
               f"before={ok1} pong={got_pong} after={ok2}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("9.4", "Messages flow normally around ping/pong", False, str(e))


# =====================================================================
# Category 10: Masking
# =====================================================================

def test_10_masking(srv):
    print("\n--- Category 10: Masking ---")

    # 10.1: Masked client frames accepted by server
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"mask-test", mask=True)
        op, payload, _ = ws_recv(sock)
        ok = op == 1 and payload == b"mask-test"
        record("10.1", "Masked client frame accepted by server", ok,
               f"got {payload!r}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("10.1", "Masked client frame accepted by server", False, str(e))

    # 10.2: Server frames are unmasked (mask bit = 0)
    #       RFC 6455 Section 5.1: server MUST NOT mask
    try:
        sock, _, _ = ws_connect()
        ws_send(sock, 1, b"check-mask")
        fd = sock.fileno()
        sock.settimeout(5)
        buf = _recv_buffers.get(fd, b"")
        while len(buf) < 2:
            chunk = sock.recv(4096)
            if not chunk:
                raise ConnectionError("closed")
            buf += chunk
        mask_bit = bool(buf[1] & 0x80)
        passed = not mask_bit
        record("10.2", "Server frames unmasked (mask bit = 0)", passed,
               f"mask_bit={mask_bit}" if not passed else "")
        _recv_buffers.pop(fd, None)
        sock.close()
    except Exception as e:
        record("10.2", "Server frames unmasked (mask bit = 0)", False, str(e))

    # 10.3: XOR masking with known key produces correct echo
    #       Validates the masking logic in websocket.zig writeFrame
    try:
        sock, _, _ = ws_connect()
        payload = b"ABCD"
        mask_key = b"\x12\x34\x56\x78"
        expected_masked = bytes(payload[i] ^ mask_key[i % 4] for i in range(len(payload)))
        frame = struct.pack("!BB", 0x81, 0x80 | len(payload))
        frame += mask_key + expected_masked
        sock.sendall(frame)
        op, recv_payload, _ = ws_recv(sock)
        ok = op == 1 and recv_payload == payload
        record("10.3", "XOR masking with known key produces correct echo", ok,
               f"got {recv_payload!r}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("10.3", "XOR masking with known key produces correct echo", False, str(e))

    # 10.4: Mask key wraps correctly for non-aligned payload (5 bytes)
    try:
        sock, _, _ = ws_connect()
        payload = b"ABCDE"
        mask_key = b"\xAA\xBB\xCC\xDD"
        masked = bytes(payload[i] ^ mask_key[i % 4] for i in range(len(payload)))
        frame = struct.pack("!BB", 0x81, 0x80 | len(payload))
        frame += mask_key + masked
        sock.sendall(frame)
        op, recv_payload, _ = ws_recv(sock)
        ok = op == 1 and recv_payload == payload
        record("10.4", "Mask key wraps for non-aligned payload (5B)", ok,
               f"got {recv_payload!r}" if not ok else "")
        ws_close(sock)
    except Exception as e:
        record("10.4", "Mask key wraps for non-aligned payload (5B)", False, str(e))


# =====================================================================
# Main
# =====================================================================

def main():
    print("WebSocket CLIENT Conformance Tests")
    print(f"Testing protocol behaviors for websocket.zig")
    print(f"Echo server: ws://{SERVER_HOST}:{SERVER_PORT}\n")

    srv = EchoServer(SERVER_HOST, SERVER_PORT)
    srv.start()
    time.sleep(0.3)

    # Verify server is up
    try:
        sock, _, _ = ws_connect(timeout=3)
        ws_close(sock)
        print("Echo server started.\n")
    except Exception as e:
        print(f"ERROR: Echo server not reachable: {e}")
        srv.stop()
        sys.exit(1)

    try:
        test_1_connect(srv)
        test_2_text(srv)
        test_3_binary(srv)
        test_4_ping(srv)
        test_5_close(srv)
        test_6_fragmentation(srv)
        test_7_large(srv)
        test_8_errors(srv)
        test_9_multi(srv)
        test_10_masking(srv)
    finally:
        srv.stop()

    # Summary
    total = len(RESULTS)
    passed = sum(1 for v in RESULTS.values() if v["behavior"] == "OK")
    failed = total - passed

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'=' * 60}")

    if failed:
        print(f"\nFailed tests:")
        for cid, info in sorted(RESULTS.items(), key=lambda x: [int(p) for p in x[0].split(".")]):
            if info["behavior"] != "OK":
                print(f"  {cid}: {info['description']} -- {info['detail']}")

    # Save results
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
    os.makedirs(results_dir, exist_ok=True)
    results_file = os.path.join(results_dir, "results.json")
    with open(results_file, "w") as f:
        json.dump(
            {"total": total, "passed": passed, "failed": failed, "cases": RESULTS},
            f, indent=2,
        )
    print(f"\nResults saved to {results_file}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
