//! Codegen for .tsz — parses token stream and emits Zig source code
//!
//! Single-pass: parses and emits simultaneously. No explicit AST.
//! Handles: JSX elements, style objects, useState, event handlers,
//! FFI pragmas, template literals, component composition, and windows.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const Lexer = lexer_mod.Lexer;
const tailwind = @import("tailwind.zig");
const bootstrap = @import("bootstrap.zig");

const MAX_LOCALS = 32;
const MAX_COMPONENTS = 32;
const MAX_COMPONENT_PROPS = 16;
const MAX_ARRAYS = 256;
const MAX_HANDLERS = 64;
const MAX_STATE_SLOTS = 32;
const MAX_DYN_TEXTS = 32;
const MAX_FFI_HEADERS = 16;
const MAX_FFI_LIBS = 16;
const MAX_FFI_FUNCS = 64;
const MAX_WINDOWS = 8;
const MAX_CONDS = 32;
const MAX_EFFECTS = 32;
const MAX_ANIM_HOOKS = 16;
const MAX_ANIM_BINDINGS = 32;
const MAX_DYN_STYLES = 64;
const MAX_ROUTES = 16;
const MAX_MAPS = 16;
const MAX_ARRAY_INIT = 32;

const RouteInfo = struct {
    path: []const u8,
    arr_name: []const u8,
    child_idx: u32,
};

const AnimHookKind = enum { transition, spring };

const AnimHookInfo = struct {
    kind: AnimHookKind,
    name: []const u8, // variable name (e.g., "opacity")
    target_expr: []const u8, // translated Zig expression for target
    duration_ms: u32 = 300, // transitions only
    easing_name: []const u8 = "easeInOut", // transitions only
    stiffness: f32 = 100, // springs only
    damping: f32 = 10, // springs only
};

const AnimStyleBinding = struct {
    anim_idx: u32, // index into anim_hooks
    arr_name: []const u8, // filled in when array is created
    arr_index: u32, // index within the array
    style_field: []const u8, // e.g., "opacity", "rotation"
};

const PendingAnimBinding = struct {
    anim_idx: u32,
    style_field: []const u8,
};

const EffectKind = enum {
    mount, // useEffect(fn, [])       — run once at init
    watch, // useEffect(fn, [deps])   — run when deps change
    every_frame, // useEffect(fn)           — run every frame
    interval, // useEffect(fn, 1000)     — run at ms interval
};

const EffectInfo = struct {
    kind: EffectKind,
    body_start: u32, // token position at start of arrow fn params
    dep_slots: [8]u32, // state slot IDs for watched deps
    dep_count: u32,
    interval_ms: u32, // for interval kind
};

const CondKind = enum {
    ternary,
    show_hide,
};

const CondInfo = struct {
    kind: CondKind,
    condition: []const u8,
    arr_name: []const u8,
    true_idx: u32,
    false_idx: u32,
};

const DynText = struct {
    buf_id: u32,
    fmt_string: []const u8,
    fmt_args: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
};

const PendingDynStyle = struct {
    field: []const u8, // Zig style field: "width", "background_color"
    expression: []const u8, // Zig expression: "@as(f32, ...)"
};

const DynStyle = struct {
    field: []const u8,
    expression: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
};

const LocalVar = struct {
    name: []const u8,
    expr: []const u8, // Zig expression (compile-time substitution)
    state_type: StateType, // type hint for template literal formatting
};

const ComponentInfo = struct {
    name: []const u8,
    prop_names: [MAX_COMPONENT_PROPS][]const u8,
    prop_count: u32,
    body_pos: u32, // token position of the return's JSX (at the '<')
    has_children: bool,
};

