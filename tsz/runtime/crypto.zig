//! ReactJIT Crypto — Pure Zig cryptography via std.crypto
//!
//! Zero external dependencies. No libsodium, no OpenSSL, no vendored C.
//! Maps directly to Zig's battle-tested std.crypto primitives.
//!
//! All functions that return hex strings write into caller-provided buffers
//! to avoid heap allocation. The generated app code uses fixed stack buffers.

const std = @import("std");
const crypto = std.crypto;
const fmt = std.fmt;

// ============================================================================
// Hash functions
// ============================================================================

/// SHA-256: 32-byte digest → 64-char hex
pub fn sha256(input: []const u8, hex_out: *[64]u8) void {
    var digest: [32]u8 = undefined;
    crypto.hash.sha2.Sha256.hash(input, &digest, .{});
    hex_out.* = fmt.bytesToHex(digest, .lower);
}

/// SHA-512: 64-byte digest → 128-char hex
pub fn sha512(input: []const u8, hex_out: *[128]u8) void {
    var digest: [64]u8 = undefined;
    crypto.hash.sha2.Sha512.hash(input, &digest, .{});
    hex_out.* = fmt.bytesToHex(digest, .lower);
}

/// BLAKE2b-256: 32-byte digest → 64-char hex (default output size)
pub fn blake2b256(input: []const u8, hex_out: *[64]u8) void {
    var digest: [32]u8 = undefined;
    crypto.hash.blake2.Blake2b256.hash(input, &digest, .{});
    hex_out.* = fmt.bytesToHex(digest, .lower);
}

/// BLAKE2s-256: 32-byte digest → 64-char hex
pub fn blake2s256(input: []const u8, hex_out: *[64]u8) void {
    var digest: [32]u8 = undefined;
    crypto.hash.blake2.Blake2s256.hash(input, &digest, .{});
    hex_out.* = fmt.bytesToHex(digest, .lower);
}

/// BLAKE3: 32-byte digest → 64-char hex
pub fn blake3(input: []const u8, hex_out: *[64]u8) void {
    var digest: [32]u8 = undefined;
    crypto.hash.Blake3.hash(input, &digest, .{});
    hex_out.* = fmt.bytesToHex(digest, .lower);
}

// ============================================================================
// HMAC
// ============================================================================

/// HMAC-SHA256: 32-byte MAC → 64-char hex
pub fn hmacSha256(key: []const u8, message: []const u8, hex_out: *[64]u8) void {
    var mac: [32]u8 = undefined;
    crypto.auth.hmac.sha2.HmacSha256.create(&mac, message, key);
    hex_out.* = fmt.bytesToHex(mac, .lower);
}

/// HMAC-SHA512: 64-byte MAC → 128-char hex
pub fn hmacSha512(key: []const u8, message: []const u8, hex_out: *[128]u8) void {
    var mac: [64]u8 = undefined;
    crypto.auth.hmac.sha2.HmacSha512.create(&mac, message, key);
    hex_out.* = fmt.bytesToHex(mac, .lower);
}

// ============================================================================
// AEAD Encryption (XChaCha20-Poly1305)
// ============================================================================

const XChaCha20Poly1305 = crypto.aead.chacha_poly.XChaCha20Poly1305;
const ChaCha20Poly1305 = crypto.aead.chacha_poly.ChaCha20Poly1305;
const Aes256Gcm = crypto.aead.aes_gcm.Aes256Gcm;

/// Maximum plaintext size for stack-allocated encryption (4KB).
/// Larger payloads need a heap-allocated variant (not yet needed).
pub const MAX_PLAINTEXT = 4096;

