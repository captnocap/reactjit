//! Codegen for .tsz — parses token stream and emits Zig source code.
//! Single-pass: no AST. Handles classifiers, components, useState, template literals.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const Lexer = lexer_mod.Lexer;

const MAX_LOCALS = 64;
const MAX_COMPONENTS = 64;
const MAX_COMPONENT_PROPS = 64;
const MAX_ARRAYS = 512;
const MAX_STATE_SLOTS = 128;
const MAX_DYN_TEXTS = 128;
const MAX_ARRAY_INIT = 64;
const MAX_CLASSIFIERS = 256;
const MAX_COMP_FUNCS = 32;
const MAX_COMP_INSTANCES = 128;
const MAX_COMP_INNER = 8;
const MAX_DYN_DEPS = 8;
const MAX_FFI_HEADERS = 32;
const MAX_FFI_LIBS = 32;
const MAX_FFI_FUNCS = 128;

const PropType = enum {
    string,
    color,
    number,
    state_int,
    state_float,
    state_string,
    state_bool,
    dynamic_text,
    expression,
};

const PropBinding = struct {
    name: []const u8,
    value: []const u8,
    prop_type: PropType = .string,
};

const StateType = enum { int, float, boolean, string, array };

const StateInitial = union(StateType) {
    int: i64,
    float: f64,
    boolean: bool,
    string: []const u8,
    array: struct {
        values: [MAX_ARRAY_INIT]i64,
        count: u32,
    },
};

const StateSlot = struct {
    getter: []const u8,
    setter: []const u8,
    initial: StateInitial,
};

const ComponentInfo = struct {
    name: []const u8,
    prop_names: [MAX_COMPONENT_PROPS][]const u8,
    prop_count: u32,
    body_pos: u32,
    has_children: bool,
    usage_count: u32,
    func_generated: bool,
};

const LocalVar = struct {
    name: []const u8,
    expr: []const u8,
    state_type: StateType,
};

const DynText = struct {
    buf_id: u32,
    fmt_string: []const u8,
    fmt_args: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
    dep_slots: [MAX_DYN_DEPS]u32,
    dep_count: u32,
};

const MAX_FFI_HOOKS = 16;

const FFIHook = struct {
    getter: []const u8,      // state getter name (e.g., "unixTime")
    ffi_func: []const u8,    // C function name (e.g., "time")
    interval_ms: u32,        // poll interval
    return_type: StateType,  // inferred from declare function return type
    slot_id: u32,            // assigned state slot index
};

const CompFunc = struct {
    name: []const u8,
    func_source: []const u8,
    inner_count: u32,
    inner_sizes: [MAX_COMP_INNER]u32,
};

const CompInstance = struct {
    func_idx: u32,
    storage_names: [MAX_COMP_INNER][]const u8,
    init_call: []const u8,
    parent_arr: []const u8,
    parent_idx: u32,
};

const TemplateResult = struct {
    is_dynamic: bool,
    static_text: []const u8,
    fmt: []const u8,
    args: []const u8,
    dep_slots: [MAX_DYN_DEPS]u32,
    dep_count: u32,
};

// ════════════════════════════════════════════════════════════════
// Generator
// ════════════════════════════════════════════════════════════════

