//! Type system codegen for imperative .tsz files.
//!
//! Translates TypeScript type declarations to Zig type definitions:
//!   enum → pub const X = enum { ... };
//!   interface → pub const X = struct { ... };
//!   type alias → pub const X = ...;
//!
//! Also provides camelToSnake for shared use across all codegen modules.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;

const MAX_KNOWN_ENUMS = 64;

/// Tracks enum declarations so interface fields can get default values.
const EnumRegistry = struct {
    names: [MAX_KNOWN_ENUMS][]const u8 = undefined,
    defaults: [MAX_KNOWN_ENUMS][]const u8 = undefined, // pre-formatted: ".row", ".column", etc.
    count: u32 = 0,

    fn register(self: *EnumRegistry, alloc: std.mem.Allocator, name: []const u8, first_variant: []const u8) !void {
        if (self.count >= MAX_KNOWN_ENUMS) return;
        self.names[self.count] = name;
        self.defaults[self.count] = try std.fmt.allocPrint(alloc, ".{s}", .{first_variant});
        self.count += 1;
    }

    fn getDefault(self: *const EnumRegistry, type_name: []const u8) ?[]const u8 {
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.names[i], type_name)) return self.defaults[i];
        }
        return null;
    }
};

// ── Public API ──────────────────────────────────────────────────────

/// Scan the full token stream and emit all type declarations (enum, interface, type alias).
/// Returns Zig source for the type definition block.
/// Caller should use an arena allocator — intermediate allocations are not individually freed.
pub fn emitTypeDeclarations(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8) ![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};
    var enums = EnumRegistry{};

    var pos: u32 = 0;
    while (pos < lex.count) {
        const tok = lex.get(pos);
        if (tok.kind == .identifier) {
            const text = tok.text(source);
            if (std.mem.eql(u8, text, "enum")) {
                const decl = try emitEnum(alloc, lex, source, &pos, &enums);
                try out.appendSlice(alloc, decl);
                try out.append(alloc, '\n');
                continue;
            } else if (std.mem.eql(u8, text, "interface")) {
                const decl = try emitInterface(alloc, lex, source, &pos, &enums);
                try out.appendSlice(alloc, decl);
                try out.append(alloc, '\n');
                continue;
            } else if (std.mem.eql(u8, text, "type")) {
                const decl = try emitTypeAlias(alloc, lex, source, &pos);
                try out.appendSlice(alloc, decl);
                try out.append(alloc, '\n');
                continue;
            }
        }
        pos += 1;
    }

    return try alloc.dupe(u8, out.items);
}

/// Map a .tsz type annotation to a Zig type string.
/// e.g., "number" → "f32", "string" → "[]const u8", "Color" → "Color"
pub fn mapType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8 {
    if (std.mem.eql(u8, tsz_type, "number")) return "f32";
    if (std.mem.eql(u8, tsz_type, "string")) return "[]const u8";
    if (std.mem.eql(u8, tsz_type, "boolean")) return "bool";
    if (std.mem.eql(u8, tsz_type, "void")) return "void";
    if (std.mem.eql(u8, tsz_type, "pointer")) return "?*anyopaque";

    // Explicit Zig integer types passthrough — lets .tsz authors be precise
    if (std.mem.eql(u8, tsz_type, "u8")) return "u8";
    if (std.mem.eql(u8, tsz_type, "u16")) return "u16";
    if (std.mem.eql(u8, tsz_type, "u32")) return "u32";
    if (std.mem.eql(u8, tsz_type, "i8")) return "i8";
    if (std.mem.eql(u8, tsz_type, "i16")) return "i16";
    if (std.mem.eql(u8, tsz_type, "i32")) return "i32";
    if (std.mem.eql(u8, tsz_type, "i64")) return "i64";
    if (std.mem.eql(u8, tsz_type, "f64")) return "f64";
    if (std.mem.eql(u8, tsz_type, "usize")) return "usize";

    // T[] → []T
    if (tsz_type.len > 2 and std.mem.endsWith(u8, tsz_type, "[]")) {
        const base = tsz_type[0 .. tsz_type.len - 2];
        const mapped = try mapType(alloc, base);
        return try std.fmt.allocPrint(alloc, "[]{s}", .{mapped});
    }

    // T | null → ?T
    if (std.mem.indexOf(u8, tsz_type, " | null")) |idx| {
        const base = std.mem.trim(u8, tsz_type[0..idx], " ");
        const mapped = try mapType(alloc, base);
        return try std.fmt.allocPrint(alloc, "?{s}", .{mapped});
    }

    // User-defined type — pass through
    return try alloc.dupe(u8, tsz_type);
}