/// Encrypted envelope: ciphertext + tag + nonce, all in one buffer.
/// Layout: [ciphertext (len bytes)][tag (16 bytes)][nonce (24 bytes)]
pub const EncryptedEnvelope = struct {
    /// Combined buffer: ciphertext || tag || nonce
    buf: [MAX_PLAINTEXT + 16 + 24]u8,
    /// Length of the plaintext (ciphertext is same length)
    ct_len: usize,

    pub fn ciphertext(self: *const EncryptedEnvelope) []const u8 {
        return self.buf[0..self.ct_len];
    }

    pub fn tag(self: *const EncryptedEnvelope) *const [16]u8 {
        return self.buf[self.ct_len..][0..16];
    }

    pub fn nonce(self: *const EncryptedEnvelope) *const [24]u8 {
        return self.buf[self.ct_len + 16 ..][0..24];
    }

    /// Encode the entire envelope (nonce + ciphertext + tag) as hex.
    /// Format: [nonce_hex (48)][ciphertext_hex (ct_len*2)][tag_hex (32)]
    /// Returns the valid slice of hex_buf.
    pub fn toHex(self: *const EncryptedEnvelope, hex_buf: []u8) []const u8 {
        const total = 24 + self.ct_len + 16; // nonce + ct + tag
        const hex_len = total * 2;
        if (hex_buf.len < hex_len) return hex_buf[0..0];

        // Write nonce hex
        const nonce_hex = fmt.bytesToHex(self.nonce().*, .lower);
        @memcpy(hex_buf[0..48], &nonce_hex);

        // Write ciphertext hex byte by byte
        var offset: usize = 48;
        for (self.ciphertext()) |b| {
            const byte_hex = fmt.bytesToHex([1]u8{b}, .lower);
            hex_buf[offset] = byte_hex[0];
            hex_buf[offset + 1] = byte_hex[1];
            offset += 2;
        }

        // Write tag hex
        const tag_hex = fmt.bytesToHex(self.tag().*, .lower);
        @memcpy(hex_buf[offset .. offset + 32], &tag_hex);

        return hex_buf[0..hex_len];
    }
};

/// Encrypt plaintext with a 32-byte key using XChaCha20-Poly1305.
/// Key should be derived from a password via deriveKey() or provided directly.
pub fn encrypt(plaintext: []const u8, key: [32]u8) ?EncryptedEnvelope {
    if (plaintext.len > MAX_PLAINTEXT) return null;

    var envelope: EncryptedEnvelope = .{
        .buf = undefined,
        .ct_len = plaintext.len,
    };

    // Generate random nonce
    var nonce: [24]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Encrypt: plaintext → ciphertext + tag
    var tag: [16]u8 = undefined;
    XChaCha20Poly1305.encrypt(
        envelope.buf[0..plaintext.len],
        &tag,
        plaintext,
        "",
        nonce,
        key,
    );

    // Store tag and nonce after ciphertext
    @memcpy(envelope.buf[plaintext.len..][0..16], &tag);
    @memcpy(envelope.buf[plaintext.len + 16 ..][0..24], &nonce);

    return envelope;
}

/// Decrypt an envelope back to plaintext. Returns null on auth failure.
pub fn decrypt(envelope: *const EncryptedEnvelope, key: [32]u8) ?[MAX_PLAINTEXT]u8 {
    var plaintext: [MAX_PLAINTEXT]u8 = undefined;

    XChaCha20Poly1305.decrypt(
        plaintext[0..envelope.ct_len],
        envelope.ciphertext(),
        envelope.tag().*,
        "",
        envelope.nonce().*,
        key,
    ) catch return null;

    return plaintext;
}

/// Decrypt from a hex-encoded envelope string. Returns plaintext length via out param.
pub fn decryptHex(hex_input: []const u8, key: [32]u8, plaintext_out: []u8) ?usize {
    // Minimum: 48 (nonce) + 32 (tag) = 80 hex chars (empty plaintext)
    if (hex_input.len < 80) return null;
    if (hex_input.len % 2 != 0) return null;

    const total_bytes = hex_input.len / 2;
    const ct_len = total_bytes - 24 - 16; // subtract nonce and tag
    if (ct_len > plaintext_out.len) return null;

    // Decode nonce (first 48 hex chars → 24 bytes)
    var nonce: [24]u8 = undefined;
    _ = fmt.hexToBytes(&nonce, hex_input[0..48]) catch return null;

    // Decode ciphertext
    var ct_buf: [MAX_PLAINTEXT]u8 = undefined;
    _ = fmt.hexToBytes(ct_buf[0..ct_len], hex_input[48 .. 48 + ct_len * 2]) catch return null;

    // Decode tag (last 32 hex chars → 16 bytes)
    var tag: [16]u8 = undefined;
    _ = fmt.hexToBytes(&tag, hex_input[hex_input.len - 32 ..]) catch return null;

    XChaCha20Poly1305.decrypt(
        plaintext_out[0..ct_len],
        ct_buf[0..ct_len],
        tag,
        "",
        nonce,
        key,
    ) catch return null;

    return ct_len;
}

// ============================================================================
// Key Derivation (password → 32-byte key)
// ============================================================================

