//! Component inlining — compile-time substitution of component instances.
//!
//! When <MyComponent prop="val" /> appears in JSX, the component's template
//! is inlined at compile time with prop values substituted. Multi-use leaf
//! components get optimized into init functions for deduplication.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const PropType = codegen.PropType;
const CompInstance = codegen.CompInstance;
const jsx = @import("jsx.zig");
const handlers = @import("handlers.zig");
const attrs = @import("attrs.zig");

const MAX_COMPONENT_PROPS = codegen.MAX_COMPONENT_PROPS;
const MAX_COMP_FUNCS = codegen.MAX_COMP_FUNCS;
const MAX_COMP_INSTANCES = codegen.MAX_COMP_INSTANCES;
const MAX_COMP_INNER = codegen.MAX_COMP_INNER;

pub fn inlineComponent(self: *Generator, comp: *codegen.ComponentInfo) anyerror![]const u8 {
    // Prevent recursive inlining
    if (self.current_inline_component) |current| {
        if (std.mem.eql(u8, current, comp.name)) {
            while (self.curKind() != .slash_gt and self.curKind() != .gt and self.curKind() != .eof) self.advance_token();
            if (self.curKind() == .gt) {
                self.advance_token();
                var d: u32 = 1;
                while (self.pos < self.lex.count and d > 0) {
                    if (self.curKind() == .lt_slash) { d -= 1; if (d == 0) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); if (self.curKind() == .gt) self.advance_token(); break; } }
                    if (self.curKind() == .lt) d += 1;
                    self.advance_token();
                }
            } else {
                self.advance_token();
            }
            return ".{}";
        }
    }
    self.inline_depth += 1;
    defer self.inline_depth -= 1;
    if (self.inline_depth > 64) {
        self.setError("component inline depth exceeded");
        return ".{}";
    }

    const saved_component = self.current_inline_component;
    self.current_inline_component = comp.name;
    defer self.current_inline_component = saved_component;

    const saved_prop_count = self.prop_stack_count;
    while (self.curKind() != .slash_gt and self.curKind() != .gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr_name = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                var val: []const u8 = "";
                var prop_type: PropType = .string;
                if (self.curKind() == .string) {
                    val = self.curText();
                    if (val.len >= 2 and val[0] == '\'') {
                        val = try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{val[1 .. val.len - 1]});
                    }
                    prop_type = self.classifyExpr(val);
                    self.advance_token();
                } else if (self.curKind() == .lbrace) {
                    if (std.mem.startsWith(u8, attr_name, "on")) {
                        val = try std.fmt.allocPrint(self.alloc, "__handler_pos_{d}", .{self.pos});
                        prop_type = .expression;
                        try attrs.skipBalanced(self);
                    } else {
                        self.advance_token();
                        if (self.curKind() == .template_literal) {
                            const tok = self.cur();
                            const raw = tok.text(self.source);
                            val = try self.alloc.dupe(u8, raw);
                            prop_type = .dynamic_text;
                            self.advance_token();
                        } else {
                            val = try handlers.emitStateExpr(self);
                            prop_type = self.classifyExpr(val);
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
                    }
                }
                for (0..comp.prop_count) |pi| {
                    if (std.mem.eql(u8, comp.prop_names[pi], attr_name)) {
                        if (self.prop_stack_count < MAX_COMPONENT_PROPS) {
                            self.prop_stack[self.prop_stack_count] = .{
                                .name = attr_name,
                                .value = val,
                                .prop_type = prop_type,
                            };
                            self.prop_stack_count += 1;
                        }
                        break;
                    }
                }
            }
        } else {
            self.advance_token();
        }
    }

    // Handle self-closing vs children
    var caller_children = std.ArrayListUnmanaged([]const u8){};
    var has_caller_children = false;
    if (self.curKind() == .slash_gt) {
        self.advance_token();
    } else if (self.curKind() == .gt) {
        self.advance_token();
        if (comp.has_children) {
            has_caller_children = true;
            while (self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    const peek = self.pos + 1;
                    if (peek < self.lex.count and self.lex.get(peek).kind == .slash) {
                        self.advance_token();
                        self.advance_token();
                        if (self.curKind() == .identifier) self.advance_token();
                        if (self.curKind() == .gt) self.advance_token();
                        break;
                    }
                    const child_expr = try jsx.parseJSXElement(self);
                    caller_children.append(self.alloc, child_expr) catch {};
                } else {
                    self.advance_token();
                }
            }
        } else {
            var depth: u32 = 1;
            while (self.pos < self.lex.count and depth > 0) {
                if (self.curKind() == .lt) {
                    const peek = self.pos + 1;
                    if (peek < self.lex.count and self.lex.get(peek).kind == .slash) {
                        depth -= 1;
                        if (depth == 0) {
                            self.advance_token();
                            self.advance_token();
                            if (self.curKind() == .identifier) self.advance_token();
                            if (self.curKind() == .gt) self.advance_token();
                            break;
                        }
                    } else {
                        depth += 1;
                    }
                }
                self.advance_token();
            }
        }
    }

    // Multi-use leaf component optimization
    const eligible = comp.usage_count >= 2 and !comp.has_children and !has_caller_children;
    if (eligible) {
        var has_state_prop = false;
        for (saved_prop_count..self.prop_stack_count) |pi| {
            const v = self.prop_stack[pi].value;
            const pt = self.prop_stack[pi].prop_type;
            if (std.mem.indexOf(u8, v, "state.") != null) has_state_prop = true;
            if (pt == .dynamic_text or pt == .state_int or pt == .state_float or
                pt == .state_string or pt == .state_bool) has_state_prop = true;
        }
        if (!has_state_prop) {
            const cf_result = try compFuncInline(self, comp, saved_prop_count);
            if (cf_result) |placeholder| {
                self.prop_stack_count = saved_prop_count;
                return placeholder;
            }
        }
    }

    // Direct inline: jump to component body
    const saved_pos = self.pos;
    const saved_children = self.component_children_exprs;
    if (has_caller_children) {
        self.component_children_exprs = &caller_children;
    } else {
        self.component_children_exprs = null;
    }
    self.pos = comp.body_pos;
    const result = try jsx.parseJSXElement(self);
    self.pos = saved_pos;
    self.prop_stack_count = saved_prop_count;
    self.component_children_exprs = saved_children;
    return result;
}

