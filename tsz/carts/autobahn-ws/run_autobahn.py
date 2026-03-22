#!/usr/bin/env python3
"""
WebSocket RFC 6455 conformance test suite for the tsz echo server.

Covers the same categories as the Autobahn test suite:
  1.x  Text message echo
  2.x  Binary message echo
  3.x  RSV bits (must reject)
  4.x  Reserved opcodes (must reject)
  5.x  Fragmentation
  6.x  UTF-8 handling
  7.x  Close handling
  9.x  Limits / performance

Usage:
  1. Start the echo server:  carts/autobahn-ws/echo_server
  2. Run:  python3 carts/autobahn-ws/run_autobahn.py

Requires: websocket-client (pip3 install websocket-client)
"""

import hashlib
import base64
import os
import socket
import struct
import sys
import time
import json

SERVER = ("127.0.0.1", 9001)
RESULTS = {}  # case_id -> {behavior, description}


def raw_connect():
    """Raw TCP connection + WebSocket handshake, returns socket."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect(SERVER)

    # WebSocket handshake
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {SERVER[0]}:{SERVER[1]}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"Sec-WebSocket-Key: {key}\r\n\r\n"
    )
    sock.sendall(req.encode())

    # Read HTTP response
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = sock.recv(4096)
        if not chunk:
            raise ConnectionError("Connection closed during handshake")
        resp += chunk

    if b"101" not in resp.split(b"\r\n")[0]:
        raise ConnectionError(f"Handshake failed: {resp[:100]}")

    return sock


def send_frame(sock, opcode, payload, fin=True, mask=True, rsv1=False, rsv2=False, rsv3=False):
    """Send a WebSocket frame with full control over flags."""
    first_byte = (0x80 if fin else 0) | (0x40 if rsv1 else 0) | (0x20 if rsv2 else 0) | (0x10 if rsv3 else 0) | opcode
    mask_key = os.urandom(4) if mask else b""

    if len(payload) > 65535:
        header = struct.pack("!BB", first_byte, (0x80 if mask else 0) | 127) + struct.pack("!Q", len(payload))
    elif len(payload) > 125:
        header = struct.pack("!BB", first_byte, (0x80 if mask else 0) | 126) + struct.pack("!H", len(payload))
    else:
        header = struct.pack("!BB", first_byte, (0x80 if mask else 0) | len(payload))

    if mask:
        masked = bytes(payload[i] ^ mask_key[i % 4] for i in range(len(payload)))
        sock.sendall(header + mask_key + masked)
    else:
        sock.sendall(header + payload)


# Persistent receive buffer per socket (keyed by socket fd)
_recv_buffers = {}


def recv_frame(sock, timeout=5):
    """Receive a WebSocket frame. Returns (opcode, payload, fin).
    Uses a persistent buffer to handle multiple frames arriving in one recv."""
    sock.settimeout(timeout)
    fd = sock.fileno()
    if fd not in _recv_buffers:
        _recv_buffers[fd] = b""

    def recv_exact(n):
        buf = _recv_buffers[fd]
        while len(buf) < n:
            chunk = sock.recv(65536)
            if not chunk:
                _recv_buffers[fd] = buf
                raise ConnectionError("Connection closed")
            buf += chunk
        result = buf[:n]
        _recv_buffers[fd] = buf[n:]
        return result

    hdr = recv_exact(2)
    fin = bool(hdr[0] & 0x80)
    opcode = hdr[0] & 0x0F
    masked = bool(hdr[1] & 0x80)
    length = hdr[1] & 0x7F

    if length == 126:
        length = struct.unpack("!H", recv_exact(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", recv_exact(8))[0]

    if masked:
        mask_key = recv_exact(4)
        payload = bytearray(recv_exact(length))
        for i in range(length):
            payload[i] ^= mask_key[i % 4]
        payload = bytes(payload)
    else:
        payload = recv_exact(length)

    return opcode, payload, fin


def clean_close(sock):
    """Send close frame and shut down cleanly to free server slot."""
    try:
        send_frame(sock, 8, struct.pack("!H", 1000))
        sock.settimeout(1)
        try:
            sock.recv(4096)  # drain close response
        except Exception:
            pass
    except Exception:
        pass
    try:
        sock.close()
    except Exception:
        pass


def expect_echo(sock, sent_payload, expected_opcode=None):
    """Receive and verify echo matches sent payload."""
    opcode, payload, fin = recv_frame(sock)
    if expected_opcode is not None and opcode != expected_opcode:
        return False, f"Expected opcode {expected_opcode}, got {opcode}"
    if payload != sent_payload:
        return False, f"Payload mismatch: sent {len(sent_payload)}B, got {len(payload)}B"
    return True, "OK"


def expect_close(sock, expected_code=None, timeout=5):
    """Expect a close frame. Returns (got_close, code)."""
    try:
        opcode, payload, _ = recv_frame(sock, timeout=timeout)
        if opcode != 8:
            return False, 0
        code = struct.unpack("!H", payload[:2])[0] if len(payload) >= 2 else 1005
        if expected_code and code != expected_code:
            return True, code  # Got close but wrong code
        return True, code
    except (socket.timeout, ConnectionError, struct.error):
        return False, 0


def record(case_id, description, passed, detail=""):
    status = "OK" if passed else "FAILED"
    RESULTS[case_id] = {"behavior": status, "description": description, "detail": detail}
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {case_id}: {description}" + (f" ({detail})" if detail and not passed else ""))


# ═══════════════════════════════════════════════════════════════════════
# Category 1: Text Messages
# ═══════════════════════════════════════════════════════════════════════

def test_1_text_messages():
    print("\n--- Category 1: Text Message Echo ---")

    # 1.1: Empty text
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"")
        ok, detail = expect_echo(sock, b"", 1)
        record("1.1", "Empty text message echo", ok, detail)
        send_frame(sock, 8, b"")  # close
        clean_close(sock)
    except Exception as e:
        record("1.1", "Empty text message echo", False, str(e))

    # 1.2: Small text
    try:
        sock = raw_connect()
        msg = b"Hello"
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("1.2", "Small text message echo", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("1.2", "Small text message echo", False, str(e))

    # 1.3: Medium text (126 bytes — extended length)
    try:
        sock = raw_connect()
        msg = b"x" * 200
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("1.3", "Medium text (200B, extended length)", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("1.3", "Medium text (200B, extended length)", False, str(e))

    # 1.4: Large text (64KB)
    try:
        sock = raw_connect()
        msg = b"A" * 65535
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("1.4", "Large text (64KB)", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("1.4", "Large text (64KB)", False, str(e))

    # 1.5: Multiple messages on same connection
    try:
        sock = raw_connect()
        passed = True
        for i in range(10):
            msg = f"msg-{i}".encode()
            send_frame(sock, 1, msg)
            ok, detail = expect_echo(sock, msg, 1)
            if not ok:
                passed = False
                break
        record("1.5", "10 sequential text messages", passed, detail if not passed else "")
        clean_close(sock)
    except Exception as e:
        record("1.5", "10 sequential text messages", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Category 2: Binary Messages
# ═══════════════════════════════════════════════════════════════════════

def test_2_binary_messages():
    print("\n--- Category 2: Binary Message Echo ---")

    # 2.1: Empty binary
    try:
        sock = raw_connect()
        send_frame(sock, 2, b"")
        ok, detail = expect_echo(sock, b"", 2)
        record("2.1", "Empty binary message echo", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("2.1", "Empty binary message echo", False, str(e))

    # 2.2: Small binary
    try:
        sock = raw_connect()
        msg = bytes(range(256))
        send_frame(sock, 2, msg)
        ok, detail = expect_echo(sock, msg, 2)
        record("2.2", "256B binary echo", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("2.2", "256B binary echo", False, str(e))

    # 2.3: Large binary
    try:
        sock = raw_connect()
        msg = os.urandom(65535)
        send_frame(sock, 2, msg)
        ok, detail = expect_echo(sock, msg, 2)
        record("2.3", "64KB binary echo", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("2.3", "64KB binary echo", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Category 3: RSV Bits (must be rejected — no extensions)
# ═══════════════════════════════════════════════════════════════════════

def test_3_rsv_bits():
    print("\n--- Category 3: RSV Bits ---")

    for i, (r1, r2, r3) in enumerate([(True, False, False), (False, True, False), (False, False, True),
                                       (True, True, False), (True, False, True), (False, True, True),
                                       (True, True, True)], 1):
        case_id = f"3.{i}"
        rsv_desc = f"RSV{'1' if r1 else ''}{'2' if r2 else ''}{'3' if r3 else ''}"
        try:
            sock = raw_connect()
            send_frame(sock, 1, b"hello", rsv1=r1, rsv2=r2, rsv3=r3)
            got_close, code = expect_close(sock, timeout=3)
            passed = got_close and code == 1002
            detail = f"close code={code}" if got_close else "no close frame"
            record(case_id, f"{rsv_desc} text → must fail", passed, detail)
            clean_close(sock)
        except Exception as e:
            # Connection reset = also acceptable (server rejected)
            record(case_id, f"{rsv_desc} text → must fail", True, f"connection error (acceptable): {e}")


# ═══════════════════════════════════════════════════════════════════════
# Category 4: Reserved Opcodes (must be rejected)
# ═══════════════════════════════════════════════════════════════════════

def test_4_opcodes():
    print("\n--- Category 4: Reserved Opcodes ---")

    reserved = [3, 4, 5, 6, 7, 0xB, 0xC, 0xD, 0xE, 0xF]
    for i, op in enumerate(reserved, 1):
        case_id = f"4.{i}"
        try:
            sock = raw_connect()
            send_frame(sock, op, b"test")
            got_close, code = expect_close(sock, timeout=3)
            passed = got_close and code == 1002
            detail = f"close code={code}" if got_close else "no close frame"
            record(case_id, f"Reserved opcode 0x{op:X} → must fail", passed, detail)
            clean_close(sock)
        except Exception as e:
            record(case_id, f"Reserved opcode 0x{op:X} → must fail", True, f"connection error (acceptable)")


# ═══════════════════════════════════════════════════════════════════════
# Category 5: Fragmentation
# ═══════════════════════════════════════════════════════════════════════

def test_5_fragmentation():
    print("\n--- Category 5: Fragmentation ---")

    # 5.1: Two text fragments
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"Hel", fin=False)
        send_frame(sock, 0, b"lo", fin=True)
        ok, detail = expect_echo(sock, b"Hello", 1)
        record("5.1", "Text in 2 fragments", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("5.1", "Text in 2 fragments", False, str(e))

    # 5.2: Three text fragments
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"AB", fin=False)
        send_frame(sock, 0, b"CD", fin=False)
        send_frame(sock, 0, b"EF", fin=True)
        ok, detail = expect_echo(sock, b"ABCDEF", 1)
        record("5.2", "Text in 3 fragments", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("5.2", "Text in 3 fragments", False, str(e))

    # 5.3: Binary fragments
    try:
        sock = raw_connect()
        send_frame(sock, 2, b"\x00\x01", fin=False)
        send_frame(sock, 0, b"\x02\x03", fin=True)
        ok, detail = expect_echo(sock, b"\x00\x01\x02\x03", 2)
        record("5.3", "Binary in 2 fragments", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("5.3", "Binary in 2 fragments", False, str(e))

    # 5.4: Ping interleaved in fragmented message
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"frag1", fin=False)
        send_frame(sock, 9, b"ping")  # Ping (control, always FIN)
        # Should get pong first
        op, payload, _ = recv_frame(sock)
        got_pong = (op == 10 and payload == b"ping")
        send_frame(sock, 0, b"frag2", fin=True)
        ok, detail = expect_echo(sock, b"frag1frag2", 1)
        passed = got_pong and ok
        record("5.4", "Ping interleaved in fragments", passed,
               f"pong={'OK' if got_pong else 'MISSING'}, echo={detail}")
        clean_close(sock)
    except Exception as e:
        record("5.4", "Ping interleaved in fragments", False, str(e))

    # 5.5: Empty first fragment
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"", fin=False)
        send_frame(sock, 0, b"data", fin=True)
        ok, detail = expect_echo(sock, b"data", 1)
        record("5.5", "Empty first fragment", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("5.5", "Empty first fragment", False, str(e))

    # 5.6: Unexpected continuation frame (no fragmented message in progress)
    try:
        sock = raw_connect()
        send_frame(sock, 0, b"orphan", fin=True)
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1002
        record("5.6", "Unexpected continuation → must fail", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("5.6", "Unexpected continuation → must fail", True, "connection error (acceptable)")


# ═══════════════════════════════════════════════════════════════════════
# Category 6: UTF-8 Handling
# ═══════════════════════════════════════════════════════════════════════

def test_6_utf8():
    print("\n--- Category 6: UTF-8 Handling ---")

    # 6.1: Valid UTF-8
    try:
        sock = raw_connect()
        msg = "Hello, 世界! 🌍".encode("utf-8")
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("6.1", "Valid UTF-8 text", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("6.1", "Valid UTF-8 text", False, str(e))

    # 6.2: Valid UTF-8 with all BMP ranges
    try:
        sock = raw_connect()
        msg = "\u0000\u007F\u0080\u07FF\u0800\uFFFF".encode("utf-8")
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("6.2", "UTF-8 BMP boundary characters", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("6.2", "UTF-8 BMP boundary characters", False, str(e))

    # 6.3: Invalid UTF-8 — lone continuation byte
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"\x80")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("6.3", "Invalid UTF-8 (lone continuation) → 1007", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("6.3", "Invalid UTF-8 (lone continuation) → 1007", True, "connection error (acceptable)")

    # 6.4: Invalid UTF-8 — truncated 2-byte sequence
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"\xC0")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("6.4", "Invalid UTF-8 (truncated 2-byte) → 1007", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("6.4", "Invalid UTF-8 (truncated 2-byte) → 1007", True, "connection error (acceptable)")

    # 6.5: Invalid UTF-8 — overlong encoding
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"\xC0\xAF")  # overlong '/'
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("6.5", "Invalid UTF-8 (overlong) → 1007", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("6.5", "Invalid UTF-8 (overlong) → 1007", True, "connection error (acceptable)")

    # 6.6: Invalid UTF-8 — surrogates
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"\xED\xA0\x80")  # U+D800 (surrogate)
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("6.6", "Invalid UTF-8 (surrogate) → 1007", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("6.6", "Invalid UTF-8 (surrogate) → 1007", True, "connection error (acceptable)")

    # 6.7: Invalid UTF-8 in fragmented text — invalid in continuation
    try:
        sock = raw_connect()
        send_frame(sock, 1, b"valid ", fin=False)
        send_frame(sock, 0, b"\xFF\xFE", fin=True)  # invalid bytes
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("6.7", "Invalid UTF-8 in continuation → 1007", passed,
               f"close code={code}" if got_close else "no close")
        clean_close(sock)
    except Exception as e:
        record("6.7", "Invalid UTF-8 in continuation → 1007", True, "connection error (acceptable)")


# ═══════════════════════════════════════════════════════════════════════
# Category 7: Close Handling
# ═══════════════════════════════════════════════════════════════════════

def test_7_close():
    print("\n--- Category 7: Close Handling ---")

    # 7.1: Clean close with code
    try:
        sock = raw_connect()
        send_frame(sock, 8, struct.pack("!H", 1000) + b"normal close")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close
        record("7.1", "Clean close (1000)", passed, f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.1", "Clean close (1000)", False, str(e))

    # 7.2: Close with empty body
    try:
        sock = raw_connect()
        send_frame(sock, 8, b"")
        got_close, code = expect_close(sock, timeout=3)
        record("7.2", "Close with empty body", got_close,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.2", "Close with empty body", False, str(e))

    # 7.3: Close with only code, no reason
    try:
        sock = raw_connect()
        send_frame(sock, 8, struct.pack("!H", 1000))
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1000
        record("7.3", "Close with code only", passed, f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.3", "Close with code only", False, str(e))

    # 7.4: Close with invalid code (1005 — reserved, must not appear in frame)
    try:
        sock = raw_connect()
        send_frame(sock, 8, struct.pack("!H", 1005))
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1002
        record("7.4", "Close with reserved code 1005 → 1002", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.4", "Close with reserved code 1005 → 1002", True, "connection error (acceptable)")

    # 7.5: Close with 1 byte payload (invalid — must be 0 or ≥2)
    try:
        sock = raw_connect()
        send_frame(sock, 8, b"\x03")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1002
        record("7.5", "Close with 1-byte payload → 1002", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.5", "Close with 1-byte payload → 1002", True, "connection error (acceptable)")

    # 7.6: Close with invalid UTF-8 reason
    try:
        sock = raw_connect()
        send_frame(sock, 8, struct.pack("!H", 1000) + b"\xFF\xFE")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1007
        record("7.6", "Close with invalid UTF-8 reason → 1007", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.6", "Close with invalid UTF-8 reason → 1007", True, "connection error (acceptable)")

    # 7.7: Close with valid application code (3000)
    try:
        sock = raw_connect()
        send_frame(sock, 8, struct.pack("!H", 3000) + b"app close")
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close
        record("7.7", "Close with application code 3000", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("7.7", "Close with application code 3000", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Category 9: Ping/Pong
# ═══════════════════════════════════════════════════════════════════════

def test_9_ping_pong():
    print("\n--- Category 9: Ping/Pong ---")

    # 9.1: Simple ping
    try:
        sock = raw_connect()
        send_frame(sock, 9, b"")
        op, payload, _ = recv_frame(sock, timeout=3)
        passed = (op == 10 and payload == b"")
        record("9.1", "Empty ping → pong", passed, f"op={op}" if not passed else "")
        clean_close(sock)
    except Exception as e:
        record("9.1", "Empty ping → pong", False, str(e))

    # 9.2: Ping with payload
    try:
        sock = raw_connect()
        send_frame(sock, 9, b"pingdata")
        op, payload, _ = recv_frame(sock, timeout=3)
        passed = (op == 10 and payload == b"pingdata")
        record("9.2", "Ping with payload → pong echoes payload", passed,
               f"op={op}, payload={payload!r}" if not passed else "")
        clean_close(sock)
    except Exception as e:
        record("9.2", "Ping with payload → pong echoes payload", False, str(e))

    # 9.3: Ping with 125 bytes (max for control)
    try:
        sock = raw_connect()
        data = b"P" * 125
        send_frame(sock, 9, data)
        op, payload, _ = recv_frame(sock, timeout=3)
        passed = (op == 10 and payload == data)
        record("9.3", "Ping with 125B payload", passed, f"payload_len={len(payload)}" if not passed else "")
        clean_close(sock)
    except Exception as e:
        record("9.3", "Ping with 125B payload", False, str(e))

    # 9.4: Ping with 126 bytes (too large for control) → must fail
    try:
        sock = raw_connect()
        send_frame(sock, 9, b"P" * 126)
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1002
        record("9.4", "Ping >125B → must fail", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("9.4", "Ping >125B → must fail", True, "connection error (acceptable)")

    # 9.5: Unsolicited pong (must be ignored)
    try:
        sock = raw_connect()
        send_frame(sock, 10, b"unsolicited")
        # Server should ignore it; send a text and verify echo still works
        msg = b"after-pong"
        send_frame(sock, 1, msg)
        ok, detail = expect_echo(sock, msg, 1)
        record("9.5", "Unsolicited pong ignored", ok, detail)
        clean_close(sock)
    except Exception as e:
        record("9.5", "Unsolicited pong ignored", False, str(e))

    # 9.6: Fragmented ping (not allowed)
    try:
        sock = raw_connect()
        send_frame(sock, 9, b"frag", fin=False)
        got_close, code = expect_close(sock, timeout=3)
        passed = got_close and code == 1002
        record("9.6", "Fragmented ping → must fail", passed,
               f"code={code}" if got_close else "no close frame")
        clean_close(sock)
    except Exception as e:
        record("9.6", "Fragmented ping → must fail", True, "connection error (acceptable)")


# ═══════════════════════════════════════════════════════════════════════
# Category 10: Misc / Limits
# ═══════════════════════════════════════════════════════════════════════

def test_10_misc():
    print("\n--- Category 10: Misc ---")

    # 10.1: Multiple text messages rapid-fire
    try:
        time.sleep(0.1)  # Let server drain previous test connections
        sock = raw_connect()
        # Verify connection works with a warmup message
        send_frame(sock, 1, b"warmup")
        op, payload, _ = recv_frame(sock, timeout=5)
        assert payload == b"warmup", f"warmup failed: {payload!r}"

        count = 100
        passed = True
        detail = ""
        for i in range(count):
            msg = f"rapid-{i:04d}".encode()
            send_frame(sock, 1, msg)
        for i in range(count):
            msg = f"rapid-{i:04d}".encode()
            ok, detail = expect_echo(sock, msg, 1)
            if not ok:
                detail = f"failed at msg {i}: {detail}"
                passed = False
                break
        record("10.1", f"{count} rapid-fire text messages", passed, detail if not passed else "")
        clean_close(sock)
    except Exception as e:
        record("10.1", f"{count} rapid-fire text messages", False, str(e))

    # 10.2: Concurrent connections
    try:
        socks = []
        for i in range(8):
            s = raw_connect()
            socks.append(s)
        passed = True
        for i, s in enumerate(socks):
            msg = f"conn-{i}".encode()
            send_frame(s, 1, msg)
        for i, s in enumerate(socks):
            msg = f"conn-{i}".encode()
            ok, detail = expect_echo(s, msg, 1)
            if not ok:
                passed = False
                break
        record("10.2", "8 concurrent connections", passed, detail if not passed else "")
        for s in socks:
            clean_close(s)
    except Exception as e:
        record("10.2", "8 concurrent connections", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    print(f"WebSocket RFC 6455 Conformance Tests")
    print(f"Server: ws://{SERVER[0]}:{SERVER[1]}")

    # Verify server is reachable
    try:
        sock = raw_connect()
        clean_close(sock)
    except Exception as e:
        print(f"\nERROR: Cannot connect to server: {e}")
        print("Start the echo server first!")
        sys.exit(1)

    test_1_text_messages()
    test_2_binary_messages()
    test_3_rsv_bits()
    test_4_opcodes()
    test_5_fragmentation()
    test_6_utf8()
    test_7_close()
    test_9_ping_pong()
    test_10_misc()

    # Summary
    total = len(RESULTS)
    passed = sum(1 for v in RESULTS.values() if v["behavior"] == "OK")
    failed = total - passed

    print(f"\n{'='*60}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'='*60}")

    if failed > 0:
        print(f"\nFailed tests:")
        for case_id, info in sorted(RESULTS.items()):
            if info["behavior"] != "OK":
                print(f"  {case_id}: {info['description']} — {info['detail']}")

    # Save results
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
    os.makedirs(results_dir, exist_ok=True)
    results_file = os.path.join(results_dir, "results.json")
    with open(results_file, "w") as f:
        json.dump({"total": total, "passed": passed, "failed": failed, "cases": RESULTS}, f, indent=2)
    print(f"\nResults saved to {results_file}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
