//! Collection phase — scans tokens and populates Generator fields.
//!
//! All functions here are pure readers: they scan the token stream and
//! fill in Generator arrays/counts. No Zig code is emitted.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");

// ── FFI collection ──

pub fn collectFFIPragmas(self: *Generator) void {
    var i: u32 = 0;
    while (i < self.lex.count) : (i += 1) {
        const tok = self.lex.get(i);
        if (tok.kind == .ffi_pragma) {
            const text = tok.text(self.source);
            if (std.mem.indexOf(u8, text, "<")) |lt_pos| {
                if (std.mem.indexOf(u8, text, ">")) |gt_pos| {
                    if (gt_pos > lt_pos) {
                        const header = text[lt_pos + 1 .. gt_pos];
                        self.ffi_headers.append(self.alloc, header) catch {};
                    }
                    const after = text[gt_pos + 1 ..];
                    if (std.mem.indexOf(u8, after, "-l")) |l_pos| {
                        const lib = std.mem.trim(u8, after[l_pos + 2 ..], &[_]u8{ ' ', '\t', '\n', '\r' });
                        if (lib.len > 0) self.ffi_libs.append(self.alloc, lib) catch {};
                    }
                }
            }
        }
    }
}

pub fn collectDeclaredFunctions(self: *Generator) void {
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("declare")) {
            self.advance_token();
            if (self.isIdent("function")) {
                self.advance_token();
                if (self.curKind() == .identifier) {
                    self.ffi_funcs.append(self.alloc, self.curText()) catch {};
                    var ret_type: codegen.StateType = .int;
                    var arg_count: u32 = 0;
                    const saved = self.pos;
                    self.advance_token();
                    if (self.curKind() == .lparen) {
                        var depth: u32 = 1;
                        self.advance_token();
                        if (self.curKind() != .rparen) arg_count = 1;
                        while (depth > 0 and self.curKind() != .eof) {
                            if (self.curKind() == .lparen) depth += 1;
                            if (self.curKind() == .rparen) depth -= 1;
                            if (self.curKind() == .comma and depth == 1) arg_count += 1;
                            if (depth > 0) self.advance_token();
                        }
                        if (self.curKind() == .rparen) self.advance_token();
                    }
                    if (self.curKind() == .colon) {
                        self.advance_token();
                        if (self.curKind() == .identifier) {
                            const type_name = self.curText();
                            if (std.mem.eql(u8, type_name, "string")) ret_type = .string
                            else if (std.mem.eql(u8, type_name, "boolean")) ret_type = .boolean
                            else if (std.mem.eql(u8, type_name, "number")) ret_type = .int;
                        }
                    }
                    self.pos = saved;
                    self.ffi_return_types.append(self.alloc, ret_type) catch {};
                    self.ffi_arg_counts.append(self.alloc, arg_count) catch {};
                }
            }
        }
        self.advance_token();
    }
}

// ── Classifier collection ──