pub const Generator = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    input_file: []const u8,
    pos: u32,

    // Collected node array declarations
    array_decls: std.ArrayListUnmanaged([]const u8),
    array_counter: u32,

    // State (useState declarations)
    state_slots: [MAX_STATE_SLOTS]StateSlot,
    state_count: u32,
    has_state: bool,

    // Dynamic text (template literals that update from state)
    dyn_texts: [MAX_DYN_TEXTS]DynText,
    dyn_count: u32,
    last_dyn_id: ?u32,

    // Classifiers (style.cls.tsz)
    classifier_names: [MAX_CLASSIFIERS][]const u8,
    classifier_primitives: [MAX_CLASSIFIERS][]const u8,
    classifier_styles: [MAX_CLASSIFIERS][]const u8,
    classifier_text_props: [MAX_CLASSIFIERS][]const u8,
    classifier_count: u32,

    // Local variables (compile-time const substitution)
    local_vars: [MAX_LOCALS]LocalVar,
    local_count: u32,

    // Components (compile-time inlining)
    components: [MAX_COMPONENTS]ComponentInfo,
    component_count: u32,
    current_inline_component: ?[]const u8,

    // Prop substitution stack (active during component inlining)
    prop_stack: [MAX_COMPONENT_PROPS]PropBinding,
    prop_stack_count: u32,
    component_children_exprs: ?*std.ArrayListUnmanaged([]const u8),

    // Component functions (multi-use leaf optimization)
    comp_funcs: [MAX_COMP_FUNCS]CompFunc,
    comp_func_count: u32,
    comp_instances: [MAX_COMP_INSTANCES]CompInstance,
    comp_instance_count: u32,
    comp_instance_counter: [MAX_COMP_FUNCS]u32,

    // FFI (// @ffi <header.h> -llib)
    ffi_headers: std.ArrayListUnmanaged([]const u8),
    ffi_libs: std.ArrayListUnmanaged([]const u8),
    ffi_funcs: std.ArrayListUnmanaged([]const u8),
    ffi_return_types: std.ArrayListUnmanaged(StateType), // parallel to ffi_funcs

    // useFFI hooks (Zig-side polling)
    ffi_hooks: [MAX_FFI_HOOKS]FFIHook,
    ffi_hook_count: u32,

    // Embedded JS logic (<script> or .script.tsz)
    compute_js: ?[]const u8 = null,

    // When true, findProp returns "_p_NAME" instead of concrete value
    emit_prop_refs: bool = false,

    compile_error: ?[]const u8,

    fn setError(self: *Generator, msg: []const u8) void {
        if (self.compile_error == null) {
            self.compile_error = msg;
            std.debug.print("[tsz] compile error: {s}\n", .{msg});
        }
    }

    pub fn init(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, input_file: []const u8) Generator {
        return .{
            .alloc = alloc,
            .lex = lex,
            .source = source,
            .input_file = input_file,
            .pos = 0,
            .array_decls = .{},
            .array_counter = 0,
            .state_slots = undefined,
            .state_count = 0,
            .has_state = false,
            .dyn_texts = undefined,
            .dyn_count = 0,
            .last_dyn_id = null,
            .classifier_names = undefined,
            .classifier_primitives = undefined,
            .classifier_styles = undefined,
            .classifier_text_props = undefined,
            .classifier_count = 0,
            .ffi_headers = .{},
            .ffi_libs = .{},
            .ffi_funcs = .{},
            .ffi_return_types = .{},
            .ffi_hooks = undefined,
            .ffi_hook_count = 0,
            .local_vars = undefined,
            .local_count = 0,
            .components = undefined,
            .component_count = 0,
            .current_inline_component = null,
            .prop_stack = undefined,
            .prop_stack_count = 0,
            .component_children_exprs = null,
            .comp_funcs = undefined,
            .comp_func_count = 0,
            .comp_instances = undefined,
            .comp_instance_count = 0,
            .comp_instance_counter = [_]u32{0} ** MAX_COMP_FUNCS,
            .compile_error = null,
        };
    }

    // ── Token helpers ──

    fn advance_token(self: *Generator) void {
        if (self.pos < self.lex.count) self.pos += 1;
    }
    fn cur(self: *Generator) Token {
        return self.lex.get(self.pos);
    }
    fn curText(self: *Generator) []const u8 {
        return self.cur().text(self.source);
    }
    fn curKind(self: *Generator) TokenKind {
        return if (self.pos < self.lex.count) self.lex.get(self.pos).kind else .eof;
    }
    fn isIdent(self: *Generator, name: []const u8) bool {
        return self.curKind() == .identifier and std.mem.eql(u8, self.curText(), name);
    }

    // ── Main entry point ──

    pub fn generate(self: *Generator) ![]const u8 {
        if (self.lex.overflow) return error.TokenLimitExceeded;

        // Phase 1: FFI pragmas (// @ffi <header.h> -llib)
        self.collectFFIPragmas();

        // Phase 2: Declared functions (declare function name(): type)
        self.pos = 0;
        self.collectDeclaredFunctions();

        // Phase 3: Classifiers (classifier({...}))
        self.pos = 0;
        self.collectClassifiers();

        // Phase 4: Component definitions (function Name({props}))
        self.pos = 0;
        self.collectComponents();

        // Phase 5: Extract <script> block
        self.pos = 0;
        self.extractComputeBlock();

        // Phase 6: Collect useState
        self.pos = 0;
        if (self.compute_js != null) {
            self.collectStateHooksTopLevel();
        }
        self.pos = 0;
        const app_start = self.findAppFunction() orelse return error.NoAppFunction;
        if (self.compute_js == null) {
            self.collectStateHooks(app_start);
        }

        // Phase 7: Count component usage in App body
        self.countComponentUsage(app_start);

        // Phase 8: Find return JSX and generate node tree
        self.pos = app_start;
        self.findReturnStatement();
        const has_jsx = self.curKind() == .lt;
        const root_expr = if (has_jsx) try self.parseJSXElement() else ".{}";

        if (self.compile_error) |_| return error.LimitExceeded;

        return self.emitZigSource(root_expr);
    }

    // ── FFI collection ──

    fn collectFFIPragmas(self: *Generator) void {
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

    fn collectDeclaredFunctions(self: *Generator) void {
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("declare")) {
                self.advance_token();
                if (self.isIdent("function")) {
                    self.advance_token();
                    if (self.curKind() == .identifier) {
                        self.ffi_funcs.append(self.alloc, self.curText()) catch {};
                        // Scan forward to find return type: declare function name(...): TYPE
                        var ret_type: StateType = .int;
                        const saved = self.pos;
                        self.advance_token(); // skip name
                        // Skip (...)
                        if (self.curKind() == .lparen) {
                            var depth: u32 = 1;
                            self.advance_token();
                            while (depth > 0 and self.curKind() != .eof) {
                                if (self.curKind() == .lparen) depth += 1;
                                if (self.curKind() == .rparen) depth -= 1;
                                if (depth > 0) self.advance_token();
                            }
                            if (self.curKind() == .rparen) self.advance_token();
                        }
                        // Look for : TYPE
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
                    }
                }
            }
            self.advance_token();
        }
    }

    fn ffiReturnType(self: *Generator, name: []const u8) StateType {
        for (self.ffi_funcs.items, 0..) |f, i| {
            if (std.mem.eql(u8, f, name)) {
                if (i < self.ffi_return_types.items.len) return self.ffi_return_types.items[i];
                return .int;
            }
        }
        return .int;
    }

    fn isFFIFunc(self: *Generator, name: []const u8) bool {
        for (self.ffi_funcs.items) |f| {
            if (std.mem.eql(u8, f, name)) return true;
        }
        return false;
    }

    // ── Classifier collection ──

    fn collectClassifiers(self: *Generator) void {
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
                                        prim_type = self.parseStringAttrInline() catch "Box";
                                    } else if (std.mem.eql(u8, field, "style")) {
                                        style_str = self.parseStyleAttr() catch "";
                                    } else if (std.mem.eql(u8, field, "size") or std.mem.eql(u8, field, "fontSize")) {
                                        const sz = self.curText();
                                        self.advance_token();
                                        text_props = std.fmt.allocPrint(self.alloc, ".font_size = {s}", .{sz}) catch "";
                                    } else if (std.mem.eql(u8, field, "bold")) {
                                        if (self.curKind() == .identifier) self.advance_token();
                                    } else if (std.mem.eql(u8, field, "color")) {
                                        const col = self.parseStringAttrInline() catch "";
                                        if (col.len > 0) {
                                            const zig_col = self.parseColorValue(col) catch "Color.rgb(255,255,255)";
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

                            if (self.classifier_count < MAX_CLASSIFIERS) {
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

    fn findClassifier(self: *Generator, name: []const u8) ?u32 {
        for (0..self.classifier_count) |i| {
            if (std.mem.eql(u8, self.classifier_names[i], name)) return @intCast(i);
        }
        return null;
    }

    // ── Component collection ──

    fn collectComponents(self: *Generator) void {
        self.pos = 0;
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("function")) {
                self.advance_token();
                if (self.curKind() != .identifier) continue;
                const name = self.curText();
                if (std.mem.eql(u8, name, "App")) { self.advance_token(); continue; }
                if (name.len == 0 or name[0] < 'A' or name[0] > 'Z') { self.advance_token(); continue; }
                self.advance_token();

                var prop_names: [MAX_COMPONENT_PROPS][]const u8 = undefined;
                var prop_count: u32 = 0;
                if (self.curKind() == .lparen) {
                    self.advance_token();
                    if (self.curKind() == .lbrace) {
                        self.advance_token();
                        while (self.curKind() != .rbrace and self.curKind() != .eof) {
                            if (self.curKind() == .identifier) {
                                if (prop_count < MAX_COMPONENT_PROPS) {
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
                                if (self.component_count < MAX_COMPONENTS) {
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

    fn findComponent(self: *Generator, name: []const u8) ?*ComponentInfo {
        for (0..self.component_count) |i| {
            if (std.mem.eql(u8, self.components[i].name, name)) return &self.components[i];
        }
        return null;
    }

    fn countComponentUsage(self: *Generator, app_start: u32) void {
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

    fn isLocalVar(self: *Generator, name: []const u8) ?*const LocalVar {
        for (0..self.local_count) |i| {
            if (std.mem.eql(u8, self.local_vars[i].name, name)) return &self.local_vars[i];
        }
        return null;
    }

    // ── State collection ──

    fn isState(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].getter, name)) return @intCast(i);
        }
        return null;
    }

    fn stateTypeById(self: *Generator, slot_id: u32) StateType {
        return std.meta.activeTag(self.state_slots[slot_id].initial);
    }

    fn regularSlotId(self: *Generator, state_idx: u32) u32 {
        var count: u32 = 0;
        for (0..state_idx) |j| {
            if (std.meta.activeTag(self.state_slots[j].initial) != .array) count += 1;
        }
        return count;
    }

    fn findAppFunction(self: *Generator) ?u32 {
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

    fn collectStateHooksTopLevel(self: *Generator) void {
        self.pos = 0;
        self.scanForUseState(false);
    }

    fn collectStateHooks(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();
        self.scanForUseState(true);
    }

    fn scanForUseState(self: *Generator, stop_at_return: bool) void {
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
                            self.advance_token(); // ]
                            if (self.curKind() == .equals) self.advance_token(); // =
                            if (self.isIdent("useFFI")) {
                                self.advance_token(); // useFFI
                                if (self.curKind() == .lparen) self.advance_token(); // (
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

                                // Create a state slot for this hook
                                const ret_type = self.ffiReturnType(ffi_func_name);
                                const initial: StateInitial = switch (ret_type) {
                                    .string => .{ .string = "" },
                                    .boolean => .{ .boolean = false },
                                    .float => .{ .float = 0.0 },
                                    else => .{ .int = 0 },
                                };
                                if (self.state_count < MAX_STATE_SLOTS) {
                                    const slot_id = self.state_count;
                                    self.state_slots[slot_id] = .{
                                        .getter = getter,
                                        .setter = "",
                                        .initial = initial,
                                    };
                                    self.state_count += 1;
                                    self.has_state = true;

                                    if (self.ffi_hook_count < MAX_FFI_HOOKS) {
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
                            // Not useFFI after ] = — skip
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
                                var initial: StateInitial = .{ .int = 0 };
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
                                    var arr_vals: [MAX_ARRAY_INIT]i64 = undefined;
                                    var arr_cnt: u32 = 0;
                                    while (self.curKind() != .rbracket and self.curKind() != .eof) {
                                        if (self.curKind() == .number) {
                                            if (arr_cnt < MAX_ARRAY_INIT) {
                                                arr_vals[arr_cnt] = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
                                                arr_cnt += 1;
                                            }
                                            self.advance_token();
                                        } else if (self.curKind() == .minus) {
                                            self.advance_token();
                                            if (self.curKind() == .number) {
                                                if (arr_cnt < MAX_ARRAY_INIT) {
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

                                if (self.state_count < MAX_STATE_SLOTS) {
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

    fn findReturnStatement(self: *Generator) void {
        while (self.pos < self.lex.count and !self.isIdent("return")) {
            self.advance_token();
        }
        if (self.isIdent("return")) self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
    }

    // ── Compute block ──

    fn extractComputeBlock(self: *Generator) void {
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

    fn isIdentByte(ch: u8) bool {
        return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
    }

    fn rewriteSetterCalls(self: *Generator, js: []const u8) ![]const u8 {
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
                    if (setter.len == 0) continue; // useFFI slots have no setter
                    if (ii + setter.len + 1 <= line.len and
                        std.mem.eql(u8, line[ii .. ii + setter.len], setter) and
                        line[ii + setter.len] == '(')
                    {
                        if (ii > 0 and isIdentByte(line[ii - 1])) break;
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

    // ── Prop resolution ──

    fn findProp(self: *Generator, name: []const u8) ?[]const u8 {
        var i: u32 = self.prop_stack_count;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) {
                if (self.emit_prop_refs) {
                    return std.fmt.allocPrint(self.alloc, "_p_{s}", .{name}) catch null;
                }
                return self.prop_stack[i].value;
            }
        }
        return null;
    }

    fn findPropBinding(self: *Generator, name: []const u8) ?*const PropBinding {
        var i: u32 = self.prop_stack_count;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) {
                return &self.prop_stack[i];
            }
        }
        return null;
    }

    fn classifyExpr(self: *Generator, expr: []const u8) PropType {
        _ = self;
        if (expr.len >= 2 and (expr[0] == '"' or expr[0] == '\'')) {
            const inner = expr[1 .. expr.len - 1];
            if (inner.len > 0 and inner[0] == '#') return .color;
            return .string;
        }
        if (std.mem.startsWith(u8, expr, "state.getSlot(")) return .state_int;
        if (std.mem.startsWith(u8, expr, "state.getSlotFloat(")) return .state_float;
        if (std.mem.startsWith(u8, expr, "state.getSlotString(")) return .state_string;
        if (std.mem.startsWith(u8, expr, "state.getSlotBool(")) return .state_bool;
        if (expr.len > 0 and expr[0] >= '0' and expr[0] <= '9') return .number;
        return .expression;
    }

    fn zigTypeForPropType(pt: PropType) []const u8 {
        return switch (pt) {
            .string => "[]const u8",
            .color => "Color",
            .number => "u16",
            .state_int => "i64",
            .state_float => "f32",
            .state_string => "[]const u8",
            .state_bool => "bool",
            .dynamic_text => "[]const u8",
            .expression => "i64",
        };
    }

    fn estimateBufSize(fmt: []const u8) u32 {
        var size: u32 = 0;
        var i: usize = 0;
        while (i < fmt.len) {
            if (i + 2 < fmt.len and fmt[i] == '{' and fmt[i + 2] == '}') {
                switch (fmt[i + 1]) {
                    'd' => size += 20,
                    's' => size += 128,
                    'c' => size += 1,
                    else => size += 32,
                }
                i += 3;
            } else {
                size += 1;
                i += 1;
            }
        }
        return @max(size, 64);
    }

    // ── Attribute parsing ──

    fn parseStyleAttr(self: *Generator) ![]const u8 {
        if (self.curKind() == .lbrace) self.advance_token();
        var double_brace = false;
        if (self.curKind() == .lbrace) { self.advance_token(); double_brace = true; }

        var fields: std.ArrayListUnmanaged(u8) = .{};

        while (self.curKind() != .rbrace and self.curKind() != .eof) {
            if (self.curKind() == .identifier or self.curKind() == .string) {
                var key = self.curText();
                const is_string_key = self.curKind() == .string;
                self.advance_token();
                if (is_string_key and key.len >= 2) key = key[1 .. key.len - 1];
                if (std.mem.indexOf(u8, key, "-") != null) {
                    key = kebabToCamel(self.alloc, key) catch key;
                }
                if (self.curKind() == .colon) self.advance_token();

                if (mapColorKey(key)) |color_field| {
                    const val = try self.parseStringAttrInline();
                    const color = try self.parseColorValue(val);
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, color_field);
                    try fields.appendSlice(self.alloc, " = ");
                    try fields.appendSlice(self.alloc, color);
                } else if (mapStyleKeyI16(key)) |zig_key| {
                    const val = self.curText();
                    self.advance_token();
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, zig_key);
                    try fields.appendSlice(self.alloc, " = ");
                    try fields.appendSlice(self.alloc, val);
                } else if (mapStyleKey(key)) |zig_key| {
                    if (self.curKind() == .string) {
                        const str_val = try self.parseStringAttrInline();
                        if (std.mem.endsWith(u8, str_val, "%")) {
                            if (std.fmt.parseFloat(f32, str_val[0 .. str_val.len - 1]) catch null) |pct| {
                                if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                                try fields.appendSlice(self.alloc, ".");
                                try fields.appendSlice(self.alloc, zig_key);
                                try fields.appendSlice(self.alloc, " = ");
                                try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{-(pct / 100.0)}));
                            }
                        } else if (parseCSSValue(str_val)) |px| {
                            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                            try fields.appendSlice(self.alloc, ".");
                            try fields.appendSlice(self.alloc, zig_key);
                            try fields.appendSlice(self.alloc, " = ");
                            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{px}));
                        }
                    } else {
                        const val = self.curText();
                        self.advance_token();
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = ");
                        try fields.appendSlice(self.alloc, val);
                    }
                } else if (mapEnumKey(key)) |mapping| {
                    const val = try self.parseStringAttrInline();
                    if (mapEnumValue(mapping.prefix, val)) |zig_val| {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, mapping.field);
                        try fields.appendSlice(self.alloc, " = ");
                        try fields.appendSlice(self.alloc, zig_val);
                    }
                } else {
                    self.skipStyleValue();
                }
            }
            if (self.curKind() == .comma) self.advance_token();
        }

        if (self.curKind() == .rbrace) self.advance_token();
        if (double_brace and self.curKind() == .rbrace) self.advance_token();
        return try self.alloc.dupe(u8, fields.items);
    }

    fn skipStyleValue(self: *Generator) void {
        if (self.curKind() == .string or self.curKind() == .number or self.curKind() == .identifier) {
            self.advance_token();
        }
    }

    fn parseStringAttr(self: *Generator) ![]const u8 {
        if (self.curKind() == .string) {
            const tok = self.cur();
            const raw = tok.text(self.source);
            self.advance_token();
            return raw[1 .. raw.len - 1];
        }
        if (self.curKind() == .lbrace) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (self.findProp(name)) |val| {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    if (std.mem.startsWith(u8, val, "_p_")) return val;
                    if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) return val[1 .. val.len - 1];
                    return val;
                }
            }
            const result = try self.parseStringAttr();
            if (self.curKind() == .rbrace) self.advance_token();
            return result;
        }
        self.advance_token();
        return "";
    }

    fn parseStringAttrInline(self: *Generator) ![]const u8 {
        if (self.curKind() == .string) {
            const tok = self.cur();
            const raw = tok.text(self.source);
            self.advance_token();
            return raw[1 .. raw.len - 1];
        }
        if (self.curKind() == .identifier) {
            const name = self.curText();
            if (self.findProp(name)) |val| {
                self.advance_token();
                if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) return val[1 .. val.len - 1];
                return val;
            }
            if (self.isLocalVar(name)) |lv| {
                self.advance_token();
                if (lv.expr.len >= 2 and (lv.expr[0] == '"' or lv.expr[0] == '\'')) return lv.expr[1 .. lv.expr.len - 1];
                return lv.expr;
            }
        }
        self.advance_token();
        return "";
    }

    fn parseExprAttr(self: *Generator) ![]const u8 {
        if (self.curKind() == .lbrace) {
            self.advance_token();
            const val = self.curText();
            self.advance_token();
            if (self.curKind() == .rbrace) self.advance_token();
            return val;
        }
        if (self.curKind() == .number or self.curKind() == .string) {
            const val = self.curText();
            self.advance_token();
            return val;
        }
        return "0";
    }

    fn skipAttrValue(self: *Generator) !void {
        if (self.curKind() == .string or self.curKind() == .number) {
            self.advance_token();
        } else if (self.curKind() == .lbrace) {
            try self.skipBalanced();
        }
    }

    fn skipBalanced(self: *Generator) !void {
        if (self.curKind() != .lbrace) return;
        self.advance_token();
        var depth: u32 = 1;
        while (depth > 0 and self.curKind() != .eof) {
            if (self.curKind() == .lbrace) depth += 1;
            if (self.curKind() == .rbrace) depth -= 1;
            if (depth > 0) self.advance_token();
        }
        if (self.curKind() == .rbrace) self.advance_token();
    }

    fn collectTextContent(self: *Generator) []const u8 {
        const start = self.pos;
        while (self.curKind() != .lt and self.curKind() != .lt_slash and
            self.curKind() != .lbrace and self.curKind() != .eof)
        {
            self.advance_token();
        }
        if (self.pos > start) {
            const first = self.lex.get(start);
            const last = self.lex.get(self.pos - 1);
            return self.source[first.start..last.end];
        }
        return "";
    }

    // ── Template literals ──

    fn parseTemplateLiteral(self: *Generator) !TemplateResult {
        const tok = self.cur();
        const raw = tok.text(self.source);
        const inner = raw[1 .. raw.len - 1];
        return self.parseTemplateLiteralFromText(inner);
    }

    fn parseTemplateLiteralFromText(self: *Generator, inner: []const u8) !TemplateResult {
        if (std.mem.indexOf(u8, inner, "${") == null) {
            return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
        }

        var fmt: std.ArrayListUnmanaged(u8) = .{};
        var args: std.ArrayListUnmanaged(u8) = .{};
        var dep_slots: [MAX_DYN_DEPS]u32 = undefined;
        var dep_count: u32 = 0;
        var i: usize = 0;

        while (i < inner.len) {
            if (i + 1 < inner.len and inner[i] == '$' and inner[i + 1] == '{') {
                i += 2;
                const expr_start = i;
                var depth: u32 = 1;
                while (i < inner.len and depth > 0) {
                    if (inner[i] == '{') depth += 1;
                    if (inner[i] == '}') depth -= 1;
                    if (depth > 0) i += 1;
                }
                const expr = inner[expr_start..i];
                if (i < inner.len) i += 1;

                if (self.isState(expr)) |slot_id| {
                    const st = self.stateTypeById(slot_id);
                    const rid = self.regularSlotId(slot_id);
                    if (dep_count < MAX_DYN_DEPS) { dep_slots[dep_count] = rid; dep_count += 1; }
                    switch (st) {
                        .string => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}));
                        },
                        .float => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}));
                        },
                        .boolean => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}));
                        },
                        else => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}));
                        },
                    }
                } else if (self.findPropBinding(expr)) |binding| {
                    const pval = if (self.emit_prop_refs)
                        (std.fmt.allocPrint(self.alloc, "_p_{s}", .{expr}) catch "")
                    else
                        binding.value;
                    if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                        if (binding.value.len >= 2 and binding.value[0] == '`') {
                            const tmpl_inner = binding.value[1 .. binding.value.len - 1];
                            const tmpl = try self.parseTemplateLiteralFromText(tmpl_inner);
                            if (tmpl.is_dynamic) {
                                try fmt.appendSlice(self.alloc, tmpl.fmt);
                                if (tmpl.args.len > 0) {
                                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                                    try args.appendSlice(self.alloc, tmpl.args);
                                }
                                for (0..tmpl.dep_count) |di| {
                                    if (dep_count < MAX_DYN_DEPS) { dep_slots[dep_count] = tmpl.dep_slots[di]; dep_count += 1; }
                                }
                            } else {
                                try fmt.appendSlice(self.alloc, tmpl.static_text);
                            }
                        } else {
                            try fmt.appendSlice(self.alloc, binding.value);
                        }
                    } else if (pval.len >= 2 and (pval[0] == '"' or pval[0] == '\'')) {
                        try fmt.appendSlice(self.alloc, pval[1 .. pval.len - 1]);
                    } else if (std.mem.startsWith(u8, pval, "_p_")) {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    } else if (std.mem.startsWith(u8, pval, "state.getSlotString")) {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    } else {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    }
                } else if (self.isLocalVar(expr)) |lv| {
                    switch (lv.state_type) {
                        .string => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, lv.expr);
                        },
                        .float => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, lv.expr);
                        },
                        .boolean => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "if ({s}) \"true\" else \"false\"", .{lv.expr}));
                        },
                        else => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, lv.expr);
                        },
                    }
                } else {
                    // Unknown expression — embed as static text
                    try fmt.appendSlice(self.alloc, expr);
                }
            } else {
                try fmt.append(self.alloc, inner[i]);
                i += 1;
            }
        }

        if (args.items.len > 0) {
            return .{
                .is_dynamic = true,
                .static_text = "",
                .fmt = try self.alloc.dupe(u8, fmt.items),
                .args = try self.alloc.dupe(u8, args.items),
                .dep_slots = dep_slots,
                .dep_count = dep_count,
            };
        }
        return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
    }

    // ── Expression chain ──

    fn emitStateExpr(self: *Generator) ![]const u8 {
        return try self.emitTernary();
    }

    fn emitTernary(self: *Generator) ![]const u8 {
        const cond = try self.emitLogicalOr();
        if (self.curKind() == .question_question) {
            self.advance_token();
            const fallback = try self.emitTernary();
            if (self.isStringExpr(cond)) {
                return try std.fmt.allocPrint(self.alloc, "(if ({s}.len > 0) {s} else {s})", .{ cond, cond, fallback });
            } else {
                return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, cond, fallback });
            }
        }
        if (self.curKind() == .question) {
            self.advance_token();
            const then_val = try self.emitTernary();
            if (self.curKind() != .colon) return error.ExpectedColonInTernary;
            self.advance_token();
            const else_val = try self.emitTernary();
            const is_already_bool = std.mem.indexOf(u8, cond, "==") != null or
                std.mem.indexOf(u8, cond, "!=") != null or
                std.mem.indexOf(u8, cond, "< ") != null or
                std.mem.indexOf(u8, cond, "> ") != null or
                std.mem.indexOf(u8, cond, "<=") != null or
                std.mem.indexOf(u8, cond, ">=") != null or
                std.mem.eql(u8, cond, "true") or
                std.mem.eql(u8, cond, "false") or
                std.mem.indexOf(u8, cond, "(!") != null;
            if (is_already_bool) {
                return try std.fmt.allocPrint(self.alloc, "(if ({s}) {s} else {s})", .{ cond, then_val, else_val });
            } else {
                return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, then_val, else_val });
            }
        }
        return cond;
    }

    fn emitLogicalOr(self: *Generator) ![]const u8 {
        var left = try self.emitLogicalAnd();
        while (self.curKind() == .pipe_pipe) {
            self.advance_token();
            const right = try self.emitLogicalAnd();
            left = try std.fmt.allocPrint(self.alloc, "({s} or {s})", .{ left, right });
        }
        return left;
    }

    fn emitLogicalAnd(self: *Generator) ![]const u8 {
        var left = try self.emitEquality();
        while (self.curKind() == .amp_amp) {
            self.advance_token();
            const right = try self.emitEquality();
            left = try std.fmt.allocPrint(self.alloc, "({s} and {s})", .{ left, right });
        }
        return left;
    }

    fn emitEquality(self: *Generator) ![]const u8 {
        var left = try self.emitComparison();
        while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
            const op = if (self.curKind() == .eq_eq) "==" else "!=";
            self.advance_token();
            const right = try self.emitComparison();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitComparison(self: *Generator) ![]const u8 {
        var left = try self.emitAdditive();
        while (self.curKind() == .lt or self.curKind() == .gt or
            self.curKind() == .lt_eq or self.curKind() == .gt_eq)
        {
            const op = switch (self.curKind()) {
                .lt => "<",
                .gt => ">",
                .lt_eq => "<=",
                .gt_eq => ">=",
                else => unreachable,
            };
            self.advance_token();
            const right = try self.emitAdditive();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn isStringExpr(_: *Generator, expr: []const u8) bool {
        if (expr.len >= 2 and expr[0] == '"') return true;
        if (std.mem.indexOf(u8, expr, "getSlotString") != null) return true;
        return false;
    }

    fn emitAdditive(self: *Generator) ![]const u8 {
        var left = try self.emitMultiplicative();
        while (self.curKind() == .plus or self.curKind() == .minus) {
            if (self.curKind() == .minus) {
                self.advance_token();
                const right = try self.emitMultiplicative();
                left = try std.fmt.allocPrint(self.alloc, "({s} - {s})", .{ left, right });
                continue;
            }
            self.advance_token();
            const right = try self.emitMultiplicative();
            if (self.isStringExpr(left) or self.isStringExpr(right)) {
                var parts = std.ArrayListUnmanaged([]const u8){};
                try parts.append(self.alloc, left);
                try parts.append(self.alloc, right);
                while (self.curKind() == .plus) {
                    self.advance_token();
                    const next = try self.emitMultiplicative();
                    try parts.append(self.alloc, next);
                }
                const lbl = self.array_counter;
                self.array_counter += 1;
                var fmt_str = std.ArrayListUnmanaged(u8){};
                var arg_str = std.ArrayListUnmanaged(u8){};
                for (parts.items) |part| {
                    if (self.isStringExpr(part)) {
                        try fmt_str.appendSlice(self.alloc, "{s}");
                    } else {
                        try fmt_str.appendSlice(self.alloc, "{d}");
                    }
                    if (arg_str.items.len > 0) try arg_str.appendSlice(self.alloc, ", ");
                    try arg_str.appendSlice(self.alloc, part);
                }
                const blk_name = try std.fmt.allocPrint(self.alloc, "blk_{d}", .{lbl});
                left = try std.fmt.allocPrint(self.alloc,
                    "({s}: {{ var _cb: [512]u8 = undefined; break :{s} std.fmt.bufPrint(&_cb, \"{s}\", .{{ {s} }}) catch \"\"; }})",
                    .{ blk_name, blk_name, fmt_str.items, arg_str.items });
            } else {
                left = try std.fmt.allocPrint(self.alloc, "({s} + {s})", .{ left, right });
            }
        }
        return left;
    }

    fn emitMultiplicative(self: *Generator) ![]const u8 {
        var left = try self.emitUnary();
        while (self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent) {
            const op = self.curText();
            self.advance_token();
            const right = try self.emitUnary();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitUnary(self: *Generator) ![]const u8 {
        if (self.curKind() == .bang) {
            self.advance_token();
            const operand = try self.emitUnary();
            return try std.fmt.allocPrint(self.alloc, "(!{s})", .{operand});
        }
        if (self.curKind() == .minus) {
            self.advance_token();
            const operand = try self.emitUnary();
            return try std.fmt.allocPrint(self.alloc, "(-{s})", .{operand});
        }
        if (self.curKind() == .tilde) {
            self.advance_token();
            const operand = try self.emitUnary();
            return try std.fmt.allocPrint(self.alloc, "(~{s})", .{operand});
        }
        return try self.emitStateAtom();
    }

    fn emitStateAtom(self: *Generator) anyerror![]const u8 {
        // Parenthesized expression
        if (self.curKind() == .lparen) {
            self.advance_token();
            const inner = try self.emitStateExpr();
            if (self.curKind() == .rparen) self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "({s})", .{inner});
        }
        // Number literal
        if (self.curKind() == .number) {
            const val = self.curText();
            self.advance_token();
            return val;
        }
        // String literal
        if (self.curKind() == .string) {
            const val = self.curText();
            self.advance_token();
            if (val.len >= 2 and val[0] == '\'') {
                return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{val[1 .. val.len - 1]});
            }
            return val;
        }
        // Template literal in expression context
        if (self.curKind() == .template_literal) {
            const tmpl = try self.parseTemplateLiteral();
            self.advance_token();
            if (!tmpl.is_dynamic) {
                return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{tmpl.static_text});
            }
            const buf_size = estimateBufSize(tmpl.fmt);
            const lbl = self.array_counter;
            self.array_counter += 1;
            return try std.fmt.allocPrint(self.alloc, "(blk_{d}: {{ var _tb: [{d}]u8 = undefined; break :blk_{d} std.fmt.bufPrint(&_tb, \"{s}\", .{{ {s} }}) catch \"\"; }})", .{ lbl, buf_size, lbl, tmpl.fmt, tmpl.args });
        }
        if (self.curKind() == .identifier) {
            const name = self.curText();
            // Boolean literals
            if (std.mem.eql(u8, name, "true") or std.mem.eql(u8, name, "false")) {
                self.advance_token();
                return name;
            }
            // Component prop resolution
            if (self.findProp(name)) |prop_val| {
                self.advance_token();
                return prop_val;
            }
            // State getter
            if (self.isState(name)) |slot_id| {
                self.advance_token();
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);
                return switch (st) {
                    .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                    .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                    .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                    else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                };
            }
            // Local variable
            if (self.isLocalVar(name)) |lv| {
                self.advance_token();
                return try self.alloc.dupe(u8, lv.expr);
            }
            // FFI call
            if (self.isFFIFunc(name)) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                var ffi_args: std.ArrayListUnmanaged(u8) = .{};
                while (self.curKind() != .rparen and self.curKind() != .eof) {
                    if (self.curKind() == .number) {
                        if (std.mem.eql(u8, self.curText(), "0")) {
                            try ffi_args.appendSlice(self.alloc, "null");
                        } else {
                            try ffi_args.appendSlice(self.alloc, self.curText());
                        }
                    }
                    self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "ffi.{s}({s})", .{ name, ffi_args.items });
            }
            // Bare identifier fallback
            self.advance_token();
            return name;
        }
        self.advance_token();
        return "0";
    }

    // ── Component inlining ──

    fn inlineComponent(self: *Generator, comp: *ComponentInfo) anyerror![]const u8 {
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
                        self.advance_token(); // {
                        if (self.curKind() == .template_literal) {
                            const tok = self.cur();
                            const raw = tok.text(self.source);
                            val = try self.alloc.dupe(u8, raw);
                            prop_type = .dynamic_text;
                            self.advance_token();
                        } else {
                            val = try self.emitStateExpr();
                            prop_type = self.classifyExpr(val);
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
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
                        const child_expr = try self.parseJSXElement();
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
                const cf_result = try self.compFuncInline(comp, saved_prop_count);
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
        const result = try self.parseJSXElement();
        self.pos = saved_pos;
        self.prop_stack_count = saved_prop_count;
        self.component_children_exprs = saved_children;
        return result;
    }

    fn compFuncInline(self: *Generator, comp: *ComponentInfo, saved_prop_count: u32) !?[]const u8 {
        var func_idx: u32 = 0;

        if (!comp.func_generated) {
            const arr_count_before = self.array_decls.items.len;
            const arr_id_before = self.array_counter;

            const saved_pos = self.pos;
            self.pos = comp.body_pos;
            self.component_children_exprs = null;
            self.emit_prop_refs = true;
            const root_expr = try self.parseJSXElement();
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
                try func_src.appendSlice(self.alloc, zigTypeForPropType(prop.prop_type));
            }
            try func_src.appendSlice(self.alloc, ") Node {\n");

            for (0..inner_count) |ii| {
                const decl = self.array_decls.items[arr_count_before + ii];
                const arr_init = extractArrayInit(decl);
                var replaced_init: []const u8 = try self.alloc.dupe(u8, arr_init);
                for (0..inner_count) |jj| {
                    const ref_id = arr_id_before + @as(u32, @intCast(jj));
                    replaced_init = try self.replaceAllOccurrences(replaced_init, try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{ref_id}), try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{jj}));
                }
                try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _inner_{d}.* = [_]Node{{ {s} }};\n", .{ ii, replaced_init }));
            }

            var replaced_root: []const u8 = try self.alloc.dupe(u8, root_expr);
            for (0..inner_count) |ii| {
                const arr_id = arr_id_before + @as(u32, @intCast(ii));
                replaced_root = try self.replaceAllOccurrences(replaced_root, try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{arr_id}), try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{ii}));
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
                        try call.appendSlice(self.alloc, try self.parseColorValue(prop.value[1 .. prop.value.len - 1]));
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

    fn replaceAllOccurrences(self: *Generator, haystack: []const u8, needle: []const u8, replacement: []const u8) ![]const u8 {
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

    // ── JSX parser ──

    fn parseJSXElement(self: *Generator) ![]const u8 {
        if (self.curKind() != .lt) return error.ExpectedJSX;
        self.advance_token(); // <

        // Fragment: <>...</>
        if (self.curKind() == .gt) {
            self.advance_token();
            var frag_children = std.ArrayListUnmanaged([]const u8){};
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    try frag_children.append(self.alloc, try self.parseJSXElement());
                } else {
                    self.advance_token();
                }
            }
            if (self.curKind() == .lt_slash) { self.advance_token(); if (self.curKind() == .gt) self.advance_token(); }
            if (frag_children.items.len == 0) return try self.alloc.dupe(u8, ".{}");
            const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
            self.array_counter += 1;
            var arr_body = std.ArrayListUnmanaged(u8){};
            for (frag_children.items, 0..) |child_expr, ci| {
                if (ci > 0) try arr_body.appendSlice(self.alloc, ", ");
                try arr_body.appendSlice(self.alloc, child_expr);
            }
            try self.array_decls.append(self.alloc, try std.fmt.allocPrint(self.alloc, "var {s} = [_]Node{{ {s} }};", .{ arr_name, arr_body.items }));
            return try std.fmt.allocPrint(self.alloc, ".{{ .children = &{s} }}", .{arr_name});
        }

        var tag_name = self.curText();
        self.advance_token();

        // C.Name classifier reference
        var classifier_idx: ?u32 = null;
        if (std.mem.eql(u8, tag_name, "C") and self.curKind() == .dot) {
            self.advance_token();
            const cls_name = self.curText();
            self.advance_token();
            classifier_idx = self.findClassifier(cls_name);
            if (classifier_idx) |idx| {
                tag_name = self.classifier_primitives[idx];
            }
        }

        // Component call
        if (self.findComponent(tag_name)) |comp| {
            return try self.inlineComponent(comp);
        }

        // Parse attributes
        var style_str: []const u8 = "";
        var font_size: []const u8 = "";
        var letter_spacing: []const u8 = "";
        var line_height_val: []const u8 = "";
        var number_of_lines: []const u8 = "";
        var no_wrap: bool = false;
        var color_str: []const u8 = "";
        var src_str: []const u8 = "";

        // Pre-populate from classifier
        if (classifier_idx) |idx| {
            style_str = self.classifier_styles[idx];
            const tp = self.classifier_text_props[idx];
            if (tp.len > 0) {
                if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                    const after = tp[fs_pos + 13 ..];
                    const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                    font_size = after[0..end];
                }
            }
        }

        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr_name = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token();
                    if (std.mem.eql(u8, attr_name, "style")) {
                        style_str = try self.parseStyleAttr();
                    } else if (std.mem.eql(u8, attr_name, "fontSize")) {
                        font_size = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "letterSpacing")) {
                        letter_spacing = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "lineHeight")) {
                        line_height_val = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "numberOfLines")) {
                        number_of_lines = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "noWrap")) {
                        try self.skipAttrValue();
                        no_wrap = true;
                    } else if (std.mem.eql(u8, attr_name, "color")) {
                        color_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "src")) {
                        src_str = try self.parseStringAttr();
                    } else {
                        try self.skipAttrValue();
                    }
                }
            } else {
                self.advance_token();
            }
        }

        // Self-closing vs children
        var child_exprs = std.ArrayListUnmanaged([]const u8){};
        var text_content: ?[]const u8 = null;
        var is_dynamic_text = false;
        var is_prop_text_ref = false;
        var dyn_fmt: []const u8 = "";
        var dyn_args: []const u8 = "";
        var text_dep_slots: [MAX_DYN_DEPS]u32 = undefined;
        var text_dep_count: u32 = 0;

        if (self.curKind() == .slash_gt) {
            self.advance_token();
        } else if (self.curKind() == .gt) {
            self.advance_token();

            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    const child = try self.parseJSXElement();
                    try child_exprs.append(self.alloc, child);
                } else if (self.curKind() == .lbrace) {
                    self.advance_token(); // {

                    // {children} splice
                    if (self.isIdent("children") and self.component_children_exprs != null) {
                        self.advance_token();
                        if (self.curKind() == .rbrace) self.advance_token();
                        for (self.component_children_exprs.?.items) |child_expr| {
                            try child_exprs.append(self.alloc, child_expr);
                        }
                        continue;
                    }

                    if (self.curKind() == .template_literal) {
                        const tl = try self.parseTemplateLiteral();
                        if (tl.is_dynamic) {
                            is_dynamic_text = true;
                            dyn_fmt = tl.fmt;
                            dyn_args = tl.args;
                            text_dep_slots = tl.dep_slots;
                            text_dep_count = tl.dep_count;
                        } else {
                            text_content = tl.static_text;
                        }
                        self.advance_token();
                    } else if (self.curKind() == .identifier) {
                        const ident = self.curText();
                        if (self.findPropBinding(ident)) |binding| {
                            self.advance_token();
                            if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                                if (binding.value.len >= 2 and binding.value[0] == '`') {
                                    const inner = binding.value[1 .. binding.value.len - 1];
                                    if (std.mem.indexOf(u8, inner, "${") != null) {
                                        const tmpl = try self.parseTemplateLiteralFromText(inner);
                                        if (tmpl.is_dynamic) {
                                            is_dynamic_text = true;
                                            dyn_fmt = tmpl.fmt;
                                            dyn_args = tmpl.args;
                                            for (0..tmpl.dep_count) |di| {
                                                if (text_dep_count < MAX_DYN_DEPS) {
                                                    text_dep_slots[text_dep_count] = tmpl.dep_slots[di];
                                                    text_dep_count += 1;
                                                }
                                            }
                                        } else {
                                            text_content = tmpl.static_text;
                                        }
                                    } else {
                                        text_content = inner;
                                    }
                                } else {
                                    text_content = binding.value;
                                }
                            } else {
                                const val = if (self.emit_prop_refs)
                                    (std.fmt.allocPrint(self.alloc, "_p_{s}", .{ident}) catch "")
                                else
                                    binding.value;
                                if (std.mem.startsWith(u8, val, "_p_")) {
                                    text_content = val;
                                    is_prop_text_ref = true;
                                } else if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                                    text_content = val[1 .. val.len - 1];
                                } else if (std.mem.startsWith(u8, val, "state.getSlot(")) {
                                    is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                                } else if (std.mem.startsWith(u8, val, "state.getSlotString(")) {
                                    is_dynamic_text = true; dyn_fmt = "{s}"; dyn_args = val;
                                } else if (std.mem.startsWith(u8, val, "state.getSlotFloat(")) {
                                    is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                                } else if (std.mem.startsWith(u8, val, "state.getSlotBool(")) {
                                    is_dynamic_text = true; dyn_fmt = "{s}";
                                    dyn_args = try std.fmt.allocPrint(self.alloc, "if ({s}) \"true\" else \"false\"", .{val});
                                } else if (std.mem.indexOf(u8, val, "state.getSlot") != null) {
                                    is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                                } else {
                                    text_content = val;
                                }
                            }
                        } else if (self.isState(ident)) |slot_id| {
                            self.advance_token();
                            is_dynamic_text = true;
                            const st = self.stateTypeById(slot_id);
                            const rid = self.regularSlotId(slot_id);
                            text_dep_slots[0] = rid;
                            text_dep_count = 1;
                            dyn_fmt = switch (st) { .string => "{s}", .float => "{d}", .boolean => "{s}", else => "{d}" };
                            dyn_args = switch (st) {
                                .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                                .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                                .boolean => try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}),
                                else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                            };
                        } else if (self.isLocalVar(ident)) |lv| {
                            self.advance_token();
                            is_dynamic_text = true;
                            dyn_fmt = switch (lv.state_type) { .string => "{s}", .float => "{d}", .boolean => "{s}", else => "{d}" };
                            dyn_args = lv.expr;
                        } else {
                            self.advance_token();
                        }
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else if (self.curKind() != .lt and self.curKind() != .lt_slash and self.curKind() != .eof) {
                    const raw = self.collectTextContent();
                    if (raw.len > 0) text_content = raw;
                } else {
                    self.advance_token();
                }
            }

            // Skip closing tag
            if (self.curKind() == .lt_slash) {
                self.advance_token();
                if (self.curKind() == .identifier) {
                    self.advance_token();
                    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
                }
                if (self.curKind() == .gt) self.advance_token();
            }
        }

        // Build node fields
        var fields: std.ArrayListUnmanaged(u8) = .{};

        // Style
        if (style_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".style = .{ ");
            try fields.appendSlice(self.alloc, style_str);
            try fields.appendSlice(self.alloc, " }");
        }

        // Text
        if (is_dynamic_text) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".text = \"\"");
            if (self.dyn_count < MAX_DYN_TEXTS) {
                self.dyn_texts[self.dyn_count] = .{
                    .buf_id = self.dyn_count,
                    .fmt_string = dyn_fmt,
                    .fmt_args = dyn_args,
                    .arr_name = "",
                    .arr_index = 0,
                    .has_ref = false,
                    .dep_slots = text_dep_slots,
                    .dep_count = text_dep_count,
                };
                self.last_dyn_id = self.dyn_count;
                self.dyn_count += 1;
            }
        } else if (text_content) |tc| {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            if (is_prop_text_ref) {
                try fields.appendSlice(self.alloc, ".text = ");
                try fields.appendSlice(self.alloc, tc);
            } else {
                try fields.appendSlice(self.alloc, ".text = \"");
                for (tc) |ch| {
                    if (ch == '"') { try fields.appendSlice(self.alloc, "\\\""); }
                    else if (ch == '\\') { try fields.appendSlice(self.alloc, "\\\\"); }
                    else if (ch == '\n') { try fields.appendSlice(self.alloc, "\\n"); }
                    else { try fields.append(self.alloc, ch); }
                }
                try fields.appendSlice(self.alloc, "\"");
            }
        }

        // Font size
        if (font_size.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".font_size = ");
            try fields.appendSlice(self.alloc, font_size);
        }
        if (no_wrap) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".no_wrap = true");
        }
        if (letter_spacing.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".letter_spacing = ");
            try fields.appendSlice(self.alloc, letter_spacing);
        }
        if (line_height_val.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".line_height = ");
            try fields.appendSlice(self.alloc, line_height_val);
        }
        if (number_of_lines.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".number_of_lines = ");
            try fields.appendSlice(self.alloc, number_of_lines);
        }

        // Color
        if (color_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".text_color = ");
            if (std.mem.startsWith(u8, color_str, "_p_")) {
                try fields.appendSlice(self.alloc, color_str);
            } else {
                try fields.appendSlice(self.alloc, try self.parseColorValue(color_str));
            }
        }
        // Classifier text_color
        if (classifier_idx != null and color_str.len == 0) {
            const tp = self.classifier_text_props[classifier_idx.?];
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                try fields.appendSlice(self.alloc, tp[tc_pos..]);
            }
        }

        // Image src
        if (src_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".image_src = \"");
            if (std.fs.path.dirname(self.input_file)) |dir| {
                try fields.appendSlice(self.alloc, try std.fs.path.resolve(self.alloc, &.{ dir, src_str }));
            } else {
                try fields.appendSlice(self.alloc, src_str);
            }
            try fields.appendSlice(self.alloc, "\"");
        }

        // Children array
        if (child_exprs.items.len > 0) {
            const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
            self.array_counter += 1;

            var arr_content: std.ArrayListUnmanaged(u8) = .{};
            try arr_content.appendSlice(self.alloc, "var ");
            try arr_content.appendSlice(self.alloc, arr_name);
            try arr_content.appendSlice(self.alloc, " = [_]Node{ ");
            for (child_exprs.items, 0..) |expr, idx| {
                if (idx > 0) try arr_content.appendSlice(self.alloc, ", ");
                try arr_content.appendSlice(self.alloc, expr);
            }
            try arr_content.appendSlice(self.alloc, " };");
            if (self.current_inline_component) |comp_name| {
                try arr_content.appendSlice(self.alloc, " // ");
                try arr_content.appendSlice(self.alloc, comp_name);
            }
            try self.array_decls.append(self.alloc, try arr_content.toOwnedSlice(self.alloc));

            // Bind component instances
            for (child_exprs.items, 0..) |expr, ci| {
                if (std.mem.eql(u8, expr, ".{}")) {
                    for (0..self.comp_instance_count) |cii| {
                        if (self.comp_instances[cii].parent_arr.len == 0) {
                            self.comp_instances[cii].parent_arr = arr_name;
                            self.comp_instances[cii].parent_idx = @intCast(ci);
                            break;
                        }
                    }
                }
            }

            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".children = &");
            try fields.appendSlice(self.alloc, arr_name);

            // Bind dynamic texts
            var claimed: [64]bool = [_]bool{false} ** 64;
            for (0..self.dyn_count) |di| {
                if (!self.dyn_texts[di].has_ref) {
                    for (child_exprs.items, 0..) |expr, ci| {
                        if (ci < 64 and !claimed[ci] and std.mem.indexOf(u8, expr, ".text = \"\"") != null) {
                            self.dyn_texts[di].arr_name = arr_name;
                            self.dyn_texts[di].arr_index = @intCast(ci);
                            self.dyn_texts[di].has_ref = true;
                            claimed[ci] = true;
                            break;
                        }
                    }
                }
            }
        }

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{fields.items});
    }

    // ── Color parsing ──

    fn parseColorValue(self: *Generator, hex: []const u8) ![]const u8 {
        if (hex.len == 0) return "Color.rgb(255, 255, 255)";
        if (namedColor(hex)) |rgb| {
            return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ rgb[0], rgb[1], rgb[2] });
        }
        const h = if (hex[0] == '#') hex[1..] else hex;
        if (h.len == 8) {
            const r = std.fmt.parseInt(u8, h[0..2], 16) catch 0;
            const g = std.fmt.parseInt(u8, h[2..4], 16) catch 0;
            const b = std.fmt.parseInt(u8, h[4..6], 16) catch 0;
            const a = std.fmt.parseInt(u8, h[6..8], 16) catch 255;
            return try std.fmt.allocPrint(self.alloc, "Color.rgba({d}, {d}, {d}, {d})", .{ r, g, b, a });
        }
        if (h.len == 6) {
            const r = std.fmt.parseInt(u8, h[0..2], 16) catch 0;
            const g = std.fmt.parseInt(u8, h[2..4], 16) catch 0;
            const b = std.fmt.parseInt(u8, h[4..6], 16) catch 0;
            return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ r, g, b });
        }
        if (h.len == 3) {
            const r = std.fmt.parseInt(u8, h[0..1], 16) catch 0;
            const g = std.fmt.parseInt(u8, h[1..2], 16) catch 0;
            const b = std.fmt.parseInt(u8, h[2..3], 16) catch 0;
            return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ r * 17, g * 17, b * 17 });
        }
        return "Color.rgb(255, 255, 255)";
    }

    // ── Zig source emission ──

    fn emitZigSource(self: *Generator, root_expr: []const u8) ![]const u8 {
        var out: std.ArrayListUnmanaged(u8) = .{};

        // Header
        try out.appendSlice(self.alloc, "//! Generated by tsz compiler (Zig) — do not edit\n//!\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "//! Source: {s}\n\n", .{std.fs.path.basename(self.input_file)}));

        // Imports
        try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
        try out.appendSlice(self.alloc, "const c = @import(\"framework/c.zig\").imports;\n");
        try out.appendSlice(self.alloc, "const layout = @import(\"framework/layout.zig\");\n");
        try out.appendSlice(self.alloc, "const text_mod = @import(\"framework/text.zig\");\n");
        try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\nconst LayoutRect = layout.LayoutRect;\n");
        try out.appendSlice(self.alloc, "const TextEngine = text_mod.TextEngine;\n");
        if (self.has_state) try out.appendSlice(self.alloc, "const state = @import(\"framework/state.zig\");\n");

        // FFI imports
        if (self.ffi_headers.items.len > 0) {
            try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
            for (self.ffi_headers.items) |h| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
            }
            try out.appendSlice(self.alloc, "});\n");
        }

        // Globals
        try out.appendSlice(self.alloc, "\nvar g_text_engine: ?*TextEngine = null;\n\n");

        // FFI host function wrappers (bridge C functions into QuickJS)
        if (self.ffi_funcs.items.len > 0) {
            try out.appendSlice(self.alloc, "const qjs = @cImport({ @cDefine(\"_GNU_SOURCE\", \"1\"); @cDefine(\"QUICKJS_NG_BUILD\", \"1\"); @cInclude(\"quickjs.h\"); });\n");
            try out.appendSlice(self.alloc, "const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n\n");
            for (self.ffi_funcs.items) |func_name| {
                // Generate: fn _ffi_NAME(ctx, this, argc, argv) -> JSValue
                // Calls ffi.NAME with argv[0..] converted from JS numbers, returns result as JS number
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _ffi_{s}(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {{\n" ++
                    "    var args: [8]c_long = undefined;\n" ++
                    "    var i: usize = 0;\n" ++
                    "    while (i < @as(usize, @intCast(@max(0, argc))) and i < 8) : (i += 1) {{\n" ++
                    "        var v: f64 = 0;\n" ++
                    "        _ = qjs.JS_ToFloat64(ctx, &v, argv[i]);\n" ++
                    "        args[i] = @intFromFloat(v);\n" ++
                    "    }}\n" ++
                    "    const result = ffi.{s}(args[0]);\n" ++
                    "    return qjs.JS_NewFloat64(ctx, @floatFromInt(result));\n" ++
                    "}}\n\n", .{ func_name, func_name }));
            }
        }

        // Measure callbacks
        try out.appendSlice(self.alloc, "fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {\n    if (g_text_engine) |te| { return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap); }\n    return .{};\n}\n\n");
        try out.appendSlice(self.alloc, "fn measureImageCallback(_: []const u8) layout.ImageDims {\n    return .{};\n}\n\n");

        // Node tree
        try out.appendSlice(self.alloc, "// ── Generated node tree ─────────────────────────────────────────\n");
        for (self.array_decls.items) |decl| {
            try out.appendSlice(self.alloc, decl);
            try out.appendSlice(self.alloc, "\n");
        }
        try out.appendSlice(self.alloc, "var root = Node{");
        try out.appendSlice(self.alloc, root_expr[2..]);
        try out.appendSlice(self.alloc, ";\n");

        // Dynamic text buffers
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Dynamic text buffers ─────────────────────────────────────────\n");
            for (0..self.dyn_count) |i| {
                const buf_size = estimateBufSize(self.dyn_texts[i].fmt_string);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _dyn_buf_{d}: [{d}]u8 = undefined;\nvar _dyn_text_{d}: []const u8 = \"\";\n", .{ i, buf_size, i }));
            }
        }

        // Component init functions
        if (self.comp_func_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Component init functions ────────────────────────────────────\n");
            for (0..self.comp_func_count) |fi| {
                try out.appendSlice(self.alloc, self.comp_funcs[fi].func_source);
                try out.appendSlice(self.alloc, "\n");
            }
        }

        // _initComponents
        if (self.comp_instance_count > 0) {
            try out.appendSlice(self.alloc, "fn _initComponents() void {\n");
            for (0..self.comp_instance_count) |ci| {
                const inst = self.comp_instances[ci];
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    {s}[{d}] = {s};\n", .{ inst.parent_arr, inst.parent_idx, inst.init_call }));
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // Hover + brighten + text selection (needed by generated main)
        try out.appendSlice(self.alloc, "var hovered_node: ?*Node = null;\n\n");
        try out.appendSlice(self.alloc, "fn brighten(color: Color) Color {\n    return .{ .r = @min(255, @as(u16, color.r) + 30), .g = @min(255, @as(u16, color.g) + 30), .b = @min(255, @as(u16, color.b) + 30), .a = color.a };\n}\n\n");
        try out.appendSlice(self.alloc, "var sel_node: ?*Node = null;\nvar sel_end_node: ?*Node = null;\nvar sel_start: usize = 0;\nvar sel_end: usize = 0;\nvar sel_anchor: usize = 0;\nvar sel_dragging: bool = false;\nvar sel_last_click: u32 = 0;\nvar sel_click_count: u32 = 0;\nvar sel_all: bool = false;\nvar sel_paint_state: u8 = 0;\n\n");
        try out.appendSlice(self.alloc, "fn collectAllText(node: *Node, buf: []u8, pos: usize) usize {\n    var p = pos;\n    if (node.text) |txt| {\n        if (p > 0 and p < buf.len) { buf[p] = '\\n'; p += 1; }\n        const n = @min(txt.len, buf.len - p);\n        if (n > 0) { @memcpy(buf[p..p+n], txt[0..n]); p += n; }\n    }\n    for (node.children) |*child| { p = collectAllText(child, buf, p); }\n    return p;\n}\n\n");
        try out.appendSlice(self.alloc,
            \\fn collectSelectedText(node: *Node, buf: []u8, pos: usize, st: *u8) usize {
            \\    var p = pos;
            \\    if (node.text) |txt| {
            \\        const is_start = (sel_node == node);
            \\        const is_end = (sel_end_node == node);
            \\        if (is_start and is_end) {
            \\            const s0 = @min(sel_start, sel_end);
            \\            const s1 = @max(sel_start, sel_end);
            \\            if (s1 > s0) {
            \\                if (p > 0 and p < buf.len) { buf[p] = '\n'; p += 1; }
            \\                const n = @min(s1 - s0, buf.len - p);
            \\                if (n > 0) { @memcpy(buf[p..p+n], txt[s0..s0+n]); p += n; }
            \\            }
            \\            st.* = 2;
            \\        } else if (st.* == 0 and (is_start or is_end)) {
            \\            const byte = if (is_start) sel_start else sel_end;
            \\            if (byte < txt.len) {
            \\                if (p > 0 and p < buf.len) { buf[p] = '\n'; p += 1; }
            \\                const n = @min(txt.len - byte, buf.len - p);
            \\                if (n > 0) { @memcpy(buf[p..p+n], txt[byte..byte+n]); p += n; }
            \\            }
            \\            st.* = 1;
            \\        } else if (st.* == 1) {
            \\            if (is_start or is_end) {
            \\                const byte = if (is_start) sel_start else sel_end;
            \\                if (byte > 0) {
            \\                    if (p > 0 and p < buf.len) { buf[p] = '\n'; p += 1; }
            \\                    const n = @min(byte, buf.len - p);
            \\                    if (n > 0) { @memcpy(buf[p..p+n], txt[0..n]); p += n; }
            \\                }
            \\                st.* = 2;
            \\            } else {
            \\                if (p > 0 and p < buf.len) { buf[p] = '\n'; p += 1; }
            \\                const n = @min(txt.len, buf.len - p);
            \\                if (n > 0) { @memcpy(buf[p..p+n], txt[0..n]); p += n; }
            \\            }
            \\        }
            \\    }
            \\    for (node.children) |*child| { p = collectSelectedText(child, buf, p, st); }
            \\    return p;
            \\}
            \\
            \\
        );

        // Script mode: JS_LOGIC + _initState + _updateDynamicTexts + main
        if (self.compute_js == null) return error.NoComputeJS;

        // JS_LOGIC
        try out.appendSlice(self.alloc, "\n// ── Embedded JS logic ────────────────────────────────────────\n");
        try out.appendSlice(self.alloc, "const JS_LOGIC =\n");
        const rewritten = try self.rewriteSetterCalls(self.compute_js.?);
        var line_iter = std.mem.splitScalar(u8, rewritten, '\n');
        while (line_iter.next()) |line| {
            try out.appendSlice(self.alloc, "    \\\\");
            try out.appendSlice(self.alloc, line);
            try out.appendSlice(self.alloc, "\n");
        }
        try out.appendSlice(self.alloc, ";\n\n");

        // _initState
        try out.appendSlice(self.alloc, "fn _initState() void {\n");
        if (self.has_state) {
            for (0..self.state_count) |i| {
                const slot = self.state_slots[i];
                switch (slot.initial) {
                    .int => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlot({d});\n", .{v})),
                    .float => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotFloat({d});\n", .{v})),
                    .boolean => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotBool({});\n", .{v})),
                    .string => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotString(\"{s}\");\n", .{v})),
                    .array => |v| {
                        try out.appendSlice(self.alloc, "    _ = state.createArraySlot(&[_]i64{ ");
                        for (0..v.count) |j| {
                            if (j > 0) try out.appendSlice(self.alloc, ", ");
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{v.values[j]}));
                        }
                        try out.appendSlice(self.alloc, " });\n");
                    },
                }
            }
        }
        try out.appendSlice(self.alloc, "}\n\n");

        // _updateDynamicTexts
        try out.appendSlice(self.alloc, "fn _updateDynamicTexts() void {\n");
        for (0..self.dyn_count) |di| {
            const dt = &self.dyn_texts[di];
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n" ++
                "    {s}[{d}].text = _dyn_text_{d};\n",
                .{ dt.buf_id, dt.buf_id, dt.fmt_string, dt.fmt_args, dt.arr_name, dt.arr_index, dt.buf_id }));
        }
        try out.appendSlice(self.alloc, "}\n\n");

        // Main: SDL2 window + wgpu GPU + QuickJS VM
        try out.appendSlice(self.alloc,
            \\const qjs_runtime = @import("framework/qjs_runtime.zig");
            \\const gpu = @import("framework/gpu.zig");
            \\const c_imports = @import("framework/c.zig").imports;
            \\
            \\fn gpuPaintNode(node: *Node) void {
            \\    if (node.style.display == .none) return;
            \\    const r = node.computed;
            \\    if (r.w <= 0 or r.h <= 0) return;
            \\    if (node.style.background_color) |bg| {
            \\        if (bg.a > 0) {
            \\            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            \\            gpu.drawRect(
            \\                r.x, r.y, r.w, r.h,
            \\                @as(f32, @floatFromInt(bg.r)) / 255.0,
            \\                @as(f32, @floatFromInt(bg.g)) / 255.0,
            \\                @as(f32, @floatFromInt(bg.b)) / 255.0,
            \\                @as(f32, @floatFromInt(bg.a)) / 255.0,
            \\                node.style.border_radius,
            \\                0,
            \\                @as(f32, @floatFromInt(bc.r)) / 255.0,
            \\                @as(f32, @floatFromInt(bc.g)) / 255.0,
            \\                @as(f32, @floatFromInt(bc.b)) / 255.0,
            \\                @as(f32, @floatFromInt(bc.a)) / 255.0,
            \\            );
            \\        }
            \\    }
            \\    if (node.text) |t| {
            \\        if (t.len > 0) {
            \\            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            \\            const pl = node.style.padLeft();
            \\            const pt = node.style.padTop();
            \\            const pr = node.style.padRight();
            \\            _ = gpu.drawTextWrapped(
            \\                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
            \\                @as(f32, @floatFromInt(tc.r)) / 255.0,
            \\                @as(f32, @floatFromInt(tc.g)) / 255.0,
            \\                @as(f32, @floatFromInt(tc.b)) / 255.0,
            \\                @as(f32, @floatFromInt(tc.a)) / 255.0,
            \\            );
            \\        }
            \\    }
            \\    for (node.children) |*child| gpuPaintNode(child);
            \\}
            \\
            \\pub fn main() !void {
            \\    if (c_imports.SDL_Init(c_imports.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
            \\    defer c_imports.SDL_Quit();
            \\
            \\    const window = c_imports.SDL_CreateWindow("tsz app",
            \\        c_imports.SDL_WINDOWPOS_CENTERED, c_imports.SDL_WINDOWPOS_CENTERED,
            \\        1280, 800, c_imports.SDL_WINDOW_SHOWN | c_imports.SDL_WINDOW_RESIZABLE,
            \\    ) orelse return error.WindowCreateFailed;
            \\    defer c_imports.SDL_DestroyWindow(window);
            \\
            \\    // GPU init — wgpu gets native handle from SDL window
            \\    gpu.init(window) catch |err| {
            \\        std.debug.print("wgpu init failed: {}\n", .{err});
            \\        return error.GPUInitFailed;
            \\    };
            \\    defer gpu.deinit();
            \\
            \\    // TextEngine for layout measurement (FreeType)
            \\    const text_engine_mod = @import("framework/text.zig");
            \\    var te = text_engine_mod.TextEngine.initHeadless("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
            \\        text_engine_mod.TextEngine.initHeadless("/System/Library/Fonts/Supplemental/Arial.ttf") catch
            \\        text_engine_mod.TextEngine.initHeadless("C:/Windows/Fonts/segoeui.ttf") catch
            \\        return error.FontNotFound;
            \\    defer te.deinit();
            \\
            \\    // Pass FreeType handles to GPU text renderer (glyph atlas)
            \\    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);
            \\
            \\    g_text_engine = &te;
            \\    layout.setMeasureFn(measureCallback);
            \\    layout.setMeasureImageFn(measureImageCallback);
            \\    var win_w: f32 = 1280;
            \\    var win_h: f32 = 800;
            \\
            \\    _initState();
            \\    qjs_runtime.initVM();
            \\    defer qjs_runtime.deinit();
            \\
        );
        // Register FFI host functions (between initVM and evalScript)
        for (self.ffi_funcs.items) |func_name| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    qjs_runtime.registerHostFn(\"{s}\", @ptrCast(&_ffi_{s}), 8);\n", .{ func_name, func_name }));
        }
        try out.appendSlice(self.alloc,
            \\    qjs_runtime.evalScript(JS_LOGIC);
            \\    _updateDynamicTexts();
            \\
            \\    var running = true;
            \\    var fps_frames: u32 = 0;
            \\    var fps_last: u32 = c_imports.SDL_GetTicks();
            \\
        );
        // useFFI timer variables
        for (0..self.ffi_hook_count) |hi| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    var _ffi_timer_{d}: u32 = 0;\n", .{hi}));
        }
        try out.appendSlice(self.alloc,
            \\
            \\    while (running) {
            \\        var event: c_imports.SDL_Event = undefined;
            \\        while (c_imports.SDL_PollEvent(&event) != 0) {
            \\            switch (event.type) {
            \\                c_imports.SDL_QUIT => running = false,
            \\                c_imports.SDL_WINDOWEVENT => {
            \\                    if (event.window.event == c_imports.SDL_WINDOWEVENT_SIZE_CHANGED) {
            \\                        win_w = @floatFromInt(event.window.data1);
            \\                        win_h = @floatFromInt(event.window.data2);
            \\                        gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
            \\                    }
            \\                },
            \\                c_imports.SDL_KEYDOWN => {
            \\                    if (event.key.keysym.sym == c_imports.SDLK_ESCAPE) running = false;
            \\                },
            \\                else => {},
            \\            }
            \\        }
            \\
            \\        const t0 = @import("std").time.microTimestamp();
            \\        qjs_runtime.tick();
            \\        const t1 = @import("std").time.microTimestamp();
            \\        qjs_runtime.telemetry_tick_us = @intCast(@max(0, t1 - t0));
            \\
        );
        // useFFI polling — call C functions on interval, write to state slots
        if (self.ffi_hook_count > 0) {
            try out.appendSlice(self.alloc, "        {\n            const _now = c_imports.SDL_GetTicks();\n");
            for (0..self.ffi_hook_count) |hi| {
                const hook = self.ffi_hooks[hi];
                const rid = self.regularSlotId(hook.slot_id);
                const set_fn = switch (hook.return_type) {
                    .string => "state.setSlotString",
                    .boolean => "state.setSlotBool",
                    .float => "state.setSlotFloat",
                    else => "state.setSlot",
                };
                const cast = switch (hook.return_type) {
                    .string => "",
                    .boolean => " != 0",
                    .float => "",
                    else => "",
                };
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "            if (_now - _ffi_timer_{d} >= {d}) {{ {s}({d}, ffi.{s}(0){s}); _ffi_timer_{d} = _now; }}\n",
                    .{ hi, hook.interval_ms, set_fn, rid, hook.ffi_func, cast, hi }));
            }
            try out.appendSlice(self.alloc, "        }\n");
        }
        try out.appendSlice(self.alloc,
            \\
            \\
            \\        if (state.isDirty()) {
            \\            _updateDynamicTexts();
            \\            state.clearDirty();
            \\        }
            \\
            \\        const t2 = @import("std").time.microTimestamp();
            \\        layout.layout(&root, 0, 0, win_w, win_h);
            \\        const t3 = @import("std").time.microTimestamp();
            \\        qjs_runtime.telemetry_layout_us = @intCast(@max(0, t3 - t2));
            \\
            \\        const t4 = @import("std").time.microTimestamp();
            \\        gpuPaintNode(&root);
            \\        const t5 = @import("std").time.microTimestamp();
            \\        qjs_runtime.telemetry_paint_us = @intCast(@max(0, t5 - t4));
            \\
            \\        gpu.frame(0.051, 0.067, 0.090);
            \\
            \\        fps_frames += 1;
            \\        const now = c_imports.SDL_GetTicks();
            \\        if (now - fps_last >= 1000) {
            \\            qjs_runtime.telemetry_fps = fps_frames;
            \\            std.debug.print("[telemetry] FPS: {d} | tick: {d}us | layout: {d}us | paint: {d}us\n", .{
            \\                fps_frames, qjs_runtime.telemetry_tick_us, qjs_runtime.telemetry_layout_us, qjs_runtime.telemetry_paint_us,
            \\            });
            \\            fps_frames = 0;
            \\            fps_last = now;
            \\        }
            \\    }
            \\}
            \\
        );

        return try out.toOwnedSlice(self.alloc);
    }
};

