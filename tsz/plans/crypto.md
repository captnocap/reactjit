# Cryptography Stack for tsz

## The Big Win: Zero External Dependencies

The Lua stack needed **three C libraries** (libsodium, OpenSSL libcrypto, libblake3) because LuaJIT has no crypto primitives. Zig's `std.crypto` has everything built in. The entire crypto stack compiles from source with no system dependencies.

| Lua needs | Zig has built-in |
|-----------|-----------------|
| libsodium (SHA, BLAKE2b, ChaCha20, Ed25519, X25519, Argon2) | `std.crypto.hash`, `std.crypto.aead`, `std.crypto.sign`, `std.crypto.dh`, `std.crypto.pwhash` |
| OpenSSL libcrypto (BLAKE2s, PBKDF2) | `std.crypto.hash.blake2`, `std.crypto.pwhash` |
| libblake3 (vendored C source) | `std.crypto.hash.Blake3` |
| `randombytes_buf()` | `std.crypto.random` |

**No libsodium. No OpenSSL. No vendored C. Pure Zig.**

## Love2D Reference

| File | Lines | What |
|------|-------|------|
| `love2d/lua/crypto.lua` | 993 | All crypto via FFI to libsodium/OpenSSL/blake3 |
| `love2d/packages/crypto/src/hash.ts` | 71 | Hash API (SHA, BLAKE, HMAC) |
| `love2d/packages/crypto/src/encrypt.ts` | 95 | AEAD encryption (password + raw) |
| `love2d/packages/crypto/src/sign.ts` | 72 | Ed25519 signing + X25519 DH |
| `love2d/packages/crypto/src/token.ts` | 34 | Random token generation |
| `love2d/packages/crypto/src/encoding.ts` | 70 | Hex/Base64 encoding |

## Implementation

### New file: `tsz/runtime/crypto.zig`

One file. All crypto. No external deps. Maps directly to `std.crypto`.

### Hashing

Reference: `love2d/lua/crypto.lua:376-429`

```zig
const std = @import("std");

pub fn sha256(input: []const u8) [32]u8 {
    return std.crypto.hash.sha2.Sha256.hash(input, .{});
}

pub fn sha512(input: []const u8) [64]u8 {
    return std.crypto.hash.sha2.Sha512.hash(input, .{});
}

pub fn blake2b(input: []const u8, comptime out_len: usize) [out_len]u8 {
    return std.crypto.hash.blake2.Blake2b(out_len * 8).hash(input, .{});
}

pub fn blake2s(input: []const u8) [32]u8 {
    return std.crypto.hash.blake2.Blake2s256.hash(input, .{});
}

pub fn blake3(input: []const u8) [32]u8 {
    return std.crypto.hash.Blake3.hash(input, .{});
}
```

### HMAC

Reference: `love2d/lua/crypto.lua:435-463`

```zig
pub fn hmacSha256(key: []const u8, message: []const u8) [32]u8 {
    var mac: [32]u8 = undefined;
    std.crypto.auth.hmac.sha2.HmacSha256.create(&mac, message, key);
    return mac;
}

pub fn hmacSha512(key: []const u8, message: []const u8) [64]u8 {
    var mac: [64]u8 = undefined;
    std.crypto.auth.hmac.sha2.HmacSha512.create(&mac, message, key);
    return mac;
}
```

### AEAD Encryption

Reference: `love2d/lua/crypto.lua:469-532`

```zig
const XChaCha20 = std.crypto.aead.xchacha20poly1305.XChaCha20Poly1305;
const ChaCha20 = std.crypto.aead.chacha20poly1305.ChaCha20Poly1305;

pub fn encryptXChaCha20(plaintext: []const u8, key: [32]u8) struct { ciphertext: []u8, nonce: [24]u8 } {
    var nonce: [24]u8 = undefined;
    std.crypto.random.bytes(&nonce);
    // encrypt...
}

pub fn decryptXChaCha20(ciphertext: []const u8, key: [32]u8, nonce: [24]u8) ![]u8 {
    // decrypt...
}
```

Supported algorithms (same as Lua):
- XChaCha20-Poly1305 (default, 24-byte nonce)
- ChaCha20-Poly1305 (12-byte nonce)
- AES-256-GCM (hardware accelerated via `std.crypto.aead.aes_gcm`)

### Key Derivation (KDF)

Reference: `love2d/lua/crypto.lua:538-568`

```zig
// Argon2id (default)
pub fn deriveKeyArgon2(password: []const u8, salt: [16]u8) [32]u8 {
    return std.crypto.pwhash.argon2.strHash(password, .{
        .salt = salt,
        // params...
    });
}

// scrypt
pub fn deriveKeyScrypt(password: []const u8, salt: []const u8) [32]u8 {
    return std.crypto.pwhash.scrypt.kdf(password, salt, .{});
}
```

### Ed25519 Signing

Reference: `love2d/lua/crypto.lua:700-746`

```zig
const Ed25519 = std.crypto.sign.Ed25519;

pub fn generateSigningKeys() struct { public: [32]u8, secret: [64]u8 } {
    const kp = Ed25519.KeyPair.create(null);
    return .{ .public = kp.public_key, .secret = kp.secret_key };
}

pub fn sign(secret_key: [64]u8, message: []const u8) [64]u8 {
    return Ed25519.sign(message, secret_key, null);
}

pub fn verify(public_key: [32]u8, message: []const u8, signature: [64]u8) bool {
    Ed25519.verify(signature, message, public_key) catch return false;
    return true;
}
```

