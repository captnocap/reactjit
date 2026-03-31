//! Compute block extraction and setter rewriting — JS/Lua/Zscript transforms.
//!
//! Extracted from collect.zig. Handles <script> extraction, __setState rewriting,
//! and JS→Lua fallback conversion.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;

pub fn extractComputeBlock(self: *Generator) void {
    const src = self.source;

    // JavaScript <script> blocks
    var js_parts: std.ArrayListUnmanaged(u8) = .{};
    scanTagContent(self.alloc, src, "<script>", "</script>", &js_parts);
    if (js_parts.items.len > 0) {
        if (self.compute_js) |existing| {
            const combined = std.fmt.allocPrint(self.alloc, "{s}\n{s}", .{ existing, js_parts.items }) catch return;
            self.compute_js = combined;
        } else {
            self.compute_js = self.alloc.dupe(u8, js_parts.items) catch return;
        }
    }

    // Lua <lscript> blocks
    var lua_parts: std.ArrayListUnmanaged(u8) = .{};
    scanTagContent(self.alloc, src, "<lscript>", "</lscript>", &lua_parts);
    if (lua_parts.items.len > 0) {
        if (self.compute_lua) |existing| {
            const combined = std.fmt.allocPrint(self.alloc, "{s}\n{s}", .{ existing, lua_parts.items }) catch return;
            self.compute_lua = combined;
        } else {
            self.compute_lua = self.alloc.dupe(u8, lua_parts.items) catch return;
        }
    }

    // Do not synthesize Lua from JS <script>. The old line-based fallback
    // produced invalid Lua for normal JS syntax and failed during app startup.
}