// ── Style key mappings ──────────────────────────────────────────────────

fn mapStyleKey(key: []const u8) ?[]const u8 {
    const mappings = .{
        .{ "width", "width" }, .{ "height", "height" },
        .{ "minWidth", "min_width" }, .{ "maxWidth", "max_width" },
        .{ "minHeight", "min_height" }, .{ "maxHeight", "max_height" },
        .{ "flexGrow", "flex_grow" }, .{ "flexShrink", "flex_shrink" }, .{ "flexBasis", "flex_basis" },
        .{ "gap", "gap" },
        .{ "padding", "padding" }, .{ "paddingLeft", "padding_left" }, .{ "paddingRight", "padding_right" },
        .{ "paddingTop", "padding_top" }, .{ "paddingBottom", "padding_bottom" },
        .{ "margin", "margin" }, .{ "marginLeft", "margin_left" }, .{ "marginRight", "margin_right" },
        .{ "marginTop", "margin_top" }, .{ "marginBottom", "margin_bottom" },
        .{ "borderRadius", "border_radius" }, .{ "opacity", "opacity" }, .{ "borderWidth", "border_width" },
        .{ "shadowOffsetX", "shadow_offset_x" }, .{ "shadowOffsetY", "shadow_offset_y" }, .{ "shadowBlur", "shadow_blur" },
        .{ "top", "top" }, .{ "left", "left" }, .{ "right", "right" }, .{ "bottom", "bottom" },
        .{ "aspectRatio", "aspect_ratio" }, .{ "rotation", "rotation" }, .{ "scaleX", "scale_x" }, .{ "scaleY", "scale_y" },
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, key, m[0])) return m[1];
    }
    return null;
}

