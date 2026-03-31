//! Minimal template engine for Zig source emission.
//!
//! Replaces hundreds of appendSlice + allocPrint calls in emit.zig with
//! structured template rendering. Templates are comptime strings with:
//!   {{field}}               — variable substitution from a values struct
//!   {{#if field}}...{{/if}}   — conditional block (field must be bool)
//!   {{#not field}}...{{/not}} — negated conditional
//!
//! Double-brace delimiters avoid conflicts with Zig source code braces.
//! Single `{` and `}` pass through as literal characters.

const std = @import("std");

/// Render a template with variable substitution and conditional blocks.
///
/// `tmpl` is a comptime string. `values` is a struct whose fields are
/// either `[]const u8` (for substitution) or `bool` (for conditionals).
pub fn render(alloc: std.mem.Allocator, comptime tmpl: []const u8, values: anytype) ![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};

    comptime var i: usize = 0;
    inline while (i < tmpl.len) {
        if (i + 1 < tmpl.len and tmpl[i] == '{' and tmpl[i + 1] == '{') {
            // {{#if field}}...{{/if}}
            if (comptime startsWith(tmpl[i..], "{{#if ")) {
                const field_start = i + 6;
                const field_end = comptime indexOfStr(tmpl[field_start..], "}}") orelse @compileError("unclosed {{#if}}");
                const field_name = tmpl[field_start .. field_start + field_end];
                const end_tag = "{{/if}}";
                const block_end = comptime indexOfStr(tmpl[field_start + field_end + 2 ..], end_tag) orelse @compileError("missing {{/if}}");
                const content_start = field_start + field_end + 2;
                const block_content = tmpl[content_start .. content_start + block_end];

                if (@field(values, field_name)) {
                    try out.appendSlice(alloc, try render(alloc, block_content, values));
                }
                i = content_start + block_end + end_tag.len;
            }
            // {{#not field}}...{{/not}}
            else if (comptime startsWith(tmpl[i..], "{{#not ")) {
                const field_start = i + 7;
                const field_end = comptime indexOfStr(tmpl[field_start..], "}}") orelse @compileError("unclosed {{#not}}");
                const field_name = tmpl[field_start .. field_start + field_end];
                const end_tag = "{{/not}}";
                const block_end = comptime indexOfStr(tmpl[field_start + field_end + 2 ..], end_tag) orelse @compileError("missing {{/not}}");
                const content_start = field_start + field_end + 2;
                const block_content = tmpl[content_start .. content_start + block_end];

                if (!@field(values, field_name)) {
                    try out.appendSlice(alloc, try render(alloc, block_content, values));
                }
                i = content_start + block_end + end_tag.len;
            }
            // {{field}} — variable substitution
            else {
                const field_end = comptime indexOfStr(tmpl[i + 2 ..], "}}") orelse @compileError("unclosed {{field}}");
                const field_name = tmpl[i + 2 .. i + 2 + field_end];
                try out.appendSlice(alloc, @field(values, field_name));
                i = i + 2 + field_end + 2;
            }
        } else {
            // Literal character — batch copy until next '{{'
            const next = comptime indexOfDoubleBrace(tmpl[i..]);
            if (next) |nb| {
                try out.appendSlice(alloc, tmpl[i .. i + nb]);
                i += nb;
            } else {
                try out.appendSlice(alloc, tmpl[i..]);
                i = tmpl.len;
            }
        }
    }

    return try alloc.dupe(u8, out.items);
}

// ── Comptime helpers ──

fn startsWith(comptime hay: []const u8, comptime needle: []const u8) bool {
    if (hay.len < needle.len) return false;
    return std.mem.eql(u8, hay[0..needle.len], needle);
}

fn indexOfStr(comptime hay: []const u8, comptime needle: []const u8) ?usize {
    var j: usize = 0;
    while (j + needle.len <= hay.len) : (j += 1) {
        if (std.mem.eql(u8, hay[j .. j + needle.len], needle)) return j;
    }
    return null;
}

fn indexOfDoubleBrace(comptime hay: []const u8) ?usize {
    var j: usize = 0;
    while (j + 1 < hay.len) : (j += 1) {
        if (hay[j] == '{' and hay[j + 1] == '{') return j;
    }
    return null;
}

// ── Tests ──
// Uses ArenaAllocator to match real compiler usage (bulk-free, no individual deallocs).

fn testArena() std.heap.ArenaAllocator {
    return std.heap.ArenaAllocator.init(std.testing.allocator);
}

test "variable substitution" {
    var arena = testArena();
    defer arena.deinit();
    const result = try render(arena.allocator(),
        \\const {{mod}} = @import("{{path}}");
    , .{ .mod = "layout", .path = "framework/layout.zig" });
    try std.testing.expectEqualStrings(
        \\const layout = @import("framework/layout.zig");
    , result);
}

test "conditional block" {
    var arena = testArena();
    defer arena.deinit();
    const result = try render(arena.allocator(),
        \\const std = @import("std");
        \\{{#if has_state}}const state = @import("state.zig");
        \\{{/if}}{{#if has_theme}}const Theme = @import("theme.zig");
        \\{{/if}}
    , .{ .has_state = true, .has_theme = false });
    try std.testing.expectEqualStrings(
        \\const std = @import("std");
        \\const state = @import("state.zig");
        \\
    , result);
}

test "negated conditional with Zig braces" {
    var arena = testArena();
    defer arena.deinit();
    const result = try render(arena.allocator(),
        \\{{#not is_lib}}fn main() void {}
        \\{{/not}}
    , .{ .is_lib = false });
    try std.testing.expectEqualStrings(
        \\fn main() void {}
        \\
    , result);
}

test "literal braces pass through" {
    var arena = testArena();
    defer arena.deinit();
    const result = try render(arena.allocator(),
        \\const x = struct {};
        \\const y = .{ .a = 1 };
    , .{});
    try std.testing.expectEqualStrings(
        \\const x = struct {};
        \\const y = .{ .a = 1 };
    , result);
}

test "mixed vars and Zig braces" {
    var arena = testArena();
    defer arena.deinit();
    const result = try render(arena.allocator(),
        \\const {{name}} = struct { pub fn call() void {} };
    , .{ .name = "MyStruct" });
    try std.testing.expectEqualStrings(
        \\const MyStruct = struct { pub fn call() void {} };
    , result);
}
