//! Expression codegen helpers — type resolution, string utilities, and tests.
//!
//! Extracted from exprgen.zig to stay under the 1600-line file limit.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const typegen = @import("typegen.zig");
const exprgen = @import("exprgen.zig");
const ExprType = exprgen.ExprType;
const ExprContext = exprgen.ExprContext;

// ── Type resolution helpers ────────────────────────────────────────────

/// Resolve the type of a known struct field by its snake_case name.
pub fn resolveFieldType(field_name: []const u8) ExprType {
    // .len → usize
    if (std.mem.eql(u8, field_name, "len")) return .usize_t;

    // u16 fields
    if (std.mem.eql(u8, field_name, "font_size") or
        std.mem.eql(u8, field_name, "number_of_lines"))
        return .u16_t;

    // i16 fields
    if (std.mem.eql(u8, field_name, "z_index")) return .i16_t;

    // u8 fields
    if (std.mem.eql(u8, field_name, "input_id")) return .u8_t;

    // bool fields
    if (std.mem.eql(u8, field_name, "no_wrap")) return .bool_t;

    // Computed rect fields (always f32)
    if (std.mem.eql(u8, field_name, "x") or
        std.mem.eql(u8, field_name, "y") or
        std.mem.eql(u8, field_name, "w") or
        std.mem.eql(u8, field_name, "h"))
        return .f32_t;

    // f32 style fields (non-optional)
    const f32_fields = [_][]const u8{
        "flex_grow",       "gap",
        "padding",         "margin",
        "border_radius",   "border_width",     "opacity",
        "rotation",        "scale_x",          "scale_y",
        "shadow_offset_x", "shadow_offset_y",  "shadow_blur",
        "letter_spacing",  "line_height",
        "scroll_x",       "scroll_y",          "content_height",
        // TextMetrics
        "width",           "height",            "ascent",
    };
    for (f32_fields) |f| {
        if (std.mem.eql(u8, field_name, f)) return .f32_t;
    }

    // ?f32 style fields (optional) — these are genuinely optional in the struct.
    // In arithmetic, they fall through to the asF32() fallback which handles
    // optionals at runtime. The stmtgen null-narrowing adds .? in null-guarded
    // blocks, converting them to f32 naturally.
    const opt_f32_fields = [_][]const u8{
        "padding_left",    "padding_right",    "padding_top",     "padding_bottom",
        "margin_left",     "margin_right",     "margin_top",      "margin_bottom",
        "min_width",       "max_width",        "min_height",      "max_height",
        "flex_basis",      "flex_shrink",      "aspect_ratio",
        "top",             "left",             "right",           "bottom",
        "_flex_w",         "_stretch_h",       "_parent_inner_w", "_parent_inner_h",
    };
    for (opt_f32_fields) |f| {
        if (std.mem.eql(u8, field_name, f)) return .opt_f32_t;
    }

    // Enum fields
    const enum_fields = [_][]const u8{
        "flex_direction", "justify_content", "align_items", "align_self",
        "flex_wrap",      "position",        "display",     "overflow",
        "text_align",     "code_language",   "gradient_direction",
        "devtools_viz",
    };
    for (enum_fields) |f| {
        if (std.mem.eql(u8, field_name, f)) return .enum_t;
    }

    // String fields
    if (std.mem.eql(u8, field_name, "text") or
        std.mem.eql(u8, field_name, "image_src") or
        std.mem.eql(u8, field_name, "video_src") or
        std.mem.eql(u8, field_name, "render_src") or
        std.mem.eql(u8, field_name, "effect_type") or
        std.mem.eql(u8, field_name, "placeholder") or
        std.mem.eql(u8, field_name, "debug_name") or
        std.mem.eql(u8, field_name, "test_id") or
        std.mem.eql(u8, field_name, "canvas_type"))
        return .string_t;

    // Struct fields
    if (std.mem.eql(u8, field_name, "style") or
        std.mem.eql(u8, field_name, "computed") or
        std.mem.eql(u8, field_name, "handlers") or
        std.mem.eql(u8, field_name, "background_color") or
        std.mem.eql(u8, field_name, "border_color") or
        std.mem.eql(u8, field_name, "text_color") or
        std.mem.eql(u8, field_name, "gradient_color_end") or
        std.mem.eql(u8, field_name, "shadow_color"))
        return .struct_t;

    return .unknown;
}

