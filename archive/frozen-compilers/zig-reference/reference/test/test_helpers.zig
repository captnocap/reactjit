//! Shared test helpers for the compiler test suite.

pub const std = @import("std");
pub const testing = std.testing;

pub const lexer_mod = @import("../lexer.zig");
pub const Lexer = lexer_mod.Lexer;
pub const Token = lexer_mod.Token;
pub const TokenKind = lexer_mod.TokenKind;

pub const codegen = @import("../codegen.zig");
pub const Generator = codegen.Generator;

pub const handlers = @import("../handlers.zig");

pub fn tokenize(source: []const u8) Lexer {
    var lex = Lexer.init(source);
    lex.tokenize();
    return lex;
}

pub fn expectToken(lex: *const Lexer, idx: u32, kind: TokenKind, source: []const u8, expected_text: []const u8) !void {
    const tok = lex.get(idx);
    try testing.expectEqual(kind, tok.kind);
    try testing.expectEqualStrings(expected_text, tok.text(source));
}

pub fn expectKind(lex: *const Lexer, idx: u32, kind: TokenKind) !void {
    try testing.expectEqual(kind, lex.get(idx).kind);
}

pub fn arena() std.heap.ArenaAllocator {
    return std.heap.ArenaAllocator.init(std.heap.page_allocator);
}

pub fn makeGen(a: std.mem.Allocator, lex: *const Lexer, source: []const u8) Generator {
    return Generator.init(a, lex, source, "test.tsz");
}

pub fn exprResult(al: std.mem.Allocator, src: []const u8) ![]const u8 {
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    return try handlers.emitStateExpr(&gen);
}

pub fn exprWithState(al: std.mem.Allocator, src: []const u8) ![]const u8 {
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "count", .setter = "setCount", .initial = .{ .int = 0 } };
    gen.state_slots[1] = .{ .getter = "name", .setter = "setName", .initial = .{ .string = "" } };
    gen.state_slots[2] = .{ .getter = "temp", .setter = "setTemp", .initial = .{ .float = 0.0 } };
    gen.state_slots[3] = .{ .getter = "active", .setter = "setActive", .initial = .{ .boolean = false } };
    gen.state_count = 4;
    gen.has_state = true;
    return try handlers.emitStateExpr(&gen);
}