/// Legacy JS→Lua fallback kept for reference only.
/// It is intentionally not wired into extractComputeBlock because modern JS script
/// blocks routinely use syntax this line-based rewrite cannot translate safely.
fn jsToLuaFallback(alloc: std.mem.Allocator, js: []const u8) ?[]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    result.appendSlice(alloc, "-- Auto-generated Lua fallback from <script>\n") catch return null;

    var line_iter = std.mem.splitScalar(u8, js, '\n');
    while (line_iter.next()) |raw_line| {
        const line = std.mem.trim(u8, raw_line, &[_]u8{ '\r' });
        const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t' });

        // Comment lines: // → --
        if (std.mem.startsWith(u8, trimmed, "//")) {
            result.appendSlice(alloc, "--") catch {};
            result.appendSlice(alloc, trimmed[2..]) catch {};
            result.append(alloc, '\n') catch {};
            continue;
        }

        // Skip useState lines (handled by framework)
        if (std.mem.indexOf(u8, trimmed, "useState(") != null) continue;

        // Empty lines
        if (trimmed.len == 0) {
            result.append(alloc, '\n') catch {};
            continue;
        }

        // Lone closing brace → end
        if (std.mem.eql(u8, trimmed, "}")) {
            result.appendSlice(alloc, "end\n") catch {};
            continue;
        }

        // function declaration: function foo(...) { → function foo(...)
        if (std.mem.startsWith(u8, trimmed, "function ")) {
            var fn_line = trimmed;
            // Strip trailing {
            if (fn_line.len > 0 and fn_line[fn_line.len - 1] == '{') {
                fn_line = std.mem.trimRight(u8, fn_line[0 .. fn_line.len - 1], &[_]u8{ ' ', '\t' });
            }
            // Strip trailing )  and re-add without {
            result.appendSlice(alloc, fn_line) catch {};
            result.append(alloc, '\n') catch {};
            continue;
        }

        // } else if (...) { → elseif ... then
        if (std.mem.startsWith(u8, trimmed, "} else if ") or std.mem.startsWith(u8, trimmed, "} else if(")) {
            const after = if (std.mem.startsWith(u8, trimmed, "} else if ("))
                trimmed["} else if (".len..]
            else if (std.mem.startsWith(u8, trimmed, "} else if("))
                trimmed["} else if(".len..]
            else
                trimmed["} else if ".len..];
            // Strip trailing ) {
            var cond = after;
            if (cond.len > 0 and cond[cond.len - 1] == '{') {
                cond = std.mem.trimRight(u8, cond[0 .. cond.len - 1], &[_]u8{ ' ', '\t' });
            }
            if (cond.len > 0 and cond[cond.len - 1] == ')') {
                cond = cond[0 .. cond.len - 1];
            }
            result.appendSlice(alloc, "elseif ") catch {};
            appendLuaExpr(alloc, &result, cond);
            result.appendSlice(alloc, " then\n") catch {};
            continue;
        }

        // } else { → else
        if (std.mem.eql(u8, trimmed, "} else {")) {
            result.appendSlice(alloc, "else\n") catch {};
            continue;
        }

        // if (...) { → if ... then   OR   if (...) stmt; → if ... then stmt end
        if (std.mem.startsWith(u8, trimmed, "if ") or std.mem.startsWith(u8, trimmed, "if(")) {
            const after = if (std.mem.startsWith(u8, trimmed, "if ("))
                trimmed["if (".len..]
            else if (std.mem.startsWith(u8, trimmed, "if("))
                trimmed["if(".len..]
            else
                trimmed["if ".len..];
            // Check if multi-line (ends with {) or single-line
            if (after.len > 0 and after[after.len - 1] == '{') {
                // Multi-line: if (cond) {
                var cond = std.mem.trimRight(u8, after[0 .. after.len - 1], &[_]u8{ ' ', '\t' });
                if (cond.len > 0 and cond[cond.len - 1] == ')') cond = cond[0 .. cond.len - 1];
                result.appendSlice(alloc, "if ") catch {};
                appendLuaExpr(alloc, &result, cond);
                result.appendSlice(alloc, " then\n") catch {};
            } else {
                // Single-line: if (cond) stmt;
                // Find the closing ) that ends the condition
                var depth: u32 = 1; // we're past the opening (
                var ci: usize = 0;
                while (ci < after.len and depth > 0) : (ci += 1) {
                    if (after[ci] == '(') depth += 1;
                    if (after[ci] == ')') depth -= 1;
                }
                if (ci > 0 and depth == 0) {
                    const cond = after[0 .. ci - 1];
                    const stmt = std.mem.trim(u8, after[ci..], &[_]u8{ ' ', '\t' });
                    result.appendSlice(alloc, "if ") catch {};
                    appendLuaExpr(alloc, &result, cond);
                    result.appendSlice(alloc, " then ") catch {};
                    appendLuaLine(alloc, &result, stmt);
                    result.appendSlice(alloc, "end\n") catch {};
                } else {
                    // Can't parse — emit as-is with comment
                    result.appendSlice(alloc, "-- [fallback] ") catch {};
                    result.appendSlice(alloc, trimmed) catch {};
                    result.append(alloc, '\n') catch {};
                }
            }
            continue;
        }

        // var/let/const x = ...; → local x = ...
        if (std.mem.startsWith(u8, trimmed, "var ") or
            std.mem.startsWith(u8, trimmed, "let ") or
            std.mem.startsWith(u8, trimmed, "const "))
        {
            const rest = if (std.mem.startsWith(u8, trimmed, "const "))
                trimmed["const ".len..]
            else
                trimmed[4..]; // "var " or "let "
            result.appendSlice(alloc, "local ") catch {};
            appendLuaLine(alloc, &result, rest);
            continue;
        }

        // Default: copy line, strip trailing semicolons, fix operators
        appendLuaLine(alloc, &result, trimmed);
    }

    if (result.items.len == 0) return null;
    return result.items;
}

