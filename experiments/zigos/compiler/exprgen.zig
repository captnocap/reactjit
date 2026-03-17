//! Expression codegen — translates TypeScript expressions to Zig expressions.
//!
//! Recursive descent parser with operator precedence. Called by stmtgen
//! for every expression position (assignments, conditions, return values, arguments).
//!
//!   a.b.c           → a.b.c (with camelCase → snake_case on fields)
//!   a ?? b          → a orelse b
//!   val === null    → val == null
//!   Math.abs(x)     → @abs(x)
//!   { x: 0, y: 0 } → .{ .x = 0, .y = 0 }
//!   cond ? a : b    → if (cond) a else b
//!
//! Type-aware arithmetic: tracks ExprType through the expression tree
//! to emit minimal casts (only at f32/usize boundaries), eliminating
//! blanket asF32() wrapping.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const typegen = @import("typegen.zig");

pub const ExprContext = enum {
    value, // general expression
    condition, // inside if/while — result should be bool-compatible
    assignment, // right side of =
    return_val, // after return keyword
    argument, // function call argument (stops at , or ) at depth 0)
};

// ── Type system ────────────────────────────────────────────────────────

pub const ExprType = enum {
    f32_t, // known f32
    usize_t, // known usize (loop vars, .len, counts)
    u16_t, // known u16 (font_size, number_of_lines)
    i16_t, // known i16 (z_index)
    u8_t, // known u8 (Color components, input_id)
    opt_f32_t, // ?f32 (nullable style properties)
    bool_t, // boolean result
    int_lit, // integer literal (comptime_int — coerces to either)
    float_lit, // float literal (comptime_float)
    string_t, // string / []const u8
    enum_t, // enum value (.row, .column, etc.)
    f32_slice_t, // f32 array/slice (childBasis, childGrow, etc.)
    usize_slice_t, // usize array/slice (absoluteIndices, visibleIndices, etc.)
    bool_slice_t, // bool array/slice (frozen)
    ptr_t, // pointer type (*Node, etc.)
    struct_t, // struct value
    void_t, // void
    unknown, // can't determine

    /// Element type when indexing into a slice
    pub fn elementType(self: ExprType) ExprType {
        return switch (self) {
            .f32_slice_t => .f32_t,
            .usize_slice_t => .usize_t,
            .bool_slice_t => .bool_t,
            else => .unknown,
        };
    }

    fn isInt(self: ExprType) bool {
        return self == .usize_t or self == .u16_t or self == .i16_t or self == .u8_t;
    }

    fn isNumericLit(self: ExprType) bool {
        return self == .int_lit or self == .float_lit;
    }

    fn isF32Compatible(self: ExprType) bool {
        return self == .f32_t or self == .float_lit;
    }
};

const TypedExpr = struct {
    text: []const u8,
    ty: ExprType,
};

/// Variable type registry — maps variable names to their known types.
/// Populated by stmtgen when variables are declared.
pub const VarTypes = struct {
    names: [MAX_VARS][]const u8 = undefined,
    types: [MAX_VARS]ExprType = undefined,
    count: u32 = 0,

    const MAX_VARS = 256;

    pub fn put(self: *VarTypes, name: []const u8, ty: ExprType) void {
        // Check if already exists — update in place
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.names[i], name)) {
                self.types[i] = ty;
                return;
            }
        }
        if (self.count < MAX_VARS) {
            self.names[self.count] = name;
            self.types[self.count] = ty;
            self.count += 1;
        }
    }

    pub fn get(self: *const VarTypes, name: []const u8) ?ExprType {
        for (0..self.count) |i| {
            if (std.mem.eql(u8, self.names[i], name)) return self.types[i];
        }
        return null;
    }
};

/// Parse and emit a Zig expression from the current token position.
/// Advances pos past the consumed tokens.
/// Stops at context-appropriate terminators (semicolon, comma, closing delimiters).
pub fn emitExpression(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
) ![]const u8 {
    return emitExpressionTyped(alloc, lex, source, pos, context, null);
}

/// Type-aware variant that accepts a variable type registry.
pub fn emitExpressionTyped(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
    var_types: ?*const VarTypes,
) ![]const u8 {
    var p = Parser{
        .alloc = alloc,
        .lex = lex,
        .source = source,
        .pos = pos,
        .context = context,
        .var_types = var_types,
    };
    const result = try p.parseTernary();

    // In condition context, a property access on a nullable field implies != null check.
    // Only do this for fields known to be optional in the layout type system.
    // Skip for booleans (visible, initialized, active, done, etc.)
    if (context == .condition and isBareAccess(result.text) and std.mem.indexOf(u8, result.text, ".") != null) {
        // Only add != null for known optional fields (layout Node/Style fields)
        if (result.ty == .opt_f32_t or
            std.mem.endsWith(u8, result.text, ".text") or
            std.mem.endsWith(u8, result.text, ".image_src") or
            std.mem.endsWith(u8, result.text, ".input_id") or
            std.mem.endsWith(u8, result.text, ".placeholder") or
            std.mem.endsWith(u8, result.text, ".debug_name") or
            std.mem.endsWith(u8, result.text, ".test_id") or
            std.mem.endsWith(u8, result.text, ".canvas_type") or
            std.mem.endsWith(u8, result.text, ".background_color") or
            std.mem.endsWith(u8, result.text, ".border_color") or
            std.mem.endsWith(u8, result.text, ".text_color") or
            std.mem.endsWith(u8, result.text, ".shadow_color") or
            std.mem.endsWith(u8, result.text, ".gradient_color_end"))
        {
            return try std.fmt.allocPrint(alloc, "{s} != null", .{result.text});
        }
    }

    return result.text;
}

/// Full variant: returns both text and inferred type.
pub fn emitExpressionFull(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
    var_types: ?*const VarTypes,
) !TypedExpr {
    var p = Parser{
        .alloc = alloc,
        .lex = lex,
        .source = source,
        .pos = pos,
        .context = context,
        .var_types = var_types,
    };
    const result = try p.parseTernary();

    if (context == .condition and isBareAccess(result.text) and std.mem.indexOf(u8, result.text, ".") != null) {
        return .{ .text = try std.fmt.allocPrint(alloc, "{s} != null", .{result.text}), .ty = .bool_t };
    }

    return result;
}

/// Returns true if the string looks like a bare identifier or property chain
/// (e.g. "node", "node.text", "node.style.width") — no operators, parens, etc.
fn isBareAccess(s: []const u8) bool {
    if (s.len == 0) return false;
    for (s) |ch| {
        switch (ch) {
            'a'...'z', 'A'...'Z', '0'...'9', '_', '.' => {},
            else => return false,
        }
    }
    return true;
}

