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
        // Skip nested maps — they're chained below
        if (self.maps[mi].parent_map_idx >= 0) continue;
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}_rebuildMap{d}();\n", .{ pad, mi }));
    }
    // Chain nested map pools: call parameterized rebuild per outer item
    for (0..self.map_count) |mi| {
        const m = self.maps[mi];
        if (m.parent_map_idx < 0) continue;
        const pmi: u32 = @intCast(m.parent_map_idx);
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}for (0.._map_count_{d}) |_ci| {{\n" ++
            "{s}    _rebuildMap{d}(_ci);\n" ++
            "{s}    _map_inner_{d}[_ci][{d}].children = _map_pool_{d}[_ci][0.._map_count_{d}[_ci]];\n" ++
            "{s}}}\n",
            .{ pad, pmi,
               pad, mi,
               pad, pmi, m.parent_inner_idx, mi, mi,
               pad }));
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

/// Recursively emit static array declarations for deep leaf children (depth > 3).
/// Both functions traverse the tree in the same depth-first order with the same seq
/// counter, so declaration names match rebuild references.
/// Returns the array name for this children group.
pub fn emitDeepNodeDecls(
    self: *Generator,
    out: *std.ArrayListUnmanaged(u8),
    mi: u32,
    children: []const codegen.MapLeafNode,
    item_param: []const u8,
    index_param: ?[]const u8,
    seq: *u32,
) ![]const u8 {
    _ = item_param;
    _ = index_param;
    const my_seq = seq.*;
    seq.* += 1;
    const arr_name = try std.fmt.allocPrint(self.alloc, "_map_dn_{d}_{d}", .{ mi, my_seq });

    // Declare the node array
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "var {s}: [MAX_MAP_{d}][{d}]Node = undefined;\n", .{ arr_name, mi, children.len }));

    for (children, 0..) |child, ci_raw| {
        const ci: u32 = @intCast(ci_raw);

        // Text buffer declarations for dynamic text
        if (child.is_dynamic_text) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "var _map_dtb_{d}_{d}_{d}: [MAX_MAP_{d}][256]u8 = undefined;\n" ++
                "var _map_dtx_{d}_{d}_{d}: [MAX_MAP_{d}][]const u8 = undefined;\n",
                .{ mi, my_seq, ci, mi, mi, my_seq, ci, mi }));
        }

        // Handler factory for pressable children
        if (child.handler_body.len > 0) {
            const body_uses_i = std.mem.indexOf(u8, child.handler_body, "_i") != null;
            const i_decl: []const u8 = if (body_uses_i) "        const _i = _map_ci;\n" else "        _ = _map_ci;\n";
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "fn _mapDnPress_{d}_{d}_{d}(comptime _map_ci: usize) *const fn () void {{\n" ++
                "    return &struct {{ fn handler() void {{\n{s}{s}" ++
                "        state.markDirty();\n    }} }}.handler;\n}}\n" ++
                "const _map_dn_h_{d}_{d}_{d}: [MAX_MAP_{d}]*const fn () void = blk_dn{d}_{d}_{d}: {{\n" ++
                "    @setEvalBranchQuota(100000);\n" ++
                "    var _h: [MAX_MAP_{d}]*const fn () void = undefined;\n" ++
                "    for (0..MAX_MAP_{d}) |_ci| {{ _h[_ci] = _mapDnPress_{d}_{d}_{d}(_ci); }}\n" ++
                "    break :blk_dn{d}_{d}_{d} _h;\n}};\n",
                .{ mi, my_seq, ci, i_decl, child.handler_body,
                   mi, my_seq, ci, mi, mi, my_seq, ci,
                   mi, mi, mi, my_seq, ci, mi, my_seq, ci }));
        }

        // Recurse into child's children
        if (child.children.len > 0) {
            _ = try emitDeepNodeDecls(self, out, mi, child.children, "", null, seq);
        }
    }

    return arr_name;
}

/// Recursively emit rebuild code for deep leaf children.
/// Must be called with the same seq counter start value as emitDeepNodeDecls.
/// Returns the array name for this children group.
pub fn emitDeepNodeRebuild(
    self: *Generator,
    out: *std.ArrayListUnmanaged(u8),
    mi: u32,
    children: []const codegen.MapLeafNode,
    item_param: []const u8,
    index_param: ?[]const u8,
    seq: *u32,
) ![]const u8 {
    const my_seq = seq.*;
    seq.* += 1;
    const arr_name = try std.fmt.allocPrint(self.alloc, "_map_dn_{d}_{d}", .{ mi, my_seq });

    // First pass: text formatting and recursive children (so deeper arrays are filled first)
    var child_arr_names: [32][]const u8 = undefined;
    for (&child_arr_names) |*n| n.* = "";

    for (children, 0..) |child, ci_raw| {
        const ci: u32 = @intCast(ci_raw);

        // Text buffer fill for dynamic text
        if (child.is_dynamic_text) {
            const rw_args = try rewriteMapArgs(self, child.text_args, item_param, index_param);
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "        _map_dtx_{d}_{d}_{d}[_i] = std.fmt.bufPrint(&_map_dtb_{d}_{d}_{d}[_i], \"{s}\", .{{ {s} }}) catch \"\";\n",
                .{ mi, my_seq, ci, mi, my_seq, ci, child.text_fmt, rw_args }));
        }

        // Recurse into child's children
        if (child.children.len > 0 and ci_raw < 32) {
            child_arr_names[ci_raw] = try emitDeepNodeRebuild(self, out, mi, child.children, item_param, index_param, seq);
        }
    }

    // Build this level's array
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        {s}[_i] = [{d}]Node{{ ", .{ arr_name, children.len }));

    for (children, 0..) |child, ci_raw| {
        const ci: u32 = @intCast(ci_raw);
        if (ci_raw > 0) try out.appendSlice(self.alloc, ", ");
        try out.appendSlice(self.alloc, ".{ ");
        var f = false;

        // Text
        if (child.is_dynamic_text) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".text = _map_dtx_{d}_{d}_{d}[_i]", .{ mi, my_seq, ci }));
            f = true;
        } else if (child.static_text.len > 0) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".text = \"{s}\"", .{child.static_text}));
            f = true;
        }
        // Font size
        if (child.font_size.len > 0) {
            if (f) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".font_size = {s}", .{child.font_size}));
            f = true;
        }
        // Text color
        if (child.text_color.len > 0) {
            if (f) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".text_color = {s}", .{child.text_color}));
            f = true;
        }
        // Style (+ display_cond)
        if (child.style.len > 0 or child.display_cond.len > 0) {
            if (f) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, ".style = .{ ");
            if (child.style.len > 0) try out.appendSlice(self.alloc, child.style);
            if (child.display_cond.len > 0) {
                if (child.style.len > 0) try out.appendSlice(self.alloc, ", ");
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    ".display = if ({s}) .flex else .none", .{child.display_cond}));
            }
            try out.appendSlice(self.alloc, " }");
            f = true;
        }
        // Children pointer
        if (ci_raw < 32 and child_arr_names[ci_raw].len > 0) {
            if (f) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".children = &{s}[_i]", .{child_arr_names[ci_raw]}));
            f = true;
        }
        // Handler
        if (child.handler_body.len > 0) {
            if (f) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                ".handlers = .{{ .on_press = _map_dn_h_{d}_{d}_{d}[_i] }}", .{ mi, my_seq, ci }));
        }
        try out.appendSlice(self.alloc, " }");
    }
    try out.appendSlice(self.alloc, " };\n");

    return arr_name;
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