/// Append a JS expression with Lua operator fixes (===, !==, !, [])
/// Skips string literals to avoid mangling content inside quotes.
fn appendLuaExpr(alloc: std.mem.Allocator, out: *std.ArrayListUnmanaged(u8), expr: []const u8) void {
    var i: usize = 0;
    while (i < expr.len) {
        // Skip string literals
        if (expr[i] == '\'' or expr[i] == '"') {
            const quote = expr[i];
            out.append(alloc, quote) catch {};
            i += 1;
            while (i < expr.len and expr[i] != quote) {
                if (expr[i] == '\\' and i + 1 < expr.len) {
                    out.append(alloc, expr[i]) catch {};
                    out.append(alloc, expr[i + 1]) catch {};
                    i += 2;
                } else {
                    out.append(alloc, expr[i]) catch {};
                    i += 1;
                }
            }
            if (i < expr.len) {
                out.append(alloc, expr[i]) catch {};
                i += 1;
            }
            continue;
        }
        // === → ==
        if (i + 2 < expr.len and expr[i] == '=' and expr[i + 1] == '=' and expr[i + 2] == '=') {
            out.appendSlice(alloc, "==") catch {};
            i += 3;
        // !== → ~=
        } else if (i + 2 < expr.len and expr[i] == '!' and expr[i + 1] == '=' and expr[i + 2] == '=') {
            out.appendSlice(alloc, "~=") catch {};
            i += 3;
        // != → ~=
        } else if (i + 1 < expr.len and expr[i] == '!' and expr[i + 1] == '=') {
            out.appendSlice(alloc, "~=") catch {};
            i += 2;
        // ! (not followed by =) → not
        } else if (expr[i] == '!' and (i + 1 >= expr.len or expr[i + 1] != '=')) {
            out.appendSlice(alloc, "not ") catch {};
            i += 1;
        // [] → {}
        } else if (i + 1 < expr.len and expr[i] == '[' and expr[i + 1] == ']') {
            out.appendSlice(alloc, "{}") catch {};
            i += 2;
        } else {
            out.append(alloc, expr[i]) catch {};
            i += 1;
        }
    }
}

/// Append a JS line with Lua fixes: strip semicolons, fix operators, rewrite JS-isms
fn appendLuaLine(alloc: std.mem.Allocator, out: *std.ArrayListUnmanaged(u8), line: []const u8) void {
    var clean = line;
    // Strip trailing semicolons
    while (clean.len > 0 and clean[clean.len - 1] == ';') {
        clean = clean[0 .. clean.len - 1];
    }
    clean = std.mem.trimRight(u8, clean, &[_]u8{ ' ', '\t' });

    // Rewrite JS method calls to __tsl.* before operator fixes
    const rewritten = rewriteJsMethodCalls(alloc, clean);
    appendLuaExpr(alloc, out, rewritten);
    out.append(alloc, '\n') catch {};
}

