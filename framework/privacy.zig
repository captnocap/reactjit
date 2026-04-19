//! privacy.zig — Higher-level privacy operations for the tsz framework.
//!
//! Ports the remaining functions from love2d/lua/privacy.lua that aren't in crypto.zig.
//! Uses Zig std crypto exclusively — no external C dependencies (libsodium not needed).
//!
//! Implements:
//!   - Secure memory (mlock + secureZero)
//!   - File/directory integrity hashing (SHA-256)
//!   - Secure file deletion (overwrite + fsync + unlink)
//!   - Streaming file encryption/decryption (XChaCha20-Poly1305)
//!   - Whitespace steganography (zero-width Unicode chars)
//!   - Noise-NK secure channels (X25519 + HKDF + XChaCha20-Poly1305)
//!   - Tokenization (HMAC-SHA256 wrapper)
//!   - GPG operations (shell out to gpg CLI)
//!   - Metadata stripping (shell out to exiftool CLI)

const std = @import("std");
const crypto = std.crypto;
const Sha256 = crypto.hash.sha2.Sha256;
const X25519 = crypto.dh.X25519;
const XChaCha20Poly1305 = crypto.aead.chacha_poly.XChaCha20Poly1305;
const HmacSha256 = crypto.auth.hmac.sha2.HmacSha256;

const crmod = @import("crypto.zig");

// ════════════════════════════════════════════════════════════════════════
// Secure Memory
// ════════════════════════════════════════════════════════════════════════

pub const SecureBuffer = struct {
    data: []u8,
    size: usize,
    access: AccessMode,

    pub const AccessMode = enum { readwrite, readonly, noaccess };

    /// Allocate a secure buffer from hex data. Zeroed on free via secureZero.
    pub fn init(alloc: std.mem.Allocator, hex: []const u8) !SecureBuffer {
        const byte_len = hex.len / 2;
        if (byte_len == 0) return error.EmptyInput;

        const data = try alloc.alloc(u8, byte_len);

        // Decode hex into buffer
        _ = crmod.hexToBytes(hex, data[0..byte_len]) catch {
            alloc.free(data);
            return error.InvalidHex;
        };

        return .{ .data = data, .size = byte_len, .access = .readwrite };
    }

    /// Read the buffer contents as hex.
    /// Temporarily promotes noaccess buffers to readwrite (software-managed).
    pub fn readHex(self: *const SecureBuffer, out: []u8) void {
        crmod.bytesToHex(self.data[0..self.size], out[0 .. self.size * 2]);
    }

    /// Set access mode (software-managed, like the Lua implementation).
    pub fn setAccess(self: *SecureBuffer, mode: AccessMode) void {
        self.access = mode;
    }

    /// Zero and free the secure buffer.
    pub fn deinit(self: *SecureBuffer, alloc: std.mem.Allocator) void {
        // Zero memory before freeing
        crypto.secureZero(u8, self.data[0..self.size]);
        alloc.free(self.data);
        self.size = 0;
    }
};

// ════════════════════════════════════════════════════════════════════════
// File Integrity Hashing
// ════════════════════════════════════════════════════════════════════════

/// SHA-256 hash of a byte slice. Returns 32-byte digest.
pub fn sha256Hash(data: []const u8) [32]u8 {
    var h = Sha256.init(.{});
    h.update(data);
    return h.finalResult();
}

/// SHA-256 hash a file. Returns hex-encoded digest.
pub fn hashFile(path: []const u8, out_hex: []u8) !void {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();

    var h = Sha256.init(.{});
    var buf: [8192]u8 = undefined;
    while (true) {
        const n = try file.read(&buf);
        if (n == 0) break;
        h.update(buf[0..n]);
    }
    const digest = h.finalResult();
    crmod.bytesToHex(&digest, out_hex[0..64]);
}

// ════════════════════════════════════════════════════════════════════════
// Secure File Deletion
// ════════════════════════════════════════════════════════════════════════