/// Active prop substitution (pushed when entering a component, popped on exit)
const PropBinding = struct {
    name: []const u8,
    value: []const u8, // raw .tsz value (string literal, number, state ref)
    handler_start: ?u32 = null, // if this prop is a forwarded handler, token range
    handler_end: ?u32 = null,
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

const MapInnerNode = struct {
    font_size: []const u8,
    text_color: []const u8,
    text_fmt: []const u8,
    text_args: []const u8,
    is_dynamic_text: bool,
    static_text: []const u8,
    style: []const u8,
};

const MapInfo = struct {
    array_slot_id: u32,
    item_param: []const u8,
    index_param: ?[]const u8,
    parent_arr_name: []const u8,
    child_idx: u32,
    outer_style: []const u8,
    outer_font_size: []const u8,
    outer_text_color: []const u8,
    inner_nodes: [8]MapInnerNode,
    inner_count: u32,
    is_self_closing: bool,
    is_text_element: bool,
};

const MapTemplateResult = struct {
    outer_style: []const u8,
    outer_font_size: []const u8,
    outer_text_color: []const u8,
    inner_nodes: [8]MapInnerNode,
    inner_count: u32,
    is_self_closing: bool,
    is_text_element: bool,
};

const WindowInfo = struct {
    title: []const u8,
    width: u32,
    height: u32,
    arrays_start: u32, // index into array_decls
    arrays_end: u32,
    root_expr: []const u8,
};

pub const OutputMode = enum { full_app, runtime_fragment };

pub const Generator = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    input_file: []const u8,
    pos: u32, // token index
    mode: OutputMode = .full_app,

    // Collected outputs
    array_decls: std.ArrayListUnmanaged([]const u8),
    handler_decls: std.ArrayListUnmanaged([]const u8),
    array_counter: u32,
    handler_counter: u32,

    // State
    state_slots: [MAX_STATE_SLOTS]StateSlot,
    state_count: u32,
    has_state: bool,

    // Dynamic text
    dyn_texts: [MAX_DYN_TEXTS]DynText,
    dyn_count: u32,
    last_dyn_id: ?u32,

    // Dynamic styles (state-dependent style values)
    dyn_styles: [MAX_DYN_STYLES]DynStyle,
    dyn_style_count: u32,
    pending_dyn_styles: [16]PendingDynStyle,
    pending_dyn_style_count: u32,
    emit_colors_as_rgb: bool,

    // FFI
    ffi_headers: std.ArrayListUnmanaged([]const u8),
    ffi_libs: std.ArrayListUnmanaged([]const u8),
    ffi_funcs: std.ArrayListUnmanaged([]const u8),

    // Windows
    windows: [MAX_WINDOWS]WindowInfo,
    window_count: u32,

    // TextInputs
    input_count: u32,
    input_multiline: [16]bool,
    input_change_handlers: [16]?[]const u8,

    // Conditionals
    conds: [MAX_CONDS]CondInfo,
    cond_count: u32,

    // Effects
    effects: [MAX_EFFECTS]EffectInfo,
    effect_count: u32,

    // Animation hooks (useTransition / useSpring)
    anim_hooks: [MAX_ANIM_HOOKS]AnimHookInfo,
    anim_hook_count: u32,
    anim_bindings: [MAX_ANIM_BINDINGS]AnimStyleBinding,
    anim_binding_count: u32,
    pending_anim: [8]PendingAnimBinding,
    pending_anim_count: u32,
    emit_float_as_f32: bool, // when true, decimal literals become @as(f32, N)

    // Routes
    routes: [MAX_ROUTES]RouteInfo,
    route_count: u32,
    has_routes: bool,
    has_crypto: bool,
    has_pty: bool,
    has_inspector: bool,
    last_route_path: ?[]const u8, // temp: Route → Routes communication
    routes_bind_from: ?u32, // set when entering Routes, consumed on array creation

    // Maps (.map() dynamic lists)
    maps: [MAX_MAPS]MapInfo,
    map_count: u32,
    map_item_param: ?[]const u8,
    map_index_param: ?[]const u8,

    // Classifiers: name → { primitive_type, style_fields_string }
    classifier_names: [128][]const u8,
    classifier_primitives: [128][]const u8,
    classifier_styles: [128][]const u8,
    classifier_text_props: [128][]const u8, // fontSize, color for Text classifiers
    classifier_count: u32,

    // Local variables (compile-time constant substitution)
    local_vars: [MAX_LOCALS]LocalVar,
    local_count: u32,

    // Components (compile-time inlining)
    components: [MAX_COMPONENTS]ComponentInfo,
    component_count: u32,

    // Prop substitution stack (active during component inlining)
    prop_stack: [MAX_COMPONENT_PROPS]PropBinding,
    prop_stack_count: u32,
    // Children JSX to splice for {children} placeholders
    component_children_exprs: ?*std.ArrayListUnmanaged([]const u8),

    pub fn init(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, input_file: []const u8) Generator {
        return .{
            .alloc = alloc,
            .lex = lex,
            .source = source,
            .input_file = input_file,
            .pos = 0,
            .array_decls = .{},
            .handler_decls = .{},
            .array_counter = 0,
            .handler_counter = 0,
            .state_slots = undefined,
            .state_count = 0,
            .has_state = false,
            .dyn_texts = undefined,
            .dyn_count = 0,
            .last_dyn_id = null,
            .dyn_styles = undefined,
            .dyn_style_count = 0,
            .pending_dyn_styles = undefined,
            .pending_dyn_style_count = 0,
            .emit_colors_as_rgb = false,
            .ffi_headers = .{},
            .ffi_libs = .{},
            .ffi_funcs = .{},
            .windows = undefined,
            .window_count = 0,
            .input_count = 0,
            .input_multiline = [_]bool{false} ** 16,
            .input_change_handlers = [_]?[]const u8{null} ** 16,
            .conds = undefined,
            .cond_count = 0,
            .effects = undefined,
            .effect_count = 0,
            .anim_hooks = undefined,
            .anim_hook_count = 0,
            .anim_bindings = undefined,
            .anim_binding_count = 0,
            .pending_anim = undefined,
            .pending_anim_count = 0,
            .emit_float_as_f32 = false,
            .routes = undefined,
            .route_count = 0,
            .has_routes = false,
            .has_crypto = false,
            .has_pty = false,
            .has_inspector = false,
            .last_route_path = null,
            .routes_bind_from = null,
            .maps = undefined,
            .map_count = 0,
            .map_item_param = null,
            .map_index_param = null,
            .classifier_names = undefined,
            .classifier_primitives = undefined,
            .classifier_styles = undefined,
            .classifier_text_props = undefined,
            .classifier_count = 0,
            .local_vars = undefined,
            .local_count = 0,
            .components = undefined,
            .component_count = 0,
            .prop_stack = undefined,
            .prop_stack_count = 0,
            .component_children_exprs = null,
        };
    }

    // ── Token helpers ────────────────────────────────────────────────

    fn cur(self: *Generator) Token {
        return self.lex.get(self.pos);
    }

    fn curText(self: *Generator) []const u8 {
        return self.cur().text(self.source);
    }

    fn curKind(self: *Generator) TokenKind {
        return self.cur().kind;
    }

    fn advance_token(self: *Generator) void {
        if (self.pos < self.lex.count) self.pos += 1;
    }

    fn expect(self: *Generator, kind: TokenKind) !void {
        if (self.curKind() != kind) {
            std.debug.print("[tsz] Expected {}, got {} at pos {d}\n", .{ kind, self.curKind(), self.pos });
            return error.UnexpectedToken;
        }
        self.advance_token();
    }

    fn expectIdent(self: *Generator, name: []const u8) !void {
        if (self.curKind() != .identifier or !std.mem.eql(u8, self.curText(), name)) {
            std.debug.print("[tsz] Expected '{s}', got '{s}' at pos {d}\n", .{ name, self.curText(), self.pos });
            return error.UnexpectedToken;
        }
        self.advance_token();
    }

    fn isIdent(self: *Generator, name: []const u8) bool {
        return self.curKind() == .identifier and std.mem.eql(u8, self.curText(), name);
    }

    fn isState(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].getter, name)) return @intCast(i);
        }
        return null;
    }

    /// Lookahead: check if the current style value references state (making it dynamic).
    /// Scans tokens until comma or closing brace without advancing the position.
    fn isStateDependentStyleValue(self: *Generator) bool {
        var look = self.pos;
        var depth: u32 = 0;
        while (look < self.lex.count) : (look += 1) {
            const kind = self.lex.get(look).kind;
            if (kind == .lbrace or kind == .lparen) {
                depth += 1;
            } else if (kind == .rbrace or kind == .rparen) {
                if (depth == 0) break;
                depth -= 1;
            } else if (kind == .comma and depth == 0) {
                break;
            } else if (kind == .identifier) {
                const name = self.lex.get(look).text(self.source);
                if (self.isState(name) != null) return true;
                // Inspector getters make style values dynamic
                const inspector_names = [_][]const u8{ "hasHover", "getHoverX", "getHoverY", "getHoverW", "getHoverH", "hasSelect", "getSelectX", "getSelectY", "getSelectW", "getSelectH", "isInspectorEnabled" };
                for (inspector_names) |builtin| {
                    if (std.mem.eql(u8, name, builtin)) return true;
                }
            }
        }
        return false;
    }

    fn isSetter(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].setter, name)) return @intCast(i);
        }
        return null;
    }

    fn stateType(self: *Generator, name: []const u8) ?StateType {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].getter, name)) return std.meta.activeTag(self.state_slots[i].initial);
        }
        return null;
    }

    fn stateTypeById(self: *Generator, slot_id: u32) StateType {
        return std.meta.activeTag(self.state_slots[slot_id].initial);
    }

    /// Returns hex output size for crypto built-in functions, or null if not a crypto function.
    fn cryptoHexSize(_: *Generator, name: []const u8) ?u32 {
        if (std.mem.eql(u8, name, "sha256")) return 64;
        if (std.mem.eql(u8, name, "sha512")) return 128;
        if (std.mem.eql(u8, name, "blake2b")) return 64; // blake2b256
        if (std.mem.eql(u8, name, "blake2s")) return 64; // blake2s256
        if (std.mem.eql(u8, name, "blake3")) return 64;
        if (std.mem.eql(u8, name, "hmacSha256")) return 64;
        if (std.mem.eql(u8, name, "hmacSha512")) return 128;
        return null;
    }

    /// Maps .tsz crypto function name to the Zig runtime function name.
    fn cryptoZigFn(_: *Generator, name: []const u8) []const u8 {
        if (std.mem.eql(u8, name, "blake2b")) return "blake2b256";
        if (std.mem.eql(u8, name, "blake2s")) return "blake2s256";
        return name; // sha256, sha512, blake3, hmacSha256, hmacSha512 match directly
    }

    /// Returns 1 for hash functions, 2 for HMAC (key + message).
    fn cryptoArgCount(_: *Generator, name: []const u8) u8 {
        if (std.mem.eql(u8, name, "hmacSha256")) return 2;
        if (std.mem.eql(u8, name, "hmacSha512")) return 2;
        return 1;
    }

    fn isArrayState(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].getter, name) and
                std.meta.activeTag(self.state_slots[i].initial) == .array)
                return @intCast(i);
        }
        return null;
    }

    fn arraySlotId(self: *Generator, state_idx: u32) u32 {
        var count: u32 = 0;
        for (0..state_idx) |j| {
            if (std.meta.activeTag(self.state_slots[j].initial) == .array) count += 1;
        }
        return count;
    }

    /// Convert sequential state index to regular (non-array) slot index.
    /// Array slots use separate storage, so regular slots are numbered independently.
    fn regularSlotId(self: *Generator, state_idx: u32) u32 {
        var count: u32 = 0;
        for (0..state_idx) |j| {
            if (std.meta.activeTag(self.state_slots[j].initial) != .array) count += 1;
        }
        return count;
    }

    fn isFFIFunc(self: *Generator, name: []const u8) bool {
        for (self.ffi_funcs.items) |f| {
            if (std.mem.eql(u8, f, name)) return true;
        }
        return false;
    }

    fn isAnimVar(self: *Generator, name: []const u8) ?u32 {
        for (0..self.anim_hook_count) |i| {
            if (std.mem.eql(u8, self.anim_hooks[i].name, name)) return @intCast(i);
        }
        return null;
    }

    /// Look up a classifier by name. Returns index or null.
    fn findClassifier(self: *Generator, name: []const u8) ?u32 {
        for (0..self.classifier_count) |i| {
            if (std.mem.eql(u8, self.classifier_names[i], name)) return @intCast(i);
        }
        return null;
    }

    /// Check if a tag name is a C.Name classifier reference.
    /// Returns the classifier name (after "C.") or null.
    fn isClassifierTag(tag: []const u8) ?[]const u8 {
        if (tag.len > 2 and tag[0] == 'C' and tag[1] == '.') return tag[2..];
        return null;
    }

    // ── Top-level parsing ────────────────────────────────────────────

    pub fn generate(self: *Generator) ![]const u8 {
        // Phase 1: Collect FFI pragmas
        self.collectFFIPragmas();

        // Phase 1b: Pre-scan for PTY built-in usage
        self.pos = 0;
        self.scanForPtyUsage();

        // Phase 1c: Pre-scan for inspector built-in usage
        self.pos = 0;
        self.scanForInspectorUsage();

        // Phase 2: Collect declare functions
        self.pos = 0;
        self.collectDeclaredFunctions();

        // Phase 3: Collect classifiers
        self.pos = 0;
        self.collectClassifiers();

        // Phase 3.5: Collect component definitions (non-App functions)
        self.pos = 0;
        self.collectComponents();

        // Phase 4: Find App function and collect useState
        self.pos = 0;
        const app_start = self.findAppFunction() orelse return error.NoAppFunction;
        self.collectStateHooks(app_start);

        // Phase 5: Collect useEffect calls
        self.pos = app_start;
        self.collectEffects(app_start);

        // Phase 5b: Collect useTransition / useSpring hooks
        self.collectAnimHooks(app_start);

        // Phase 5c: Collect local variables (const x = expr)
        self.collectLocalVars(app_start);

        // Phase 6: Find return JSX and generate node tree
        self.pos = app_start;
        self.findReturnStatement();
        const root_expr = try self.parseJSXElement();

        // Resolve root node's pending dynamic styles (root has no parent to resolve them)
        for (0..self.pending_dyn_style_count) |pi| {
            if (self.dyn_style_count < MAX_DYN_STYLES) {
                self.dyn_styles[self.dyn_style_count] = .{
                    .field = self.pending_dyn_styles[pi].field,
                    .expression = self.pending_dyn_styles[pi].expression,
                    .arr_name = "root",
                    .arr_index = 0,
                    .has_ref = true,
                };
                self.dyn_style_count += 1;
            }
        }
        self.pending_dyn_style_count = 0;

        // Phase 5: Emit Zig source
        return switch (self.mode) {
            .full_app => self.emitZigSource(root_expr),
            .runtime_fragment => self.emitRuntimeFragment(root_expr),
        };
    }

    /// Parse classifier({...}) blocks.
    /// Format: classifier({ Name: { type: 'Primitive', style: { ... } }, ... })
    fn collectClassifiers(self: *Generator) void {
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("classifier")) {
                self.advance_token(); // skip "classifier"
                if (self.curKind() == .lparen) self.advance_token(); // (
                if (self.curKind() == .lbrace) self.advance_token(); // {

                // Parse entries: Name: { type: 'X', style: { ... } }
                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                    if (self.curKind() == .identifier) {
                        const name = self.curText();
                        self.advance_token(); // skip name
                        if (self.curKind() == .colon) self.advance_token(); // :
                        if (self.curKind() == .lbrace) {
                            self.advance_token(); // {

                            var prim_type: []const u8 = "Box";
                            var style_str: []const u8 = "";
                            var text_props: []const u8 = "";

                            // Parse fields: type, style, size, bold, color, grow
                            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                if (self.curKind() == .identifier) {
                                    const field = self.curText();
                                    self.advance_token();
                                    if (self.curKind() == .colon) self.advance_token();

                                    if (std.mem.eql(u8, field, "type")) {
                                        prim_type = (self.parseStringAttrInline() catch "Box");
                                    } else if (std.mem.eql(u8, field, "style")) {
                                        style_str = (self.parseStyleAttr() catch "");
                                    } else if (std.mem.eql(u8, field, "size")) {
                                        const sz = self.curText();
                                        self.advance_token();
                                        text_props = std.fmt.allocPrint(self.alloc, ".font_size = {s}", .{sz}) catch "";
                                    } else if (std.mem.eql(u8, field, "bold")) {
                                        // Skip bool value
                                        if (self.curKind() == .identifier) self.advance_token();
                                    } else if (std.mem.eql(u8, field, "color")) {
                                        const col = (self.parseStringAttrInline() catch "");
                                        if (col.len > 0) {
                                            const zig_col = self.parseColorValue(col) catch "Color.rgb(255,255,255)";
                                            text_props = std.fmt.allocPrint(self.alloc, "{s}, .text_color = {s}", .{
                                                if (text_props.len > 0) text_props else "",
                                                zig_col,
                                            }) catch "";
                                        }
                                    } else if (std.mem.eql(u8, field, "grow")) {
                                        // grow: true → flexGrow: 1
                                        if (self.curKind() == .identifier) self.advance_token();
                                        if (style_str.len > 0) {
                                            style_str = std.fmt.allocPrint(self.alloc, "{s}, .flex_grow = 1", .{style_str}) catch style_str;
                                        } else {
                                            style_str = ".flex_grow = 1";
                                        }
                                    } else {
                                        // Skip unknown field value
                                        self.advance_token();
                                    }
                                } else {
                                    // Not an identifier — skip to avoid infinite loop
                                    self.advance_token();
                                }
                                if (self.curKind() == .comma) self.advance_token();
                            }
                            if (self.curKind() == .rbrace) self.advance_token(); // }

                            // Register
                            if (self.classifier_count < 128) {
                                const idx = self.classifier_count;
                                self.classifier_names[idx] = name;
                                self.classifier_primitives[idx] = prim_type;
                                self.classifier_styles[idx] = style_str;
                                self.classifier_text_props[idx] = text_props;
                                self.classifier_count += 1;
                            }
                        }
                    } else {
                        // Not an identifier — skip to avoid infinite loop
                        self.advance_token();
                    }
                    if (self.curKind() == .comma) self.advance_token();
                }
                if (self.curKind() == .rbrace) self.advance_token(); // }
                if (self.curKind() == .rparen) self.advance_token(); // )
            }
            self.advance_token();
        }
    }

    fn collectFFIPragmas(self: *Generator) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            const tok = self.lex.get(i);
            if (tok.kind == .ffi_pragma) {
                const text = tok.text(self.source);
                // Parse: // @ffi <header> [-llib]
                if (std.mem.indexOf(u8, text, "<")) |lt_pos| {
                    if (std.mem.indexOf(u8, text, ">")) |gt_pos| {
                        if (gt_pos > lt_pos) {
                            const header = text[lt_pos + 1 .. gt_pos];
                            self.ffi_headers.append(self.alloc, header) catch {};
                        }
                        // Check for -l flag after >
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

    fn scanForPtyUsage(self: *Generator) void {
        const pty_builtins = [_][]const u8{ "spawnPty", "pollPty", "writePty", "writePtyByte", "writePtyEscape", "resizePty", "closePty", "handleTerminalKey", "getRowText" };
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            const tok = self.lex.get(i);
            if (tok.kind == .identifier) {
                const name = tok.text(self.source);
                for (pty_builtins) |builtin| {
                    if (std.mem.eql(u8, name, builtin)) {
                        self.has_pty = true;
                        return;
                    }
                }
            }
        }
    }

    fn scanForInspectorUsage(self: *Generator) void {
        const inspector_builtins = [_][]const u8{ "hasHover", "getHoverX", "getHoverY", "getHoverW", "getHoverH", "hasSelect", "getSelectX", "getSelectY", "getSelectW", "getSelectH", "isInspectorEnabled" };
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            const tok = self.lex.get(i);
            if (tok.kind == .identifier) {
                const name = tok.text(self.source);
                for (inspector_builtins) |builtin| {
                    if (std.mem.eql(u8, name, builtin)) {
                        self.has_inspector = true;
                        return;
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
                    }
                }
            }
            self.advance_token();
        }
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

    fn collectStateHooks(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        // Skip past function header to body
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();

        // Scan for: const [getter, setter] = useState(initial)
        while (self.pos < self.lex.count) {
            if (self.isIdent("const") or self.isIdent("let")) {
                self.advance_token();
                if (self.curKind() == .lbracket) {
                    self.advance_token();
                    if (self.curKind() == .identifier) {
                        const getter = self.curText();
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                        if (self.curKind() == .identifier) {
                            const setter = self.curText();
                            self.advance_token();
                            if (self.curKind() == .rbracket) self.advance_token();
                            if (self.curKind() == .equals) self.advance_token();
                            if (self.isIdent("useState")) {
                                self.advance_token(); // useState
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
                                    // Array literal: useState([1, 2, 3])
                                    self.advance_token(); // [
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
                                // Skip rparen
                                if (self.curKind() == .rparen) self.advance_token();

                                if (self.state_count < MAX_STATE_SLOTS) {
                                    self.state_slots[self.state_count] = .{
                                        .getter = getter,
                                        .setter = setter,
                                        .initial = initial,
                                    };
                                    self.state_count += 1;
                                    self.has_state = true;
                                }
                            }
                        }
                    }
                }
            }
            if (self.isIdent("return")) break;
            self.advance_token();
        }
    }

    fn collectEffects(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        // Skip past function header to body
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();

        while (self.pos < self.lex.count) {
            if (self.isIdent("useEffect")) {
                self.advance_token(); // skip "useEffect"
                if (self.curKind() == .lparen) self.advance_token(); // skip (

                // Record body start — at the ( of the arrow function params
                const body_start = self.pos;

                // Skip the arrow function: () => BODY
                if (self.curKind() == .lparen) self.advance_token(); // (
                if (self.curKind() == .rparen) self.advance_token(); // )
                if (self.curKind() == .arrow) self.advance_token(); // =>

                // Skip body — either { ... } block or single expression
                if (self.curKind() == .lbrace) {
                    var depth: u32 = 1;
                    self.advance_token();
                    while (depth > 0 and self.curKind() != .eof) {
                        if (self.curKind() == .lbrace) depth += 1;
                        if (self.curKind() == .rbrace) depth -= 1;
                        if (depth > 0) self.advance_token();
                    }
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
                }

                // Determine kind based on what follows the body
                var kind: EffectKind = .every_frame;
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

                // Skip closing )
                if (self.curKind() == .rparen) self.advance_token();
                // Skip optional ;
                if (self.curKind() == .semicolon) self.advance_token();

                if (self.effect_count < MAX_EFFECTS) {
                    self.effects[self.effect_count] = .{
                        .kind = kind,
                        .body_start = body_start,
                        .dep_slots = dep_slots,
                        .dep_count = dep_count,
                        .interval_ms = interval_ms,
                    };
                    self.effect_count += 1;
                }
                continue; // don't advance_token at bottom
            }
            if (self.isIdent("return")) break;
            self.advance_token();
        }
    }

    fn collectAnimHooks(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();

        // Scan for: const <name> = useTransition(expr, { ... }) or useSpring(expr, { ... })
        while (self.pos < self.lex.count) {
            if (self.isIdent("const") or self.isIdent("let")) {
                self.advance_token();
                // Not destructuring (no [) — single identifier
                if (self.curKind() == .identifier and !self.isIdent("const") and !self.isIdent("let")) {
                    const name = self.curText();
                    const saved = self.pos;
                    self.advance_token();
                    if (self.curKind() == .equals) {
                        self.advance_token();
                        if (self.isIdent("useTransition") or self.isIdent("useSpring")) {
                            const is_spring = self.isIdent("useSpring");
                            self.advance_token(); // skip hook name
                            if (self.curKind() == .lparen) self.advance_token(); // skip (

                            // Parse target expression — emitStateExpr handles ternaries, state refs
                            // Set flag so float literals get @as(f32, ...) annotation
                            self.emit_float_as_f32 = true;
                            const target_expr = self.emitStateExpr() catch "0";
                            self.emit_float_as_f32 = false;

                            // Skip comma before config
                            if (self.curKind() == .comma) self.advance_token();

                            // Parse config object: { duration, easing, stiffness, damping }
                            var duration: u32 = 300;
                            var easing_name: []const u8 = "easeInOut";
                            var stiffness: f32 = 100;
                            var damping: f32 = 10;

                            if (self.curKind() == .lbrace) {
                                self.advance_token(); // skip {
                                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                    if (self.curKind() == .identifier) {
                                        const field = self.curText();
                                        self.advance_token();
                                        if (self.curKind() == .colon) self.advance_token();
                                        if (std.mem.eql(u8, field, "duration")) {
                                            if (self.curKind() == .number)
                                                duration = std.fmt.parseInt(u32, self.curText(), 10) catch 300;
                                            self.advance_token();
                                        } else if (std.mem.eql(u8, field, "easing")) {
                                            if (self.curKind() == .string) {
                                                const raw = self.curText();
                                                easing_name = raw[1 .. raw.len - 1];
                                            }
                                            self.advance_token();
                                        } else if (std.mem.eql(u8, field, "stiffness")) {
                                            if (self.curKind() == .number)
                                                stiffness = std.fmt.parseFloat(f32, self.curText()) catch 100;
                                            self.advance_token();
                                        } else if (std.mem.eql(u8, field, "damping")) {
                                            if (self.curKind() == .number)
                                                damping = std.fmt.parseFloat(f32, self.curText()) catch 10;
                                            self.advance_token();
                                        } else {
                                            self.advance_token();
                                        }
                                    } else {
                                        self.advance_token();
                                    }
                                    if (self.curKind() == .comma) self.advance_token();
                                }
                                if (self.curKind() == .rbrace) self.advance_token();
                            }

                            // Skip closing )
                            if (self.curKind() == .rparen) self.advance_token();
                            // Skip optional ;
                            if (self.curKind() == .semicolon) self.advance_token();

                            if (self.anim_hook_count < MAX_ANIM_HOOKS) {
                                self.anim_hooks[self.anim_hook_count] = .{
                                    .kind = if (is_spring) .spring else .transition,
                                    .name = name,
                                    .target_expr = target_expr,
                                    .duration_ms = duration,
                                    .easing_name = easing_name,
                                    .stiffness = stiffness,
                                    .damping = damping,
                                };
                                self.anim_hook_count += 1;
                            }
                            continue;
                        }
                    }
                    self.pos = saved; // not an anim hook, rewind
                }
            }
            if (self.isIdent("return")) break;
            self.advance_token();
        }
    }

    fn emitEffectBody(self: *Generator, start: u32) ![]const u8 {
        const saved_pos = self.pos;
        self.pos = start;
        defer self.pos = saved_pos;

        // Skip () =>
        if (self.curKind() == .lparen) self.advance_token();
        if (self.curKind() == .rparen) self.advance_token();
        if (self.curKind() == .arrow) self.advance_token();

        // Block body: { stmt; stmt; }
        if (self.curKind() == .lbrace) {
            self.advance_token(); // skip {
            var stmts: std.ArrayListUnmanaged(u8) = .{};
            var safety: u32 = 0;
            while (self.curKind() != .rbrace and self.curKind() != .eof and safety < 100) : (safety += 1) {
                const before = self.pos;
                const stmt = try self.emitHandlerExpr();
                try stmts.appendSlice(self.alloc, "    ");
                try stmts.appendSlice(self.alloc, stmt);
                try stmts.appendSlice(self.alloc, "\n");
                if (self.curKind() == .semicolon) self.advance_token();
                // Guard against no progress
                if (self.pos == before) self.advance_token();
            }
            return try self.alloc.dupe(u8, stmts.items);
        }

        // Single expression
        return try std.fmt.allocPrint(self.alloc, "    {s}", .{try self.emitHandlerExpr()});
    }

    // ── Component helpers ──────────────────────────────────────────────

    fn findComponent(self: *Generator, name: []const u8) ?*const ComponentInfo {
        for (0..self.component_count) |i| {
            if (std.mem.eql(u8, self.components[i].name, name)) return &self.components[i];
        }
        return null;
    }

    fn findProp(self: *Generator, name: []const u8) ?[]const u8 {
        // Search prop stack (most recent first for nesting)
        var i: u32 = self.prop_stack_count;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) return self.prop_stack[i].value;
        }
        return null;
    }

    /// Look up a forwarded handler prop by name. Returns handler token range if found.
    fn findPropHandler(self: *Generator, name: []const u8) ?struct { start: u32, end: u32 } {
        var i: u32 = self.prop_stack_count;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) {
                if (self.prop_stack[i].handler_start) |hs| {
                    return .{ .start = hs, .end = self.prop_stack[i].handler_end orelse hs };
                }
                return null;
            }
        }
        return null;
    }

    /// Check if current handler attribute value is a forwarded prop reference.
    /// Pattern: `={propName}` where propName has a stored handler range.
    /// If found, sets start/end and skips past, returns true.
    fn resolveHandlerProp(self: *Generator, start_out: *?u32, end_out: *?u32) bool {
        // Check pattern: { identifier }
        if (self.curKind() != .lbrace) return false;
        const peek1 = self.pos + 1;
        const peek2 = self.pos + 2;
        if (peek1 >= self.lex.count or peek2 >= self.lex.count) return false;
        if (self.lex.tokens[peek1].kind != .identifier) return false;
        if (self.lex.tokens[peek2].kind != .rbrace) return false;

        const prop_name = self.lex.tokens[peek1].text(self.source);
        if (self.findPropHandler(prop_name)) |range| {
            start_out.* = range.start;
            end_out.* = range.end;
            self.advance_token(); // {
            self.advance_token(); // identifier
            self.advance_token(); // }
            return true;
        }
        return false;
    }

    /// Inline a component at its call site: collect props, jump to body, parse JSX.
    fn inlineComponent(self: *Generator, comp: *const ComponentInfo) anyerror![]const u8 {
        // 1. Collect attribute values from the call site as prop bindings
        const saved_prop_count = self.prop_stack_count;
        while (self.curKind() != .slash_gt and self.curKind() != .gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr_name = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token();
                    var val: []const u8 = "";
                    var h_start: ?u32 = null;
                    var h_end: ?u32 = null;
                    if (self.curKind() == .string) {
                        val = self.curText();
                        if (val.len >= 2 and val[0] == '\'') {
                            val = try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{val[1 .. val.len - 1]});
                        }
                        self.advance_token();
                    } else if (self.curKind() == .lbrace) {
                        // Check if this is a handler prop (onPress, onChangeText, etc.)
                        const is_handler = attr_name.len > 2 and attr_name[0] == 'o' and attr_name[1] == 'n' and attr_name[2] >= 'A' and attr_name[2] <= 'Z';
                        if (is_handler) {
                            // Store handler token range — don't try to parse as expression
                            h_start = self.pos;
                            try self.skipBalanced();
                            h_end = self.pos;
                        } else {
                            self.advance_token(); // {
                            val = try self.emitStateExpr();
                            if (self.curKind() == .rbrace) self.advance_token(); // }
                        }
                    }
                    // Match to a component prop
                    for (0..comp.prop_count) |pi| {
                        if (std.mem.eql(u8, comp.prop_names[pi], attr_name)) {
                            if (self.prop_stack_count < MAX_COMPONENT_PROPS) {
                                self.prop_stack[self.prop_stack_count] = .{
                                    .name = attr_name,
                                    .value = val,
                                    .handler_start = h_start,
                                    .handler_end = h_end,
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

        // 2. Handle self-closing vs children
        var caller_children = std.ArrayListUnmanaged([]const u8){};
        var has_caller_children = false;
        if (self.curKind() == .slash_gt) {
            self.advance_token(); // />
        } else if (self.curKind() == .gt) {
            self.advance_token(); // >
            if (comp.has_children) {
                has_caller_children = true;
                while (self.curKind() != .eof) {
                    if (self.curKind() == .lt) {
                        const peek = self.pos + 1;
                        if (peek < self.lex.count and self.lex.get(peek).kind == .slash) {
                            self.advance_token(); // <
                            self.advance_token(); // /
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
                // No {children} — skip to closing tag
                var depth: u32 = 1;
                while (self.pos < self.lex.count and depth > 0) {
                    if (self.curKind() == .lt) {
                        const peek = self.pos + 1;
                        if (peek < self.lex.count and self.lex.get(peek).kind == .slash) {
                            depth -= 1;
                            if (depth == 0) {
                                self.advance_token(); // <
                                self.advance_token(); // /
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

        // 3. Save position, jump to component body
        const saved_pos = self.pos;
        const saved_children = self.component_children_exprs;
        if (has_caller_children) {
            self.component_children_exprs = &caller_children;
        } else {
            self.component_children_exprs = null;
        }
        self.pos = comp.body_pos;

        // 4. Parse the component's JSX
        const result = try self.parseJSXElement();

        // 5. Restore
        self.pos = saved_pos;
        self.prop_stack_count = saved_prop_count;
        self.component_children_exprs = saved_children;

        return result;
    }

    /// Collect function components (non-App functions with JSX return).
    /// Records their name, props, and the token position of their return JSX.
    fn collectComponents(self: *Generator) void {
        self.pos = 0;
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("function")) {
                const func_pos = self.pos;
                self.advance_token(); // skip "function"
                if (self.curKind() != .identifier) continue;
                const name = self.curText();
                // Skip "App" — that's the main entry point, not a component
                if (std.mem.eql(u8, name, "App")) {
                    self.advance_token();
                    continue;
                }
                // Must start with uppercase (component convention)
                if (name.len == 0 or name[0] < 'A' or name[0] > 'Z') {
                    self.advance_token();
                    continue;
                }
                self.advance_token(); // skip name

                // Parse props: ({ prop1, prop2 }: Type) or ()
                var prop_names: [MAX_COMPONENT_PROPS][]const u8 = undefined;
                var prop_count: u32 = 0;
                if (self.curKind() == .lparen) {
                    self.advance_token(); // (
                    if (self.curKind() == .lbrace) {
                        self.advance_token(); // {
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
                        if (self.curKind() == .rbrace) self.advance_token(); // }
                    }
                    // Skip type annotation: }: { label: string; color: string }
                    // Just skip until closing paren
                    var paren_depth: u32 = 1;
                    while (self.pos < self.lex.count and paren_depth > 0) {
                        if (self.curKind() == .lparen) paren_depth += 1;
                        if (self.curKind() == .rparen) {
                            paren_depth -= 1;
                            if (paren_depth == 0) break;
                        }
                        self.advance_token();
                    }
                    if (self.curKind() == .rparen) self.advance_token(); // )
                }

                // Find the function body and its return JSX
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    // Find return statement
                    var brace_depth: u32 = 1;
                    while (self.pos < self.lex.count and brace_depth > 0) {
                        if (self.isIdent("return") and brace_depth == 1) {
                            self.advance_token(); // skip "return"
                            if (self.curKind() == .lparen) self.advance_token(); // skip (
                            // Now positioned at the '<' of the JSX
                            if (self.curKind() == .lt and self.component_count < MAX_COMPONENTS) {
                                // Check for {children} in body by scanning ahead
                                const body_pos = self.pos;
                                var has_children = false;
                                const scan_save = self.pos;
                                var scan_depth: u32 = 0;
                                while (self.pos < self.lex.count) {
                                    if (self.curKind() == .lt) scan_depth += 1;
                                    if (self.isIdent("children")) {
                                        has_children = true;
                                        break;
                                    }
                                    // Stop at the function's closing brace
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
                                };
                                self.component_count += 1;
                            }
                            break;
                        }
                        if (self.curKind() == .lbrace) brace_depth += 1;
                        if (self.curKind() == .rbrace) brace_depth -= 1;
                        self.advance_token();
                    }
                }
                // Skip rest of function
                _ = func_pos;
                continue;
            }
            self.advance_token();
        }
    }

    // ── Local variable helpers ────────────────────────────────────────

    fn isLocalVar(self: *Generator, name: []const u8) ?*const LocalVar {
        for (0..self.local_count) |i| {
            if (std.mem.eql(u8, self.local_vars[i].name, name)) return &self.local_vars[i];
        }
        return null;
    }

    /// Infer the result type of a Zig expression for template literal formatting.
    /// Checks output type (what the expression produces), not input type (what it reads).
    fn inferExprType(self: *Generator, expr: []const u8) StateType {
        _ = self;
        // Ternary that produces strings: (if (...) "x" else "y")
        // Check if expression contains string literals as ternary branches
        const has_if = std.mem.indexOf(u8, expr, "if (") != null;
        const has_else = std.mem.indexOf(u8, expr, " else ") != null;
        if (has_if and has_else) {
            // Count double-quote chars — if the branches are strings, there will be quotes
            var dq_count: u32 = 0;
            for (expr) |ch| {
                if (ch == '"') dq_count += 1;
            }
            if (dq_count >= 4) return .string; // at least 2 string literals (open+close each)
        }
        // Direct string getter
        if (std.mem.indexOf(u8, expr, "getSlotString") != null) return .string;
        // String literal
        if (expr.len >= 2 and expr[0] == '"') return .string;
        // Float getters
        if (std.mem.indexOf(u8, expr, "getSlotFloat") != null or
            std.mem.indexOf(u8, expr, "getFps") != null or
            std.mem.indexOf(u8, expr, "getLayoutMs") != null or
            std.mem.indexOf(u8, expr, "getPaintMs") != null) return .float;
        // Bool — only if it's a pure comparison (not a ternary)
        if (!has_if) {
            if (std.mem.indexOf(u8, expr, "getSlotBool") != null) return .boolean;
            // Bare comparisons that aren't inside a ternary
            if (std.mem.indexOf(u8, expr, "==") != null or
                std.mem.indexOf(u8, expr, "!=") != null or
                std.mem.indexOf(u8, expr, "< ") != null or
                std.mem.indexOf(u8, expr, "> ") != null) return .boolean;
        }
        return .int;
    }

    /// Collect local variable declarations between hooks and return.
    /// Pattern: const <ident> = <expr>;  (not useState/useEffect/useTransition/useSpring)
    fn collectLocalVars(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        // Skip past function header to body
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();

        while (self.pos < self.lex.count) {
            if (self.isIdent("return")) break;

            if (self.isIdent("const") or self.isIdent("let")) {
                self.advance_token();
                // Skip array destructuring (useState): const [x, y] = ...
                if (self.curKind() == .lbracket) {
                    self.advance_token();
                    continue;
                }
                if (self.curKind() == .identifier) {
                    const var_name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .equals) {
                        self.advance_token();
                        // Skip known hook calls — these are handled by other phases
                        if (self.isIdent("useState") or self.isIdent("useEffect") or
                            self.isIdent("useTransition") or self.isIdent("useSpring"))
                        {
                            // Skip to semicolon or next statement
                            while (self.pos < self.lex.count and
                                self.curKind() != .semicolon and !self.isIdent("const") and
                                !self.isIdent("let") and !self.isIdent("return") and
                                !self.isIdent("useEffect"))
                            {
                                self.advance_token();
                            }
                            if (self.curKind() == .semicolon) self.advance_token();
                            continue;
                        }
                        // Parse the expression to get its Zig translation
                        const expr = self.emitStateExpr() catch {
                            self.advance_token();
                            continue;
                        };
                        // Infer type from expression for template literal formatting
                        const st = self.inferExprType(expr);

                        if (self.local_count < MAX_LOCALS) {
                            self.local_vars[self.local_count] = .{
                                .name = var_name,
                                .expr = expr,
                                .state_type = st,
                            };
                            self.local_count += 1;
                        }
                        if (self.curKind() == .semicolon) self.advance_token();
                        continue;
                    }
                }
            }
            self.advance_token();
        }
    }

    fn findReturnStatement(self: *Generator) void {
        while (self.pos < self.lex.count and !self.isIdent("return")) {
            self.advance_token();
        }
        if (self.isIdent("return")) self.advance_token();
        // Skip optional opening paren
        if (self.curKind() == .lparen) self.advance_token();
    }

    // ── JSX parsing ─────────────────────────────────────────────────

    fn parseJSXElement(self: *Generator) ![]const u8 {
        if (self.curKind() != .lt) {
            std.debug.print("[tsz] Expected '<' for JSX, got {} at {d}\n", .{ self.curKind(), self.pos });
            return error.ExpectedJSX;
        }
        self.advance_token(); // skip <

        // Fragment: <>...</> — transparent wrapper, no style
        if (self.curKind() == .gt) {
            self.advance_token(); // skip >
            var frag_children = std.ArrayListUnmanaged([]const u8){};
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    const child = try self.parseJSXElement();
                    try frag_children.append(self.alloc, child);
                } else {
                    self.advance_token();
                }
            }
            // Skip closing </> (lt_slash + gt)
            if (self.curKind() == .lt_slash) {
                self.advance_token(); // </
                if (self.curKind() == .gt) self.advance_token(); // >
            }
            if (frag_children.items.len == 0) {
                return try self.alloc.dupe(u8, ".{}");
            }
            const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
            self.array_counter += 1;
            var arr_body = std.ArrayListUnmanaged(u8){};
            for (frag_children.items, 0..) |child_expr, ci| {
                if (ci > 0) try arr_body.appendSlice(self.alloc, ", ");
                try arr_body.appendSlice(self.alloc, child_expr);
            }
            const arr_decl = try std.fmt.allocPrint(self.alloc, "var {s} = [_]Node{{ {s} }};", .{ arr_name, arr_body.items });
            try self.array_decls.append(self.alloc, arr_decl);
            return try std.fmt.allocPrint(self.alloc, ".{{ .children = &{s} }}", .{arr_name});
        }

        var tag_name = self.curText();
        self.advance_token(); // skip tag name

        // Handle C.Name classifier references
        var classifier_idx: ?u32 = null;
        if (std.mem.eql(u8, tag_name, "C") and self.curKind() == .dot) {
            self.advance_token(); // skip .
            const cls_name = self.curText();
            self.advance_token(); // skip classifier name
            classifier_idx = self.findClassifier(cls_name);
            if (classifier_idx) |idx| {
                // Resolve to the underlying primitive
                tag_name = self.classifier_primitives[idx];
            } else {
                std.debug.print("[tsz] Unknown classifier: C.{s}\n", .{cls_name});
            }
        }

        // Custom component — inline at compile time
        if (self.findComponent(tag_name)) |comp| {
            return try self.inlineComponent(comp);
        }

        // Route element — extract path + element attrs, return the element expr
        if (std.mem.eql(u8, tag_name, "Route")) {
            return try self.parseRouteElement();
        }

        // Parse attributes
        var style_str: []const u8 = "";
        var className_str: []const u8 = "";
        var font_size: []const u8 = "";
        var letter_spacing: []const u8 = "";
        var line_height_val: []const u8 = "";
        var number_of_lines: []const u8 = "";
        var color_str: []const u8 = "";
        var src_str: []const u8 = "";
        var on_press_start: ?u32 = null;
        var on_press_end: ?u32 = null;
        var on_change_text_start: ?u32 = null;
        var on_change_text_end: ?u32 = null;
        var on_scroll_start: ?u32 = null;
        var on_scroll_end: ?u32 = null;
        var on_key_start: ?u32 = null;
        var on_key_end: ?u32 = null;
        var title_str: []const u8 = "";
        var width_str: []const u8 = "400";
        var height_str: []const u8 = "300";
        var placeholder_str: []const u8 = "";
        var language_str: []const u8 = "";
        var debug_name_str: []const u8 = "";
        var test_id_str: []const u8 = "";

        // Pre-populate from classifier defaults
        if (classifier_idx) |idx| {
            style_str = self.classifier_styles[idx];
            const tp = self.classifier_text_props[idx];
            // Parse text props: ".font_size = N, .text_color = Color.rgb(...)"
            if (tp.len > 0) {
                if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                    const after = tp[fs_pos + 13 ..];
                    const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                    font_size = after[0..end];
                }
                // color_str stays empty — text_color is handled as a raw field below
            }
        }

        const is_routes = std.mem.eql(u8, tag_name, "Routes");
        const is_window = std.mem.eql(u8, tag_name, "Window");
        const is_scroll = std.mem.eql(u8, tag_name, "ScrollView");
        const is_text_input = std.mem.eql(u8, tag_name, "TextInput") or std.mem.eql(u8, tag_name, "TextArea");
        const is_multiline = std.mem.eql(u8, tag_name, "TextArea");
        const is_code_block = std.mem.eql(u8, tag_name, "CodeBlock");
        const is_sparkline = std.mem.eql(u8, tag_name, "Sparkline");
        const is_wireframe = std.mem.eql(u8, tag_name, "Wireframe");
        const is_node_tree = std.mem.eql(u8, tag_name, "NodeTree");

        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr_name = self.curText();
                self.advance_token(); // skip attr name
                if (self.curKind() == .equals) {
                    self.advance_token(); // skip =
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
                    } else if (std.mem.eql(u8, attr_name, "color")) {
                        color_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "src")) {
                        src_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "title")) {
                        title_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "width")) {
                        width_str = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "height")) {
                        height_str = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "placeholder")) {
                        placeholder_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "language")) {
                        language_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "debugName")) {
                        debug_name_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "testId")) {
                        test_id_str = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "className")) {
                        const cls_str = try self.parseStringAttr();
                        if (cls_str.len > 0) {
                            var cls_fields: std.ArrayListUnmanaged(u8) = .{};
                            var cls_iter = std.mem.splitScalar(u8, cls_str, ' ');
                            while (cls_iter.next()) |cls| {
                                const trimmed = std.mem.trim(u8, cls, &[_]u8{ ' ', '\t' });
                                if (trimmed.len == 0) continue;
                                // Try Tailwind first, fall back to Bootstrap
                                const tw = tailwind.parse(self.alloc, trimmed) catch "";
                                if (tw.len > 0) {
                                    if (cls_fields.items.len > 0) try cls_fields.appendSlice(self.alloc, ", ");
                                    try cls_fields.appendSlice(self.alloc, tw);
                                    continue;
                                }
                                const bs = bootstrap.parse(self.alloc, trimmed) catch "";
                                if (bs.len > 0) {
                                    if (cls_fields.items.len > 0) try cls_fields.appendSlice(self.alloc, ", ");
                                    try cls_fields.appendSlice(self.alloc, bs);
                                }
                            }
                            if (cls_fields.items.len > 0) {
                                className_str = try self.alloc.dupe(u8, cls_fields.items);
                            }
                        }
                    } else if (std.mem.eql(u8, attr_name, "onPress")) {
                        // Check if this is a forwarded handler prop: onPress={onPress}
                        if (self.resolveHandlerProp(&on_press_start, &on_press_end)) {
                            // Resolved from prop — range already set
                        } else {
                            on_press_start = self.pos;
                            try self.skipBalanced();
                            on_press_end = self.pos;
                        }
                    } else if (std.mem.eql(u8, attr_name, "onChangeText")) {
                        if (self.resolveHandlerProp(&on_change_text_start, &on_change_text_end)) {} else {
                            on_change_text_start = self.pos;
                            try self.skipBalanced();
                            on_change_text_end = self.pos;
                        }
                    } else if (std.mem.eql(u8, attr_name, "onKeyDown")) {
                        if (self.resolveHandlerProp(&on_key_start, &on_key_end)) {} else {
                            on_key_start = self.pos;
                            try self.skipBalanced();
                            on_key_end = self.pos;
                        }
                    } else if (std.mem.eql(u8, attr_name, "onScroll")) {
                        if (self.resolveHandlerProp(&on_scroll_start, &on_scroll_end)) {} else {
                            on_scroll_start = self.pos;
                            try self.skipBalanced();
                            on_scroll_end = self.pos;
                        }
                    } else {
                        try self.skipAttrValue();
                    }
                }
            } else {
                self.advance_token();
            }
        }

        // Self-closing: <Tag ... />
        const self_closing = self.curKind() == .slash_gt;
        self.advance_token(); // skip > or />

        // Build style fields
        var fields: std.ArrayListUnmanaged(u8) = .{};
        defer fields.deinit(self.alloc);

        // Style
        var style_parts: std.ArrayListUnmanaged(u8) = .{};
        defer style_parts.deinit(self.alloc);
        // className fields first (inline style wins on conflict by coming second)
        if (className_str.len > 0) try style_parts.appendSlice(self.alloc, className_str);
        if (style_str.len > 0) {
            if (style_parts.items.len > 0) try style_parts.appendSlice(self.alloc, ", ");
            try style_parts.appendSlice(self.alloc, style_str);
        }
        if (is_scroll) {
            if (style_parts.items.len > 0) try style_parts.appendSlice(self.alloc, ", ");
            try style_parts.appendSlice(self.alloc, ".overflow = .scroll");
        }
        if (style_parts.items.len > 0) {
            try fields.appendSlice(self.alloc, ".style = .{ ");
            try fields.appendSlice(self.alloc, style_parts.items);
            try fields.appendSlice(self.alloc, " }");
        }

        // Text content and children
        var child_exprs: std.ArrayListUnmanaged([]const u8) = .{};
        defer child_exprs.deinit(self.alloc);
        var text_content: ?[]const u8 = null;
        var is_dynamic_text = false;
        var dyn_fmt: []const u8 = "";
        var dyn_args: []const u8 = "";

        // Save pending anim/dyn_style count — bindings from THIS node's style should
        // survive children processing and be consumed by the PARENT.
        const own_pending_anim = self.pending_anim_count;
        const own_pending_dyn_style = self.pending_dyn_style_count;
        // Save dyn_style_count so array binding only targets styles from THIS node's children
        const dyn_style_start = self.dyn_style_count;

        // Mark route binding point for Routes element
        if (is_routes) self.routes_bind_from = self.route_count;

        if (!self_closing) {
            // Parse children until closing tag
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    // Child JSX element
                    self.last_dyn_id = null;
                    const child = try self.parseJSXElement();
                    try child_exprs.append(self.alloc, child);
                    // Resolve pending animation bindings from CHILD's style only
                    // (own_pending_anim..count are from the child; 0..own_pending_anim are ours)
                    for (own_pending_anim..self.pending_anim_count) |pi| {
                        if (self.anim_binding_count < MAX_ANIM_BINDINGS) {
                            self.anim_bindings[self.anim_binding_count] = .{
                                .anim_idx = self.pending_anim[pi].anim_idx,
                                .arr_name = "",
                                .arr_index = @intCast(child_exprs.items.len - 1),
                                .style_field = self.pending_anim[pi].style_field,
                            };
                            self.anim_binding_count += 1;
                        }
                    }
                    self.pending_anim_count = own_pending_anim; // keep our own bindings
                    // Resolve pending dynamic style bindings from CHILD's style
                    for (own_pending_dyn_style..self.pending_dyn_style_count) |pi| {
                        if (self.dyn_style_count < MAX_DYN_STYLES) {
                            self.dyn_styles[self.dyn_style_count] = .{
                                .field = self.pending_dyn_styles[pi].field,
                                .expression = self.pending_dyn_styles[pi].expression,
                                .arr_name = "",
                                .arr_index = @intCast(child_exprs.items.len - 1),
                                .has_ref = false,
                            };
                            self.dyn_style_count += 1;
                        }
                    }
                    self.pending_dyn_style_count = own_pending_dyn_style;
                    // Track Route → Routes metadata
                    if (self.last_route_path) |path| {
                        if (self.route_count < MAX_ROUTES) {
                            self.routes[self.route_count] = .{
                                .path = path,
                                .arr_name = "",
                                .child_idx = @intCast(child_exprs.items.len - 1),
                            };
                            self.route_count += 1;
                        }
                        self.last_route_path = null;
                    }
                } else if (self.curKind() == .lbrace) {
                    // Expression: {`template`}, {children}, or conditionals
                    self.advance_token(); // skip {
                    // {/* ... */} — JSX block comment, skip entirely
                    if (self.curKind() == .slash and self.pos + 1 < self.lex.count and self.lex.tokens[self.pos + 1].kind == .star) {
                        while (self.curKind() != .eof) {
                            if (self.curKind() == .star and self.pos + 1 < self.lex.count and self.lex.tokens[self.pos + 1].kind == .slash) {
                                self.advance_token(); // *
                                self.advance_token(); // /
                                break;
                            }
                            self.advance_token();
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
                        continue;
                    }
                    // {children} — splice caller's children into this component
                    if (self.isIdent("children") and self.component_children_exprs != null) {
                        self.advance_token(); // skip "children"
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
                        } else {
                            text_content = tl.static_text;
                        }
                        self.advance_token(); // skip template literal
                    } else if (self.isLogicalAndAhead()) {
                        // Logical AND: {condition && <Element/>}
                        const result = try self.parseLogicalAndJSX();
                        try child_exprs.append(self.alloc, result.element);
                        // Resolve pending dynamic style bindings from conditional CHILD's style
                        for (own_pending_dyn_style..self.pending_dyn_style_count) |pi| {
                            if (self.dyn_style_count < MAX_DYN_STYLES) {
                                self.dyn_styles[self.dyn_style_count] = .{
                                    .field = self.pending_dyn_styles[pi].field,
                                    .expression = self.pending_dyn_styles[pi].expression,
                                    .arr_name = "",
                                    .arr_index = @intCast(child_exprs.items.len - 1),
                                    .has_ref = false,
                                };
                                self.dyn_style_count += 1;
                            }
                        }
                        self.pending_dyn_style_count = own_pending_dyn_style;
                        if (self.cond_count < MAX_CONDS) {
                            self.conds[self.cond_count] = .{
                                .kind = .show_hide,
                                .condition = result.condition,
                                .arr_name = "",
                                .true_idx = @intCast(child_exprs.items.len - 1),
                                .false_idx = @intCast(child_exprs.items.len - 1),
                            };
                            self.cond_count += 1;
                        }
                    } else if (self.isTernaryAhead()) {
                        // Ternary: {condition ? <TrueJSX/> : <FalseJSX/>}
                        const ternary = try self.parseTernaryJSX();
                        try child_exprs.append(self.alloc, ternary.true_expr);
                        try child_exprs.append(self.alloc, ternary.false_expr);
                        if (self.cond_count < MAX_CONDS) {
                            self.conds[self.cond_count] = .{
                                .kind = .ternary,
                                .condition = ternary.condition,
                                .arr_name = "",
                                .true_idx = @intCast(child_exprs.items.len - 2),
                                .false_idx = @intCast(child_exprs.items.len - 1),
                            };
                            self.cond_count += 1;
                        }
                    } else if (self.isMapAhead()) {
                        // .map() expression: {items.map((item, index) => (...))}
                        const map_result = try self.parseMapExpression();
                        try child_exprs.append(self.alloc, map_result);
                        if (self.map_count > 0) {
                            self.maps[self.map_count - 1].child_idx = @intCast(child_exprs.items.len - 1);
                        }
                    } else if (self.curKind() == .identifier) {
                        // Prop, local var, or state as text content: {text}, {label}, etc.
                        const ident = self.curText();
                        if (self.findProp(ident)) |val| {
                            self.advance_token();
                            if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                                text_content = val[1 .. val.len - 1];
                            } else if (std.mem.startsWith(u8, val, "state.getSlot(")) {
                                // Dynamic state reference from prop — create dynamic text
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotString(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{s}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotFloat(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotBool(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{s}";
                                dyn_args = try std.fmt.allocPrint(self.alloc,
                                    "if ({s}) \"true\" else \"false\"", .{val});
                            } else if (std.mem.indexOf(u8, val, "state.getSlot") != null) {
                                // Expression containing state ref (e.g. "state.getSlot(0) * 2")
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else {
                                text_content = val;
                            }
                        } else if (self.isState(ident)) |slot_id| {
                            self.advance_token();
                            // Dynamic text from state variable
                            is_dynamic_text = true;
                            const st = self.stateTypeById(slot_id);
                            const rid = self.regularSlotId(slot_id);
                            dyn_fmt = switch (st) {
                                .string => "{s}",
                                .float => "{d}",
                                .boolean => "{s}",
                                else => "{d}",
                            };
                            dyn_args = switch (st) {
                                .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                                .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                                .boolean => try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}),
                                else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                            };
                        } else if (self.isLocalVar(ident)) |lv| {
                            self.advance_token();
                            is_dynamic_text = true;
                            dyn_fmt = switch (lv.state_type) {
                                .string => "{s}",
                                .float => "{d}",
                                .boolean => "{s}",
                                else => "{d}",
                            };
                            dyn_args = lv.expr;
                        } else {
                            self.advance_token();
                        }
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else if (self.curKind() != .lt and self.curKind() != .lt_slash and self.curKind() != .eof) {
                    // Raw text content between tags (any non-JSX token)
                    const raw = self.collectTextContent();
                    if (raw.len > 0) text_content = raw;
                } else {
                    self.advance_token();
                }
            }

            // Skip closing tag: </TagName> or </C.Name>
            if (self.curKind() == .lt_slash) {
                self.advance_token(); // </
                if (self.curKind() == .identifier) {
                    self.advance_token(); // tag name or "C"
                    if (self.curKind() == .dot) {
                        self.advance_token(); // .
                        if (self.curKind() == .identifier) self.advance_token(); // Name
                    }
                }
                if (self.curKind() == .gt) self.advance_token(); // >
            }
        }

        // Window element → secondary window, not a normal node
        if (is_window) {
            return try self.emitWindowElement(title_str, width_str, height_str, &child_exprs, style_parts.items);
        }

        // Build node expression
        // Add text
        if (is_dynamic_text) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".text = \"\"");
            // Track dynamic text
            if (self.dyn_count < MAX_DYN_TEXTS) {
                self.dyn_texts[self.dyn_count] = .{
                    .buf_id = self.dyn_count,
                    .fmt_string = dyn_fmt,
                    .fmt_args = dyn_args,
                    .arr_name = "",
                    .arr_index = 0,
                    .has_ref = false,
                };
                self.last_dyn_id = self.dyn_count;
                self.dyn_count += 1;
            }
        } else if (text_content) |tc| {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".text = \"");
            // Escape characters that break Zig string literals
            for (tc) |ch| {
                if (ch == '"') {
                    try fields.appendSlice(self.alloc, "\\\"");
                } else if (ch == '\\') {
                    try fields.appendSlice(self.alloc, "\\\\");
                } else if (ch == '\n') {
                    try fields.appendSlice(self.alloc, "\\n");
                } else {
                    try fields.append(self.alloc, ch);
                }
            }
            try fields.appendSlice(self.alloc, "\"");
        }

        // Font size
        if (font_size.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".font_size = ");
            try fields.appendSlice(self.alloc, font_size);
        }

        // Debug name (for test queries)
        if (debug_name_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".debug_name = \"");
            try fields.appendSlice(self.alloc, debug_name_str);
            try fields.appendSlice(self.alloc, "\"");
        }

        // Test ID (for test queries)
        if (test_id_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".test_id = \"");
            try fields.appendSlice(self.alloc, test_id_str);
            try fields.appendSlice(self.alloc, "\"");
        }

        // Code language (CodeBlock)
        if (is_code_block) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            if (language_str.len > 0) {
                // Map language string to CodeLanguage enum
                const lang_enum = if (std.mem.eql(u8, language_str, "zig"))
                    ".zig"
                else if (std.mem.eql(u8, language_str, "typescript") or
                    std.mem.eql(u8, language_str, "ts") or
                    std.mem.eql(u8, language_str, "tsx") or
                    std.mem.eql(u8, language_str, "javascript") or
                    std.mem.eql(u8, language_str, "js") or
                    std.mem.eql(u8, language_str, "jsx"))
                    ".typescript"
                else if (std.mem.eql(u8, language_str, "json"))
                    ".json"
                else if (std.mem.eql(u8, language_str, "bash") or
                    std.mem.eql(u8, language_str, "sh") or
                    std.mem.eql(u8, language_str, "shell"))
                    ".bash"
                else if (std.mem.eql(u8, language_str, "markdown") or
                    std.mem.eql(u8, language_str, "md"))
                    ".markdown"
                else
                    ".plain";
                try fields.appendSlice(self.alloc, ".code_language = ");
                try fields.appendSlice(self.alloc, lang_enum);
            } else {
                try fields.appendSlice(self.alloc, ".code_language = .plain");
            }
            // CodeBlock defaults: no word wrap, monospace-friendly line height
            try fields.appendSlice(self.alloc, ", .no_wrap = true");
        }

        // Letter spacing
        if (letter_spacing.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".letter_spacing = ");
            try fields.appendSlice(self.alloc, letter_spacing);
        }

        // Line height
        if (line_height_val.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".line_height = ");
            try fields.appendSlice(self.alloc, line_height_val);
        }

        // Number of lines
        if (number_of_lines.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".number_of_lines = ");
            try fields.appendSlice(self.alloc, number_of_lines);
        }

        // Color
        if (color_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".text_color = ");
            try fields.appendSlice(self.alloc, try self.parseColorValue(color_str));
        }

        // Classifier text_color (if not overridden by inline color prop)
        if (classifier_idx != null and color_str.len == 0) {
            const tp = self.classifier_text_props[classifier_idx.?];
            // Extract text_color from text_props if present
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                try fields.appendSlice(self.alloc, tp[tc_pos..]);
            }
        }

        // Image src
        if (src_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".image_src = \"");
            // Make path absolute
            if (std.fs.path.dirname(self.input_file)) |dir| {
                const abs = try std.fs.path.resolve(self.alloc, &.{ dir, src_str });
                try fields.appendSlice(self.alloc, abs);
            } else {
                try fields.appendSlice(self.alloc, src_str);
            }
            try fields.appendSlice(self.alloc, "\"");
        }

        // Devtools visualization type
        if (is_sparkline or is_wireframe or is_node_tree) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            if (is_sparkline) {
                try fields.appendSlice(self.alloc, ".devtools_viz = .sparkline");
            } else if (is_wireframe) {
                try fields.appendSlice(self.alloc, ".devtools_viz = .wireframe");
            } else if (is_node_tree) {
                try fields.appendSlice(self.alloc, ".devtools_viz = .node_tree");
            }
        }

        // Handlers — create handler functions and collect their names
        var press_handler_name: ?[]const u8 = null;
        var change_handler_name: ?[]const u8 = null;
        var scroll_handler_name: ?[]const u8 = null;
        var key_handler_name: ?[]const u8 = null;

        if (on_press_start) |start| {
            press_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_press_end.?);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ press_handler_name.?, body });
            try self.handler_decls.append(self.alloc, handler_fn);
        }

        if (on_change_text_start) |start| {
            change_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_change_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_change_text_end.?);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ change_handler_name.?, body });
            try self.handler_decls.append(self.alloc, handler_fn);
        }

        if (on_scroll_start) |start| {
            scroll_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_scroll_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_scroll_end.?);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ scroll_handler_name.?, body });
            try self.handler_decls.append(self.alloc, handler_fn);
        }

        if (on_key_start) |start| {
            key_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_key_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_key_end.?);
            // Only discard params if body doesn't reference them
            const uses_key = std.mem.indexOf(u8, body, "_key") != null;
            const discard = if (uses_key) "" else "    _ = _key;\n    _ = _mods;\n";
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}(_key: c_int, _mods: u16) void {{\n{s}    {s}\n}}", .{ key_handler_name.?, discard, body });
            try self.handler_decls.append(self.alloc, handler_fn);
        }

        // Emit combined .handlers struct
        var hf: std.ArrayListUnmanaged(u8) = .{};
        if (press_handler_name) |n| {
            try hf.appendSlice(self.alloc, ".on_press = ");
            try hf.appendSlice(self.alloc, n);
        }
        if (change_handler_name) |n| {
            if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
            try hf.appendSlice(self.alloc, ".on_change_text = ");
            try hf.appendSlice(self.alloc, n);
        }
        if (scroll_handler_name) |n| {
            if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
            try hf.appendSlice(self.alloc, ".on_scroll = ");
            try hf.appendSlice(self.alloc, n);
        }
        if (key_handler_name) |n| {
            if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
            try hf.appendSlice(self.alloc, ".on_key = ");
            try hf.appendSlice(self.alloc, n);
        }
        if (hf.items.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".handlers = .{ ");
            try fields.appendSlice(self.alloc, hf.items);
            try fields.appendSlice(self.alloc, " }");
        }

        // TextInput — assign input ID and placeholder
        if (is_text_input) {
            const iid = self.input_count;
            if (iid < 16) self.input_multiline[iid] = is_multiline;
            self.input_count += 1;
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".input_id = {d}", .{iid}));
            if (placeholder_str.len > 0) {
                try fields.appendSlice(self.alloc, ", .placeholder = \"");
                try fields.appendSlice(self.alloc, placeholder_str);
                try fields.appendSlice(self.alloc, "\"");
            }
            if (change_handler_name != null) {
                if (iid < 16) self.input_change_handlers[iid] = change_handler_name;
            }
        }

        // Children
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
            try self.array_decls.append(self.alloc, try arr_content.toOwnedSlice(self.alloc));

            // Bind conditions whose indices belong to this child array
            for (0..self.cond_count) |ci| {
                if (self.conds[ci].arr_name.len > 0) continue; // already bound
                if (self.conds[ci].true_idx < child_exprs.items.len) {
                    self.conds[ci].arr_name = arr_name;
                }
            }

            // Bind animation style bindings to this array
            for (0..self.anim_binding_count) |bi| {
                if (self.anim_bindings[bi].arr_name.len > 0) continue;
                if (self.anim_bindings[bi].arr_index < child_exprs.items.len) {
                    self.anim_bindings[bi].arr_name = arr_name;
                }
            }

            // Bind dynamic style bindings to this array (only those from THIS node's children)
            for (dyn_style_start..self.dyn_style_count) |si| {
                if (self.dyn_styles[si].has_ref) continue;
                if (self.dyn_styles[si].arr_index < child_exprs.items.len) {
                    self.dyn_styles[si].arr_name = arr_name;
                    self.dyn_styles[si].has_ref = true;
                }
            }

            // Bind maps to this array
            for (0..self.map_count) |mi| {
                if (self.maps[mi].parent_arr_name.len == 0) {
                    if (self.maps[mi].child_idx < child_exprs.items.len) {
                        self.maps[mi].parent_arr_name = arr_name;
                    }
                }
            }

            // Bind routes — only when this is the Routes element's own child array
            if (self.routes_bind_from) |from| {
                for (from..self.route_count) |ri| {
                    if (self.routes[ri].arr_name.len == 0) {
                        self.routes[ri].arr_name = arr_name;
                    }
                }
                self.routes_bind_from = null;
            }

            // Track dynamic text references
            // (the last_dyn_id from the most recent child points into this array)
            // For now, simple: scan child_exprs for the dynamic placeholder
            for (child_exprs.items, 0..) |_, ci| {
                // Check all unassigned dynamic texts
                for (0..self.dyn_count) |di| {
                    if (!self.dyn_texts[di].has_ref) {
                        // Check if this child might have the dynamic text
                        // Simple heuristic: if the child was just emitted and we have a pending dyn text
                        // This isn't perfect but handles the common case
                    }
                    _ = ci;
                }
            }

            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".children = &");
            try fields.appendSlice(self.alloc, arr_name);

            // Assign unresolved dynamic texts to this array
            for (0..self.dyn_count) |di| {
                if (!self.dyn_texts[di].has_ref) {
                    // Find the child index that has .text = ""
                    for (child_exprs.items, 0..) |expr, ci| {
                        if (std.mem.indexOf(u8, expr, ".text = \"\"") != null) {
                            self.dyn_texts[di].arr_name = arr_name;
                            self.dyn_texts[di].arr_index = @intCast(ci);
                            self.dyn_texts[di].has_ref = true;
                            break;
                        }
                    }
                }
            }
        }

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{fields.items});
    }

    fn collectTextContent(self: *Generator) []const u8 {
        // Collect text between tags — scan source directly between current pos and next tag
        const tok = self.cur();
        const start = tok.start;
        // Find the extent: collect tokens that are identifiers, numbers, strings, dots, etc.
        // until we hit a JSX delimiter
        var end = start;
        while (self.curKind() != .lt and self.curKind() != .lt_slash and
            self.curKind() != .lbrace and self.curKind() != .eof)
        {
            end = self.cur().end;
            self.advance_token();
        }
        if (end > start) {
            const raw = self.source[start..end];
            return std.mem.trim(u8, raw, &[_]u8{ ' ', '\t', '\n', '\r' });
        }
        return "";
    }

    fn parseStyleAttr(self: *Generator) ![]const u8 {
        // style={{ key: value, ... }} (JSX) or style: { key: value } (classifier)
        if (self.curKind() == .lbrace) self.advance_token(); // first {
        // Only eat second { if it's there (JSX double-brace syntax)
        var double_brace = false;
        if (self.curKind() == .lbrace) {
            self.advance_token(); // second {
            double_brace = true;
        }

        var fields: std.ArrayListUnmanaged(u8) = .{};
        

        while (self.curKind() != .rbrace and self.curKind() != .eof) {
            if (self.curKind() == .identifier or self.curKind() == .string) {
                // Get key — identifiers directly, strings with quote stripping
                var key = self.curText();
                const is_string_key = self.curKind() == .string;
                self.advance_token();

                // Strip quotes from string keys ('background-color' → background-color)
                if (is_string_key and key.len >= 2) {
                    key = key[1 .. key.len - 1];
                }

                // Normalize CSS kebab-case to camelCase (background-color → backgroundColor)
                if (std.mem.indexOf(u8, key, "-") != null) {
                    key = kebabToCamel(self.alloc, key) catch key;
                }

                if (self.curKind() == .colon) self.advance_token();

                // Get value — route through the appropriate handler
                // Color properties — check for dynamic (state-dependent) values
                if (mapColorKey(key)) |color_field| {
                    if (self.isStateDependentStyleValue()) {
                        // Dynamic color expression (e.g., active ? '#4ec9b0' : '#2d2d3d')
                        self.emit_colors_as_rgb = true;
                        const expr = try self.emitStateExpr();
                        self.emit_colors_as_rgb = false;
                        if (self.pending_dyn_style_count < 16) {
                            self.pending_dyn_styles[self.pending_dyn_style_count] = .{
                                .field = color_field,
                                .expression = expr,
                            };
                            self.pending_dyn_style_count += 1;
                        }
                        // Placeholder in static struct
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, color_field);
                        try fields.appendSlice(self.alloc, " = Color.rgb(0, 0, 0)");
                    } else {
                        const val = try self.parseStringAttrInline();
                        const color = try self.parseColorValue(val);
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, color_field);
                        try fields.appendSlice(self.alloc, " = ");
                        try fields.appendSlice(self.alloc, color);
                    }
                } else if (mapStyleKeyI16(key)) |zig_key| {
                    const val = self.curText();
                    self.advance_token();
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, zig_key);
                    try fields.appendSlice(self.alloc, " = ");
                    try fields.appendSlice(self.alloc, val);
                } else if (mapStyleKey(key)) |zig_key| {
                    // Numeric style property — handle bare numbers and CSS unit strings
                    // Percentages are encoded as negative values: 50% → -0.5
                    if (self.curKind() == .string) {
                        const str_val = try self.parseStringAttrInline();
                        if (std.mem.endsWith(u8, str_val, "%")) {
                            // Percentage: "50%" → -0.5 (negative = percentage encoding)
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
                    } else if (self.isStateDependentStyleValue()) {
                        // Dynamic numeric expression (e.g., count * 20, active ? 1.0 : 0.5)
                        self.emit_float_as_f32 = true;
                        const expr = try self.emitStateExpr();
                        self.emit_float_as_f32 = false;
                        if (self.pending_dyn_style_count < 16) {
                            self.pending_dyn_styles[self.pending_dyn_style_count] = .{
                                .field = zig_key,
                                .expression = expr,
                            };
                            self.pending_dyn_style_count += 1;
                        }
                        // Placeholder in static struct
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = 0");
                    } else {
                        const val = self.curText();
                        self.advance_token();
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = ");
                        // Check if value is an animation variable — emit placeholder
                        if (self.isAnimVar(val)) |anim_idx| {
                            try fields.appendSlice(self.alloc, "0");
                            if (self.pending_anim_count < 8) {
                                self.pending_anim[self.pending_anim_count] = .{
                                    .anim_idx = anim_idx,
                                    .style_field = zig_key,
                                };
                                self.pending_anim_count += 1;
                            }
                        } else {
                            try fields.appendSlice(self.alloc, val);
                        }
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
                    // Unknown style key — skip value
                    self.skipStyleValue();
                }
            }
            if (self.curKind() == .comma) self.advance_token();
        }

        if (self.curKind() == .rbrace) self.advance_token(); // }
        if (double_brace and self.curKind() == .rbrace) self.advance_token(); // second }

        return try self.alloc.dupe(u8, fields.items);
    }

    fn skipStyleValue(self: *Generator) void {
        // Skip a style value: number, string, or expression
        if (self.curKind() == .string or self.curKind() == .number or self.curKind() == .identifier) {
            self.advance_token();
        }
    }

    fn parseStringAttr(self: *Generator) ![]const u8 {
        // Parse ="string" or ={"string"}
        if (self.curKind() == .string) {
            const tok = self.cur();
            const raw = tok.text(self.source);
            self.advance_token();
            // Strip quotes
            return raw[1 .. raw.len - 1];
        }
        if (self.curKind() == .lbrace) {
            self.advance_token();
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
        // Prop or local var reference: backgroundColor: bg → resolve to prop value
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
        // Parse ={number} or ="string" or =number
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
        // Skip a balanced {..} expression
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

    // ── Template literals ───────────────────────────────────────────

    const TemplateResult = struct {
        is_dynamic: bool,
        static_text: []const u8,
        fmt: []const u8,
        args: []const u8,
    };

    fn parseTemplateLiteral(self: *Generator) !TemplateResult {
        const tok = self.cur();
        const raw = tok.text(self.source);
        // Strip backticks
        const inner = raw[1 .. raw.len - 1];

        // Check for ${...} patterns
        if (std.mem.indexOf(u8, inner, "${") == null) {
            return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "" };
        }

        // Parse template parts
        var fmt: std.ArrayListUnmanaged(u8) = .{};
        var args: std.ArrayListUnmanaged(u8) = .{};
        var i: usize = 0;
        while (i < inner.len) {
            if (i + 1 < inner.len and inner[i] == '$' and inner[i + 1] == '{') {
                i += 2;
                // Find closing }
                const expr_start = i;
                var depth: u32 = 1;
                while (i < inner.len and depth > 0) {
                    if (inner[i] == '{') depth += 1;
                    if (inner[i] == '}') depth -= 1;
                    if (depth > 0) i += 1;
                }
                const expr = inner[expr_start..i];
                if (i < inner.len) i += 1; // skip }

                // Check if expression is a state variable
                if (self.isState(expr)) |slot_id| {
                    const st = self.stateTypeById(slot_id);
                    const rid = self.regularSlotId(slot_id);
                    switch (st) {
                        .string => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "state.getSlotString({d})", .{rid}));
                        },
                        .float => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "state.getSlotFloat({d})", .{rid}));
                        },
                        .boolean => {
                            try fmt.appendSlice(self.alloc, "{s}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}));
                        },
                        .int => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "state.getSlot({d})", .{rid}));
                        },
                        .array => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "state.getSlot({d})", .{rid}));
                        },
                    }
                } else if (self.findProp(expr)) |pval| {
                    if (pval.len >= 2 and (pval[0] == '"' or pval[0] == '\'')) {
                        try fmt.appendSlice(self.alloc, pval[1 .. pval.len - 1]);
                    } else {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    }
                } else if (self.isLocalVar(expr)) |lv| {
                    // Local variable in template literal
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
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "if ({s}) \"true\" else \"false\"", .{lv.expr}));
                        },
                        else => {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, lv.expr);
                        },
                    }
                } else if (self.map_item_param != null and std.mem.eql(u8, expr, self.map_item_param.?)) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "_item");
                } else if (self.map_index_param != null and std.mem.eql(u8, expr, self.map_index_param.?)) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "_i");
                } else if (std.mem.startsWith(u8, expr, "getRowText(")) {
                    // PTY built-in: getRowText(N) → vterm_mod.getRowText(N)
                    const arg_start = "getRowText(".len;
                    const arg_end = std.mem.indexOf(u8, expr[arg_start..], ")") orelse expr.len - arg_start;
                    const arg_expr = expr[arg_start .. arg_start + arg_end];
                    try fmt.appendSlice(self.alloc, "{s}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    // Check if arg is map index param
                    if (self.map_index_param != null and std.mem.eql(u8, arg_expr, self.map_index_param.?)) {
                        try args.appendSlice(self.alloc, "vterm_mod.getRowText(@intCast(_i))");
                    } else if (self.map_item_param != null and std.mem.eql(u8, arg_expr, self.map_item_param.?)) {
                        try args.appendSlice(self.alloc, "vterm_mod.getRowText(@intCast(_item))");
                    } else {
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "vterm_mod.getRowText({s})", .{arg_expr}));
                    }
                    self.has_pty = true;
                } else if (std.mem.eql(u8, expr, "getCursorRow()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "vterm_mod.getCursorRow()");
                    self.has_pty = true;
                } else if (std.mem.eql(u8, expr, "getCursorCol()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "vterm_mod.getCursorCol()");
                    self.has_pty = true;
                } else if (std.mem.eql(u8, expr, "hasHover()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "@intFromBool(inspector.hasHover())");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getHoverX()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getHoverX()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getHoverY()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getHoverY()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getHoverW()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getHoverW()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getHoverH()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getHoverH()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "hasSelect()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "@intFromBool(inspector.hasSelect())");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getSelectX()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getSelectX()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getSelectY()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getSelectY()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getSelectW()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getSelectW()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "getSelectH()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "inspector.getSelectH()");
                    self.has_inspector = true;
                } else if (std.mem.eql(u8, expr, "isInspectorEnabled()")) {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, "@intFromBool(inspector.isEnabled())");
                    self.has_inspector = true;
                } else if (std.mem.indexOf(u8, expr, "[")) |bracket_pos| {
                    // Array indexing: items[0] or items[i]
                    const arr_name = expr[0..bracket_pos];
                    const idx_end = std.mem.indexOf(u8, expr[bracket_pos + 1 ..], "]") orelse (expr.len - bracket_pos - 1);
                    const idx_expr = expr[bracket_pos + 1 .. bracket_pos + 1 + idx_end];
                    if (self.isArrayState(arr_name)) |state_idx| {
                        const arr_slot = self.arraySlotId(state_idx);
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "state.getArrayElement({d}, @intCast({s}))", .{ arr_slot, idx_expr }));
                    } else {
                        // Unknown array — embed as static text
                        try fmt.appendSlice(self.alloc, expr);
                    }
                } else {
                    // Static expression — just embed the text
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
            };
        }
        return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "" };
    }

    // ── Handler body emission ───────────────────────────────────────

    fn emitHandlerBody(self: *Generator, start: u32, _: u32) ![]const u8 {
        // Parse the handler expression between start..end tokens
        const saved_pos = self.pos;
        self.pos = start;
        defer self.pos = saved_pos;

        // Skip opening {
        if (self.curKind() == .lbrace) self.advance_token();
        // Skip () => or (param) =>
        if (self.curKind() == .lparen) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token(); // skip handler param if present
        if (self.curKind() == .rparen) self.advance_token();
        if (self.curKind() == .arrow) self.advance_token();

        // Multi-statement block: () => { stmt1; stmt2; }
        if (self.curKind() == .lbrace) {
            self.advance_token(); // skip {
            var stmts = std.ArrayListUnmanaged([]const u8){};
            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                const stmt = try self.emitHandlerExpr();
                if (stmt.len > 0) {
                    stmts.append(self.alloc, stmt) catch {};
                }
                // Consume semicolons between statements
                while (self.curKind() == .semicolon) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
            // Join all statements
            if (stmts.items.len == 0) return "";
            if (stmts.items.len == 1) return stmts.items[0];
            var result = std.ArrayListUnmanaged(u8){};
            for (stmts.items, 0..) |s, i| {
                result.appendSlice(self.alloc, s) catch {};
                if (i + 1 < stmts.items.len) {
                    result.appendSlice(self.alloc, "\n    ") catch {};
                }
            }
            return self.alloc.dupe(u8, result.items) catch "";
        }

        // Single expression: () => expr
        return try self.emitHandlerExpr();
    }

    fn emitHandlerExpr(self: *Generator) ![]const u8 {
        if (self.curKind() == .identifier) {
            const name = self.curText();

            // Check for state setter: setCount(...), setItems.push(...), etc.
            if (self.isSetter(name)) |raw_slot_id| {
                const st = self.stateTypeById(raw_slot_id);
                const slot_id = if (st == .array) self.arraySlotId(raw_slot_id) else self.regularSlotId(raw_slot_id);
                self.advance_token(); // skip setter name

                // Array setter: setItems.push(expr)
                if (st == .array and self.curKind() == .dot) {
                    self.advance_token(); // .
                    if (self.isIdent("push")) {
                        self.advance_token(); // push
                        if (self.curKind() == .lparen) self.advance_token();
                        const arg = try self.emitStateExpr();
                        if (self.curKind() == .rparen) self.advance_token();
                        return try std.fmt.allocPrint(self.alloc, "state.pushArraySlot({d}, {s});", .{ slot_id, arg });
                    }
                }

                if (self.curKind() == .lparen) self.advance_token();

                // Check if arg is a crypto built-in: setHash(sha256("hello"))
                if (self.curKind() == .identifier) {
                    const inner_name = self.curText();
                    if (self.cryptoHexSize(inner_name)) |hex_size| {
                        const zig_fn = self.cryptoZigFn(inner_name);
                        const argc = self.cryptoArgCount(inner_name);
                        self.advance_token(); // crypto func name
                        if (self.curKind() == .lparen) self.advance_token();

                        // Parse first arg (string literal or expression)
                        var arg1: []const u8 = "\"\"";
                        if (self.curKind() == .string) {
                            arg1 = self.curText(); // includes quotes
                            self.advance_token();
                        } else if (self.curKind() == .identifier) {
                            const a = self.curText();
                            if (std.mem.eql(u8, a, "getText")) {
                                self.advance_token();
                                if (self.curKind() == .lparen) self.advance_token();
                                const id_t = self.curText();
                                self.advance_token();
                                if (self.curKind() == .rparen) self.advance_token();
                                arg1 = try std.fmt.allocPrint(self.alloc, "input_mod.getText({s})", .{id_t});
                            } else if (self.isState(a)) |inner_slot| {
                                arg1 = try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{self.regularSlotId(inner_slot)});
                                self.advance_token();
                            }
                        }

                        // Parse optional second arg (for HMAC: key, message)
                        var arg2: []const u8 = "";
                        if (argc == 2 and self.curKind() == .comma) {
                            self.advance_token(); // comma
                            if (self.curKind() == .string) {
                                arg2 = self.curText();
                                self.advance_token();
                            }
                        }

                        if (self.curKind() == .rparen) self.advance_token(); // inner )
                        if (self.curKind() == .rparen) self.advance_token(); // outer )

                        self.has_crypto = true;
                        if (argc == 1) {
                            return try std.fmt.allocPrint(self.alloc,
                                "{{ var _ch: [{d}]u8 = undefined; crypto_mod.{s}({s}, &_ch); state.setSlotString({d}, &_ch); }}",
                                .{ hex_size, zig_fn, arg1, slot_id });
                        } else {
                            return try std.fmt.allocPrint(self.alloc,
                                "{{ var _ch: [{d}]u8 = undefined; crypto_mod.{s}({s}, {s}, &_ch); state.setSlotString({d}, &_ch); }}",
                                .{ hex_size, zig_fn, arg1, arg2, slot_id });
                        }
                    }

                    // randomToken(n) / randomId(n)
                    if (std.mem.eql(u8, inner_name, "randomToken") or std.mem.eql(u8, inner_name, "randomId")) {
                        const is_token = std.mem.eql(u8, inner_name, "randomToken");
                        self.advance_token(); // func name
                        if (self.curKind() == .lparen) self.advance_token();
                        var n_arg: []const u8 = "32";
                        if (self.curKind() == .number) {
                            n_arg = self.curText();
                            self.advance_token();
                        }
                        if (self.curKind() == .rparen) self.advance_token(); // inner )
                        if (self.curKind() == .rparen) self.advance_token(); // outer )
                        self.has_crypto = true;
                        if (is_token) {
                            return try std.fmt.allocPrint(self.alloc,
                                "{{ var _cb: [512]u8 = undefined; const _tok = crypto_mod.randomToken({s}, &_cb); state.setSlotString({d}, _tok); }}",
                                .{ n_arg, slot_id });
                        } else {
                            return try std.fmt.allocPrint(self.alloc,
                                "{{ var _cb: [256]u8 = undefined; const _rid = crypto_mod.randomId({s}, &_cb); state.setSlotString({d}, _rid); }}",
                                .{ n_arg, slot_id });
                        }
                    }
                }

                const arg = try self.emitStateExpr();
                if (self.curKind() == .rparen) self.advance_token();
                // Dispatch setter based on state type (st computed at top of isSetter block)
                return switch (st) {
                    .string => try std.fmt.allocPrint(self.alloc, "state.setSlotString({d}, {s});", .{ slot_id, arg }),
                    .float => try std.fmt.allocPrint(self.alloc, "state.setSlotFloat({d}, {s});", .{ slot_id, arg }),
                    .boolean => try std.fmt.allocPrint(self.alloc, "state.setSlotBool({d}, {s});", .{ slot_id, arg }),
                    else => try std.fmt.allocPrint(self.alloc, "state.setSlot({d}, {s});", .{ slot_id, arg }),
                };
            }

            // navigate('/path') → router.push("/path")
            if (std.mem.eql(u8, name, "navigate")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const path = try self.parseStringAttrInline();
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "router.push(\"{s}\");", .{path});
            }

            // FFI function: time(0) → ffi.time(null)
            if (self.isFFIFunc(name)) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                var ffi_args: std.ArrayListUnmanaged(u8) = .{};
                while (self.curKind() != .rparen and self.curKind() != .eof) {
                    if (self.curKind() == .number) {
                        const val = self.curText();
                        if (std.mem.eql(u8, val, "0")) {
                            try ffi_args.appendSlice(self.alloc, "null");
                        } else {
                            try ffi_args.appendSlice(self.alloc, val);
                        }
                    } else if (self.curKind() == .string) {
                        try ffi_args.appendSlice(self.alloc, self.curText());
                    }
                    self.advance_token();
                    if (self.curKind() == .comma) {
                        try ffi_args.appendSlice(self.alloc, ", ");
                        self.advance_token();
                    }
                }
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "_ = ffi.{s}({s});", .{ name, ffi_args.items });
            }

            // getText(id) — retrieve text from input by numeric ID
            if (std.mem.eql(u8, name, "getText")) {
                self.advance_token(); // getText
                if (self.curKind() == .lparen) self.advance_token(); // (
                const id_text = self.curText(); // numeric literal ID
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token(); // )
                return try std.fmt.allocPrint(self.alloc, "input_mod.getText({s})", .{id_text});
            }

            // Built-in functions
            if (std.mem.eql(u8, name, "playVideo")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const path = try self.parseStringAttrInline();
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "mpv_mod.play(\"{s}\");", .{path});
            }
            if (std.mem.eql(u8, name, "stopVideo")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "mpv_mod.stop();");
            }
            if (std.mem.eql(u8, name, "pauseVideo")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "mpv_mod.setPaused(true);");
            }
            if (std.mem.eql(u8, name, "resumeVideo")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "mpv_mod.setPaused(false);");
            }
            if (std.mem.eql(u8, name, "openWindow")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const idx = self.curText();
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "_openWindow{s}();", .{idx});
            }
            if (std.mem.eql(u8, name, "leakMemory")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "state.setSlot(0, leaktest.leak64());");
            }
            // ── PTY / VTerm / Classifier built-ins ─────────────────────
            if (std.mem.eql(u8, name, "spawnPty")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const shell = try self.parseStringAttrInline();
                if (self.curKind() == .comma) self.advance_token();
                const rows_arg = self.curText();
                self.advance_token();
                if (self.curKind() == .comma) self.advance_token();
                const cols_arg = self.curText();
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try std.fmt.allocPrint(self.alloc, "{{ pty_mod.spawn(\"{s}\", {s}, {s}); vterm_mod.initVterm({s}, {s}); }}", .{ shell, rows_arg, cols_arg, rows_arg, cols_arg });
            }
            if (std.mem.eql(u8, name, "pollPty")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try self.alloc.dupe(u8, "_ = pty_mod.poll();");
            }
            if (std.mem.eql(u8, name, "writePty")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const arg = try self.parseStringAttrInline();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try std.fmt.allocPrint(self.alloc, "pty_mod.writePty(\"{s}\");", .{arg});
            }
            if (std.mem.eql(u8, name, "writePtyByte")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const val = self.curText();
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try std.fmt.allocPrint(self.alloc, "pty_mod.writeByte({s});", .{val});
            }
            if (std.mem.eql(u8, name, "writePtyEscape")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const seq = try self.parseStringAttrInline();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try std.fmt.allocPrint(self.alloc, "pty_mod.writeEscape(\"{s}\");", .{seq});
            }
            if (std.mem.eql(u8, name, "resizePty")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const rows_arg = self.curText();
                self.advance_token();
                if (self.curKind() == .comma) self.advance_token();
                const cols_arg = self.curText();
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try std.fmt.allocPrint(self.alloc, "pty_mod.resizePty({s}, {s});", .{ rows_arg, cols_arg });
            }
            if (std.mem.eql(u8, name, "closePty")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try self.alloc.dupe(u8, "pty_mod.closePty();");
            }
            if (std.mem.eql(u8, name, "handleTerminalKey")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                self.has_pty = true;
                return try self.alloc.dupe(u8, "pty_mod.handleKey(_key, _mods);");
            }
            if (std.mem.eql(u8, name, "console")) {
                // console.log(...)
                self.advance_token(); // console
                if (self.curKind() == .dot) self.advance_token();
                if (self.curKind() == .identifier) self.advance_token(); // log
                if (self.curKind() == .lparen) self.advance_token();
                var msg: []const u8 = "debug";
                if (self.curKind() == .string) {
                    const raw = self.curText();
                    msg = raw[1 .. raw.len - 1];
                    self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "std.debug.print(\"{s}\\n\", .{{}});", .{msg});
            }
        }

        return try self.alloc.dupe(u8, "std.debug.print(\"[handler]\\n\", .{});");
    }

    fn emitStateExpr(self: *Generator) ![]const u8 {
        return try self.emitTernary();
    }

    fn emitTernary(self: *Generator) ![]const u8 {
        const cond = try self.emitLogicalOr();
        if (self.curKind() == .question) {
            self.advance_token(); // skip ?
            const then_val = try self.emitTernary(); // right-associative
            if (self.curKind() != .colon) {
                std.debug.print("[tsz] Ternary missing ':' at pos {d}\n", .{self.pos});
                return error.ExpectedColonInTernary;
            }
            self.advance_token(); // skip :
            const else_val = try self.emitTernary();
            // Wrap condition with != 0 for i64 state values (Zig requires bool in if)
            // Conditions from comparisons/equality are already bool and `bool != 0` doesn't compile,
            // so only wrap when the condition is a plain state getter or numeric expression.
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

    fn emitAdditive(self: *Generator) ![]const u8 {
        var left = try self.emitMultiplicative();
        while (self.curKind() == .plus or self.curKind() == .minus) {
            const op = self.curText();
            self.advance_token();
            const right = try self.emitMultiplicative();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitMultiplicative(self: *Generator) ![]const u8 {
        var left = try self.emitUnary();
        while (self.curKind() == .star or self.curKind() == .slash or
            self.curKind() == .percent)
        {
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
        return try self.emitStateAtom();
    }

    fn emitStateAtom(self: *Generator) anyerror![]const u8 {
        // Parenthesized expression
        if (self.curKind() == .lparen) {
            self.advance_token(); // (
            const inner = try self.emitStateExpr();
            if (self.curKind() == .rparen) self.advance_token(); // )
            return try std.fmt.allocPrint(self.alloc, "({s})", .{inner});
        }
        // Number literal
        if (self.curKind() == .number) {
            const val = self.curText();
            self.advance_token();
            // In animation target context, annotate float literals to avoid comptime_float
            if (self.emit_float_as_f32 and std.mem.indexOf(u8, val, ".") != null) {
                return try std.fmt.allocPrint(self.alloc, "@as(f32, {s})", .{val});
            }
            return val;
        }
        // String literal — convert single quotes to double quotes for Zig
        if (self.curKind() == .string) {
            const val = self.curText();
            self.advance_token();
            if (val.len >= 2 and val[0] == '\'') {
                const inner = val[1 .. val.len - 1];
                // In color expression context, convert hex strings to Color.rgb()
                if (self.emit_colors_as_rgb and inner.len > 0 and (inner[0] == '#' or namedColor(inner) != null)) {
                    return try self.parseColorValue(inner);
                }
                // Convert 'text' → "text"
                return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{inner});
            }
            // Double-quoted string — also check for color conversion
            if (self.emit_colors_as_rgb and val.len >= 2 and val[0] == '"') {
                const inner = val[1 .. val.len - 1];
                if (inner.len > 0 and (inner[0] == '#' or namedColor(inner) != null)) {
                    return try self.parseColorValue(inner);
                }
            }
            return val;
        }
        if (self.curKind() == .identifier) {
            const name = self.curText();
            // Boolean literals
            if (std.mem.eql(u8, name, "true") or std.mem.eql(u8, name, "false")) {
                self.advance_token();
                return name;
            }
            // Array state getter: items.length
            if (self.isArrayState(name)) |state_idx| {
                self.advance_token();
                if (self.curKind() == .lbracket) {
                    self.advance_token(); // [
                    const index_expr = try self.emitStateExpr();
                    if (self.curKind() == .rbracket) self.advance_token(); // ]
                    const arr_slot = self.arraySlotId(state_idx);
                    return try std.fmt.allocPrint(self.alloc, "@as(i64, state.getArrayElement({d}, @intCast({s})))", .{ arr_slot, index_expr });
                }
                if (self.curKind() == .dot) {
                    self.advance_token(); // .
                    if (self.isIdent("length")) {
                        self.advance_token(); // length
                        const arr_slot = self.arraySlotId(state_idx);
                        return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(state.getArrayLen({d})))", .{arr_slot});
                    }
                }
                // Array getter without .length — return count as i64
                const arr_slot = self.arraySlotId(state_idx);
                return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(state.getArrayLen({d})))", .{arr_slot});
            }
            // State getter
            if (self.isState(name)) |slot_id| {
                self.advance_token();
                const rid = self.regularSlotId(slot_id);
                // In animation target context, use float getter (getSlot returns i64, can't @floatCast)
                if (self.emit_float_as_f32) {
                    return try std.fmt.allocPrint(self.alloc, "@as(f32, @floatCast(state.getSlotFloat({d})))", .{rid});
                }
                return try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid});
            }
            // Component prop (compile-time substitution from call site)
            if (self.findProp(name)) |val| {
                self.advance_token();
                // String prop values: strip quotes for Zig string literal
                if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                    return val;
                }
                return val;
            }
            // Local variable (compile-time substitution)
            if (self.isLocalVar(name)) |lv| {
                self.advance_token();
                return try self.alloc.dupe(u8, lv.expr);
            }
            // FFI call in expression position
            // NOTE: Intentionally narrow — only bare numbers and 0→null mapping.
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
            // Telemetry getters (expression position)
            if (std.mem.eql(u8, name, "getFps")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "@as(f64, @floatCast(telemetry.getFps()))");
            }
            if (std.mem.eql(u8, name, "getLayoutMs")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "@as(f64, @floatCast(telemetry.getLayoutMs()))");
            }
            if (std.mem.eql(u8, name, "getPaintMs")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "@as(f64, @floatCast(telemetry.getPaintMs()))");
            }
            if (std.mem.eql(u8, name, "getNodeCount")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "@as(i64, @intCast(telemetry.getNodeCount()))");
            }
            if (std.mem.eql(u8, name, "getRssMb")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try self.alloc.dupe(u8, "@as(i64, @intCast(telemetry.getRssMb()))");
            }
            if (std.mem.eql(u8, name, "getFrameTime")) {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const idx_text = self.curText();
                self.advance_token();
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "@as(f64, @floatCast(telemetry.getFrameTime({s})))", .{idx_text});
            }
            // Inspector getters (expression position for dynamic styles)
            {
                const inspector_f32 = [_]struct { tsz: []const u8, zig: []const u8 }{
                    .{ .tsz = "getHoverX", .zig = "inspector.getHoverX()" },
                    .{ .tsz = "getHoverY", .zig = "inspector.getHoverY()" },
                    .{ .tsz = "getHoverW", .zig = "inspector.getHoverW()" },
                    .{ .tsz = "getHoverH", .zig = "inspector.getHoverH()" },
                    .{ .tsz = "getSelectX", .zig = "inspector.getSelectX()" },
                    .{ .tsz = "getSelectY", .zig = "inspector.getSelectY()" },
                    .{ .tsz = "getSelectW", .zig = "inspector.getSelectW()" },
                    .{ .tsz = "getSelectH", .zig = "inspector.getSelectH()" },
                };
                for (inspector_f32) |entry| {
                    if (std.mem.eql(u8, name, entry.tsz)) {
                        self.advance_token();
                        if (self.curKind() == .lparen) self.advance_token();
                        if (self.curKind() == .rparen) self.advance_token();
                        self.has_inspector = true;
                        return try self.alloc.dupe(u8, entry.zig);
                    }
                }
                const inspector_bool = [_]struct { tsz: []const u8, zig: []const u8 }{
                    .{ .tsz = "hasHover", .zig = "inspector.hasHover()" },
                    .{ .tsz = "hasSelect", .zig = "inspector.hasSelect()" },
                    .{ .tsz = "isInspectorEnabled", .zig = "inspector.isEnabled()" },
                };
                for (inspector_bool) |entry| {
                    if (std.mem.eql(u8, name, entry.tsz)) {
                        self.advance_token();
                        if (self.curKind() == .lparen) self.advance_token();
                        if (self.curKind() == .rparen) self.advance_token();
                        self.has_inspector = true;
                        return try self.alloc.dupe(u8, entry.zig);
                    }
                }
            }
            // Bare identifier
            self.advance_token();
            return name;
        }
        self.advance_token();
        return "0";
    }

    // ── Window element ──────────────────────────────────────────────

    fn emitWindowElement(self: *Generator, title: []const u8, width_str: []const u8, height_str: []const u8, child_exprs: *std.ArrayListUnmanaged([]const u8), style_str: []const u8) ![]const u8 {
        _ = style_str;
        const win_idx = self.window_count;
        const arrays_start: u32 = @intCast(self.array_decls.items.len);

        // Create array for window children
        if (child_exprs.items.len > 0) {
            const arr_name = try std.fmt.allocPrint(self.alloc, "_win{d}_arr_{d}", .{ win_idx, self.array_counter });
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
            try self.array_decls.append(self.alloc, try arr_content.toOwnedSlice(self.alloc));

            const root_expr = try std.fmt.allocPrint(self.alloc, ".{{ .children = &{s} }}", .{arr_name});

            const width = std.fmt.parseInt(u32, width_str, 10) catch 400;
            const height = std.fmt.parseInt(u32, height_str, 10) catch 300;

            self.windows[win_idx] = .{
                .title = title,
                .width = width,
                .height = height,
                .arrays_start = arrays_start,
                .arrays_end = @intCast(self.array_decls.items.len),
                .root_expr = root_expr,
            };
            self.window_count += 1;
        }

        // Return invisible placeholder in main tree
        self.last_dyn_id = null;
        return try self.alloc.dupe(u8, ".{ .style = .{ .display = .none } }");
    }

    // ── Conditional JSX helpers ────────────────────────────────────

    /// Lookahead: check if tokens from current pos to matching } contain a ? (ternary).
    fn isTernaryAhead(self: *Generator) bool {
        var look = self.pos;
        var brace_depth: u32 = 0;
        var paren_depth: u32 = 0;
        while (look < self.lex.count) {
            const kind = self.lex.get(look).kind;
            if (kind == .lbrace) brace_depth += 1;
            if (kind == .rbrace) {
                if (brace_depth == 0) return false;
                brace_depth -= 1;
            }
            if (kind == .lparen) paren_depth += 1;
            if (kind == .rparen and paren_depth > 0) paren_depth -= 1;
            if (kind == .question and brace_depth == 0 and paren_depth == 0) return true;
            if (kind == .eof) return false;
            look += 1;
        }
        return false;
    }

    /// Lookahead: check if tokens from current pos contain && before ? or }.
    fn isLogicalAndAhead(self: *Generator) bool {
        var look = self.pos;
        var brace_depth: u32 = 0;
        var paren_depth: u32 = 0;
        while (look < self.lex.count) {
            const kind = self.lex.get(look).kind;
            if (kind == .lbrace) brace_depth += 1;
            if (kind == .rbrace) {
                if (brace_depth == 0) return false;
                brace_depth -= 1;
            }
            if (kind == .lparen) paren_depth += 1;
            if (kind == .rparen and paren_depth > 0) paren_depth -= 1;
            if (kind == .amp_amp and brace_depth == 0 and paren_depth == 0) return true;
            if (kind == .question and brace_depth == 0 and paren_depth == 0) return false;
            if (kind == .eof) return false;
            look += 1;
        }
        return false;
    }

    const TernaryResult = struct {
        condition: []const u8,
        true_expr: []const u8,
        false_expr: []const u8,
    };

    const LogicalAndResult = struct {
        condition: []const u8,
        element: []const u8,
    };

    fn parseTernaryJSX(self: *Generator) anyerror!TernaryResult {
        // Parse condition below ternary precedence (stops at ?)
        const condition = try self.emitLogicalOr();

        if (self.curKind() != .question) {
            std.debug.print("[tsz] Expected '?' in ternary at pos {d}\n", .{self.pos});
            return error.ExpectedQuestionInTernary;
        }
        self.advance_token(); // skip ?

        // Skip optional ( around true branch
        if (self.curKind() == .lparen) self.advance_token();

        // Parse true branch — must be a JSX element
        const true_expr = try self.parseJSXElement();

        // Skip optional ) after true branch
        if (self.curKind() == .rparen) self.advance_token();

        // Expect : token
        if (self.curKind() != .colon) {
            std.debug.print("[tsz] Ternary missing ':' at pos {d}\n", .{self.pos});
            return error.ExpectedColonInTernary;
        }
        self.advance_token(); // skip :

        // Skip optional ( around false branch
        if (self.curKind() == .lparen) self.advance_token();

        // Parse false branch — must be a JSX element
        const false_expr = try self.parseJSXElement();

        // Skip optional ) after false branch
        if (self.curKind() == .rparen) self.advance_token();

        return .{
            .condition = condition,
            .true_expr = true_expr,
            .false_expr = false_expr,
        };
    }

    fn parseLogicalAndJSX(self: *Generator) anyerror!LogicalAndResult {
        // Parse condition below && precedence (stops at &&)
        const condition = try self.emitEquality();

        if (self.curKind() != .amp_amp) {
            std.debug.print("[tsz] Expected '&&' at pos {d}\n", .{self.pos});
            return error.ExpectedLogicalAnd;
        }
        self.advance_token(); // skip &&

        // Skip optional ( around element
        if (self.curKind() == .lparen) self.advance_token();

        // Parse the element
        const element = try self.parseJSXElement();

        // Skip optional ) after element
        if (self.curKind() == .rparen) self.advance_token();

        return .{
            .condition = condition,
            .element = element,
        };
    }

    // ── Map (.map()) parsing ────────────────────────────────────────

    fn isMapAhead(self: *Generator) bool {
        if (self.curKind() != .identifier) return false;
        var look = self.pos + 1;
        if (look >= self.lex.count) return false;
        if (self.lex.get(look).kind != .dot) return false;
        look += 1;
        if (look >= self.lex.count) return false;
        const tok = self.lex.get(look);
        if (tok.kind != .identifier) return false;
        return std.mem.eql(u8, tok.text(self.source), "map");
    }

    fn parseMapExpression(self: *Generator) anyerror![]const u8 {
        const array_name = self.curText();
        const state_idx = self.isArrayState(array_name) orelse {
            self.advance_token();
            return ".{}";
        };

        self.advance_token(); // identifier (items)
        self.advance_token(); // .
        self.advance_token(); // map
        if (self.curKind() == .lparen) self.advance_token(); // (

        // Parse callback params: (item) or (item, index)
        if (self.curKind() == .lparen) self.advance_token(); // (
        const item_param = self.curText();
        self.advance_token(); // item
        var index_param: ?[]const u8 = null;
        if (self.curKind() == .comma) {
            self.advance_token(); // ,
            index_param = self.curText();
            self.advance_token(); // index
        }
        if (self.curKind() == .rparen) self.advance_token(); // )
        if (self.curKind() == .arrow) self.advance_token(); // =>

        // Skip optional ( around JSX
        var had_paren = false;
        if (self.curKind() == .lparen) {
            self.advance_token();
            had_paren = true;
        }

        // Set map context for template literal parsing
        self.map_item_param = item_param;
        self.map_index_param = index_param;

        // Parse the JSX template
        const template = try self.parseMapTemplate();

        // Clear map context
        self.map_item_param = null;
        self.map_index_param = null;

        // Skip optional ) after JSX
        if (had_paren and self.curKind() == .rparen) self.advance_token();

        // Skip ) closing map call
        if (self.curKind() == .rparen) self.advance_token();

        // Record map info
        if (self.map_count < MAX_MAPS) {
            self.maps[self.map_count] = .{
                .array_slot_id = self.arraySlotId(state_idx),
                .item_param = item_param,
                .index_param = index_param,
                .parent_arr_name = "",
                .child_idx = 0,
                .outer_style = template.outer_style,
                .outer_font_size = template.outer_font_size,
                .outer_text_color = template.outer_text_color,
                .inner_nodes = template.inner_nodes,
                .inner_count = template.inner_count,
                .is_self_closing = template.is_self_closing,
                .is_text_element = template.is_text_element,
            };
            self.map_count += 1;
        }

        return ".{}";
    }

    fn parseMapTemplate(self: *Generator) anyerror!MapTemplateResult {
        if (self.curKind() != .lt) return .{
            .outer_style = "", .outer_font_size = "", .outer_text_color = "",
            .inner_nodes = undefined, .inner_count = 0,
            .is_self_closing = true, .is_text_element = false,
        };
        self.advance_token(); // <

        const tag = self.curText();
        const is_text = std.mem.eql(u8, tag, "Text");
        self.advance_token(); // tag name

        var style_str: []const u8 = "";
        var font_size: []const u8 = "";
        var text_color: []const u8 = "";
        var is_self_closing = false;

        // Parse attributes
        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token(); // =
                    if (std.mem.eql(u8, attr, "style")) {
                        style_str = try self.parseStyleAttr();
                    } else if (std.mem.eql(u8, attr, "fontSize")) {
                        if (self.curKind() == .lbrace) self.advance_token();
                        font_size = self.curText();
                        self.advance_token();
                        if (self.curKind() == .rbrace) self.advance_token();
                    } else if (std.mem.eql(u8, attr, "color")) {
                        const hex = try self.parseStringAttr();
                        text_color = try self.parseColorValue(hex);
                    } else {
                        try self.skipAttrValue();
                    }
                }
            } else {
                self.advance_token();
            }
        }

        if (self.curKind() == .slash_gt) {
            self.advance_token();
            is_self_closing = true;
        } else {
            if (self.curKind() == .gt) self.advance_token();
        }

        var inner_nodes: [8]MapInnerNode = undefined;
        var inner_count: u32 = 0;

        if (!is_self_closing) {
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    const child = try self.parseMapTemplateChild();
                    if (inner_count < 8) {
                        inner_nodes[inner_count] = child;
                        inner_count += 1;
                    }
                } else if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    if (self.curKind() == .template_literal) {
                        const tl = try self.parseTemplateLiteral();
                        self.advance_token(); // template literal token
                        // Text on the outer element itself (Text element case)
                        if (is_text and inner_count < 8) {
                            inner_nodes[inner_count] = .{
                                .font_size = font_size,
                                .text_color = text_color,
                                .text_fmt = tl.fmt,
                                .text_args = tl.args,
                                .is_dynamic_text = tl.is_dynamic,
                                .static_text = if (!tl.is_dynamic) tl.static_text else "",
                                .style = "",
                            };
                            inner_count += 1;
                        }
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else {
                    self.advance_token();
                }
            }
            // Skip closing tag
            if (self.curKind() == .lt_slash) self.advance_token();
            if (self.curKind() == .identifier) self.advance_token();
            if (self.curKind() == .gt) self.advance_token();
        }

        return .{
            .outer_style = style_str,
            .outer_font_size = font_size,
            .outer_text_color = text_color,
            .inner_nodes = inner_nodes,
            .inner_count = inner_count,
            .is_self_closing = is_self_closing,
            .is_text_element = is_text,
        };
    }

    fn parseMapTemplateChild(self: *Generator) anyerror!MapInnerNode {
        self.advance_token(); // <
        self.advance_token(); // tag name

        var font_size: []const u8 = "";
        var text_color: []const u8 = "";
        var style_str: []const u8 = "";
        var is_self_closing = false;

        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token();
                    if (std.mem.eql(u8, attr, "style")) {
                        style_str = try self.parseStyleAttr();
                    } else if (std.mem.eql(u8, attr, "fontSize")) {
                        if (self.curKind() == .lbrace) self.advance_token();
                        font_size = self.curText();
                        self.advance_token();
                        if (self.curKind() == .rbrace) self.advance_token();
                    } else if (std.mem.eql(u8, attr, "color")) {
                        const hex = try self.parseStringAttr();
                        text_color = try self.parseColorValue(hex);
                    } else {
                        try self.skipAttrValue();
                    }
                }
            } else {
                self.advance_token();
            }
        }

        if (self.curKind() == .slash_gt) {
            self.advance_token();
            is_self_closing = true;
        } else {
            if (self.curKind() == .gt) self.advance_token();
        }

        var text_fmt: []const u8 = "";
        var text_args: []const u8 = "";
        var is_dynamic_text = false;
        var static_text: []const u8 = "";

        if (!is_self_closing) {
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    if (self.curKind() == .template_literal) {
                        const tl = try self.parseTemplateLiteral();
                        self.advance_token();
                        if (tl.is_dynamic) {
                            is_dynamic_text = true;
                            text_fmt = tl.fmt;
                            text_args = tl.args;
                        } else {
                            static_text = tl.static_text;
                        }
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else if (self.curKind() != .lt_slash) {
                    const raw = self.collectTextContent();
                    if (raw.len > 0) static_text = raw;
                }
            }
            if (self.curKind() == .lt_slash) self.advance_token();
            if (self.curKind() == .identifier) self.advance_token();
            if (self.curKind() == .gt) self.advance_token();
        }

        return .{
            .font_size = font_size,
            .text_color = text_color,
            .text_fmt = text_fmt,
            .text_args = text_args,
            .is_dynamic_text = is_dynamic_text,
            .static_text = static_text,
            .style = style_str,
        };
    }

    // ── Route element parsing ──────────────────────────────────────

    fn parseRouteElement(self: *Generator) anyerror![]const u8 {
        // Prevent intermediate arrays inside this Route's element from
        // accidentally binding route metadata — save and null the marker.
        const saved_bind = self.routes_bind_from;
        self.routes_bind_from = null;
        defer self.routes_bind_from = saved_bind;

        var path: []const u8 = "/";
        var element_expr: []const u8 = ".{}";

        // Parse attributes: path="..." element={<Component />}
        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const attr_name = self.curText();
                self.advance_token();
                if (self.curKind() == .equals) {
                    self.advance_token(); // skip =
                    if (std.mem.eql(u8, attr_name, "path")) {
                        path = try self.parseStringAttr();
                    } else if (std.mem.eql(u8, attr_name, "element")) {
                        // element={<Component />}
                        if (self.curKind() == .lbrace) self.advance_token();
                        element_expr = try self.parseJSXElement();
                        if (self.curKind() == .rbrace) self.advance_token();
                    } else {
                        try self.skipAttrValue();
                    }
                }
            } else {
                self.advance_token();
            }
        }

        // Skip /> or >
        self.advance_token();

        // Signal to parent Routes
        self.last_route_path = path;
        self.has_routes = true;

        return element_expr;
    }

    // ── Color parsing ───────────────────────────────────────────────

    fn parseColorValue(self: *Generator, hex: []const u8) ![]const u8 {
        if (hex.len == 0) return "Color.rgb(255, 255, 255)";

        // Check named CSS colors first
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

    // ── Style key mapping ───────────────────────────────────────────

    const EnumMapping = struct {
        field: []const u8,
        prefix: []const u8,
    };

    // ── Runtime fragment emission ─────────────────────────────────────

    fn emitRuntimeFragment(self: *Generator, root_expr: []const u8) ![]const u8 {
        var out: std.ArrayListUnmanaged(u8) = .{};

        // Self-describing header
        const basename = std.fs.path.basename(self.input_file);
        try out.appendSlice(self.alloc, "//! ──── GENERATED FILE — DO NOT EDIT ────\n//!\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "//! Source: {s}\n", .{self.input_file}));
        try out.appendSlice(self.alloc, "//! Generated by: tsz compile-runtime\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "//!\n//! To regenerate: tsz compile-runtime {s}\n", .{self.input_file}));
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "//! To modify: edit {s} and recompile\n\n", .{basename}));

        // Imports — relative paths (fragment lives in runtime/compiled/framework/)
        try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
        try out.appendSlice(self.alloc, "const layout = @import(\"../../layout.zig\");\n");
        try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n");
        try out.appendSlice(self.alloc, "const gpu = @import(\"../../gpu.zig\");\n");
        if (self.has_state) try out.appendSlice(self.alloc, "const state = @import(\"../../state.zig\");\n");
        if (self.dyn_count > 0 or self.has_state) {
            try out.appendSlice(self.alloc, "const text_mod = @import(\"../../text.zig\");\n");
            try out.appendSlice(self.alloc, "const TextEngine = text_mod.TextEngine;\n");
        }
        if (self.has_inspector) try out.appendSlice(self.alloc, "const inspector = @import(\"../../framework/inspector/panel.zig\");\n");
        if (self.anim_hook_count > 0) try out.appendSlice(self.alloc, "const animate = @import(\"../../animate.zig\");\n");

        // FFI imports
        if (self.ffi_headers.items.len > 0) {
            try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
            for (self.ffi_headers.items) |h| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
            }
            try out.appendSlice(self.alloc, "});\n");
        }

        // State slot base offset
        try out.appendSlice(self.alloc, "\n// ── State slots (offset by caller) ──────────────────────────\n");
        try out.appendSlice(self.alloc, "var slot_base: usize = 0;\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "pub const SLOT_COUNT: usize = {d};\n\n", .{self.state_count}));

        // Node tree arrays
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
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _dyn_buf_{d}: [256]u8 = undefined;\nvar _dyn_text_{d}: []const u8 = \"\";\n", .{ i, i }));
            }
        }

        // Handler functions
        if (self.handler_decls.items.len > 0) {
            try out.appendSlice(self.alloc, "\n// ── Generated event handlers ────────────────────────────────────\n");
            for (self.handler_decls.items) |h| {
                try out.appendSlice(self.alloc, h);
                try out.appendSlice(self.alloc, "\n\n");
            }
        }

        // Effect timer variables
        if (self.effect_count > 0) {
            for (0..self.effect_count) |i| {
                if (self.effects[i].kind == .interval) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _timer_{d}: u32 = 0;\n", .{i}));
                }
            }
        }

        // Effect functions
        if (self.effect_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Generated effect functions ──────────────────────────────────\n");
            for (0..self.effect_count) |i| {
                const body = try self.emitEffectBody(self.effects[i].body_start);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "fn _effect_{d}() void {{\n{s}\n}}\n\n", .{ i, body }));
            }
        }

        // updateDynamicTexts
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "fn updateDynamicTexts() void {\n");
            for (0..self.dyn_count) |i| {
                const dt = self.dyn_texts[i];
                if (dt.has_ref) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n    {s}[{d}].text = _dyn_text_{d};\n",
                        .{ i, i, dt.fmt_string, dt.fmt_args, dt.arr_name, dt.arr_index, i }));
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // updateDynamicStyles
        if (self.dyn_style_count > 0) {
            try out.appendSlice(self.alloc, "fn updateDynamicStyles() void {\n");
            for (0..self.dyn_style_count) |i| {
                const ds = self.dyn_styles[i];
                if (!ds.has_ref) continue;
                if (std.mem.eql(u8, ds.arr_name, "root")) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    root.style.{s} = {s};\n",
                        .{ ds.field, ds.expression }));
                } else {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.{s} = {s};\n",
                        .{ ds.arr_name, ds.arr_index, ds.field, ds.expression }));
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // updateConditionals
        if (self.cond_count > 0) {
            try out.appendSlice(self.alloc, "fn updateConditionals() void {\n");
            for (0..self.cond_count) |i| {
                const ci = self.conds[i];
                if (ci.arr_name.len == 0) continue;
                switch (ci.kind) {
                    .show_hide => {
                        const cond_is_bool = std.mem.indexOf(u8, ci.condition, "==") != null or
                            std.mem.indexOf(u8, ci.condition, "!=") != null or
                            std.mem.indexOf(u8, ci.condition, "< ") != null or
                            std.mem.indexOf(u8, ci.condition, "> ") != null or
                            std.mem.indexOf(u8, ci.condition, "<=") != null or
                            std.mem.indexOf(u8, ci.condition, ">=") != null;
                        if (cond_is_bool) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    {s}[{d}].style.display = if ({s}) .flex else .none;\n",
                                .{ ci.arr_name, ci.true_idx, ci.condition }));
                        } else {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    {s}[{d}].style.display = if ({s} != 0) .flex else .none;\n",
                                .{ ci.arr_name, ci.true_idx, ci.condition }));
                        }
                    },
                    .ternary => {
                        const cond_is_bool = std.mem.indexOf(u8, ci.condition, "==") != null or
                            std.mem.indexOf(u8, ci.condition, "!=") != null or
                            std.mem.indexOf(u8, ci.condition, "< ") != null or
                            std.mem.indexOf(u8, ci.condition, "> ") != null or
                            std.mem.indexOf(u8, ci.condition, "<=") != null or
                            std.mem.indexOf(u8, ci.condition, ">=") != null;
                        if (cond_is_bool) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    if ({s}) {{\n", .{ci.condition}));
                        } else {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    if ({s} != 0) {{\n", .{ci.condition}));
                        }
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .flex;\n", .{ ci.arr_name, ci.true_idx }));
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .none;\n", .{ ci.arr_name, ci.false_idx }));
                        try out.appendSlice(self.alloc, "    } else {\n");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .none;\n", .{ ci.arr_name, ci.true_idx }));
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .flex;\n", .{ ci.arr_name, ci.false_idx }));
                        try out.appendSlice(self.alloc, "    }\n");
                    },
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // ── pub fn init(base: usize) ──
        try out.appendSlice(self.alloc, "// ── Public API ──────────────────────────────────────────────────\n\n");
        try out.appendSlice(self.alloc, "pub fn init(base: usize) void {\n");
        try out.appendSlice(self.alloc, "    slot_base = base;\n");
        if (self.has_state) {
            for (0..self.state_count) |i| {
                const slot = self.state_slots[i];
                switch (slot.initial) {
                    .int => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlot({d});\n", .{v})),
                    .float => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotFloat({d});\n", .{v})),
                    .boolean => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotBool({});\n", .{v})),
                    .string => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotString(\"{s}\");\n", .{v})),
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
        if (self.dyn_count > 0) try out.appendSlice(self.alloc, "    updateDynamicTexts();\n");
        if (self.dyn_style_count > 0) try out.appendSlice(self.alloc, "    updateDynamicStyles();\n");
        if (self.cond_count > 0) try out.appendSlice(self.alloc, "    updateConditionals();\n");
        // Mount effects
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .mount) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _effect_{d}();\n", .{i}));
            }
        }
        try out.appendSlice(self.alloc, "}\n\n");

        // ── pub fn tick() ──
        try out.appendSlice(self.alloc, "pub fn tick() void {\n");
        // State dirty check
        if (self.has_state and (self.dyn_count > 0 or self.dyn_style_count > 0 or self.cond_count > 0)) {
            try out.appendSlice(self.alloc, "    if (state.isDirty()) {\n");
            if (self.dyn_count > 0) try out.appendSlice(self.alloc, "        updateDynamicTexts();\n");
            if (self.dyn_style_count > 0) try out.appendSlice(self.alloc, "        updateDynamicStyles();\n");
            if (self.cond_count > 0) try out.appendSlice(self.alloc, "        updateConditionals();\n");
            // Watch effects
            for (0..self.effect_count) |i| {
                if (self.effects[i].kind == .watch) {
                    try out.appendSlice(self.alloc, "        if (");
                    for (0..self.effects[i].dep_count) |d| {
                        if (d > 0) try out.appendSlice(self.alloc, " or ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.slotDirty(slot_base + {d})", .{self.effects[i].dep_slots[d]}));
                    }
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ") {{ _effect_{d}(); }}\n", .{i}));
                }
            }
            try out.appendSlice(self.alloc, "    }\n");
        }
        // Every-frame effects
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .every_frame) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _effect_{d}();\n", .{i}));
            }
        }
        // Inspector-driven style updates (hover rect changes on mouse move)
        if (self.has_inspector and self.dyn_style_count > 0) {
            try out.appendSlice(self.alloc, "    updateDynamicStyles();\n");
        }
        if (self.has_inspector and self.cond_count > 0) {
            try out.appendSlice(self.alloc, "    updateConditionals();\n");
        }
        try out.appendSlice(self.alloc, "}\n\n");

        // ── pub fn getRoot() ──
        try out.appendSlice(self.alloc, "pub fn getRoot() *Node {\n");
        try out.appendSlice(self.alloc, "    return &root;\n");
        try out.appendSlice(self.alloc, "}\n");

        // Post-process: rewrite state slot references to use slot_base offset
        if (self.has_state) {
            const result = try out.toOwnedSlice(self.alloc);
            return try rewriteSlotRefs(self.alloc, result);
        }

        return try out.toOwnedSlice(self.alloc);
    }

    /// Rewrite bare state slot IDs to use slot_base offset in fragment mode.
    /// "state.getSlot(0)" → "state.getSlot(slot_base + 0)"
    /// "state.setSlot(0," → "state.setSlot(slot_base + 0,"
    fn rewriteSlotRefs(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
        const patterns = [_][]const u8{
            "state.getSlot(", "state.setSlot(", "state.getSlotString(", "state.setSlotString(",
            "state.getSlotFloat(", "state.setSlotFloat(", "state.getSlotBool(", "state.setSlotBool(",
            "state.slotDirty(",
        };

        var result: std.ArrayListUnmanaged(u8) = .{};
        var i: usize = 0;
        while (i < input.len) {
            var matched = false;
            for (patterns) |pat| {
                if (i + pat.len <= input.len and std.mem.eql(u8, input[i .. i + pat.len], pat)) {
                    try result.appendSlice(alloc, pat);
                    i += pat.len;
                    // Check if next char is a digit (bare slot ID, not already "slot_base + ")
                    if (i < input.len and input[i] >= '0' and input[i] <= '9') {
                        try result.appendSlice(alloc, "slot_base + ");
                    }
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                try result.append(alloc, input[i]);
                i += 1;
            }
        }
        return try result.toOwnedSlice(alloc);
    }

    // ── Zig source emission ─────────────────────────────────────────

    fn emitZigSource(self: *Generator, root_expr: []const u8) ![]const u8 {
        var out: std.ArrayListUnmanaged(u8) = .{};

        // Header
        try out.appendSlice(self.alloc, "//! Generated by tsz compiler (Zig) — do not edit\n//!\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "//! Source: {s}\n\n", .{std.fs.path.basename(self.input_file)}));

        // Imports
        try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
        try out.appendSlice(self.alloc, "const c = @import(\"c.zig\").imports;\n");
        try out.appendSlice(self.alloc, "const layout = @import(\"layout.zig\");\n");
        try out.appendSlice(self.alloc, "const text_mod = @import(\"text.zig\");\n");
        try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\nconst LayoutRect = layout.LayoutRect;\n");
        try out.appendSlice(self.alloc, "const TextEngine = text_mod.TextEngine;\n");
        try out.appendSlice(self.alloc, "const image_mod = @import(\"image.zig\");\nconst ImageCache = image_mod.ImageCache;\n");
        try out.appendSlice(self.alloc, "const events = @import(\"events.zig\");\n");
        try out.appendSlice(self.alloc, "const mpv_mod = @import(\"mpv.zig\");\n");
        try out.appendSlice(self.alloc, "const win_mgr = @import(\"windows.zig\");\n");
        try out.appendSlice(self.alloc, "const watchdog = @import(\"watchdog.zig\");\n");
        try out.appendSlice(self.alloc, "const bsod = @import(\"bsod.zig\");\n");
        try out.appendSlice(self.alloc, "const leaktest = @import(\"leaktest.zig\");\n");
        try out.appendSlice(self.alloc, "const input_mod = @import(\"input.zig\");\n");
        try out.appendSlice(self.alloc, "const geometry = @import(\"geometry.zig\");\n");
        try out.appendSlice(self.alloc, "const compositor = @import(\"compositor.zig\");\n");
        try out.appendSlice(self.alloc, "const gpu = @import(\"gpu.zig\");\n");
        try out.appendSlice(self.alloc, "const telemetry = @import(\"telemetry.zig\");\n");
        try out.appendSlice(self.alloc, "const inspector = @import(\"framework/inspector/panel.zig\");\n");
        if (self.anim_hook_count > 0) try out.appendSlice(self.alloc, "const animate = @import(\"animate.zig\");\n");
        if (self.has_state) try out.appendSlice(self.alloc, "const state = @import(\"state.zig\");\n");
        if (self.has_routes) try out.appendSlice(self.alloc, "const router = @import(\"router.zig\");\n");
        if (self.has_crypto) try out.appendSlice(self.alloc, "const crypto_mod = @import(\"crypto.zig\");\n");
        if (self.has_pty) {
            try out.appendSlice(self.alloc, "const pty_mod = @import(\"pty.zig\");\n");
            try out.appendSlice(self.alloc, "const vterm_mod = @import(\"vterm.zig\");\n");
            try out.appendSlice(self.alloc, "const classifier_mod = @import(\"classifier.zig\");\n");
        }
        try out.appendSlice(self.alloc, "const testharness = @import(\"testharness.zig\");\n");

        // FFI imports
        if (self.ffi_headers.items.len > 0) {
            try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
            for (self.ffi_headers.items) |h| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
            }
            try out.appendSlice(self.alloc, "});\n");
        }

        // Globals
        try out.appendSlice(self.alloc, "\nvar g_text_engine: ?*TextEngine = null;\nvar g_image_cache: ?*ImageCache = null;\nvar _telem_frame: u32 = 0;\n\n");

        // Measure callbacks
        try out.appendSlice(self.alloc, "fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {\n    if (g_text_engine) |te| { return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap); }\n    return .{};\n}\n\n");
        try out.appendSlice(self.alloc, "fn measureImageCallback(img_path: []const u8) layout.ImageDims {\n    if (g_image_cache) |cache| { if (cache.load(img_path)) |img| { return .{ .width = @floatFromInt(img.width), .height = @floatFromInt(img.height) }; } }\n    return .{};\n}\n\n");

        // Node tree arrays
        try out.appendSlice(self.alloc, "// ── Generated node tree ─────────────────────────────────────────\n");
        for (self.array_decls.items) |decl| {
            try out.appendSlice(self.alloc, decl);
            try out.appendSlice(self.alloc, "\n");
        }
        // root_expr is ".{ ... }" — skip ".{ " prefix (2 chars), result is " ... }"
        // Wrap with "var root = Node{ ... };\n"
        try out.appendSlice(self.alloc, "var root = Node{");
        try out.appendSlice(self.alloc, root_expr[2..]);
        try out.appendSlice(self.alloc, ";\n");

        // Window roots
        for (0..self.window_count) |i| {
            const w = self.windows[i];
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "\n// ── Secondary window {d}: \"{s}\" ─────────\nvar _win{d}_root = Node{{{s};\n", .{ i, w.title, i, w.root_expr[2..] }));
        }

        // Dynamic text buffers
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Dynamic text buffers ─────────────────────────────────────────\n");
            for (0..self.dyn_count) |i| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _dyn_buf_{d}: [256]u8 = undefined;\nvar _dyn_text_{d}: []const u8 = \"\";\n", .{ i, i }));
            }
        }

        // Map pools
        if (self.map_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Map pools ───────────────────────────────────────────────────\n");
            for (0..self.map_count) |mi| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "const MAX_MAP_{d}: usize = 256;\n" ++
                    "var _map_pool_{d}: [MAX_MAP_{d}]Node = [_]Node{{.{{}}}} ** MAX_MAP_{d};\n" ++
                    "var _map_count_{d}: usize = 0;\n",
                    .{ mi, mi, mi, mi, mi }));
                const m = self.maps[mi];
                if (m.inner_count > 0 and !m.is_self_closing) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "var _map_inner_{d}: [MAX_MAP_{d}][{d}]Node = undefined;\n",
                        .{ mi, mi, m.inner_count }));
                }
                var has_dyn_text = false;
                for (0..m.inner_count) |ni| {
                    if (m.inner_nodes[ni].is_dynamic_text) { has_dyn_text = true; break; }
                }
                if (has_dyn_text) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "var _map_text_bufs_{d}: [MAX_MAP_{d}][256]u8 = undefined;\n" ++
                        "var _map_texts_{d}: [MAX_MAP_{d}][]const u8 = [_][]const u8{{\"\"}} ** MAX_MAP_{d};\n",
                        .{ mi, mi, mi, mi, mi }));
                }
            }
        }

        // Handler functions
        if (self.handler_decls.items.len > 0) {
            try out.appendSlice(self.alloc, "\n// ── Generated event handlers ────────────────────────────────────\n");
            for (self.handler_decls.items) |h| {
                try out.appendSlice(self.alloc, h);
                try out.appendSlice(self.alloc, "\n\n");
            }
        }

        // Effect timer variables (module-level)
        if (self.effect_count > 0) {
            var has_any_timer = false;
            for (0..self.effect_count) |i| {
                if (self.effects[i].kind == .interval) { has_any_timer = true; break; }
            }
            if (has_any_timer) {
                try out.appendSlice(self.alloc, "\n// ── Effect timer variables ──────────────────────────────────────\n");
                for (0..self.effect_count) |i| {
                    if (self.effects[i].kind == .interval) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _timer_{d}: u32 = 0;\n", .{i}));
                    }
                }
            }
        }

        // Effect functions
        if (self.effect_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Generated effect functions ──────────────────────────────────\n");
            for (0..self.effect_count) |i| {
                const body = try self.emitEffectBody(self.effects[i].body_start);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "fn _effect_{d}() void {{\n{s}\n}}\n\n", .{ i, body }));
            }
        }

        // updateDynamicTexts
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "fn updateDynamicTexts() void {\n");
            for (0..self.dyn_count) |i| {
                const dt = self.dyn_texts[i];
                if (dt.has_ref) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n    {s}[{d}].text = _dyn_text_{d};\n",
                        .{ i, i, dt.fmt_string, dt.fmt_args, dt.arr_name, dt.arr_index, i }));
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // updateDynamicStyles
        if (self.dyn_style_count > 0) {
            try out.appendSlice(self.alloc, "fn updateDynamicStyles() void {\n");
            for (0..self.dyn_style_count) |i| {
                const ds = self.dyn_styles[i];
                if (!ds.has_ref) continue;
                if (std.mem.eql(u8, ds.arr_name, "root")) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    root.style.{s} = {s};\n",
                        .{ ds.field, ds.expression }));
                } else {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.{s} = {s};\n",
                        .{ ds.arr_name, ds.arr_index, ds.field, ds.expression }));
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // updateConditionals
        if (self.cond_count > 0) {
            try out.appendSlice(self.alloc, "fn updateConditionals() void {\n");
            for (0..self.cond_count) |i| {
                const ci = self.conds[i];
                if (ci.arr_name.len == 0) continue;
                switch (ci.kind) {
                    .show_hide => {
                        const cond_is_bool = std.mem.indexOf(u8, ci.condition, "==") != null or
                            std.mem.indexOf(u8, ci.condition, "!=") != null or
                            std.mem.indexOf(u8, ci.condition, "< ") != null or
                            std.mem.indexOf(u8, ci.condition, "> ") != null or
                            std.mem.indexOf(u8, ci.condition, "<=") != null or
                            std.mem.indexOf(u8, ci.condition, ">=") != null or
                            std.mem.indexOf(u8, ci.condition, "inspector.has") != null or
                            std.mem.indexOf(u8, ci.condition, "inspector.isEnabled") != null;
                        if (cond_is_bool) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    {s}[{d}].style.display = if ({s}) .flex else .none;\n",
                                .{ ci.arr_name, ci.true_idx, ci.condition }));
                        } else {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    {s}[{d}].style.display = if ({s} != 0) .flex else .none;\n",
                                .{ ci.arr_name, ci.true_idx, ci.condition }));
                        }
                    },
                    .ternary => {
                        const cond_is_bool = std.mem.indexOf(u8, ci.condition, "==") != null or
                            std.mem.indexOf(u8, ci.condition, "!=") != null or
                            std.mem.indexOf(u8, ci.condition, "< ") != null or
                            std.mem.indexOf(u8, ci.condition, "> ") != null or
                            std.mem.indexOf(u8, ci.condition, "<=") != null or
                            std.mem.indexOf(u8, ci.condition, ">=") != null or
                            std.mem.indexOf(u8, ci.condition, "inspector.has") != null or
                            std.mem.indexOf(u8, ci.condition, "inspector.isEnabled") != null;
                        if (cond_is_bool) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    if ({s}) {{\n", .{ci.condition}));
                        } else {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "    if ({s} != 0) {{\n", .{ci.condition}));
                        }
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .flex;\n", .{ ci.arr_name, ci.true_idx }));
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .none;\n", .{ ci.arr_name, ci.false_idx }));
                        try out.appendSlice(self.alloc, "    } else {\n");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .none;\n", .{ ci.arr_name, ci.true_idx }));
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].style.display = .flex;\n", .{ ci.arr_name, ci.false_idx }));
                        try out.appendSlice(self.alloc, "    }\n");
                    },
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // _onTextInput — forwards SDL_TEXTINPUT to input module
        // PTY text input is handled via _onKeyDown → handleKey (printable ASCII)
        // to avoid doubling (SDL fires both KEYDOWN and TEXTINPUT for each key)
        {
            try out.appendSlice(self.alloc, "fn _onTextInput(text: [*:0]const u8) void {\n");
            try out.appendSlice(self.alloc, "    input_mod.handleTextInput(text);\n");
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // _onKeyDown — global key dispatch (always called, unlike per-node on_key)
        {
            try out.appendSlice(self.alloc, "fn _onKeyDown(sym: c_int, mods: u16) void {\n");
            if (self.has_pty) {
                try out.appendSlice(self.alloc, "    pty_mod.handleKey(sym, mods);\n");
            } else {
                try out.appendSlice(self.alloc, "    _ = sym; _ = mods;\n");
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        // updateRoutes — display-toggle routing
        if (self.route_count > 0) {
            try out.appendSlice(self.alloc, "fn updateRoutes() void {\n");
            try out.appendSlice(self.alloc, "    const path = router.currentPath();\n");
            // Build patterns array
            try out.appendSlice(self.alloc, "    const patterns = [_][]const u8{ ");
            for (0..self.route_count) |i| {
                if (i > 0) try out.appendSlice(self.alloc, ", ");
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{self.routes[i].path}));
            }
            try out.appendSlice(self.alloc, " };\n");
            try out.appendSlice(self.alloc, "    const best = router.findBestMatch(&patterns, path);\n");
            // Hide all routes
            for (0..self.route_count) |i| {
                const r = self.routes[i];
                if (r.arr_name.len == 0) continue;
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}].style.display = .none;\n", .{ r.arr_name, r.child_idx }));
            }
            // Show matched route
            try out.appendSlice(self.alloc, "    if (best) |idx| {\n        switch (idx) {\n");
            for (0..self.route_count) |i| {
                const r = self.routes[i];
                if (r.arr_name.len == 0) continue;
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "            {d} => {{ {s}[{d}].style.display = .flex; }},\n", .{ i, r.arr_name, r.child_idx }));
            }
            try out.appendSlice(self.alloc, "            else => {},\n        }\n    }\n}\n\n");
        }

        // Map rebuild functions
        if (self.map_count > 0) {
            for (0..self.map_count) |mi| {
                const m = self.maps[mi];
                if (m.parent_arr_name.len == 0) continue;

                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _rebuildMap{d}() void {{\n" ++
                    "    const items = state.getArraySlot({d});\n" ++
                    "    _map_count_{d} = @min(items.len, MAX_MAP_{d});\n" ++
                    "    for (0.._map_count_{d}) |_i| {{\n" ++
                    "        const _item = items[_i];\n",
                    .{ mi, m.array_slot_id, mi, mi, mi }));

                // Find dynamic text in inner nodes
                var has_dyn_text = false;
                var dyn_ni: u32 = 0;
                for (0..m.inner_count) |ni| {
                    if (m.inner_nodes[ni].is_dynamic_text) {
                        has_dyn_text = true;
                        dyn_ni = @intCast(ni);
                        break;
                    }
                }

                if (has_dyn_text) {
                    const inner = m.inner_nodes[dyn_ni];
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "        _map_texts_{d}[_i] = std.fmt.bufPrint(&_map_text_bufs_{d}[_i], \"{s}\", .{{ {s} }}) catch \"\";\n",
                        .{ mi, mi, inner.text_fmt, inner.text_args }));
                }

                // Emit inner children array assignment
                if (m.inner_count > 0 and !m.is_self_closing) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "        _map_inner_{d}[_i] = [{d}]Node{{ ", .{ mi, m.inner_count }));
                    for (0..m.inner_count) |ni| {
                        const inner = m.inner_nodes[ni];
                        if (ni > 0) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, ".{ ");
                        var has_field = false;
                        if (inner.is_dynamic_text) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                ".text = _map_texts_{d}[_i]", .{mi}));
                            has_field = true;
                        } else if (inner.static_text.len > 0) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                ".text = \"{s}\"", .{inner.static_text}));
                            has_field = true;
                        }
                        if (inner.font_size.len > 0) {
                            if (has_field) try out.appendSlice(self.alloc, ", ");
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                ".font_size = {s}", .{inner.font_size}));
                            has_field = true;
                        }
                        if (inner.text_color.len > 0) {
                            if (has_field) try out.appendSlice(self.alloc, ", ");
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                ".text_color = {s}", .{inner.text_color}));
                            has_field = true;
                        }
                        if (inner.style.len > 0) {
                            if (has_field) try out.appendSlice(self.alloc, ", ");
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                ".style = .{{ {s} }}", .{inner.style}));
                        }
                        try out.appendSlice(self.alloc, " }");
                    }
                    try out.appendSlice(self.alloc, " };\n");
                }

                // Emit pool node
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "        _map_pool_{d}[_i] = .{{ ", .{mi}));
                var has_outer_field = false;
                if (m.outer_style.len > 0) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".style = .{{ {s} }}", .{m.outer_style}));
                    has_outer_field = true;
                }
                if (m.is_text_element and m.inner_count > 0) {
                    // Text element: text goes on the outer node directly
                    const inner = m.inner_nodes[0];
                    if (inner.is_dynamic_text) {
                        if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text = _map_texts_{d}[_i]", .{mi}));
                        has_outer_field = true;
                    } else if (inner.static_text.len > 0) {
                        if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text = \"{s}\"", .{inner.static_text}));
                        has_outer_field = true;
                    }
                    if (m.outer_font_size.len > 0) {
                        if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".font_size = {s}", .{m.outer_font_size}));
                        has_outer_field = true;
                    }
                    if (m.outer_text_color.len > 0) {
                        if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text_color = {s}", .{m.outer_text_color}));
                        has_outer_field = true;
                    }
                } else if (m.inner_count > 0 and !m.is_self_closing) {
                    if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".children = &_map_inner_{d}[_i]", .{mi}));
                }
                try out.appendSlice(self.alloc, " };\n");

                // Close for loop
                try out.appendSlice(self.alloc, "    }\n");

                // Update parent children slice
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}].children = _map_pool_{d}[0.._map_count_{d}];\n",
                    .{ m.parent_arr_name, m.child_idx, mi, mi }));

                try out.appendSlice(self.alloc, "}\n\n");
            }
        }

        // Window open helpers
        for (0..self.window_count) |i| {
            const w = self.windows[i];
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "fn _openWindow{d}() void {{\n    if (win_mgr.isRootOpen(&_win{d}_root)) return;\n    if (win_mgr.open(\"{s}\", {d}, {d})) |win_idx| {{ win_mgr.setRoot(win_idx, &_win{d}_root); }}\n}}\n\n",
                .{ i, i, w.title, w.width, w.height, i }));
        }

        // Hover + brighten
        try out.appendSlice(self.alloc, "var hovered_node: ?*Node = null;\n\n");
        try out.appendSlice(self.alloc, "fn brighten(color: Color) Color {\n    return .{ .r = @min(255, @as(u16, color.r) + 30), .g = @min(255, @as(u16, color.g) + 30), .b = @min(255, @as(u16, color.b) + 30), .a = color.a };\n}\n\n");

        // Text selection state
        try out.appendSlice(self.alloc, "var sel_node: ?*Node = null;\nvar sel_end_node: ?*Node = null;\nvar sel_start: usize = 0;\nvar sel_end: usize = 0;\nvar sel_anchor: usize = 0;\nvar sel_dragging: bool = false;\nvar sel_last_click: u32 = 0;\nvar sel_click_count: u32 = 0;\nvar sel_all: bool = false;\nvar sel_paint_state: u8 = 0;\n\n");

        // collectAllText helper for Ctrl+C with sel_all
        try out.appendSlice(self.alloc, "fn collectAllText(node: *Node, buf: []u8, pos: usize) usize {\n    var p = pos;\n    if (node.text) |txt| {\n        if (p > 0 and p < buf.len) { buf[p] = '\\n'; p += 1; }\n        const n = @min(txt.len, buf.len - p);\n        if (n > 0) { @memcpy(buf[p..p+n], txt[0..n]); p += n; }\n    }\n    for (node.children) |*child| { p = collectAllText(child, buf, p); }\n    return p;\n}\n\n");

        // collectSelectedText helper for cross-node Ctrl+C
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

        // Main function
        try out.appendSlice(self.alloc, @embedFile("main_template.txt"));

        // Window geometry restore
        {
            const basename = std.fs.path.basename(self.input_file);
            const app_name = if (std.mem.endsWith(u8, basename, ".tsz")) basename[0 .. basename.len - 4] else basename;
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    geometry.init(\"{s}\");\n" ++
                "    if (geometry.load()) |geom| {{\n" ++
                "        c.SDL_SetWindowPosition(window, geom.x, geom.y);\n" ++
                "        c.SDL_SetWindowSize(window, @intCast(geom.width), @intCast(geom.height));\n" ++
                "        win_w = @floatFromInt(geom.width);\n" ++
                "        win_h = @floatFromInt(geom.height);\n" ++
                "        geometry.blockSaves();\n" ++
                "    }}\n\n", .{app_name}));
        }

        // State init
        if (self.has_state) {
            for (0..self.state_count) |i| {
                const slot = self.state_slots[i];
                switch (slot.initial) {
                    .int => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlot({d});\n", .{v})),
                    .float => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotFloat({d});\n", .{v})),
                    .boolean => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotBool({});\n", .{v})),
                    .string => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    _ = state.createSlotString(\"{s}\");\n", .{v})),
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
            // Dev mode: restore state from previous session + install save-on-signal
            try out.appendSlice(self.alloc, "    _ = state.loadState();\n");
            try out.appendSlice(self.alloc, "    state.installSignalHandler();\n");
        }
        // Register text inputs
        if (self.input_count > 0) {
            for (0..self.input_count) |i| {
                if (i < 16 and self.input_multiline[i]) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input_mod.registerMultiline({d});\n", .{i}));
                } else {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input_mod.register({d});\n", .{i}));
                }
            }
            // Register onChange callbacks
            for (0..self.input_count) |i| {
                if (i < 16) {
                    if (self.input_change_handlers[i]) |handler_name| {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    input_mod.setOnChange({d}, {s});\n", .{ i, handler_name }));
                    }
                }
            }
        }
        if (self.dyn_count > 0) try out.appendSlice(self.alloc, "    updateDynamicTexts();\n");
        if (self.dyn_style_count > 0) try out.appendSlice(self.alloc, "    updateDynamicStyles();\n");
        if (self.cond_count > 0) try out.appendSlice(self.alloc, "    updateConditionals();\n");
        // Mark inspector overlay nodes so hit test skips them
        if (self.has_inspector) {
            var marked: [16]u32 = undefined;
            var marked_count: usize = 0;
            for (0..self.dyn_style_count) |si| {
                const ds = self.dyn_styles[si];
                if (!ds.has_ref) continue;
                if (std.mem.indexOf(u8, ds.expression, "inspector.") != null) {
                    var already = false;
                    for (0..marked_count) |mi| {
                        if (marked[mi] == ds.arr_index) { already = true; break; }
                    }
                    if (!already and marked_count < 16) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    {s}[{d}].devtools_viz = .inspector_overlay;\n",
                            .{ ds.arr_name, ds.arr_index }));
                        marked[marked_count] = ds.arr_index;
                        marked_count += 1;
                    }
                }
            }
        }
        if (self.map_count > 0) {
            for (0..self.map_count) |mi| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    _rebuildMap{d}();\n", .{mi}));
            }
        }
        if (self.has_routes) {
            try out.appendSlice(self.alloc, "    router.init(\"/\");\n");
            try out.appendSlice(self.alloc, "    updateRoutes();\n");
        }

        // Animation slot creation
        if (self.anim_hook_count > 0) {
            try out.appendSlice(self.alloc, "\n    // ── Animation slots ──\n");
            for (0..self.anim_hook_count) |i| {
                const hook = self.anim_hooks[i];
                switch (hook.kind) {
                    .transition => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    _ = animate.createAnim({d}, animate.{s});\n",
                            .{ hook.duration_ms, hook.easing_name }));
                    },
                    .spring => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    _ = animate.createSpring({d}, {d});\n",
                            .{ hook.stiffness, hook.damping }));
                    },
                }
            }
        }

        // Mount effects — run once at init
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .mount) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _effect_{d}();\n", .{i}));
            }
        }
        // Interval timer init
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .interval) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _timer_{d} = c.SDL_GetTicks();\n", .{i}));
            }
        }

        // Compositor + window init + main loop
        try out.appendSlice(self.alloc, "    compositor.init(renderer, &text_engine, &image_cache);\n    defer compositor.deinit();\n");
        try out.appendSlice(self.alloc, "    defer win_mgr.deinitAll();\n    watchdog.init(512);\n");
        if (self.has_pty) {
            try out.appendSlice(self.alloc, "    c.SDL_StartTextInput();\n");
            try out.appendSlice(self.alloc, "    compositor.setOverlay(\"terminal\", vterm_mod.paintTerminal);\n");
            try out.appendSlice(self.alloc, "    defer pty_mod.deinit();\n");
        }
        try out.appendSlice(self.alloc, "    if (testharness.envEnabled()) testharness.enable();\n\n");
        try out.appendSlice(self.alloc, @embedFile("loop_template.txt"));

        // State check in loop (with watch effects)
        {
            var has_watch = false;
            for (0..self.effect_count) |i| {
                if (self.effects[i].kind == .watch) { has_watch = true; break; }
            }
            if (self.has_state and (self.dyn_count > 0 or self.dyn_style_count > 0 or self.cond_count > 0 or has_watch or self.map_count > 0)) {
                try out.appendSlice(self.alloc, "        if (state.isDirty()) {\n");
                if (self.dyn_count > 0) try out.appendSlice(self.alloc, "            updateDynamicTexts();\n");
                if (self.dyn_style_count > 0) try out.appendSlice(self.alloc, "            updateDynamicStyles();\n");
                if (self.cond_count > 0) try out.appendSlice(self.alloc, "            updateConditionals();\n");
                if (self.map_count > 0) {
                    for (0..self.map_count) |mi| {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "            _rebuildMap{d}();\n", .{mi}));
                    }
                }
                // Watch effects — check per-slot dirty before clearDirty
                for (0..self.effect_count) |i| {
                    if (self.effects[i].kind == .watch) {
                        try out.appendSlice(self.alloc, "            if (");
                        for (0..self.effects[i].dep_count) |d| {
                            if (d > 0) try out.appendSlice(self.alloc, " or ");
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.slotDirty({d})", .{self.effects[i].dep_slots[d]}));
                        }
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ") {{ _effect_{d}(); }}\n", .{i}));
                    }
                }
                try out.appendSlice(self.alloc, "            state.clearDirty();\n");
                try out.appendSlice(self.alloc, "        }\n");
            }
        }

        // Inspector: update styles + conditionals every frame (hover rect changes on mouse move, not state)
        if (self.has_inspector and self.dyn_style_count > 0) {
            try out.appendSlice(self.alloc, "        updateDynamicStyles();\n");
        }
        if (self.has_inspector and self.cond_count > 0) {
            try out.appendSlice(self.alloc, "        updateConditionals();\n");
        }

        // Router dirty check
        if (self.has_routes) {
            try out.appendSlice(self.alloc, "        if (router.isDirty()) {\n");
            try out.appendSlice(self.alloc, "            router.clearDirty();\n");
            try out.appendSlice(self.alloc, "            updateRoutes();\n");
            try out.appendSlice(self.alloc, "        }\n");
        }

        // Every-frame effects
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .every_frame) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "        _effect_{d}();\n", .{i}));
            }
        }
        // Interval effects
        for (0..self.effect_count) |i| {
            if (self.effects[i].kind == .interval) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "        {{\n            const _now = c.SDL_GetTicks();\n            if (_now -% _timer_{d} >= {d}) {{ _timer_{d} = _now; _effect_{d}(); }}\n        }}\n",
                    .{ i, self.effects[i].interval_ms, i, i }));
            }
        }

        // Animation tick + style updates
        if (self.anim_hook_count > 0) {
            // Target checks — detect when target value changed, start/retarget animation
            for (0..self.anim_hook_count) |i| {
                const hook = self.anim_hooks[i];
                switch (hook.kind) {
                    .transition => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {{\n            const _target: f32 = @floatCast({s});\n" ++
                            "            if (_target != animate.getAnimTarget({d})) {{\n" ++
                            "                animate.startAnim({d}, @floatCast(animate.getAnimValue({d})), _target);\n" ++
                            "            }}\n        }}\n",
                            .{ hook.target_expr, i, i, i }));
                    },
                    .spring => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        animate.setSpringTarget({d}, @floatCast({s}));\n",
                            .{ i, hook.target_expr }));
                    },
                }
            }
            // Tick all animations
            var has_transitions = false;
            var has_springs = false;
            for (0..self.anim_hook_count) |i| {
                if (self.anim_hooks[i].kind == .transition) has_transitions = true;
                if (self.anim_hooks[i].kind == .spring) has_springs = true;
            }
            if (has_transitions) try out.appendSlice(self.alloc, "        animate.tickAnims(c.SDL_GetTicks());\n");
            if (has_springs) try out.appendSlice(self.alloc, "        animate.tickSprings(0.016);\n");

            // Write animated values to node styles
            for (0..self.anim_binding_count) |bi| {
                const b = self.anim_bindings[bi];
                if (b.arr_name.len == 0) continue; // unresolved
                const getter = if (self.anim_hooks[b.anim_idx].kind == .spring)
                    "animate.getSpringValue"
                else
                    "animate.getAnimValue";
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "        {s}[{d}].style.{s} = @floatCast({s}({d}));\n",
                    .{ b.arr_name, b.arr_index, b.style_field, getter, b.anim_idx }));
            }
        }

        // Layout + paint + present
        try out.appendSlice(self.alloc, "        if (watchdog.check()) {\n            win_mgr.deinitAll();\n            c.SDL_DestroyRenderer(renderer);\n            c.SDL_DestroyWindow(window);\n            bsod.show(watchdog.getLastReason(), watchdog.getLastDetail());\n            return;\n        }\n");
        try out.appendSlice(self.alloc, "        mpv_mod.poll();\n");
        try out.appendSlice(self.alloc, "        telemetry.beginLayout();\n");
        try out.appendSlice(self.alloc, "        layout.layout(&root, 0, 0, win_w, inspector.getAppHeight(win_h));\n");
        try out.appendSlice(self.alloc, "        telemetry.endLayout();\n");
        try out.appendSlice(self.alloc, "        inspector.updateHover(&root, win_w, win_h);\n");
        try out.appendSlice(self.alloc, "        compositor.setHoveredNode(hovered_node);\n");
        try out.appendSlice(self.alloc, "        telemetry.beginPaint();\n");
        try out.appendSlice(self.alloc, "        compositor.frame(&root, win_w, win_h, Color.rgb(24, 24, 32));\n");
        try out.appendSlice(self.alloc, "        telemetry.endPaint();\n");
        try out.appendSlice(self.alloc, "        win_mgr.layoutAll();\n");
        try out.appendSlice(self.alloc, "        win_mgr.paintAndPresent(brighten);\n");
        // Telemetry: count nodes every 30 frames, debug print every 60
        try out.appendSlice(self.alloc, "        _telem_frame +%= 1;\n");
        try out.appendSlice(self.alloc, "        if (_telem_frame % 30 == 0) _ = telemetry.countNodes(&root);\n");
        try out.appendSlice(self.alloc, "        if (_telem_frame % 60 == 0) telemetry.debugPrint();\n");

        // Test harness: after first frame, run tests and exit
        try out.appendSlice(self.alloc,
            "        if (testharness.tick()) {\n" ++
            "            const exit_code = testharness.runAll(&root, renderer);\n" ++
            "            if (exit_code != 0) std.process.exit(exit_code);\n" ++
            "            running = false;\n" ++
            "        }\n");

        try out.appendSlice(self.alloc, "    }\n    geometry.save(window);\n}\n");

        return try out.toOwnedSlice(self.alloc);
    }
};