/// Rewrite JS method calls to __tsl.* equivalents:
///   arr.push(val)    → __tsl.push(arr, val)
///   arr.map(fn)      → __tsl.map(arr, fn)
///   arr.filter(fn)   → __tsl.filter(arr, fn)
///   arr.find(fn)     → __tsl.find(arr, fn)
///   arr.forEach(fn)  → __tsl.forEach(arr, fn)
///   arr.indexOf(val) → __tsl.indexOf(arr, val)
///   arr.includes(val)→ __tsl.includes(arr, val)
///   arr.join(sep)    → __tsl.join(arr, sep)
///   arr.slice(a,b)   → __tsl.slice(arr, a, b)
///   arr.length       → #arr
///   str.trim()       → __tsl.trim(str)
///   str.split(sep)   → __tsl.split(str, sep)
///   x ? a : b        → (x and a or b)  [simple cases only]
fn rewriteJsMethodCalls(alloc: std.mem.Allocator, line: []const u8) []const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;

    while (i < line.len) {
        // Skip string literals
        if (line[i] == '\'' or line[i] == '"') {
            const quote = line[i];
            result.append(alloc, quote) catch {};
            i += 1;
            while (i < line.len and line[i] != quote) {
                if (line[i] == '\\' and i + 1 < line.len) {
                    result.append(alloc, line[i]) catch {};
                    result.append(alloc, line[i + 1]) catch {};
                    i += 2;
                } else {
                    result.append(alloc, line[i]) catch {};
                    i += 1;
                }
            }
            if (i < line.len) {
                result.append(alloc, line[i]) catch {};
                i += 1;
            }
            continue;
        }

        // Check for .method( patterns
        if (line[i] == '.' and i > 0 and i + 1 < line.len) {
            const methods = [_]struct { js: []const u8, tsl: []const u8 }{
                .{ .js = "push(", .tsl = "push" },
                .{ .js = "map(", .tsl = "map" },
                .{ .js = "filter(", .tsl = "filter" },
                .{ .js = "find(", .tsl = "find" },
                .{ .js = "forEach(", .tsl = "forEach" },
                .{ .js = "indexOf(", .tsl = "indexOf" },
                .{ .js = "includes(", .tsl = "includes" },
                .{ .js = "join(", .tsl = "join" },
                .{ .js = "slice(", .tsl = "slice" },
                .{ .js = "reduce(", .tsl = "reduce" },
                .{ .js = "trim(", .tsl = "trim" },
                .{ .js = "split(", .tsl = "split" },
                .{ .js = "startsWith(", .tsl = "startsWith" },
                .{ .js = "endsWith(", .tsl = "endsWith" },
                .{ .js = "toUpperCase(", .tsl = "toUpperCase" },
                .{ .js = "toLowerCase(", .tsl = "toLowerCase" },
            };

            var matched_method = false;
            for (methods) |m| {
                if (i + 1 + m.js.len <= line.len and
                    std.mem.eql(u8, line[i + 1 .. i + 1 + m.js.len], m.js))
                {
                    // Extract the receiver — last identifier before the dot
                    const id_end = result.items.len;
                    var id_start = id_end;
                    // Walk back past closing parens/brackets for chained calls
                    while (id_start > 0 and isIdentByte(result.items[id_start - 1])) {
                        id_start -= 1;
                    }
                    const receiver = if (id_start < id_end)
                        alloc.dupe(u8, result.items[id_start..id_end]) catch ""
                    else
                        alloc.dupe(u8, result.items) catch "";
                    const prefix = if (id_start < id_end) id_start else 0;
                    result.items.len = prefix;
                    result.appendSlice(alloc, "__tsl.") catch {};
                    result.appendSlice(alloc, m.tsl) catch {};
                    result.append(alloc, '(') catch {};
                    result.appendSlice(alloc, receiver) catch {};
                    result.appendSlice(alloc, ", ") catch {};
                    i += 1 + m.js.len; // skip .method(
                    matched_method = true;
                    break;
                }
            }
            if (matched_method) continue;

            // .length → #identifier (only the last identifier before the dot)
            if (i + 7 <= line.len and std.mem.eql(u8, line[i + 1 .. i + 7], "length")) {
                if (i + 7 >= line.len or !isIdentByte(line[i + 7])) {
                    // Find the start of the identifier before the dot
                    const id_end_l = result.items.len;
                    var id_start_l = id_end_l;
                    while (id_start_l > 0 and isIdentByte(result.items[id_start_l - 1])) {
                        id_start_l -= 1;
                    }
                    if (id_start_l < id_end_l) {
                        const ident = alloc.dupe(u8, result.items[id_start_l..id_end_l]) catch "";
                        result.items.len = id_start_l;
                        result.append(alloc, '#') catch {};
                        result.appendSlice(alloc, ident) catch {};
                    }
                    i += 7; // skip .length
                    continue;
                }
            }
        }

        // Simple ternary: x ? a : b → (x and a or b)
        // Only handle when ? is surrounded by spaces (avoid ?. optional chaining)
        if (line[i] == '?' and i > 0 and i + 1 < line.len and
            line[i - 1] == ' ' and line[i + 1] == ' ')
        {
            result.appendSlice(alloc, "and ") catch {};
            i += 2; // skip ? and space
            continue;
        }

        // : in ternary context (after we've seen "and") → or
        // This is imprecise but handles simple x ? a : b cases
        if (line[i] == ':' and i > 0 and i + 1 < line.len and
            line[i - 1] == ' ' and line[i + 1] == ' ')
        {
            // Check if we're inside what looks like a ternary (has "and" before this)
            if (std.mem.indexOf(u8, result.items, " and ") != null) {
                result.appendSlice(alloc, "or ") catch {};
                i += 2; // skip : and space
                continue;
            }
        }

        result.append(alloc, line[i]) catch {};
        i += 1;
    }

    if (result.items.len == 0) return line;
    return result.items;
}