/// Derive a 32-byte key from a password using Argon2id.
/// This is the recommended KDF for password-based encryption.
/// Requires an allocator for Argon2's internal memory (uses ~64MB by default).
pub fn deriveKeyArgon2(
    allocator: std.mem.Allocator,
    password: []const u8,
    salt: [32]u8,
    key_out: *[32]u8,
) !void {
    try crypto.pwhash.argon2.kdf(
        allocator,
        key_out,
        password,
        &salt,
        .{ .t = 2, .m = 65536, .p = 1 }, // moderate: 2 iterations, 64MB, 1 thread
        .argon2id,
    );
}

/// Derive a 32-byte key from a password using scrypt.
pub fn deriveKeyScrypt(
    allocator: std.mem.Allocator,
    password: []const u8,
    salt: [32]u8,
    key_out: *[32]u8,
) !void {
    try crypto.pwhash.scrypt.kdf(
        allocator,
        key_out,
        password,
        &salt,
        .{ .ln = 17, .r = 8, .p = 1 }, // N=2^17=131072, r=8, p=1
    );
}

// ============================================================================
// Ed25519 Signing
// ============================================================================

const Ed25519 = crypto.sign.Ed25519;

/// Ed25519 key pair: public (32 bytes) + secret (64 bytes), hex-encoded.
pub const SigningKeyPair = struct {
    public_hex: [64]u8, // 32 bytes → 64 hex chars
    secret_hex: [128]u8, // 64 bytes → 128 hex chars
};

/// Generate a new Ed25519 signing key pair.
pub fn generateSigningKeys() SigningKeyPair {
    const kp = Ed25519.KeyPair.generate();
    return .{
        .public_hex = fmt.bytesToHex(kp.public_key.toBytes(), .lower),
        .secret_hex = fmt.bytesToHex(kp.secret_key.toBytes(), .lower),
    };
}

/// Sign a message with an Ed25519 secret key (128 hex chars).
/// Returns signature as 128 hex chars (64 bytes).
pub fn sign(secret_key_hex: []const u8, message: []const u8, sig_hex_out: *[128]u8) bool {
    if (secret_key_hex.len != 128) return false;

    var sk_bytes: [64]u8 = undefined;
    _ = fmt.hexToBytes(&sk_bytes, secret_key_hex) catch return false;

    const sk = Ed25519.SecretKey.fromBytes(sk_bytes) catch return false;
    const pk_bytes = sk.publicKeyBytes();
    const pk = Ed25519.PublicKey.fromBytes(pk_bytes) catch return false;
    const kp = Ed25519.KeyPair{ .secret_key = sk, .public_key = pk };

    const sig = kp.sign(message, null) catch return false;
    sig_hex_out.* = fmt.bytesToHex(sig.toBytes(), .lower);
    return true;
}

/// Verify an Ed25519 signature.
/// public_key_hex: 64 hex chars, signature_hex: 128 hex chars.
pub fn verify(public_key_hex: []const u8, message: []const u8, signature_hex: []const u8) bool {
    if (public_key_hex.len != 64) return false;
    if (signature_hex.len != 128) return false;

    var pk_bytes: [32]u8 = undefined;
    _ = fmt.hexToBytes(&pk_bytes, public_key_hex) catch return false;

    var sig_bytes: [64]u8 = undefined;
    _ = fmt.hexToBytes(&sig_bytes, signature_hex) catch return false;

    const pk = Ed25519.PublicKey.fromBytes(pk_bytes) catch return false;
    const sig = Ed25519.Signature{
        .r = sig_bytes[0..32].*,
        .s = sig_bytes[32..64].*,
    };

    Ed25519.Signature.verify(sig, message, pk) catch return false;
    return true;
}

// ============================================================================
// X25519 Diffie-Hellman
// ============================================================================

const X25519 = crypto.dh.X25519;

/// X25519 key pair: public (32 bytes) + secret (32 bytes), hex-encoded.
pub const DHKeyPair = struct {
    public_hex: [64]u8, // 32 bytes → 64 hex chars
    secret_hex: [64]u8, // 32 bytes → 64 hex chars
};

/// Generate a new X25519 DH key pair.
pub fn generateDHKeys() DHKeyPair {
    const kp = X25519.KeyPair.generate();
    return .{
        .public_hex = fmt.bytesToHex(kp.public_key, .lower),
        .secret_hex = fmt.bytesToHex(kp.secret_key, .lower),
    };
}