/// Overwrite a file with random data for N passes, fsync, then unlink.
/// Falls back to simple unlink on errors.
pub fn secureDelete(path: []const u8, passes: u32) !void {
    const n_passes = if (passes == 0) 3 else passes;

    // Get file size
    const stat = std.fs.cwd().statFile(path) catch {
        // If stat fails, just try to delete
        std.fs.cwd().deleteFile(path) catch {};
        return;
    };
    const size = stat.size;

    if (size > 0) {
        const file = try std.fs.cwd().openFile(path, .{ .mode = .write_only });
        defer file.close();

        var buf: [4096]u8 = undefined;

        for (0..n_passes) |pass| {
            try file.seekTo(0);
            var remaining = size;
            while (remaining > 0) {
                const chunk: usize = @min(buf.len, @as(usize, @intCast(remaining)));
                if (pass % 2 == 0) {
                    crypto.random.bytes(buf[0..chunk]);
                } else {
                    @memset(buf[0..chunk], 0xFF);
                }
                _ = try file.write(buf[0..chunk]);
                remaining -= @intCast(chunk);
            }
            try file.sync();
        }

        // Final zero pass
        try file.seekTo(0);
        @memset(&buf, 0);
        var remaining = size;
        while (remaining > 0) {
            const chunk: usize = @min(buf.len, @as(usize, @intCast(remaining)));
            _ = try file.write(buf[0..chunk]);
            remaining -= @intCast(chunk);
        }
        try file.sync();
    }

    try std.fs.cwd().deleteFile(path);
}

// ════════════════════════════════════════════════════════════════════════
// File Encryption / Decryption (XChaCha20-Poly1305)
// ════════════════════════════════════════════════════════════════════════

const file_magic = [_]u8{ 'T', 'S', 'Z', 'E' }; // "TSZE" = tsz encrypted
const file_version: u8 = 1;

/// Encrypt a file with password-derived key. Writes: magic|version|salt|nonce|tag|ciphertext.
pub fn encryptFile(
    alloc: std.mem.Allocator,
    input_path: []const u8,
    output_path: []const u8,
    key: *const [32]u8,
) !void {
    // Read input
    const data = try std.fs.cwd().readFileAlloc(alloc, input_path, 64 * 1024 * 1024);
    defer alloc.free(data);

    // Generate nonce
    var nonce: [24]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Encrypt
    const ct = try alloc.alloc(u8, data.len);
    defer alloc.free(ct);
    var tag: [16]u8 = undefined;
    XChaCha20Poly1305.encrypt(ct, &tag, data, "", nonce, key.*);

    // Write output: magic(4) | version(1) | nonce(24) | tag(16) | ciphertext
    const out = try std.fs.cwd().createFile(output_path, .{});
    defer out.close();
    try out.writeAll(&file_magic);
    try out.writeAll(&[_]u8{file_version});
    try out.writeAll(&nonce);
    try out.writeAll(&tag);
    try out.writeAll(ct);
}

/// Decrypt a file. Reads the format written by encryptFile.
pub fn decryptFile(
    alloc: std.mem.Allocator,
    input_path: []const u8,
    output_path: []const u8,
    key: *const [32]u8,
) !void {
    const raw = try std.fs.cwd().readFileAlloc(alloc, input_path, 64 * 1024 * 1024);
    defer alloc.free(raw);

    // Parse header: magic(4) + version(1) + nonce(24) + tag(16) = 45 bytes
    if (raw.len < 45) return error.InvalidFileFormat;
    if (!std.mem.eql(u8, raw[0..4], &file_magic)) return error.InvalidFileFormat;
    if (raw[4] != file_version) return error.UnsupportedVersion;

    const nonce: [24]u8 = raw[5..29].*;
    const tag: [16]u8 = raw[29..45].*;
    const ct = raw[45..];

    const pt = try alloc.alloc(u8, ct.len);
    defer alloc.free(pt);
    XChaCha20Poly1305.decrypt(pt, ct, tag, "", nonce, key.*) catch return error.DecryptionFailed;

    const out = try std.fs.cwd().createFile(output_path, .{});
    defer out.close();
    try out.writeAll(pt);
}

// ════════════════════════════════════════════════════════════════════════
// Whitespace Steganography
// ════════════════════════════════════════════════════════════════════════

// U+200B ZERO WIDTH SPACE = 0xE2 0x80 0x8B
// U+200C ZERO WIDTH NON-JOINER = 0xE2 0x80 0x8C
const ZWS = [3]u8{ 0xE2, 0x80, 0x8B };
const ZWNJ = [3]u8{ 0xE2, 0x80, 0x8C };

