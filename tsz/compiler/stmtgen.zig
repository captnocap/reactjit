//! Statement/control flow codegen for imperative .tsz files.
//!
//! Translates TypeScript statements to Zig:
//!   const x = expr → const x = <expr>;
//!   let x = expr → var x = <expr>;
//!   if/else → if/else
//!   for (const x of arr) → for (arr) |x|
//!   for (let i = 0; i < n; i++) → while loop
//!   switch/case → switch with enum arms
//!   return expr → return <expr>;
//!
//! Delegates expression positions to exprgen.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const exprgen = @import("exprgen.zig");
const typegen = @import("typegen.zig");

// ── Helpers ─────────────────────────────────────────────────────────

fn indent(alloc: std.mem.Allocator, level: u32) std.mem.Allocator.Error![]const u8 {
    var buf: std.ArrayListUnmanaged(u8) = .{};
    for (0..level) |_| try buf.appendSlice(alloc, "    ");
    return if (buf.items.len > 0) try alloc.dupe(u8, buf.items) else "";
}

fn isIdent(lex: *const Lexer, source: []const u8, pos: u32, name: []const u8) bool {
    if (pos >= lex.count) return false;
    const tok = lex.get(pos);
    return tok.kind == .identifier and std.mem.eql(u8, tok.text(source), name);
}

fn peekKind(lex: *const Lexer, pos: u32) TokenKind {
    if (pos >= lex.count) return .eof;
    return lex.get(pos).kind;
}

fn peekText(lex: *const Lexer, source: []const u8, pos: u32) []const u8 {
    if (pos >= lex.count) return "";
    return lex.get(pos).text(source);
}

/// Detect for-of: `for (const/let IDENT of EXPR)`
fn isForOf(lex: *const Lexer, source: []const u8, pos: u32) bool {
    // pos is at 'for', look ahead: ( const/let IDENT of
    var p = pos + 1; // skip 'for'
    if (peekKind(lex, p) != .lparen) return false;
    p += 1; // skip (
    if (!isIdent(lex, source, p, "const") and !isIdent(lex, source, p, "let")) return false;
    p += 1; // skip const/let
    if (peekKind(lex, p) != .identifier) return false;
    p += 1; // skip ident
    return isIdent(lex, source, p, "of");
}

// ── Public API ──────────────────────────────────────────────────────

/// Parse and emit a block of statements (content between { and }).
/// Assumes pos is AT the opening { token. Advances past the closing }.
pub fn emitBlock(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    if (pos.* < lex.count and lex.get(pos.*).kind == .lbrace) pos.* += 1;

    var out: std.ArrayListUnmanaged(u8) = .{};

    while (pos.* < lex.count) {
        const kind = lex.get(pos.*).kind;
        if (kind == .eof) break;
        if (kind == .rbrace) {
            pos.* += 1;
            break;
        }
        // Skip comments
        if (kind == .comment) {
            pos.* += 1;
            continue;
        }

        const stmt = try emitStatement(alloc, lex, source, pos, indent_level);
        if (stmt.len > 0) {
            try out.appendSlice(alloc, stmt);
            try out.append(alloc, '\n');
        }
    }

    return if (out.items.len > 0) try alloc.dupe(u8, out.items) else "";
}

/// Parse and emit a single statement.
pub fn emitStatement(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    if (pos.* >= lex.count) return "";
    const tok = lex.get(pos.*);
    if (tok.kind == .eof or tok.kind == .rbrace) return "";

    // Skip comments and semicolons
    if (tok.kind == .comment) { pos.* += 1; return ""; }
    if (tok.kind == .semicolon) { pos.* += 1; return ""; }

    const text = tok.text(source);
    const ind = try indent(alloc, indent_level);

    // ── const/let declarations ───────────────────────────────────
    if (tok.kind == .identifier and (std.mem.eql(u8, text, "const") or std.mem.eql(u8, text, "let"))) {
        return try emitVarDecl(alloc, lex, source, pos, indent_level);
    }

    // ── if/else ──────────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "if")) {
        return try emitIf(alloc, lex, source, pos, indent_level);
    }

    // ── for loops ────────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "for")) {
        if (isForOf(lex, source, pos.*)) {
            return try emitForOf(alloc, lex, source, pos, indent_level);
        }
        return try emitForClassic(alloc, lex, source, pos, indent_level);
    }

    // ── while loop ───────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "while")) {
        return try emitWhile(alloc, lex, source, pos, indent_level);
    }

    // ── switch/case ──────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "switch")) {
        return try emitSwitch(alloc, lex, source, pos, indent_level);
    }

    // ── return ───────────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "return")) {
        pos.* += 1; // skip 'return'
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) {
            pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}return;", .{ind});
        }
        const expr = try exprgen.emitExpression(alloc, lex, source, pos, .return_val);
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
        return try std.fmt.allocPrint(alloc, "{s}return {s};", .{ ind, expr });
    }

    // ── continue/break ───────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "continue")) {
        pos.* += 1;
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
        return try std.fmt.allocPrint(alloc, "{s}continue;", .{ind});
    }
    if (tok.kind == .identifier and std.mem.eql(u8, text, "break")) {
        pos.* += 1;
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
        return try std.fmt.allocPrint(alloc, "{s}break;", .{ind});
    }

    // ── expression statement (assignment, function call, etc.) ───
    return try emitExprStatement(alloc, lex, source, pos, indent_level);
}