/// Compute shared secret from private key + peer's public key.
/// Returns 64-char hex string, or false on failure.
pub fn diffieHellman(
    secret_key_hex: []const u8,
    public_key_hex: []const u8,
    shared_hex_out: *[64]u8,
) bool {
    if (secret_key_hex.len != 64) return false;
    if (public_key_hex.len != 64) return false;

    var sk: [32]u8 = undefined;
    _ = fmt.hexToBytes(&sk, secret_key_hex) catch return false;

    var pk: [32]u8 = undefined;
    _ = fmt.hexToBytes(&pk, public_key_hex) catch return false;

    const shared = X25519.scalarmult(sk, pk) catch return false;
    shared_hex_out.* = fmt.bytesToHex(shared, .lower);

    // Zero the secret key
    crypto.secureZero(u8, @as(*volatile [32]u8, @volatileCast(&sk)));
    return true;
}

// ============================================================================
// Random bytes / tokens
// ============================================================================

/// Fill buffer with cryptographically secure random bytes.
pub fn randomBytes(buf: []u8) void {
    crypto.random.bytes(buf);
}

/// Generate a random hex token of the specified byte length.
/// Output hex_out must be at least bytes*2 chars.
pub fn randomToken(bytes: usize, hex_out: []u8) []const u8 {
    var buf: [256]u8 = undefined;
    const n = @min(bytes, 256);
    crypto.random.bytes(buf[0..n]);

    // Encode each byte to hex
    var i: usize = 0;
    while (i < n) : (i += 1) {
        const byte_hex = fmt.bytesToHex([1]u8{buf[i]}, .lower);
        if (i * 2 + 1 < hex_out.len) {
            hex_out[i * 2] = byte_hex[0];
            hex_out[i * 2 + 1] = byte_hex[1];
        }
    }
    return hex_out[0..n * 2];
}

/// Generate a random alphanumeric ID of the specified length.
pub fn randomId(length: usize, out: []u8) []const u8 {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var buf: [256]u8 = undefined;
    const n = @min(length, @min(256, out.len));
    crypto.random.bytes(buf[0..n]);

    for (0..n) |i| {
        out[i] = chars[buf[i] % 62];
    }
    return out[0..n];
}

// ============================================================================
// Hex / Base64 encoding helpers
// ============================================================================

/// Encode bytes to lowercase hex string.
pub fn toHex(bytes: []const u8, out: []u8) []const u8 {
    const hex_len = bytes.len * 2;
    if (out.len < hex_len) return out[0..0];

    var i: usize = 0;
    while (i < bytes.len) : (i += 1) {
        const byte_hex = fmt.bytesToHex([1]u8{bytes[i]}, .lower);
        out[i * 2] = byte_hex[0];
        out[i * 2 + 1] = byte_hex[1];
    }
    return out[0..hex_len];
}

/// Decode hex string to bytes.
pub fn fromHex(hex: []const u8, out: []u8) ?[]u8 {
    return fmt.hexToBytes(out, hex) catch null;
}

/// Encode bytes to base64. Returns the encoded slice.
pub fn toBase64(bytes: []const u8, out: []u8) []const u8 {
    const encoder = std.base64.standard.Encoder;
    const encoded_len = encoder.calcSize(bytes.len);
    if (out.len < encoded_len) return out[0..0];
    return encoder.encode(out, bytes);
}

/// Decode base64 string to bytes.
pub fn fromBase64(encoded: []const u8, out: []u8) ?[]u8 {
    const decoder = std.base64.standard.Decoder;
    const decoded_len = decoder.calcSize(encoded) catch return null;
    if (out.len < decoded_len) return null;
    decoder.decode(out, encoded) catch return null;
    return out[0..decoded_len];
}

// ============================================================================
// Constant-time comparison
// ============================================================================

/// Constant-time comparison of two equal-length byte slices.
/// For comparing MACs, signatures, and other crypto secrets.
pub fn timingSafeEqual(a: []const u8, b: []const u8) bool {
    if (a.len != b.len) return false;
    // Manual constant-time compare for runtime-length slices
    var acc: u8 = 0;
    for (a, b) |x, y| {
        acc |= x ^ y;
    }
    return acc == 0;
}

// ============================================================================
// Memory zeroing
// ============================================================================

/// Securely zero a buffer (not optimized away by compiler).
pub fn secureZero(buf: []u8) void {
    crypto.secureZero(u8, @as([]volatile u8, @volatileCast(buf)));
}

// ============================================================================
// Tests
// ============================================================================

test "sha256 known vector" {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    var hex: [64]u8 = undefined;
    sha256("hello", &hex);
    try std.testing.expectEqualStrings(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
        &hex,
    );
}

test "sha512 known vector" {
    // SHA-512("hello") first 16 chars
    var hex: [128]u8 = undefined;
    sha512("hello", &hex);
    try std.testing.expectEqualStrings("9b71d224bd62f378", hex[0..16]);
}

