#!/usr/bin/env python3
"""
HTTP conformance test suite for the tsz httpserver.

Tests the HTTP server at framework/net/httpserver.zig by compiling and running
a test server (test_server.zig), then exercising it with http.client requests.

Categories:
  1.x  Basic HTTP methods (GET, POST, PUT, DELETE)
  2.x  Request body handling
  3.x  Status codes
  4.x  Error responses (404, 403)
  5.x  Large payloads
  6.x  Concurrent connections
  7.x  Security (path traversal)
  8.x  Slow responses
  9.x  Edge cases

Usage:
  cd tsz
  python3 carts/http-conformance/run_tests.py

No external dependencies — uses only Python stdlib.
"""

import atexit
import http.client
import json
import os
import signal
import socket
import subprocess
import sys
import threading
import time

TSZ_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SERVER_BIN = os.path.join(TSZ_DIR, "carts", "http-conformance", "test_server")
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8099
RESULTS = {}  # case_id -> {behavior, description, detail}

server_proc = None


# ── Server lifecycle ──────────────────────────────────────────────────

def compile_server():
    """Compile test_server.zig with httpserver as a module dependency."""
    print("Compiling test server...")
    cmd = [
        "zig", "build-exe",
        "--dep", "httpserver",
        "-Mroot=carts/http-conformance/test_server.zig",
        "-Mhttpserver=framework/net/httpserver.zig",
        "-femit-bin=carts/http-conformance/test_server",
    ]
    result = subprocess.run(cmd, cwd=TSZ_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"COMPILE FAILED:\n{result.stderr}")
        sys.exit(1)
    print("Compilation successful.")


