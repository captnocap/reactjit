//! Expression codegen — translates TypeScript expressions to Zig expressions.
//! Recursive descent parser with operator precedence and type-aware arithmetic.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const typegen = @import("typegen.zig");
const helpers = @import("exprgen_helpers.zig");

pub const camelToSnake = helpers.camelToSnake;

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

pub const TypedExpr = struct {
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
    if (context == .condition and helpers.isBareAccess(result.text) and std.mem.indexOf(u8, result.text, ".") != null) {
        // Only add != null for known optional fields (layout Node/Style fields)
        if (result.ty == .opt_f32_t or
            std.mem.endsWith(u8, result.text, ".text") or
            std.mem.endsWith(u8, result.text, ".image_src") or
            std.mem.endsWith(u8, result.text, ".video_src") or
            std.mem.endsWith(u8, result.text, ".render_src") or
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

    if (context == .condition and helpers.isBareAccess(result.text) and std.mem.indexOf(u8, result.text, ".") != null) {
        return .{ .text = try std.fmt.allocPrint(alloc, "{s} != null", .{result.text}), .ty = .bool_t };
    }

    return result;
}

pub const Parser = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
    var_types: ?*const VarTypes = null,

    pub fn cur(self: *Parser) Token {
        return self.lex.get(self.pos.*);
    }

    pub fn curKind(self: *Parser) TokenKind {
        return self.cur().kind;
    }

    pub fn curText(self: *Parser) []const u8 {
        return self.cur().text(self.source);
    }

    pub fn advance(self: *Parser) void {
        if (self.curKind() != .eof) {
            self.pos.* += 1;
        }
    }

    pub fn expect(self: *Parser, kind: TokenKind) void {
        if (self.curKind() == kind) {
            self.advance();
        }
    }

    // ── Precedence 1: Ternary (cond ? a : b → if (cond) a else b) ──

    pub const Error = std.mem.Allocator.Error;

    pub fn parseTernary(self: *Parser) Error!TypedExpr {
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
                    .text = try std.fmt.allocPrint(self.alloc, "{s} {s} @as({s}, @intCast({s}))", .{ left.text, op, helpers.zigTypeStr(wider), right.text }),
                    .ty = wider,
                };
            } else {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "@as({s}, @intCast({s})) {s} {s}", .{ helpers.zigTypeStr(wider), left.text, op, right.text }),
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
                return try std.fmt.allocPrint(self.alloc, "{s} {s} @as({s}, @intCast({s}))", .{ left.text, op, helpers.zigTypeStr(wider), right.text });
            } else {
                return try std.fmt.allocPrint(self.alloc, "@as({s}, @intCast({s})) {s} {s}", .{ helpers.zigTypeStr(wider), left.text, op, right.text });
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

    pub fn parsePostfix(self: *Parser) Error!TypedExpr {
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

                    // Math.PI / Math.E → std.math constants
                    if (std.mem.eql(u8, left.text, "Math")) {
                        if (std.mem.eql(u8, prop, "PI")) {
                            left = .{ .text = "std.math.pi", .ty = .f32_t };
                            continue;
                        }
                        if (std.mem.eql(u8, prop, "E")) {
                            left = .{ .text = "std.math.e", .ty = .f32_t };
                            continue;
                        }
                    }

                    // .length → .len (always usize)
                    if (std.mem.eql(u8, prop, "length")) {
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "{s}.len", .{left.text}),
                            .ty = .usize_t,
                        };
                        continue;
                    }

                    // .slice() → full copy, .slice(a, b) → [@intCast(a)..@intCast(b)]
                    if (std.mem.eql(u8, prop, "slice") and self.curKind() == .lparen) {
                        self.advance(); // (
                        // No-arg .slice() — full array copy
                        if (self.curKind() == .rparen) {
                            self.advance(); // )
                            left = .{
                                .text = try std.fmt.allocPrint(self.alloc, "{s}[0..]", .{left.text}),
                                .ty = left.ty,
                            };
                            continue;
                        }
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
                        try helpers.camelToSnake(self.alloc, prop);
                    const full_path = try std.fmt.allocPrint(self.alloc, "{s}.{s}", .{ left.text, snake });
                    // Check VarTypes for full dotted path first (null-narrowed vars like s.width → f32)
                    const field_ty = if (self.var_types) |vt|
                        (vt.get(full_path) orelse helpers.resolveFieldType(snake))
                    else
                        helpers.resolveFieldType(snake);
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
                        const zig_type = helpers.mapTsType(type_name);
                        left = .{
                            .text = try std.fmt.allocPrint(self.alloc, "@as({s}, {s})", .{ zig_type, left.text }),
                            .ty = helpers.mapTsTypeToExprType(type_name),
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

        const joined = try helpers.joinArgs(self.alloc, args.items);

        // Math builtins — @builtins and std.math delegates
        if (callee.len > 5 and std.mem.eql(u8, callee[0..5], "Math.")) {
            const method = callee[5..];
            // Single-arg @builtins
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
            else if (std.mem.eql(u8, method, "sin"))
                "@sin"
            else if (std.mem.eql(u8, method, "cos"))
                "@cos"
            else if (std.mem.eql(u8, method, "tan"))
                "@tan"
            else if (std.mem.eql(u8, method, "log"))
                "@log"
            else if (std.mem.eql(u8, method, "exp"))
                "@exp"
            else
                null;

            if (builtin) |b| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ b, joined }),
                    .ty = .f32_t,
                };
            }
            // std.math delegates (multi-arg or non-builtin)
            const std_math: ?[]const u8 = if (std.mem.eql(u8, method, "atan2"))
                "std.math.atan2"
            else if (std.mem.eql(u8, method, "pow"))
                "std.math.pow"
            else if (std.mem.eql(u8, method, "sign"))
                "std.math.sign"
            else if (std.mem.eql(u8, method, "clamp"))
                "std.math.clamp"
            else
                null;

            if (std_math) |sm| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ sm, joined }),
                    .ty = .f32_t,
                };
            }
            // framework/math.zig delegates
            const fw_math: ?[]const u8 = if (std.mem.eql(u8, method, "lerp"))
                "math.lerp"
            else if (std.mem.eql(u8, method, "smoothstep"))
                "math.smoothstep"
            else if (std.mem.eql(u8, method, "remap"))
                "math.remap"
            else if (std.mem.eql(u8, method, "random"))
                "random.float"
            else
                null;

            if (fw_math) |fm| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ fm, joined }),
                    .ty = .f32_t,
                };
            }
        }

        // Vec2.* — 2D vector math (maps to math.v2*)
        if (callee.len > 5 and std.mem.eql(u8, callee[0..5], "Vec2.")) {
            const method = callee[5..];
            const v2fn: ?[]const u8 = if (std.mem.eql(u8, method, "add"))
                "math.v2add"
            else if (std.mem.eql(u8, method, "sub"))
                "math.v2sub"
            else if (std.mem.eql(u8, method, "mul"))
                "math.v2mul"
            else if (std.mem.eql(u8, method, "div"))
                "math.v2div"
            else if (std.mem.eql(u8, method, "scale"))
                "math.v2scale"
            else if (std.mem.eql(u8, method, "negate"))
                "math.v2negate"
            else if (std.mem.eql(u8, method, "dot"))
                "math.v2dot"
            else if (std.mem.eql(u8, method, "cross"))
                "math.v2cross"
            else if (std.mem.eql(u8, method, "length"))
                "math.v2length"
            else if (std.mem.eql(u8, method, "distance"))
                "math.v2distance"
            else if (std.mem.eql(u8, method, "normalize"))
                "math.v2normalize"
            else if (std.mem.eql(u8, method, "lerp"))
                "math.v2lerp"
            else if (std.mem.eql(u8, method, "angle"))
                "math.v2angle"
            else if (std.mem.eql(u8, method, "rotate"))
                "math.v2rotate"
            else if (std.mem.eql(u8, method, "fromAngle"))
                "math.v2fromAngle"
            else
                null;

            if (v2fn) |fn_name| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ fn_name, joined }),
                    .ty = .f32_t,
                };
            }
        }

        // Vec3.* — 3D vector math (maps to math.v3*)
        if (callee.len > 5 and std.mem.eql(u8, callee[0..5], "Vec3.")) {
            const method = callee[5..];
            const v3fn: ?[]const u8 = if (std.mem.eql(u8, method, "add"))
                "math.v3add"
            else if (std.mem.eql(u8, method, "sub"))
                "math.v3sub"
            else if (std.mem.eql(u8, method, "mul"))
                "math.v3mul"
            else if (std.mem.eql(u8, method, "div"))
                "math.v3div"
            else if (std.mem.eql(u8, method, "scale"))
                "math.v3scale"
            else if (std.mem.eql(u8, method, "negate"))
                "math.v3negate"
            else if (std.mem.eql(u8, method, "dot"))
                "math.v3dot"
            else if (std.mem.eql(u8, method, "cross"))
                "math.v3cross"
            else if (std.mem.eql(u8, method, "length"))
                "math.v3length"
            else if (std.mem.eql(u8, method, "distance"))
                "math.v3distance"
            else if (std.mem.eql(u8, method, "normalize"))
                "math.v3normalize"
            else if (std.mem.eql(u8, method, "lerp"))
                "math.v3lerp"
            else if (std.mem.eql(u8, method, "reflect"))
                "math.v3reflect"
            else if (std.mem.eql(u8, method, "slerp"))
                "math.v3slerp"
            else
                null;

            if (v3fn) |fn_name| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ fn_name, joined }),
                    .ty = .f32_t,
                };
            }
        }

        // Noise.* — procedural noise (maps to math.noise*)
        if (callee.len > 6 and std.mem.eql(u8, callee[0..6], "Noise.")) {
            const method = callee[6..];
            const nfn: ?[]const u8 = if (std.mem.eql(u8, method, "perlin") or std.mem.eql(u8, method, "perlin2d"))
                "math.noise2d"
            else if (std.mem.eql(u8, method, "perlin3d"))
                "math.noise3d"
            else if (std.mem.eql(u8, method, "fbm") or std.mem.eql(u8, method, "fbm2d"))
                "math.fbm2d"
            else if (std.mem.eql(u8, method, "fbm3d"))
                "math.fbm3d"
            else
                null;

            if (nfn) |fn_name| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ fn_name, joined }),
                    .ty = .f32_t,
                };
            }
        }

        // Random.* — deterministic PRNG (maps to random.*)
        if (callee.len > 7 and std.mem.eql(u8, callee[0..7], "Random.")) {
            const method = callee[7..];
            const rfn: ?[]const u8 = if (std.mem.eql(u8, method, "float"))
                "random.float"
            else if (std.mem.eql(u8, method, "range"))
                "random.range"
            else if (std.mem.eql(u8, method, "int"))
                "random.intRange"
            else if (std.mem.eql(u8, method, "seed"))
                "random.seed"
            else
                null;

            if (rfn) |fn_name| {
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ fn_name, joined }),
                    .ty = .f32_t,
                };
            }
        }

        // Vec2(x, y) → math.v2(x, y) constructor
        if (std.mem.eql(u8, callee, "Vec2")) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "math.v2({s})", .{joined}),
                .ty = .struct_t,
            };
        }
        // Vec3(x, y, z) → math.v3(x, y, z) constructor
        if (std.mem.eql(u8, callee, "Vec3")) {
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "math.v3({s})", .{joined}),
                .ty = .struct_t,
            };
        }

        // Infer return type from known function names
        const ret_type = helpers.resolveCallReturnType(callee);
        return .{
            .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ callee, joined }),
            .ty = ret_type,
        };
    }

    // ── Precedence 11: Primary (delegated to exprgen_primary.zig) ──
    pub const parsePrimary = @import("exprgen_primary.zig").parsePrimary;
    pub const resolveVarType = @import("exprgen_primary.zig").resolveVarType;
    pub const parseObjectLiteral = @import("exprgen_primary.zig").parseObjectLiteral;
    pub const parseArrayLiteral = @import("exprgen_primary.zig").parseArrayLiteral;
};
