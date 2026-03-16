//! ReactJIT Privacy — HKDF, Shamir SSS, File Encryption, PII Detection, Secure Delete
//!
//! Builds on top of crypto.zig. Zero external dependencies.

const std = @import("std");
const crypto = std.crypto;
const fmt = std.fmt;
const fs = std.fs;
const mem = std.mem;

const crypto_mod = @import("crypto.zig");

// ============================================================================
// Phase 1: HKDF (Key Derivation) — wraps std.crypto.kdf.hkdf
// ============================================================================

const HkdfSha256 = crypto.kdf.hkdf.HkdfSha256;

/// Extract a pseudo-random key from salt + input keying material.
pub fn hkdfExtract(salt: []const u8, ikm: []const u8) [32]u8 {
    return HkdfSha256.extract(salt, ikm);
}

/// Expand a PRK into output keying material of arbitrary length.
pub fn hkdfExpand(out: []u8, ctx: []const u8, prk: [32]u8) void {
    HkdfSha256.expand(out, ctx, prk);
}

/// One-shot: derive a key from IKM + salt + context.
pub fn hkdfDerive(out: []u8, ikm: []const u8, salt: []const u8, ctx: []const u8) void {
    const prk = HkdfSha256.extract(salt, ikm);
    HkdfSha256.expand(out, ctx, prk);
}

// ============================================================================
// Phase 2: Shamir's Secret Sharing — GF(256)
// ============================================================================

/// GF(256) with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B)
/// Generator: 3 (standard AES primitive element)
const GF = struct {
    var exp_table: [512]u8 = undefined;
    var log_table: [256]u8 = undefined;
    var initialized: bool = false;

    fn init() void {
        if (initialized) return;
        var x: u16 = 1;
        for (0..255) |i| {
            exp_table[i] = @truncate(x);
            log_table[@as(u8, @truncate(x))] = @intCast(i);
            // Multiply by generator 3: x*3 = (x<<1) XOR x, then reduce mod 0x11B
            x = (x << 1) ^ x;
            if (x & 0x100 != 0) x ^= 0x11B;
            x &= 0xFF;
        }
        // Extend for easy modular reduction
        for (255..512) |i| {
            exp_table[i] = exp_table[i - 255];
        }
        log_table[0] = 0; // convention
        initialized = true;
    }

    fn mul(a: u8, b: u8) u8 {
        if (a == 0 or b == 0) return 0;
        return exp_table[@as(u16, log_table[a]) + @as(u16, log_table[b])];
    }

    fn inv(a: u8) u8 {
        if (a == 0) return 0; // should not happen
        return exp_table[255 - @as(u16, log_table[a])];
    }
};

/// A share from Shamir's secret sharing.
pub const Share = struct {
    x: u8, // share index (1-255)
    data: [256]u8, // share bytes
    len: u16,
};

/// Split a secret into n shares, any k can reconstruct.
/// secret: raw bytes, shares_out: must have at least n entries.
/// Returns the number of shares written (= n).
pub fn shamirSplit(secret: []const u8, n: u8, k: u8, shares_out: []Share) u8 {
    GF.init();
    if (k < 2 or n < k or secret.len > 256) return 0;

    const slen: u16 = @intCast(secret.len);

    // Initialize shares
    for (0..n) |i| {
        shares_out[i] = .{ .x = @intCast(i + 1), .data = [_]u8{0} ** 256, .len = slen };
    }

    // For each byte of the secret
    for (0..slen) |byte_idx| {
        // Build polynomial: coeffs[0] = secret byte, coeffs[1..k-1] = random
        var coeffs: [255]u8 = undefined;
        coeffs[0] = secret[byte_idx];
        var rand_buf: [254]u8 = undefined;
        crypto.random.bytes(rand_buf[0 .. k - 1]);
        for (1..k) |c| {
            coeffs[c] = rand_buf[c - 1];
        }

        // Evaluate polynomial at x = 1..n (Horner's method)
        for (0..n) |i| {
            const x: u8 = @intCast(i + 1);
            var result: u8 = 0;
            var j: usize = k;
            while (j > 0) {
                j -= 1;
                result = GF.mul(result, x) ^ coeffs[j];
            }
            shares_out[i].data[byte_idx] = result;
        }
    }

    return n;
}