// ── Variable declarations ───────────────────────────────────────────

fn emitVarDecl(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);
    const keyword = peekText(lex, source, pos.*);
    const zig_kw = if (std.mem.eql(u8, keyword, "const")) "const" else "var";
    pos.* += 1; // skip const/let

    // Variable name
    if (peekKind(lex, pos.*) != .identifier) {
        // Might be destructuring { ... } — skip for now
        return try emitExprFallback(alloc, lex, source, pos, indent_level);
    }
    const name = peekText(lex, source, pos.*);
    const snake_name = try typegen.camelToSnake(alloc, name);
    pos.* += 1;

    // Optional type annotation: name: Type
    var type_ann: ?[]const u8 = null;
    if (peekKind(lex, pos.*) == .colon) {
        pos.* += 1; // skip :
        type_ann = try parseTypeAnnotation(alloc, lex, source, pos);
    }

    // = initializer
    if (peekKind(lex, pos.*) == .equals) {
        pos.* += 1; // skip =
        const expr = try exprgen.emitExpression(alloc, lex, source, pos, .assignment);
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;

        // If initializer is an array/zeroes allocation, use var (TS const allows mutation of contents)
        const effective_kw = if (std.mem.indexOf(u8, expr, "zeroes") != null or
            std.mem.indexOf(u8, expr, "[_]") != null) "var" else zig_kw;

        // When there's an initializer, skip the type annotation — let Zig infer.
        // The .tsz type annotation (e.g., "number[]") doesn't map cleanly and the
        // initializer already carries the correct Zig type.
        return try std.fmt.allocPrint(alloc, "{s}{s} {s} = {s};", .{ ind, effective_kw, snake_name, expr });
    }

    // No initializer
    if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
    if (type_ann) |ta| {
        return try std.fmt.allocPrint(alloc, "{s}{s} {s}: {s} = undefined;", .{ ind, zig_kw, snake_name, ta });
    }
    return try std.fmt.allocPrint(alloc, "{s}{s} {s} = undefined;", .{ ind, zig_kw, snake_name });
}

/// Parse a type annotation (after :). Handles "number", "string", "T | null", "T[]".
/// Stops at = or ; or , or ) at depth 0.
fn parseTypeAnnotation(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) std.mem.Allocator.Error![]const u8 {
    var parts: std.ArrayListUnmanaged(u8) = .{};

    while (pos.* < lex.count) {
        const kind = peekKind(lex, pos.*);
        if (kind == .equals or kind == .semicolon or kind == .comma or kind == .rparen or kind == .eof) break;
        if (parts.items.len > 0) try parts.append(alloc, ' ');
        try parts.appendSlice(alloc, peekText(lex, source, pos.*));
        pos.* += 1;
    }

    if (parts.items.len == 0) return "anyopaque";
    const raw = try alloc.dupe(u8, parts.items);
    return try typegen.mapNullableType(alloc, raw);
}

// ── If/else ─────────────────────────────────────────────────────────