const Parser = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
    var_types: ?*const VarTypes = null,

    fn cur(self: *Parser) Token {
        return self.lex.get(self.pos.*);
    }

    fn curKind(self: *Parser) TokenKind {
        return self.cur().kind;
    }

    fn curText(self: *Parser) []const u8 {
        return self.cur().text(self.source);
    }

    fn advance(self: *Parser) void {
        if (self.curKind() != .eof) {
            self.pos.* += 1;
        }
    }

    fn expect(self: *Parser, kind: TokenKind) void {
        if (self.curKind() == kind) {
            self.advance();
        }
    }

    // ── Precedence 1: Ternary (cond ? a : b → if (cond) a else b) ──

    const Error = std.mem.Allocator.Error;

    fn parseTernary(self: *Parser) Error!TypedExpr {
        const cond = try self.parseLogicalOr();
        if (self.curKind() == .question) {
            self.advance(); // consume ?
            const then_val = try self.parseTernary();
            self.expect(.colon);
            const else_val = try self.parseTernary();
            // If condition is "X != null", add .? to references of X in then branch
            var final_then = then_val.text;
            if (std.mem.endsWith(u8, cond.text, " != null")) {
                const var_part = std.mem.trim(u8, cond.text[0 .. cond.text.len - " != null".len], " ");
                if (var_part.len > 0 and std.mem.indexOf(u8, then_val.text, var_part) != null) {
                    // Replace var_part with var_part.? in then branch
                    const unwrapped = try std.fmt.allocPrint(self.alloc, "{s}.?", .{var_part});
                    var result: std.ArrayListUnmanaged(u8) = .{};
                    var ri: usize = 0;
                    while (ri <= then_val.text.len - var_part.len) {
                        if (std.mem.eql(u8, then_val.text[ri..][0..var_part.len], var_part)) {
                            const bk = ri == 0 or !isIdentCharStatic(then_val.text[ri - 1]);
                            const ak = ri + var_part.len >= then_val.text.len or !isIdentCharStatic(then_val.text[ri + var_part.len]);
                            if (bk and ak) {
                                try result.appendSlice(self.alloc, unwrapped);
                                ri += var_part.len;
                                continue;
                            }
                        }
                        try result.append(self.alloc, then_val.text[ri]);
                        ri += 1;
                    }
                    while (ri < then_val.text.len) : (ri += 1) try result.append(self.alloc, then_val.text[ri]);
                    final_then = try self.alloc.dupe(u8, result.items);
                }
            }
            // Result type: use then branch type (both branches should agree)
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "if ({s}) {s} else {s}", .{ cond.text, final_then, else_val.text }),
                .ty = then_val.ty,
            };
        }
        return cond;
    }

    // ── Precedence 2: Logical OR (|| → or) ─────────────────────────

    fn parseLogicalOr(self: *Parser) Error!TypedExpr {
        var left = try self.parseLogicalAnd();
        while (self.curKind() == .pipe_pipe) {
            self.advance();
            const right = try self.parseLogicalAnd();
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} or {s}", .{ left.text, right.text }),
                .ty = .bool_t,
            };
        }
        return left;
    }

    // ── Precedence 3: Logical AND (&& → and) ──────────────────────

    fn parseLogicalAnd(self: *Parser) Error!TypedExpr {
        var left = try self.parseNullishCoalescing();
        while (self.curKind() == .amp_amp) {
            self.advance();
            var right = try self.parseNullishCoalescing();
            // If left is "X != null", add .? to X references in right side
            if (std.mem.endsWith(u8, left.text, " != null")) {
                const var_part = std.mem.trim(u8, left.text[0 .. left.text.len - " != null".len], " ");
                if (var_part.len > 0) {
                    const unwrapped = try std.fmt.allocPrint(self.alloc, "{s}.?", .{var_part});
                    // Simple replacement (not word-bounded since var_part may contain dots)
                    if (std.mem.indexOf(u8, right.text, var_part) != null) {
                        var result: std.ArrayListUnmanaged(u8) = .{};
                        var ri: usize = 0;
                        while (ri <= right.text.len - var_part.len) {
                            if (std.mem.eql(u8, right.text[ri..][0..var_part.len], var_part)) {
                                // Check word boundary
                                const before_ok = ri == 0 or !isIdentCharStatic(right.text[ri - 1]);
                                const after_ok = ri + var_part.len >= right.text.len or !isIdentCharStatic(right.text[ri + var_part.len]);
                                if (before_ok and after_ok) {
                                    try result.appendSlice(self.alloc, unwrapped);
                                    ri += var_part.len;
                                    continue;
                                }
                            }
                            try result.append(self.alloc, right.text[ri]);
                            ri += 1;
                        }
                        while (ri < right.text.len) : (ri += 1) try result.append(self.alloc, right.text[ri]);
                        right = .{ .text = try self.alloc.dupe(u8, result.items), .ty = right.ty };
                    }
                }
            }
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} and {s}", .{ left.text, right.text }),
                .ty = .bool_t,
            };
        }
        return left;
    }

    fn isIdentCharStatic(ch: u8) bool {
        return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_' or ch == '.';
    }

    // ── Precedence 4: Nullish coalescing (?? → orelse) ─────────────

    fn parseNullishCoalescing(self: *Parser) Error!TypedExpr {
        var left = try self.parseEquality();
        while (self.curKind() == .question_question) {
            self.advance();

            // ?? return / ?? return value / ?? break / ?? continue
            if (self.curKind() == .identifier) {
                const kw = self.curText();
                if (std.mem.eql(u8, kw, "return") or std.mem.eql(u8, kw, "break") or std.mem.eql(u8, kw, "continue")) {
                    const kw_dup = try self.alloc.dupe(u8, kw);
                    self.advance();
                    // Check for return value
                    if (std.mem.eql(u8, kw_dup, "return") and
                        self.curKind() != .semicolon and self.curKind() != .eof and self.curKind() != .rbrace)
                    {
                        const val = try self.parseTernary();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s} orelse {s} {s}", .{ left.text, kw_dup, val.text }),
                            .ty = .void_t,
                        };
                    } else {
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s} orelse {s}", .{ left.text, kw_dup }),
                            .ty = .void_t,
                        };
                    }
                    continue;
                }
            }

            const right = try self.parseEquality();
            // Unwrapping optional: ?f32 orelse f32 → f32
            const result_ty: ExprType = if (left.ty == .opt_f32_t) right.ty else left.ty;
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} orelse {s}", .{ left.text, right.text }),
                .ty = result_ty,
            };
        }
        return left;
    }

    // ── Precedence 5: Equality (===, !==) ──────────────────────────

    fn parseEquality(self: *Parser) Error!TypedExpr {
        var left = try self.parseComparison();
        while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
            const is_eq = self.curKind() == .eq_eq;
            self.advance();
            // === and !== produce eq_eq/not_eq + equals — consume the extra =
            if (self.curKind() == .equals) self.advance();

            // null/undefined on RHS
            if (self.curKind() == .identifier) {
                const rhs = self.curText();
                if (std.mem.eql(u8, rhs, "null") or std.mem.eql(u8, rhs, "undefined")) {
                    self.advance();
                    const op = if (is_eq) "==" else "!=";
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "{s} {s} null", .{ left.text, op }),
                        .ty = .bool_t,
                    };
                }
            }

            // String literal on RHS → std.mem.eql (or == for single-char)
            if (self.curKind() == .string) {
                const str_text = self.curText();
                self.advance();
                // Single-char literals (' ', '\n') → byte comparison with ==
                // str_text includes quotes: ' ' (len 3) or '\n' (len 4 with escape)
                const is_single_char = (str_text.len == 3) or
                    (str_text.len == 4 and str_text[1] == '\\');
                if (is_single_char) {
                    const op = if (is_eq) "==" else "!=";
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, str_text }),
                        .ty = .bool_t,
                    };
                }
                if (is_eq) {
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "std.mem.eql(u8, {s}, {s})", .{ left.text, str_text }),
                        .ty = .bool_t,
                    };
                } else {
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "!std.mem.eql(u8, {s}, {s})", .{ left.text, str_text }),
                        .ty = .bool_t,
                    };
                }
            }

            const right = try self.parseComparison();
            const op = if (is_eq) "==" else "!=";
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
                .ty = .bool_t,
            };
        }
        return left;
    }

    // ── Precedence 6: Comparison (<, >, <=, >=) ────────────────────
    // Type-aware: only cast when types mismatch at int/float boundary

    fn parseComparison(self: *Parser) Error!TypedExpr {
        var left = try self.parseBitwiseOr();

        // Range operator: a..b (two consecutive dots)
        if (self.curKind() == .dot and self.pos.* + 1 < self.lex.count and
            self.lex.get(self.pos.* + 1).kind == .dot)
        {
            self.advance(); // skip first .
            self.advance(); // skip second .
            const right = try self.parseBitwiseOr();
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "{s}..{s}", .{ left.text, right.text }),
                .ty = .unknown,
            };
        }

        while (true) {
            const op: []const u8 = switch (self.curKind()) {
                .lt => "<",
                .gt => ">",
                .lt_eq => "<=",
                .gt_eq => ">=",
                else => break,
            };
            self.advance();
            const right = try self.parseBitwiseOr();
            const text = try self.emitBinaryCoerced(left, right, op);
            left = .{ .text = text, .ty = .bool_t };
        }
        return left;
    }

    // ── Precedence 6b: Bitwise OR (|) ──────────────────────────────

    fn parseBitwiseOr(self: *Parser) Error!TypedExpr {
        var left = try self.parseBitwiseAnd();
        while (self.curKind() == .pipe) {
            // Don't consume | if followed by another | (logical OR ||)
            if (self.pos.* + 1 < self.lex.count and
                self.lex.get(self.pos.* + 1).kind == .pipe) break;
            // Don't consume if it's |capture| pattern (|identifier|)
            if (self.pos.* + 1 < self.lex.count and
                self.lex.get(self.pos.* + 1).kind == .identifier and
                self.pos.* + 2 < self.lex.count and
                self.lex.get(self.pos.* + 2).kind == .pipe) break;
            self.advance();
            const right = try self.parseBitwiseAnd();
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} | {s}", .{ left.text, right.text }),
                .ty = left.ty,
            };
        }
        return left;
    }

    // ── Precedence 6c: Bitwise AND (&) ──────────────────────────────

    fn parseBitwiseAnd(self: *Parser) Error!TypedExpr {
        var left = try self.parseShift();
        while (self.curKind() == .ampersand) {
            // Don't consume & if followed by another & (logical AND)
            if (self.pos.* + 1 < self.lex.count and
                self.lex.get(self.pos.* + 1).kind == .ampersand) break;
            self.advance();
            const right = try self.parseShift();
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} & {s}", .{ left.text, right.text }),
                .ty = left.ty,
            };
        }
        return left;
    }

    // ── Precedence 6d: Shift (<<, >>) ──────────────────────────────

    fn parseShift(self: *Parser) Error!TypedExpr {
        var left = try self.parseAdditive();
        while (self.curKind() == .shift_left or self.curKind() == .shift_right) {
            const op: []const u8 = if (self.curKind() == .shift_left) "<<" else ">>";
            self.advance();
            const right = try self.parseAdditive();
            left = .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
                .ty = left.ty,
            };
        }
        return left;
    }

    // ── Precedence 7: Additive (+, -) ──────────────────────────────
    // Type-aware: propagates types, only casts at boundaries

    fn parseAdditive(self: *Parser) Error!TypedExpr {
        var left = try self.parseMultiplicative();
        while (self.curKind() == .plus or self.curKind() == .minus or self.curKind() == .wrap_add or self.curKind() == .wrap_sub) {
            // Don't consume + or - if followed by = (compound assignment handled by stmtgen)
            if ((self.curKind() == .plus or self.curKind() == .minus) and
                self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .equals) break;
            // Don't consume if it's ++ or -- (postfix, handled elsewhere)
            if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == self.curKind()) break;
            const op: []const u8 = if (self.curKind() == .wrap_add) "+%" else if (self.curKind() == .wrap_sub) "-%" else if (self.curKind() == .plus) "+" else "-";
            self.advance();
            const right = try self.parseMultiplicative();
            const coerced = try self.emitArithCoerced(left, right, op);
            left = coerced;
        }
        return left;
    }

    // ── Precedence 8: Multiplicative (*, /, %) ─────────────────────
    // Type-aware: propagates types, only casts at boundaries

    fn parseMultiplicative(self: *Parser) Error!TypedExpr {
        var left = try self.parseUnary();
        while (self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent or self.curKind() == .wrap_mul) {
            // Don't consume * / % if followed by = (compound assignment)
            if ((self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent) and
                self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .equals) break;
            const op: []const u8 = switch (self.curKind()) {
                .star => "*",
                .slash => "/",
                .percent => "%",
                .wrap_mul => "*%",
                else => unreachable,
            };
            self.advance();
            const right = try self.parseUnary();
            const coerced = try self.emitArithCoerced(left, right, op);
            left = coerced;
        }
        return left;
    }

    /// Emit a binary arithmetic expression with type-aware coercion.
    /// Returns a TypedExpr with the result type.
    fn emitArithCoerced(self: *Parser, left: TypedExpr, right: TypedExpr, op: []const u8) Error!TypedExpr {
        // DEBUG: uncomment to trace type coercion
        // std.debug.print("ARITH: {s}({s}) {s} {s}({s})\n", .{ left.text, @tagName(left.ty), op, right.text, @tagName(right.ty) });

        // Same type → no cast needed
        if (left.ty == right.ty and left.ty != .unknown) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
                .ty = left.ty,
            };
        }

        // One is a comptime literal → coerces to the other's type
        if (left.ty.isNumericLit() and right.ty != .unknown) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
                .ty = if (right.ty.isNumericLit()) left.ty else right.ty,
            };
        }
        if (right.ty.isNumericLit() and left.ty != .unknown) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
                .ty = left.ty,
            };
        }

        // f32 mixed with integer type → cast the integer side
        if (left.ty.isF32Compatible() and right.ty.isInt()) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "{s} {s} @as(f32, @floatFromInt({s}))", .{ left.text, op, right.text }),
                .ty = .f32_t,
            };
        }
        if (left.ty.isInt() and right.ty.isF32Compatible()) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s})) {s} {s}", .{ left.text, op, right.text }),
                .ty = .f32_t,
            };
        }

        // Optional f32 in arithmetic → fall through to asF32() fallback.
        // The stmtgen null-narrowing adds .? inside null-guarded blocks,
        // converting ?f32 to f32 naturally. For unguarded uses, asF32()
        // handles optionals at runtime (unwraps with orelse 0).
        if (left.ty == .opt_f32_t or right.ty == .opt_f32_t) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "asF32({s}) {s} asF32({s})", .{ left.text, op, right.text }),
                .ty = .f32_t,
            };
        }

        // Both int types but different widths → cast narrower to wider
        if (left.ty.isInt() and right.ty.isInt()) {
            // Both are integer, but different. Cast to the wider one.
            // usize is widest, then u16/i16, then u8
            const wider = if (left.ty == .usize_t or right.ty == .usize_t) ExprType.usize_t else left.ty;
            if (left.ty == wider) {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s} {s} @as({s}, @intCast({s}))", .{ left.text, op, zigTypeStr(wider), right.text }),
                    .ty = wider,
                };
            } else {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "@as({s}, @intCast({s})) {s} {s}", .{ zigTypeStr(wider), left.text, op, right.text }),
                    .ty = wider,
                };
            }
        }

        // Fallback: both unknown → pass through without wrapping.
        // Let the Zig compiler handle type checking.
        return .{
            .text = try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text }),
            .ty = .unknown,
        };
    }

    /// Emit a binary comparison expression with type-aware coercion.
    /// Returns the coerced text (result type is always bool).
    fn emitBinaryCoerced(self: *Parser, left: TypedExpr, right: TypedExpr, op: []const u8) Error![]const u8 {
        // Same type → no cast
        if (left.ty == right.ty and left.ty != .unknown) {
            return try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text });
        }

        // One is a comptime literal → coerces naturally
        if (left.ty.isNumericLit() or right.ty.isNumericLit()) {
            return try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text });
        }

        // f32 mixed with integer → cast the integer side
        if (left.ty.isF32Compatible() and right.ty.isInt()) {
            return try std.fmt.allocPrint(self.alloc, "{s} {s} @as(f32, @floatFromInt({s}))", .{ left.text, op, right.text });
        }
        if (left.ty.isInt() and right.ty.isF32Compatible()) {
            return try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s})) {s} {s}", .{ left.text, op, right.text });
        }

        // Optional f32 in comparison → asF32 fallback (handles ?f32 at runtime)
        if (left.ty == .opt_f32_t or right.ty == .opt_f32_t) {
            return try std.fmt.allocPrint(self.alloc, "asF32({s}) {s} asF32({s})", .{ left.text, op, right.text });
        }

        // Both int but different widths → cast
        if (left.ty.isInt() and right.ty.isInt()) {
            const wider = if (left.ty == .usize_t or right.ty == .usize_t) ExprType.usize_t else left.ty;
            if (left.ty == wider) {
                return try std.fmt.allocPrint(self.alloc, "{s} {s} @as({s}, @intCast({s}))", .{ left.text, op, zigTypeStr(wider), right.text });
            } else {
                return try std.fmt.allocPrint(self.alloc, "@as({s}, @intCast({s})) {s} {s}", .{ zigTypeStr(wider), left.text, op, right.text });
            }
        }

        // Fallback: both unknown → pass through without wrapping
        return try std.fmt.allocPrint(self.alloc, "{s} {s} {s}", .{ left.text, op, right.text });
    }

    // ── Precedence 9: Unary (!, -, typeof) ─────────────────────────

    fn parseUnary(self: *Parser) Error!TypedExpr {
        if (self.curKind() == .bang) {
            self.advance();
            const operand = try self.parseUnary();
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "!{s}", .{operand.text}),
                .ty = .bool_t,
            };
        }
        if (self.curKind() == .minus) {
            self.advance();
            const operand = try self.parseUnary();
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "-{s}", .{operand.text}),
                .ty = operand.ty,
            };
        }
        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "typeof")) {
            self.advance();
            const operand = try self.parsePostfix();
            return .{ .text = operand.text, .ty = .string_t };
        }
        return try self.parsePostfix();
    }

    // ── Precedence 10: Postfix / Call / Member access ──────────────

    fn parsePostfix(self: *Parser) Error!TypedExpr {
        var left = try self.parsePrimary();

        while (true) {
            switch (self.curKind()) {
                // Property access: a.b, or anonymous init: a.{ ... }
                // But NOT range operator: a..b (two consecutive dots)
                .dot => {
                    // Check for .. range — if next token is also dot, break and let comparison handle it
                    if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .dot) break;
                    self.advance();
                    // .{ ... } — Zig anonymous struct/tuple literal
                    if (self.curKind() == .lbrace) {
                        const obj = try self.parseObjectLiteral();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}{s}", .{ left.text, obj }),
                            .ty = .struct_t,
                        };
                        continue;
                    }
                    // .* — Zig pointer dereference
                    if (self.curKind() == .star) {
                        self.advance();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}.*", .{left.text}),
                            .ty = .unknown,
                        };
                        continue;
                    }
                    // .? — Zig optional unwrap
                    if (self.curKind() == .question) {
                        self.advance();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}.?", .{left.text}),
                            .ty = .unknown,
                        };
                        continue;
                    }
                    if (self.curKind() != .identifier) break;
                    const prop = self.curText();
                    self.advance();

                    // .length → .len (always usize)
                    if (std.mem.eql(u8, prop, "length")) {
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}.len", .{left.text}),
                            .ty = .usize_t,
                        };
                        continue;
                    }

                    // .slice(a, b) → [@intCast(a)..@intCast(b)]
                    if (std.mem.eql(u8, prop, "slice") and self.curKind() == .lparen) {
                        self.advance(); // (
                        const saved = self.context;
                        self.context = .argument;
                        const arg_a = try self.parseTernary();
                        self.expect(.comma);
                        const arg_b = try self.parseTernary();
                        self.context = saved;
                        self.expect(.rparen);
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}[@intCast({s})..@intCast({s})]", .{ left.text, arg_a.text, arg_b.text }),
                            .ty = left.ty,
                        };
                        continue;
                    }

                    // Regular property — camelCase → snake_case for struct fields,
                    // but NOT for method calls, std.* chains, ALL_CAPS, or c.* chains
                    const is_method_call = self.curKind() == .lparen;
                    const is_std_chain = std.mem.startsWith(u8, left.text, "std.");
                    const is_c_chain = std.mem.startsWith(u8, left.text, "c.") or std.mem.eql(u8, left.text, "c");
                    const is_wgpu_chain = std.mem.startsWith(u8, left.text, "wgpu.") or std.mem.eql(u8, left.text, "wgpu");
                    const is_error_chain = std.mem.startsWith(u8, left.text, "error.");
                    const is_all_caps = blk: {
                        for (prop) |ch| {
                            if (ch >= 'a' and ch <= 'z') break :blk false;
                        }
                        break :blk prop.len > 1;
                    };
                    const snake = if (is_method_call or is_std_chain or is_c_chain or is_wgpu_chain or is_error_chain or is_all_caps)
                        try self.alloc.dupe(u8, prop)
                    else
                        try camelToSnake(self.alloc, prop);
                    const full_path = try std.fmt.allocPrint(self.alloc, "{s}.{s}", .{ left.text, snake });
                    // Check VarTypes for full dotted path first (null-narrowed vars like s.width → f32)
                    const field_ty = if (self.var_types) |vt|
                        (vt.get(full_path) orelse resolveFieldType(snake))
                    else
                        resolveFieldType(snake);
                    left = .{
                        .text = full_path,
                        .ty = field_ty,
                    };
                },

                // Index access: a[i] → a[@intCast(i)]
                // Slice access: a[x..y] → a[x..y]
                .lbracket => {
                    self.advance();

                    // Look ahead for slice syntax: check if there's a .. before the ]
                    const is_slice = blk: {
                        var scan = self.pos.*;
                        var depth: u32 = 1;
                        while (scan < self.lex.count) {
                            const sk = self.lex.get(scan).kind;
                            if (sk == .lbracket) depth += 1;
                            if (sk == .rbracket) {
                                depth -= 1;
                                if (depth == 0) break;
                            }
                            // Two consecutive dots = slice range
                            if (sk == .dot and scan + 1 < self.lex.count and
                                self.lex.get(scan + 1).kind == .dot and depth == 1)
                            {
                                break :blk true;
                            }
                            scan += 1;
                        }
                        break :blk false;
                    };

                    if (is_slice) {
                        // Parse start expression with postfix (handles prefix.len etc.)
                        // parsePostfix stops at .. because . followed by . isn't an identifier
                        const start_expr = try self.parsePostfix();

                        // Consume ..
                        if (self.curKind() == .dot) self.advance();
                        if (self.curKind() == .dot) self.advance();

                        if (self.curKind() == .rbracket) {
                            // Open-ended slice: a[x..]
                            self.advance();
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s}[{s}..]", .{ left.text, start_expr.text }),
                                .ty = left.ty,
                            };
                        } else {
                            // Range slice: a[x..y] — use full expression for end
                            const saved2 = self.context;
                            self.context = .value;
                            const end_final = try self.parseTernary();
                            self.context = saved2;
                            self.expect(.rbracket);
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s}[{s}..{s}]", .{ left.text, start_expr.text, end_final.text }),
                                .ty = left.ty,
                            };
                        }
                    } else {
                        const saved = self.context;
                        self.context = .value;
                        const idx = try self.parseTernary();
                        self.context = saved;
                        self.expect(.rbracket);
                        // Resolve element type from container type
                        const elem_ty = left.ty.elementType();
                        // Only @intCast when index is known f32 (TS number → needs cast to usize)
                        // For usize, int_lit, and unknown types, pass through directly
                        const needs_cast = idx.ty == .f32_t or idx.ty == .opt_f32_t;
                        const idx_text = if (needs_cast)
                            try std.fmt.allocPrint(self.alloc, "@intCast({s})", .{idx.text})
                        else
                            idx.text;
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}[{s}]", .{ left.text, idx_text }),
                            .ty = elem_ty,
                        };
                    }
                },

                // Function call: a(x, y)
                .lparen => {
                    const result = try self.parseCallArgsTyped(left.text);
                    left = result;
                },

                // Named struct init: TypeName{ .field = val }
                .lbrace => {
                    // Check if left looks like a type — PascalCase, or pkg.TypeName
                    const lt = left.text;
                    const last_component = if (std.mem.lastIndexOf(u8, lt, ".")) |di| lt[di + 1 ..] else lt;
                    const is_type = (last_component.len > 0 and last_component[0] >= 'A' and last_component[0] <= 'Z') or
                        std.mem.startsWith(u8, lt, "std.");
                    if (is_type) {
                        // parseObjectLiteral returns ".{ ... }" — strip the leading "." for named init
                        const obj = try self.parseObjectLiteral();
                        // obj starts with ".{" — we want "{" for named struct init (TypeName{...})
                        const body = if (obj.len > 1 and obj[0] == '.') obj[1..] else obj;
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}{s}", .{ left.text, body }),
                            .ty = .struct_t,
                        };
                    } else break;
                },

                // Postfix ++
                .plus => {
                    if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .plus) {
                        self.advance();
                        self.advance();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s} += 1", .{left.text}),
                            .ty = left.ty,
                        };
                    } else break;
                },

                // Postfix --
                .minus => {
                    if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .minus) {
                        self.advance();
                        self.advance();
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s} -= 1", .{left.text}),
                            .ty = left.ty,
                        };
                    } else break;
                },

                // Type assertion: x as number → @as(f32, x)
                // catch: expr catch return / expr catch |err| { ... } / expr catch value
                .identifier => {
                    if (std.mem.eql(u8, self.curText(), "as")) {
                        self.advance();
                        const type_name = self.curText();
                        self.advance();
                        const zig_type = mapTsType(type_name);
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "@as({s}, {s})", .{ zig_type, left.text }),
                            .ty = mapTsTypeToExprType(type_name),
                        };
                    } else if (std.mem.eql(u8, self.curText(), "catch")) {
                        self.advance(); // skip "catch"

                        // catch { ... } — block (empty or with statements)
                        if (self.curKind() == .lbrace) {
                            const stmtgen = @import("stmtgen.zig");
                            const body = try stmtgen.emitBlock(self.alloc, self.lex, self.source, self.pos, 0);
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s} catch {s}", .{ left.text, body }),
                                .ty = left.ty,
                            };
                        }
                        // catch |err| { ... } — capture variable
                        else if (self.curKind() == .pipe) {
                            self.advance(); // skip |
                            const capture_name = self.curText();
                            self.advance(); // skip name
                            if (self.curKind() == .pipe) self.advance(); // skip |

                            // Collect the block/expression
                            const body = try self.parseTernary();
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s} catch |{s}| {s}", .{ left.text, capture_name, body.text }),
                                .ty = left.ty,
                            };
                        } else if (self.curKind() == .identifier and (std.mem.eql(u8, self.curText(), "return") or std.mem.eql(u8, self.curText(), "break") or std.mem.eql(u8, self.curText(), "continue"))) {
                            // catch return / catch return <value> / catch break / catch continue
                            const kw = try self.alloc.dupe(u8, self.curText());
                            self.advance(); // skip keyword
                            if (self.curKind() == .semicolon or self.curKind() == .eof or self.curKind() == .rbrace) {
                                left = .{
                                    .text = try std.fmt.allocPrint(self.alloc, "{s} catch {s}", .{ left.text, kw }),
                                    .ty = .void_t,
                                };
                            } else {
                                const ret_val = try self.parseTernary();
                                left = .{
                                    .text = try std.fmt.allocPrint(self.alloc, "{s} catch {s} {s}", .{ left.text, kw, ret_val.text }),
                                    .ty = left.ty,
                                };
                            }
                        } else {
                            // catch <expr>
                            const catch_val = try self.parseTernary();
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s} catch {s}", .{ left.text, catch_val.text }),
                                .ty = left.ty,
                            };
                        }
                    } else break;
                },

                else => break,
            }
        }

        return left;
    }

    fn parseCallArgsTyped(self: *Parser, callee: []const u8) Error!TypedExpr {
        self.advance(); // consume (

        var args = std.ArrayListUnmanaged([]const u8){};
        const saved = self.context;
        self.context = .argument;
        var arg_idx: u32 = 0;

        while (self.curKind() != .rparen and self.curKind() != .eof) {
            const arg = try self.parseTernary();
            // Auto-add & for arguments passed to pointer params (struct → *Struct coercion)
            const stmtgen = @import("stmtgen.zig");
            const need_ref = stmtgen.isFnParamPtr(callee, arg_idx);
            if (need_ref and !std.mem.startsWith(u8, arg.text, "&")) {
                try args.append(self.alloc, try std.fmt.allocPrint(self.alloc, "&{s}", .{arg.text}));
            } else {
                try args.append(self.alloc, arg.text);
            }
            arg_idx += 1;
            if (self.curKind() == .comma) self.advance();
        }
        self.context = saved;
        self.expect(.rparen);

        const joined = try joinArgs(self.alloc, args.items);

        // Math builtins
        if (callee.len > 5 and std.mem.eql(u8, callee[0..5], "Math.")) {
            const method = callee[5..];
            const builtin: ?[]const u8 = if (std.mem.eql(u8, method, "abs"))
                "@abs"
            else if (std.mem.eql(u8, method, "max"))
                "@max"
            else if (std.mem.eql(u8, method, "min"))
                "@min"
            else if (std.mem.eql(u8, method, "floor"))
                "@floor"
            else if (std.mem.eql(u8, method, "ceil"))
                "@ceil"
            else if (std.mem.eql(u8, method, "sqrt"))
                "@sqrt"
            else
                null;

            if (builtin) |b| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ b, joined }),
                    .ty = .f32_t, // Math builtins return f32
                };
            }
        }

        // Infer return type from known function names
        const ret_type = resolveCallReturnType(callee);
        return .{
            .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ callee, joined }),
            .ty = ret_type,
        };
    }

    // ── Precedence 11: Primary ─────────────────────────────────────

    fn parsePrimary(self: *Parser) Error!TypedExpr {
        switch (self.curKind()) {
            .number => {
                const text = self.curText();
                self.advance();
                // Determine if integer or float literal
                const is_float = std.mem.indexOf(u8, text, ".") != null;
                return .{
                    .text = try self.alloc.dupe(u8, text),
                    .ty = if (is_float) .float_lit else .int_lit,
                };
            },

            .string => {
                const text = self.curText();
                self.advance();
                // Single-quoted → double-quoted
                if (text.len >= 2 and text[0] == '\'') {
                    var buf = try self.alloc.alloc(u8, text.len);
                    buf[0] = '"';
                    @memcpy(buf[1 .. buf.len - 1], text[1 .. text.len - 1]);
                    buf[buf.len - 1] = '"';
                    return .{ .text = buf, .ty = .string_t };
                }
                return .{ .text = try self.alloc.dupe(u8, text), .ty = .string_t };
            },

            .template_literal => {
                const text = self.curText();
                self.advance();
                return .{
                    .text = try emitTemplateLiteral(self.alloc, text),
                    .ty = .string_t,
                };
            },

            .identifier => {
                const text = self.curText();

                // true / false
                if (std.mem.eql(u8, text, "true") or std.mem.eql(u8, text, "false")) {
                    self.advance();
                    return .{ .text = try self.alloc.dupe(u8, text), .ty = .bool_t };
                }

                // null → null
                if (std.mem.eql(u8, text, "null")) {
                    self.advance();
                    return .{ .text = try self.alloc.dupe(u8, "null"), .ty = .opt_f32_t };
                }
                // undefined → undefined (Zig uninitialized) in assignment, null elsewhere
                if (std.mem.eql(u8, text, "undefined")) {
                    self.advance();
                    if (self.context == .assignment) {
                        return .{ .text = try self.alloc.dupe(u8, "undefined"), .ty = .unknown };
                    }
                    return .{ .text = try self.alloc.dupe(u8, "null"), .ty = .opt_f32_t };
                }

                // switch-expression: switch (val) { case .a: expr; break; ... }
                if (std.mem.eql(u8, text, "switch")) {
                    self.advance(); // skip 'switch'

                    // Parse discriminant in parens
                    self.expect(.lparen);
                    const disc = try self.parseTernary();
                    self.expect(.rparen);

                    self.expect(.lbrace);

                    var arms = std.ArrayListUnmanaged([]const u8){};
                    var result_ty: ExprType = .unknown;

                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "case")) {
                            self.advance(); // skip 'case'

                            // Parse case value (collect until : or |)
                            var case_val = std.ArrayListUnmanaged(u8){};
                            while (self.curKind() != .colon and self.curKind() != .pipe and self.curKind() != .eof) {
                                try case_val.appendSlice(self.alloc, self.curText());
                                self.advance();
                            }

                            // Check for |capture|
                            var arm_capture: ?[]const u8 = null;
                            if (self.curKind() == .colon) self.advance(); // skip :
                            if (self.curKind() == .pipe) {
                                self.advance(); // skip |
                                arm_capture = self.curText();
                                self.advance();
                                if (self.curKind() == .pipe) self.advance(); // skip |
                            }

                            // Parse arm value expression
                            const arm_val = try self.parseTernary();
                            if (result_ty == .unknown) result_ty = arm_val.ty;

                            // Skip break and semicolons
                            if (self.curKind() == .semicolon) self.advance();
                            if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "break")) {
                                self.advance();
                                if (self.curKind() == .semicolon) self.advance();
                            }

                            // Convert case value to Zig enum
                            const cv = try self.alloc.dupe(u8, case_val.items);
                            // Check if it's a number literal
                            const is_num = cv.len > 0 and (cv[0] >= '0' and cv[0] <= '9');
                            const zig_case = if (is_num) cv
                                else if (std.mem.indexOf(u8, cv, ".")) |dot| blk: {
                                    const variant = cv[dot + 1 ..];
                                    break :blk try std.fmt.allocPrint(self.alloc, ".{s}", .{variant});
                                } else try std.fmt.allocPrint(self.alloc, ".{s}", .{cv});

                            if (arm_capture) |cap| {
                                try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "{s} => |{s}| {s}", .{ zig_case, cap, arm_val.text }));
                            } else {
                                try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "{s} => {s}", .{ zig_case, arm_val.text }));
                            }
                        } else if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "default")) {
                            self.advance(); // skip 'default'
                            if (self.curKind() == .colon) self.advance(); // skip :

                            const arm_val = try self.parseTernary();
                            if (result_ty == .unknown) result_ty = arm_val.ty;

                            if (self.curKind() == .semicolon) self.advance();
                            if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "break")) {
                                self.advance();
                                if (self.curKind() == .semicolon) self.advance();
                            }

                            try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "else => {s}", .{arm_val.text}));
                        } else {
                            self.advance(); // skip unknown token
                        }
                    }
                    self.expect(.rbrace);

                    // Build switch expression
                    var out = std.ArrayListUnmanaged(u8){};
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "switch ({s}) {{ ", .{disc.text}));
                    for (arms.items, 0..) |arm, ai| {
                        if (ai > 0) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, arm);
                    }
                    try out.appendSlice(self.alloc, " }");

                    return .{
                        .text = try self.alloc.dupe(u8, out.items),
                        .ty = result_ty,
                    };
                }

                // if-expression: if (cond) then_val else else_val
                // Also handles: if (optional) |capture| then_val else else_val
                if (std.mem.eql(u8, text, "if")) {
                    self.advance(); // skip 'if'

                    // Parse condition in parens
                    self.expect(.lparen);
                    const cond = try self.parseTernary();
                    self.expect(.rparen);

                    // Check for |capture|
                    var capture: ?[]const u8 = null;
                    if (self.curKind() == .pipe) {
                        self.advance(); // skip |
                        capture = self.curText();
                        self.advance(); // skip name
                        if (self.curKind() == .pipe) self.advance(); // skip |
                    }

                    // Parse then-value
                    const then_val = try self.parseTernary();

                    // Expect 'else'
                    var else_val: ?[]const u8 = null;
                    if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "else")) {
                        self.advance(); // skip 'else'
                        const ev = try self.parseTernary();
                        else_val = ev.text;
                    }

                    if (capture) |cap| {
                        if (else_val) |ev| {
                            return .{
                                .text = try std.fmt.allocPrint(self.alloc, "if ({s}) |{s}| {s} else {s}", .{ cond.text, cap, then_val.text, ev }),
                                .ty = then_val.ty,
                            };
                        }
                        return .{
                            .text = try std.fmt.allocPrint(self.alloc, "if ({s}) |{s}| {s}", .{ cond.text, cap, then_val.text }),
                            .ty = then_val.ty,
                        };
                    }

                    if (else_val) |ev| {
                        return .{
                            .text = try std.fmt.allocPrint(self.alloc, "if ({s}) {s} else {s}", .{ cond.text, then_val.text, ev }),
                            .ty = then_val.ty,
                        };
                    }
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "if ({s}) {s}", .{ cond.text, then_val.text }),
                        .ty = then_val.ty,
                    };
                }

                // comptime prefix — passthrough to Zig
                if (std.mem.eql(u8, text, "comptime")) {
                    self.advance();
                    const inner = try self.parseTernary();
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "comptime {s}", .{inner.text}),
                        .ty = inner.ty,
                    };
                }

                // try prefix — passthrough to Zig
                if (std.mem.eql(u8, text, "try")) {
                    self.advance();
                    const inner = try self.parseTernary();
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "try {s}", .{inner.text}),
                        .ty = inner.ty,
                    };
                }

                // new Array(N) → std.mem.zeroes([N]f32)
                if (std.mem.eql(u8, text, "new")) {
                    self.advance();
                    if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "Array")) {
                        self.advance();
                        self.expect(.lparen);
                        const size = self.curText();
                        self.advance();
                        self.expect(.rparen);
                        return .{
                            .text = try std.fmt.allocPrint(self.alloc, "std.mem.zeroes([{s}]f32)", .{size}),
                            .ty = .unknown,
                        };
                    }
                    return .{ .text = try self.alloc.dupe(u8, "new"), .ty = .unknown };
                }

                // PascalCase.Variant → .variant (enum access)
                // But NOT PascalCase.method() (namespace call like Math.abs)
                if (text.len > 0 and text[0] >= 'A' and text[0] <= 'Z') {
                    if (self.pos.* + 2 < self.lex.count and
                        self.lex.get(self.pos.* + 1).kind == .dot and
                        self.lex.get(self.pos.* + 2).kind == .identifier)
                    {
                        // Check if the member is followed by ( → method call, not enum
                        const after_member = if (self.pos.* + 3 < self.lex.count)
                            self.lex.get(self.pos.* + 3).kind
                        else
                            TokenKind.eof;

                        if (after_member != .lparen) {
                            // Enum access: FlexDirection.Row → .row
                            self.advance(); // skip type name
                            self.advance(); // skip .
                            const variant = self.curText();
                            self.advance(); // skip variant
                            const snake = try camelToSnake(self.alloc, variant);
                            // Lowercase the first char for Zig enum convention
                            const lowered = try lowerFirst(self.alloc, snake);
                            return .{
                                .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{lowered}),
                                .ty = .enum_t,
                            };
                        }
                    }
                    // PascalCase identifier without enum access — could be type, namespace, or ALL_CAPS const
                    self.advance();
                    const upper_ty = self.resolveVarType(text);
                    return .{ .text = try self.alloc.dupe(u8, text), .ty = upper_ty };
                }

                // Regular identifier — keep original name, escape Zig keywords.
                // Exception: 'error' followed by '.' is the error namespace, not a variable.
                self.advance();
                const is_error_ns = std.mem.eql(u8, text, "error") and self.curKind() == .dot;
                const zig_name = if (!is_error_ns and typegen.isZigKeyword(text))
                    try std.fmt.allocPrint(self.alloc, "@\"{s}\"", .{text})
                else
                    try self.alloc.dupe(u8, text);

                // Look up variable type in the registry
                const var_ty = self.resolveVarType(text);

                return .{ .text = zig_name, .ty = var_ty };
            },

            // Parenthesized expression
            .lparen => {
                self.advance();
                const saved = self.context;
                self.context = .value;
                const inner = try self.parseTernary();
                self.context = saved;
                self.expect(.rparen);
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "({s})", .{inner.text}),
                    .ty = inner.ty,
                };
            },

            // Anonymous struct/tuple literal: .{ x, y } or .{ .field = val }
            .dot => {
                if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .lbrace) {
                    self.advance(); // skip .
                    const obj = try self.parseObjectLiteral();
                    return .{ .text = obj, .ty = .struct_t };
                }
                // Bare .variant (enum literal) or .@"escaped" (Zig escaped enum)
                self.advance();
                if (self.curKind() == .identifier) {
                    const variant = self.curText();
                    self.advance();
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{variant}),
                        .ty = .enum_t,
                    };
                }
                if (self.curKind() == .builtin) {
                    // .@"2d" etc — pass through as-is
                    const escaped = self.curText();
                    self.advance();
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{escaped}),
                        .ty = .enum_t,
                    };
                }
                return .{ .text = try self.alloc.dupe(u8, "."), .ty = .unknown };
            },

            // Address-of: &x → &x (unary prefix)
            .ampersand => {
                self.advance();
                const inner = try self.parsePostfix();
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "&{s}", .{inner.text}),
                    .ty = .ptr_t,
                };
            },

            // Object literal: { x: 0, y: 0 } → .{ .x = 0, .y = 0 }
            .lbrace => {
                const text = try self.parseObjectLiteral();
                return .{ .text = text, .ty = .struct_t };
            },

            // Array literal: [a, b, c] → .{ a, b, c }
            .lbracket => {
                const text = try self.parseArrayLiteral();
                return .{ .text = text, .ty = .unknown };
            },

            // Zig builtins: @bitCast(x), @memcpy(dst, src), @intCast(v), etc.
            .builtin => {
                const name = self.curText();
                self.advance();
                if (self.curKind() == .lparen) {
                    self.advance(); // consume (
                    var args = std.ArrayListUnmanaged([]const u8){};
                    const saved = self.context;
                    self.context = .argument;
                    while (self.curKind() != .rparen and self.curKind() != .eof) {
                        const arg = try self.parseTernary();
                        try args.append(self.alloc, arg.text);
                        if (self.curKind() == .comma) self.advance();
                    }
                    self.context = saved;
                    self.expect(.rparen);
                    const joined = try joinArgs(self.alloc, args.items);
                    // Infer return type for common builtins
                    const ret_ty: ExprType = if (std.mem.eql(u8, name, "@floatFromInt") or std.mem.eql(u8, name, "@floatCast"))
                        .f32_t
                    else if (std.mem.eql(u8, name, "@intFromFloat") or std.mem.eql(u8, name, "@intCast"))
                        .usize_t
                    else if (std.mem.eql(u8, name, "@intFromBool"))
                        .usize_t
                    else if (std.mem.eql(u8, name, "@abs") or std.mem.eql(u8, name, "@max") or
                        std.mem.eql(u8, name, "@min") or std.mem.eql(u8, name, "@floor") or
                        std.mem.eql(u8, name, "@ceil") or std.mem.eql(u8, name, "@sqrt"))
                        .f32_t
                    else
                        .unknown;
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ name, joined }),
                        .ty = ret_ty,
                    };
                }
                // Bare builtin without parens (e.g., @import used as value)
                return .{ .text = try self.alloc.dupe(u8, name), .ty = .unknown };
            },

            else => {
                if (self.curKind() != .eof) {
                    const text = self.curText();
                    self.advance();
                    return .{ .text = try self.alloc.dupe(u8, text), .ty = .unknown };
                }
                return .{ .text = try self.alloc.dupe(u8, ""), .ty = .unknown };
            },
        }
    }

    /// Resolve the type of a variable from the registry or by name heuristics.
    fn resolveVarType(self: *Parser, name: []const u8) ExprType {
        // First check the explicit registry
        if (self.var_types) |vt| {
            if (vt.get(name)) |ty| return ty;
        }

        // Heuristic: well-known variable names in layout code
        // Short loop vars (i, j, k) → usize
        if (name.len == 1 and name[0] >= 'a' and name[0] <= 'z') {
            return switch (name[0]) {
                'i', 'j', 'k', 'n' => .usize_t,
                else => .unknown,
            };
        }

        // camelCase names that suggest counts/indices → usize
        if (containsAny(name, &.{
            "count", "Count", "idx", "Idx", "index", "Index",
            "num", "Num", "Lines", "Items", "Passes",
            "depth", "Depth", "Len", "Start", "start",
        })) return .usize_t;

        // ALL_CAPS → usize (constants like LAYOUT_BUDGET)
        if (isAllCaps(name) and name.len > 1) return .usize_t;

        return .unknown;
    }

    fn parseObjectLiteral(self: *Parser) Error![]const u8 {
        self.advance(); // consume {
        var fields = std.ArrayListUnmanaged([]const u8){};

        while (self.curKind() != .rbrace and self.curKind() != .eof) {
            // Zig-style: .field = value (dot-prefixed field names)
            if (self.curKind() == .dot and self.pos.* + 1 < self.lex.count and
                self.lex.get(self.pos.* + 1).kind == .identifier)
            {
                self.advance(); // skip .
                const key = self.curText();
                self.advance(); // skip field name
                if (self.curKind() == .equals) {
                    self.advance(); // skip =
                    const saved = self.context;
                    self.context = .argument;
                    const val = try self.parseTernary();
                    self.context = saved;
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ key, val.text }));
                } else {
                    // .field (shorthand)
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s}", .{key}));
                }
            } else if (self.curKind() == .identifier) {
                const key = self.curText();

                if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .colon) {
                    // key: value (TS-style) — identifier followed by :
                    self.advance(); // skip key
                    self.advance(); // skip :
                    const saved = self.context;
                    self.context = .argument;
                    const val = try self.parseTernary();
                    self.context = saved;
                    const snake = try camelToSnake(self.alloc, key);
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, val.text }));
                } else if (self.pos.* + 1 < self.lex.count and
                    (self.lex.get(self.pos.* + 1).kind == .dot or
                    self.lex.get(self.pos.* + 1).kind == .lbracket or
                    self.lex.get(self.pos.* + 1).kind == .lparen))
                {
                    // Expression: identifier followed by . or [ or ( → positional value
                    const saved3 = self.context;
                    self.context = .argument;
                    const val = try self.parseTernary();
                    self.context = saved3;
                    try fields.append(self.alloc, val.text);
                } else {
                    self.advance();
                    // Check for comma/rbrace → shorthand: { r } → .{ .r = r }
                    if (self.curKind() == .comma or self.curKind() == .rbrace) {
                        const snake = try camelToSnake(self.alloc, key);
                        try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, key }));
                    } else {
                        // Unknown pattern — treat as positional with already-consumed token
                        try fields.append(self.alloc, try self.alloc.dupe(u8, key));
                    }
                }
            } else {
                // Positional value (tuple literal): .{ expr, expr }
                const saved2 = self.context;
                self.context = .argument;
                const val = try self.parseTernary();
                self.context = saved2;
                try fields.append(self.alloc, val.text);
            }

            if (self.curKind() == .comma) self.advance();
        }
        self.expect(.rbrace);

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try joinArgs(self.alloc, fields.items)});
    }

    fn parseArrayLiteral(self: *Parser) Error![]const u8 {
        self.advance(); // consume [
        var elems = std.ArrayListUnmanaged([]const u8){};
        const saved = self.context;
        self.context = .argument;

        while (self.curKind() != .rbracket and self.curKind() != .eof) {
            const val = try self.parseTernary();
            try elems.append(self.alloc, val.text);
            if (self.curKind() == .comma) self.advance();
        }
        self.context = saved;
        self.expect(.rbracket);

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try joinArgs(self.alloc, elems.items)});
    }
};