pub fn compFuncInline(self: *Generator, comp: *codegen.ComponentInfo, saved_prop_count: u32) !?[]const u8 {
    var func_idx: u32 = 0;

    if (!comp.func_generated) {
        const arr_count_before = self.array_decls.items.len;
        const arr_id_before = self.array_counter;

        const saved_pos = self.pos;
        self.pos = comp.body_pos;
        self.component_children_exprs = null;
        self.emit_prop_refs = true;
        const root_expr = try jsx.parseJSXElement(self);
        self.emit_prop_refs = false;
        self.pos = saved_pos;

        const arr_count_after = self.array_decls.items.len;
        const inner_count_u = arr_count_after - arr_count_before;
        if (inner_count_u > MAX_COMP_INNER or inner_count_u == 0) {
            while (self.array_decls.items.len > arr_count_before) { _ = self.array_decls.pop(); }
            self.array_counter = arr_id_before;
            return null;
        }
        const inner_count: u32 = @intCast(inner_count_u);

        var inner_sizes: [MAX_COMP_INNER]u32 = [_]u32{0} ** MAX_COMP_INNER;
        for (0..inner_count) |ii| {
            inner_sizes[ii] = countNodeElements(self.array_decls.items[arr_count_before + ii]);
        }

        var func_src: std.ArrayListUnmanaged(u8) = .{};
        try func_src.appendSlice(self.alloc, "fn _init");
        try func_src.appendSlice(self.alloc, comp.name);
        try func_src.appendSlice(self.alloc, "(");
        for (0..inner_count) |ii| {
            if (ii > 0) try func_src.appendSlice(self.alloc, ", ");
            try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "_inner_{d}: *[{d}]Node", .{ ii, inner_sizes[ii] }));
        }
        for (saved_prop_count..self.prop_stack_count) |pi| {
            const prop = self.prop_stack[pi];
            try func_src.appendSlice(self.alloc, ", ");
            try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "_p_{s}: ", .{prop.name}));
            try func_src.appendSlice(self.alloc, Generator.zigTypeForPropType(prop.prop_type));
        }
        try func_src.appendSlice(self.alloc, ") Node {\n");

        for (0..inner_count) |ii| {
            const decl = self.array_decls.items[arr_count_before + ii];
            const arr_init = extractArrayInit(decl);
            var replaced_init: []const u8 = try self.alloc.dupe(u8, arr_init);
            for (0..inner_count) |jj| {
                const ref_id = arr_id_before + @as(u32, @intCast(jj));
                replaced_init = try replaceAllOccurrences(self, replaced_init, try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{ref_id}), try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{jj}));
            }
            try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _inner_{d}.* = [_]Node{{ {s} }};\n", .{ ii, replaced_init }));
        }

        var replaced_root: []const u8 = try self.alloc.dupe(u8, root_expr);
        for (0..inner_count) |ii| {
            const arr_id = arr_id_before + @as(u32, @intCast(ii));
            replaced_root = try replaceAllOccurrences(self, replaced_root, try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{arr_id}), try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{ii}));
        }
        if (std.mem.startsWith(u8, replaced_root, ".{ ")) {
            replaced_root = try std.fmt.allocPrint(self.alloc, "return Node{{ {s}", .{replaced_root[3..]});
        } else {
            replaced_root = try std.fmt.allocPrint(self.alloc, "return {s}", .{replaced_root});
        }
        try func_src.appendSlice(self.alloc, "    ");
        try func_src.appendSlice(self.alloc, replaced_root);
        try func_src.appendSlice(self.alloc, ";\n}\n");

        while (self.array_decls.items.len > arr_count_before) { _ = self.array_decls.pop(); }
        self.array_counter = arr_id_before;

        if (self.comp_func_count < MAX_COMP_FUNCS) {
            func_idx = self.comp_func_count;
            self.comp_funcs[func_idx] = .{ .name = comp.name, .func_source = try self.alloc.dupe(u8, func_src.items), .inner_count = inner_count, .inner_sizes = inner_sizes };
            self.comp_func_count += 1;
        } else {
            return null;
        }
        comp.func_generated = true;
    } else {
        for (0..self.comp_func_count) |fi| {
            if (std.mem.eql(u8, self.comp_funcs[fi].name, comp.name)) { func_idx = @intCast(fi); break; }
        }
    }

    const cf = &self.comp_funcs[func_idx];
    if (self.comp_instance_count >= MAX_COMP_INSTANCES) return null;
    const inst_id = self.comp_instance_counter[func_idx];
    self.comp_instance_counter[func_idx] += 1;

    var inst: CompInstance = .{ .func_idx = func_idx, .storage_names = undefined, .init_call = "", .parent_arr = "", .parent_idx = 0 };
    for (0..cf.inner_count) |ii| {
        const storage_name = try std.fmt.allocPrint(self.alloc, "_comp_{s}_{d}_{d}", .{ comp.name, inst_id, ii });
        inst.storage_names[ii] = storage_name;
        try self.array_decls.append(self.alloc, try std.fmt.allocPrint(self.alloc, "var {s}: [{d}]Node = undefined;", .{ storage_name, cf.inner_sizes[ii] }));
    }

    var call: std.ArrayListUnmanaged(u8) = .{};
    try call.appendSlice(self.alloc, "_init");
    try call.appendSlice(self.alloc, comp.name);
    try call.appendSlice(self.alloc, "(");
    for (0..cf.inner_count) |ii| {
        if (ii > 0) try call.appendSlice(self.alloc, ", ");
        try call.appendSlice(self.alloc, "&");
        try call.appendSlice(self.alloc, inst.storage_names[ii]);
    }
    for (saved_prop_count..self.prop_stack_count) |pi| {
        const prop = self.prop_stack[pi];
        try call.appendSlice(self.alloc, ", ");
        switch (prop.prop_type) {
            .color => {
                if (prop.value.len >= 2 and (prop.value[0] == '"' or prop.value[0] == '\'')) {
                    try call.appendSlice(self.alloc, try attrs.parseColorValue(self, prop.value[1 .. prop.value.len - 1]));
                } else {
                    try call.appendSlice(self.alloc, prop.value);
                }
            },
            .dynamic_text => try call.appendSlice(self.alloc, "\"\""),
            else => try call.appendSlice(self.alloc, prop.value),
        }
    }
    try call.appendSlice(self.alloc, ")");
    inst.init_call = try self.alloc.dupe(u8, call.items);

    self.comp_instances[self.comp_instance_count] = inst;
    self.comp_instance_count += 1;
    return try self.alloc.dupe(u8, ".{}");
}