test "blake3 known vector" {
    var hex: [64]u8 = undefined;
    blake3("hello", &hex);
    // BLAKE3("hello") = ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f
    try std.testing.expectEqualStrings(
        "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f",
        &hex,
    );
}

test "hmac-sha256" {
    var hex: [64]u8 = undefined;
    hmacSha256("key", "message", &hex);
    // Known HMAC-SHA256("key", "message")
    try std.testing.expectEqualStrings(
        "6e9ef29b75fffc5b7abae527d58fdadb2fe42e7219011976917343065f58ed4a",
        &hex,
    );
}

test "encrypt/decrypt round-trip" {
    const key = [_]u8{0x42} ** 32;
    const plaintext = "hello, crypto!";
    const envelope = encrypt(plaintext, key) orelse unreachable;
    const result = decrypt(&envelope, key) orelse unreachable;
    try std.testing.expectEqualStrings(plaintext, result[0..plaintext.len]);
}

test "encrypt/decrypt wrong key fails" {
    const key = [_]u8{0x42} ** 32;
    const wrong_key = [_]u8{0x43} ** 32;
    const envelope = encrypt("secret", key) orelse unreachable;
    const result = decrypt(&envelope, wrong_key);
    try std.testing.expect(result == null);
}

test "ed25519 sign/verify round-trip" {
    const kp = generateSigningKeys();
    var sig_hex: [128]u8 = undefined;
    const ok = sign(&kp.secret_hex, "test message", &sig_hex);
    try std.testing.expect(ok);
    const valid = verify(&kp.public_hex, "test message", &sig_hex);
    try std.testing.expect(valid);
}

test "ed25519 verify wrong message fails" {
    const kp = generateSigningKeys();
    var sig_hex: [128]u8 = undefined;
    _ = sign(&kp.secret_hex, "test message", &sig_hex);
    const valid = verify(&kp.public_hex, "wrong message", &sig_hex);
    try std.testing.expect(!valid);
}

test "x25519 diffie-hellman" {
    const alice = generateDHKeys();
    const bob = generateDHKeys();

    var shared_ab: [64]u8 = undefined;
    var shared_ba: [64]u8 = undefined;
    const ok1 = diffieHellman(&alice.secret_hex, &bob.public_hex, &shared_ab);
    const ok2 = diffieHellman(&bob.secret_hex, &alice.public_hex, &shared_ba);
    try std.testing.expect(ok1);
    try std.testing.expect(ok2);
    try std.testing.expectEqualStrings(&shared_ab, &shared_ba);
}

test "random token" {
    var buf1: [64]u8 = undefined;
    var buf2: [64]u8 = undefined;
    const t1 = randomToken(32, &buf1);
    const t2 = randomToken(32, &buf2);
    try std.testing.expect(t1.len == 64);
    // Two random tokens should (almost certainly) differ
    try std.testing.expect(!std.mem.eql(u8, t1, t2));
}

test "random id" {
    var buf: [16]u8 = undefined;
    const id = randomId(16, &buf);
    try std.testing.expect(id.len == 16);
    // All chars should be alphanumeric
    for (id) |c| {
        try std.testing.expect(
            (c >= 'A' and c <= 'Z') or
                (c >= 'a' and c <= 'z') or
                (c >= '0' and c <= '9'),
        );
    }
}

test "timing-safe equal" {
    try std.testing.expect(timingSafeEqual("hello", "hello"));
    try std.testing.expect(!timingSafeEqual("hello", "world"));
    try std.testing.expect(!timingSafeEqual("short", "longer"));
}

test "hex round-trip" {
    const input = "hello";
    var hex_buf: [10]u8 = undefined;
    const hex = toHex(input, &hex_buf);
    try std.testing.expectEqualStrings("68656c6c6f", hex);

    var decoded: [5]u8 = undefined;
    const result = fromHex(hex, &decoded);
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("hello", result.?);
}

test "encrypt hex round-trip" {
    const key = [_]u8{0x42} ** 32;
    const plaintext = "round-trip test";
    const envelope = encrypt(plaintext, key) orelse unreachable;

    var hex_buf: [(MAX_PLAINTEXT + 16 + 24) * 2]u8 = undefined;
    const hex = envelope.toHex(&hex_buf);

    var pt_out: [MAX_PLAINTEXT]u8 = undefined;
    const pt_len = decryptHex(hex, key, &pt_out);
    try std.testing.expect(pt_len != null);
    try std.testing.expectEqualStrings(plaintext, pt_out[0..pt_len.?]);
}
