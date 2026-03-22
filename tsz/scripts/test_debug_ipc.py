#!/usr/bin/env python3
"""End-to-end proof: debug_server full encrypted IPC.

Launches zigos-app with TSZ_DEBUG=1 + TSZ_DEBUG_AUTOACCEPT=1,
performs X25519 key exchange, derives shared key via HKDF,
sends encrypted debug.tree + debug.perf + debug.state requests,
decrypts and prints responses.

Usage: python3 scripts/test_debug_ipc.py
"""

import subprocess, socket, time, json, os, sys, hmac, hashlib

from cryptography.hazmat.primitives.asymmetric.x25519 import (
    X25519PrivateKey, X25519PublicKey,
)
from cryptography.hazmat.primitives import serialization
from nacl.bindings import (
    crypto_aead_xchacha20poly1305_ietf_encrypt,
    crypto_aead_xchacha20poly1305_ietf_decrypt,
)

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "zig-out", "bin", "zigos-app")
NONCE_LEN = 24
TAG_LEN = 16


def hmac_sha256(key: bytes, msg: bytes) -> bytes:
    return hmac.new(key, msg, hashlib.sha256).digest()


def hkdf_expand(prk: bytes, info: bytes, length: int = 32) -> bytes:
    t, okm = b"", b""
    for i in range(1, (length + 31) // 32 + 1):
        t = hmac_sha256(prk, t + info + bytes([i]))
        okm += t
    return okm[:length]


def make_nonce(prefix: int, counter: int) -> bytes:
    n = bytearray(NONCE_LEN)
    n[0] = prefix
    n[16:24] = counter.to_bytes(8, "little")
    return bytes(n)


def encrypt_msg(pt: bytes, key: bytes, counter: int) -> bytes:
    nonce = make_nonce(0x43, counter)  # 'C' prefix for client
    ct_tag = crypto_aead_xchacha20poly1305_ietf_encrypt(pt, b"", nonce, key)
    ct = ct_tag[:-TAG_LEN]
    tag = ct_tag[-TAG_LEN:]
    return (nonce + ct + tag).hex().encode() + b"\n"


def decrypt_msg(hex_line: bytes, key: bytes) -> bytes:
    raw = bytes.fromhex(hex_line.strip().decode())
    nonce = raw[:NONCE_LEN]
    ct = raw[NONCE_LEN:-TAG_LEN]
    tag = raw[-TAG_LEN:]
    return crypto_aead_xchacha20poly1305_ietf_decrypt(ct + tag, b"", nonce, key)


class LineReader:
    """Buffered line reader for a TCP socket."""
    def __init__(self, sock, timeout=3):
        self.sock = sock
        self.sock.settimeout(timeout)
        self.buf = b""

    def readline(self):
        while b"\n" not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                break
            self.buf += chunk
        if b"\n" in self.buf:
            line, self.buf = self.buf.split(b"\n", 1)
            return line
        result = self.buf
        self.buf = b""
        return result


def main():
    print("=" * 60)
    print("  DEBUG SERVER END-TO-END PROOF")
    print("=" * 60)

    # 1. Launch app
    print("\n[1] Launching app with TSZ_DEBUG=1 TSZ_DEBUG_AUTOACCEPT=1")
    env = os.environ.copy()
    env["TSZ_DEBUG"] = "1"
    env["TSZ_DEBUG_AUTOACCEPT"] = "1"
    proc = subprocess.Popen(
        [APP], env=env, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL
    )

    # 2. Read port
    port = None
    deadline = time.time() + 5
    while time.time() < deadline:
        line = proc.stderr.readline().decode(errors="replace")
        if "port" in line:
            for w in line.split():
                if w.isdigit():
                    port = int(w)
            if port:
                break
    if not port:
        print("FAIL: no port")
        proc.kill()
        sys.exit(1)
    print(f"    Port: {port}")
    time.sleep(0.5)

    # 3. TCP connect
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect(("127.0.0.1", port))
    reader = LineReader(sock)
    print("[2] TCP connected ✓")

    # 4. X25519 key exchange
    client_key = X25519PrivateKey.generate()
    client_pub = client_key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    sock.sendall((json.dumps({"pubkey": client_pub.hex()}) + "\n").encode())
    print(f"[3] Sent X25519 pubkey ✓")

    # 5. Read challenge (should be auto_accepted)
    time.sleep(0.5)
    resp = reader.readline()
    challenge = json.loads(resp)
    print(f"[4] Challenge: {challenge}")
    assert challenge.get("challenge") in ("auto_accepted", "trusted"), \
        f"Expected auto_accepted/trusted, got {challenge}"
    print("    Pairing auto-accepted ✓")

    # 6. Read app pubkey from session file + derive shared key
    session_file = os.path.expanduser(f"~/.tsz/sessions/{proc.pid}.json")
    with open(session_file) as f:
        session = json.load(f)
    app_pub_bytes = bytes.fromhex(session["pubkey"])
    print(f"[5] App pubkey from session file: {session['pubkey'][:16]}...")

    app_pub = X25519PublicKey.from_public_bytes(app_pub_bytes)
    dh_shared = client_key.exchange(app_pub)
    prk = hmac_sha256(b"tsz-debug-v1", dh_shared)
    shared_key = hkdf_expand(prk, b"debug-channel", 32)
    print(f"    Shared key derived via DH+HKDF ✓")

    # 7. Read encrypted handshake OK
    time.sleep(0.3)
    enc_hs = reader.readline()
    hs_pt = decrypt_msg(enc_hs, shared_key)
    hs = json.loads(hs_pt)
    print(f"[6] Handshake OK (decrypted): {hs}")
    assert hs.get("ok") is True, f"Handshake failed: {hs}"
    print("    XChaCha20-Poly1305 decryption ✓")

    # 8. Send encrypted debug.tree
    counter = 0
    req = json.dumps({"method": "debug.tree"}).encode()
    sock.sendall(encrypt_msg(req, shared_key, counter))
    counter += 1
    print("[7] Sent encrypted debug.tree request")

    time.sleep(0.5)
    enc_tree = reader.readline()
    tree_pt = decrypt_msg(enc_tree, shared_key)
    tree = json.loads(tree_pt)
    nodes = tree.get("nodes", [])
    print(f"    Response: {len(nodes)} nodes")
    if nodes:
        print(f"    First node: {nodes[0]}")
    print("    debug.tree ✓")

    # 9. Send encrypted debug.perf
    req = json.dumps({"method": "debug.perf"}).encode()
    sock.sendall(encrypt_msg(req, shared_key, counter))
    counter += 1
    time.sleep(0.3)
    enc_perf = reader.readline()
    perf_pt = decrypt_msg(enc_perf, shared_key)
    perf = json.loads(perf_pt)
    print(f"[8] debug.perf: fps={perf.get('fps')}, frame={perf.get('frame')}, "
          f"rects={perf.get('rects')}, glyphs={perf.get('glyphs')}")
    print("    debug.perf ✓")

    # 10. Send encrypted debug.state
    req = json.dumps({"method": "debug.state"}).encode()
    sock.sendall(encrypt_msg(req, shared_key, counter))
    counter += 1
    time.sleep(0.3)
    enc_state = reader.readline()
    state_pt = decrypt_msg(enc_state, shared_key)
    state = json.loads(state_pt)
    print(f"[9] debug.state: total_nodes={state.get('total_nodes')}, "
          f"visible={state.get('visible_nodes')}, slots={state.get('state_slots')}")
    print("    debug.state ✓")

    # 11. Send encrypted debug.select
    req = json.dumps({"method": "debug.select", "id": 0}).encode()
    sock.sendall(encrypt_msg(req, shared_key, counter))
    counter += 1
    time.sleep(0.3)
    enc_sel = reader.readline()
    sel_pt = decrypt_msg(enc_sel, shared_key)
    sel = json.loads(sel_pt)
    print(f"[10] debug.select: {sel}")
    assert sel.get("ok") is True
    print("     debug.select ✓")

    print("\n" + "=" * 60)
    print("  ALL CHECKS PASSED")
    print("=" * 60)
    print("""
  ✓ TCP connection to debug server
  ✓ X25519 key exchange (client → server)
  ✓ Auto-accept pairing (TSZ_DEBUG_AUTOACCEPT)
  ✓ DH shared secret derivation via HKDF-SHA256
  ✓ XChaCha20-Poly1305 encrypted handshake
  ✓ Encrypted debug.tree → got node tree back
  ✓ Encrypted debug.perf → got telemetry snapshot
  ✓ Encrypted debug.state → got state summary
  ✓ Encrypted debug.select → node selected
  ✓ Full round-trip: plaintext → encrypt → TCP → decrypt → JSON
""")

    sock.close()
    proc.kill()
    proc.wait()
    try:
        os.unlink(session_file)
    except:
        pass


if __name__ == "__main__":
    main()