fn emitIf(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);
    var out: std.ArrayListUnmanaged(u8) = .{};

    pos.* += 1; // skip 'if'

    // ( condition )
    if (peekKind(lex, pos.*) == .lparen) pos.* += 1;
    const cond = try exprgen.emitExpression(alloc, lex, source, pos, .condition);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    // { body } or single statement
    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}if ({s}) {{\n", .{ ind, cond }));
    if (peekKind(lex, pos.*) == .lbrace) {
        const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
        try out.appendSlice(alloc, body);
    } else {
        // Single-statement if (no braces)
        const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
        if (stmt.len > 0) {
            try out.appendSlice(alloc, stmt);
            try out.append(alloc, '\n');
        }
    }
    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));

    // else / else if chain
    while (isIdent(lex, source, pos.*, "else")) {
        pos.* += 1; // skip 'else'
        if (isIdent(lex, source, pos.*, "if")) {
            pos.* += 1; // skip 'if'
            if (peekKind(lex, pos.*) == .lparen) pos.* += 1;
            const elif_cond = try exprgen.emitExpression(alloc, lex, source, pos, .condition);
            if (peekKind(lex, pos.*) == .rparen) pos.* += 1;
            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, " else if ({s}) {{\n", .{elif_cond}));
            if (peekKind(lex, pos.*) == .lbrace) {
                const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
                try out.appendSlice(alloc, body);
            } else {
                const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
                if (stmt.len > 0) { try out.appendSlice(alloc, stmt); try out.append(alloc, '\n'); }
            }
            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));
        } else {
            try out.appendSlice(alloc, " else {\n");
            if (peekKind(lex, pos.*) == .lbrace) {
                const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
                try out.appendSlice(alloc, body);
            } else {
                const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
                if (stmt.len > 0) { try out.appendSlice(alloc, stmt); try out.append(alloc, '\n'); }
            }
            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));
            break;
        }
    }

    return try alloc.dupe(u8, out.items);
}

// ── For-of loop ─────────────────────────────────────────────────────

fn emitForOf(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);

    pos.* += 1; // skip 'for'
    if (peekKind(lex, pos.*) == .lparen) pos.* += 1; // skip (
    pos.* += 1; // skip const/let

    // Iterator variable name
    const iter_name = peekText(lex, source, pos.*);
    const snake_iter = try typegen.camelToSnake(alloc, iter_name);
    pos.* += 1; // skip name

    pos.* += 1; // skip 'of'

    // Collection expression (until closing paren)
    const collection = try exprgen.emitExpression(alloc, lex, source, pos, .value);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    // Body
    var body: []const u8 = "";
    if (peekKind(lex, pos.*) == .lbrace) {
        body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
    }

    return try std.fmt.allocPrint(alloc, "{s}for ({s}) |*{s}| {{\n{s}{s}}}", .{ ind, collection, snake_iter, body, ind });
}

// ── C-style for loop ────────────────────────────────────────────────

fn emitForClassic(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);
    const inner_ind = try indent(alloc, indent_level + 1);

    pos.* += 1; // skip 'for'
    if (peekKind(lex, pos.*) == .lparen) pos.* += 1;

    // Init: let i = 0
    const init_stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);

    // Condition: i < n
    const cond = try exprgen.emitExpression(alloc, lex, source, pos, .condition);
    if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;

    // Update: i++ or i += 1
    const update = try emitForUpdate(alloc, lex, source, pos);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    // Body
    var body: []const u8 = "";
    if (peekKind(lex, pos.*) == .lbrace) {
        body = try emitBlock(alloc, lex, source, pos, indent_level + 2);
    }

    // Emit: { init; while (cond) : (update) { body } }
    var out: std.ArrayListUnmanaged(u8) = .{};
    try out.appendSlice(alloc, ind);
    try out.appendSlice(alloc, "{\n");
    try out.appendSlice(alloc, init_stmt);
    try out.append(alloc, '\n');
    try out.appendSlice(alloc, inner_ind);
    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "while ({s}) : ({s}) {{\n", .{ cond, update }));
    try out.appendSlice(alloc, body);
    try out.appendSlice(alloc, inner_ind);
    try out.appendSlice(alloc, "}\n");
    try out.appendSlice(alloc, ind);
    try out.appendSlice(alloc, "}");
    return try alloc.dupe(u8, out.items);
}

