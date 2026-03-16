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

// ── Public API ──────────────────────────────────────────────────────

/// Scan the full token stream and emit all type declarations (enum, interface, type alias).
/// Returns Zig source for the type definition block.
pub fn emitTypeDeclarations(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8) ![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};

    var pos: u32 = 0;
    while (pos < lex.count) {
        const tok = lex.get(pos);
        if (tok.kind == .identifier) {
            const text = tok.text(source);
            if (std.mem.eql(u8, text, "enum")) {
                const decl = try emitEnum(alloc, lex, source, &pos);
                try out.appendSlice(alloc, decl);
                try out.appendSlice(alloc, "\n");
                continue;
            } else if (std.mem.eql(u8, text, "interface")) {
                const decl = try emitInterface(alloc, lex, source, &pos);
                try out.appendSlice(alloc, decl);
                try out.appendSlice(alloc, "\n");
                continue;
            } else if (std.mem.eql(u8, text, "type")) {
                const decl = try emitTypeAlias(alloc, lex, source, &pos);
                try out.appendSlice(alloc, decl);
                try out.appendSlice(alloc, "\n");
                continue;
            }
        }
        pos += 1;
    }

    return if (out.items.len > 0) try alloc.dupe(u8, out.items) else "";
}

/// Map a .tsz type annotation to a Zig type string.
/// e.g., "number" → "f32", "string" → "[]const u8", "boolean" → "bool"
pub fn mapType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8 {
    if (std.mem.eql(u8, tsz_type, "number")) return "f32";
    if (std.mem.eql(u8, tsz_type, "string")) return "[]const u8";
    if (std.mem.eql(u8, tsz_type, "boolean")) return "bool";
    if (std.mem.eql(u8, tsz_type, "void")) return "void";
    // User-defined type — pass through (e.g., "Color", "Style", "Node")
    return try alloc.dupe(u8, tsz_type);
}

/// Map a nullable type: strips "| null" suffix → wraps in "?"
pub fn mapNullableType(alloc: std.mem.Allocator, tsz_type: []const u8) ![]const u8 {
    // Check for "T | null" pattern
    if (std.mem.indexOf(u8, tsz_type, " | null")) |pipe_pos| {
        const base = std.mem.trim(u8, tsz_type[0..pipe_pos], " ");
        const mapped = try mapType(alloc, base);
        return try std.fmt.allocPrint(alloc, "?{s}", .{mapped});
    }
    return try mapType(alloc, tsz_type);
}

/// camelCase → snake_case: "flexDirection" → "flex_direction"
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    if (input.len == 0) return "";
    var out: std.ArrayListUnmanaged(u8) = .{};
    for (input, 0..) |ch, i| {
        if (ch >= 'A' and ch <= 'Z') {
            if (i > 0) try out.append(alloc, '_');
            try out.append(alloc, ch - 'A' + 'a');
        } else {
            try out.append(alloc, ch);
        }
    }
    return try alloc.dupe(u8, out.items);
}

// ── Internal: enum emission ─────────────────────────────────────────

fn emitEnum(alloc: std.mem.Allocator, lex: *const Lexer, _: []const u8, pos: *u32) ![]const u8 {
    // TODO: implement — see tsz/compiler/plans/01-typegen.md
    // Skip past the enum declaration for now
    while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) pos.* += 1;
    if (pos.* < lex.count) pos.* += 1; // skip }
    return try std.fmt.allocPrint(alloc, "// TODO: enum\n", .{});
}

// ── Internal: interface → struct emission ────────────────────────────

fn emitInterface(alloc: std.mem.Allocator, lex: *const Lexer, _: []const u8, pos: *u32) ![]const u8 {
    // TODO: implement — see tsz/compiler/plans/01-typegen.md
    while (pos.* < lex.count and lex.get(pos.*).kind != .rbrace) pos.* += 1;
    if (pos.* < lex.count) pos.* += 1;
    return try std.fmt.allocPrint(alloc, "// TODO: interface\n", .{});
}

// ── Internal: type alias emission ───────────────────────────────────

fn emitTypeAlias(alloc: std.mem.Allocator, lex: *const Lexer, _: []const u8, pos: *u32) ![]const u8 {
    // TODO: implement — see tsz/compiler/plans/01-typegen.md
    // Skip to semicolon
    while (pos.* < lex.count and lex.get(pos.*).kind != .semicolon) pos.* += 1;
    if (pos.* < lex.count) pos.* += 1;
    return try std.fmt.allocPrint(alloc, "// TODO: type alias\n", .{});
}
