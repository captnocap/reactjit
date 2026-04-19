//! Cart pack format — bundles multiple .so cartridges into a single file.
//!
//! Format:
//!   [4 bytes] magic: "CART"
//!   [4 bytes] entry count (little-endian u32)
//!   [per entry, 80 bytes each]:
//!     [64 bytes] name (null-padded)
//!     [8 bytes]  offset from file start (little-endian u64)
//!     [8 bytes]  size in bytes (little-endian u64)
//!   [concatenated .so blobs at their declared offsets]

const std = @import("std");

pub const MAGIC = "CART";
pub const MAX_ENTRIES = 64;
pub const NAME_LEN = 64;
pub const ENTRY_SIZE = NAME_LEN + 8 + 8; // 80 bytes
pub const HEADER_SIZE = 4 + 4; // magic + count

pub const Entry = struct {
    name: [NAME_LEN]u8 = undefined,
    name_len: usize = 0,
    offset: u64 = 0,
    size: u64 = 0,

    pub fn nameSlice(self: *const Entry) []const u8 {
        return self.name[0..self.name_len];
    }
};

pub const Toc = struct {
    entries: [MAX_ENTRIES]Entry = undefined,
    count: usize = 0,
};

/// Read a pack file's table of contents. Returns entries and count.
pub fn readToc(path: []const u8) !Toc {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();

    // Read magic
    var hdr: [HEADER_SIZE]u8 = undefined;
    const hn = try file.readAll(&hdr);
    if (hn < HEADER_SIZE) return error.InvalidFormat;
    if (!std.mem.eql(u8, hdr[0..4], MAGIC)) return error.InvalidFormat;

    const count = std.mem.readInt(u32, hdr[4..8], .little);
    if (count > MAX_ENTRIES) return error.TooManyEntries;

    var result = Toc{ .count = count };

    for (0..count) |i| {
        var ebuf: [ENTRY_SIZE]u8 = undefined;
        const en = try file.readAll(&ebuf);
        if (en < ENTRY_SIZE) return error.InvalidFormat;

        var e = Entry{};
        @memcpy(&e.name, ebuf[0..NAME_LEN]);
        // Find actual name length (null-terminated)
        e.name_len = std.mem.indexOfScalar(u8, &e.name, 0) orelse NAME_LEN;
        e.offset = std.mem.readInt(u64, ebuf[NAME_LEN..][0..8], .little);
        e.size = std.mem.readInt(u64, ebuf[NAME_LEN + 8 ..][0..8], .little);
        result.entries[i] = e;
    }

    return result;
}

/// Extract a single entry from a pack to a temp file. Returns the temp path.
pub fn extractEntry(pack_path: []const u8, entry: *const Entry, out_buf: *[256]u8) ![]const u8 {
    const file = try std.fs.cwd().openFile(pack_path, .{});
    defer file.close();

    try file.seekTo(entry.offset);

    // Write to temp file
    const tmp_path = std.fmt.bufPrint(out_buf, "/tmp/tsz_pack_{s}", .{entry.nameSlice()}) catch
        return error.InvalidFormat;

    const dst = try std.fs.createFileAbsolute(tmp_path, .{});
    defer dst.close();

    var remaining: u64 = entry.size;
    var buf: [65536]u8 = undefined;
    while (remaining > 0) {
        const to_read = @min(remaining, buf.len);
        const n = try file.read(buf[0..@intCast(to_read)]);
        if (n == 0) break;
        try dst.writeAll(buf[0..n]);
        remaining -= n;
    }

    return tmp_path;
}

/// Create a pack file from a list of .so paths.
pub fn createPack(
    out_path: []const u8,
    so_paths: []const []const u8,
    names: []const []const u8,
) !void {
    if (so_paths.len != names.len) return error.InvalidArgument;
    if (so_paths.len > MAX_ENTRIES) return error.TooManyEntries;

    const count: u32 = @intCast(so_paths.len);

    // Measure file sizes
    var sizes: [MAX_ENTRIES]u64 = undefined;
    for (0..count) |i| {
        const stat = try std.fs.cwd().statFile(so_paths[i]);
        sizes[i] = stat.size;
    }

    // Compute offsets (header + toc + data)
    const toc_size: u64 = @as(u64, count) * ENTRY_SIZE;
    const data_start: u64 = HEADER_SIZE + toc_size;

    var offsets: [MAX_ENTRIES]u64 = undefined;
    var cursor: u64 = data_start;
    for (0..count) |i| {
        offsets[i] = cursor;
        cursor += sizes[i];
    }

    // Write pack
    const file = try std.fs.cwd().createFile(out_path, .{});
    defer file.close();

    // Magic + count
    try file.writeAll(MAGIC);
    var count_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &count_buf, count, .little);
    try file.writeAll(&count_buf);

    // TOC entries
    for (0..count) |i| {
        var ebuf: [ENTRY_SIZE]u8 = [_]u8{0} ** ENTRY_SIZE;
        const nl = @min(names[i].len, NAME_LEN);
        @memcpy(ebuf[0..nl], names[i][0..nl]);
        std.mem.writeInt(u64, ebuf[NAME_LEN..][0..8], offsets[i], .little);
        std.mem.writeInt(u64, ebuf[NAME_LEN + 8 ..][0..8], sizes[i], .little);
        try file.writeAll(&ebuf);
    }

    // Data blobs
    for (0..count) |i| {
        const src = try std.fs.cwd().openFile(so_paths[i], .{});
        defer src.close();
        var buf: [65536]u8 = undefined;
        while (true) {
            const n = try src.read(&buf);
            if (n == 0) break;
            try file.writeAll(buf[0..n]);
        }
    }
}
