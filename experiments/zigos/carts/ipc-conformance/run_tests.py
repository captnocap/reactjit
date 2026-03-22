#!/usr/bin/env python3
"""
IPC (NDJSON over TCP) conformance tests.

Tests the IPC server (ipc.zig) protocol using a SINGLE persistent connection
(IPC server is designed for one client).

Categories:
  1.x  Connection setup
  2.x  NDJSON framing (single, sequential, batched, partial)
  3.x  Message types (init, mutations, event, resize, ready, windowEvent)
  4.x  Edge cases (large, rapid-fire, unicode, minimal)
  5.x  Quit command
"""

import json
import os
import socket
import subprocess
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ZIG_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
RESULTS = {}


def compile_server():
    print("Compiling IPC test server...")
    result = subprocess.run(
        ["zig", "build-exe", "--dep", "ipc",
         "-Mroot=carts/ipc-conformance/test_server.zig",
         "-Mipc=framework/net/ipc.zig",
         "-femit-bin=carts/ipc-conformance/test_server"],
        cwd=ZIG_DIR, capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"Compilation failed:\n{result.stderr}")
        sys.exit(1)
    print("Compilation successful.")


def start_server():
    proc = subprocess.Popen(
        [os.path.join(SCRIPT_DIR, "test_server")],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=ZIG_DIR
    )
    port_line = proc.stdout.readline().decode().strip()
    if not port_line.isdigit():
        proc.kill()
        raise RuntimeError(f"Expected port, got: {port_line!r}")
    return proc, int(port_line)


def send_ndjson(sock, obj):
    line = json.dumps(obj, separators=(",", ":")) + "\n"
    sock.sendall(line.encode())


def recv_lines(sock, count=1, timeout=5):
    sock.settimeout(timeout)
    buf = b""
    lines = []
    while len(lines) < count:
        try:
            chunk = sock.recv(65536)
        except socket.timeout:
            break
        if not chunk:
            break
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            if line:
                lines.append(line.decode())
    return lines


def record(case_id, desc, passed, detail=""):
    RESULTS[case_id] = {"behavior": "OK" if passed else "FAILED", "description": desc, "detail": detail}
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {case_id}: {desc}" + (f" ({detail})" if detail and not passed else ""))