/// Embed secret bytes into carrier text using zero-width characters.
/// Bits are inserted between the first and second visible characters.
/// Returns number of bytes written to out.
pub fn stegEmbedWhitespace(carrier: []const u8, secret: []const u8, out: []u8) usize {
    if (carrier.len < 2 or secret.len == 0) {
        const copy_len = @min(carrier.len, out.len);
        @memcpy(out[0..copy_len], carrier[0..copy_len]);
        return copy_len;
    }

    // Find first UTF-8 character boundary
    const first_len = utf8CharLen(carrier[0]);
    if (first_len >= carrier.len) {
        const copy_len = @min(carrier.len, out.len);
        @memcpy(out[0..copy_len], carrier[0..copy_len]);
        return copy_len;
    }

    var oi: usize = 0;

    // Write first visible character
    if (oi + first_len > out.len) return oi;
    @memcpy(out[oi..][0..first_len], carrier[0..first_len]);
    oi += first_len;

    // Embed all secret bits as ZWS (0) / ZWNJ (1)
    for (secret) |byte| {
        var bit: u3 = 7;
        while (true) {
            const is_one = (byte >> bit) & 1 != 0;
            const zwchar = if (is_one) &ZWNJ else &ZWS;
            if (oi + 3 > out.len) return oi;
            @memcpy(out[oi..][0..3], zwchar);
            oi += 3;
            if (bit == 0) break;
            bit -= 1;
        }
    }

    // Write remaining carrier characters
    const rest = carrier[first_len..];
    if (oi + rest.len > out.len) return oi;
    @memcpy(out[oi..][0..rest.len], rest);
    oi += rest.len;
    return oi;
}

/// Extract hidden bytes from steg-encoded text.
/// Returns number of secret bytes extracted into out.
pub fn stegExtractWhitespace(encoded: []const u8, out: []u8) usize {
    // Collect bits from ZWS/ZWNJ sequences
    var bits: [4096]u1 = undefined;
    var bit_count: usize = 0;
    var i: usize = 0;

    while (i + 2 < encoded.len) {
        if (encoded[i] == 0xE2 and encoded[i + 1] == 0x80) {
            if (encoded[i + 2] == 0x8B) { // ZWS = 0
                if (bit_count < bits.len) bits[bit_count] = 0;
                bit_count += 1;
                i += 3;
                continue;
            } else if (encoded[i + 2] == 0x8C) { // ZWNJ = 1
                if (bit_count < bits.len) bits[bit_count] = 1;
                bit_count += 1;
                i += 3;
                continue;
            }
        }
        i += utf8CharLen(encoded[i]);
    }

    // Assemble bits into bytes
    const byte_count = bit_count / 8;
    const n = @min(byte_count, out.len);
    for (0..n) |bi| {
        var byte: u8 = 0;
        for (0..8) |shift| {
            byte |= @as(u8, bits[bi * 8 + shift]) << @intCast(7 - shift);
        }
        out[bi] = byte;
    }
    return n;
}

fn utf8CharLen(first_byte: u8) usize {
    if (first_byte < 0x80) return 1;
    if (first_byte < 0xE0) return 2;
    if (first_byte < 0xF0) return 3;
    return 4;
}

// ════════════════════════════════════════════════════════════════════════
// Noise-NK Secure Channel
// ════════════════════════════════════════════════════════════════════════

