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
const jsx_map = @import("jsx_map.zig");
const handlers = @import("handlers.zig");
const attrs = @import("attrs.zig");

const MAX_COMPONENT_PROPS = codegen.MAX_COMPONENT_PROPS;
const MAX_COMP_FUNCS = codegen.MAX_COMP_FUNCS;
const MAX_COMP_INSTANCES = codegen.MAX_COMP_INSTANCES;
const MAX_COMP_INNER = codegen.MAX_COMP_INNER;

/// Inline a component at a call site: <MyComp prop="val" />
///
/// Components are compile-time inlined — there's no runtime component concept.
/// The compiler saves/restores pos + prop_stack to jump into the component body,
/// parse its JSX, then return the resulting node expression to the caller.
///
/// Multi-use leaf components (used 2+ times, no children, no state props) get
/// optimized into init functions via compFuncInline() to avoid code duplication.
pub fn inlineComponent(self: *Generator, comp: *codegen.ComponentInfo) anyerror![]const u8 {
    // Guard: prevent A calling itself → infinite recursion
    if (self.current_inline_component) |current| {
        if (std.mem.eql(u8, current, comp.name)) {
            // Skip past the entire <Component>...</Component> or <Component /> in the token stream
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
                self.advance_token(); // skip />
            }
            return ".{}"; // emit empty node for recursive call
        }
    }
    self.inline_depth += 1;
    defer self.inline_depth -= 1;
    if (self.inline_depth > 64) {
        self.setError("component inline depth exceeded");
        return ".{}";
    }

    // Save context — we're about to push props and change the "current component"
    const saved_component = self.current_inline_component;
    self.current_inline_component = comp.name;
    defer self.current_inline_component = saved_component;

    // ── Phase 1: Collect prop values from the call site ──
    // Scan attributes like <Comp title="hello" count={42} />
    // and push each matching prop onto the prop_stack for substitution
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
                    // Static string prop: title="hello"
                    val = self.curText();
                    if (val.len >= 2 and val[0] == '\'') {
                        val = try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{val[1 .. val.len - 1]});
                    }
                    prop_type = self.classifyExpr(val);
                    self.advance_token();
                } else if (self.curKind() == .lbrace) {
                    if (std.mem.startsWith(u8, attr_name, "on")) {
                        // Event handler prop: onPress={...} — store token position for later emission
                        val = try std.fmt.allocPrint(self.alloc, "__handler_pos_{d}", .{self.pos});
                        prop_type = .expression;
                        try attrs.skipBalanced(self);
                    } else {
                        // Dynamic prop: count={state + 1} or label={`text ${var}`}
                        self.advance_token();
                        if (self.curKind() == .template_literal) {
                            const tok = self.cur();
                            const raw = tok.text(self.source);
                            val = try self.alloc.dupe(u8, raw);
                            prop_type = .dynamic_text;
                            self.advance_token();
                        } else {
                            // Evaluate the expression (may reference state)
                            val = try handlers.emitStateExpr(self);
                            prop_type = self.classifyExpr(val);
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
                    }
                }
                // Push onto prop stack only if it matches a declared prop name
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

    // ── Phase 2: Parse caller children (for components with {children} slots) ──
    var caller_children = std.ArrayListUnmanaged([]const u8){};
    var has_caller_children = false;
    if (self.curKind() == .slash_gt) {
        // Self-closing: <Comp /> — no children
        self.advance_token();
    } else if (self.curKind() == .gt) {
        // Open tag: <Comp>...</Comp>
        self.advance_token();
        if (comp.has_children) {
            // Component declared {children} — parse caller's children JSX
            has_caller_children = true;
            while (self.curKind() != .eof) {
                if (self.curKind() == .lt_slash) {
                    // Closing tag </Comp> — done collecting children
                    self.advance_token(); // skip lt_slash
                    if (self.curKind() == .identifier) self.advance_token();
                    if (self.curKind() == .gt or self.curKind() == .gt_eq) self.advance_token();
                    break;
                }
                if (self.curKind() == .lt) {
                    const child_expr = try jsx.parseJSXElement(self);
                    caller_children.append(self.alloc, child_expr) catch {};
                } else {
                    self.advance_token();
                }
            }
        } else {
            // Component doesn't use {children} — skip everything until </Comp>
            var depth: u32 = 1;
            while (self.pos < self.lex.count and depth > 0) {
                if (self.curKind() == .lt_slash) {
                    depth -= 1;
                    if (depth == 0) {
                        self.advance_token(); // skip lt_slash
                        if (self.curKind() == .identifier) self.advance_token();
                        if (self.curKind() == .gt or self.curKind() == .gt_eq) self.advance_token();
                        break;
                    }
                } else if (self.curKind() == .lt) {
                    depth += 1;
                }
                self.advance_token();
            }
        }
    }

    // ── Phase 3: Try multi-use leaf optimization ──
    // If this component is used 2+ times and has no children or state-dependent props,
    // emit a shared _initComponentName() function instead of duplicating the tree inline.
    // Skip multi-use if body has && conditionals — they reference props that can't be
    // evaluated inside a shared function (props are compile-time, not runtime params).
    var has_body_conditionals = false;
    {
        var scan = comp.body_pos;
        var depth: u32 = 0;
        while (scan < self.lex.count) {
            const kind = self.lex.get(scan).kind;
            if (kind == .lbrace) depth += 1;
            if (kind == .rbrace) { if (depth > 0) depth -= 1 else break; }
            if (kind == .amp_amp and depth <= 1) { has_body_conditionals = true; break; }
            if (kind == .eof) break;
            scan += 1;
        }
    }
    const eligible = comp.usage_count >= 2 and !comp.has_children and !has_caller_children and !has_body_conditionals and comp.prop_count == 0;
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
                return placeholder; // .{} placeholder — _initComponents fills it at startup
            }
        }
    }

    // ── Phase 4: Direct inline — jump to component body and parse its JSX ──
    // Save current position, jump to component definition, parse JSX, jump back
    const saved_pos = self.pos;
    const saved_children = self.component_children_exprs;
    if (has_caller_children) {
        self.component_children_exprs = &caller_children;
    } else {
        self.component_children_exprs = null;
    }

    // Per-instance state: scan component body for useState and allocate new slots
    const saved_remap_count = self.state_remap_count;
    {
        // Scan backwards from body_pos to find useState declarations in component body
        // Component body is between the function's { and return statement
        var scan = comp.body_pos;
        // Walk backwards to find the function's opening brace
        while (scan > 0) : (scan -= 1) {
            if (self.lex.get(scan).kind == .lbrace) break;
        }
        // Scan forward for useState declarations
        var si = scan;
        while (si < comp.body_pos) : (si += 1) {
            const tk = self.lex.get(si);
            if (tk.kind == .identifier and std.mem.eql(u8, tk.text(self.source), "useState")) {
                // Found useState — find the getter/setter names
                // Pattern: const [ getter , setter ] = useState(...)
                // Walk backwards to find getter and setter
                var bi = si;
                while (bi > scan and bi > 2) {
                    bi -= 1;
                    if (self.lex.get(bi).kind == .lbracket) break;
                }
                if (self.lex.get(bi).kind == .lbracket) {
                    bi += 1; // skip [
                    if (self.lex.get(bi).kind == .identifier) {
                        const getter_name = self.lex.get(bi).text(self.source);
                        bi += 1; // skip getter
                        if (self.lex.get(bi).kind == .comma) bi += 1;
                        if (bi < self.lex.count and self.lex.get(bi).kind == .identifier) {
                            const setter_name = self.lex.get(bi).text(self.source);
                            // Find the original slot
                            if (self.isState(getter_name)) |orig_id| {
                                // Allocate a new slot with same type/initial
                                if (self.state_count < codegen.MAX_STATE_SLOTS) {
                                    const new_id: u32 = @intCast(self.state_count);
                                    self.state_slots[self.state_count] = self.state_slots[orig_id];
                                    self.state_slots[self.state_count].getter = getter_name;
                                    self.state_slots[self.state_count].setter = setter_name;
                                    self.state_count += 1;
                                    // Push remap
                                    if (self.state_remap_count < 32) {
                                        self.state_remap[self.state_remap_count] = .{
                                            .getter = getter_name,
                                            .setter = setter_name,
                                            .slot_id = new_id,
                                        };
                                        self.state_remap_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    self.pos = comp.body_pos; // jump to the component's return position
    const result = if (self.isMapAhead())
        try jsx_map.parseMapExpression(self) // Component returns .map() directly
    else
        try jsx.parseJSXElement(self);
    self.pos = saved_pos; // jump back to caller
    self.prop_stack_count = saved_prop_count; // pop props
    self.state_remap_count = saved_remap_count; // pop state remaps
    self.component_children_exprs = saved_children;
    return result;
}

/// Generate a shared init function for multi-use leaf components.
///
/// Instead of inlining the same JSX tree N times (once per call site), this
/// generates a single `fn _initMyComp(_inner_0: *[N]Node, _p_title: []const u8) Node`
/// function. Each call site gets a storage array + a call to this function in
/// _initComponents(). This deduplicates the generated Zig significantly.
///
/// Returns `.{}` as a placeholder — the real node is filled in by _initComponents at startup.
/// Returns null if the component isn't suitable (too many inner arrays, etc).
pub fn compFuncInline(self: *Generator, comp: *codegen.ComponentInfo, saved_prop_count: u32) !?[]const u8 {
    var func_idx: u32 = 0;

    if (!comp.func_generated) {
        // First time seeing this component — generate the init function.
        // Parse the component body with emit_prop_refs=true so props become
        // parameter references (_p_name) instead of concrete values.
        const arr_count_before = self.array_decls.items.len;
        const arr_id_before = self.array_counter;

        const saved_pos = self.pos;
        self.pos = comp.body_pos;
        self.component_children_exprs = null;
        self.emit_prop_refs = true; // props emit as _p_name instead of concrete values
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

/// String replace all: swap every occurrence of needle with replacement.
/// Used to rewrite _arr_N references to _inner_N parameter refs in init functions.
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

/// Report an error when JSX was expected but something else was found.
/// Called from parseJSXElement when the current token isn't '<'.
pub fn setExpectedJSXError(self: *Generator) void {
    const offset: u32 = if (self.pos < self.lex.count) self.lex.get(self.pos).start else @intCast(self.source.len);
    const tok_text = if (self.pos < self.lex.count) self.curText() else "EOF";
    const msg = std.fmt.allocPrint(
        self.alloc,
        "Expected JSX, got {s} `{s}`",
        .{ @tagName(self.curKind()), tok_text },
    ) catch "Expected JSX";
    self.setErrorAt(offset, msg);
}

// ── Component function helpers ──

/// Count how many Node elements are in an array declaration like:
///   var _arr_3 = [_]Node{ .{...}, .{...}, .{...} };
/// Returns the count (3 in this example). Used to size the storage arrays
/// that init functions write into.
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

/// Extract the initializer content from an array declaration.
/// Given: "var _arr_3 = [_]Node{ .{...}, .{...} };"
/// Returns: ".{...}, .{...}"
/// Used to transplant node init expressions into the init function body.
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