pub fn collectClassifiers(self: *Generator) void {
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("classifier")) {
            self.advance_token();
            if (self.curKind() == .lparen) self.advance_token();
            if (self.curKind() == .lbrace) self.advance_token();

            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                if (self.curKind() == .identifier) {
                    const name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .colon) self.advance_token();
                    if (self.curKind() == .lbrace) {
                        self.advance_token();

                        var prim_type: []const u8 = "Box";
                        var style_str: []const u8 = "";
                        var text_props: []const u8 = "";

                        while (self.curKind() != .rbrace and self.curKind() != .eof) {
                            if (self.curKind() == .identifier) {
                                const field = self.curText();
                                self.advance_token();
                                if (self.curKind() == .colon) self.advance_token();

                                if (std.mem.eql(u8, field, "type")) {
                                    prim_type = attrs.parseStringAttrInline(self) catch "Box";
                                } else if (std.mem.eql(u8, field, "style")) {
                                    style_str = attrs.parseStyleAttr(self) catch "";
                                } else if (std.mem.eql(u8, field, "size") or std.mem.eql(u8, field, "fontSize")) {
                                    const sz = self.curText();
                                    self.advance_token();
                                    text_props = std.fmt.allocPrint(self.alloc, ".font_size = {s}", .{sz}) catch "";
                                } else if (std.mem.eql(u8, field, "bold")) {
                                    if (self.curKind() == .identifier) self.advance_token();
                                } else if (std.mem.eql(u8, field, "color")) {
                                    const col = attrs.parseStringAttrInline(self) catch "";
                                    if (col.len > 0) {
                                        const zig_col = attrs.parseColorValue(self, col) catch "Color.rgb(255,255,255)";
                                        text_props = std.fmt.allocPrint(self.alloc, "{s}, .text_color = {s}", .{
                                            if (text_props.len > 0) text_props else "",
                                            zig_col,
                                        }) catch "";
                                    }
                                } else if (std.mem.eql(u8, field, "grow")) {
                                    if (self.curKind() == .identifier) self.advance_token();
                                    if (style_str.len > 0) {
                                        style_str = std.fmt.allocPrint(self.alloc, "{s}, .flex_grow = 1", .{style_str}) catch style_str;
                                    } else {
                                        style_str = ".flex_grow = 1";
                                    }
                                } else {
                                    self.advance_token();
                                }
                            } else {
                                self.advance_token();
                            }
                            if (self.curKind() == .comma) self.advance_token();
                        }
                        if (self.curKind() == .rbrace) self.advance_token();

                        if (self.classifier_count < codegen.MAX_CLASSIFIERS) {
                            const idx = self.classifier_count;
                            self.classifier_names[idx] = name;
                            self.classifier_primitives[idx] = prim_type;
                            self.classifier_styles[idx] = style_str;
                            self.classifier_text_props[idx] = text_props;
                            self.classifier_count += 1;
                        }
                    }
                } else {
                    self.advance_token();
                }
                if (self.curKind() == .comma) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
            if (self.curKind() == .rparen) self.advance_token();
        }
        self.advance_token();
    }
}

// ── Component collection ──

pub fn collectComponents(self: *Generator) void {
    self.pos = 0;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("function")) {
            self.advance_token();
            if (self.curKind() != .identifier) continue;
            const name = self.curText();
            if (std.mem.eql(u8, name, "App")) { self.advance_token(); continue; }
            if (name.len == 0 or name[0] < 'A' or name[0] > 'Z') { self.advance_token(); continue; }
            self.advance_token();

            var prop_names: [codegen.MAX_COMPONENT_PROPS][]const u8 = undefined;
            var prop_count: u32 = 0;
            if (self.curKind() == .lparen) {
                self.advance_token();
                if (self.curKind() == .lbrace) {
                    self.advance_token();
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        if (self.curKind() == .identifier) {
                            if (prop_count < codegen.MAX_COMPONENT_PROPS) {
                                prop_names[prop_count] = self.curText();
                                prop_count += 1;
                            }
                        }
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                }
                var paren_depth: u32 = 1;
                while (self.pos < self.lex.count and paren_depth > 0) {
                    if (self.curKind() == .lparen) paren_depth += 1;
                    if (self.curKind() == .rparen) {
                        paren_depth -= 1;
                        if (paren_depth == 0) break;
                    }
                    self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token();
            }

            if (self.curKind() == .lbrace) {
                self.advance_token();
                var brace_depth: u32 = 1;
                while (self.pos < self.lex.count and brace_depth > 0) {
                    if (self.isIdent("return") and brace_depth == 1) {
                        self.advance_token();
                        if (self.curKind() == .lparen) self.advance_token();
                        if (self.curKind() == .lt) {
                            if (self.component_count < codegen.MAX_COMPONENTS) {
                                const body_pos = self.pos;
                                var has_children = false;
                                const scan_save = self.pos;
                                var scan_depth: u32 = 0;
                                while (self.pos < self.lex.count) {
                                    if (self.curKind() == .lt) scan_depth += 1;
                                    if (self.isIdent("children")) { has_children = true; break; }
                                    if (self.curKind() == .rbrace and scan_depth == 0) break;
                                    self.advance_token();
                                }
                                self.pos = scan_save;

                                self.components[self.component_count] = .{
                                    .name = name,
                                    .prop_names = prop_names,
                                    .prop_count = prop_count,
                                    .body_pos = body_pos,
                                    .has_children = has_children,
                                    .usage_count = 0,
                                    .func_generated = false,
                                };
                                self.component_count += 1;
                            } else {
                                self.setError("Too many component definitions (limit: 64)");
                            }
                        }
                        break;
                    }
                    if (self.curKind() == .lbrace) brace_depth += 1;
                    if (self.curKind() == .rbrace) brace_depth -= 1;
                    self.advance_token();
                }
            }
            continue;
        }
        self.advance_token();
    }
}

