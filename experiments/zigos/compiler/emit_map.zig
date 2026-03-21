//! Map + test helpers extracted from emit.zig for file length compliance.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;

/// Emit _rebuildComputedN() + _rebuildMapN() calls (used in _appInit and _appTick).
pub fn emitMapRebuildCalls(self: *Generator, out: *std.ArrayListUnmanaged(u8), pad: []const u8) !void {
    for (0..self.computed_count) |ci| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}_rebuildComputed{d}();\n", .{ pad, ci }));
    }
    for (0..self.map_count) |mi| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}_rebuildMap{d}();\n", .{ pad, mi }));
    }
}

/// Rewrite template args: replace item/index param names with _item/_i.
/// E.g. if item_param is "task" and text_args is "@intCast(task)",
/// we need to emit "@intCast(_item)" so the generated for-loop variable works.
pub fn rewriteMapArgs(self: *Generator, text_args: []const u8, item_param: []const u8, index_param: ?[]const u8) ![]const u8 {
    var result: []const u8 = text_args;
    // Replace item param with _item
    if (item_param.len > 0) {
        result = try replaceIdent(self.alloc, result, item_param, "_item");
    }
    // Replace index param with _i
    if (index_param) |idx| {
        if (idx.len > 0) {
            result = try replaceIdent(self.alloc, result, idx, "_i");
        }
    }
    return result;
}

/// Replace whole-word occurrences of `needle` with `replacement` in `text`.
/// Only replaces when needle is at a word boundary (not inside an identifier).
pub fn replaceIdent(alloc: std.mem.Allocator, text: []const u8, needle: []const u8, replacement: []const u8) ![]const u8 {
    if (needle.len == 0 or text.len < needle.len) return text;
    var result: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;
    while (i <= text.len - needle.len) {
        if (std.mem.eql(u8, text[i .. i + needle.len], needle)) {
            // Check word boundary before
            const before_ok = i == 0 or !isIdentByte(text[i - 1]);
            // Check word boundary after
            const after_ok = (i + needle.len >= text.len) or !isIdentByte(text[i + needle.len]);
            if (before_ok and after_ok) {
                try result.appendSlice(alloc, replacement);
                i += needle.len;
                continue;
            }
        }
        try result.append(alloc, text[i]);
        i += 1;
    }
    // Append remaining bytes
    if (i < text.len) {
        try result.appendSlice(alloc, text[i..]);
    }
    return result.items;
}

pub fn isIdentByte(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
}

/// Scan <zscript> contents for `fn test_*` function definitions and emit
/// testharness.register() calls for each one in _appInit.
pub fn emitTestRegistrations(self: *Generator, out: *std.ArrayListUnmanaged(u8), zig_code: []const u8) !void {
    // Scan for "fn test_" patterns
    const needle = "fn test_";
    var i: usize = 0;
    var found_any = false;
    while (i + needle.len < zig_code.len) : (i += 1) {
        if (std.mem.eql(u8, zig_code[i .. i + needle.len], needle)) {
            // Check word boundary before "fn"
            if (i > 0 and isIdentByte(zig_code[i - 1])) continue;

            // Extract function name: fn test_foo(
            const name_start = i + 3; // skip "fn "
            var name_end = name_start;
            while (name_end < zig_code.len and isIdentByte(zig_code[name_end])) name_end += 1;
            const func_name = zig_code[name_start..name_end];

            if (func_name.len > 0) {
                if (!found_any) {
                    try out.appendSlice(self.alloc, "    // Auto-registered tests from <zscript>\n");
                    found_any = true;
                }
                // Convert test_foo_bar to "foo bar" for display
                const display_name = try testDisplayName(self.alloc, func_name);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    testharness.register(\"{s}\", {s});\n", .{ display_name, func_name }));
            }
        }
    }
}

/// Convert "test_map_renders_items" → "map renders items" for test display.
pub fn testDisplayName(alloc: std.mem.Allocator, name: []const u8) ![]const u8 {
    // Strip "test_" prefix
    const stripped = if (std.mem.startsWith(u8, name, "test_")) name[5..] else name;
    var result: std.ArrayListUnmanaged(u8) = .{};
    for (stripped) |ch| {
        try result.append(alloc, if (ch == '_') ' ' else ch);
    }
    return result.items;
}