// ── Style key mappings ──────────────────────────────────────────────────

fn mapStyleKey(key: []const u8) ?[]const u8 {
    const mappings = .{
        .{ "width", "width" },
        .{ "height", "height" },
        .{ "minWidth", "min_width" },
        .{ "maxWidth", "max_width" },
        .{ "minHeight", "min_height" },
        .{ "maxHeight", "max_height" },
        .{ "flexGrow", "flex_grow" },
        .{ "flexShrink", "flex_shrink" },
        .{ "flexBasis", "flex_basis" },
        .{ "gap", "gap" },
        .{ "padding", "padding" },
        .{ "paddingLeft", "padding_left" },
        .{ "paddingRight", "padding_right" },
        .{ "paddingTop", "padding_top" },
        .{ "paddingBottom", "padding_bottom" },
        .{ "margin", "margin" },
        .{ "marginLeft", "margin_left" },
        .{ "marginRight", "margin_right" },
        .{ "marginTop", "margin_top" },
        .{ "marginBottom", "margin_bottom" },
        .{ "borderRadius", "border_radius" },
        .{ "opacity", "opacity" },
        .{ "borderWidth", "border_width" },
        .{ "shadowOffsetX", "shadow_offset_x" },
        .{ "shadowOffsetY", "shadow_offset_y" },
        .{ "shadowBlur", "shadow_blur" },
        .{ "top", "top" },
        .{ "left", "left" },
        .{ "right", "right" },
        .{ "bottom", "bottom" },
        .{ "aspectRatio", "aspect_ratio" },
        .{ "rotation", "rotation" },
        .{ "scaleX", "scale_x" },
        .{ "scaleY", "scale_y" },
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, key, m[0])) return m[1];
    }
    return null;
}