fn mapStyleKeyI16(key: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, key, "zIndex")) return "z_index";
    return null;
}

fn mapColorKey(key: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, key, "backgroundColor")) return "background_color";
    if (std.mem.eql(u8, key, "borderColor")) return "border_color";
    if (std.mem.eql(u8, key, "shadowColor")) return "shadow_color";
    if (std.mem.eql(u8, key, "gradientColorEnd")) return "gradient_color_end";
    return null;
}

const EnumMapping = struct { field: []const u8, prefix: []const u8 };

fn mapEnumKey(key: []const u8) ?EnumMapping {
    if (std.mem.eql(u8, key, "flexDirection")) return .{ .field = "flex_direction", .prefix = "fd" };
    if (std.mem.eql(u8, key, "justifyContent")) return .{ .field = "justify_content", .prefix = "jc" };
    if (std.mem.eql(u8, key, "alignItems")) return .{ .field = "align_items", .prefix = "ai" };
    if (std.mem.eql(u8, key, "alignSelf")) return .{ .field = "align_self", .prefix = "as" };
    if (std.mem.eql(u8, key, "flexWrap")) return .{ .field = "flex_wrap", .prefix = "fw" };
    if (std.mem.eql(u8, key, "position")) return .{ .field = "position", .prefix = "pos" };
    if (std.mem.eql(u8, key, "display")) return .{ .field = "display", .prefix = "d" };
    if (std.mem.eql(u8, key, "textAlign")) return .{ .field = "text_align", .prefix = "ta" };
    if (std.mem.eql(u8, key, "overflow")) return .{ .field = "overflow", .prefix = "ov" };
    if (std.mem.eql(u8, key, "gradientDirection")) return .{ .field = "gradient_direction", .prefix = "gd" };
    return null;
}

