#!/usr/bin/env python3
"""
cartridge-pack.py — Pack a .cart file for CartridgeOS.

Creates a signed .cart binary:
  HEADER (160 bytes) | MANIFEST | PAYLOAD (cpio) | SIGNATURE (64 bytes)

The signature covers the 160 raw header bytes (which contain SHA-512
hashes of manifest and payload). Verification is constant-time
regardless of cart size.

Usage:
  python3 cartridge-pack.py \\
      --manifest manifest.json \\
      --payload app/ \\
      --key dev-key.secret \\
      --out app.cart

  Options:
    --manifest   Path to manifest JSON (will be canonicalized)
    --payload    Directory to archive as cpio payload
    --key        Path to 64-byte Ed25519 secret key (from keygen.py)
    --out        Output .cart path
    --unsigned   Skip signing (for testing; init.c will reject unless cart_dev=1)
"""

import argparse
import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile

try:
    from nacl.signing import SigningKey
    HAS_NACL = True
except ImportError:
    HAS_NACL = False

# Must match cart.h
CART_MAGIC = b"CART"
CART_VERSION = 1
CART_HEADER_SIZE = 160
CART_SIG_SIZE = 64
CART_HASH_SIZE = 64
CART_KEY_ID_SIZE = 8


def canonicalize_json(obj):
    """Canonical JSON: sorted keys, no whitespace, UTF-8, no floats."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False).encode("utf-8")


def sha512_hash(data):
    """SHA-512 hash of bytes."""
    return hashlib.sha512(data).digest()


def compute_key_id(pubkey_bytes):
    """First 8 bytes of SHA-512(pubkey), matching init.c."""
    return hashlib.sha512(pubkey_bytes).digest()[:CART_KEY_ID_SIZE]


def create_cpio(payload_dir):
    """Create a newc-format cpio archive of a directory."""
    # List all files relative to payload_dir
    file_list = []
    for root, dirs, files in os.walk(payload_dir):
        for f in sorted(files):
            path = os.path.join(root, f)
            rel = os.path.relpath(path, payload_dir)
            # Security: reject path traversal
            if ".." in rel.split(os.sep):
                print(f"ERROR: path traversal in payload: {rel}", file=sys.stderr)
                sys.exit(1)
            file_list.append(rel)

    if not file_list:
        print("ERROR: payload directory is empty", file=sys.stderr)
        sys.exit(1)

    # Use cpio to create the archive
    with tempfile.NamedTemporaryFile(suffix=".cpio", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            ["cpio", "-H", "newc", "-o", "--quiet"],
            input="\n".join(file_list).encode() + b"\n",
            capture_output=True,
            cwd=payload_dir,
        )
        if proc.returncode != 0:
            print(f"ERROR: cpio failed: {proc.stderr.decode()}", file=sys.stderr)
            sys.exit(1)

        return proc.stdout
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def build_header(manifest_bytes, payload_bytes, key_id):
    """Build the 160-byte .cart header."""
    manifest_hash = sha512_hash(manifest_bytes)
    payload_hash = sha512_hash(payload_bytes)

    # struct cart_header (packed):
    #   magic[4] + version(1) + flags(1) + reserved(2) +
    #   manifest_len(u32 LE) + payload_len(u64 LE) +
    #   manifest_hash(64) + payload_hash(64) +
    #   key_id(8) + padding(4)
    header = struct.pack(
        "<4sBBHIQ",
        CART_MAGIC,
        CART_VERSION,
        0,  # flags
        0,  # reserved
        len(manifest_bytes),
        len(payload_bytes),
    )
    header += manifest_hash
    header += payload_hash
    header += key_id
    header += b"\x00" * 4  # padding

    assert len(header) == CART_HEADER_SIZE, f"header is {len(header)}, expected {CART_HEADER_SIZE}"
    return header


def sign_header(header_bytes, secret_key_bytes):
    """Ed25519 sign the header bytes. Returns 64-byte signature."""
    if not HAS_NACL:
        print("ERROR: PyNaCl not installed. Run: pip install pynacl", file=sys.stderr)
        sys.exit(1)

    # PyNaCl expects 32-byte seed or 64-byte seed+pubkey
    sk = SigningKey(secret_key_bytes[:32])
    signed = sk.sign(header_bytes)
    # signed.signature is the 64-byte detached signature
    return signed.signature


def main():
    parser = argparse.ArgumentParser(description="Pack a .cart file for CartridgeOS")
    parser.add_argument("--manifest", required=True, help="Path to manifest.json")
    parser.add_argument("--payload", required=True, help="Directory to archive")
    parser.add_argument("--key", help="Path to 64-byte Ed25519 secret key")
    parser.add_argument("--out", required=True, help="Output .cart path")
    parser.add_argument("--unsigned", action="store_true", help="Skip signing")
    args = parser.parse_args()

    # Read and canonicalize manifest
    with open(args.manifest, "r") as f:
        manifest_obj = json.load(f)
    manifest_bytes = canonicalize_json(manifest_obj)

    print(f"  Manifest: {len(manifest_bytes)} bytes (canonical JSON)")

    # Create cpio payload
    payload_bytes = create_cpio(args.payload)
    print(f"  Payload:  {len(payload_bytes)} bytes (cpio)")

    # Load key
    if args.unsigned:
        key_id = b"\x00" * CART_KEY_ID_SIZE
        print("  Signing:  UNSIGNED (no key)")
    else:
        if not args.key:
            print("ERROR: --key required (or use --unsigned)", file=sys.stderr)
            sys.exit(1)
        with open(args.key, "rb") as f:
            secret_key = f.read()
        if len(secret_key) != 64:
            print(f"ERROR: secret key must be 64 bytes, got {len(secret_key)}", file=sys.stderr)
            sys.exit(1)
        pubkey = secret_key[32:]
        key_id = compute_key_id(pubkey)
        print(f"  Key ID:   {key_id.hex()}")

    # Build header
    header = build_header(manifest_bytes, payload_bytes, key_id)

    # Sign
    if args.unsigned:
        signature = b"\x00" * CART_SIG_SIZE
    else:
        signature = sign_header(header, secret_key)
        print(f"  Signature: {signature[:8].hex()}...")

    # Write .cart
    with open(args.out, "wb") as f:
        f.write(header)
        f.write(manifest_bytes)
        f.write(payload_bytes)
        f.write(signature)

    total = len(header) + len(manifest_bytes) + len(payload_bytes) + len(signature)
    print(f"\n  Cart written: {args.out} ({total} bytes)")
    print(f"    Header:    {CART_HEADER_SIZE} bytes")
    print(f"    Manifest:  {len(manifest_bytes)} bytes")
    print(f"    Payload:   {len(payload_bytes)} bytes")
    print(f"    Signature: {CART_SIG_SIZE} bytes")

    # Print hashes for verification
    mhash = sha512_hash(manifest_bytes).hex()[:16]
    phash = sha512_hash(payload_bytes).hex()[:16]
    print(f"    Manifest hash: {mhash}...")
    print(f"    Payload hash:  {phash}...")


if __name__ == "__main__":
    main()