/// Parse the update part of a C-style for loop (i++, i--, i += 1)
fn emitForUpdate(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) std.mem.Allocator.Error![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};

    while (pos.* < lex.count) {
        const kind = peekKind(lex, pos.*);
        if (kind == .rparen or kind == .eof) break;

        const text = peekText(lex, source, pos.*);

        // Handle i++ → i += 1
        if (kind == .identifier) {
            const name = try typegen.camelToSnake(alloc, text);
            pos.* += 1;
            if (peekKind(lex, pos.*) == .plus and pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .plus) {
                pos.* += 2; // skip ++
                try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s} += 1", .{name}));
            } else if (peekKind(lex, pos.*) == .minus and pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .minus) {
                pos.* += 2; // skip --
                try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s} -= 1", .{name}));
            } else {
                // Other pattern: collect remaining tokens
                try out.appendSlice(alloc, name);
                while (pos.* < lex.count and peekKind(lex, pos.*) != .rparen) {
                    try out.append(alloc, ' ');
                    try out.appendSlice(alloc, peekText(lex, source, pos.*));
                    pos.* += 1;
                }
            }
            break;
        }

        if (out.items.len > 0) try out.append(alloc, ' ');
        try out.appendSlice(alloc, text);
        pos.* += 1;
    }

    return if (out.items.len > 0) try alloc.dupe(u8, out.items) else "{}";
}

// ── While loop ──────────────────────────────────────────────────────

fn emitWhile(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);

    pos.* += 1; // skip 'while'
    if (peekKind(lex, pos.*) == .lparen) pos.* += 1;
    const cond = try exprgen.emitExpression(alloc, lex, source, pos, .condition);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    if (peekKind(lex, pos.*) == .lbrace) {
        // Block body
        const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
        return try std.fmt.allocPrint(alloc, "{s}while ({s}) {{\n{s}{s}}}", .{ ind, cond, body, ind });
    }

    // Brace-less body: while (cond) stmt;
    // Special case: while (cond) i++ → while (cond) : (i += 1) {}
    if (peekKind(lex, pos.*) == .identifier) {
        const name = peekText(lex, source, pos.*);
        if (pos.* + 2 < lex.count) {
            const p1 = peekKind(lex, pos.* + 1);
            const p2 = peekKind(lex, pos.* + 2);
            if (p1 == .plus and p2 == .plus) {
                const snake = try typegen.camelToSnake(alloc, name);
                pos.* += 3; // skip name++
                if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}while ({s}) : ({s} += 1) {{}}", .{ ind, cond, snake });
            }
            if (p1 == .minus and p2 == .minus) {
                const snake = try typegen.camelToSnake(alloc, name);
                pos.* += 3;
                if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}while ({s}) : ({s} -= 1) {{}}", .{ ind, cond, snake });
            }
        }
    }

    // General brace-less body: parse single statement
    const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
    return try std.fmt.allocPrint(alloc, "{s}while ({s}) {{\n{s}\n{s}}}", .{ ind, cond, stmt, ind });
}

// ── Switch/case ─────────────────────────────────────────────────────

fn emitSwitch(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);
    const arm_ind = try indent(alloc, indent_level + 1);
    var out: std.ArrayListUnmanaged(u8) = .{};

    pos.* += 1; // skip 'switch'
    if (peekKind(lex, pos.*) == .lparen) pos.* += 1;
    const expr = try exprgen.emitExpression(alloc, lex, source, pos, .value);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}switch ({s}) {{\n", .{ ind, expr }));

    // Parse { body with case/default arms }
    if (peekKind(lex, pos.*) == .lbrace) pos.* += 1;

    while (pos.* < lex.count) {
        const kind = peekKind(lex, pos.*);
        if (kind == .rbrace) { pos.* += 1; break; }
        if (kind == .eof) break;

        if (isIdent(lex, source, pos.*, "case")) {
            pos.* += 1; // skip 'case'

            // Parse case value: EnumType.Variant → .variant
            var case_val: std.ArrayListUnmanaged(u8) = .{};
            while (pos.* < lex.count and peekKind(lex, pos.*) != .colon) {
                try case_val.appendSlice(alloc, peekText(lex, source, pos.*));
                pos.* += 1;
            }
            if (peekKind(lex, pos.*) == .colon) pos.* += 1;

            // Convert EnumType.Variant → .variant
            const case_str = try alloc.dupe(u8, case_val.items);
            const zig_case = try enumCaseToZig(alloc, case_str);

            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}{s} => {{\n", .{ arm_ind, zig_case }));

            // Collect arm body until break or next case/default/}
            while (pos.* < lex.count) {
                if (isIdent(lex, source, pos.*, "break")) {
                    pos.* += 1; // skip 'break'
                    if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                    break;
                }
                if (isIdent(lex, source, pos.*, "case") or isIdent(lex, source, pos.*, "default") or peekKind(lex, pos.*) == .rbrace) break;

                const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 2);
                if (stmt.len > 0) {
                    try out.appendSlice(alloc, stmt);
                    try out.append(alloc, '\n');
                }
            }

            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}},\n", .{arm_ind}));
        } else if (isIdent(lex, source, pos.*, "default")) {
            pos.* += 1; // skip 'default'
            if (peekKind(lex, pos.*) == .colon) pos.* += 1;

            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}else => {{\n", .{arm_ind}));

            while (pos.* < lex.count) {
                if (isIdent(lex, source, pos.*, "break")) {
                    pos.* += 1;
                    if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                    break;
                }
                if (peekKind(lex, pos.*) == .rbrace) break;

                const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 2);
                if (stmt.len > 0) {
                    try out.appendSlice(alloc, stmt);
                    try out.append(alloc, '\n');
                }
            }

            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}},\n", .{arm_ind}));
        } else {
            pos.* += 1; // skip unexpected token
        }
    }

    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));
    return try alloc.dupe(u8, out.items);
}