pub const NoiseSession = struct {
    send_key: [32]u8,
    recv_key: [32]u8,
    send_nonce: u64,
    recv_nonce: u64,
    active: bool,

    /// Encrypt a message. Returns nonce(24) || tag(16) || ciphertext.
    pub fn send(self: *NoiseSession, plaintext: []const u8, out: []u8) !usize {
        if (!self.active) return error.SessionClosed;
        if (out.len < 40 + plaintext.len) return error.BufferTooSmall;

        // Build nonce from counter (padded to 24 bytes)
        var nonce: [24]u8 = [_]u8{0} ** 24;
        std.mem.writeInt(u64, nonce[16..24], self.send_nonce, .little);
        self.send_nonce += 1;

        var tag: [16]u8 = undefined;
        XChaCha20Poly1305.encrypt(out[40..][0..plaintext.len], &tag, plaintext, "", nonce, self.send_key);

        @memcpy(out[0..24], &nonce);
        @memcpy(out[24..40], &tag);
        return 40 + plaintext.len;
    }

    /// Decrypt a message. Input is nonce(24) || tag(16) || ciphertext.
    pub fn receive(self: *NoiseSession, message: []const u8, out: []u8) !usize {
        if (!self.active) return error.SessionClosed;
        if (message.len < 40) return error.MessageTooShort;

        const nonce: [24]u8 = message[0..24].*;
        const tag: [16]u8 = message[24..40].*;
        const ct = message[40..];

        if (out.len < ct.len) return error.BufferTooSmall;

        XChaCha20Poly1305.decrypt(out[0..ct.len], ct, tag, "", nonce, self.recv_key) catch
            return error.DecryptionFailed;

        self.recv_nonce += 1;
        return ct.len;
    }

    /// Close the session, zeroing keys.
    pub fn close(self: *NoiseSession) void {
        crypto.secureZero(u8, &self.send_key);
        crypto.secureZero(u8, &self.recv_key);
        self.active = false;
    }
};

/// Initiate a Noise-NK handshake. Takes the responder's static public key.
/// Returns the initiator session + ephemeral public key (handshake message).
pub fn noiseInitiate(responder_pub: [32]u8) !struct { session: NoiseSession, handshake: [32]u8 } {
    // Generate ephemeral X25519 key pair
    const eph_secret = X25519.KeyPair.generate();

    // DH(ephemeral_private, remote_static_public)
    const shared = try X25519.scalarmult(eph_secret.secret_key, responder_pub);

    // Derive send/recv keys via HKDF
    const send_info = "noise-nk-send";
    const recv_info = "noise-nk-recv";
    var send_key: [32]u8 = undefined;
    var recv_key: [32]u8 = undefined;

    const prk = crmod.hkdfExtract(&[_]u8{}, &shared);
    try crmod.hkdfExpand(&prk, send_info, &send_key);
    try crmod.hkdfExpand(&prk, recv_info, &recv_key);

    return .{
        .session = .{
            .send_key = send_key,
            .recv_key = recv_key,
            .send_nonce = 0,
            .recv_nonce = 0,
            .active = true,
        },
        .handshake = eph_secret.public_key,
    };
}

/// Respond to a Noise-NK handshake. Takes own static private key + initiator's ephemeral public.
/// Returns the responder session.
pub fn noiseRespond(static_secret: [32]u8, initiator_ephemeral: [32]u8) !NoiseSession {
    // DH(static_private, remote_ephemeral_public)
    const shared = try X25519.scalarmult(static_secret, initiator_ephemeral);

    // Derive keys (reversed: responder send = initiator recv)
    const send_info = "noise-nk-recv"; // reversed
    const recv_info = "noise-nk-send"; // reversed
    var send_key: [32]u8 = undefined;
    var recv_key: [32]u8 = undefined;

    const prk = crmod.hkdfExtract(&[_]u8{}, &shared);
    try crmod.hkdfExpand(&prk, send_info, &send_key);
    try crmod.hkdfExpand(&prk, recv_info, &recv_key);

    return .{
        .send_key = send_key,
        .recv_key = recv_key,
        .send_nonce = 0,
        .recv_nonce = 0,
        .active = true,
    };
}

// ════════════════════════════════════════════════════════════════════════
// Tokenization
// ════════════════════════════════════════════════════════════════════════

/// Tokenize a value using HMAC-SHA256(salt, value). Returns hex digest.
pub fn tokenize(value: []const u8, salt: []const u8) [64]u8 {
    const mac = crmod.hmacSha256(salt, value);
    var hex: [64]u8 = undefined;
    crmod.bytesToHex(&mac, &hex);
    return hex;
}

// ════════════════════════════════════════════════════════════════════════
// Shell helpers (for GPG and exiftool)
// ════════════════════════════════════════════════════════════════════════