/// Reconstruct a secret from k or more shares.
/// Returns the number of bytes in the secret, or 0 on failure.
pub fn shamirCombine(shares: []const Share, out: []u8) u16 {
    GF.init();
    if (shares.len < 2) return 0;

    const slen = shares[0].len;
    if (slen > out.len) return 0;

    // For each byte position
    for (0..slen) |byte_idx| {
        // Lagrange interpolation at x=0
        var secret: u8 = 0;
        for (0..shares.len) |i| {
            const xi = shares[i].x;
            const yi = shares[i].data[byte_idx];
            var li: u8 = 1;
            for (0..shares.len) |j| {
                if (i != j) {
                    const xj = shares[j].x;
                    // li *= xj / (xi ^ xj)
                    li = GF.mul(li, GF.mul(xj, GF.inv(xi ^ xj)));
                }
            }
            secret ^= GF.mul(yi, li);
        }
        out[byte_idx] = secret;
    }

    return slen;
}

// ============================================================================
// Phase 3: File Encryption (streaming XChaCha20-Poly1305)
// ============================================================================

const XChaCha20Poly1305 = crypto.aead.chacha_poly.XChaCha20Poly1305;
const CHUNK_SIZE = 65536; // 64KB
const FILE_MAGIC = [4]u8{ 'T', 'S', 'Z', 'E' }; // TSZ Encrypted
const FILE_VERSION: u8 = 1;

/// Encrypt a file with a 32-byte key using streaming XChaCha20-Poly1305.
/// Format: [magic(4)][version(1)][nonce(24)][chunk_count(4)][chunk1_ct+tag]...[chunkN_ct+tag]
pub fn encryptFile(
    input_path: []const u8,
    output_path: []const u8,
    key: [32]u8,
) !void {
    const in_file = try fs.cwd().openFile(input_path, .{});
    defer in_file.close();
    const file_size = try in_file.getEndPos();

    const out_file = try fs.cwd().createFile(output_path, .{});
    defer out_file.close();

    // Generate master nonce
    var nonce: [24]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Write header
    try out_file.writeAll(&FILE_MAGIC);
    try out_file.writeAll(&[_]u8{FILE_VERSION});
    try out_file.writeAll(&nonce);

    // Write chunk count
    const chunk_count: u32 = @intCast((file_size + CHUNK_SIZE - 1) / CHUNK_SIZE);
    const count_bytes: [4]u8 = @bitCast(chunk_count);
    try out_file.writeAll(&count_bytes);

    // Encrypt chunks
    var chunk_buf: [CHUNK_SIZE]u8 = undefined;
    var ct_buf: [CHUNK_SIZE]u8 = undefined;
    var chunk_idx: u32 = 0;

    while (true) {
        const bytes_read = try in_file.read(&chunk_buf);
        if (bytes_read == 0) break;

        // Derive per-chunk nonce from master nonce + chunk index
        var chunk_nonce: [24]u8 = nonce;
        const idx_bytes: [4]u8 = @bitCast(chunk_idx);
        chunk_nonce[20] ^= idx_bytes[0];
        chunk_nonce[21] ^= idx_bytes[1];
        chunk_nonce[22] ^= idx_bytes[2];
        chunk_nonce[23] ^= idx_bytes[3];

        var tag: [16]u8 = undefined;
        XChaCha20Poly1305.encrypt(
            ct_buf[0..bytes_read],
            &tag,
            chunk_buf[0..bytes_read],
            "", // no associated data
            chunk_nonce,
            key,
        );

        // Write: [chunk_len(4)][ciphertext][tag(16)]
        const len_bytes: [4]u8 = @bitCast(@as(u32, @intCast(bytes_read)));
        try out_file.writeAll(&len_bytes);
        try out_file.writeAll(ct_buf[0..bytes_read]);
        try out_file.writeAll(&tag);

        chunk_idx += 1;
    }
}