/// Resolve the return type of a known function call.
pub fn resolveCallReturnType(callee: []const u8) ExprType {
    // Check dynamic function return type table first (populated by modulegen)
    const stmtgen = @import("stmtgen.zig");
    if (stmtgen.getFnReturnType(callee)) |ty| return ty;

    // Padding/margin helpers → f32 (function names stay camelCase)
    const f32_funcs = [_][]const u8{
        "padLeft",  "padRight",  "padTop",  "padBottom",
        "marLeft",  "marRight",  "marTop",  "marBottom",
        "clampVal",
        "estimateIntrinsicWidth", "estimateIntrinsicHeight",
        // Also snake_case forms for method-style calls
        "pad_left", "pad_right", "pad_top", "pad_bottom",
        "mar_left", "mar_right", "mar_top", "mar_bottom",
        "clamp_val",
    };
    for (f32_funcs) |f| {
        if (std.mem.eql(u8, callee, f)) return .f32_t;
    }

    // Nullable return
    if (std.mem.eql(u8, callee, "resolveMaybePct") or
        std.mem.eql(u8, callee, "resolve_maybe_pct")) return .opt_f32_t;

    // Struct returns
    if (std.mem.eql(u8, callee, "measureNodeText") or
        std.mem.eql(u8, callee, "measureNodeTextW") or
        std.mem.eql(u8, callee, "measureNodeImage") or
        std.mem.eql(u8, callee, "measure_node_text") or
        std.mem.eql(u8, callee, "measure_node_image") or
        std.mem.eql(u8, callee, "rgb") or
        std.mem.eql(u8, callee, "rgba"))
        return .struct_t;

    return .unknown;
}

/// Map TS type name to ExprType.
pub fn mapTsTypeToExprType(ts_type: []const u8) ExprType {
    if (std.mem.eql(u8, ts_type, "number")) return .f32_t;
    if (std.mem.eql(u8, ts_type, "u8")) return .u8_t;
    if (std.mem.eql(u8, ts_type, "u16")) return .u16_t;
    if (std.mem.eql(u8, ts_type, "i16")) return .i16_t;
    if (std.mem.eql(u8, ts_type, "i32")) return .usize_t;
    if (std.mem.eql(u8, ts_type, "u32")) return .usize_t;
    if (std.mem.eql(u8, ts_type, "boolean")) return .bool_t;
    if (std.mem.eql(u8, ts_type, "string")) return .string_t;
    return .unknown;
}

/// Get the Zig type string for an ExprType (for cast expressions).
pub fn zigTypeStr(ty: ExprType) []const u8 {
    return switch (ty) {
        .f32_t, .float_lit => "f32",
        .usize_t => "usize",
        .u16_t => "u16",
        .i16_t => "i16",
        .u8_t => "u8",
        .bool_t => "bool",
        .opt_f32_t => "?f32",
        else => "f32",
    };
}

// ── Helpers ────────────────────────────────────────────────────────────

pub fn joinArgs(alloc: std.mem.Allocator, args: []const []const u8) ![]const u8 {
    if (args.len == 0) return "";
    var total: usize = 0;
    for (args, 0..) |arg, i| {
        total += arg.len;
        if (i + 1 < args.len) total += 2;
    }
    var buf = try alloc.alloc(u8, total);
    var off: usize = 0;
    for (args, 0..) |arg, i| {
        @memcpy(buf[off .. off + arg.len], arg);
        off += arg.len;
        if (i + 1 < args.len) {
            buf[off] = ',';
            buf[off + 1] = ' ';
            off += 2;
        }
    }
    return buf;
}

pub fn mapTsType(ts_type: []const u8) []const u8 {
    if (std.mem.eql(u8, ts_type, "number")) return "f32";
    if (std.mem.eql(u8, ts_type, "i64")) return "i64";
    if (std.mem.eql(u8, ts_type, "i32")) return "i32";
    if (std.mem.eql(u8, ts_type, "u32")) return "u32";
    if (std.mem.eql(u8, ts_type, "u8")) return "u8";
    if (std.mem.eql(u8, ts_type, "f64")) return "f64";
    if (std.mem.eql(u8, ts_type, "boolean")) return "bool";
    if (std.mem.eql(u8, ts_type, "string")) return "[]const u8";
    return ts_type;
}

/// Lowercase the first character of a string.
pub fn lowerFirst(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    if (input.len == 0) return try alloc.dupe(u8, "");
    if (input[0] < 'A' or input[0] > 'Z') return try alloc.dupe(u8, input);
    var buf = try alloc.dupe(u8, input);
    buf[0] = input[0] - 'A' + 'a';
    return buf;
}

/// Convert camelCase to snake_case.
/// "flexDirection" → "flex_direction", "paddingLeft" → "padding_left"
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    // Delegate to typegen's version which handles Zig reserved keyword escaping
    return typegen.camelToSnake(alloc, input);
}