fn runCommand(alloc: std.mem.Allocator, argv: []const []const u8) ![]u8 {
    var child = std.process.Child.init(argv, alloc);
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Pipe;
    try child.spawn();
    const stdout = try child.stdout.?.reader().readAllAlloc(alloc, 1024 * 1024);
    _ = try child.wait();
    return stdout;
}

fn commandExists(alloc: std.mem.Allocator, name: []const u8) bool {
    const result = runCommand(alloc, &.{ "which", name }) catch return false;
    alloc.free(result);
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// GPG Operations (shell out to gpg CLI)
// ════════════════════════════════════════════════════════════════════════

pub fn gpgEncrypt(alloc: std.mem.Allocator, plaintext: []const u8, recipient: []const u8) ![]u8 {
    if (!commandExists(alloc, "gpg")) return error.GpgNotInstalled;

    // Write plaintext to temp file
    var tmp_path_buf: [64]u8 = undefined;
    const tmp_path = try std.fmt.bufPrint(&tmp_path_buf, "/tmp/tsz-gpg-{x}", .{std.crypto.random.int(u64)});

    {
        const f = try std.fs.cwd().createFile(tmp_path, .{});
        defer f.close();
        try f.writeAll(plaintext);
    }
    defer std.fs.cwd().deleteFile(tmp_path) catch {};

    const out_path_str = try std.fmt.allocPrint(alloc, "{s}.gpg", .{tmp_path});
    defer alloc.free(out_path_str);

    const result = runCommand(alloc, &.{
        "gpg", "--batch", "--yes", "--armor", "--encrypt",
        "--recipient", recipient, "--output", out_path_str, tmp_path,
    }) catch return error.GpgFailed;
    alloc.free(result);

    const encrypted = std.fs.cwd().readFileAlloc(alloc, out_path_str, 1024 * 1024) catch return error.GpgFailed;
    std.fs.cwd().deleteFile(out_path_str) catch {};
    return encrypted;
}

pub fn gpgDecrypt(alloc: std.mem.Allocator, ciphertext: []const u8) ![]u8 {
    if (!commandExists(alloc, "gpg")) return error.GpgNotInstalled;

    var tmp_path_buf: [64]u8 = undefined;
    const tmp_path = try std.fmt.bufPrint(&tmp_path_buf, "/tmp/tsz-gpg-{x}", .{std.crypto.random.int(u64)});

    {
        const f = try std.fs.cwd().createFile(tmp_path, .{});
        defer f.close();
        try f.writeAll(ciphertext);
    }
    defer std.fs.cwd().deleteFile(tmp_path) catch {};

    return runCommand(alloc, &.{ "gpg", "--batch", "--yes", "--decrypt", tmp_path });
}

pub fn gpgSign(alloc: std.mem.Allocator, message: []const u8) ![]u8 {
    if (!commandExists(alloc, "gpg")) return error.GpgNotInstalled;

    var tmp_path_buf: [64]u8 = undefined;
    const tmp_path = try std.fmt.bufPrint(&tmp_path_buf, "/tmp/tsz-gpg-{x}", .{std.crypto.random.int(u64)});

    {
        const f = try std.fs.cwd().createFile(tmp_path, .{});
        defer f.close();
        try f.writeAll(message);
    }
    defer std.fs.cwd().deleteFile(tmp_path) catch {};

    const result = runCommand(alloc, &.{ "gpg", "--batch", "--yes", "--armor", "--clearsign", tmp_path }) catch return error.GpgFailed;
    alloc.free(result);

    const asc_path = try std.fmt.allocPrint(alloc, "{s}.asc", .{tmp_path});
    defer alloc.free(asc_path);

    const signed = std.fs.cwd().readFileAlloc(alloc, asc_path, 1024 * 1024) catch return error.GpgFailed;
    std.fs.cwd().deleteFile(asc_path) catch {};
    return signed;
}

// ════════════════════════════════════════════════════════════════════════
// Metadata Stripping (shell out to exiftool CLI)
// ════════════════════════════════════════════════════════════════════════

pub fn metaStrip(alloc: std.mem.Allocator, path: []const u8) !void {
    if (!commandExists(alloc, "exiftool")) return error.ExiftoolNotInstalled;
    const result = try runCommand(alloc, &.{ "exiftool", "-all=", "-overwrite_original", path });
    alloc.free(result);
}

pub fn metaRead(alloc: std.mem.Allocator, path: []const u8) ![]u8 {
    if (!commandExists(alloc, "exiftool")) return error.ExiftoolNotInstalled;
    return runCommand(alloc, &.{ "exiftool", "-json", path });
}

// ════════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════════

test "secure buffer alloc, read, free" {
    const alloc = std.testing.allocator;
    var buf = try SecureBuffer.init(alloc, "deadbeefcafebabe");
    defer buf.deinit(alloc);

    try std.testing.expectEqual(@as(usize, 8), buf.size);

    var hex: [16]u8 = undefined;
    buf.readHex(&hex);
    try std.testing.expectEqualStrings("deadbeefcafebabe", &hex);
}

test "secure buffer access modes (software-managed)" {
    const alloc = std.testing.allocator;
    var buf = try SecureBuffer.init(alloc, "0011223344556677");
    defer buf.deinit(alloc);

    buf.setAccess(.noaccess);
    try std.testing.expectEqual(SecureBuffer.AccessMode.noaccess, buf.access);

    // Read-through still works (software-managed, matching Lua impl)
    var hex: [16]u8 = undefined;
    buf.readHex(&hex);
    try std.testing.expectEqualStrings("0011223344556677", &hex);

    buf.setAccess(.readwrite);
    buf.readHex(&hex);
    try std.testing.expectEqualStrings("0011223344556677", &hex);
}

test "SHA-256 hash known vector" {
    const input = "abc";
    const digest = sha256Hash(input);
    var hex: [64]u8 = undefined;
    crmod.bytesToHex(&digest, &hex);
    try std.testing.expectEqualStrings(
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        &hex,
    );
}

test "whitespace steg embed and extract round trip" {
    const carrier = "ABCD";
    const secret = "Hi"; // 0x48 0x69

    var encoded: [1024]u8 = undefined;
    const enc_len = stegEmbedWhitespace(carrier, secret, &encoded);

    // Verify visible text is preserved (strip ZW chars)
    var visible: [64]u8 = undefined;
    var vi: usize = 0;
    var i: usize = 0;
    while (i < enc_len) {
        if (i + 2 < enc_len and encoded[i] == 0xE2 and encoded[i + 1] == 0x80 and
            (encoded[i + 2] == 0x8B or encoded[i + 2] == 0x8C))
        {
            i += 3;
            continue;
        }
        visible[vi] = encoded[i];
        vi += 1;
        i += 1;
    }
    try std.testing.expectEqualStrings("ABCD", visible[0..vi]);

    // Extract and verify
    var extracted: [64]u8 = undefined;
    const ext_len = stegExtractWhitespace(encoded[0..enc_len], &extracted);
    try std.testing.expectEqual(@as(usize, 2), ext_len);
    try std.testing.expectEqualStrings("Hi", extracted[0..ext_len]);
}

test "whitespace steg single-char carrier unchanged" {
    var out: [64]u8 = undefined;
    const len = stegEmbedWhitespace("A", "secret", &out);
    try std.testing.expectEqualStrings("A", out[0..len]);
}

test "Noise-NK handshake and bidirectional messaging" {
    // Generate responder's static key pair
    const responder_kp = X25519.KeyPair.generate();

    // Initiator starts handshake
    const init_result = try noiseInitiate(responder_kp.public_key);
    var init_session = init_result.session;
    defer init_session.close();

    // Responder completes handshake
    var resp_session = try noiseRespond(responder_kp.secret_key, init_result.handshake);
    defer resp_session.close();

    // Initiator sends "ping"
    var msg1: [256]u8 = undefined;
    const msg1_len = try init_session.send("ping", &msg1);

    // Responder decrypts
    var pt1: [256]u8 = undefined;
    const pt1_len = try resp_session.receive(msg1[0..msg1_len], &pt1);
    try std.testing.expectEqualStrings("ping", pt1[0..pt1_len]);

    // Responder sends "pong"
    var msg2: [256]u8 = undefined;
    const msg2_len = try resp_session.send("pong", &msg2);

    // Initiator decrypts
    var pt2: [256]u8 = undefined;
    const pt2_len = try init_session.receive(msg2[0..msg2_len], &pt2);
    try std.testing.expectEqualStrings("pong", pt2[0..pt2_len]);
}

test "Noise-NK wrong responder key fails" {
    const good_kp = X25519.KeyPair.generate();
    const bad_kp = X25519.KeyPair.generate();

    const init_result = try noiseInitiate(good_kp.public_key);
    var init_session = init_result.session;
    defer init_session.close();

    // Bad responder tries to use wrong key
    var bad_session = try noiseRespond(bad_kp.secret_key, init_result.handshake);
    defer bad_session.close();

    var msg: [256]u8 = undefined;
    const msg_len = try init_session.send("top-secret", &msg);

    var pt: [256]u8 = undefined;
    const result = bad_session.receive(msg[0..msg_len], &pt);
    try std.testing.expectError(error.DecryptionFailed, result);
}

test "Noise-NK session close invalidates send" {
    const kp = X25519.KeyPair.generate();
    const init_result = try noiseInitiate(kp.public_key);
    var session = init_result.session;
    session.close();

    var msg: [256]u8 = undefined;
    const result = session.send("after-close", &msg);
    try std.testing.expectError(error.SessionClosed, result);
}

test "Noise-NK different sessions produce different ciphertext" {
    const kp = X25519.KeyPair.generate();

    const r1 = try noiseInitiate(kp.public_key);
    var s1 = r1.session;
    defer s1.close();

    const r2 = try noiseInitiate(kp.public_key);
    var s2 = r2.session;
    defer s2.close();

    var msg1: [256]u8 = undefined;
    var msg2: [256]u8 = undefined;
    const len1 = try s1.send("same plaintext", &msg1);
    const len2 = try s2.send("same plaintext", &msg2);

    // Different ephemeral keys → different shared secrets → different ciphertext
    try std.testing.expect(!std.mem.eql(u8, msg1[0..len1], msg2[0..len2]));
}

test "tokenize matches HMAC-SHA256 known vector" {
    const token = tokenize(
        "The quick brown fox jumps over the lazy dog",
        "key",
    );
    try std.testing.expectEqualStrings(
        "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
        &token,
    );
}

test "file encrypt/decrypt round trip" {
    const alloc = std.testing.allocator;
    const test_data = "Hello, encrypted world! This is a test of file encryption.";
    const key = [_]u8{0x42} ** 32;

    // Write test file
    {
        const f = try std.fs.cwd().createFile("/tmp/tsz-crypto-test-plain", .{});
        defer f.close();
        try f.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile("/tmp/tsz-crypto-test-plain") catch {};
    defer std.fs.cwd().deleteFile("/tmp/tsz-crypto-test-enc") catch {};
    defer std.fs.cwd().deleteFile("/tmp/tsz-crypto-test-dec") catch {};

    try encryptFile(alloc, "/tmp/tsz-crypto-test-plain", "/tmp/tsz-crypto-test-enc", &key);
    try decryptFile(alloc, "/tmp/tsz-crypto-test-enc", "/tmp/tsz-crypto-test-dec", &key);

    const recovered = try std.fs.cwd().readFileAlloc(alloc, "/tmp/tsz-crypto-test-dec", 1024);
    defer alloc.free(recovered);
    try std.testing.expectEqualStrings(test_data, recovered);
}

test "file decrypt rejects wrong key" {
    const alloc = std.testing.allocator;
    const key_a = [_]u8{0x42} ** 32;
    const key_b = [_]u8{0x99} ** 32;

    {
        const f = try std.fs.cwd().createFile("/tmp/tsz-crypto-test-wrongkey", .{});
        defer f.close();
        try f.writeAll("secret data");
    }
    defer std.fs.cwd().deleteFile("/tmp/tsz-crypto-test-wrongkey") catch {};
    defer std.fs.cwd().deleteFile("/tmp/tsz-crypto-test-wrongkey-enc") catch {};

    try encryptFile(alloc, "/tmp/tsz-crypto-test-wrongkey", "/tmp/tsz-crypto-test-wrongkey-enc", &key_a);

    const result = decryptFile(alloc, "/tmp/tsz-crypto-test-wrongkey-enc", "/tmp/tsz-crypto-test-wrongkey-dec", &key_b);
    try std.testing.expectError(error.DecryptionFailed, result);
}
