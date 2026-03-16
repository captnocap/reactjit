//! ReactJIT Audit Log — HMAC-chained tamper-evident logging
//!
//! Each entry's hash includes the previous entry's hash, creating a
//! verifiable chain. Any modification breaks the chain.

const std = @import("std");
const crypto = std.crypto;
const fmt = std.fmt;
const fs = std.fs;
const mem = std.mem;

const HmacSha256 = crypto.auth.hmac.sha2.HmacSha256;

pub const MAX_ENTRIES = 4096;
pub const MAX_EVENT_LEN = 256;

pub const AuditEntry = struct {
    timestamp: i64,
    event: [MAX_EVENT_LEN]u8,
    event_len: u16,
    hash: [32]u8, // HMAC-SHA256(key, prev_hash || event || timestamp)
};

pub const AuditLog = struct {
    key: [32]u8,
    entries: [MAX_ENTRIES]AuditEntry,
    count: usize,

    /// Create a new audit log with the given HMAC key.
    pub fn create(key: [32]u8) AuditLog {
        return .{
            .key = key,
            .entries = undefined,
            .count = 0,
        };
    }

    /// Append an event to the audit log.
    pub fn append(self: *AuditLog, event: []const u8) void {
        if (self.count >= MAX_ENTRIES) return;

        const entry_idx = self.count;
        var entry: *AuditEntry = &self.entries[entry_idx];

        // Timestamp (seconds since epoch)
        entry.timestamp = std.time.timestamp();

        // Copy event
        const elen: u16 = @intCast(@min(event.len, MAX_EVENT_LEN));
        @memcpy(entry.event[0..elen], event[0..elen]);
        entry.event_len = elen;

        // Compute hash: HMAC(key, prev_hash || event || timestamp_bytes)
        const prev_hash: [32]u8 = if (entry_idx > 0) self.entries[entry_idx - 1].hash else [_]u8{0} ** 32;
        const ts_bytes: [8]u8 = @bitCast(entry.timestamp);

        var hmac = HmacSha256.init(&self.key);
        hmac.update(&prev_hash);
        hmac.update(entry.event[0..elen]);
        hmac.update(&ts_bytes);
        hmac.final(&entry.hash);

        self.count += 1;
    }

    /// Verify the entire chain. Returns true if intact, false if tampered.
    pub fn verify(self: *const AuditLog) bool {
        for (0..self.count) |i| {
            const entry = &self.entries[i];
            const prev_hash: [32]u8 = if (i > 0) self.entries[i - 1].hash else [_]u8{0} ** 32;
            const ts_bytes: [8]u8 = @bitCast(entry.timestamp);

            var expected: [32]u8 = undefined;
            var hmac = HmacSha256.init(&self.key);
            hmac.update(&prev_hash);
            hmac.update(entry.event[0..entry.event_len]);
            hmac.update(&ts_bytes);
            hmac.final(&expected);

            if (!mem.eql(u8, &entry.hash, &expected)) return false;
        }
        return true;
    }

    /// Get event text for an entry.
    pub fn eventText(self: *const AuditLog, idx: usize) []const u8 {
        if (idx >= self.count) return "";
        return self.entries[idx].event[0..self.entries[idx].event_len];
    }

    /// Save the audit log to a file.
    pub fn save(self: *const AuditLog, path: []const u8) !void {
        const file = try fs.cwd().createFile(path, .{});
        defer file.close();

        // Header: count (8 bytes)
        const count_bytes: [8]u8 = @bitCast(@as(u64, self.count));
        try file.writeAll(&count_bytes);

        // Each entry: timestamp(8) + event_len(2) + event(event_len) + hash(32)
        for (0..self.count) |i| {
            const e = &self.entries[i];
            const ts_bytes: [8]u8 = @bitCast(e.timestamp);
            try file.writeAll(&ts_bytes);
            const len_bytes: [2]u8 = @bitCast(e.event_len);
            try file.writeAll(&len_bytes);
            try file.writeAll(e.event[0..e.event_len]);
            try file.writeAll(&e.hash);
        }
    }

    /// Load an audit log from a file. Requires the key to verify.
    pub fn load(path: []const u8, key: [32]u8) !AuditLog {
        const file = try fs.cwd().openFile(path, .{});
        defer file.close();

        var log = AuditLog.create(key);

        var count_bytes: [8]u8 = undefined;
        _ = try file.readAll(&count_bytes);
        const count: u64 = @bitCast(count_bytes);
        if (count > MAX_ENTRIES) return error.InvalidFormat;

        for (0..count) |i| {
            var ts_bytes: [8]u8 = undefined;
            _ = try file.readAll(&ts_bytes);
            log.entries[i].timestamp = @bitCast(ts_bytes);

            var len_bytes: [2]u8 = undefined;
            _ = try file.readAll(&len_bytes);
            log.entries[i].event_len = @bitCast(len_bytes);

            const elen = log.entries[i].event_len;
            _ = try file.readAll(log.entries[i].event[0..elen]);
            _ = try file.readAll(&log.entries[i].hash);
        }
        log.count = count;

        return log;
    }
};

// ============================================================================
// Tests
// ============================================================================

test "audit create and verify" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("user_login");
    log.append("file_access");
    log.append("user_logout");

    try std.testing.expectEqual(@as(usize, 3), log.count);
    try std.testing.expect(log.verify());
}

test "audit detect tampering" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("event1");
    log.append("event2");
    log.append("event3");

    // Tamper with event text
    log.entries[1].event[0] = 'X';
    try std.testing.expect(!log.verify());
}

test "audit detect hash tampering" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("event1");
    log.append("event2");

    // Tamper with hash
    log.entries[0].hash[0] ^= 0xFF;
    try std.testing.expect(!log.verify());
}

test "audit event text" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("hello");
    try std.testing.expectEqualStrings("hello", log.eventText(0));
}

test "audit save and load" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("event_a");
    log.append("event_b");

    const path = "/tmp/tsz_audit_test.bin";
    try log.save(path);
    defer fs.cwd().deleteFile(path) catch {};

    var loaded = try AuditLog.load(path, key);
    try std.testing.expectEqual(@as(usize, 2), loaded.count);
    try std.testing.expect(loaded.verify());
    try std.testing.expectEqualStrings("event_a", loaded.eventText(0));
    try std.testing.expectEqualStrings("event_b", loaded.eventText(1));
}

test "audit chain dependency" {
    const key = [_]u8{0x42} ** 32;
    var log = AuditLog.create(key);
    log.append("first");
    const hash1 = log.entries[0].hash;
    log.append("second");
    const hash2 = log.entries[1].hash;
    // Different entries must produce different hashes
    try std.testing.expect(!mem.eql(u8, &hash1, &hash2));
}