fn isIdentByte(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
}

fn scanTagContent(alloc: std.mem.Allocator, src: []const u8, open_tag: []const u8, close_tag: []const u8, parts: *std.ArrayListUnmanaged(u8)) void {
    var i: usize = 0;
    while (i + open_tag.len <= src.len) : (i += 1) {
        if (std.mem.eql(u8, src[i .. i + open_tag.len], open_tag)) {
            // Only match tags at the start of a line (with optional whitespace).
            // Reject matches inside comments like: // — <script> variant
            const is_line_start = blk: {
                if (i == 0) break :blk true;
                // Scan backwards to find start of line or non-whitespace
                var k = i;
                while (k > 0) {
                    k -= 1;
                    if (src[k] == '\n') break :blk true;
                    if (src[k] != ' ' and src[k] != '\t') break :blk false;
                }
                break :blk true; // start of file
            };
            if (!is_line_start) {
                continue;
            }
            const body_start = i + open_tag.len;
            var j = body_start;
            while (j + close_tag.len <= src.len) : (j += 1) {
                if (std.mem.eql(u8, src[j .. j + close_tag.len], close_tag)) {
                    if (parts.items.len > 0) {
                        parts.appendSlice(alloc, "\n") catch return;
                    }
                    parts.appendSlice(alloc, src[body_start..j]) catch return;
                    i = j + close_tag.len;
                    break;
                }
            }
        }
    }
}

/// Phase 5b: Extract inline Zig from <zscript>...</zscript> blocks.
/// This Zig gets emitted directly into the generated file — use for test functions,
/// utility code, or anything that needs direct access to the Zig runtime.
pub fn extractZscriptBlock(self: *Generator) void {
    const src = self.source;
    const open_tag = "<zscript>";
    const close_tag = "</zscript>";
    var i: usize = 0;
    while (i + open_tag.len <= src.len) : (i += 1) {
        if (std.mem.eql(u8, src[i .. i + open_tag.len], open_tag)) {
            // Only match tags at the start of a line (skip matches inside comments)
            const is_line_start = blk: {
                if (i == 0) break :blk true;
                var k = i;
                while (k > 0) {
                    k -= 1;
                    if (src[k] == '\n') break :blk true;
                    if (src[k] != ' ' and src[k] != '\t') break :blk false;
                }
                break :blk true;
            };
            if (!is_line_start) {
                continue;
            }
            const body_start = i + open_tag.len;
            var j = body_start;
            while (j + close_tag.len <= src.len) : (j += 1) {
                if (std.mem.eql(u8, src[j .. j + close_tag.len], close_tag)) {
                    self.compute_zig = src[body_start..j];
                    return;
                }
            }
        }
    }
}