/// Map a nullable type: strips "| null" suffix → wraps in "?"
pub fn mapNullableType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8 {
    if (std.mem.indexOf(u8, tsz_type, " | null")) |pipe_pos| {
        const base = std.mem.trim(u8, tsz_type[0..pipe_pos], " ");
        const mapped = try mapType(alloc, base);
        return try std.fmt.allocPrint(alloc, "?{s}", .{mapped});
    }
    return try mapType(alloc, tsz_type);
}

/// camelCase → snake_case: "flexDirection" → "flex_direction"
/// Handles consecutive capitals: "getHTTPResponse" → "get_http_response"
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    if (input.len == 0) return try alloc.dupe(u8, "");
    var out: std.ArrayListUnmanaged(u8) = .{};
    for (input, 0..) |ch, i| {
        if (ch >= 'A' and ch <= 'Z') {
            if (i > 0) {
                const prev = input[i - 1];
                const prev_lower = (prev >= 'a' and prev <= 'z') or (prev >= '0' and prev <= '9');
                const prev_upper = prev >= 'A' and prev <= 'Z';
                const next_lower = if (i + 1 < input.len)
                    (input[i + 1] >= 'a' and input[i + 1] <= 'z')
                else
                    false;

                if (prev_lower or (prev_upper and next_lower)) {
                    try out.append(alloc, '_');
                }
            }
            try out.append(alloc, ch - 'A' + 'a');
        } else {
            try out.append(alloc, ch);
        }
    }
    return try alloc.dupe(u8, out.items);
}

// ── Internal: enum emission ─────────────────────────────────────────

fn emitEnum(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32, enums: *EnumRegistry) ![]const u8 {
    pos.* += 1; // skip "enum"

    const name_tok = lex.get(pos.*);
    if (name_tok.kind != .identifier) return error.ExpectedIdentifier;
    const name = name_tok.text(source);
    pos.* += 1;

    if (lex.get(pos.*).kind != .lbrace) return error.UnexpectedToken;
    pos.* += 1;

    var out: std.ArrayListUnmanaged(u8) = .{};
    try out.appendSlice(alloc, "pub const ");
    try out.appendSlice(alloc, name);
    try out.appendSlice(alloc, " = enum {");

    var first_variant: ?[]const u8 = null;
    var count: u32 = 0;

    while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) {
        const tok = lex.get(pos.*);
        if (tok.kind == .comma) {
            pos.* += 1;
            continue;
        }
        if (tok.kind != .identifier) {
            pos.* += 1;
            continue;
        }

        const variant = tok.text(source);
        pos.* += 1;

        const snake = try camelToSnake(alloc, variant);
        if (count > 0) try out.append(alloc, ',');
        try out.append(alloc, ' ');
        try out.appendSlice(alloc, snake);

        if (first_variant == null) first_variant = snake;
        count += 1;
    }

    // skip }
    if (pos.* < lex.count and lex.get(pos.*).kind == .rbrace) pos.* += 1;

    try out.appendSlice(alloc, " };");

    // Register enum for default values in structs
    if (first_variant) |fv| {
        try enums.register(alloc, name, fv);
    }

    return try alloc.dupe(u8, out.items);
}

// ── Internal: interface → struct emission ────────────────────────────

