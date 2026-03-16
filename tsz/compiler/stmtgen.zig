//! Statement/control flow codegen for imperative .tsz files.
//!
//! Translates TypeScript statements to Zig:
//!   const x = expr → const x = <expr>;
//!   let x = expr → var x = <expr>;
//!   if/else → if/else
//!   for (const x of arr) → for (arr) |x|
//!   for (let i = 0; i < n; i++) → while loop
//!   switch/case → switch with enum arms
//!
//! Delegates expression positions to exprgen.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const exprgen = @import("exprgen.zig");
const typegen = @import("typegen.zig");

/// Parse and emit a block of statements (content between { and }).
/// Assumes pos is AT the opening { token. Advances past the closing }.
/// Returns Zig source for the block body (without outer braces).
pub fn emitBlock(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) ![]const u8 {
    // Skip opening brace
    if (pos.* < lex.count and lex.get(pos.*).kind == .lbrace) pos.* += 1;

    var out: std.ArrayListUnmanaged(u8) = .{};
    var depth: u32 = 1;

    while (pos.* < lex.count and depth > 0) {
        const kind = lex.get(pos.*).kind;
        if (kind == .rbrace) {
            depth -= 1;
            if (depth == 0) {
                pos.* += 1; // skip closing }
                break;
            }
        }
        if (kind == .lbrace) depth += 1;

        // TODO: implement statement dispatch — see tsz/compiler/plans/03-stmtgen.md
        // Stub: emit each statement via emitStatement
        const stmt = try emitStatement(alloc, lex, source, pos, indent_level);
        if (stmt.len > 0) {
            try out.appendSlice(alloc, stmt);
            try out.append(alloc, '\n');
        }
    }

    return if (out.items.len > 0) try alloc.dupe(u8, out.items) else "";
}

/// Parse and emit a single statement.
/// Advances pos past the statement (including trailing semicolon).
pub fn emitStatement(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) ![]const u8 {
    if (pos.* >= lex.count) return "";
    const tok = lex.get(pos.*);
    if (tok.kind == .eof or tok.kind == .rbrace) return "";

    // TODO: implement statement dispatch — see tsz/compiler/plans/03-stmtgen.md
    // Dispatch on first token to determine statement type:
    //   const/let → variable declaration
    //   if → if/else chain
    //   for → for-of or C-style for loop
    //   while → while loop
    //   switch → switch/case
    //   return → return statement
    //   continue/break → pass through
    //   identifier followed by = → assignment
    //   identifier followed by ( → expression statement (function call)

    _ = indent_level;

    // Stub: collect tokens until semicolon or block end
    var out: std.ArrayListUnmanaged(u8) = .{};
    var depth: u32 = 0;

    while (pos.* < lex.count) {
        const k = lex.get(pos.*).kind;
        if (k == .eof) break;
        if (k == .lbrace) depth += 1;
        if (k == .rbrace) {
            if (depth == 0) break;
            depth -= 1;
            try out.appendSlice(alloc, lex.get(pos.*).text(source));
            pos.* += 1;
            if (depth == 0) break; // end of block statement
            continue;
        }
        if (k == .semicolon and depth == 0) {
            pos.* += 1; // consume semicolon
            break;
        }
        if (out.items.len > 0) try out.append(alloc, ' ');
        try out.appendSlice(alloc, lex.get(pos.*).text(source));
        pos.* += 1;
    }

    if (out.items.len == 0) return "";
    return try std.fmt.allocPrint(alloc, "    // TODO: {s}", .{out.items});
}
