//! Late-phase collection: utility functions, let vars, effect hooks.
//! Extracted from collect.zig for file length compliance.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;

// ── Utility function collection ──

/// Collect non-App, non-component (lowercase) function definitions.
/// These become real Zig functions that handlers and expressions can call.
pub fn collectUtilFunctions(self: *Generator) void {
    self.pos = 0;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("function")) {
            self.advance_token();
            if (self.curKind() != .identifier) continue;
            const name = self.curText();
            // Skip App and uppercase (components)
            if (std.mem.eql(u8, name, "App")) {
                self.advance_token();
                continue;
            }
            if (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z') {
                self.advance_token();
                continue;
            }
            self.advance_token();

            // Parse params
            var params: [codegen.MAX_UTIL_PARAMS][]const u8 = undefined;
            var param_count: u32 = 0;
            if (self.curKind() == .lparen) {
                self.advance_token();
                while (self.curKind() != .rparen and self.curKind() != .eof) {
                    if (self.curKind() == .identifier) {
                        if (param_count < codegen.MAX_UTIL_PARAMS) {
                            params[param_count] = self.curText();
                            param_count += 1;
                        }
                    }
                    self.advance_token();
                    if (self.curKind() == .comma) self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token();
            }

            // Find body { ... }
            if (self.curKind() == .lbrace) {
                const body_start = self.pos;
                var depth: u32 = 1;
                self.advance_token();
                while (depth > 0 and self.curKind() != .eof) {
                    if (self.curKind() == .lbrace) depth += 1;
                    if (self.curKind() == .rbrace) depth -= 1;
                    if (depth > 0) self.advance_token();
                }
                const body_end = self.pos;
                if (self.curKind() == .rbrace) self.advance_token();

                if (self.util_func_count < codegen.MAX_UTIL_FUNCS) {
                    self.util_funcs[self.util_func_count] = .{
                        .name = name,
                        .params = params,
                        .param_count = param_count,
                        .body_start = body_start,
                        .body_end = body_end,
                    };
                    self.util_func_count += 1;
                }
            }
            continue;
        }
        self.advance_token();
    }
}

// ── Let variable collection ──

/// Collect `let x = expr` declarations within the App function body.
/// These become runtime mutable variables (distinct from compile-time const substitution).
pub fn collectLetVars(self: *Generator, func_start: u32) void {
    self.pos = func_start;
    // Skip to opening brace
    while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
    if (self.curKind() == .lbrace) self.advance_token();

    while (self.pos < self.lex.count) {
        if (self.isIdent("return")) break;
        if (self.isIdent("let")) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token();
                    // Collect the expression text up to semicolon
                    const expr_start = self.pos;
                    while (self.curKind() != .semicolon and self.curKind() != .eof) {
                        self.advance_token();
                    }
                    if (self.pos > expr_start) {
                        const first = self.lex.get(expr_start);
                        const last = self.lex.get(self.pos - 1);
                        const expr = self.source[first.start..last.end];

                        // Infer type from the expression
                        const st = inferExprType(self, expr);

                        if (self.let_count < codegen.MAX_LET_VARS) {
                            const zig_name = std.fmt.allocPrint(self.alloc, "_let_{d}", .{self.let_count}) catch "";
                            self.let_vars[self.let_count] = .{
                                .name = name,
                                .initial = expr,
                                .state_type = st,
                                .zig_name = zig_name,
                            };
                            self.let_count += 1;
                        }
                    }
                }
            }
        }
        self.advance_token();
    }
}

// ── Effect hook collection ──