fn emitInterface(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32, enums: *const EnumRegistry) ![]const u8 {
    pos.* += 1; // skip "interface"

    const name_tok = lex.get(pos.*);
    if (name_tok.kind != .identifier) return error.ExpectedIdentifier;
    const name = name_tok.text(source);
    pos.* += 1;

    if (lex.get(pos.*).kind != .lbrace) return error.UnexpectedToken;
    pos.* += 1;

    var out: std.ArrayListUnmanaged(u8) = .{};
    try out.appendSlice(alloc, "pub const ");
    try out.appendSlice(alloc, name);
    try out.appendSlice(alloc, " = struct {\n");

    while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) {
        const tok = lex.get(pos.*);

        // Skip semicolons and comments
        if (tok.kind == .semicolon or tok.kind == .comment) {
            pos.* += 1;
            continue;
        }
        if (tok.kind != .identifier) {
            pos.* += 1;
            continue;
        }

        // Field name
        const field_name = tok.text(source);
        pos.* += 1;
        const snake = try camelToSnake(alloc, field_name);

        // Optional marker (?)
        const optional = lex.get(pos.*).kind == .question;
        if (optional) pos.* += 1;

        // :
        if (lex.get(pos.*).kind != .colon) return error.UnexpectedToken;
        pos.* += 1;

        // Type annotation
        const type_str = try parseTypeAnnotation(alloc, lex, source, pos);
        const mapped = try mapType(alloc, type_str);

        try out.appendSlice(alloc, "    ");
        try out.appendSlice(alloc, snake);
        try out.appendSlice(alloc, ": ");

        if (optional) {
            try out.append(alloc, '?');
            try out.appendSlice(alloc, mapped);
            try out.appendSlice(alloc, " = null,\n");
        } else {
            try out.appendSlice(alloc, mapped);
            if (defaultForType(enums, mapped)) |d| {
                try out.appendSlice(alloc, " = ");
                try out.appendSlice(alloc, d);
            }
            try out.appendSlice(alloc, ",\n");
        }

        // Skip trailing semicolon
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
    }

    // skip }
    if (pos.* < lex.count and lex.get(pos.*).kind == .rbrace) pos.* += 1;

    try out.appendSlice(alloc, "};");

    return try alloc.dupe(u8, out.items);
}

// ── Internal: type alias emission ───────────────────────────────────

fn emitTypeAlias(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) ![]const u8 {
    pos.* += 1; // skip "type"

    const name_tok = lex.get(pos.*);
    if (name_tok.kind != .identifier) return error.ExpectedIdentifier;
    const name = name_tok.text(source);
    pos.* += 1;

    // =
    if (lex.get(pos.*).kind != .equals) return error.UnexpectedToken;
    pos.* += 1;

    if (lex.get(pos.*).kind == .lparen) {
        // Function type: (params) => ReturnType
        return try emitFnType(alloc, lex, source, pos, name);
    }

    // Simple type alias
    const type_str = try parseTypeAnnotation(alloc, lex, source, pos);
    const mapped = try mapType(alloc, type_str);

    // Skip trailing semicolon
    if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;

    return try std.fmt.allocPrint(alloc, "pub const {s} = {s};", .{ name, mapped });
}

fn emitFnType(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32, name: []const u8) ![]const u8 {
    pos.* += 1; // skip (

    var out: std.ArrayListUnmanaged(u8) = .{};
    try out.appendSlice(alloc, "pub const ");
    try out.appendSlice(alloc, name);
    try out.appendSlice(alloc, " = *const fn (");

    var count: u32 = 0;

    while (pos.* < lex.count and lex.get(pos.*).kind != .rparen) {
        if (lex.get(pos.*).kind == .comma) {
            pos.* += 1;
            continue;
        }

        const pname_tok = lex.get(pos.*);
        if (pname_tok.kind != .identifier) {
            pos.* += 1;
            continue;
        }
        const pname = pname_tok.text(source);
        pos.* += 1;

        // :
        if (lex.get(pos.*).kind != .colon) return error.UnexpectedToken;
        pos.* += 1;

        const ptype = try parseTypeAnnotation(alloc, lex, source, pos);
        const mapped = try mapType(alloc, ptype);
        const snake = try camelToSnake(alloc, pname);

        if (count > 0) try out.appendSlice(alloc, ", ");
        try out.appendSlice(alloc, snake);
        try out.appendSlice(alloc, ": ");
        try out.appendSlice(alloc, mapped);

        count += 1;
    }

    // skip )
    if (pos.* < lex.count and lex.get(pos.*).kind == .rparen) pos.* += 1;

    // => ReturnType
    if (lex.get(pos.*).kind != .arrow) return error.UnexpectedToken;
    pos.* += 1;

    const ret_tok = lex.get(pos.*);
    if (ret_tok.kind != .identifier) return error.ExpectedIdentifier;
    const ret_type = ret_tok.text(source);
    pos.* += 1;
    const mapped_ret = try mapType(alloc, ret_type);

    try out.appendSlice(alloc, ") ");
    try out.appendSlice(alloc, mapped_ret);
    try out.append(alloc, ';');

    // Skip trailing semicolon
    if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;

    return try alloc.dupe(u8, out.items);
}

// ── Internal: type annotation parsing ───────────────────────────────