/// Rewrite JS setter calls to __setState/__setStateString calls for QuickJS.
///
/// Input JS:  setCount(count + 1); setName("hello");
/// Output JS: __setState(0, count + 1); __setStateString(1, "hello");
///
/// This bridges the JS world (setter function names) to the Zig state system
/// (slot indices). The __setState functions are registered as QuickJS host functions
/// that call state.setSlot()/state.setSlotString() on the Zig side.
/// Also strips any useState() lines from the JS since state is managed by Zig.
pub fn rewriteSetterCalls(self: *Generator, js: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var line_iter = std.mem.splitScalar(u8, js, '\n');
    var first_line = true;
    // Emit JS-side mirror variables for object arrays so getters work in script blocks.
    // e.g. const [items, setItems] = useState([{...}]) →
    //   var items = [];
    //   function setItems(v) { items = v; __setObjArr0(v); }
    for (0..self.object_array_count) |oi| {
        const oa_getter = self.object_arrays[oi].getter;
        const oa_setter = self.object_arrays[oi].setter;
        if (oa_getter.len == 0 or oa_setter.len == 0) continue;
        try result.appendSlice(self.alloc, "var ");
        try result.appendSlice(self.alloc, oa_getter);
        try result.appendSlice(self.alloc, " = [];\n");
        try result.appendSlice(self.alloc, "function ");
        try result.appendSlice(self.alloc, oa_setter);
        try result.appendSlice(self.alloc, "(v) { ");
        try result.appendSlice(self.alloc, oa_getter);
        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, " = v; __setObjArr{d}(v); }}\n", .{oi}));
    }
    while (line_iter.next()) |line| {
        const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t', '\r' });
        if (std.mem.indexOf(u8, trimmed, "useState(") != null) continue;
        if (trimmed.len == 0 and first_line) continue;
        first_line = false;
        // Skip comment lines — don't rewrite setter names inside comments
        if (std.mem.startsWith(u8, trimmed, "//")) {
            try result.appendSlice(self.alloc, line);
            try result.append(self.alloc, '\n');
            continue;
        }
        var ii: usize = 0;
        while (ii < line.len) {
            // Skip string literals — don't rewrite inside quotes
            if (line[ii] == '\'' or line[ii] == '"') {
                const quote = line[ii];
                try result.append(self.alloc, quote);
                ii += 1;
                while (ii < line.len and line[ii] != quote) {
                    if (line[ii] == '\\' and ii + 1 < line.len) {
                        try result.append(self.alloc, line[ii]);
                        try result.append(self.alloc, line[ii + 1]);
                        ii += 2;
                    } else {
                        try result.append(self.alloc, line[ii]);
                        ii += 1;
                    }
                }
                if (ii < line.len) {
                    try result.append(self.alloc, line[ii]);
                    ii += 1;
                }
                continue;
            }
            var matched = false;
            for (0..self.state_count) |si| {
                const setter = self.state_slots[si].setter;
                if (setter.len == 0) continue;
                if (ii + setter.len + 1 <= line.len and
                    std.mem.eql(u8, line[ii .. ii + setter.len], setter) and
                    line[ii + setter.len] == '(')
                {
                    if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                    const tag = std.meta.activeTag(self.state_slots[si].initial);
                    const fn_name = if (tag == .string) "__setStateString" else if (tag == .string_array) "__setStateStringArray" else "__setState";
                    try result.appendSlice(self.alloc, fn_name);
                    if (tag == .string_array) {
                        // String array setter uses the string_array slot ID, not the state slot index
                        const sa_id = self.stringArraySlotId(@intCast(si));
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{sa_id}));
                    } else {
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{si}));
                    }
                    ii += setter.len + 1;
                    matched = true;
                    break;
                }
            }
            // Rewrite state variable reads: step → __getState(0), name → __getStateString(1)
            if (!matched) {
                for (0..self.state_count) |si| {
                    const getter = self.state_slots[si].getter;
                    if (getter.len == 0) continue;
                    if (ii + getter.len <= line.len and
                        std.mem.eql(u8, line[ii .. ii + getter.len], getter))
                    {
                        // Word boundary checks: must not be part of a larger identifier
                        if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                        if (ii + getter.len < line.len and Generator.isIdentByte(line[ii + getter.len])) break;
                        // Skip variable declarations — "var myPid" should not rewrite the declaration
                        if (ii >= 4 and std.mem.eql(u8, line[ii - 4 .. ii], "var ")) break;
                        if (ii >= 4 and std.mem.eql(u8, line[ii - 4 .. ii], "let ")) break;
                        const tag = std.meta.activeTag(self.state_slots[si].initial);
                        const fn_name = if (tag == .string) "__getStateString" else "__getState";
                        try result.appendSlice(self.alloc, fn_name);
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d})", .{si}));
                        ii += getter.len;
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) {
                try result.append(self.alloc, line[ii]);
                ii += 1;
            }
        }
        try result.append(self.alloc, '\n');
    }
    return try result.toOwnedSlice(self.alloc);
}