def start_server():
    """Start the test server process."""
    global server_proc
    print(f"Starting test server on {SERVER_HOST}:{SERVER_PORT}...")
    server_proc = subprocess.Popen(
        [SERVER_BIN],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    atexit.register(stop_server)

    # Wait for server to be ready (up to 5 seconds)
    for _ in range(50):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            sock.connect((SERVER_HOST, SERVER_PORT))
            sock.close()
            print("Test server ready.")
            return
        except (ConnectionRefusedError, socket.timeout, OSError):
            time.sleep(0.1)

    print("ERROR: Server did not start within 5 seconds.")
    if server_proc.poll() is not None:
        _, stderr = server_proc.communicate()
        print(f"Server exited with code {server_proc.returncode}: {stderr}")
    stop_server()
    sys.exit(1)


def stop_server():
    """Stop the test server process."""
    global server_proc
    if server_proc is not None and server_proc.poll() is None:
        server_proc.terminate()
        try:
            server_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server_proc.kill()
            server_proc.wait()
        print("Test server stopped.")
    server_proc = None


# ── HTTP helpers ──────────────────────────────────────────────────────

def http_request(method, path, body=None, headers=None, timeout=5):
    """Make an HTTP request and return (status, headers_dict, body_str).

    Uses http.client from stdlib — no external dependencies.
    """
    conn = http.client.HTTPConnection(SERVER_HOST, SERVER_PORT, timeout=timeout)
    try:
        hdrs = headers or {}
        if body is not None:
            if isinstance(body, str):
                body = body.encode("utf-8")
            hdrs.setdefault("Content-Length", str(len(body)))
        conn.request(method, path, body=body, headers=hdrs)
        resp = conn.getresponse()
        resp_body = resp.read().decode("utf-8", errors="replace")
        resp_headers = dict(resp.getheaders())
        return resp.status, resp_headers, resp_body
    finally:
        conn.close()


def record(case_id, description, passed, detail=""):
    """Record a test result."""
    status = "OK" if passed else "FAILED"
    RESULTS[case_id] = {"behavior": status, "description": description, "detail": detail}
    mark = "PASS" if passed else "FAIL"
    suffix = f" ({detail})" if detail and not passed else ""
    print(f"  [{mark}] {case_id}: {description}{suffix}")


# ═════════════════════════════════════════════════════════════════════
# Category 1: Basic HTTP Methods
# ═════════════════════════════════════════════════════════════════════

def test_1_methods():
    print("\n--- Category 1: Basic HTTP Methods ---")

    # 1.1: GET request
    try:
        status, _, body = http_request("GET", "/echo")
        passed = status == 200 and body == "GET"
        record("1.1", "GET /echo returns 200 with method name", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("1.1", "GET /echo returns 200 with method name", False, str(e))

    # 1.2: POST request
    try:
        status, _, body = http_request("POST", "/echo", body="hello")
        passed = status == 200 and body == "POST hello"
        record("1.2", "POST /echo echoes method + body", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("1.2", "POST /echo echoes method + body", False, str(e))

    # 1.3: PUT request
    try:
        status, _, body = http_request("PUT", "/echo", body="update-data")
        passed = status == 200 and body == "PUT update-data"
        record("1.3", "PUT /echo echoes method + body", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("1.3", "PUT /echo echoes method + body", False, str(e))

    # 1.4: DELETE request
    try:
        status, _, body = http_request("DELETE", "/echo")
        passed = status == 200 and body == "DELETE"
        record("1.4", "DELETE /echo returns method name", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("1.4", "DELETE /echo returns method name", False, str(e))

    # 1.5: HEAD request (method echoed, body may be empty due to HEAD semantics
    # but our server echoes method name as body content)
    try:
        status, _, body = http_request("HEAD", "/echo")
        # HTTP HEAD responses have Content-Length but empty body per spec.
        # http.client strips body for HEAD. Just verify status.
        passed = status == 200
        record("1.5", "HEAD /echo returns 200", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("1.5", "HEAD /echo returns 200", False, str(e))

    # 1.6: PATCH request
    try:
        status, _, body = http_request("PATCH", "/echo", body="patch-data")
        passed = status == 200 and body == "PATCH patch-data"
        record("1.6", "PATCH /echo echoes method + body", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("1.6", "PATCH /echo echoes method + body", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 2: Request Body Handling
# ═════════════════════════════════════════════════════════════════════

def test_2_body():
    print("\n--- Category 2: Request Body Handling ---")

    # 2.1: Empty body POST
    try:
        status, _, body = http_request("POST", "/echo", body="")
        # Empty body -> server sees body_len=0 -> returns just "POST"
        passed = status == 200 and body == "POST"
        record("2.1", "POST with empty body", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("2.1", "POST with empty body", False, str(e))

    # 2.2: Small body
    try:
        payload = "small payload"
        status, _, body = http_request("POST", "/echo", body=payload)
        passed = status == 200 and body == f"POST {payload}"
        record("2.2", "POST with small body (13B)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("2.2", "POST with small body (13B)", False, str(e))

    # 2.3: Medium body (1KB)
    try:
        payload = "A" * 1024
        status, _, body = http_request("POST", "/echo", body=payload)
        expected = f"POST {payload}"
        passed = status == 200 and body == expected
        record("2.3", "POST with 1KB body", passed,
               f"status={status}, body_len={len(body)}" if not passed else "")
    except Exception as e:
        record("2.3", "POST with 1KB body", False, str(e))

    # 2.4: Larger body (4KB)
    try:
        payload = "B" * 4096
        status, _, body = http_request("POST", "/echo", body=payload)
        expected = f"POST {payload}"
        passed = status == 200 and body == expected
        record("2.4", "POST with 4KB body", passed,
               f"status={status}, body_len={len(body)}" if not passed else "")
    except Exception as e:
        record("2.4", "POST with 4KB body", False, str(e))

    # 2.5: JSON body
    try:
        payload = json.dumps({"key": "value", "number": 42, "nested": {"a": [1, 2, 3]}})
        status, _, body = http_request("POST", "/echo", body=payload,
                                        headers={"Content-Type": "application/json"})
        passed = status == 200 and body == f"POST {payload}"
        record("2.5", "POST with JSON body", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("2.5", "POST with JSON body", False, str(e))

    # 2.6: Binary-like body (non-UTF8 safe characters as raw bytes)
    try:
        payload = "binary\x00test\x01data"
        status, _, body = http_request("POST", "/echo", body=payload.encode("latin-1"))
        passed = status == 200
        record("2.6", "POST with binary-ish body", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("2.6", "POST with binary-ish body", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 3: Status Codes
# ═════════════════════════════════════════════════════════════════════

def test_3_status():
    print("\n--- Category 3: Status Codes ---")

    test_codes = [
        ("3.1", 200, "OK"),
        ("3.2", 201, "Created"),
        ("3.3", 204, "No Content"),
        ("3.4", 301, "Moved Permanently"),
        ("3.5", 400, "Bad Request"),
        ("3.6", 401, "Unauthorized"),
        ("3.7", 403, "Forbidden"),
        ("3.8", 404, "Not Found"),
        ("3.9", 500, "Internal Server Error"),
    ]

    for case_id, code, reason in test_codes:
        try:
            status, _, body = http_request("GET", f"/status/{code}")
            passed = status == code and body == f"status: {code}"
            record(case_id, f"GET /status/{code} returns {code} {reason}", passed,
                   f"status={status}, body={body!r}" if not passed else "")
        except Exception as e:
            record(case_id, f"GET /status/{code} returns {code} {reason}", False, str(e))

    # 3.10: Invalid status code string
    try:
        status, _, body = http_request("GET", "/status/abc")
        passed = status == 400 and "invalid" in body.lower()
        record("3.10", "GET /status/abc returns 400", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("3.10", "GET /status/abc returns 400", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 4: Error Responses (404 / 403)
# ═════════════════════════════════════════════════════════════════════

def test_4_errors():
    print("\n--- Category 4: Error Responses ---")

    # 4.1: 404 for unknown path
    try:
        status, _, body = http_request("GET", "/nonexistent")
        passed = status == 404
        record("4.1", "GET /nonexistent returns 404", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("4.1", "GET /nonexistent returns 404", False, str(e))

    # 4.2: 404 for root path (no route registered for /)
    try:
        status, _, body = http_request("GET", "/")
        passed = status == 404
        record("4.2", "GET / returns 404 (no root route)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("4.2", "GET / returns 404 (no root route)", False, str(e))

    # 4.3: 403 for path traversal with ..
    try:
        status, _, body = http_request("GET", "/echo/../../../etc/passwd")
        passed = status == 403
        record("4.3", "GET with .. path traversal returns 403", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("4.3", "GET with .. path traversal returns 403", False, str(e))

    # 4.4: 404 for partial route prefix that doesn't match boundary
    # e.g., /echoing should NOT match /echo route (boundary check)
    try:
        status, _, body = http_request("GET", "/echoing")
        # Depends on httpserver boundary matching: /echo prefix with next char not '/'
        # The matchRoute checks path[r.path.len] == '/' or path.len == r.path.len
        # /echoing has path.len > "/echo".len and path[5] = 'i' != '/' so should not match
        passed = status == 404
        record("4.4", "GET /echoing does not match /echo route (boundary)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("4.4", "GET /echoing does not match /echo route (boundary)", False, str(e))

    # 4.5: 403 for encoded path traversal
    try:
        status, _, body = http_request("GET", "/echo/..%2F..%2Fetc/passwd")
        # The httpserver checks for ".." in the raw path. %2F is not decoded, so
        # this contains ".." literally and should be caught.
        passed = status == 403
        record("4.5", "GET with .. in encoded path returns 403", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("4.5", "GET with .. in encoded path returns 403", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 5: Large Payloads
# ═════════════════════════════════════════════════════════════════════

def test_5_large():
    print("\n--- Category 5: Large Payloads ---")

    # 5.1: Large response body (~60KB)
    try:
        status, headers, body = http_request("GET", "/large", timeout=10)
        passed = status == 200 and len(body) == 61440
        record("5.1", "GET /large returns ~60KB body", passed,
               f"status={status}, body_len={len(body)}" if not passed else "")
    except Exception as e:
        record("5.1", "GET /large returns ~60KB body", False, str(e))

    # 5.2: Content-Length header matches body
    try:
        status, headers, body = http_request("GET", "/large", timeout=10)
        content_length = int(headers.get("Content-Length", headers.get("content-length", "0")))
        passed = content_length == len(body) == 61440
        record("5.2", "Content-Length header matches body size", passed,
               f"Content-Length={content_length}, body_len={len(body)}" if not passed else "")
    except Exception as e:
        record("5.2", "Content-Length header matches body size", False, str(e))

    # 5.3: Large request body (near MAX_REQ limit: 8192 total buffer)
    # Headers take ~100-200 bytes, so body of ~7000 should fit
    try:
        payload = "C" * 7000
        status, _, body = http_request("POST", "/echo", body=payload, timeout=10)
        expected = f"POST {payload}"
        passed = status == 200 and body == expected
        record("5.3", "POST with 7KB body (near MAX_REQ)", passed,
               f"status={status}, body_len={len(body)}" if not passed else "")
    except Exception as e:
        record("5.3", "POST with 7KB body (near MAX_REQ)", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 6: Concurrent Connections
# ═════════════════════════════════════════════════════════════════════

def test_6_concurrent():
    print("\n--- Category 6: Concurrent Connections ---")

    # 6.1: Multiple sequential connections
    try:
        passed = True
        detail = ""
        for i in range(10):
            status, _, body = http_request("GET", "/echo")
            if status != 200 or body != "GET":
                passed = False
                detail = f"failed at request {i}: status={status}, body={body!r}"
                break
        record("6.1", "10 sequential requests", passed, detail)
    except Exception as e:
        record("6.1", "10 sequential requests", False, str(e))

    # 6.2: Concurrent connections from threads
    try:
        results = [None] * 8
        errors = [None] * 8

        def make_request(idx):
            try:
                status, _, body = http_request("POST", "/echo", body=f"thread-{idx}")
                results[idx] = (status, body)
            except Exception as e:
                errors[idx] = str(e)

        threads = []
        for i in range(8):
            t = threading.Thread(target=make_request, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join(timeout=10)

        passed = True
        detail = ""
        for i in range(8):
            if errors[i]:
                passed = False
                detail = f"thread {i} error: {errors[i]}"
                break
            if results[i] is None:
                passed = False
                detail = f"thread {i} timed out"
                break
            status, body = results[i]
            expected = f"POST thread-{i}"
            if status != 200 or body != expected:
                passed = False
                detail = f"thread {i}: status={status}, body={body!r}, expected={expected!r}"
                break

        record("6.2", "8 concurrent connections from threads", passed, detail)
    except Exception as e:
        record("6.2", "8 concurrent connections from threads", False, str(e))

    # 6.3: Rapid sequential requests (connection churn)
    try:
        passed = True
        detail = ""
        for i in range(50):
            status, _, body = http_request("GET", "/echo")
            if status != 200 or body != "GET":
                passed = False
                detail = f"failed at request {i}: status={status}, body={body!r}"
                break
        record("6.3", "50 rapid sequential requests", passed, detail)
    except Exception as e:
        record("6.3", "50 rapid sequential requests", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 7: Security — Path Traversal
# ═════════════════════════════════════════════════════════════════════

def test_7_security():
    print("\n--- Category 7: Security ---")

    # 7.1: Basic path traversal
    try:
        status, _, _ = http_request("GET", "/echo/../../etc/passwd")
        passed = status == 403
        record("7.1", "Path traversal ../../etc/passwd rejected (403)", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("7.1", "Path traversal ../../etc/passwd rejected (403)", False, str(e))

    # 7.2: Double-dot in middle of path
    try:
        status, _, _ = http_request("GET", "/echo/foo/../bar")
        passed = status == 403
        record("7.2", "Path with foo/../bar rejected (403)", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("7.2", "Path with foo/../bar rejected (403)", False, str(e))

    # 7.3: Trailing double-dot
    try:
        status, _, _ = http_request("GET", "/echo/..")
        passed = status == 403
        record("7.3", "Path ending with /.. rejected (403)", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("7.3", "Path ending with /.. rejected (403)", False, str(e))

    # 7.4: Single dot is allowed (not a traversal)
    try:
        status, _, _ = http_request("GET", "/echo/.")
        # Single dot should pass through to the handler (or 404) but NOT 403
        passed = status != 403
        record("7.4", "Path with single dot /echo/. not rejected as traversal", passed,
               f"status={status}" if not passed else "")
    except Exception as e:
        record("7.4", "Path with single dot /echo/. not rejected as traversal", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 8: Slow Responses
# ═════════════════════════════════════════════════════════════════════

def test_8_slow():
    print("\n--- Category 8: Slow Responses ---")

    # 8.1: /slow endpoint returns after delay
    try:
        start = time.monotonic()
        status, _, body = http_request("GET", "/slow", timeout=10)
        elapsed = time.monotonic() - start
        passed = status == 200 and body == "slow response" and elapsed >= 0.4
        record("8.1", "GET /slow returns after ~500ms delay", passed,
               f"status={status}, elapsed={elapsed:.2f}s, body={body!r}" if not passed else "")
    except Exception as e:
        record("8.1", "GET /slow returns after ~500ms delay", False, str(e))

    # 8.2: Other endpoints still work after slow request
    try:
        status, _, body = http_request("GET", "/echo")
        passed = status == 200 and body == "GET"
        record("8.2", "Normal request works after slow request", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("8.2", "Normal request works after slow request", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Category 9: Edge Cases
# ═════════════════════════════════════════════════════════════════════

def test_9_edge():
    print("\n--- Category 9: Edge Cases ---")

    # 9.1: Request with query string
    try:
        status, _, body = http_request("GET", "/echo?foo=bar&baz=1")
        # httpserver passes full path including query string to handler
        passed = status == 200 and body == "GET"
        record("9.1", "GET /echo?query_string handled", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("9.1", "GET /echo?query_string handled", False, str(e))

    # 9.2: Request to exact route path (no trailing slash)
    try:
        status, _, body = http_request("GET", "/echo")
        passed = status == 200 and body == "GET"
        record("9.2", "GET /echo (exact match, no slash)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("9.2", "GET /echo (exact match, no slash)", False, str(e))

    # 9.3: Request with trailing slash
    try:
        status, _, body = http_request("GET", "/echo/")
        passed = status == 200 and body == "GET"
        record("9.3", "GET /echo/ (with trailing slash)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("9.3", "GET /echo/ (with trailing slash)", False, str(e))

    # 9.4: Request with sub-path
    try:
        status, _, body = http_request("GET", "/echo/sub/path")
        passed = status == 200 and body == "GET"
        record("9.4", "GET /echo/sub/path (sub-path)", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("9.4", "GET /echo/sub/path (sub-path)", False, str(e))

    # 9.5: Response Content-Type header
    try:
        status, headers, body = http_request("GET", "/echo")
        ct = headers.get("Content-Type", headers.get("content-type", ""))
        passed = status == 200 and "text/plain" in ct
        record("9.5", "Response has Content-Type: text/plain", passed,
               f"Content-Type={ct!r}" if not passed else "")
    except Exception as e:
        record("9.5", "Response has Content-Type: text/plain", False, str(e))

    # 9.6: Response Connection: close header
    try:
        status, headers, body = http_request("GET", "/echo")
        conn_hdr = headers.get("Connection", headers.get("connection", ""))
        passed = status == 200 and "close" in conn_hdr.lower()
        record("9.6", "Response has Connection: close", passed,
               f"Connection={conn_hdr!r}" if not passed else "")
    except Exception as e:
        record("9.6", "Response has Connection: close", False, str(e))

    # 9.7: POST to /headers returns method info
    try:
        status, _, body = http_request("GET", "/headers")
        passed = status == 200 and "method=GET" in body and "path=/headers" in body
        record("9.7", "GET /headers returns request metadata", passed,
               f"status={status}, body={body!r}" if not passed else "")
    except Exception as e:
        record("9.7", "GET /headers returns request metadata", False, str(e))


# ═════════════════════════════════════════════════════════════════════
# Main
# ═════════════════════════════════════════════════════════════════════

def main():
    print("HTTP Conformance Tests")
    print(f"Server: http://{SERVER_HOST}:{SERVER_PORT}")
    print()

    compile_server()
    start_server()

    try:
        test_1_methods()
        test_2_body()
        test_3_status()
        test_4_errors()
        test_5_large()
        test_6_concurrent()
        test_7_security()
        test_8_slow()
        test_9_edge()
    finally:
        stop_server()

    # Summary
    total = len(RESULTS)
    passed = sum(1 for v in RESULTS.values() if v["behavior"] == "OK")
    failed = total - passed

    print(f"\n{'=' * 60}")
    print(f"RESULTS: {passed}/{total} passed ({failed} failed)")
    print(f"{'=' * 60}")

    if failed > 0:
        print("\nFailed tests:")
        for case_id in sorted(RESULTS.keys(), key=lambda x: [int(p) if p.isdigit() else p for p in x.split(".")]):
            info = RESULTS[case_id]
            if info["behavior"] != "OK":
                print(f"  {case_id}: {info['description']} -- {info['detail']}")

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
