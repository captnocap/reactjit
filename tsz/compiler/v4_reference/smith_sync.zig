const std = @import("std");

const StatusEntry = struct {
    code: []const u8,
    path: []const u8,
};

const active_files = [_][]const u8{
    "tsz/compiler/smith_LOAD_ORDER.txt",
    "tsz/compiler/smith_bundle.zig",
    "tsz/compiler/smith_sync.zig",
    "tsz/compiler/smith_DICTIONARY.md",
    "tsz/compiler/forge.zig",
    "tsz/build.zig",
    "tsz/CLAUDE.md",
};

const active_dirs = [_][]const u8{
    "tsz/compiler/smith/",
};

pub fn main() !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const args = try std.process.argsAlloc(alloc);
    if (args.len != 3) {
        std.debug.print("usage: smith_sync <repo-root> <compiler-root>\n", .{});
        return error.InvalidArguments;
    }

    const repo_root = args[1];
    const compiler_root = args[2];
    const manifest_path = try std.fs.path.join(alloc, &.{ compiler_root, "smith_LOAD_ORDER.txt" });
    const bundle_path = try std.fs.path.join(alloc, &.{ compiler_root, "dist", "smith.bundle.js" });

    const manifest_text = try std.fs.cwd().readFileAlloc(alloc, manifest_path, 1024 * 1024);
    const manifest_entries = try parseManifest(alloc, manifest_text);
    const manifest_set = try buildManifestSet(alloc, manifest_entries.items);

    var legacy_manifest_entries: std.ArrayList([]const u8) = .empty;
    defer legacy_manifest_entries.deinit(alloc);
    for (manifest_entries.items) |entry| {
        if (std.mem.startsWith(u8, entry, "smith/")) try legacy_manifest_entries.append(alloc, entry);
    }

    const git_result = try std.process.Child.run(.{
        .allocator = alloc,
        .argv = &.{ "git", "status", "--short", "--", "tsz/compiler", "tsz/build.zig", "tsz/CLAUDE.md" },
        .cwd = repo_root,
    });
    const status_entries = try parseStatus(alloc, git_result.stdout);

    var dirty_active: std.ArrayList(StatusEntry) = .empty;
    defer dirty_active.deinit(alloc);
    var dirty_legacy: std.ArrayList(StatusEntry) = .empty;
    defer dirty_legacy.deinit(alloc);
    var dirty_other: std.ArrayList(StatusEntry) = .empty;
    defer dirty_other.deinit(alloc);
    for (status_entries.items) |entry| {
        if (isActivePath(entry.path)) {
            try dirty_active.append(alloc, entry);
        } else if (isLegacyCompilerPath(entry.path)) {
            try dirty_legacy.append(alloc, entry);
        } else {
            try dirty_other.append(alloc, entry);
        }
    }

    var manifest_missing: std.ArrayList([]const u8) = .empty;
    defer manifest_missing.deinit(alloc);
    for (manifest_entries.items) |entry| {
        const source_path = try std.fs.path.join(alloc, &.{ compiler_root, entry });
        if (!fileExists(source_path)) try manifest_missing.append(alloc, entry);
    }

    var authored_js: std.ArrayList([]const u8) = .empty;
    defer authored_js.deinit(alloc);
    var compiler_dir = try std.fs.openDirAbsolute(compiler_root, .{ .iterate = true });
    defer compiler_dir.close();
    try collectJsFiles(alloc, &compiler_dir, "", &authored_js);

    var missing_from_manifest: std.ArrayList([]const u8) = .empty;
    defer missing_from_manifest.deinit(alloc);
    for (authored_js.items) |entry| {
        if (std.mem.eql(u8, entry, "dist/smith.bundle.js")) continue;
        if (!isSmithSource(entry)) continue;
        if (!manifest_set.contains(entry)) try missing_from_manifest.append(alloc, entry);
    }

    var bundle_state: []const u8 = "missing";
    var stale_bundle_sources: std.ArrayList([]const u8) = .empty;
    defer stale_bundle_sources.deinit(alloc);
    if (fileExists(bundle_path)) {
        bundle_state = "fresh";
        const bundle_stat = try std.fs.cwd().statFile(bundle_path);
        for (manifest_entries.items) |entry| {
            const source_path = try std.fs.path.join(alloc, &.{ compiler_root, entry });
            const source_stat = try std.fs.cwd().statFile(source_path);
            if (source_stat.mtime > bundle_stat.mtime) try stale_bundle_sources.append(alloc, entry);
        }
        if (stale_bundle_sources.items.len > 0) bundle_state = "stale";
    }

    const bundle_rel = try std.fs.path.relative(alloc, repo_root, bundle_path);
    const stdout = std.fs.File.stdout().deprecatedWriter();
    try stdout.print("Smith sync scan\n\n", .{});
    try stdout.print("Manifest\n", .{});
    try stdout.print("- entries: {d}\n", .{manifest_entries.items.len});
    try stdout.print("- bundle: {s} [{s}]\n", .{ bundle_rel, bundle_state });
    try printSliceGroup(stdout, "Missing manifest sources", manifest_missing.items);
    try printSliceGroup(stdout, "Authored JS missing from manifest", missing_from_manifest.items);
    try printSliceGroup(stdout, "Manifest entries still pointing at legacy smith/ paths", legacy_manifest_entries.items);
    try printSliceGroup(stdout, "Bundle stale against", stale_bundle_sources.items);
    try stdout.print("\n", .{});
    try printStatusGroup(stdout, "Dirty active Smith files", dirty_active.items);
    try printStatusGroup(stdout, "Dirty legacy smith/ files", dirty_legacy.items);
    try printStatusGroup(stdout, "Other dirty compiler files", dirty_other.items);

    if (manifest_missing.items.len > 0 or missing_from_manifest.items.len > 0 or legacy_manifest_entries.items.len > 0) {
        std.process.exit(1);
    }
}

