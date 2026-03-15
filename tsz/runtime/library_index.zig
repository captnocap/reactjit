// tsz/runtime/library_index.zig
//
// File library indexer. Walks configured directories and builds a searchable index
// of files with metadata: name, path, size, modified time, extension, category.
// Mirrors the library indexing behavior from love2d/lua/httpserver.lua.
//
// Usage pattern:
// - addDirectory() to register roots
// - rebuild() to scan and index
// - filter() to search by category, directory, or text query
// - The fswatch module can invalidate the index on changes, triggering rebuild.
//
// Does NOT handle HTTP serving directly — that's httpserver.zig's job.
// This module just builds and queries the index.

const std = @import("std");

pub const MAX_INDEX_FILES = 4096;
pub const MAX_DIRECTORIES = 16;
pub const MAX_RESULTS = 256;
const NAME_MAX = 128;
const PATH_MAX = 256;
const EXT_MAX = 16;

// -- Types --

pub const Category = enum(u4) {
    audio,
    video,
    image,
    document,
    code,
    archive,
    font,
    other,

    pub fn label(self: Category) []const u8 {
        return switch (self) {
            .audio => "audio",
            .video => "video",
            .image => "image",
            .document => "document",
            .code => "code",
            .archive => "archive",
            .font => "font",
            .other => "other",
        };
    }
};

pub const IndexEntry = struct {
    name_buf: [NAME_MAX]u8 = undefined,
    name_len: u8 = 0,
    rel_path_buf: [PATH_MAX]u8 = undefined,
    rel_path_len: u16 = 0,
    ext_buf: [EXT_MAX]u8 = undefined,
    ext_len: u4 = 0,
    category: Category = .other,
    size: u64 = 0,
    mtime_ns: i128 = 0,
    dir_idx: u8 = 0,

    pub fn name(self: *const IndexEntry) []const u8 {
        return self.name_buf[0..self.name_len];
    }

    pub fn relPath(self: *const IndexEntry) []const u8 {
        return self.rel_path_buf[0..self.rel_path_len];
    }

    pub fn ext(self: *const IndexEntry) []const u8 {
        return self.ext_buf[0..self.ext_len];
    }
};

pub const DirInfo = struct {
    path_buf: [std.fs.max_path_bytes]u8 = undefined,
    path_len: usize = 0,
    label_buf: [64]u8 = undefined,
    label_len: u8 = 0,
    file_count: u32 = 0,
    total_size: u64 = 0,
    active: bool = false,

    pub fn path(self: *const DirInfo) []const u8 {
        return self.path_buf[0..self.path_len];
    }

    pub fn label(self: *const DirInfo) []const u8 {
        return self.label_buf[0..self.label_len];
    }
};

pub const CategoryStats = struct {
    count: u32 = 0,
    total_size: u64 = 0,
};

pub const Filter = struct {
    category: ?Category = null,
    dir_idx: ?u8 = null,
    query: ?[]const u8 = null,
};

// -- Module state --

var entries: [MAX_INDEX_FILES]IndexEntry = undefined;
var entry_count: usize = 0;

var dirs: [MAX_DIRECTORIES]DirInfo = [_]DirInfo{.{}} ** MAX_DIRECTORIES;
var dir_count: u8 = 0;

var cat_stats: [8]CategoryStats = [_]CategoryStats{.{}} ** 8;

var total_files: u32 = 0;
var total_size: u64 = 0;
var built_at_ns: i128 = 0;
var is_built: bool = false;

// -- Init / Deinit --

pub fn init() void {
    entry_count = 0;
    dir_count = 0;
    total_files = 0;
    total_size = 0;
    is_built = false;
    for (&dirs) |*d| d.active = false;
    resetStats();
}

pub fn deinit() void {
    init();
}

fn resetStats() void {
    for (&cat_stats) |*s| s.* = .{};
    total_files = 0;
    total_size = 0;
}

// -- Directory management --

/// Add a directory to the index. Returns the directory index.
pub fn addDirectory(dir_path: []const u8, dir_label: ?[]const u8) error{ TooManyDirectories, NameTooLong }!u8 {
    if (dir_count >= MAX_DIRECTORIES) return error.TooManyDirectories;

    const idx = dir_count;
    var d = &dirs[idx];

    if (dir_path.len > d.path_buf.len) return error.NameTooLong;
    @memcpy(d.path_buf[0..dir_path.len], dir_path);
    d.path_len = dir_path.len;

    // Use last path component as label if none given
    const lbl = dir_label orelse std.fs.path.basename(dir_path);
    const llen: u8 = @intCast(@min(lbl.len, 64));
    @memcpy(d.label_buf[0..llen], lbl[0..llen]);
    d.label_len = llen;

    d.file_count = 0;
    d.total_size = 0;
    d.active = true;
    dir_count += 1;

    return idx;
}