pub fn countComponentUsage(self: *Generator, app_start: u32) void {
    const saved_pos = self.pos;
    defer self.pos = saved_pos;
    self.pos = app_start;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z') {
                    for (0..self.component_count) |i| {
                        if (std.mem.eql(u8, self.components[i].name, name)) {
                            self.components[i].usage_count += 1;
                            break;
                        }
                    }
                }
            }
        }
        self.advance_token();
    }
}

// ── App + state collection ──

pub fn collectAppConditionals(self: *Generator) void {
    if (self.curKind() != .lt) return;
    self.advance_token();
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        self.advance_token();
    }
    if (self.curKind() == .slash_gt) return;
    self.advance_token();

    var child_idx: u32 = 0;
    while (self.curKind() != .lt_slash and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            var depth: u32 = 1;
            self.advance_token();
            while (depth > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lt) depth += 1;
                if (self.curKind() == .lt_slash) {
                    depth -= 1;
                    if (depth == 0) {
                        self.advance_token();
                        while (self.curKind() != .gt and self.curKind() != .eof) self.advance_token();
                        if (self.curKind() == .gt) self.advance_token();
                        break;
                    }
                }
                if (self.curKind() == .slash_gt) {
                    depth -= 1;
                    self.advance_token();
                    if (depth == 0) break;
                    continue;
                }
                self.advance_token();
            }
            child_idx += 1;
        } else if (self.curKind() == .lbrace) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const ident = self.curText();
                if (self.isState(ident)) |slot_id| {
                    const scan_start = self.pos;
                    self.advance_token();
                    if (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
                        const op: []const u8 = if (self.curKind() == .eq_eq) " == " else " != ";
                        self.advance_token();
                        if (self.curKind() == .number) {
                            const num = self.curText();
                            self.advance_token();
                            if (self.curKind() == .amp_amp) {
                                self.advance_token();
                                const rid = self.regularSlotId(slot_id);
                                const st = self.stateTypeById(slot_id);
                                const accessor = switch (st) {
                                    .string => std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}) catch "",
                                    .float => std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}) catch "",
                                    .boolean => std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}) catch "",
                                    else => std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}) catch "",
                                };
                                const cond = std.fmt.allocPrint(self.alloc, "({s}{s}{s})", .{ accessor, op, num }) catch "";
                                if (self.app_cond_count < codegen.MAX_APP_CONDS) {
                                    self.app_conds[self.app_cond_count] = .{
                                        .cond_expr = cond,
                                        .child_idx = child_idx,
                                    };
                                    self.app_cond_count += 1;
                                }
                                var depth: u32 = 1;
                                while (depth > 0 and self.curKind() != .eof) {
                                    if (self.curKind() == .lbrace) depth += 1;
                                    if (self.curKind() == .rbrace) depth -= 1;
                                    if (depth > 0) self.advance_token();
                                }
                                if (self.curKind() == .rbrace) self.advance_token();
                                child_idx += 1;
                                continue;
                            }
                        }
                    }
                    self.pos = scan_start;
                }
            }
            var depth: u32 = 1;
            while (depth > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lbrace) depth += 1;
                if (self.curKind() == .rbrace) depth -= 1;
                if (depth > 0) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
        } else {
            self.advance_token();
        }
    }
}

pub fn findAppFunction(self: *Generator) ?u32 {
    var last_func: ?u32 = null;
    var app_func: ?u32 = null;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("function")) {
            const func_start = self.pos;
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (std.mem.eql(u8, name, "App")) app_func = func_start;
                last_func = func_start;
            }
        }
        self.advance_token();
    }
    return app_func orelse last_func;
}