fn parseTypeAnnotation(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) ![]const u8 {
    const tok = lex.get(pos.*);
    if (tok.kind != .identifier) return error.ExpectedIdentifier;
    const base = tok.text(source);
    pos.* += 1;

    // T[] — array type
    if (pos.* + 1 < lex.count and lex.get(pos.*).kind == .lbracket and lex.get(pos.* + 1).kind == .rbracket) {
        pos.* += 2;
        return try std.fmt.allocPrint(alloc, "{s}[]", .{base});
    }

    // T | null — nullable type
    if (pos.* < lex.count and lex.get(pos.*).kind == .pipe) {
        const save = pos.*;
        pos.* += 1;
        const rhs = lex.get(pos.*);
        if (rhs.kind == .identifier and std.mem.eql(u8, rhs.text(source), "null")) {
            pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s} | null", .{base});
        }
        // Not "| null" — restore position
        pos.* = save;
    }

    return base;
}

// ── Internal: default value for non-optional fields ─────────────────

fn defaultForType(enums: *const EnumRegistry, mapped: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, mapped, "f32")) return "0";
    if (std.mem.eql(u8, mapped, "i64")) return "0";
    if (std.mem.eql(u8, mapped, "i16")) return "0";
    if (std.mem.eql(u8, mapped, "usize")) return "0";
    if (std.mem.eql(u8, mapped, "bool")) return "false";
    if (std.mem.eql(u8, mapped, "[]const u8")) return "\"\"";

    // Known enum → .first_variant
    return enums.getDefault(mapped);
}

// ── Tests ───────────────────────────────────────────────────────────

test "camelToSnake basic" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    try std.testing.expectEqualStrings("flex_direction", try camelToSnake(alloc, "flexDirection"));
    try std.testing.expectEqualStrings("background_color", try camelToSnake(alloc, "backgroundColor"));
    try std.testing.expectEqualStrings("font_size", try camelToSnake(alloc, "fontSize"));
    try std.testing.expectEqualStrings("x", try camelToSnake(alloc, "x"));
    try std.testing.expectEqualStrings("on_click", try camelToSnake(alloc, "onClick"));
    try std.testing.expectEqualStrings("z_index", try camelToSnake(alloc, "zIndex"));
}

test "camelToSnake acronyms" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    try std.testing.expectEqualStrings("get_http_response", try camelToSnake(alloc, "getHTTPResponse"));
    try std.testing.expectEqualStrings("xml_parser", try camelToSnake(alloc, "XMLParser"));
}

test "mapType basics" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    try std.testing.expectEqualStrings("f32", try mapType(alloc, "number"));
    try std.testing.expectEqualStrings("[]const u8", try mapType(alloc, "string"));
    try std.testing.expectEqualStrings("bool", try mapType(alloc, "boolean"));
    try std.testing.expectEqualStrings("Color", try mapType(alloc, "Color"));
    try std.testing.expectEqualStrings("[]Node", try mapType(alloc, "Node[]"));
    try std.testing.expectEqualStrings("?[]const u8", try mapType(alloc, "string | null"));
}

test "enum declaration" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "enum FlexDirection { Row, Column }";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "pub const FlexDirection = enum { row, column };") != null);
}

test "enum with multi-word variants" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "enum JustifyContent { Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly }";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "space_between") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "space_around") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "space_evenly") != null);
}

test "interface to struct" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "interface Color { r: number; g: number; b: number; a: number; }";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "pub const Color = struct {") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "r: f32 = 0,") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "g: f32 = 0,") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "b: f32 = 0,") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "a: f32 = 0,") != null);
}

test "interface with optional fields and enum defaults" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "enum FlexDirection { Row, Column } interface Style { width?: number; flexDirection: FlexDirection; gap: number; }";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "width: ?f32 = null,") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "flex_direction: FlexDirection = .row,") != null);
    try std.testing.expect(std.mem.indexOf(u8, result, "gap: f32 = 0,") != null);
}

test "function type alias" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "type MeasureFn = (text: string, fontSize: number) => TextMetrics;";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "pub const MeasureFn = *const fn (text: []const u8, font_size: f32) TextMetrics;") != null);
}

test "empty enum" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();

    const source = "enum Empty {}";
    var lex = Lexer.init(source);
    lex.tokenize();

    const result = try emitTypeDeclarations(alloc, &lex, source);
    try std.testing.expect(std.mem.indexOf(u8, result, "pub const Empty = enum { };") != null);
}