/// Decrypt a file encrypted with encryptFile.
pub fn decryptFile(
    input_path: []const u8,
    output_path: []const u8,
    key: [32]u8,
) !void {
    const in_file = try fs.cwd().openFile(input_path, .{});
    defer in_file.close();

    // Read and verify header
    var magic: [4]u8 = undefined;
    _ = try in_file.readAll(&magic);
    if (!mem.eql(u8, &magic, &FILE_MAGIC)) return error.InvalidFormat;

    var version: [1]u8 = undefined;
    _ = try in_file.readAll(&version);
    if (version[0] != FILE_VERSION) return error.InvalidFormat;

    var nonce: [24]u8 = undefined;
    _ = try in_file.readAll(&nonce);

    var count_bytes: [4]u8 = undefined;
    _ = try in_file.readAll(&count_bytes);
    const chunk_count: u32 = @bitCast(count_bytes);

    const out_file = try fs.cwd().createFile(output_path, .{});
    defer out_file.close();

    var ct_buf: [CHUNK_SIZE]u8 = undefined;
    var pt_buf: [CHUNK_SIZE]u8 = undefined;

    for (0..chunk_count) |chunk_idx| {
        // Read chunk length
        var len_bytes: [4]u8 = undefined;
        _ = try in_file.readAll(&len_bytes);
        const chunk_len: u32 = @bitCast(len_bytes);
        if (chunk_len > CHUNK_SIZE) return error.InvalidFormat;

        // Read ciphertext + tag
        _ = try in_file.readAll(ct_buf[0..chunk_len]);
        var tag: [16]u8 = undefined;
        _ = try in_file.readAll(&tag);

        // Derive per-chunk nonce
        var chunk_nonce: [24]u8 = nonce;
        const idx_bytes: [4]u8 = @bitCast(@as(u32, @intCast(chunk_idx)));
        chunk_nonce[20] ^= idx_bytes[0];
        chunk_nonce[21] ^= idx_bytes[1];
        chunk_nonce[22] ^= idx_bytes[2];
        chunk_nonce[23] ^= idx_bytes[3];

        XChaCha20Poly1305.decrypt(
            pt_buf[0..chunk_len],
            ct_buf[0..chunk_len],
            tag,
            "",
            chunk_nonce,
            key,
        ) catch return error.AuthenticationFailed;

        try out_file.writeAll(pt_buf[0..chunk_len]);
    }
}

// ============================================================================
// Phase 5: PII Detection & Redaction
// ============================================================================

pub const PIIType = enum { email, ssn, credit_card, phone, ipv4 };

pub const PIIMatch = struct {
    kind: PIIType,
    start: usize,
    end: usize,
};

/// Detect PII patterns in text. Returns number of matches written.
pub fn detectPII(text: []const u8, out: []PIIMatch) usize {
    var count: usize = 0;

    // Email: word+@word.word
    count = detectEmails(text, out, count);
    // SSN: NNN-NN-NNNN
    count = detectSSN(text, out, count);
    // Credit card: NNNN-NNNN-NNNN-NNNN
    count = detectCreditCard(text, out, count);
    // Phone: +1 (NNN) NNN-NNNN
    count = detectPhone(text, out, count);
    // IPv4: N.N.N.N
    count = detectIPv4(text, out, count);

    return count;
}

/// Redact detected PII matches with "[REDACTED]".
pub fn redactPII(text: []const u8, matches: []const PIIMatch, match_count: usize, out: []u8) usize {
    const redacted = "[REDACTED]";
    var src: usize = 0;
    var dst: usize = 0;

    // Sort matches by start position (simple insertion sort, usually few matches)
    var sorted: [64]PIIMatch = undefined;
    const n = @min(match_count, 64);
    @memcpy(sorted[0..n], matches[0..n]);
    for (1..n) |i| {
        const key = sorted[i];
        var j: usize = i;
        while (j > 0 and sorted[j - 1].start > key.start) {
            sorted[j] = sorted[j - 1];
            j -= 1;
        }
        sorted[j] = key;
    }

    for (0..n) |i| {
        const m = sorted[i];
        if (m.start < src) continue; // overlapping

        // Copy text before match
        const gap = m.start - src;
        if (dst + gap > out.len) break;
        @memcpy(out[dst .. dst + gap], text[src .. src + gap]);
        dst += gap;

        // Write redaction
        if (dst + redacted.len > out.len) break;
        @memcpy(out[dst .. dst + redacted.len], redacted);
        dst += redacted.len;

        src = m.end;
    }

    // Copy remaining text
    const remaining = text.len - src;
    if (dst + remaining <= out.len) {
        @memcpy(out[dst .. dst + remaining], text[src..]);
        dst += remaining;
    }

    return dst;
}

// ── PII detection helpers ───────────────────────────────────────

fn isDigit(c: u8) bool {
    return c >= '0' and c <= '9';
}