/// Rewrite Lua <lscript> setter/getter calls to use the same host API as QuickJS.
/// setFoo(val) → __setState(0, val), foo → __getState(0)
/// Same substitution logic as rewriteSetterCalls but respects Lua syntax:
/// - `local` instead of `var`/`let` for variable declarations
/// - `--` comments instead of `//`
pub fn rewriteLuaSetterCalls(self: *Generator, lua_src: []const u8) ![]const u8 {
    if (lua_src.len == 0) return "";
    var result: std.ArrayListUnmanaged(u8) = .{};
    var line_iter = std.mem.splitScalar(u8, lua_src, '\n');
    while (line_iter.next()) |line| {
        const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t', '\r' });
        // Skip Lua comment lines
        if (std.mem.startsWith(u8, trimmed, "--")) {
            try result.appendSlice(self.alloc, line);
            try result.append(self.alloc, '\n');
            continue;
        }
        var ii: usize = 0;
        while (ii < line.len) {
            // Skip string literals
            if (line[ii] == '\'' or line[ii] == '"') {
                const quote = line[ii];
                try result.append(self.alloc, quote);
                ii += 1;
                while (ii < line.len and line[ii] != quote) {
                    if (line[ii] == '\\' and ii + 1 < line.len) {
                        try result.append(self.alloc, line[ii]);
                        try result.append(self.alloc, line[ii + 1]);
                        ii += 2;
                    } else {
                        try result.append(self.alloc, line[ii]);
                        ii += 1;
                    }
                }
                if (ii < line.len) {
                    try result.append(self.alloc, line[ii]);
                    ii += 1;
                }
                continue;
            }
            var matched = false;
            // Rewrite setter calls: setFoo( → __setState(N,
            for (0..self.state_count) |si| {
                const setter = self.state_slots[si].setter;
                if (setter.len == 0) continue;
                if (ii + setter.len + 1 <= line.len and
                    std.mem.eql(u8, line[ii .. ii + setter.len], setter) and
                    line[ii + setter.len] == '(')
                {
                    if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                    const tag = std.meta.activeTag(self.state_slots[si].initial);
                    const fn_name = if (tag == .string) "__setStateString" else "__setState";
                    try result.appendSlice(self.alloc, fn_name);
                    try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{si}));
                    ii += setter.len + 1;
                    matched = true;
                    break;
                }
            }
            // Rewrite getter reads: foo → __getState(N)
            if (!matched) {
                for (0..self.state_count) |si| {
                    const getter = self.state_slots[si].getter;
                    if (getter.len == 0) continue;
                    if (ii + getter.len <= line.len and
                        std.mem.eql(u8, line[ii .. ii + getter.len], getter))
                    {
                        if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                        if (ii + getter.len < line.len and Generator.isIdentByte(line[ii + getter.len])) break;
                        // Skip local declarations
                        if (ii >= 6 and std.mem.eql(u8, line[ii - 6 .. ii], "local ")) break;
                        const tag = std.meta.activeTag(self.state_slots[si].initial);
                        const fn_name = if (tag == .string) "__getStateString" else "__getState";
                        try result.appendSlice(self.alloc, fn_name);
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d})", .{si}));
                        ii += getter.len;
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) {
                try result.append(self.alloc, line[ii]);
                ii += 1;
            }
        }
        try result.append(self.alloc, '\n');
    }
    return try result.toOwnedSlice(self.alloc);
}

