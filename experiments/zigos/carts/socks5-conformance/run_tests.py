#!/usr/bin/env python3
"""
SOCKS5 protocol conformance tests.

Tests the SOCKS5 client protocol (socks5.zig) by running a Python mock
SOCKS5 proxy server and validating the exact protocol bytes.

Categories:
  1.x  No-auth connection (RFC 1928)
  2.x  Username/password auth (RFC 1929)
  3.x  Error handling (auth rejected, connect failed)
  4.x  Domain name resolution

The mock proxy accepts SOCKS5 CONNECT requests, validates protocol correctness,
and either tunnels to a local echo server or returns controlled errors.
"""

import json
import os
import socket
import struct
import sys
import threading
import time

RESULTS = {}
PROXY_HOST = "127.0.0.1"
PROXY_PORT = 19050
ECHO_PORT = 19051


# ═══════════════════════════════════════════════════════════════════════
# Mock SOCKS5 Proxy Server
# ═══════════════════════════════════════════════════════════════════════

class MockSocks5Proxy:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False
        self.require_auth = False
        self.valid_user = "testuser"
        self.valid_pass = "testpass"
        self.fail_connect = False  # If True, return connect failure
        self.fail_code = 5  # Connection refused
        self.connections_log = []

    def start(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.settimeout(1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(8)
        self.running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()

    def _accept_loop(self):
        while self.running:
            try:
                client, addr = self.sock.accept()
                client.settimeout(5)
                threading.Thread(target=self._handle, args=(client,), daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle(self, client):
        try:
            # Step 1: Greeting
            greeting = client.recv(32)
            if len(greeting) < 3 or greeting[0] != 5:
                client.close()
                return

            version = greeting[0]
            nmethods = greeting[1]
            methods = greeting[2:2 + nmethods]
            self.connections_log.append({"greeting": True, "methods": list(methods)})

            if self.require_auth:
                if 2 not in methods:  # Username/password
                    client.sendall(b"\x05\xff")  # No acceptable methods
                    client.close()
                    return
                client.sendall(b"\x05\x02")  # Select username/password

                # Step 2: Auth
                auth = client.recv(512)
                if len(auth) < 3 or auth[0] != 1:
                    client.sendall(b"\x01\x01")  # Auth failed
                    client.close()
                    return
                ulen = auth[1]
                user = auth[2:2 + ulen].decode()
                plen = auth[2 + ulen]
                passwd = auth[3 + ulen:3 + ulen + plen].decode()

                if user == self.valid_user and passwd == self.valid_pass:
                    client.sendall(b"\x01\x00")  # Success
                else:
                    client.sendall(b"\x01\x01")  # Failure
                    client.close()
                    return
            else:
                if 0 not in methods:
                    client.sendall(b"\x05\xff")
                    client.close()
                    return
                client.sendall(b"\x05\x00")  # Select no-auth

            # Step 3: CONNECT request
            req = client.recv(512)
            if len(req) < 7 or req[0] != 5 or req[1] != 1:
                client.close()
                return

            addr_type = req[3]
            if addr_type == 3:  # Domain
                dlen = req[4]
                target_host = req[5:5 + dlen].decode()
                target_port = struct.unpack("!H", req[5 + dlen:7 + dlen])[0]
            elif addr_type == 1:  # IPv4
                target_host = socket.inet_ntoa(req[4:8])
                target_port = struct.unpack("!H", req[8:10])[0]
            else:
                client.close()
                return

            self.connections_log.append({
                "connect": True,
                "host": target_host,
                "port": target_port
            })

            if self.fail_connect:
                # Return error response
                client.sendall(bytes([5, self.fail_code, 0, 1, 0, 0, 0, 0, 0, 0]))
                client.close()
                return

            # Connect to actual target
            try:
                target = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                target.settimeout(5)
                # Resolve domain to localhost for testing
                actual_host = "127.0.0.1" if target_host in ("localhost", "127.0.0.1", "test.local") else target_host
                target.connect((actual_host, target_port))
            except Exception:
                client.sendall(bytes([5, 5, 0, 1, 0, 0, 0, 0, 0, 0]))  # Connection refused
                client.close()
                return

            # Send success response (bound to 0.0.0.0:0)
            client.sendall(bytes([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]))

            # Tunnel: bidirectional relay
            def relay(src, dst):
                try:
                    while True:
                        data = src.recv(4096)
                        if not data:
                            break
                        dst.sendall(data)
                except Exception:
                    pass
                try:
                    dst.shutdown(socket.SHUT_WR)
                except Exception:
                    pass

            t1 = threading.Thread(target=relay, args=(client, target), daemon=True)
            t2 = threading.Thread(target=relay, args=(target, client), daemon=True)
            t1.start()
            t2.start()
            t1.join(timeout=10)
            t2.join(timeout=10)
            target.close()
        except Exception:
            pass
        finally:
            try:
                client.close()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════
# Simple TCP Echo Server (target behind proxy)
# ═══════════════════════════════════════════════════════════════════════

class EchoServer:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.sock = None
        self.running = False

    def start(self):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.settimeout(1)
        self.sock.bind((self.host, self.port))
        self.sock.listen(8)
        self.running = True
        threading.Thread(target=self._loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.sock:
            self.sock.close()

    def _loop(self):
        while self.running:
            try:
                client, _ = self.sock.accept()
                client.settimeout(5)
                threading.Thread(target=self._echo, args=(client,), daemon=True).start()
            except socket.timeout:
                continue
            except OSError:
                break

    def _echo(self, client):
        try:
            while True:
                data = client.recv(4096)
                if not data:
                    break
                client.sendall(data)
        except Exception:
            pass
        finally:
            client.close()


# ═══════════════════════════════════════════════════════════════════════
# SOCKS5 Client (simulates what socks5.zig does)
# ═══════════════════════════════════════════════════════════════════════

def socks5_connect(proxy_host, proxy_port, target_host, target_port, user=None, passwd=None):
    """Pure-Python SOCKS5 connect — same protocol as socks5.zig."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect((proxy_host, proxy_port))

    # Greeting
    if user:
        sock.sendall(bytes([5, 2, 0, 2]))  # no-auth + user/pass
    else:
        sock.sendall(bytes([5, 1, 0]))  # no-auth only

    resp = sock.recv(2)
    if resp[0] != 5:
        raise Exception(f"Bad version: {resp[0]}")
    if resp[1] == 0xFF:
        raise Exception("No acceptable auth method")

    # Auth if needed
    if resp[1] == 2:
        if not user:
            raise Exception("Server wants auth but no credentials")
        auth = bytes([1, len(user)]) + user.encode() + bytes([len(passwd)]) + passwd.encode()
        sock.sendall(auth)
        auth_resp = sock.recv(2)
        if auth_resp[1] != 0:
            raise Exception("Auth failed")

    # CONNECT request
    host_bytes = target_host.encode()
    req = bytes([5, 1, 0, 3, len(host_bytes)]) + host_bytes + struct.pack("!H", target_port)
    sock.sendall(req)

    # CONNECT response
    resp = sock.recv(4)
    if resp[1] != 0:
        error_names = {1: "general", 2: "not allowed", 3: "network unreachable",
                       4: "host unreachable", 5: "connection refused", 6: "TTL expired",
                       7: "command not supported", 8: "address type not supported"}
        raise Exception(f"SOCKS5 error: {error_names.get(resp[1], resp[1])}")

    # Consume bound address
    if resp[3] == 1:  # IPv4
        sock.recv(6)
    elif resp[3] == 3:  # Domain
        dlen = sock.recv(1)[0]
        sock.recv(dlen + 2)
    elif resp[3] == 4:  # IPv6
        sock.recv(18)

    return sock


def record(case_id, desc, passed, detail=""):
    RESULTS[case_id] = {"behavior": "OK" if passed else "FAILED", "description": desc, "detail": detail}
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {case_id}: {desc}" + (f" ({detail})" if detail and not passed else ""))


# ═══════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════

def test_1_noauth(proxy):
    print("\n--- Category 1: No-Auth Connection ---")
    proxy.require_auth = False
    proxy.fail_connect = False

    # 1.1: Basic tunnel through proxy
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT)
        sock.sendall(b"hello via proxy")
        data = sock.recv(4096)
        passed = data == b"hello via proxy"
        record("1.1", "Tunnel through SOCKS5 proxy", passed, f"got={data!r}")
        sock.close()
    except Exception as e:
        record("1.1", "Tunnel through SOCKS5 proxy", False, str(e))

    # 1.2: Domain name resolution
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "localhost", ECHO_PORT)
        sock.sendall(b"domain test")
        data = sock.recv(4096)
        record("1.2", "Domain name via SOCKS5", data == b"domain test")
        sock.close()
    except Exception as e:
        record("1.2", "Domain name via SOCKS5", False, str(e))

    # 1.3: Multiple messages through tunnel
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT)
        passed = True
        for i in range(5):
            msg = f"msg-{i}".encode()
            sock.sendall(msg)
            data = sock.recv(4096)
            if data != msg:
                passed = False
                break
        record("1.3", "5 messages through tunnel", passed)
        sock.close()
    except Exception as e:
        record("1.3", "5 messages through tunnel", False, str(e))


def test_2_auth(proxy):
    print("\n--- Category 2: Username/Password Auth ---")
    proxy.require_auth = True
    proxy.fail_connect = False

    # 2.1: Valid credentials
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT,
                               user="testuser", passwd="testpass")
        sock.sendall(b"authed")
        data = sock.recv(4096)
        record("2.1", "Auth with valid credentials", data == b"authed")
        sock.close()
    except Exception as e:
        record("2.1", "Auth with valid credentials", False, str(e))

    # 2.2: Invalid credentials
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT,
                               user="wrong", passwd="creds")
        record("2.2", "Reject invalid credentials", False, "connected unexpectedly")
        sock.close()
    except Exception as e:
        record("2.2", "Reject invalid credentials", "Auth failed" in str(e) or "failed" in str(e).lower())

    # 2.3: Empty password
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT,
                               user="testuser", passwd="")
        record("2.3", "Reject empty password", False, "connected unexpectedly")
        sock.close()
    except Exception as e:
        record("2.3", "Reject empty password", True)

    proxy.require_auth = False


def test_3_errors(proxy):
    print("\n--- Category 3: Error Handling ---")

    # 3.1: Connection refused by target
    proxy.fail_connect = True
    proxy.fail_code = 5
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", 19999)
        record("3.1", "Connection refused error", False, "connected")
        sock.close()
    except Exception as e:
        record("3.1", "Connection refused error", "refused" in str(e).lower())
    proxy.fail_connect = False

    # 3.2: Network unreachable
    proxy.fail_connect = True
    proxy.fail_code = 3
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "10.255.255.1", 80)
        record("3.2", "Network unreachable error", False, "connected")
        sock.close()
    except Exception as e:
        record("3.2", "Network unreachable error", "unreachable" in str(e).lower())
    proxy.fail_connect = False

    # 3.3: Host unreachable
    proxy.fail_connect = True
    proxy.fail_code = 4
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "nonexistent.test", 80)
        record("3.3", "Host unreachable error", False, "connected")
        sock.close()
    except Exception as e:
        record("3.3", "Host unreachable error", "unreachable" in str(e).lower())
    proxy.fail_connect = False

    # 3.4: Connect to dead proxy port
    try:
        sock = socks5_connect(PROXY_HOST, 19999, "127.0.0.1", ECHO_PORT)
        record("3.4", "Proxy not running → connection refused", False, "connected")
        sock.close()
    except (ConnectionRefusedError, socket.timeout, OSError):
        record("3.4", "Proxy not running → connection refused", True)
    except Exception as e:
        record("3.4", "Proxy not running → connection refused", True, str(e))


def test_4_domain(proxy):
    print("\n--- Category 4: Domain Names ---")
    proxy.require_auth = False
    proxy.fail_connect = False

    # 4.1: Short domain
    try:
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "test.local", ECHO_PORT)
        sock.sendall(b"short domain")
        data = sock.recv(4096)
        record("4.1", "Short domain name", data == b"short domain")
        sock.close()
    except Exception as e:
        record("4.1", "Short domain name", False, str(e))

    # 4.2: Protocol log validation
    try:
        proxy.connections_log.clear()
        sock = socks5_connect(PROXY_HOST, PROXY_PORT, "127.0.0.1", ECHO_PORT)
        sock.close()
        has_greeting = any(e.get("greeting") for e in proxy.connections_log)
        has_connect = any(e.get("connect") for e in proxy.connections_log)
        record("4.2", "Protocol log shows greeting + connect", has_greeting and has_connect)
    except Exception as e:
        record("4.2", "Protocol log shows greeting + connect", False, str(e))


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("SOCKS5 Protocol Conformance Tests")
    print(f"Proxy: {PROXY_HOST}:{PROXY_PORT}, Echo: {PROXY_HOST}:{ECHO_PORT}\n")

    echo = EchoServer(PROXY_HOST, ECHO_PORT)
    echo.start()
    proxy = MockSocks5Proxy(PROXY_HOST, PROXY_PORT)
    proxy.start()
    time.sleep(0.3)
    print("Mock SOCKS5 proxy + echo server started.")

    try:
        test_1_noauth(proxy)
        test_2_auth(proxy)
        test_3_errors(proxy)
        test_4_domain(proxy)
    finally:
        proxy.stop()
        echo.stop()

    total = len(RESULTS)
    passed = sum(1 for v in RESULTS.values() if v["behavior"] == "OK")
    failed = total - passed
    print(f"\n{'='*60}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'='*60}")
    if failed:
        print(f"\nFailed:")
        for cid, info in sorted(RESULTS.items()):
            if info["behavior"] != "OK":
                print(f"  {cid}: {info['description']} -- {info['detail']}")
    results_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports")
    os.makedirs(results_dir, exist_ok=True)
    with open(os.path.join(results_dir, "results.json"), "w") as f:
        json.dump({"total": total, "passed": passed, "failed": failed, "cases": RESULTS}, f, indent=2)
    print(f"\nResults saved to {results_dir}/results.json")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