/// Check if name contains any of the given substrings.
pub fn containsAny(name: []const u8, needles: []const []const u8) bool {
    for (needles) |needle| {
        if (std.mem.indexOf(u8, name, needle) != null) return true;
    }
    return false;
}

/// Check if a name is all uppercase (A-Z and _).
pub fn isAllCaps(name: []const u8) bool {
    for (name) |c| {
        if (c >= 'a' and c <= 'z') return false;
    }
    return name.len > 0;
}

/// Convert `template ${expr}` to std.fmt.comptimePrint("template {s}", .{ expr })
/// Returns true if the string looks like a bare identifier or property chain
/// (e.g. "node", "node.text", "node.style.width") — no operators, parens, etc.
pub fn isBareAccess(s: []const u8) bool {
    if (s.len == 0) return false;
    for (s) |ch| {
        switch (ch) {
            'a'...'z', 'A'...'Z', '0'...'9', '_', '.' => {},
            else => return false,
        }
    }
    return true;
}

pub fn emitTemplateLiteral(alloc: std.mem.Allocator, raw: []const u8) ![]const u8 {
    if (raw.len < 2) return try alloc.dupe(u8, "\"\"");
    const inner = raw[1 .. raw.len - 1];

    // No interpolations → simple string
    if (std.mem.indexOf(u8, inner, "${") == null) {
        return try std.fmt.allocPrint(alloc, "\"{s}\"", .{inner});
    }

    var parts: std.ArrayListUnmanaged(u8) = .{};
    var args: std.ArrayListUnmanaged([]const u8) = .{};

    try parts.appendSlice(alloc, "std.fmt.comptimePrint(\"");

    var i: usize = 0;
    while (i < inner.len) {
        if (i + 1 < inner.len and inner[i] == '$' and inner[i + 1] == '{') {
            try parts.appendSlice(alloc, "{s}");
            i += 2;
            const expr_start = i;
            var depth: u32 = 1;
            while (i < inner.len and depth > 0) {
                if (inner[i] == '{') depth += 1;
                if (inner[i] == '}') depth -= 1;
                if (depth > 0) i += 1;
            }
            try args.append(alloc, try alloc.dupe(u8, inner[expr_start..i]));
            if (i < inner.len) i += 1;
        } else {
            try parts.append(alloc, inner[i]);
            i += 1;
        }
    }

    try parts.appendSlice(alloc, "\", .{ ");
    for (args.items, 0..) |arg, idx| {
        try parts.appendSlice(alloc, arg);
        if (idx + 1 < args.items.len) try parts.appendSlice(alloc, ", ");
    }
    try parts.appendSlice(alloc, " })");

    return try alloc.dupe(u8, parts.items);
}

// ── Tests ──────────────────────────────────────────────────────────────

fn testExpr(input: []const u8, expected: []const u8) !void {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try exprgen.emitExpression(alloc, &lex, input, &pos, .value);
    try std.testing.expectEqualStrings(expected, result);
}

fn testExprCtx(input: []const u8, expected: []const u8, ctx: ExprContext) !void {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try exprgen.emitExpression(alloc, &lex, input, &pos, ctx);
    try std.testing.expectEqualStrings(expected, result);
}

test "property access with snake_case" {
    try testExpr("node.flexDirection", "node.flex_direction");
}

test "chained property access" {
    try testExpr("node.style.paddingLeft", "node.style.padding_left");
}

test "length to len" {
    try testExpr("node.children.length", "node.children.len");
    try testExpr("node.text.length", "node.text.len");
}

test "null coalescing" {
    try testExpr("a ?? b", "a orelse b");
}

test "null coalescing with property" {
    try testExpr("s.paddingLeft ?? s.padding", "s.padding_left orelse s.padding");
}

test "null comparison" {
    try testExpr("val === null", "val == null");
    try testExpr("val !== null", "val != null");
    try testExpr("x !== undefined", "x != null");
}

test "object literal" {
    try testExpr("{ x: 0, y: 1 }", ".{ .x = 0, .y = 1 }");
}

test "object literal shorthand" {
    try testExpr("{ r, g, b }", ".{ .r = r, .g = g, .b = b }");
}

test "object literal mixed" {
    try testExpr("{ r, g, b, a: 255 }", ".{ .r = r, .g = g, .b = b, .a = 255 }");
}

test "Math builtin" {
    try testExpr("Math.abs(x)", "@abs(x)");
    try testExpr("Math.max(a, b)", "@max(a, b)");
    try testExpr("Math.min(a, b)", "@min(a, b)");
    try testExpr("Math.floor(x)", "@floor(x)");
}