fn mapEnumValue(prefix: []const u8, value: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, prefix, "fd")) { if (std.mem.eql(u8, value, "row")) return ".row"; if (std.mem.eql(u8, value, "column")) return ".column"; }
    if (std.mem.eql(u8, prefix, "jc")) { if (std.mem.eql(u8, value, "start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end")) return ".end"; if (std.mem.eql(u8, value, "space-between")) return ".space_between"; if (std.mem.eql(u8, value, "space-around")) return ".space_around"; if (std.mem.eql(u8, value, "space-evenly")) return ".space_evenly"; }
    if (std.mem.eql(u8, prefix, "ai")) { if (std.mem.eql(u8, value, "start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end")) return ".end"; if (std.mem.eql(u8, value, "stretch")) return ".stretch"; }
    if (std.mem.eql(u8, prefix, "d")) { if (std.mem.eql(u8, value, "flex")) return ".flex"; if (std.mem.eql(u8, value, "none")) return ".none"; }
    if (std.mem.eql(u8, prefix, "ta")) { if (std.mem.eql(u8, value, "left")) return ".left"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "right")) return ".right"; }
    if (std.mem.eql(u8, prefix, "as")) { if (std.mem.eql(u8, value, "auto")) return ".auto"; if (std.mem.eql(u8, value, "start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end")) return ".end"; if (std.mem.eql(u8, value, "stretch")) return ".stretch"; }
    if (std.mem.eql(u8, prefix, "fw")) { if (std.mem.eql(u8, value, "nowrap")) return ".nowrap"; if (std.mem.eql(u8, value, "wrap")) return ".wrap"; }
    if (std.mem.eql(u8, prefix, "pos")) { if (std.mem.eql(u8, value, "relative")) return ".relative"; if (std.mem.eql(u8, value, "absolute")) return ".absolute"; }
    if (std.mem.eql(u8, prefix, "ov")) { if (std.mem.eql(u8, value, "visible")) return ".visible"; if (std.mem.eql(u8, value, "hidden")) return ".hidden"; if (std.mem.eql(u8, value, "scroll")) return ".scroll"; }
    if (std.mem.eql(u8, prefix, "gd")) { if (std.mem.eql(u8, value, "vertical")) return ".vertical"; if (std.mem.eql(u8, value, "horizontal")) return ".horizontal"; if (std.mem.eql(u8, value, "none")) return ".none"; }
    return null;
}