/// Map style keys to i16 fields (zIndex).
fn mapStyleKeyI16(key: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, key, "zIndex")) return "z_index";
    return null;
}

/// Map color style keys to their Zig field names.
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
    if (std.mem.eql(u8, prefix, "fd")) {
        if (std.mem.eql(u8, value, "row")) return ".row";
        if (std.mem.eql(u8, value, "column")) return ".column";
    }
    if (std.mem.eql(u8, prefix, "jc")) {
        if (std.mem.eql(u8, value, "start")) return ".start";
        if (std.mem.eql(u8, value, "center")) return ".center";
        if (std.mem.eql(u8, value, "end")) return ".end_";
        if (std.mem.eql(u8, value, "space-between")) return ".space_between";
        if (std.mem.eql(u8, value, "space-around")) return ".space_around";
        if (std.mem.eql(u8, value, "space-evenly")) return ".space_evenly";
    }
    if (std.mem.eql(u8, prefix, "ai")) {
        if (std.mem.eql(u8, value, "start")) return ".start";
        if (std.mem.eql(u8, value, "center")) return ".center";
        if (std.mem.eql(u8, value, "end")) return ".end_";
        if (std.mem.eql(u8, value, "stretch")) return ".stretch";
    }
    if (std.mem.eql(u8, prefix, "d")) {
        if (std.mem.eql(u8, value, "flex")) return ".flex";
        if (std.mem.eql(u8, value, "none")) return ".none";
    }
    if (std.mem.eql(u8, prefix, "ta")) {
        if (std.mem.eql(u8, value, "left")) return ".left";
        if (std.mem.eql(u8, value, "center")) return ".center";
        if (std.mem.eql(u8, value, "right")) return ".right";
    }
    if (std.mem.eql(u8, prefix, "as")) {
        if (std.mem.eql(u8, value, "auto")) return ".auto";
        if (std.mem.eql(u8, value, "start")) return ".start";
        if (std.mem.eql(u8, value, "center")) return ".center";
        if (std.mem.eql(u8, value, "end")) return ".end_";
        if (std.mem.eql(u8, value, "stretch")) return ".stretch";
    }
    if (std.mem.eql(u8, prefix, "fw")) {
        if (std.mem.eql(u8, value, "nowrap")) return ".nowrap";
        if (std.mem.eql(u8, value, "wrap")) return ".wrap";
    }
    if (std.mem.eql(u8, prefix, "pos")) {
        if (std.mem.eql(u8, value, "relative")) return ".relative";
        if (std.mem.eql(u8, value, "absolute")) return ".absolute";
    }
    if (std.mem.eql(u8, prefix, "ov")) {
        if (std.mem.eql(u8, value, "visible")) return ".visible";
        if (std.mem.eql(u8, value, "hidden")) return ".hidden";
        if (std.mem.eql(u8, value, "scroll")) return ".scroll";
    }
    if (std.mem.eql(u8, prefix, "gd")) {
        if (std.mem.eql(u8, value, "vertical")) return ".vertical";
        if (std.mem.eql(u8, value, "horizontal")) return ".horizontal";
        if (std.mem.eql(u8, value, "none")) return ".none";
    }
    return null;
}

