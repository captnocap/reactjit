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

// ── Variable type tracking ──────────────────────────────────────────
// Module-level type table, populated as variables are declared.
// Reset per function body by modulegen.

var var_type_table: exprgen.VarTypes = .{};

// Function return type table — persists across function resets.
// When a function is emitted with a known return type, register it here
// so callees can resolve the return type without an allowlist.
var fn_return_types: exprgen.VarTypes = .{};

// Function param pointer table — tracks which params are struct pointers.
// When a function is emitted with Node/struct params (→ *Node), register here
// so call sites can auto-add & for value-to-pointer coercion.
const MAX_FN_SIGS = 64;
const MAX_PARAMS = 16;

const FnSig = struct {
    name: []const u8 = "",
    param_is_ptr: [MAX_PARAMS]bool = [_]bool{false} ** MAX_PARAMS,
    param_count: u8 = 0,
};

var fn_sigs: [MAX_FN_SIGS]FnSig = [_]FnSig{.{}} ** MAX_FN_SIGS;
var fn_sig_count: u32 = 0;

pub fn resetVarTypes() void {
    var_type_table = .{};
}

pub fn registerVar(name: []const u8, ty: exprgen.ExprType) void {
    var_type_table.put(name, ty);
}

pub fn registerFnReturnType(name: []const u8, ty: exprgen.ExprType) void {
    fn_return_types.put(name, ty);
}

pub fn getFnReturnType(name: []const u8) ?exprgen.ExprType {
    return fn_return_types.get(name);
}

/// Register that a function's Nth param is a pointer type (struct → *Struct).
pub fn registerFnPtrParam(fn_name: []const u8, param_idx: u32) void {
    if (param_idx >= MAX_PARAMS) return;
    // Find existing entry
    for (0..fn_sig_count) |i| {
        if (std.mem.eql(u8, fn_sigs[i].name, fn_name)) {
            fn_sigs[i].param_is_ptr[param_idx] = true;
            if (param_idx + 1 > fn_sigs[i].param_count) fn_sigs[i].param_count = @intCast(param_idx + 1);
            return;
        }
    }
    // Create new entry
    if (fn_sig_count < MAX_FN_SIGS) {
        fn_sigs[fn_sig_count] = .{ .name = fn_name };
        fn_sigs[fn_sig_count].param_is_ptr[param_idx] = true;
        fn_sigs[fn_sig_count].param_count = @intCast(param_idx + 1);
        fn_sig_count += 1;
    }
}

/// Check if a function's Nth param is a pointer type.
pub fn isFnParamPtr(fn_name: []const u8, param_idx: u32) bool {
    if (param_idx >= MAX_PARAMS) return false;
    for (0..fn_sig_count) |i| {
        if (std.mem.eql(u8, fn_sigs[i].name, fn_name)) {
            return fn_sigs[i].param_is_ptr[param_idx];
        }
    }
    return false;
}