// ── Type resolution helpers ────────────────────────────────────────────

/// Resolve the type of a known struct field by its snake_case name.
fn resolveFieldType(field_name: []const u8) ExprType {
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
fn resolveCallReturnType(callee: []const u8) ExprType {
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
fn mapTsTypeToExprType(ts_type: []const u8) ExprType {
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
fn zigTypeStr(ty: ExprType) []const u8 {
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

fn joinArgs(alloc: std.mem.Allocator, args: []const []const u8) ![]const u8 {
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

fn mapTsType(ts_type: []const u8) []const u8 {
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
fn lowerFirst(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
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
fn containsAny(name: []const u8, needles: []const []const u8) bool {
    for (needles) |needle| {
        if (std.mem.indexOf(u8, name, needle) != null) return true;
    }
    return false;
}

/// Check if a name is all uppercase (A-Z and _).
fn isAllCaps(name: []const u8) bool {
    for (name) |c| {
        if (c >= 'a' and c <= 'z') return false;
    }
    return name.len > 0;
}

/// Convert `template ${expr}` to std.fmt.comptimePrint("template {s}", .{ expr })
fn emitTemplateLiteral(alloc: std.mem.Allocator, raw: []const u8) ![]const u8 {
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
    // Use arena — the parser creates many intermediate strings that only
    // the final result references. In production an arena is used too.
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try emitExpression(alloc, &lex, input, &pos, .value);
    try std.testing.expectEqualStrings(expected, result);
}

fn testExprCtx(input: []const u8, expected: []const u8, ctx: ExprContext) !void {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try emitExpression(alloc, &lex, input, &pos, ctx);
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
    // s.width is f32, s.gap is f32 → no cast
    try testExpr("s.width + s.gap", "s.width + s.gap");
}

test "comparison with known fields no cast" {
    // s.gap is f32, both sides same → no cast
    try testExpr("s.gap > s.padding", "s.gap > s.padding");
}

test "arithmetic with int literal coercion" {
    // integer literal coerces to f32 partner
    try testExpr("s.gap * 2", "s.gap * 2");
    try testExpr("1 + s.width", "1 + s.width");
}

test "comparison int literal coercion" {
    try testExpr("s.gap > 0", "s.gap > 0");
    try testExpr("node.children.length > 1", "node.children.len > 1");
}

test "mixed f32 and usize casts correctly" {
    // .len is usize, s.gap is f32 → cast the usize side
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
    // exprgen should return just the LHS, leaving += for stmtgen
    try testExpr("total", "total");
    // When parsing "total + = x", the + before = should NOT be consumed
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const alloc = arena.allocator();
    const input = "total += 1";
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try emitExpression(alloc, &lex, input, &pos, .value);
    try std.testing.expectEqualStrings("total", result);
    // pos should be at the + token, not past it
    try std.testing.expectEqual(TokenKind.plus, lex.get(pos).kind);
}

test "enum reference" {
    try testExpr("FlexDirection.Row", ".row");
    try testExpr("Display.None", ".none");
    try testExpr("Position.Absolute", ".absolute");
    try testExpr("FlexWrap.Wrap", ".wrap");
}

test "enum does not apply to Math builtins" {
    // Math.abs(x) should NOT be treated as enum (followed by parens)
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