// ── CSS normalization helpers ───────────────────────────────────────────

/// Convert CSS kebab-case to camelCase: "background-color" → "backgroundColor"
fn kebabToCamel(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var capitalize_next = false;
    for (input) |ch| {
        if (ch == '-') {
            capitalize_next = true;
        } else if (capitalize_next) {
            try result.append(alloc, if (ch >= 'a' and ch <= 'z') ch - 32 else ch);
            capitalize_next = false;
        } else {
            try result.append(alloc, ch);
        }
    }
    return try alloc.dupe(u8, result.items);
}

/// Parse a CSS value string and return the numeric pixel value.
/// Handles: "32px" → 32, "2rem" → 32, "100%" → 100, "auto" → null
fn parseCSSValue(value: []const u8) ?f32 {
    if (value.len == 0) return null;
    if (std.mem.eql(u8, value, "auto")) return null;
    if (std.mem.endsWith(u8, value, "px")) {
        return std.fmt.parseFloat(f32, value[0 .. value.len - 2]) catch null;
    }
    if (std.mem.endsWith(u8, value, "rem")) {
        const num = std.fmt.parseFloat(f32, value[0 .. value.len - 3]) catch return null;
        return num * 16.0;
    }
    if (std.mem.endsWith(u8, value, "%")) {
        return std.fmt.parseFloat(f32, value[0 .. value.len - 1]) catch null;
    }
    return std.fmt.parseFloat(f32, value) catch null;
}