/// Phase 6.25: Collect useEffect() calls within the App function body.
///
/// Supports four variants:
///   useEffect(() => { body }, [])       → mount (run once at init)
///   useEffect(() => { body }, [dep])    → watch (run when deps change)
///   useEffect(() => { body })           → frame (run every render)
///   useEffect(() => { body }, 500)      → interval (run every N ms)
///
/// The body_start/body_end token positions are recorded so emit.zig can
/// call emitHandlerBody to translate the arrow function body to Zig.
pub fn collectEffectHooks(self: *Generator, func_start: u32) void {
    // Scan from the top of the file — useEffect can appear at module top level
    // (before function App) or inside the App function body, just like useState.
    _ = func_start;
    self.pos = 0;

    while (self.pos < self.lex.count) {
        if (self.isIdent("useEffect")) {
            self.advance_token(); // skip "useEffect"
            if (self.curKind() == .lparen) self.advance_token(); // skip (

            // Record body_start — at the ( or first token of arrow function
            const body_start = self.pos;

            // Skip the arrow function: () => BODY or (e) => BODY
            if (self.curKind() == .lparen) self.advance_token(); // (
            while (self.curKind() == .identifier or self.curKind() == .comma) self.advance_token();
            if (self.curKind() == .rparen) self.advance_token(); // )
            if (self.curKind() == .arrow) self.advance_token(); // =>

            // Skip body — either { ... } block or single expression
            var body_end: u32 = self.pos;
            if (self.curKind() == .lbrace) {
                var depth: u32 = 1;
                self.advance_token();
                while (depth > 0 and self.curKind() != .eof) {
                    if (self.curKind() == .lbrace) depth += 1;
                    if (self.curKind() == .rbrace) depth -= 1;
                    if (depth > 0) self.advance_token();
                }
                body_end = self.pos;
                if (self.curKind() == .rbrace) self.advance_token();
            } else {
                // Single expression — skip until , or ) at depth 0
                var paren_depth: u32 = 0;
                while (self.curKind() != .eof) {
                    if (self.curKind() == .lparen) paren_depth += 1;
                    if (self.curKind() == .rparen) {
                        if (paren_depth == 0) break;
                        paren_depth -= 1;
                    }
                    if (self.curKind() == .comma and paren_depth == 0) break;
                    self.advance_token();
                }
                body_end = self.pos;
            }

            // Determine kind based on what follows the body
            var kind: codegen.EffectKind = .frame;
            var dep_slots: [8]u32 = undefined;
            var dep_count: u32 = 0;
            var interval_ms: u32 = 0;

            if (self.curKind() == .comma) {
                self.advance_token(); // skip ,

                if (self.curKind() == .lbracket) {
                    self.advance_token(); // skip [
                    if (self.curKind() == .rbracket) {
                        // Empty deps → mount
                        kind = .mount;
                        self.advance_token(); // skip ]
                    } else {
                        // Dependencies → watch
                        kind = .watch;
                        while (self.curKind() != .rbracket and self.curKind() != .eof) {
                            if (self.curKind() == .identifier) {
                                const dep_name = self.curText();
                                if (self.isState(dep_name)) |slot_id| {
                                    if (dep_count < 8) {
                                        dep_slots[dep_count] = slot_id;
                                        dep_count += 1;
                                    }
                                }
                            }
                            self.advance_token();
                            if (self.curKind() == .comma) self.advance_token();
                        }
                        if (self.curKind() == .rbracket) self.advance_token();
                    }
                } else if (self.curKind() == .number) {
                    // Number → interval
                    kind = .interval;
                    interval_ms = std.fmt.parseInt(u32, self.curText(), 10) catch 1000;
                    self.advance_token();
                }
            }

            // Skip closing ) and optional ;
            if (self.curKind() == .rparen) self.advance_token();
            if (self.curKind() == .semicolon) self.advance_token();

            if (self.effect_hook_count < codegen.MAX_EFFECT_HOOKS) {
                self.effect_hooks[self.effect_hook_count] = .{
                    .kind = kind,
                    .body_start = body_start,
                    .body_end = body_end,
                    .dep_slots = dep_slots,
                    .dep_count = dep_count,
                    .interval_ms = interval_ms,
                };
                self.effect_hook_count += 1;
            } else {
                self.setError("Too many useEffect hooks (limit: 32)");
            }
            continue; // don't advance_token at bottom
        }
        if (self.isIdent("return")) break;
        self.advance_token();
    }
}

/// Infer StateType from an expression string.
pub fn inferExprType(self: *Generator, expr: []const u8) codegen.StateType {
    // String literals
    if (expr.len >= 2 and (expr[0] == '"' or expr[0] == '\'')) return .string;
    // Boolean
    if (std.mem.eql(u8, expr, "true") or std.mem.eql(u8, expr, "false")) return .boolean;
    // Float (has decimal point)
    if (std.mem.indexOf(u8, expr, ".") != null) {
        if (std.fmt.parseFloat(f64, expr) catch null) |_| return .float;
    }
    // Integer
    if (expr.len > 0 and (expr[0] >= '0' and expr[0] <= '9')) return .int;
    // State reference — inherit type
    if (self.isState(expr)) |slot_id| return self.stateTypeById(slot_id);
    return .int;
}