fn parseManifest(alloc: std.mem.Allocator, text: []const u8) !std.ArrayList([]const u8) {
    var out: std.ArrayList([]const u8) = .empty;
    var lines = std.mem.splitScalar(u8, text, '\n');
    while (lines.next()) |raw_line| {
        const line = std.mem.trim(u8, raw_line, " \t\r");
        if (line.len == 0 or line[0] == '#') continue;
        try out.append(alloc, line);
    }
    return out;
}

fn buildManifestSet(alloc: std.mem.Allocator, entries: []const []const u8) !std.StringHashMap(void) {
    var out = std.StringHashMap(void).init(alloc);
    for (entries) |entry| try out.put(entry, {});
    return out;
}

fn parseStatus(alloc: std.mem.Allocator, text: []const u8) !std.ArrayList(StatusEntry) {
    var out: std.ArrayList(StatusEntry) = .empty;
    var lines = std.mem.splitScalar(u8, text, '\n');
    while (lines.next()) |line| {
        if (line.len < 4) continue;
        try out.append(alloc, .{
            .code = line[0..2],
            .path = line[3..],
        });
    }
    return out;
}

fn collectJsFiles(
    alloc: std.mem.Allocator,
    dir: *std.fs.Dir,
    prefix: []const u8,
    out: *std.ArrayList([]const u8),
) !void {
    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        switch (entry.kind) {
            .directory => {
                const next_prefix = if (prefix.len == 0)
                    try alloc.dupe(u8, entry.name)
                else
                    try std.fmt.allocPrint(alloc, "{s}/{s}", .{ prefix, entry.name });
                var child = try dir.openDir(entry.name, .{ .iterate = true });
                defer child.close();
                try collectJsFiles(alloc, &child, next_prefix, out);
            },
            .file => {
                if (!std.mem.endsWith(u8, entry.name, ".js")) continue;
                const rel = if (prefix.len == 0)
                    try alloc.dupe(u8, entry.name)
                else
                    try std.fmt.allocPrint(alloc, "{s}/{s}", .{ prefix, entry.name });
                try out.append(alloc, rel);
            },
            else => {},
        }
    }
}

fn fileExists(path: []const u8) bool {
    std.fs.cwd().access(path, .{}) catch return false;
    return true;
}

fn isActivePath(rel_path: []const u8) bool {
    inline for (active_files) |entry| {
        if (std.mem.eql(u8, rel_path, entry)) return true;
    }
    inline for (active_dirs) |entry| {
        if (std.mem.startsWith(u8, rel_path, entry)) return true;
    }
    return false;
}

fn isLegacyCompilerPath(rel_path: []const u8) bool {
    // Legacy paths are the old flat smith_*.js at compiler root
    if (!std.mem.startsWith(u8, rel_path, "tsz/compiler/")) return false;
    const after = rel_path["tsz/compiler/".len..];
    return std.mem.startsWith(u8, after, "smith_") and std.mem.endsWith(u8, after, ".js");
}

fn isSmithSource(rel_path: []const u8) bool {
    return std.mem.startsWith(u8, rel_path, "smith/");
}

fn printSliceGroup(writer: anytype, title: []const u8, items: []const []const u8) !void {
    try writer.print("{s}\n", .{title});
    if (items.len == 0) {
        try writer.print("- none\n", .{});
        return;
    }
    for (items) |entry| try writer.print("- {s}\n", .{entry});
}

fn printStatusGroup(writer: anytype, title: []const u8, items: []const StatusEntry) !void {
    try writer.print("{s}\n", .{title});
    if (items.len == 0) {
        try writer.print("- none\n", .{});
        return;
    }
    for (items) |entry| try writer.print("- {s} {s}\n", .{ entry.code, entry.path });
}