/// Remove a directory from the index.
pub fn removeDirectory(idx: u8) void {
    if (idx >= MAX_DIRECTORIES) return;
    dirs[idx].active = false;
}

// -- Build index --

/// Rebuild the entire index by scanning all registered directories.
pub fn rebuild() !void {
    entry_count = 0;
    resetStats();

    for (0..dir_count) |i| {
        const d = &dirs[i];
        if (!d.active) continue;
        d.file_count = 0;
        d.total_size = 0;

        var dir = std.fs.cwd().openDir(d.path(), .{ .iterate = true }) catch continue;
        defer dir.close();

        var walker = dir.walk(std.heap.page_allocator) catch continue;
        defer walker.deinit();

        while (walker.next() catch null) |wentry| {
            if (entry_count >= MAX_INDEX_FILES) break;
            if (wentry.kind == .directory) continue;

            const s = wentry.dir.statFile(wentry.basename) catch continue;

            var e = &entries[entry_count];

            // Name
            const nlen: u8 = @intCast(@min(wentry.basename.len, NAME_MAX));
            @memcpy(e.name_buf[0..nlen], wentry.basename[0..nlen]);
            e.name_len = nlen;

            // Relative path
            const plen: u16 = @intCast(@min(wentry.path.len, PATH_MAX));
            @memcpy(e.rel_path_buf[0..plen], wentry.path[0..plen]);
            e.rel_path_len = plen;

            // Extension
            const raw_ext = std.fs.path.extension(wentry.basename);
            // Strip leading dot
            const ext_str = if (raw_ext.len > 0 and raw_ext[0] == '.') raw_ext[1..] else raw_ext;
            const elen: u4 = @intCast(@min(ext_str.len, EXT_MAX));
            @memcpy(e.ext_buf[0..elen], ext_str[0..elen]);
            e.ext_len = elen;

            // Category
            e.category = categorize(ext_str);

            // Metadata
            e.size = s.size;
            e.mtime_ns = s.mtime;
            e.dir_idx = @intCast(i);

            // Update stats
            d.file_count += 1;
            d.total_size += s.size;
            cat_stats[@intFromEnum(e.category)].count += 1;
            cat_stats[@intFromEnum(e.category)].total_size += s.size;
            total_files += 1;
            total_size += s.size;

            entry_count += 1;
        }
    }

    built_at_ns = std.time.nanoTimestamp();
    is_built = true;
}

// -- Query --

/// Filter the index. Writes matching entries' indices to `out`. Returns count.
pub fn filter(f: Filter, out: []u16) usize {
    var count: usize = 0;

    for (0..entry_count) |i| {
        if (count >= out.len) break;
        const e = &entries[i];

        // Category filter
        if (f.category) |cat| {
            if (e.category != cat) continue;
        }

        // Directory filter
        if (f.dir_idx) |idx| {
            if (e.dir_idx != idx) continue;
        }

        // Text query (case-insensitive substring match on name)
        if (f.query) |q| {
            if (!containsInsensitive(e.name(), q)) continue;
        }

        out[count] = @intCast(i);
        count += 1;
    }

    return count;
}

/// Get an entry by index.
pub fn getEntry(idx: usize) ?*const IndexEntry {
    if (idx >= entry_count) return null;
    return &entries[idx];
}

/// Get directory info by index.
pub fn getDirInfo(idx: u8) ?*const DirInfo {
    if (idx >= dir_count) return null;
    if (!dirs[idx].active) return null;
    return &dirs[idx];
}

/// Get stats for a category.
pub fn getCategoryStats(cat: Category) CategoryStats {
    return cat_stats[@intFromEnum(cat)];
}

/// Total number of indexed files.
pub fn getTotal() struct { files: u32, size: u64 } {
    return .{ .files = total_files, .size = total_size };
}

/// Whether the index has been built.
pub fn isBuilt() bool {
    return is_built;
}

// -- Categorization --