pub fn collectStateHooksTopLevel(self: *Generator) void {
    self.pos = 0;
    scanForUseState(self, false);
}

pub fn collectStateHooks(self: *Generator, func_start: u32) void {
    self.pos = func_start;
    while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
    if (self.curKind() == .lbrace) self.advance_token();
    scanForUseState(self, true);
}

pub fn scanForUseState(self: *Generator, stop_at_return: bool) void {
    while (self.pos < self.lex.count) {
        if (self.isIdent("const") or self.isIdent("let")) {
            self.advance_token();
            if (self.curKind() == .lbracket) {
                self.advance_token();
                if (self.curKind() == .identifier) {
                    const getter = self.curText();
                    self.advance_token();

                    // useFFI: const [name] = useFFI(func, interval)
                    if (self.curKind() == .rbracket) {
                        self.advance_token();
                        if (self.curKind() == .equals) self.advance_token();
                        if (self.isIdent("useFFI")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            var ffi_func_name: []const u8 = "";
                            if (self.curKind() == .identifier) {
                                ffi_func_name = self.curText();
                                self.advance_token();
                            }
                            if (self.curKind() == .comma) self.advance_token();
                            var interval_ms: u32 = 1000;
                            if (self.curKind() == .number) {
                                interval_ms = std.fmt.parseInt(u32, self.curText(), 10) catch 1000;
                                self.advance_token();
                            }
                            if (self.curKind() == .rparen) self.advance_token();

                            const ret_type = self.ffiReturnType(ffi_func_name);
                            const initial: codegen.StateInitial = switch (ret_type) {
                                .string => .{ .string = "" },
                                .boolean => .{ .boolean = false },
                                .float => .{ .float = 0.0 },
                                else => .{ .int = 0 },
                            };
                            if (self.state_count < codegen.MAX_STATE_SLOTS) {
                                const slot_id = self.state_count;
                                self.state_slots[slot_id] = .{
                                    .getter = getter,
                                    .setter = "",
                                    .initial = initial,
                                };
                                self.state_count += 1;
                                self.has_state = true;

                                if (self.ffi_hook_count < codegen.MAX_FFI_HOOKS) {
                                    self.ffi_hooks[self.ffi_hook_count] = .{
                                        .getter = getter,
                                        .ffi_func = ffi_func_name,
                                        .interval_ms = interval_ms,
                                        .return_type = ret_type,
                                        .slot_id = slot_id,
                                    };
                                    self.ffi_hook_count += 1;
                                }
                            }
                            if (self.curKind() == .semicolon) self.advance_token();
                            continue;
                        }
                        continue;
                    }

                    // useState: const [getter, setter] = useState(initial)
                    if (self.curKind() == .comma) self.advance_token();
                    if (self.curKind() == .identifier) {
                        const setter = self.curText();
                        self.advance_token();
                        if (self.curKind() == .rbracket) self.advance_token();
                        if (self.curKind() == .equals) self.advance_token();
                        if (self.isIdent("useState")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            var initial: codegen.StateInitial = .{ .int = 0 };
                            if (self.curKind() == .number) {
                                const num_text = self.curText();
                                if (std.mem.indexOf(u8, num_text, ".") != null) {
                                    initial = .{ .float = std.fmt.parseFloat(f64, num_text) catch 0.0 };
                                } else {
                                    initial = .{ .int = std.fmt.parseInt(i64, num_text, 10) catch 0 };
                                }
                                self.advance_token();
                            } else if (self.curKind() == .string) {
                                const raw = self.curText();
                                initial = .{ .string = raw[1 .. raw.len - 1] };
                                self.advance_token();
                            } else if (self.curKind() == .identifier) {
                                const val = self.curText();
                                if (std.mem.eql(u8, val, "true")) {
                                    initial = .{ .boolean = true };
                                    self.advance_token();
                                } else if (std.mem.eql(u8, val, "false")) {
                                    initial = .{ .boolean = false };
                                    self.advance_token();
                                }
                            } else if (self.curKind() == .lbracket) {
                                self.advance_token();
                                var arr_vals: [codegen.MAX_ARRAY_INIT]i64 = undefined;
                                var arr_cnt: u32 = 0;
                                while (self.curKind() != .rbracket and self.curKind() != .eof) {
                                    if (self.curKind() == .number) {
                                        if (arr_cnt < codegen.MAX_ARRAY_INIT) {
                                            arr_vals[arr_cnt] = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
                                            arr_cnt += 1;
                                        }
                                        self.advance_token();
                                    } else if (self.curKind() == .minus) {
                                        self.advance_token();
                                        if (self.curKind() == .number) {
                                            if (arr_cnt < codegen.MAX_ARRAY_INIT) {
                                                arr_vals[arr_cnt] = -(std.fmt.parseInt(i64, self.curText(), 10) catch 0);
                                                arr_cnt += 1;
                                            }
                                            self.advance_token();
                                        }
                                    } else {
                                        self.advance_token();
                                    }
                                    if (self.curKind() == .comma) self.advance_token();
                                }
                                if (self.curKind() == .rbracket) self.advance_token();
                                initial = .{ .array = .{ .values = arr_vals, .count = arr_cnt } };
                            }
                            if (self.curKind() == .rparen) self.advance_token();

                            if (self.state_count < codegen.MAX_STATE_SLOTS) {
                                self.state_slots[self.state_count] = .{
                                    .getter = getter,
                                    .setter = setter,
                                    .initial = initial,
                                };
                                self.state_count += 1;
                                self.has_state = true;
                            } else {
                                self.setError("Too many state slots (limit: 128)");
                            }
                        }
                    }
                }
            }
        }
        if (stop_at_return and self.isIdent("return")) break;
        self.advance_token();
    }
}