/// Map a Zig type string to ExprType
pub fn typeStrToExprType(ts: []const u8) exprgen.ExprType {
    if (std.mem.eql(u8, ts, "f32")) return .f32_t;
    if (std.mem.eql(u8, ts, "usize")) return .usize_t;
    if (std.mem.eql(u8, ts, "u16")) return .u16_t;
    if (std.mem.eql(u8, ts, "i16")) return .i16_t;
    if (std.mem.eql(u8, ts, "u8")) return .u8_t;
    if (std.mem.eql(u8, ts, "bool")) return .bool_t;
    if (std.mem.startsWith(u8, ts, "?")) return .opt_f32_t;
    // Slice/array types
    if (std.mem.indexOf(u8, ts, "[]f32") != null) return .f32_slice_t;
    if (std.mem.indexOf(u8, ts, "[]usize") != null) return .usize_slice_t;
    if (std.mem.indexOf(u8, ts, "[]bool") != null) return .bool_slice_t;
    return .unknown;
}

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
    // Track variables narrowed by early-return null guards: if (X == null) { return; }
    var narrowed_vars: [16][]const u8 = undefined;
    var narrowed_count: usize = 0;

    while (pos.* < lex.count) {
        const kind = lex.get(pos.*).kind;
        if (kind == .eof) break;
        if (kind == .rbrace) {
            pos.* += 1;
            break;
        }
        if (kind == .comment) {
            pos.* += 1;
            continue;
        }

        var stmt = try emitStatement(alloc, lex, source, pos, indent_level);

        // Detect null-guard-early-return: "if (X == null) {\n        return ...;\n    }"
        // If found, add X to narrowed set for subsequent statements
        if (std.mem.indexOf(u8, stmt, "== null) {")) |null_pos| {
            // Check if the body is just a return
            if (std.mem.indexOf(u8, stmt, "return") != null) {
                // Extract variable: walk back from "== null"
                const before = stmt[0..null_pos];
                if (std.mem.lastIndexOf(u8, before, "if (")) |if_pos| {
                    const var_start = if_pos + "if (".len;
                    const var_name = std.mem.trim(u8, before[var_start..], " ");
                    if (var_name.len > 0 and narrowed_count < 16) {
                        narrowed_vars[narrowed_count] = var_name;
                        narrowed_count += 1;
                        // Register as f32 so subsequent expressions know it's unwrapped
                        registerVar(var_name, .f32_t);
                    }
                }
            }
        }

        // Apply .? unwrap for all narrowed variables to this statement
        if (narrowed_count > 0 and stmt.len > 0) {
            for (0..narrowed_count) |ni| {
                const nv = narrowed_vars[ni];
                // Don't apply to the null-guard statement itself
                if (std.mem.indexOf(u8, stmt, "== null") != null) continue;
                const unwrapped = try std.fmt.allocPrint(alloc, "{s}.?", .{nv});
                stmt = try replaceIdent(alloc, stmt, nv, unwrapped);
                const bad_pat = try std.fmt.allocPrint(alloc, "{s}.? = null", .{nv});
                const good_pat = try std.fmt.allocPrint(alloc, "{s} = null", .{nv});
                stmt = try replaceAll(alloc, stmt, bad_pat, good_pat);
            }
        }

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

    // ── declare (FFI declarations — skip) ──────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "declare")) {
        // Skip the entire declare statement. Must respect brace depth
        // since @cImport({ @cInclude("..."); }) has semicolons inside braces.
        var brace_depth: u32 = 0;
        while (pos.* < lex.count) {
            const k = lex.get(pos.*).kind;
            if (k == .lbrace) brace_depth += 1;
            if (k == .rbrace) { if (brace_depth > 0) brace_depth -= 1; }
            if (k == .semicolon and brace_depth == 0) { pos.* += 1; break; }
            pos.* += 1;
        }
        return "";
    }

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
        const expr = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .return_val, &var_type_table);
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
        return try std.fmt.allocPrint(alloc, "{s}return {s};", .{ ind, expr });
    }

    // ── defer ─────────────────────────────────────────────────────
    if (tok.kind == .identifier and std.mem.eql(u8, text, "defer")) {
        pos.* += 1; // skip 'defer'
        const expr = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .value, &var_type_table);
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
        return try std.fmt.allocPrint(alloc, "{s}defer {s};", .{ ind, expr });
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
    // Keep original casing, but escape Zig reserved keywords
    const snake_name = if (typegen.isZigKeyword(name))
        try std.fmt.allocPrint(alloc, "@\"{s}\"", .{name})
    else
        name;
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
        const expr_result = try exprgen.emitExpressionFull(alloc, lex, source, pos, .assignment, &var_type_table);
        const expr = expr_result.text;
        const expr_ty = expr_result.ty;
        if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;

        // Use var when: array allocation (TS const allows mutation of contents)
        const effective_kw = if (std.mem.indexOf(u8, expr, "zeroes") != null or
            std.mem.indexOf(u8, expr, "[_]") != null) "var" else zig_kw;

        var final_expr = expr;
        if (std.mem.indexOf(u8, expr, "zeroes") != null and std.mem.indexOf(u8, expr, "f32") != null) {
            // Fix array element type based on type annotation or variable name
            const is_bool_arr = if (type_ann) |ta|
                (std.mem.indexOf(u8, ta, "bool") != null)
            else
                false;
            const is_index_arr = std.mem.indexOf(u8, snake_name, "Indices") != null or
                std.mem.indexOf(u8, snake_name, "indices") != null or
                std.mem.indexOf(u8, snake_name, "Starts") != null or
                std.mem.indexOf(u8, snake_name, "starts") != null or
                std.mem.indexOf(u8, snake_name, "Counts") != null or
                std.mem.indexOf(u8, snake_name, "counts") != null;
            if (is_bool_arr) {
                final_expr = try replaceAll(alloc, expr, "f32", "bool");
            } else if (is_index_arr) {
                final_expr = try replaceAll(alloc, expr, "f32", "usize");
            }
        }

        // When initializer is null or undefined, we must include the type annotation
        if (std.mem.eql(u8, expr, "null") or std.mem.eql(u8, expr, "undefined")) {
            if (type_ann) |ta| {
                registerVar(snake_name, typeStrToExprType(ta));
                return try std.fmt.allocPrint(alloc, "{s}{s} {s}: {s} = {s};", .{ ind, effective_kw, snake_name, ta, expr });
            }
        }
        // When var is initialized with a bare 0 literal, Zig needs an explicit type
        // (comptime_int can't be var). Use type annotation if available, else infer from name.
        // var with integer literal needs explicit type (comptime_int can't be var)
        if (std.mem.eql(u8, effective_kw, "var") and expr.len > 0 and
            (expr[0] >= '0' and expr[0] <= '9'))
        {
            if (type_ann) |ta| {
                registerVar(snake_name, typeStrToExprType(ta));
                return try std.fmt.allocPrint(alloc, "{s}var {s}: {s} = {s};", .{ ind, snake_name, ta, expr });
            }
            const inferred = inferNumericType(snake_name);
            registerVar(snake_name, typeStrToExprType(inferred));
            return try std.fmt.allocPrint(alloc, "{s}var {s}: {s} = {s};", .{ ind, snake_name, inferred, expr });
        }
        // Register type using the FINAL expression (after array element type fixup).
        // Priority: final_expr text pattern → annotation → parser inference
        const final_ty = inferExprType(final_expr);
        if (final_ty != .unknown) {
            registerVar(snake_name, final_ty);
        } else {
            const ann_ty = if (type_ann) |ta| typeStrToExprType(ta) else exprgen.ExprType.unknown;
            if (ann_ty != .unknown) {
                registerVar(snake_name, ann_ty);
            } else if (expr_ty != .unknown) {
                registerVar(snake_name, expr_ty);
            }
        }
        // Keep type annotation when:
        // 1. Initializer is a builtin (@bitCast, @splat need result type)
        // 2. Type is an explicit Zig integer/float type (u8, u16, i32, f64, etc.)
        // 3. Type starts with [ (fixed array)
        if (type_ann) |ta| {
            const keep = (final_expr.len > 0 and final_expr[0] == '@') or
                std.mem.eql(u8, ta, "u8") or std.mem.eql(u8, ta, "u16") or
                std.mem.eql(u8, ta, "u32") or std.mem.eql(u8, ta, "i8") or
                std.mem.eql(u8, ta, "i16") or std.mem.eql(u8, ta, "i32") or
                std.mem.eql(u8, ta, "i64") or std.mem.eql(u8, ta, "f64") or
                std.mem.eql(u8, ta, "usize") or
                (ta.len > 0 and ta[0] == '[') or
                // PascalCase custom types (enums, structs) — Zig needs the type for var
                (ta.len > 0 and ta[0] >= 'A' and ta[0] <= 'Z');
            if (keep) {
                registerVar(snake_name, typeStrToExprType(ta));
                return try std.fmt.allocPrint(alloc, "{s}{s} {s}: {s} = {s};", .{ ind, effective_kw, snake_name, ta, final_expr });
            }
        }
        // Skip .tsz type annotations for most initializers (Zig infers correctly).
        // The raw .tsz types (e.g., "number[]") aren't valid Zig.
        // Otherwise let Zig infer from the initializer
        return try std.fmt.allocPrint(alloc, "{s}{s} {s} = {s};", .{ ind, effective_kw, snake_name, final_expr });
    }

    // No initializer
    if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
    if (type_ann) |ta| {
        registerVar(snake_name, typeStrToExprType(ta));
        return try std.fmt.allocPrint(alloc, "{s}{s} {s}: {s} = undefined;", .{ ind, zig_kw, snake_name, ta });
    }
    return try std.fmt.allocPrint(alloc, "{s}{s} {s} = undefined;", .{ ind, zig_kw, snake_name });
}