fn categorize(ext_lower: []const u8) Category {
    // Audio
    if (eqlAny(ext_lower, &.{ "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "aiff" }))
        return .audio;

    // Video
    if (eqlAny(ext_lower, &.{ "mp4", "mkv", "avi", "mov", "wmv", "webm", "flv", "m4v" }))
        return .video;

    // Image
    if (eqlAny(ext_lower, &.{ "png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico", "tiff", "tif" }))
        return .image;

    // Document
    if (eqlAny(ext_lower, &.{ "pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "csv", "md", "epub" }))
        return .document;

    // Code
    if (eqlAny(ext_lower, &.{ "zig", "lua", "ts", "tsx", "js", "jsx", "py", "rs", "go", "c", "h", "cpp", "java", "rb", "sh", "css", "html", "json", "yaml", "toml", "xml" }))
        return .code;

    // Archive
    if (eqlAny(ext_lower, &.{ "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "zst" }))
        return .archive;

    // Font
    if (eqlAny(ext_lower, &.{ "ttf", "otf", "woff", "woff2" }))
        return .font;

    return .other;
}

fn eqlAny(s: []const u8, options: []const []const u8) bool {
    for (options) |opt| {
        if (std.ascii.eqlIgnoreCase(s, opt)) return true;
    }
    return false;
}

fn containsInsensitive(haystack: []const u8, needle: []const u8) bool {
    if (needle.len == 0) return true;
    if (needle.len > haystack.len) return false;

    var i: usize = 0;
    while (i <= haystack.len - needle.len) : (i += 1) {
        if (std.ascii.eqlIgnoreCase(haystack[i .. i + needle.len], needle)) return true;
    }
    return false;
}

// -- Tests --

test "categorize extensions" {
    try std.testing.expectEqual(Category.audio, categorize("mp3"));
    try std.testing.expectEqual(Category.video, categorize("mp4"));
    try std.testing.expectEqual(Category.image, categorize("png"));
    try std.testing.expectEqual(Category.document, categorize("pdf"));
    try std.testing.expectEqual(Category.code, categorize("zig"));
    try std.testing.expectEqual(Category.archive, categorize("zip"));
    try std.testing.expectEqual(Category.font, categorize("ttf"));
    try std.testing.expectEqual(Category.other, categorize("xyz"));
}

test "containsInsensitive" {
    try std.testing.expect(containsInsensitive("Hello World", "hello"));
    try std.testing.expect(containsInsensitive("Hello World", "WORLD"));
    try std.testing.expect(containsInsensitive("test.zig", "zig"));
    try std.testing.expect(!containsInsensitive("test.zig", "lua"));
    try std.testing.expect(containsInsensitive("anything", ""));
}

test "index and filter real files" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    // Create test files
    inline for (.{ "song.mp3", "photo.png", "readme.md", "main.zig", "data.csv" }) |name| {
        var f = try tmp.dir.createFile(name, .{});
        try f.writeAll("content");
        f.close();
    }

    var path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const tmp_path = try tmp.dir.realpath(".", &path_buf);

    init();
    defer deinit();

    _ = try addDirectory(tmp_path, "test");
    try rebuild();

    const totals = getTotal();
    try std.testing.expectEqual(@as(u32, 5), totals.files);

    // Filter by category
    var results: [64]u16 = undefined;

    const audio_count = filter(.{ .category = .audio }, &results);
    try std.testing.expectEqual(@as(usize, 1), audio_count);

    const code_count = filter(.{ .category = .code }, &results);
    try std.testing.expectEqual(@as(usize, 1), code_count);

    const doc_count = filter(.{ .category = .document }, &results);
    try std.testing.expectEqual(@as(usize, 2), doc_count); // md + csv

    // Text query
    const main_count = filter(.{ .query = "main" }, &results);
    try std.testing.expectEqual(@as(usize, 1), main_count);
    const e = getEntry(results[0]).?;
    try std.testing.expectEqualStrings("main.zig", e.name());
}

test "category stats" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();

    inline for (.{ "a.mp3", "b.mp3", "c.png" }) |name| {
        var f = try tmp.dir.createFile(name, .{});
        try f.writeAll("data");
        f.close();
    }

    var path_buf: [std.fs.max_path_bytes]u8 = undefined;
    const tmp_path = try tmp.dir.realpath(".", &path_buf);

    init();
    defer deinit();

    _ = try addDirectory(tmp_path, null);
    try rebuild();

    const audio = getCategoryStats(.audio);
    try std.testing.expectEqual(@as(u32, 2), audio.count);

    const image = getCategoryStats(.image);
    try std.testing.expectEqual(@as(u32, 1), image.count);
}