/// CSS named color lookup — the 17 basic CSS colors + common extras
fn namedColor(name: []const u8) ?[3]u8 {
    if (std.mem.eql(u8, name, "black")) return .{ 0, 0, 0 };
    if (std.mem.eql(u8, name, "white")) return .{ 255, 255, 255 };
    if (std.mem.eql(u8, name, "red")) return .{ 255, 0, 0 };
    if (std.mem.eql(u8, name, "green")) return .{ 0, 128, 0 };
    if (std.mem.eql(u8, name, "blue")) return .{ 0, 0, 255 };
    if (std.mem.eql(u8, name, "yellow")) return .{ 255, 255, 0 };
    if (std.mem.eql(u8, name, "cyan")) return .{ 0, 255, 255 };
    if (std.mem.eql(u8, name, "aqua")) return .{ 0, 255, 255 };
    if (std.mem.eql(u8, name, "magenta")) return .{ 255, 0, 255 };
    if (std.mem.eql(u8, name, "fuchsia")) return .{ 255, 0, 255 };
    if (std.mem.eql(u8, name, "gray")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "grey")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "silver")) return .{ 192, 192, 192 };
    if (std.mem.eql(u8, name, "maroon")) return .{ 128, 0, 0 };
    if (std.mem.eql(u8, name, "olive")) return .{ 128, 128, 0 };
    if (std.mem.eql(u8, name, "navy")) return .{ 0, 0, 128 };
    if (std.mem.eql(u8, name, "purple")) return .{ 128, 0, 128 };
    if (std.mem.eql(u8, name, "teal")) return .{ 0, 128, 128 };
    if (std.mem.eql(u8, name, "orange")) return .{ 255, 165, 0 };
    if (std.mem.eql(u8, name, "transparent")) return .{ 0, 0, 0 }; // rgba(0,0,0,0) — alpha not supported yet
    return null;
}
