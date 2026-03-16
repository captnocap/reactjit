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
const MAX_KNOWN_UNIONS = 32;

/// Tracks union declarations so interface fields can skip default values.
var known_unions: [MAX_KNOWN_UNIONS][]const u8 = undefined;
var known_union_count: u32 = 0;

fn registerUnion(name: []const u8) void {
    if (known_union_count >= MAX_KNOWN_UNIONS) return;
    known_unions[known_union_count] = name;
    known_union_count += 1;
}

fn isKnownUnion(name: []const u8) bool {
    for (0..known_union_count) |i| {
        if (std.mem.eql(u8, known_unions[i], name)) return true;
    }
    return false;
}

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
            } else if (std.mem.eql(u8, text, "union")) {
                const decl = try emitUnion(alloc, lex, source, &pos);
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

    // [N]T — fixed-size array (already in Zig form from parseTypeAnnotation)
    if (tsz_type.len > 2 and tsz_type[0] == '[') {
        return try alloc.dupe(u8, tsz_type);
    }

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
    const result = try alloc.dupe(u8, out.items);
    // Escape Zig reserved keywords
    if (isZigKeyword(result)) {
        return try std.fmt.allocPrint(alloc, "@\"{s}\"", .{result});
    }
    return result;
}

pub fn isZigKeyword(name: []const u8) bool {
    const keywords = [_][]const u8{
        "align", "allowzero", "and", "asm", "async", "await",
        "break", "catch", "comptime", "const", "continue",
        "defer", "else", "enum", "errdefer", "error", "export", "extern",
        "false", "fn", "for", "if", "inline",
        "noalias", "nosuspend", "null",
        "opaque", "or", "orelse",
        "packed", "pub", "resume", "return",
        "struct", "suspend", "switch",
        "test", "threadlocal", "true", "try", "type",
        "undefined", "union", "unreachable", "usingnamespace",
        "var", "volatile", "while",
    };
    for (keywords) |kw| {
        if (std.mem.eql(u8, name, kw)) return true;
    }
    return false;
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

// ── Internal: union → union(enum) emission ──────────────────────────
//
// union Value {
//   int: i64;
//   float: f64;
//   boolean: boolean;
//   string: { buf: [256]u8; len: u8 };
// }
//
// → pub const Value = union(enum) {
//       int: i64,
//       float: f64,
//       boolean: bool,
//       string: struct { buf: [256]u8, len: u8 },
//   };

fn emitUnion(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) ![]const u8 {
    pos.* += 1; // skip "union"

    const name_tok = lex.get(pos.*);
    if (name_tok.kind != .identifier) return error.ExpectedIdentifier;
    const name = name_tok.text(source);
    registerUnion(name);
    pos.* += 1;

    if (lex.get(pos.*).kind != .lbrace) return error.UnexpectedToken;
    pos.* += 1;

    var out: std.ArrayListUnmanaged(u8) = .{};
    try out.appendSlice(alloc, "pub const ");
    try out.appendSlice(alloc, name);
    try out.appendSlice(alloc, " = union(enum) {\n");

    while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) {
        const tok = lex.get(pos.*);

        // Skip commas and semicolons between variants
        if (tok.kind == .comma or tok.kind == .semicolon) {
            pos.* += 1;
            continue;
        }
        if (tok.kind != .identifier) {
            pos.* += 1;
            continue;
        }

        // Variant name
        const variant_name = tok.text(source);
        pos.* += 1;

        // Expect : Type
        if (pos.* < lex.count and lex.get(pos.*).kind == .colon) {
            pos.* += 1; // skip :

            // Check for inline struct: { ... }
            if (pos.* < lex.count and lex.get(pos.*).kind == .lbrace) {
                pos.* += 1; // skip {
                try out.appendSlice(alloc, "    ");
                try out.appendSlice(alloc, variant_name);
                try out.appendSlice(alloc, ": struct { ");

                // Collect struct fields until }
                var first_field = true;
                while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) {
                    const ftok = lex.get(pos.*);
                    if (ftok.kind == .semicolon or ftok.kind == .comma) {
                        pos.* += 1;
                        continue;
                    }
                    if (ftok.kind != .identifier) {
                        pos.* += 1;
                        continue;
                    }

                    const field_name = ftok.text(source);
                    pos.* += 1;

                    // Expect : Type
                    if (pos.* < lex.count and lex.get(pos.*).kind == .colon) {
                        pos.* += 1; // skip :
                        const field_type = try parseTypeAnnotation(alloc, lex, source, pos);
                        const zig_type = try mapType(alloc, field_type);
                        if (!first_field) try out.appendSlice(alloc, ", ");
                        try out.appendSlice(alloc, field_name);
                        try out.appendSlice(alloc, ": ");
                        try out.appendSlice(alloc, zig_type);
                        first_field = false;
                    }
                }
                if (pos.* < lex.count and lex.get(pos.*).kind == .rbrace) pos.* += 1;
                try out.appendSlice(alloc, " },\n");
            } else {
                // Simple type
                const type_str = try parseTypeAnnotation(alloc, lex, source, pos);
                const zig_type = try mapType(alloc, type_str);
                try out.appendSlice(alloc, "    ");
                try out.appendSlice(alloc, variant_name);
                try out.appendSlice(alloc, ": ");
                try out.appendSlice(alloc, zig_type);
                try out.appendSlice(alloc, ",\n");
            }
        } else {
            // Variant with no payload (bare enum variant)
            try out.appendSlice(alloc, "    ");
            try out.appendSlice(alloc, variant_name);
            try out.appendSlice(alloc, ",\n");
        }
    }

    // skip }
    if (pos.* < lex.count and lex.get(pos.*).kind == .rbrace) pos.* += 1;

    try out.appendSlice(alloc, "};");

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
        } else if (mapped.len > 0 and mapped[0] == '?') {
            // Type is already nullable (e.g., ?*const fn () void) — add = null
            try out.appendSlice(alloc, mapped);
            try out.appendSlice(alloc, " = null,\n");
        } else {
            try out.appendSlice(alloc, mapped);
            if (defaultForType(enums, mapped, snake)) |d| {
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

    // For Style struct: inject padding/margin helper methods (required by runtime callers)
    if (std.mem.eql(u8, name, "Style")) {
        try out.appendSlice(alloc,
            "\n    pub fn padLeft(self: Style) f32 { return self.padding_left orelse self.padding; }\n" ++
            "    pub fn padRight(self: Style) f32 { return self.padding_right orelse self.padding; }\n" ++
            "    pub fn padTop(self: Style) f32 { return self.padding_top orelse self.padding; }\n" ++
            "    pub fn padBottom(self: Style) f32 { return self.padding_bottom orelse self.padding; }\n" ++
            "    pub fn marLeft(self: Style) f32 { return self.margin_left orelse self.margin; }\n" ++
            "    pub fn marRight(self: Style) f32 { return self.margin_right orelse self.margin; }\n" ++
            "    pub fn marTop(self: Style) f32 { return self.margin_top orelse self.margin; }\n" ++
            "    pub fn marBottom(self: Style) f32 { return self.margin_bottom orelse self.margin; }\n");
    }

    // For Color struct: inject rgb/rgba methods (required by runtime callers)
    if (std.mem.eql(u8, name, "Color")) {
        try out.appendSlice(alloc, "\n    pub fn rgb(r: u8, g: u8, b: u8) Color {\n");
        try out.appendSlice(alloc, "        return .{ .r = r, .g = g, .b = b, .a = 255 };\n    }\n");
        try out.appendSlice(alloc, "    pub fn rgba(r: u8, g: u8, b: u8, a: u8) Color {\n");
        try out.appendSlice(alloc, "        return .{ .r = r, .g = g, .b = b, .a = a };\n    }\n");
    }

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

    // [N]T — fixed-size array type (e.g., [256]u8, [MAX_SLOTS]StateSlot)
    if (tok.kind == .lbracket) {
        pos.* += 1; // skip [
        // Collect the size expression (number or identifier constant)
        var size_buf: std.ArrayListUnmanaged(u8) = .{};
        while (pos.* < lex.count and lex.get(pos.*).kind != .rbracket) {
            try size_buf.appendSlice(alloc, lex.get(pos.*).text(source));
            pos.* += 1;
        }
        if (pos.* < lex.count and lex.get(pos.*).kind == .rbracket) pos.* += 1;
        // Parse the element type
        const elem_type = try parseTypeAnnotation(alloc, lex, source, pos);
        const mapped_elem = try mapType(alloc, elem_type);
        return try std.fmt.allocPrint(alloc, "[{s}]{s}", .{ size_buf.items, mapped_elem });
    }

    // ?T — optional type prefix
    if (tok.kind == .question) {
        pos.* += 1;
        const inner = try parseTypeAnnotation(alloc, lex, source, pos);
        const mapped = try mapType(alloc, inner);
        return try std.fmt.allocPrint(alloc, "?{s}", .{mapped});
    }

    // *T or *const T — pointer type prefix
    if (tok.kind == .star) {
        pos.* += 1;
        if (pos.* < lex.count and lex.get(pos.*).kind == .identifier and
            std.mem.eql(u8, lex.get(pos.*).text(source), "const"))
        {
            pos.* += 1;
            const inner = try parseTypeAnnotation(alloc, lex, source, pos);
            return try std.fmt.allocPrint(alloc, "*const {s}", .{inner});
        }
        const inner = try parseTypeAnnotation(alloc, lex, source, pos);
        return try std.fmt.allocPrint(alloc, "*{s}", .{inner});
    }

    // const T — type qualifier for const pointers, slices etc.
    if (tok.kind == .identifier and std.mem.eql(u8, tok.text(source), "const")) {
        pos.* += 1;
        const inner = try parseTypeAnnotation(alloc, lex, source, pos);
        return try std.fmt.allocPrint(alloc, "const {s}", .{inner});
    }

    // fn (params) RetType — function type
    if (tok.kind == .identifier and std.mem.eql(u8, tok.text(source), "fn")) {
        var fn_buf: std.ArrayListUnmanaged(u8) = .{};
        try fn_buf.appendSlice(alloc, "fn ");
        pos.* += 1; // skip fn
        // Collect ( ... )
        if (pos.* < lex.count and lex.get(pos.*).kind == .lparen) {
            var pdepth: u32 = 0;
            while (pos.* < lex.count) {
                const k = lex.get(pos.*).kind;
                if (k == .lparen) pdepth += 1;
                if (k == .rparen) pdepth -= 1;
                try fn_buf.appendSlice(alloc, lex.get(pos.*).text(source));
                pos.* += 1;
                if (pdepth == 0) break;
            }
        }
        // Collect return type
        if (pos.* < lex.count and lex.get(pos.*).kind == .identifier) {
            try fn_buf.append(alloc, ' ');
            try fn_buf.appendSlice(alloc, lex.get(pos.*).text(source));
            pos.* += 1;
        }
        return try alloc.dupe(u8, fn_buf.items);
    }

    // Arrow function type: (() => void) or ((x: number, y: number) => void)
    // Converts to: *const fn () void or *const fn (x: f32, y: f32) void
    if (tok.kind == .lparen) {
        // Scan ahead for => to confirm this is an arrow function
        var scan_pos = pos.*;
        var scan_depth: u32 = 0;
        var found_arrow = false;
        while (scan_pos < lex.count) {
            const sk = lex.get(scan_pos).kind;
            if (sk == .lparen) scan_depth += 1;
            if (sk == .rparen) {
                scan_depth -= 1;
                if (scan_depth == 0) break; // closed without arrow
            }
            if (sk == .arrow) { found_arrow = true; break; }
            if (sk == .semicolon or sk == .rbrace) break;
            scan_pos += 1;
        }

        if (found_arrow) {
            pos.* += 1; // skip outer (

            // If next is (, this is ((params) => ret) with outer grouping
            // If next is ), this is (() => ret) — no params
            var fn_buf: std.ArrayListUnmanaged(u8) = .{};
            try fn_buf.appendSlice(alloc, "*const fn (");

            if (lex.get(pos.*).kind == .lparen) {
                pos.* += 1; // skip inner (
                var param_count: u32 = 0;
                while (pos.* < lex.count and lex.get(pos.*).kind != .rparen) {
                    if (lex.get(pos.*).kind == .comma) { pos.* += 1; continue; }
                    if (lex.get(pos.*).kind != .identifier) { pos.* += 1; continue; }
                    const pname = lex.get(pos.*).text(source);
                    pos.* += 1;
                    if (pos.* < lex.count and lex.get(pos.*).kind == .colon) pos.* += 1;
                    const ptype = try parseTypeAnnotation(alloc, lex, source, pos);
                    const mapped_p = try mapType(alloc, ptype);
                    if (param_count > 0) try fn_buf.appendSlice(alloc, ", ");
                    try fn_buf.appendSlice(alloc, pname);
                    try fn_buf.appendSlice(alloc, ": ");
                    try fn_buf.appendSlice(alloc, mapped_p);
                    param_count += 1;
                }
                if (pos.* < lex.count and lex.get(pos.*).kind == .rparen) pos.* += 1; // skip inner )
            }
            // else: empty params — () => ... — we're already past the outer (

            // Skip =>
            if (pos.* < lex.count and lex.get(pos.*).kind == .arrow) pos.* += 1;

            // Parse return type
            const ret_type = try parseTypeAnnotation(alloc, lex, source, pos);
            const mapped_ret = try mapType(alloc, ret_type);

            try fn_buf.appendSlice(alloc, ") ");
            try fn_buf.appendSlice(alloc, mapped_ret);

            // Skip outer )
            if (pos.* < lex.count and lex.get(pos.*).kind == .rparen) pos.* += 1;

            // Check for | null
            if (pos.* < lex.count and lex.get(pos.*).kind == .pipe) {
                const save = pos.*;
                pos.* += 1;
                if (pos.* < lex.count and lex.get(pos.*).kind == .identifier and
                    std.mem.eql(u8, lex.get(pos.*).text(source), "null"))
                {
                    pos.* += 1;
                    return try std.fmt.allocPrint(alloc, "?{s}", .{fn_buf.items});
                }
                pos.* = save;
            }

            return try alloc.dupe(u8, fn_buf.items);
        }
    }

    // Complex Zig types (function pointers, optionals, etc.) — collect raw
    if (tok.kind != .identifier) {
        var raw: std.ArrayListUnmanaged(u8) = .{};
        var paren_depth: u32 = 0;
        while (pos.* < lex.count) {
            const k = lex.get(pos.*).kind;
            if (paren_depth == 0 and (k == .semicolon or k == .rbrace or k == .comma)) break;
            if (k == .lparen) paren_depth += 1;
            if (k == .rparen) {
                if (paren_depth == 0) break;
                paren_depth -= 1;
            }
            if (raw.items.len > 0) {
                // Smart spacing: no space after ( or before )
                const prev = raw.items[raw.items.len - 1];
                const cur = lex.get(pos.*).text(source);
                const cf = if (cur.len > 0) cur[0] else @as(u8, 0);
                if (prev != '(' and prev != '*' and cf != ')' and cf != ',') {
                    try raw.append(alloc, ' ');
                }
            }
            try raw.appendSlice(alloc, lex.get(pos.*).text(source));
            pos.* += 1;
        }
        return try alloc.dupe(u8, raw.items);
    }
    const base = tok.text(source);
    pos.* += 1;

    // T[] — slice type
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

fn defaultForType(enums: *const EnumRegistry, mapped: []const u8, field_name: []const u8) ?[]const u8 {
    // Field-specific defaults (match hand-written runtime / CSS defaults)
    if (std.mem.eql(u8, field_name, "font_size")) return "16";
    if (std.mem.eql(u8, field_name, "flex_direction")) return ".column";
    if (std.mem.eql(u8, field_name, "align_items")) return ".stretch";
    if (std.mem.eql(u8, field_name, "opacity")) return "1.0";
    if (std.mem.eql(u8, field_name, "scale_x")) return "1.0";
    if (std.mem.eql(u8, field_name, "scale_y")) return "1.0";
    if (std.mem.eql(u8, mapped, "f32")) return "0";
    if (std.mem.eql(u8, mapped, "f64")) return "0";
    if (std.mem.eql(u8, mapped, "i64")) return "0";
    if (std.mem.eql(u8, mapped, "i16")) return "0";
    if (std.mem.eql(u8, mapped, "i32")) return "0";
    if (std.mem.eql(u8, mapped, "u8")) return "0";
    if (std.mem.eql(u8, mapped, "u16")) return "0";
    if (std.mem.eql(u8, mapped, "u32")) return "0";
    if (std.mem.eql(u8, mapped, "usize")) return "0";
    if (std.mem.eql(u8, mapped, "bool")) return "false";
    if (std.mem.eql(u8, mapped, "[]const u8")) return "\"\"";

    // Slice types (e.g., []Node) → empty slice
    if (std.mem.startsWith(u8, mapped, "[]")) return "&.{}";

    // Known enum → .first_variant
    if (enums.getDefault(mapped)) |d| return d;

    // Known union types → no default (unions can't be default-initialized)
    if (isKnownUnion(mapped)) return null;

    // Known struct types → default struct init
    // (Any PascalCase type that's not a primitive or enum is likely a struct)
    if (mapped.len > 0 and mapped[0] >= 'A' and mapped[0] <= 'Z') return ".{}";

    return null;
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