def run_tests(sock, port):
    # ── Category 1: Connection ──
    print("\n--- Category 1: Connection ---")
    record("1.1", "TCP connect to IPC server", True)
    record("1.2", "OS-assigned port > 0", port > 0, f"port={port}")

    # ── Category 2: NDJSON Framing ──
    print("\n--- Category 2: NDJSON Framing ---")

    # 2.1: Single JSON message
    try:
        msg = {"type": "event", "payload": {"key": "value"}}
        send_ndjson(sock, msg)
        lines = recv_lines(sock, 1)
        parsed = json.loads(lines[0])
        record("2.1", "Single JSON message echo", parsed == msg)
    except Exception as e:
        record("2.1", "Single JSON message echo", False, str(e))

    # 2.2: Multiple messages in sequence
    try:
        msgs = [{"type": "event", "id": i} for i in range(5)]
        for m in msgs:
            send_ndjson(sock, m)
        lines = recv_lines(sock, 5)
        passed = len(lines) == 5
        if passed:
            for i, line in enumerate(lines):
                if json.loads(line) != msgs[i]:
                    passed = False
                    break
        record("2.2", "5 sequential messages", passed, f"got {len(lines)}")
    except Exception as e:
        record("2.2", "5 sequential messages", False, str(e))

    # 2.3: Multiple messages in single TCP write
    try:
        batch = ""
        msgs = [{"type": "batch", "n": i} for i in range(3)]
        for m in msgs:
            batch += json.dumps(m, separators=(",", ":")) + "\n"
        sock.sendall(batch.encode())
        lines = recv_lines(sock, 3)
        passed = len(lines) == 3
        if passed:
            for i, line in enumerate(lines):
                if json.loads(line) != msgs[i]:
                    passed = False
                    break
        record("2.3", "3 messages in single TCP write", passed, f"got {len(lines)}")
    except Exception as e:
        record("2.3", "3 messages in single TCP write", False, str(e))

    # 2.4: Partial message across TCP segments
    try:
        full = '{"type":"split","data":"hello"}\n'
        half = len(full) // 2
        sock.sendall(full[:half].encode())
        time.sleep(0.05)
        sock.sendall(full[half:].encode())
        lines = recv_lines(sock, 1)
        parsed = json.loads(lines[0]) if lines else None
        record("2.4", "Partial message across TCP segments",
               parsed == {"type": "split", "data": "hello"})
    except Exception as e:
        record("2.4", "Partial message across TCP segments", False, str(e))

    # ── Category 3: Message Types ──
    print("\n--- Category 3: Message Types ---")
    types = [
        ("3.1", "init", {"type": "init", "commands": [{"op": "create", "id": 1}]}),
        ("3.2", "mutations", {"type": "mutations", "commands": [{"op": "setText", "id": 1, "text": "hi"}]}),
        ("3.3", "resize", {"type": "resize", "width": 800, "height": 600}),
        ("3.4", "event", {"type": "event", "payload": {"kind": "click", "x": 10, "y": 20}}),
        ("3.5", "ready", {"type": "ready"}),
        ("3.6", "windowEvent", {"type": "windowEvent", "handler": "onClose"}),
    ]
    for cid, label, msg in types:
        try:
            send_ndjson(sock, msg)
            lines = recv_lines(sock, 1)
            parsed = json.loads(lines[0])
            record(cid, f"{label} message round-trip", parsed == msg)
        except Exception as e:
            record(cid, f"{label} message round-trip", False, str(e))

    # ── Category 4: Edge Cases ──
    print("\n--- Category 4: Edge Cases ---")

    # 4.1: Large message (~8KB)
    try:
        msg = {"type": "large", "data": "x" * 8000}
        send_ndjson(sock, msg)
        lines = recv_lines(sock, 1, timeout=10)
        parsed = json.loads(lines[0])
        record("4.1", "Large message (~8KB)", parsed == msg,
               f"len={len(lines[0])}" if lines else "none")
    except Exception as e:
        record("4.1", "Large message (~8KB)", False, str(e))

    # 4.2: Rapid-fire
    try:
        count = 30
        for i in range(count):
            send_ndjson(sock, {"type": "rapid", "i": i})
        lines = recv_lines(sock, count, timeout=10)
        passed = len(lines) == count
        if passed:
            for i, line in enumerate(lines):
                if json.loads(line).get("i") != i:
                    passed = False
                    break
        record("4.2", f"{count} rapid-fire messages", passed, f"got {len(lines)}")
    except Exception as e:
        record("4.2", f"30 rapid-fire messages", False, str(e))

    # 4.3: Unicode
    try:
        msg = {"type": "unicode", "text": "Hello 世界 🌍"}
        send_ndjson(sock, msg)
        lines = recv_lines(sock, 1)
        record("4.3", "Unicode in JSON", json.loads(lines[0]) == msg)
    except Exception as e:
        record("4.3", "Unicode in JSON", False, str(e))

    # 4.4: Minimal JSON
    try:
        sock.sendall(b"{}\n")
        lines = recv_lines(sock, 1)
        record("4.4", "Minimal JSON (empty object)", lines[0] == "{}")
    except Exception as e:
        record("4.4", "Minimal JSON (empty object)", False, str(e))

    # ── Category 5: Quit ──
    print("\n--- Category 5: Quit Command ---")
    try:
        send_ndjson(sock, {"type": "quit"})
        lines = recv_lines(sock, 1, timeout=3)
        record("5.1", "Quit echoed and server stops",
               len(lines) >= 1 and "quit" in lines[0])
    except Exception as e:
        record("5.1", "Quit echoed and server stops", False, str(e))


def main():
    print("IPC (NDJSON/TCP) Conformance Tests\n")
    compile_server()
    proc, port = start_server()
    print(f"IPC server on port {port}")
    time.sleep(0.3)

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect(("127.0.0.1", port))
        time.sleep(0.2)  # Let server accept
        run_tests(sock, port)
        sock.close()
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        try:
            os.remove(os.path.join(SCRIPT_DIR, "test_server"))
        except Exception:
            pass

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
    results_dir = os.path.join(SCRIPT_DIR, "reports")
    os.makedirs(results_dir, exist_ok=True)
    with open(os.path.join(results_dir, "results.json"), "w") as f:
        json.dump({"total": total, "passed": passed, "failed": failed, "cases": RESULTS}, f, indent=2)
    print(f"\nResults saved to {results_dir}/results.json")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