test "ternary" {
    try testExpr("cond ? a : b", "if (cond) a else b");
}

test "logical operators" {
    try testExpr("a && b", "a and b");
    try testExpr("a || b", "a or b");
}

test "arithmetic with unknown types uses asF32 fallback" {
    try testExpr("a + b", "asF32(a) + asF32(b)");
    try testExpr("a * b + c", "asF32(asF32(a) * asF32(b)) + asF32(c)");
}

test "comparison with unknown types uses asF32 fallback" {
    try testExpr("a < b", "asF32(a) < asF32(b)");
    try testExpr("a >= b", "asF32(a) >= asF32(b)");
}

test "arithmetic with known f32 fields no cast" {
    try testExpr("s.width + s.gap", "s.width + s.gap");
}

test "comparison with known fields no cast" {
    try testExpr("s.gap > s.padding", "s.gap > s.padding");
}

test "arithmetic with int literal coercion" {
    try testExpr("s.gap * 2", "s.gap * 2");
    try testExpr("1 + s.width", "1 + s.width");
}

test "comparison int literal coercion" {
    try testExpr("s.gap > 0", "s.gap > 0");
    try testExpr("node.children.length > 1", "node.children.len > 1");
}

test "mixed f32 and usize casts correctly" {
    try testExpr("s.gap * node.children.length", "s.gap * @as(f32, @floatFromInt(node.children.len))");
}

test "unary" {
    try testExpr("-1", "-1");
    try testExpr("!flag", "!flag");
}

test "string equality" {
    try testExpr("a === \"hello\"", "std.mem.eql(u8, a, \"hello\")");
}

test "type assertion" {
    try testExpr("x as number", "@as(f32, x)");
}

test "new Array" {
    try testExpr("new Array(512)", "std.mem.zeroes([512]f32)");
}

test "boolean context bare identifier" {
    try testExprCtx("node.text", "node.text != null", .condition);
}

test "camelToSnake" {
    const alloc = std.testing.allocator;

    const t1 = try camelToSnake(alloc, "flexDirection");
    defer alloc.free(t1);
    try std.testing.expectEqualStrings("flex_direction", t1);

    const t2 = try camelToSnake(alloc, "paddingLeft");
    defer alloc.free(t2);
    try std.testing.expectEqualStrings("padding_left", t2);

    const t3 = try camelToSnake(alloc, "width");
    defer alloc.free(t3);
    try std.testing.expectEqualStrings("width", t3);

    const t4 = try camelToSnake(alloc, "backgroundColor");
    defer alloc.free(t4);
    try std.testing.expectEqualStrings("background_color", t4);
}

test "number literals" {
    try testExpr("42", "42");
    try testExpr("3.14", "3.14");
}

test "null and undefined" {
    try testExpr("null", "null");
    try testExpr("undefined", "null");
}

test "parenthesized" {
    try testExpr("(a + b)", "(asF32(a) + asF32(b))");
}

test "function call" {
    try testExpr("foo(a, b)", "foo(a, b)");
    try testExpr("resolveMaybePct(val, parent)", "resolveMaybePct(val, parent)");
}

test "index access" {
    try testExpr("arr[i]", "arr[@intCast(i)]");
}

test "template literal simple" {
    try testExpr("`hello`", "\"hello\"");
}

test "comparison chain with logical" {
    try testExpr("a < b && b < c", "asF32(a) < asF32(b) and asF32(b) < asF32(c)");
}

test "slice method" {
    try testExpr("str.slice(a, b)", "str[@intCast(a)..@intCast(b)]");
}

test "compound assignment stops at +=" {
    try testExpr("total", "total");
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    const input = "total += 1";
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try exprgen.emitExpression(alloc, &lex, input, &pos, .value);
    try std.testing.expectEqualStrings("total", result);
    try std.testing.expectEqual(lexer_mod.TokenKind.plus, lex.get(pos).kind);
}

test "enum reference" {
    try testExpr("FlexDirection.Row", ".row");
    try testExpr("Display.None", ".none");
    try testExpr("Position.Absolute", ".absolute");
    try testExpr("FlexWrap.Wrap", ".wrap");
}

test "enum does not apply to Math builtins" {
    try testExpr("Math.abs(x)", "@abs(x)");
}

test "local variable snake_case" {
    try testExpr("visibleCount", "visible_count");
    try testExpr("lineMain", "line_main");
    try testExpr("itemsOnLine", "items_on_line");
    try testExpr("totalCross", "total_cross");
}

test "simple identifiers unchanged" {
    try testExpr("total", "total");
    try testExpr("gap", "gap");
    try testExpr("node", "node");
}