/// Convert "EnumType.Variant" → ".variant" (strip type prefix, lowercase, snake_case)
fn enumCaseToZig(alloc: std.mem.Allocator, case_str: []const u8) std.mem.Allocator.Error![]const u8 {
    // Find the dot
    if (std.mem.indexOf(u8, case_str, ".")) |dot| {
        const variant = case_str[dot + 1 ..];
        const snake = try typegen.camelToSnake(alloc, variant);
        return try std.fmt.allocPrint(alloc, ".{s}", .{snake});
    }
    // No dot — might be a plain value
    const snake = try typegen.camelToSnake(alloc, case_str);
    return try std.fmt.allocPrint(alloc, ".{s}", .{snake});
}

// ── Expression statement (assignment, function call) ─────────────────

fn emitExprStatement(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);

    // Parse the left-hand side expression (stops at =, +=, -=, ;)
    const lhs = try exprgen.emitExpression(alloc, lex, source, pos, .value);

    // Check for assignment operators
    if (pos.* < lex.count) {
        const op_kind = peekKind(lex, pos.*);

        // Simple assignment: =
        if (op_kind == .equals) {
            pos.* += 1; // skip =
            const rhs = try exprgen.emitExpression(alloc, lex, source, pos, .assignment);
            if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}{s} = {s};", .{ ind, lhs, rhs });
        }

        // Compound assignment: +=, -=
        if (op_kind == .plus or op_kind == .minus) {
            if (pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .equals) {
                const op_ch = peekText(lex, source, pos.*);
                pos.* += 2; // skip += or -=
                const rhs = try exprgen.emitExpression(alloc, lex, source, pos, .assignment);
                if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}{s} {s}= {s};", .{ ind, lhs, op_ch, rhs });
            }
        }

        // Postfix increment/decrement: i++, i--
        if (op_kind == .plus and pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .plus) {
            pos.* += 2;
            if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}{s} += 1;", .{ ind, lhs });
        }
        if (op_kind == .minus and pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .minus) {
            pos.* += 2;
            if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}{s} -= 1;", .{ ind, lhs });
        }
    }

    if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
    if (lhs.len == 0) return "";
    return try std.fmt.allocPrint(alloc, "{s}{s};", .{ ind, lhs });
}

// ── Fallback: skip unknown construct ────────────────────────────────

fn emitExprFallback(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    indent_level: u32,
) std.mem.Allocator.Error![]const u8 {
    const ind = try indent(alloc, indent_level);
    var out: std.ArrayListUnmanaged(u8) = .{};
    var depth: u32 = 0;

    while (pos.* < lex.count) {
        const k = peekKind(lex, pos.*);
        if (k == .eof) break;
        if (k == .lbrace) depth += 1;
        if (k == .rbrace) {
            if (depth == 0) break;
            depth -= 1;
            if (depth == 0) { pos.* += 1; break; }
        }
        if (k == .semicolon and depth == 0) { pos.* += 1; break; }
        if (out.items.len > 0) try out.append(alloc, ' ');
        try out.appendSlice(alloc, peekText(lex, source, pos.*));
        pos.* += 1;
    }

    if (out.items.len == 0) return "";
    return try std.fmt.allocPrint(alloc, "{s}// SKIP: {s}", .{ ind, out.items });
}