fn kebabToCamel(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var capitalize_next = false;
    for (input) |ch| {
        if (ch == '-') { capitalize_next = true; }
        else if (capitalize_next) { try result.append(alloc, if (ch >= 'a' and ch <= 'z') ch - 32 else ch); capitalize_next = false; }
        else { try result.append(alloc, ch); }
    }
    return try alloc.dupe(u8, result.items);
}

fn parseCSSValue(value: []const u8) ?f32 {
    if (value.len == 0) return null;
    if (std.mem.eql(u8, value, "auto")) return null;
    if (std.mem.endsWith(u8, value, "px")) return std.fmt.parseFloat(f32, value[0 .. value.len - 2]) catch null;
    if (std.mem.endsWith(u8, value, "rem")) { const num = std.fmt.parseFloat(f32, value[0 .. value.len - 3]) catch return null; return num * 16.0; }
    if (std.mem.endsWith(u8, value, "%")) return std.fmt.parseFloat(f32, value[0 .. value.len - 1]) catch null;
    return std.fmt.parseFloat(f32, value) catch null;
}

fn namedColor(name: []const u8) ?[3]u8 {
    if (std.mem.eql(u8, name, "black")) return .{ 0, 0, 0 };
    if (std.mem.eql(u8, name, "white")) return .{ 255, 255, 255 };
    if (std.mem.eql(u8, name, "red")) return .{ 255, 0, 0 };
    if (std.mem.eql(u8, name, "green")) return .{ 0, 128, 0 };
    if (std.mem.eql(u8, name, "blue")) return .{ 0, 0, 255 };
    if (std.mem.eql(u8, name, "yellow")) return .{ 255, 255, 0 };
    if (std.mem.eql(u8, name, "cyan")) return .{ 0, 255, 255 };
    if (std.mem.eql(u8, name, "magenta")) return .{ 255, 0, 255 };
    if (std.mem.eql(u8, name, "gray")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "grey")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "silver")) return .{ 192, 192, 192 };
    if (std.mem.eql(u8, name, "orange")) return .{ 255, 165, 0 };
    if (std.mem.eql(u8, name, "transparent")) return .{ 0, 0, 0 };
    return null;
}

fn countNodeElements(decl: []const u8) u32 {
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return 1;
    const content = decl[start + marker.len ..];
    var count: u32 = 0;
    var depth: i32 = 0;
    var i: usize = 0;
    while (i < content.len) {
        if (content[i] == '{') { if (depth == 0) count += 1; depth += 1; }
        else if (content[i] == '}') { depth -= 1; if (depth < 0) break; }
        i += 1;
    }
    return if (count > 0) count else 1;
}

fn extractArrayInit(decl: []const u8) []const u8 {
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return "";
    const content_start = start + marker.len;
    var depth: i32 = 0;
    var i: usize = content_start;
    while (i < decl.len) {
        if (decl[i] == '{') { depth += 1; }
        else if (decl[i] == '}') { if (depth == 0) return decl[content_start..i]; depth -= 1; }
        i += 1;
    }
    return decl[content_start..];
}