// ── Misc collection ──

pub fn findReturnStatement(self: *Generator) void {
    while (self.pos < self.lex.count and !self.isIdent("return")) {
        self.advance_token();
    }
    if (self.isIdent("return")) self.advance_token();
    if (self.curKind() == .lparen) self.advance_token();
}

pub fn extractComputeBlock(self: *Generator) void {
    const src = self.source;
    const open_tag = "<script>";
    const close_tag = "</script>";
    var i: usize = 0;
    while (i + open_tag.len <= src.len) : (i += 1) {
        if (std.mem.eql(u8, src[i .. i + open_tag.len], open_tag)) {
            const body_start = i + open_tag.len;
            var j = body_start;
            while (j + close_tag.len <= src.len) : (j += 1) {
                if (std.mem.eql(u8, src[j .. j + close_tag.len], close_tag)) {
                    self.compute_js = src[body_start..j];
                    return;
                }
            }
        }
    }
}

pub fn rewriteSetterCalls(self: *Generator, js: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var line_iter = std.mem.splitScalar(u8, js, '\n');
    var first_line = true;
    while (line_iter.next()) |line| {
        const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t', '\r' });
        if (std.mem.indexOf(u8, trimmed, "useState(") != null) continue;
        if (trimmed.len == 0 and first_line) continue;
        first_line = false;
        var ii: usize = 0;
        while (ii < line.len) {
            var matched = false;
            for (0..self.state_count) |si| {
                const setter = self.state_slots[si].setter;
                if (setter.len == 0) continue;
                if (ii + setter.len + 1 <= line.len and
                    std.mem.eql(u8, line[ii .. ii + setter.len], setter) and
                    line[ii + setter.len] == '(')
                {
                    if (ii > 0 and Generator.isIdentByte(line[ii - 1])) break;
                    const is_string = std.meta.activeTag(self.state_slots[si].initial) == .string;
                    const fn_name = if (is_string) "__setStateString" else "__setState";
                    try result.appendSlice(self.alloc, fn_name);
                    try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{si}));
                    ii += setter.len + 1;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                try result.append(self.alloc, line[ii]);
                ii += 1;
            }
        }
        try result.append(self.alloc, '\n');
    }
    return try result.toOwnedSlice(self.alloc);
}

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
            if (std.mem.eql(u8, name, "App")) { self.advance_token(); continue; }
            if (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z') { self.advance_token(); continue; }
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