/// Parse a type annotation (after :). Handles "number", "string", "T | null", "T[]".
/// Stops at = or ; or , or ) at depth 0.
fn parseTypeAnnotation(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, pos: *u32) std.mem.Allocator.Error![]const u8 {
    var parts: std.ArrayListUnmanaged(u8) = .{};
    var bracket_depth: u32 = 0;

    while (pos.* < lex.count) {
        const kind = peekKind(lex, pos.*);
        if (bracket_depth == 0 and (kind == .equals or kind == .semicolon or kind == .comma or kind == .rparen or kind == .eof)) break;
        if (kind == .lbracket) bracket_depth += 1;
        if (kind == .rbracket and bracket_depth > 0) bracket_depth -= 1;
        // No spaces inside brackets (for [N]T array types), no space after ]
        if (parts.items.len > 0) {
            const prev = parts.items[parts.items.len - 1];
            const skip_space = bracket_depth > 0 or kind == .lbracket or kind == .rbracket or prev == '[' or prev == ']';
            if (!skip_space) try parts.append(alloc, ' ');
        }
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
    const cond = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .condition, &var_type_table);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    // Check for |capture| — optional unwrap: if (expr) |name| { ... }
    if (peekKind(lex, pos.*) == .pipe) {
        pos.* += 1; // skip |
        const capture_name = peekText(lex, source, pos.*);
        pos.* += 1; // skip name
        if (peekKind(lex, pos.*) == .pipe) pos.* += 1; // skip |

        // Strip " != null" if present — if (optional) |val| uses bare optional
        const clean_cond = if (std.mem.endsWith(u8, cond, " != null"))
            cond[0 .. cond.len - " != null".len]
        else
            cond;
        try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}if ({s}) |{s}| ", .{ ind, clean_cond, capture_name }));

        // Parse body (single statement or block)
        if (peekKind(lex, pos.*) == .lbrace) {
            try out.appendSlice(alloc, "{\n");
            const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
            try out.appendSlice(alloc, body);
            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));
        } else {
            const stmt = try emitStatement(alloc, lex, source, pos, indent_level);
            try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}", .{stmt}));
        }

        // Check for else
        if (peekKind(lex, pos.*) == .identifier and std.mem.eql(u8, peekText(lex, source, pos.*), "else")) {
            pos.* += 1;
            if (peekKind(lex, pos.*) == .lbrace) {
                try out.appendSlice(alloc, " else {\n");
                const else_body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
                try out.appendSlice(alloc, else_body);
                try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));
            }
        }

        return try alloc.dupe(u8, out.items);
    }

    // Extract ALL "X != null" parts from condition (handles compound: "a != null and b != null")
    var null_vars: [8][]const u8 = undefined;
    const null_var_count = extractAllNullCheckVars(alloc, cond, &null_vars);

    if (null_var_count > 0) {
        // Register null-narrowed vars as f32 so expressions inside the block
        // know these are unwrapped floats, not optionals (avoids asF32 wrapping)
        for (0..null_var_count) |vi| {
            registerVar(null_vars[vi], .f32_t);
        }
        // Emit the condition as-is, but add .? to all null-checked vars in the body
        try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}if ({s}) {{\n", .{ ind, cond }));
        var body: []const u8 = "";
        if (peekKind(lex, pos.*) == .lbrace) {
            body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
        } else {
            const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
            if (stmt.len > 0) body = stmt;
        }
        // Add .? unwrap for each null-checked variable
        var replaced = body;
        for (0..null_var_count) |vi| {
            const nv = null_vars[vi];
            const unwrapped = try std.fmt.allocPrint(alloc, "{s}.?", .{nv});
            replaced = try replaceIdent(alloc, replaced, nv, unwrapped);
            // Also handle property access: nv.prop → nv.?.prop
            // (replaceIdent treats . as ident char, so nv.len misses)
            const dot_nv = try std.fmt.allocPrint(alloc, "{s}.", .{nv});
            const dot_unwrapped = try std.fmt.allocPrint(alloc, "{s}.?.", .{nv});
            replaced = try replaceAll(alloc, replaced, dot_nv, dot_unwrapped);
            // Fix double unwrap from overlapping replacements
            replaced = try replaceAll(alloc, replaced, ".?.?", ".?");
            // Fix over-replacement: "X.? = null" → "X = null"
            const bad_pat = try std.fmt.allocPrint(alloc, "{s}.? = null", .{nv});
            const good_pat = try std.fmt.allocPrint(alloc, "{s} = null", .{nv});
            replaced = try replaceAll(alloc, replaced, bad_pat, good_pat);
        }
        try out.appendSlice(alloc, replaced);
        if (replaced.len > 0 and replaced[replaced.len - 1] != '\n') try out.append(alloc, '\n');
    } else {
        try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}if ({s}) {{\n", .{ ind, cond }));
        if (peekKind(lex, pos.*) == .lbrace) {
            const body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
            try out.appendSlice(alloc, body);
        } else {
            const stmt = try emitStatement(alloc, lex, source, pos, indent_level + 1);
            if (stmt.len > 0) {
                try out.appendSlice(alloc, stmt);
                try out.append(alloc, '\n');
            }
        }
    }
    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}}}", .{ind}));

    // else / else if chain
    while (isIdent(lex, source, pos.*, "else")) {
        pos.* += 1; // skip 'else'
        if (isIdent(lex, source, pos.*, "if")) {
            pos.* += 1; // skip 'if'
            if (peekKind(lex, pos.*) == .lparen) pos.* += 1;
            const elif_cond = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .condition, &var_type_table);
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

    // Check for const (value capture) vs let (pointer capture)
    const is_const = isIdent(lex, source, pos.*, "const");
    pos.* += 1; // skip const/let

    // Iterator variable name — preserve original casing
    const iter_name = peekText(lex, source, pos.*);
    pos.* += 1; // skip name

    pos.* += 1; // skip 'of'

    // Collection expression (until closing paren)
    const collection = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .value, &var_type_table);
    if (peekKind(lex, pos.*) == .rparen) pos.* += 1;

    // Body
    var body: []const u8 = "";
    if (peekKind(lex, pos.*) == .lbrace) {
        body = try emitBlock(alloc, lex, source, pos, indent_level + 1);
    }

    // const → value capture |name|, let → pointer capture |*name|
    const capture = if (is_const)
        try std.fmt.allocPrint(alloc, "|{s}|", .{iter_name})
    else
        try std.fmt.allocPrint(alloc, "|*{s}|", .{iter_name});

    return try std.fmt.allocPrint(alloc, "{s}for ({s}) {s} {{\n{s}{s}}}", .{ ind, collection, capture, body, ind });
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
    const cond = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .condition, &var_type_table);
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
            const name = text;
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
    const cond = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .condition, &var_type_table);
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
                pos.* += 3; // skip name++
                if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}while ({s}) : ({s} += 1) {{}}", .{ ind, cond, name });
            }
            if (p1 == .minus and p2 == .minus) {
                pos.* += 3;
                if (peekKind(lex, pos.*) == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}while ({s}) : ({s} -= 1) {{}}", .{ ind, cond, name });
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
    const expr = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .value, &var_type_table);
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

            // Check for capture: |v| or |*v|
            var capture: ?[]const u8 = null;
            if (peekKind(lex, pos.*) == .pipe) {
                pos.* += 1; // skip |
                var cap_buf: std.ArrayListUnmanaged(u8) = .{};
                // Handle |*s| (pointer capture)
                if (peekKind(lex, pos.*) == .star) {
                    try cap_buf.append(alloc, '*');
                    pos.* += 1;
                }
                if (peekKind(lex, pos.*) == .identifier) {
                    try cap_buf.appendSlice(alloc, peekText(lex, source, pos.*));
                    pos.* += 1;
                }
                if (peekKind(lex, pos.*) == .pipe) pos.* += 1; // skip closing |
                capture = try alloc.dupe(u8, cap_buf.items);
            }

            if (capture) |cap| {
                try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}{s} => |{s}| {{\n", .{ arm_ind, zig_case, cap }));
            } else {
                try out.appendSlice(alloc, try std.fmt.allocPrint(alloc, "{s}{s} => {{\n", .{ arm_ind, zig_case }));
            }

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
    // Integer literal — pass through as-is (not an enum variant)
    if (case_str.len > 0 and (case_str[0] >= '0' and case_str[0] <= '9')) {
        return try alloc.dupe(u8, case_str);
    }
    // No dot — might be a plain enum value
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
    const lhs = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .value, &var_type_table);

    // Check for assignment operators
    if (pos.* < lex.count) {
        const op_kind = peekKind(lex, pos.*);

        // Simple assignment: =
        if (op_kind == .equals) {
            pos.* += 1; // skip =
            const rhs = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .assignment, &var_type_table);
            if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}{s} = {s};", .{ ind, lhs, rhs });
        }

        // Compound assignment: +=, -=
        if (op_kind == .plus or op_kind == .minus) {
            if (pos.* + 1 < lex.count and lex.get(pos.* + 1).kind == .equals) {
                const op_ch = peekText(lex, source, pos.*);
                pos.* += 2; // skip += or -=
                const rhs = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .assignment, &var_type_table);
                if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
                return try std.fmt.allocPrint(alloc, "{s}{s} {s}= {s};", .{ ind, lhs, op_ch, rhs });
            }
        }

        // Compound assignment: ^= (XOR-assign)
        if (op_kind == .caret_eq) {
            pos.* += 1; // skip ^=
            const rhs = try exprgen.emitExpressionTyped(alloc, lex, source, pos, .assignment, &var_type_table);
            if (pos.* < lex.count and lex.get(pos.*).kind == .semicolon) pos.* += 1;
            return try std.fmt.allocPrint(alloc, "{s}{s} ^= {s};", .{ ind, lhs, rhs });
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

// ── Null check pattern detection ────────────────────────────────────

/// Extract variable name from "X != null" or "X == null" pattern.
/// Returns the variable/property access string, or null if not a null check.
/// Extract all variables from "X != null" patterns in a condition.
/// Handles compound: "a != null and b != null and c > 0" → returns [a, b].
fn extractAllNullCheckVars(alloc: std.mem.Allocator, cond: []const u8, out_vars: *[8][]const u8) usize {
    _ = alloc;
    var count: usize = 0;
    const needle = " != null";

    var search_from: usize = 0;
    while (search_from < cond.len) {
        const pos = std.mem.indexOf(u8, cond[search_from..], needle) orelse break;
        const abs_pos = search_from + pos;
        // Extract the var part before " != null" — walk backwards to find start
        var start = abs_pos;
        while (start > 0) {
            const ch = cond[start - 1];
            if (isIdentChar(ch)) {
                start -= 1;
            } else break;
        }
        const var_part = cond[start..abs_pos];
        if (var_part.len > 0 and count < 8) {
            out_vars[count] = var_part;
            count += 1;
        }
        search_from = abs_pos + needle.len;
    }
    return count;
}

/// Replace whole-word occurrences of `old` with `new_val` in text.
/// Only replaces when `old` is bordered by non-identifier characters.
fn replaceIdent(alloc: std.mem.Allocator, text: []const u8, old: []const u8, new_val: []const u8) std.mem.Allocator.Error![]const u8 {
    if (old.len == 0 or text.len < old.len) return try alloc.dupe(u8, text);
    var out: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;
    while (i <= text.len - old.len) {
        if (std.mem.eql(u8, text[i..][0..old.len], old)) {
            // Check word boundaries
            const before_ok = i == 0 or !isIdentChar(text[i - 1]);
            const after_ok = i + old.len >= text.len or !isIdentChar(text[i + old.len]);
            if (before_ok and after_ok) {
                try out.appendSlice(alloc, new_val);
                i += old.len;
                continue;
            }
        }
        try out.append(alloc, text[i]);
        i += 1;
    }
    // Append remaining
    while (i < text.len) : (i += 1) try out.append(alloc, text[i]);
    return try alloc.dupe(u8, out.items);
}

fn isIdentChar(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_' or ch == '.';
}

/// Infer ExprType from an initializer expression string.
/// Recognizes common function calls and patterns.
fn inferExprType(expr: []const u8) exprgen.ExprType {
    // Known f32-returning functions: padLeft, padRight, padTop, padBottom,
    // marLeft, marRight, marTop, marBottom, clampVal, estimateIntrinsic*
    const f32_fns = [_][]const u8{
        "padLeft(", "padRight(", "padTop(", "padBottom(",
        "marLeft(", "marRight(", "marTop(", "marBottom(",
        "clampVal(", "estimateIntrinsicWidth(", "estimateIntrinsicHeight(",
        "@abs(", "@max(", "@min(", "@floor(", "@ceil(",
    };
    for (f32_fns) |fn_name| {
        if (std.mem.startsWith(u8, expr, fn_name)) return .f32_t;
    }
    // resolveMaybePct returns ?f32
    if (std.mem.startsWith(u8, expr, "resolveMaybePct(")) return .opt_f32_t;
    // Array allocations → slice types based on element type
    if (std.mem.indexOf(u8, expr, "zeroes") != null) {
        if (std.mem.indexOf(u8, expr, "usize") != null) return .usize_slice_t;
        if (std.mem.indexOf(u8, expr, "bool") != null) return .bool_slice_t;
        return .f32_slice_t; // default array element type
    }
    // Arithmetic expressions (contain +, -, *, /) → f32
    if (std.mem.indexOf(u8, expr, " + ") != null or
        std.mem.indexOf(u8, expr, " - ") != null or
        std.mem.indexOf(u8, expr, " * ") != null or
        std.mem.indexOf(u8, expr, " / ") != null) return .f32_t;
    // Property access on known f32 fields
    if (std.mem.indexOf(u8, expr, ".computed.") != null) return .f32_t;
    // Struct field access (s.padding, s.gap, etc.) → f32
    if (std.mem.startsWith(u8, expr, "s.") or std.mem.startsWith(u8, expr, "node.style.")) return .f32_t;
    // Pointer to children element
    if (std.mem.indexOf(u8, expr, "&node.children[") != null) return .ptr_t;
    // Boolean comparison
    if (std.mem.indexOf(u8, expr, " == ") != null or
        std.mem.indexOf(u8, expr, " != ") != null or
        std.mem.indexOf(u8, expr, " > ") != null or
        std.mem.indexOf(u8, expr, " < ") != null) return .bool_t;
    return .unknown;
}

/// Infer numeric type from variable name for "var x = 0" patterns.
/// Names suggesting counts/indices → usize, otherwise → f32.
fn inferNumericType(name: []const u8) []const u8 {
    // Short loop vars (i, j, ai, ci) → usize
    if (name.len <= 2 and name[0] >= 'a' and name[0] <= 'z') return "usize";
    // Index/count names → usize
    const usize_hints = [_][]const u8{
        "count", "Count", "idx", "Idx", "index", "Index",
        "num", "Num", "lines", "Lines", "items", "Items",
        "passes", "Passes", "depth", "Depth", "len", "Len",
        "Start", "start",
    };
    for (usize_hints) |hint| {
        if (std.mem.indexOf(u8, name, hint) != null) return "usize";
    }
    // ALL_CAPS constants → usize
    var all_upper = true;
    for (name) |ch| {
        if (ch >= 'a' and ch <= 'z') { all_upper = false; break; }
    }
    if (all_upper and name.len > 1) return "usize";
    // Everything else (accumulators, offsets, sizes) → f32
    return "f32";
}

/// Simple string replacement (all occurrences, not word-bounded).
fn replaceAll(alloc: std.mem.Allocator, text: []const u8, needle: []const u8, replacement: []const u8) std.mem.Allocator.Error![]const u8 {
    if (needle.len == 0 or text.len < needle.len) return try alloc.dupe(u8, text);
    var out: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;
    while (i <= text.len - needle.len) {
        if (std.mem.eql(u8, text[i..][0..needle.len], needle)) {
            try out.appendSlice(alloc, replacement);
            i += needle.len;
        } else {
            try out.append(alloc, text[i]);
            i += 1;
        }
    }
    while (i < text.len) : (i += 1) try out.append(alloc, text[i]);
    return try alloc.dupe(u8, out.items);
}