/// Rewrite <zscript> JS state refs to Zig state API calls for native compilation.
///
/// Input JS:  setCount(count + 1); setName("hello");
/// Output:    state.setSlot(0, state.getSlot(0) + 1); state.setSlotString(1, "hello");
///
/// Also strips useState() lines (state is managed by the app framework).
pub fn rewriteZscriptState(self: *Generator, js: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var line_iter = std.mem.splitScalar(u8, js, '\n');
    while (line_iter.next()) |line| {
        const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t', '\r' });
        // Strip useState lines — state is managed by framework
        if (std.mem.indexOf(u8, trimmed, "useState(") != null) continue;
        // Skip comment lines
        if (std.mem.startsWith(u8, trimmed, "//")) {
            try result.appendSlice(self.alloc, line);
            try result.append(self.alloc, '\n');
            continue;
        }
        var ii: usize = 0;
        while (ii < line.len) {
            // Skip string literals
            if (line[ii] == '\'' or line[ii] == '"') {
                const quote = line[ii];
                try result.append(self.alloc, quote);
                ii += 1;
                while (ii < line.len and line[ii] != quote) {
                    if (line[ii] == '\\' and ii + 1 < line.len) {
                        try result.append(self.alloc, line[ii]);
                        try result.append(self.alloc, line[ii + 1]);
                        ii += 2;
                    } else {
                        try result.append(self.alloc, line[ii]);
                        ii += 1;
                    }
                }
                if (ii < line.len) { try result.append(self.alloc, line[ii]); ii += 1; }
                continue;
            }
            var matched = false;
            // Rewrite state setters: setFoo(val) → state.setSlot(N, val) / state.setSlotString(N, val)
            for (0..self.state_count) |si| {
                const setter = self.state_slots[si].setter;
                if (setter.len == 0) continue;
                if (ii + setter.len + 1 <= line.len and
                    std.mem.eql(u8, line[ii .. ii + setter.len], setter) and
                    line[ii + setter.len] == '(')
                {
                    if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                    const tag = std.meta.activeTag(self.state_slots[si].initial);
                    const fn_name = if (tag == .string) "state.setSlotString" else "state.setSlot";
                    try result.appendSlice(self.alloc, fn_name);
                    try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{si}));
                    ii += setter.len + 1;
                    matched = true;
                    break;
                }
            }
            // Rewrite state getters: foo → state.getSlot(N) / state.getSlotString(N)
            if (!matched) {
                for (0..self.state_count) |si| {
                    const getter = self.state_slots[si].getter;
                    if (getter.len == 0) continue;
                    if (ii + getter.len <= line.len and
                        std.mem.eql(u8, line[ii .. ii + getter.len], getter))
                    {
                        if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                        if (ii + getter.len < line.len and Generator.isIdentByte(line[ii + getter.len])) break;
                        // Don't rewrite var declarations
                        if (ii >= 4 and std.mem.eql(u8, line[ii - 4 .. ii], "var ")) break;
                        if (ii >= 4 and std.mem.eql(u8, line[ii - 4 .. ii], "let ")) break;
                        const tag = std.meta.activeTag(self.state_slots[si].initial);
                        const fn_name = if (tag == .string) "state.getSlotString" else "state.getSlot";
                        try result.appendSlice(self.alloc, fn_name);
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d})", .{si}));
                        ii += getter.len;
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) {
                try result.append(self.alloc, line[ii]);
                ii += 1;
            }
        }
        try result.append(self.alloc, '\n');
    }
    return try result.toOwnedSlice(self.alloc);
}