pub fn replaceAllOccurrences(self: *Generator, haystack: []const u8, needle: []const u8, replacement: []const u8) ![]const u8 {
    if (needle.len == 0 or haystack.len < needle.len) return haystack;
    var result: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;
    while (i <= haystack.len - needle.len) {
        if (std.mem.eql(u8, haystack[i..][0..needle.len], needle)) {
            try result.appendSlice(self.alloc, replacement);
            i += needle.len;
        } else {
            try result.append(self.alloc, haystack[i]);
            i += 1;
        }
    }
    while (i < haystack.len) {
        try result.append(self.alloc, haystack[i]);
        i += 1;
    }
    return try self.alloc.dupe(u8, result.items);
}

pub fn setExpectedJSXError(self: *Generator) void {
    var offset: usize = self.source.len;
    if (self.pos < self.lex.count) {
        offset = self.lex.get(self.pos).start;
    }

    var line: usize = 1;
    var column: usize = 1;
    var i: usize = 0;
    while (i < offset and i < self.source.len) : (i += 1) {
        if (self.source[i] == '\n') {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
    }

    const tok_text = if (self.pos < self.lex.count) self.curText() else "EOF";
    const msg = std.fmt.allocPrint(
        self.alloc,
        "Expected JSX at {s}:{d}:{d}, got {s} `{s}`",
        .{ self.input_file, line, column, @tagName(self.curKind()), tok_text },
    ) catch "Expected JSX";
    self.setError(msg);
}

// ── Component function helpers ──

pub fn countNodeElements(decl: []const u8) u32 {
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return 1;
    const content = decl[start + marker.len ..];
    var count: u32 = 0;
    var depth: i32 = 0;
    var i: usize = 0;
    while (i < content.len) {
        if (content[i] == '{') { if (depth == 0) count += 1; depth += 1; } else if (content[i] == '}') { depth -= 1; if (depth < 0) break; }
        i += 1;
    }
    return if (count > 0) count else 1;
}

pub fn extractArrayInit(decl: []const u8) []const u8 {
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return "";
    const content_start = start + marker.len;
    var depth: i32 = 0;
    var i: usize = content_start;
    while (i < decl.len) {
        if (decl[i] == '{') { depth += 1; } else if (decl[i] == '}') { if (depth == 0) return decl[content_start..i]; depth -= 1; }
        i += 1;
    }
    return decl[content_start..];
}