### X25519 Diffie-Hellman

Reference: `love2d/lua/crypto.lua:752-781`

```zig
const X25519 = std.crypto.dh.X25519;

pub fn generateDHKeys() struct { public: [32]u8, secret: [32]u8 } {
    const kp = X25519.KeyPair.create(null);
    return .{ .public = kp.public_key, .secret = kp.secret_key };
}

pub fn diffieHellman(secret_key: [32]u8, public_key: [32]u8) [32]u8 {
    return X25519.scalarmult(secret_key, public_key);
}
```

### Random Bytes

Reference: `love2d/lua/crypto.lua:787-816`

```zig
pub fn randomBytes(buf: []u8) void {
    std.crypto.random.bytes(buf);
}
```

### Hex/Base64 Encoding

Reference: `love2d/packages/crypto/src/encoding.ts:1-70`

```zig
pub fn toHex(bytes: []const u8, out: []u8) []const u8 {
    return std.fmt.bytesToHex(bytes, out);
}

pub fn fromHex(hex: []const u8, out: []u8) ![]u8 {
    return std.fmt.hexToBytes(out, hex);
}

// Base64: std.base64.standard.Encoder / Decoder
```

### Constant-Time Comparison

Reference: `love2d/lua/crypto.lua:822-825`

```zig
pub fn timingSafeEqual(a: []const u8, b: []const u8) bool {
    return std.crypto.utils.timingSafeEql(a, b);
}
```

### Memory Zeroing

Reference: `love2d/lua/crypto.lua` — uses `sodium_memzero()` after key derivation

```zig
// Zig equivalent:
std.crypto.utils.secureZero(u8, key_buffer);
```

## Compiler Integration

Expose crypto functions as built-in calls in .tsz:

```tsx
// @ffi is NOT needed — crypto is built into the runtime

function App() {
  const [hash, setHash] = useState("");

  return (
    <Box>
      <Pressable onPress={() => setHash(sha256("hello"))}>
        <Text>{`Hash: ${hash}`}</Text>
      </Pressable>
    </Box>
  );
}
```

The compiler recognizes `sha256()`, `randomToken()`, `encrypt()`, etc. as built-in functions that map to `crypto.zig` calls. Same pattern as `getText()` for TextInput.

### Built-in function list

| .tsz function | Maps to | Returns |
|---------------|---------|---------|
| `sha256(input)` | `crypto.sha256()` | hex string |
| `sha512(input)` | `crypto.sha512()` | hex string |
| `blake2b(input)` | `crypto.blake2b()` | hex string |
| `blake3(input)` | `crypto.blake3()` | hex string |
| `hmacSha256(key, msg)` | `crypto.hmacSha256()` | hex string |
| `encrypt(text, password)` | `crypto.encrypt()` | encrypted envelope |
| `decrypt(data, password)` | `crypto.decrypt()` | plaintext |
| `randomToken(n)` | `crypto.randomBytes()` | hex string |
| `randomId(n)` | alphanumeric generation | string |
| `sign(key, msg)` | `crypto.sign()` | signature hex |
| `verify(key, msg, sig)` | `crypto.verify()` | boolean |

## Files

| File | Change |
|------|--------|
| `tsz/runtime/crypto.zig` | **New** — all crypto primitives using `std.crypto` |
| `tsz/compiler/codegen.zig` | Recognize crypto built-in functions in handlers/expressions |

## What This Does NOT Cover

- **Ethereum/BIP-39/secp256k1** — the wallet example uses `@noble` JS libraries for BIP-32/39 and secp256k1. Zig's stdlib has Ed25519 and X25519 but NOT secp256k1. If Ethereum support is needed, link `libsecp256k1` via `@cImport`. Defer this.
- **Webhook HMAC** — trivially covered by `hmacSha256()` above.
- **Password-based encryption envelope** — the JSON envelope format from Lua (algorithm, ciphertext, nonce, salt, kdf, kdfParams) is a serialization concern. Can be a .tsz-level helper, not runtime Zig.

## Implementation Order

1. **Hash functions** (SHA-256/512, BLAKE2b/2s, BLAKE3, HMAC) — pure functions, immediately testable
2. **Random bytes + hex encoding** — needed by encryption
3. **AEAD encryption** (XChaCha20, ChaCha20, AES-GCM) — needs random nonces
4. **KDF** (Argon2id, scrypt) — password-based key derivation
5. **Ed25519 + X25519** — signing and key exchange
6. **Compiler integration** — wire as built-in functions

Can be done by **1 agent** — it's a single file wrapping `std.crypto` calls. Most functions are 3-5 lines each.

## Verification

```bash
zig test tsz/runtime/crypto.zig
# Tests: hash known vectors, encrypt/decrypt round-trip, sign/verify round-trip
```

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/crypto-test.tsz
# App with buttons that hash, encrypt, sign
```

## Why This Is Easy

The Lua crypto module is 993 lines because it needs:
- FFI declarations for 3 separate C libraries (~200 lines)
- Library loading with platform-specific paths (~90 lines)
- Buffer management and hex encoding (~100 lines)
- RPC handler registration (~160 lines)

The Zig version needs none of that. `std.crypto` functions are direct calls. No FFI, no library loading, no buffer juggling, no RPC. The entire module will be ~200 lines.