fn isAlnum(c: u8) bool {
    return isDigit(c) or (c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z');
}

fn isEmailChar(c: u8) bool {
    return isAlnum(c) or c == '.' or c == '+' or c == '-' or c == '_';
}

fn detectEmails(text: []const u8, out: []PIIMatch, start_count: usize) usize {
    var count = start_count;
    var i: usize = 0;
    while (i < text.len) : (i += 1) {
        if (text[i] != '@') continue;
        if (i == 0) continue;

        // Scan backwards for local part
        var local_start = i;
        while (local_start > 0 and isEmailChar(text[local_start - 1])) {
            local_start -= 1;
        }
        if (local_start == i) continue; // empty local part

        // Scan forwards for domain
        var domain_end = i + 1;
        while (domain_end < text.len and (isAlnum(text[domain_end]) or text[domain_end] == '.' or text[domain_end] == '-')) {
            domain_end += 1;
        }
        // Must have at least one dot in domain
        if (mem.indexOf(u8, text[i + 1 .. domain_end], ".") == null) continue;

        if (count < out.len) {
            out[count] = .{ .kind = .email, .start = local_start, .end = domain_end };
            count += 1;
        }
        i = domain_end;
    }
    return count;
}

fn detectSSN(text: []const u8, out: []PIIMatch, start_count: usize) usize {
    var count = start_count;
    var i: usize = 0;
    while (i + 8 < text.len) : (i += 1) {
        // NNN-NN-NNNN (11 chars) or NNNNNNNNN (9 chars)
        if (!isDigit(text[i])) continue;
        if (i > 0 and isDigit(text[i - 1])) continue; // not start of number

        // Try NNN-NN-NNNN
        if (i + 10 < text.len and
            isDigit(text[i]) and isDigit(text[i + 1]) and isDigit(text[i + 2]) and
            text[i + 3] == '-' and
            isDigit(text[i + 4]) and isDigit(text[i + 5]) and
            text[i + 6] == '-' and
            isDigit(text[i + 7]) and isDigit(text[i + 8]) and isDigit(text[i + 9]) and isDigit(text[i + 10]))
        {
            if (i + 11 >= text.len or !isDigit(text[i + 11])) {
                if (count < out.len) {
                    out[count] = .{ .kind = .ssn, .start = i, .end = i + 11 };
                    count += 1;
                }
                i += 10;
            }
        }
    }
    return count;
}

fn detectCreditCard(text: []const u8, out: []PIIMatch, start_count: usize) usize {
    var count = start_count;
    var i: usize = 0;
    while (i + 15 < text.len) : (i += 1) {
        if (!isDigit(text[i])) continue;
        if (i > 0 and isDigit(text[i - 1])) continue;

        // Count consecutive digits with optional separators
        var pos = i;
        var digits: usize = 0;
        while (pos < text.len and digits < 16) {
            if (isDigit(text[pos])) {
                digits += 1;
                pos += 1;
            } else if ((text[pos] == '-' or text[pos] == ' ') and digits > 0 and digits % 4 == 0) {
                pos += 1;
            } else break;
        }

        if (digits == 16) {
            if (pos >= text.len or !isDigit(text[pos])) {
                if (count < out.len) {
                    out[count] = .{ .kind = .credit_card, .start = i, .end = pos };
                    count += 1;
                }
                i = pos;
            }
        }
    }
    return count;
}

fn detectPhone(text: []const u8, out: []PIIMatch, start_count: usize) usize {
    var count = start_count;
    var i: usize = 0;
    while (i + 9 < text.len) : (i += 1) {
        const start = i;
        var pos = i;

        // Optional +1
        if (pos < text.len and text[pos] == '+') pos += 1;
        if (pos < text.len and text[pos] == '1') pos += 1;
        // Skip separator
        if (pos < text.len and (text[pos] == ' ' or text[pos] == '-' or text[pos] == '.')) pos += 1;

        // Area code: (NNN) or NNN
        var area_digits: usize = 0;
        if (pos < text.len and text[pos] == '(') {
            pos += 1;
            while (pos < text.len and isDigit(text[pos]) and area_digits < 3) {
                area_digits += 1;
                pos += 1;
            }
            if (area_digits != 3) continue;
            if (pos < text.len and text[pos] == ')') pos += 1 else continue;
        } else {
            while (pos < text.len and isDigit(text[pos]) and area_digits < 3) {
                area_digits += 1;
                pos += 1;
            }
            if (area_digits != 3) continue;
        }

        // Separator
        if (pos < text.len and (text[pos] == ' ' or text[pos] == '-' or text[pos] == '.')) pos += 1;

        // 3 digits
        var mid_digits: usize = 0;
        while (pos < text.len and isDigit(text[pos]) and mid_digits < 3) {
            mid_digits += 1;
            pos += 1;
        }
        if (mid_digits != 3) continue;

        // Separator
        if (pos < text.len and (text[pos] == ' ' or text[pos] == '-' or text[pos] == '.')) pos += 1;

        // 4 digits
        var end_digits: usize = 0;
        while (pos < text.len and isDigit(text[pos]) and end_digits < 4) {
            end_digits += 1;
            pos += 1;
        }
        if (end_digits != 4) continue;

        // Must not be followed by a digit
        if (pos < text.len and isDigit(text[pos])) continue;

        if (count < out.len) {
            out[count] = .{ .kind = .phone, .start = start, .end = pos };
            count += 1;
        }
        i = pos;
    }
    return count;
}

fn detectIPv4(text: []const u8, out: []PIIMatch, start_count: usize) usize {
    var count = start_count;
    var i: usize = 0;
    while (i < text.len) : (i += 1) {
        if (!isDigit(text[i])) continue;
        if (i > 0 and (isDigit(text[i - 1]) or text[i - 1] == '.')) continue;

        var pos = i;
        var octets: usize = 0;
        var valid = true;

        while (octets < 4 and pos < text.len and valid) {
            // Parse number
            var num: u16 = 0;
            var digits: usize = 0;
            while (pos < text.len and isDigit(text[pos]) and digits < 3) {
                num = num * 10 + @as(u16, text[pos] - '0');
                digits += 1;
                pos += 1;
            }
            if (digits == 0 or num > 255) { valid = false; break; }
            octets += 1;
            if (octets < 4) {
                if (pos < text.len and text[pos] == '.') pos += 1 else { valid = false; break; }
            }
        }

        if (valid and octets == 4) {
            if (pos >= text.len or !isDigit(text[pos])) {
                if (count < out.len) {
                    out[count] = .{ .kind = .ipv4, .start = i, .end = pos };
                    count += 1;
                }
                i = pos;
            }
        }
    }
    return count;
}

// ============================================================================
// Phase 8: Secure Delete
// ============================================================================

/// Overwrite a file with random data multiple times, then delete it.
pub fn secureDelete(path: []const u8, passes: u8) !void {
    const file = try fs.cwd().openFile(path, .{ .mode = .read_write });
    const file_size = try file.getEndPos();

    if (file_size > 0) {
        var buf: [4096]u8 = undefined;
        for (0..passes) |_| {
            try file.seekTo(0);
            var remaining = file_size;
            while (remaining > 0) {
                const to_write = @min(remaining, buf.len);
                crypto.random.bytes(buf[0..to_write]);
                try file.writeAll(buf[0..to_write]);
                remaining -= to_write;
            }
        }

        // Final zero pass
        try file.seekTo(0);
        @memset(&buf, 0);
        var remaining = file_size;
        while (remaining > 0) {
            const to_write = @min(remaining, buf.len);
            try file.writeAll(buf[0..to_write]);
            remaining -= to_write;
        }
    }

    file.close();
    try fs.cwd().deleteFile(path);
}

// ============================================================================
// Tests
// ============================================================================

test "hkdf derive" {
    var out: [32]u8 = undefined;
    hkdfDerive(&out, "input key material", "salt", "context");
    // Output should be deterministic and non-zero
    try std.testing.expect(!mem.eql(u8, &out, &([_]u8{0} ** 32)));
}

test "hkdf extract/expand round-trip" {
    const prk = hkdfExtract("salt", "ikm");
    var out1: [32]u8 = undefined;
    var out2: [32]u8 = undefined;
    hkdfExpand(&out1, "ctx1", prk);
    hkdfExpand(&out2, "ctx2", prk);
    // Different contexts → different keys
    try std.testing.expect(!mem.eql(u8, &out1, &out2));
}

test "shamir split/combine round-trip" {
    const secret = "hello secret!";
    var shares: [5]Share = undefined;
    const n = shamirSplit(secret, 5, 3, &shares);
    try std.testing.expectEqual(@as(u8, 5), n);

    // Combine with 3 of 5 shares (indices 0, 2, 4)
    const subset = [_]Share{ shares[0], shares[2], shares[4] };
    var recovered: [256]u8 = undefined;
    const rlen = shamirCombine(&subset, &recovered);
    try std.testing.expectEqual(@as(u16, 13), rlen);
    try std.testing.expectEqualStrings(secret, recovered[0..rlen]);
}

test "shamir different subsets recover same secret" {
    const secret = "test";
    var shares: [5]Share = undefined;
    _ = shamirSplit(secret, 5, 3, &shares);

    // Subset A: shares 0,1,2
    var r1: [256]u8 = undefined;
    const s1 = [_]Share{ shares[0], shares[1], shares[2] };
    const l1 = shamirCombine(&s1, &r1);

    // Subset B: shares 2,3,4
    var r2: [256]u8 = undefined;
    const s2 = [_]Share{ shares[2], shares[3], shares[4] };
    const l2 = shamirCombine(&s2, &r2);

    try std.testing.expectEqualStrings(r1[0..l1], r2[0..l2]);
    try std.testing.expectEqualStrings(secret, r1[0..l1]);
}

test "shamir too few shares fails" {
    const secret = "x";
    var shares: [5]Share = undefined;
    _ = shamirSplit(secret, 5, 3, &shares);

    // Only 2 shares (threshold is 3) — should NOT recover correctly
    var recovered: [256]u8 = undefined;
    const subset = [_]Share{ shares[0], shares[1] };
    const rlen = shamirCombine(&subset, &recovered);
    // With only 2/3 shares, the result is garbage (not the secret)
    try std.testing.expect(!mem.eql(u8, recovered[0..rlen], secret));
}

test "detect email" {
    var matches: [16]PIIMatch = undefined;
    const n = detectPII("contact me at alice@example.com for info", &matches);
    try std.testing.expectEqual(@as(usize, 1), n);
    try std.testing.expectEqual(PIIType.email, matches[0].kind);
    try std.testing.expectEqualStrings("alice@example.com", "contact me at alice@example.com for info"[matches[0].start..matches[0].end]);
}

test "detect SSN" {
    var matches: [16]PIIMatch = undefined;
    const n = detectPII("ssn: 123-45-6789", &matches);
    try std.testing.expectEqual(@as(usize, 1), n);
    try std.testing.expectEqual(PIIType.ssn, matches[0].kind);
}

test "detect credit card" {
    var matches: [16]PIIMatch = undefined;
    const n = detectPII("card: 4111-1111-1111-1111", &matches);
    try std.testing.expectEqual(@as(usize, 1), n);
    try std.testing.expectEqual(PIIType.credit_card, matches[0].kind);
}

test "detect ipv4" {
    var matches: [16]PIIMatch = undefined;
    const n = detectPII("server at 192.168.1.100 is down", &matches);
    try std.testing.expectEqual(@as(usize, 1), n);
    try std.testing.expectEqual(PIIType.ipv4, matches[0].kind);
}

test "redact PII" {
    var matches: [16]PIIMatch = undefined;
    const text = "email: alice@example.com ssn: 123-45-6789";
    const n = detectPII(text, &matches);
    var redacted: [256]u8 = undefined;
    const rlen = redactPII(text, &matches, n, &redacted);
    const result = redacted[0..rlen];
    try std.testing.expect(mem.indexOf(u8, result, "alice@example.com") == null);
    try std.testing.expect(mem.indexOf(u8, result, "123-45-6789") == null);
    try std.testing.expect(mem.indexOf(u8, result, "[REDACTED]") != null);
}

test "file encrypt/decrypt round-trip" {
    const tmp_dir = "/tmp/tsz_privacy_test";
    fs.makeDirAbsolute(tmp_dir) catch {};
    defer fs.deleteTreeAbsolute(tmp_dir) catch {};

    const plain_path = tmp_dir ++ "/plain.txt";
    const enc_path = tmp_dir ++ "/encrypted.bin";
    const dec_path = tmp_dir ++ "/decrypted.txt";

    // Write test file
    {
        const f = try fs.createFileAbsolute(plain_path, .{});
        defer f.close();
        try f.writeAll("Hello, encrypted world! This is a test of streaming file encryption.");
    }

    const key = [_]u8{0x42} ** 32;
    try encryptFile(plain_path, enc_path, key);
    try decryptFile(enc_path, dec_path, key);

    // Verify
    const original = try fs.openFileAbsolute(plain_path, .{});
    defer original.close();
    var orig_buf: [256]u8 = undefined;
    const orig_len = try original.readAll(&orig_buf);

    const decrypted = try fs.openFileAbsolute(dec_path, .{});
    defer decrypted.close();
    var dec_buf: [256]u8 = undefined;
    const dec_len = try decrypted.readAll(&dec_buf);

    try std.testing.expectEqualStrings(orig_buf[0..orig_len], dec_buf[0..dec_len]);
}
