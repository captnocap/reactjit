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

const MAX_LOCALS = 64;
const MAX_COMPONENTS = 64;
const MAX_COMPONENT_PROPS = 64;
const MAX_ARRAYS = 512;
const MAX_HANDLERS = 256;
const MAX_STATE_SLOTS = 128;
const MAX_DYN_TEXTS = 128;
const MAX_FFI_HEADERS = 32;
const MAX_FFI_LIBS = 32;
const MAX_FFI_FUNCS = 128;
const MAX_WINDOWS = 16;
const MAX_CONDS = 64;
const MAX_EFFECTS = 64;
const MAX_ANIM_HOOKS = 32;
const MAX_ANIM_BINDINGS = 64;
const MAX_DYN_STYLES = 128;
const MAX_ROUTES = 32;
const MAX_MAPS = 32;
const MAX_ARRAY_INIT = 64;
const MAX_OBJECT_FIELDS = 32;
const MAX_OBJECTS = 32;
const MAX_INPUTS = 32;
const MAX_PANEL_IMPORTS = 32;
const MAX_CLASSIFIERS = 256;
const MAX_PENDING_DYN_STYLES = 32;
const MAX_PENDING_ANIM = 16;
const MAX_MAP_INNER = 16;
const MAX_LET_VARS = 32;
const MAX_UTIL_FUNCS = 32;
const MAX_UTIL_PARAMS = 16;
const MAX_OVERLAYS = 16;
const MAX_COMP_FUNCS = 32;
const MAX_COMP_INSTANCES = 128;
const MAX_COMP_INNER = 8;

const CompFunc = struct {
    name: []const u8,
    func_source: []const u8,
    inner_count: u32,
    inner_sizes: [MAX_COMP_INNER]u32,
};

const CompInstance = struct {
    func_idx: u32, // index into comp_funcs
    storage_names: [MAX_COMP_INNER][]const u8, // _comp_Chip_0, _comp_Chip_1, etc.
    init_call: []const u8, // the full init call expression
    parent_arr: []const u8, // parent array name
    parent_idx: u32, // index in parent array
};

const ObjectStateInfo = struct {
    getter: []const u8, // "user"
    setter: []const u8, // "setUser"
    field_names: [MAX_OBJECT_FIELDS][]const u8,
    field_types: [MAX_OBJECT_FIELDS]StateType,
    field_slot_base: u32, // first slot ID for this object
    field_count: u32,
};

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

const MAX_DYN_DEPS = 8; // max state slot dependencies per dynamic binding

const DynText = struct {
    buf_id: u32,
    fmt_string: []const u8,
    fmt_args: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
    dep_slots: [MAX_DYN_DEPS]u32, // runtime state slot IDs this text depends on
    dep_count: u32,
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

const MAX_COMPUTED_ARRAYS = 16;

const ComputedArrayKind = enum { filter, split };

const ComputedArray = struct {
    name: []const u8, // .tsz variable name ("filtered", "parts")
    kind: ComputedArrayKind,
    element_type: StateType, // .int for filter of int array, .string for split
    source_slot: u32, // state array slot (filter) or regular string slot (split)
    predicate_expr: []const u8, // Zig expression for filter predicate (e.g., "_item > 25")
    predicate_param: []const u8, // lambda param name ("item") — for documentation only
    separator: []const u8, // split separator (e.g., ",")
};

const LetVar = struct {
    name: []const u8, // .tsz name (e.g., "label")
    initial: []const u8, // initial value expression
    state_type: StateType, // inferred type
    zig_name: []const u8, // runtime var name (e.g., "_let_0")
};

const ComponentInfo = struct {
    name: []const u8,
    prop_names: [MAX_COMPONENT_PROPS][]const u8,
    prop_count: u32,
    body_pos: u32, // token position of the return's JSX (at the '<')
    has_children: bool,
    usage_count: u32, // how many times this component is instantiated
    func_generated: bool, // true if init function has been generated
};

const UtilFunc = struct {
    name: []const u8,
    params: [MAX_UTIL_PARAMS][]const u8,
    param_count: u32,
    body_start: u32, // token pos of opening {
    body_end: u32, // token pos of closing }
};

/// Prop type tag — resolved at call-site collection time, not inferred from generated code.
const PropType = enum {
    string, // label="CPU" → "CPU"
    color, // color="#3fb950" → Color.rgb(63, 185, 80)
    number, // count={42} → 42
    state_int, // value={count} where count is useState(0)
    state_float, // value={temp} where temp is useState(0.0)
    state_string, // value={name} where name is useState('')
    state_bool, // value={active} where active is useState(false)
    dynamic_text, // value={`${cpu}%`} → DynText with fmt/args/deps
    expression, // value={a + b} → arbitrary Zig expression
};

/// Active prop substitution (pushed when entering a component, popped on exit)
/// For dynamic_text props, `value` holds the raw backtick string (e.g., `${cpu}%`)
/// which is re-parsed with full state context when used in the component body.
const PropBinding = struct {
    name: []const u8,
    value: []const u8, // raw .tsz value (string literal, number, state ref, or backtick template)
    prop_type: PropType = .string,
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
    inner_nodes: [MAX_MAP_INNER]MapInnerNode,
    inner_count: u32,
    is_self_closing: bool,
    is_text_element: bool,
    // Computed array source (for filtered.map(), parts.map())
    is_computed: bool = false,
    computed_idx: u32 = 0,
    computed_element_type: StateType = .int,
};

const MapTemplateResult = struct {
    outer_style: []const u8,
    outer_font_size: []const u8,
    outer_text_color: []const u8,
    inner_nodes: [MAX_MAP_INNER]MapInnerNode,
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

const OverlayInfo = struct {
    kind: []const u8 = "context_menu", // context_menu, modal, tooltip, popover
    root_expr: []const u8 = "",
    visible_expr: []const u8 = "", // Zig expression for visibility (state slot)
    x_expr: []const u8 = "", // Zig expression for x position
    y_expr: []const u8 = "", // Zig expression for y position
    dismiss_handler: ?[]const u8 = null, // handler function name
    arrays_start: u32 = 0,
    arrays_end: u32 = 0,
};


pub const Generator = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    input_file: []const u8,
    pos: u32, // token index

    // Collected outputs
    array_decls: std.ArrayListUnmanaged([]const u8),
    handler_decls: std.ArrayListUnmanaged([]const u8),
    array_counter: u32,
    handler_counter: u32,

    // State
    state_slots: [MAX_STATE_SLOTS]StateSlot,
    state_count: u32,
    has_state: bool,

    // Object state (compile-time field flattening)
    object_states: [MAX_OBJECTS]ObjectStateInfo,
    object_count: u32,

    // Dynamic text
    dyn_texts: [MAX_DYN_TEXTS]DynText,
    dyn_count: u32,
    last_dyn_id: ?u32,

    // Dynamic styles (state-dependent style values)
    dyn_styles: [MAX_DYN_STYLES]DynStyle,
    dyn_style_count: u32,
    pending_dyn_styles: [MAX_PENDING_DYN_STYLES]PendingDynStyle,
    pending_dyn_style_count: u32,
    emit_colors_as_rgb: bool,

    // FFI
    ffi_headers: std.ArrayListUnmanaged([]const u8),
    ffi_libs: std.ArrayListUnmanaged([]const u8),
    ffi_funcs: std.ArrayListUnmanaged([]const u8),

    // Windows
    windows: [MAX_WINDOWS]WindowInfo,
    window_count: u32,

    // Overlays
    overlays: [MAX_OVERLAYS]OverlayInfo,
    overlay_count: u32,
    has_overlays: bool,

    // TextInputs
    input_count: u32,
    input_multiline: [MAX_INPUTS]bool,
    input_change_handlers: [MAX_INPUTS]?[]const u8,

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
    pending_anim: [MAX_PENDING_ANIM]PendingAnimBinding,
    pending_anim_count: u32,
    emit_float_as_f32: bool, // when true, decimal literals become @as(f32, N)

    // Routes
    routes: [MAX_ROUTES]RouteInfo,
    route_count: u32,
    has_routes: bool,
    has_crypto: bool,
    has_panels: bool,
    panel_imports: [MAX_PANEL_IMPORTS][]const u8, // panel names imported via `import { x } from '@panels'`
    panel_import_count: u32,
    has_pty: bool,
    has_inspector: bool,
    last_route_path: ?[]const u8, // temp: Route → Routes communication
    routes_bind_from: ?u32, // set when entering Routes, consumed on array creation

    // Maps (.map() dynamic lists)
    maps: [MAX_MAPS]MapInfo,
    map_count: u32,
    map_item_param: ?[]const u8,
    map_index_param: ?[]const u8,

    // Computed arrays (.filter(), .split() results)
    computed_arrays: [MAX_COMPUTED_ARRAYS]ComputedArray,
    computed_count: u32,
    map_item_type: ?StateType, // element type of current .map() source (null = i64 default)

    // Classifiers: name → { primitive_type, style_fields_string }
    classifier_names: [MAX_CLASSIFIERS][]const u8,
    classifier_primitives: [MAX_CLASSIFIERS][]const u8,
    classifier_styles: [MAX_CLASSIFIERS][]const u8,
    classifier_text_props: [MAX_CLASSIFIERS][]const u8, // fontSize, color for Text classifiers
    classifier_count: u32,

    // Local variables (compile-time constant substitution)
    local_vars: [MAX_LOCALS]LocalVar,
    local_count: u32,

    // Mutable let vars (runtime variables, not compile-time substitution)
    let_vars: [MAX_LET_VARS]LetVar,
    let_count: u32,
    // Token range of imperative body (let decls + blocks between hooks and return)
    body_imperative_start: u32,
    body_imperative_end: u32,

    // Components (compile-time inlining)
    components: [MAX_COMPONENTS]ComponentInfo,
    component_count: u32,

    // Utility functions (non-component, non-App, lowercase)
    util_funcs: [MAX_UTIL_FUNCS]UtilFunc,
    util_func_count: u32,

    // Component context for debug comments on generated arrays
    current_inline_component: ?[]const u8,

    // Prop substitution stack (active during component inlining)
    prop_stack: [MAX_COMPONENT_PROPS]PropBinding,
    prop_stack_count: u32,
    // Children JSX to splice for {children} placeholders
    component_children_exprs: ?*std.ArrayListUnmanaged([]const u8),

    // Component functions (for multi-use leaf components)
    comp_funcs: [MAX_COMP_FUNCS]CompFunc,
    comp_func_count: u32,
    comp_instances: [MAX_COMP_INSTANCES]CompInstance,
    comp_instance_count: u32,
    comp_instance_counter: [MAX_COMP_FUNCS]u32, // per-function instance counter for naming

    // compute{} block: raw JS source extracted for QuickJS embedding
    compute_js: ?[]const u8 = null,

    // When true, findProp returns "_p_NAME" instead of the concrete value.
    // Set during component function body generation.
    emit_prop_refs: bool = false,

    // Compile error diagnostics (set by overflow checks, checked before emission)
    compile_error: ?[]const u8,

    /// Set a compile error if none is set yet. First error wins.
    fn setError(self: *Generator, msg: []const u8) void {
        if (self.compile_error == null) {
            self.compile_error = msg;
            std.debug.print("[tsz] compile error: {s}\n", .{msg});
        }
    }

    /// Extract compute{} block — raw JS for QuickJS embedding.
    /// Scans source text for <script>...</script> and extracts the JS body.
    fn extractComputeBlock(self: *Generator) void {
        const src = self.source;
        const open_tag = "<script>";
        const close_tag = "</script>";
        // Find <script>
        var i: usize = 0;
        while (i + open_tag.len <= src.len) : (i += 1) {
            if (std.mem.eql(u8, src[i .. i + open_tag.len], open_tag)) {
                const body_start = i + open_tag.len;
                // Find </script>
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
            .object_states = undefined,
            .object_count = 0,
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
            .overlays = undefined,
            .overlay_count = 0,
            .has_overlays = false,
            .input_count = 0,
            .input_multiline = [_]bool{false} ** MAX_INPUTS,
            .input_change_handlers = [_]?[]const u8{null} ** MAX_INPUTS,
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
            .has_panels = false,
            .panel_imports = undefined,
            .panel_import_count = 0,
            .has_pty = false,
            .has_inspector = false,
            .last_route_path = null,
            .routes_bind_from = null,
            .maps = undefined,
            .map_count = 0,
            .map_item_param = null,
            .map_index_param = null,
            .computed_arrays = undefined,
            .computed_count = 0,
            .map_item_type = null,
            .classifier_names = undefined,
            .classifier_primitives = undefined,
            .classifier_styles = undefined,
            .classifier_text_props = undefined,
            .classifier_count = 0,
            .local_vars = undefined,
            .local_count = 0,
            .let_vars = undefined,
            .let_count = 0,
            .body_imperative_start = 0,
            .body_imperative_end = 0,
            .components = undefined,
            .component_count = 0,
            .util_funcs = undefined,
            .util_func_count = 0,
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

    /// Check if a name was imported as a panel via `import { name } from '@panels'`
    fn isPanelImport(self: *Generator, name: []const u8) bool {
        for (self.panel_imports[0..self.panel_import_count]) |p| {
            if (std.mem.eql(u8, p, name)) return true;
        }
        return false;
    }

    /// Scan token stream for `import { name, ... } from '@panels'` and register panel names.
    fn collectPanelImports(self: *Generator) void {
        const saved_pos = self.pos;
        defer self.pos = saved_pos;
        self.pos = 0;
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("import")) {
                self.advance_token(); // import
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    // Collect names
                    var names: [MAX_PANEL_IMPORTS][]const u8 = undefined;
                    var nc: u32 = 0;
                    while (self.curKind() == .identifier and nc < MAX_PANEL_IMPORTS) {
                        names[nc] = self.curText();
                        nc += 1;
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token(); // }
                    if (self.isIdent("from")) {
                        self.advance_token(); // from
                        if (self.curKind() == .string) {
                            const raw = self.curText();
                            const path = raw[1 .. raw.len - 1];
                            if (std.mem.eql(u8, path, "@panels")) {
                                // Register these names as panel imports
                                for (names[0..nc]) |n| {
                                    if (self.panel_import_count < MAX_PANEL_IMPORTS) {
                                        self.panel_imports[self.panel_import_count] = n;
                                        self.panel_import_count += 1;
                                    } else {
                                        self.setError("Too many panel imports (limit: 32)");
                                    }
                                }
                            }
                        }
                    }
                }
            }
            self.advance_token();
        }
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
                if (self.isObjectState(name) != null) return true;
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

    fn isObjectState(self: *Generator, name: []const u8) ?u32 {
        for (0..self.object_count) |i| {
            if (std.mem.eql(u8, self.object_states[i].getter, name)) return @intCast(i);
        }
        return null;
    }

    fn isObjectSetter(self: *Generator, name: []const u8) ?u32 {
        for (0..self.object_count) |i| {
            if (std.mem.eql(u8, self.object_states[i].setter, name)) return @intCast(i);
        }
        return null;
    }

    fn resolveObjectField(self: *Generator, obj_idx: u32, field: []const u8) ?u32 {
        const obj = &self.object_states[obj_idx];
        for (0..obj.field_count) |i| {
            if (std.mem.eql(u8, obj.field_names[i], field)) {
                return obj.field_slot_base + @as(u32, @intCast(i));
            }
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

    fn isComputedArray(self: *Generator, name: []const u8) ?u32 {
        for (0..self.computed_count) |i| {
            if (std.mem.eql(u8, self.computed_arrays[i].name, name)) return @intCast(i);
        }
        return null;
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
        // Check for lexer overflow
        if (self.lex.overflow) {
            return error.TokenLimitExceeded;
        }

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

        // Phase 2.5: Collect panel imports (import { x } from '@panels')
        self.collectPanelImports();

        // Phase 3: Collect classifiers
        self.pos = 0;
        self.collectClassifiers();

        // Phase 3.5: Collect component definitions (non-App functions)
        self.pos = 0;
        self.collectComponents();

        // Phase 3.6: Collect utility functions (lowercase, non-App)
        self.pos = 0;
        self.collectUtilFunctions();

        // Phase 3.7: Extract compute{} blocks (JS logic for QuickJS)
        self.pos = 0;
        self.extractComputeBlock();

        // Phase 4: Find App function and collect useState
        // If <script> block exists, useState may be at top level — scan from 0
        self.pos = 0;
        if (self.compute_js != null) {
            // Scan from token 0 without skipping to brace (useState is at top level)
            self.collectStateHooksTopLevel();
        }
        self.pos = 0;
        const app_start = self.findAppFunction() orelse return error.NoAppFunction;
        if (self.compute_js == null) {
            self.collectStateHooks(app_start);
        }

        // Phase 4b: Count component usage in App body
        self.countComponentUsage(app_start);

        // Phase 5: Collect useEffect calls
        self.pos = app_start;
        self.collectEffects(app_start);

        // Phase 5b: Collect useTransition / useSpring hooks
        self.collectAnimHooks(app_start);

        // Phase 5c: Collect local variables (const x = expr)
        self.collectLocalVars(app_start);

        // Phase 6: Find return JSX and generate node tree
        // If no return statement exists (pure logic module), use empty root
        self.pos = app_start;
        self.findReturnStatement();
        const has_jsx = self.curKind() == .lt; // <Tag means JSX follows
        const root_expr = if (has_jsx) try self.parseJSXElement() else ".{}";

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
            } else {
                self.setError("Too many dynamic styles (limit: 128)");
            }
        }
        self.pending_dyn_style_count = 0;

        // Check for overflow errors accumulated during collection/parsing
        if (self.compile_error) |_| {
            return error.LimitExceeded;
        }

        // Emit Zig source
        return self.emitZigSource(root_expr);
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

    fn collectStateHooksTopLevel(self: *Generator) void {
        self.pos = 0;
        // Scan for useState at top level (no function header skip).
        // Don't stop at 'return' — merged source has component functions with return
        // before the useState declarations from the entry file.
        self.scanForUseState(false);
    }

    fn collectStateHooks(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        // Skip past function header to body
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();
        self.scanForUseState(true);
    }

    fn scanForUseState(self: *Generator, stop_at_return: bool) void {
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
                                } else if (self.curKind() == .lbrace) {
                                    // Object literal: useState({ name: "Alice", age: 30, active: true })
                                    self.advance_token(); // {
                                    var obj_field_names: [MAX_OBJECT_FIELDS][]const u8 = undefined;
                                    var obj_field_types: [MAX_OBJECT_FIELDS]StateType = undefined;
                                    var obj_field_initials: [MAX_OBJECT_FIELDS]StateInitial = undefined;
                                    var obj_field_count: u32 = 0;

                                    while (self.curKind() == .identifier and obj_field_count < MAX_OBJECT_FIELDS) {
                                        obj_field_names[obj_field_count] = self.curText();
                                        self.advance_token(); // key
                                        if (self.curKind() == .colon) self.advance_token(); // :
                                        // Parse value — detect type same as scalar useState
                                        if (self.curKind() == .number) {
                                            const num_text = self.curText();
                                            if (std.mem.indexOf(u8, num_text, ".") != null) {
                                                obj_field_types[obj_field_count] = .float;
                                                obj_field_initials[obj_field_count] = .{ .float = std.fmt.parseFloat(f64, num_text) catch 0.0 };
                                            } else {
                                                obj_field_types[obj_field_count] = .int;
                                                obj_field_initials[obj_field_count] = .{ .int = std.fmt.parseInt(i64, num_text, 10) catch 0 };
                                            }
                                            self.advance_token();
                                        } else if (self.curKind() == .string) {
                                            const raw = self.curText();
                                            obj_field_types[obj_field_count] = .string;
                                            obj_field_initials[obj_field_count] = .{ .string = raw[1 .. raw.len - 1] };
                                            self.advance_token();
                                        } else if (self.curKind() == .identifier) {
                                            const val = self.curText();
                                            if (std.mem.eql(u8, val, "true")) {
                                                obj_field_types[obj_field_count] = .boolean;
                                                obj_field_initials[obj_field_count] = .{ .boolean = true };
                                                self.advance_token();
                                            } else if (std.mem.eql(u8, val, "false")) {
                                                obj_field_types[obj_field_count] = .boolean;
                                                obj_field_initials[obj_field_count] = .{ .boolean = false };
                                                self.advance_token();
                                            }
                                        }
                                        obj_field_count += 1;
                                        if (self.curKind() == .comma) self.advance_token();
                                    }
                                    if (self.curKind() == .rbrace) self.advance_token(); // }

                                    // Create individual state slots for each field
                                    const base_slot = self.state_count;
                                    for (0..obj_field_count) |fi| {
                                        if (self.state_count < MAX_STATE_SLOTS) {
                                            self.state_slots[self.state_count] = .{
                                                .getter = "",
                                                .setter = "",
                                                .initial = obj_field_initials[fi],
                                            };
                                            self.state_count += 1;
                                            self.has_state = true;
                                        } else {
                                            self.setError("Too many state slots (limit: 128)");
                                        }
                                    }

                                    // Record object metadata
                                    if (self.object_count < MAX_OBJECTS) {
                                        self.object_states[self.object_count] = .{
                                            .getter = getter,
                                            .setter = setter,
                                            .field_names = obj_field_names,
                                            .field_types = obj_field_types,
                                            .field_slot_base = base_slot,
                                            .field_count = obj_field_count,
                                        };
                                        self.object_count += 1;
                                    } else {
                                        self.setError("Too many object state declarations (limit: 32)");
                                    }

                                    // Skip rparen and continue past normal slot creation
                                    if (self.curKind() == .rparen) self.advance_token();
                                    if (self.curKind() == .semicolon) self.advance_token();
                                    continue;
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
                } else {
                    self.setError("Too many useEffect hooks (limit: 64)");
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
                            } else {
                                self.setError("Too many animation hooks (limit: 32)");
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

    fn findComponent(self: *Generator, name: []const u8) ?*ComponentInfo {
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
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) {
                if (self.emit_prop_refs) {
                    // Function mode: return parameter reference
                    return std.fmt.allocPrint(self.alloc, "_p_{s}", .{name}) catch null;
                }
                return self.prop_stack[i].value;
            }
        }
        return null;
    }

    /// Look up a prop binding by name. Returns the full PropBinding (with type info).
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

    /// Classify a Zig expression string into a PropType based on its shape.
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

    /// Map a PropType to its Zig type string for function parameter declarations.
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

    /// Estimate buffer size needed for a bufPrint format string.
    /// Counts literal chars + per-specifier overhead: {d}→20, {s}→128, {c}→1
    fn estimateBufSize(fmt: []const u8) u32 {
        var size: u32 = 0;
        var i: usize = 0;
        while (i < fmt.len) {
            if (i + 2 < fmt.len and fmt[i] == '{' and fmt[i + 2] == '}') {
                switch (fmt[i + 1]) {
                    'd' => size += 20, // i64 max digits
                    's' => size += 128, // string slot
                    'c' => size += 1,
                    else => size += 32,
                }
                i += 3;
            } else {
                size += 1;
                i += 1;
            }
        }
        return @max(size, 64); // floor at 64
    }

    /// Inline a component at its call site: collect props, jump to body, parse JSX.
    /// For multi-use leaf components (usage >= 2, no children), generates shared init
    /// functions to reduce code bloat.
    fn inlineComponent(self: *Generator, comp: *ComponentInfo) anyerror![]const u8 {
        const saved_component = self.current_inline_component;
        self.current_inline_component = comp.name;
        defer self.current_inline_component = saved_component;

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
                    var prop_type: PropType = .string;
                    if (self.curKind() == .string) {
                        val = self.curText();
                        if (val.len >= 2 and val[0] == '\'') {
                            val = try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{val[1 .. val.len - 1]});
                        }
                        // Classify string prop (detect colors)
                        prop_type = self.classifyExpr(val);
                        self.advance_token();
                    } else if (self.curKind() == .lbrace) {
                        // Check if this is a handler prop (onPress, onChangeText, etc.)
                        const is_handler = attr_name.len > 2 and attr_name[0] == 'o' and attr_name[1] == 'n' and attr_name[2] >= 'A' and attr_name[2] <= 'Z';
                        if (is_handler) {
                            // Check if forwarding another handler prop: {propName}
                            // If so, resolve to the original handler's token range
                            const peek_id = self.pos + 1;
                            const peek_rb = self.pos + 2;
                            if (peek_id < self.lex.count and peek_rb < self.lex.count and
                                self.lex.tokens[peek_id].kind == .identifier and
                                self.lex.tokens[peek_rb].kind == .rbrace)
                            {
                                const inner_name = self.lex.tokens[peek_id].text(self.source);
                                if (self.findPropHandler(inner_name)) |orig_range| {
                                    // Forward the original handler range, not {propName}
                                    h_start = orig_range.start;
                                    h_end = orig_range.end;
                                    try self.skipBalanced();
                                } else {
                                    h_start = self.pos;
                                    try self.skipBalanced();
                                    h_end = self.pos;
                                }
                            } else {
                                h_start = self.pos;
                                try self.skipBalanced();
                                h_end = self.pos;
                            }
                        } else {
                            self.advance_token(); // {
                            // Check for template literal inside braces: value={`${cpu}%`}
                            if (self.curKind() == .template_literal) {
                                // Store raw template literal text for deferred resolution.
                                // State may not be registered yet at call-site collection time,
                                // so we defer parsing to the component body where text content
                                // handling will re-parse the template with full state context.
                                const tok = self.cur();
                                const raw = tok.text(self.source);
                                val = try self.alloc.dupe(u8, raw); // includes backticks
                                prop_type = .dynamic_text;
                                self.advance_token(); // consume template_literal
                            } else {
                                val = try self.emitStateExpr();
                                prop_type = self.classifyExpr(val);
                            }
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
                                    .prop_type = prop_type,
                                    .handler_start = h_start,
                                    .handler_end = h_end,
                                };
                                self.prop_stack_count += 1;
                            } else {
                                self.setError("Too many component props (limit: 64)");
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

        // ── Component function path: multi-use leaf components ──
        // For components used 2+ times with no children slot, generate a shared
        // init function instead of fully inlining every instance.
        const eligible = comp.usage_count >= 2 and !comp.has_children and !has_caller_children;
        if (eligible) {
            // Check props don't contain state refs or dynamic text (simple leaf only)
            var has_state_prop = false;
            for (saved_prop_count..self.prop_stack_count) |pi| {
                const v = self.prop_stack[pi].value;
                const pt = self.prop_stack[pi].prop_type;
                if (std.mem.indexOf(u8, v, "state.") != null) has_state_prop = true;
                if (self.prop_stack[pi].handler_start != null) has_state_prop = true;
                // Dynamic text and state-dependent props cannot be function parameters
                if (pt == .dynamic_text or pt == .state_int or pt == .state_float or
                    pt == .state_string or pt == .state_bool) has_state_prop = true;
            }
            if (!has_state_prop) {
                const cf_result = try self.compFuncInline(comp, saved_prop_count);
                if (cf_result) |placeholder| {
                    self.prop_stack_count = saved_prop_count;
                    return placeholder;
                }
                // If compFuncInline returned null, fall through to normal inline
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

    /// Component function inline: generates shared init function on first use,
    /// then emits per-instance storage + deferred init call for every use.
    /// Returns the placeholder expression, or null if this component can't be optimized.
    fn compFuncInline(self: *Generator, comp: *ComponentInfo, saved_prop_count: u32) !?[]const u8 {
        var func_idx: u32 = 0;

        if (!comp.func_generated) {
            // ── First call: parse normally to capture the template ──
            const arr_count_before = self.array_decls.items.len;
            const arr_id_before = self.array_counter;

            // Parse the component body in prop-ref mode
            // Props resolve to _p_name instead of concrete values
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
                // Too many inner arrays or no arrays — skip optimization
                // Remove the arrays we just generated (they came from a throwaway parse)
                while (self.array_decls.items.len > arr_count_before) {
                    _ = self.array_decls.pop();
                }
                self.array_counter = arr_id_before;
                return null;
            }
            const inner_count: u32 = @intCast(inner_count_u);

            // Capture inner array sizes by parsing the captured decl strings
            var inner_sizes: [MAX_COMP_INNER]u32 = [_]u32{0} ** MAX_COMP_INNER;
            for (0..inner_count) |ii| {
                const decl = self.array_decls.items[arr_count_before + ii];
                // Count Node elements: number of ".{" at top level
                inner_sizes[ii] = countNodeElements(decl);
            }

            // Build the init function source
            var func_src: std.ArrayListUnmanaged(u8) = .{};

            // Function signature
            try func_src.appendSlice(self.alloc, "fn _init");
            try func_src.appendSlice(self.alloc, comp.name);
            try func_src.appendSlice(self.alloc, "(");

            // Inner array pointer params
            for (0..inner_count) |ii| {
                if (ii > 0) try func_src.appendSlice(self.alloc, ", ");
                try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "_inner_{d}: *[{d}]Node", .{ ii, inner_sizes[ii] }));
            }

            // Prop params — infer types from how they were used in generated code
            for (saved_prop_count..self.prop_stack_count) |pi| {
                const prop = self.prop_stack[pi];
                try func_src.appendSlice(self.alloc, ", ");
                try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "_p_{s}: ", .{prop.name}));
                // Use explicit type from prop binding (resolved at call-site collection)
                const param_type = zigTypeForPropType(prop.prop_type);
                try func_src.appendSlice(self.alloc, param_type);
            }

            try func_src.appendSlice(self.alloc, ") Node {\n");

            // Body: assign inner arrays
            for (0..inner_count) |ii| {
                const decl = self.array_decls.items[arr_count_before + ii];
                // Extract the array initializer content after "= [_]Node{ " and before " };"
                const arr_init = extractArrayInit(decl);
                // Replace &_arr_N cross-references with _inner_K pointers
                var replaced_init: []const u8 = try self.alloc.dupe(u8, arr_init);
                for (0..inner_count) |jj| {
                    const ref_id = arr_id_before + @as(u32, @intCast(jj));
                    const old_ref = try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{ref_id});
                    const new_ref = try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{jj});
                    replaced_init = try self.replaceAllOccurrences(replaced_init, old_ref, new_ref);
                }
                // Props resolved structurally via emit_prop_refs — no string replacement.
                try func_src.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    _inner_{d}.* = [_]Node{{ {s} }};\n", .{ ii, replaced_init }));
            }

            // Root expression — replace &_arr_N references with _inner_K
            var replaced_root: []const u8 = try self.alloc.dupe(u8, root_expr);
            for (0..inner_count) |ii| {
                const arr_id = arr_id_before + @as(u32, @intCast(ii));
                const old_ref = try std.fmt.allocPrint(self.alloc, "&_arr_{d}", .{arr_id});
                const new_ref = try std.fmt.allocPrint(self.alloc, "_inner_{d}", .{ii});
                replaced_root = try self.replaceAllOccurrences(replaced_root, old_ref, new_ref);
            }
            // Props resolved structurally via emit_prop_refs — no string replacement.

            // Convert ".{ ... }" to "Node{ ... }" for the return
            if (std.mem.startsWith(u8, replaced_root, ".{ ")) {
                replaced_root = try std.fmt.allocPrint(self.alloc, "return Node{{ {s}", .{replaced_root[3..]});
            } else {
                replaced_root = try std.fmt.allocPrint(self.alloc, "return {s}", .{replaced_root});
            }
            try func_src.appendSlice(self.alloc, "    ");
            try func_src.appendSlice(self.alloc, replaced_root);
            try func_src.appendSlice(self.alloc, ";\n}\n");

            // Remove the captured arrays from array_decls (they are now in the function)
            while (self.array_decls.items.len > arr_count_before) {
                _ = self.array_decls.pop();
            }
            self.array_counter = arr_id_before;

            // Store the function
            if (self.comp_func_count < MAX_COMP_FUNCS) {
                func_idx = self.comp_func_count;
                self.comp_funcs[func_idx] = .{
                    .name = comp.name,
                    .func_source = try self.alloc.dupe(u8, func_src.items),
                    .inner_count = inner_count,
                    .inner_sizes = inner_sizes,
                };
                self.comp_func_count += 1;
            } else {
                return null;
            }

            comp.func_generated = true;
        } else {
            // Find existing function index
            for (0..self.comp_func_count) |fi| {
                if (std.mem.eql(u8, self.comp_funcs[fi].name, comp.name)) {
                    func_idx = @intCast(fi);
                    break;
                }
            }
        }

        // ── Every call: emit per-instance storage + deferred init ──
        const cf = &self.comp_funcs[func_idx];
        if (self.comp_instance_count >= MAX_COMP_INSTANCES) return null;

        const inst_id = self.comp_instance_counter[func_idx];
        self.comp_instance_counter[func_idx] += 1;

        var inst: CompInstance = .{
            .func_idx = func_idx,
            .storage_names = undefined,
            .init_call = "",
            .parent_arr = "",
            .parent_idx = 0,
        };

        // Emit storage arrays as array_decls (they are "var _comp_Name_N: [S]Node = undefined;")
        for (0..cf.inner_count) |ii| {
            const storage_name = try std.fmt.allocPrint(self.alloc, "_comp_{s}_{d}_{d}", .{ comp.name, inst_id, ii });
            inst.storage_names[ii] = storage_name;
            const storage_decl = try std.fmt.allocPrint(self.alloc, "var {s}: [{d}]Node = undefined;", .{ storage_name, cf.inner_sizes[ii] });
            try self.array_decls.append(self.alloc, storage_decl);
        }

        // Build the init call expression: _initChip(&_comp_Chip_0_0, "Zig", Color.rgb(247, 164, 29))
        var call: std.ArrayListUnmanaged(u8) = .{};
        try call.appendSlice(self.alloc, "_init");
        try call.appendSlice(self.alloc, comp.name);
        try call.appendSlice(self.alloc, "(");
        for (0..cf.inner_count) |ii| {
            if (ii > 0) try call.appendSlice(self.alloc, ", ");
            try call.appendSlice(self.alloc, "&");
            try call.appendSlice(self.alloc, inst.storage_names[ii]);
        }
        // Prop values as arguments — type-based dispatch from PropType
        for (saved_prop_count..self.prop_stack_count) |pi| {
            const prop = self.prop_stack[pi];
            try call.appendSlice(self.alloc, ", ");
            switch (prop.prop_type) {
                .color => {
                    // Color prop — convert hex string to Color.rgb(...)
                    if (prop.value.len >= 2 and (prop.value[0] == '"' or prop.value[0] == '\'')) {
                        const inner_val = prop.value[1 .. prop.value.len - 1];
                        const color_expr = try self.parseColorValue(inner_val);
                        try call.appendSlice(self.alloc, color_expr);
                    } else {
                        try call.appendSlice(self.alloc, prop.value);
                    }
                },
                .string, .number, .expression,
                .state_int, .state_float, .state_string, .state_bool => {
                    try call.appendSlice(self.alloc, prop.value);
                },
                .dynamic_text => {
                    // Should not reach here — dynamic_text disqualifies from compFuncInline
                    try call.appendSlice(self.alloc, "\"\"");
                },
            }
        }
        try call.appendSlice(self.alloc, ")");
        inst.init_call = try self.alloc.dupe(u8, call.items);

        self.comp_instances[self.comp_instance_count] = inst;
        self.comp_instance_count += 1;

        // Return placeholder — will be filled by _initComponents() at runtime
        return try self.alloc.dupe(u8, ".{}");
    }

    /// Infer the Zig type for a component prop based on how its value was used
    /// in the generated template code.
    /// Legacy shim — delegates to explicit prop type. Kept for signature compatibility.
    fn inferPropType(self: *Generator, prop: PropBinding, root_expr: []const u8, array_decls: []const []const u8) []const u8 {
        _ = self;
        _ = root_expr;
        _ = array_decls;
        return zigTypeForPropType(prop.prop_type);
    }

    /// Replace all occurrences of `needle` in `haystack` with `replacement`.
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
        // Append remaining bytes
        while (i < haystack.len) {
            try result.append(self.alloc, haystack[i]);
            i += 1;
        }
        return try self.alloc.dupe(u8, result.items);
    }

    /// Collect utility functions (lowercase, non-App, non-component).
    /// These are emitted as standalone Zig functions.
    fn collectUtilFunctions(self: *Generator) void {
        self.pos = 0;
        while (self.pos < self.lex.count and self.curKind() != .eof) {
            if (self.isIdent("function")) {
                self.advance_token(); // skip "function"
                if (self.curKind() != .identifier) continue;
                const name = self.curText();
                // Skip App and uppercase (components)
                if (std.mem.eql(u8, name, "App") or (name.len > 0 and name[0] >= 'A' and name[0] <= 'Z')) {
                    self.advance_token();
                    continue;
                }
                self.advance_token(); // skip name

                // Parse params: (a, b, c) — skip type annotations
                var params: [MAX_UTIL_PARAMS][]const u8 = undefined;
                var param_count: u32 = 0;
                if (self.curKind() == .lparen) {
                    self.advance_token(); // (
                    while (self.curKind() != .rparen and self.curKind() != .eof) {
                        if (self.curKind() == .identifier) {
                            if (param_count < MAX_UTIL_PARAMS) {
                                params[param_count] = self.curText();
                                param_count += 1;
                            }
                        }
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                        // Skip type annotation: param: type
                        if (self.curKind() == .colon) {
                            self.advance_token(); // :
                            if (self.curKind() == .identifier) self.advance_token(); // type
                        }
                    }
                    if (self.curKind() == .rparen) self.advance_token(); // )
                }

                // Skip optional return type annotation
                if (self.curKind() == .colon) {
                    self.advance_token(); // :
                    if (self.curKind() == .identifier) self.advance_token(); // type
                }

                // Find body bounds { ... }
                if (self.curKind() == .lbrace) {
                    const body_start = self.pos;
                    self.advance_token(); // {
                    var depth: u32 = 1;
                    while (self.pos < self.lex.count and depth > 0) {
                        if (self.curKind() == .lbrace) depth += 1;
                        if (self.curKind() == .rbrace) {
                            depth -= 1;
                            if (depth == 0) break;
                        }
                        self.advance_token();
                    }
                    const body_end = self.pos;
                    if (self.curKind() == .rbrace) self.advance_token();

                    if (self.util_func_count < MAX_UTIL_FUNCS) {
                        self.util_funcs[self.util_func_count] = .{
                            .name = name,
                            .params = params,
                            .param_count = param_count,
                            .body_start = body_start,
                            .body_end = body_end,
                        };
                        self.util_func_count += 1;
                    } else {
                        self.setError("Too many utility functions (limit: 32)");
                    }
                }
                continue;
            }
            self.advance_token();
        }
    }

    /// Look up a utility function by name.
    fn isUtilFunc(self: *Generator, name: []const u8) ?*const UtilFunc {
        for (0..self.util_func_count) |i| {
            if (std.mem.eql(u8, self.util_funcs[i].name, name)) return &self.util_funcs[i];
        }
        return null;
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
                            if (self.curKind() == .lt) {
                                if (self.component_count < MAX_COMPONENTS) {
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
                // Skip rest of function
                _ = func_pos;
                continue;
            }
            self.advance_token();
        }
    }

    /// Count how many times each component is used as a JSX tag in the App body.
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

    // ── Local variable helpers ────────────────────────────────────────

    fn isLocalVar(self: *Generator, name: []const u8) ?*const LocalVar {
        for (0..self.local_count) |i| {
            if (std.mem.eql(u8, self.local_vars[i].name, name)) return &self.local_vars[i];
        }
        return null;
    }

    fn isLetVar(self: *Generator, name: []const u8) ?*const LetVar {
        for (0..self.let_count) |i| {
            if (std.mem.eql(u8, self.let_vars[i].name, name)) return &self.let_vars[i];
        }
        return null;
    }

    /// Infer the result type of a Zig expression for template literal formatting.
    /// Checks output type (what the expression produces), not input type (what it reads).
    fn inferExprType(self: *Generator, expr: []const u8) StateType {
        _ = self;
        // Ternary that produces strings: (if (...) "x" else "y")
        const has_if = std.mem.indexOf(u8, expr, "if (") != null;
        const has_else = std.mem.indexOf(u8, expr, " else ") != null;
        if (has_if and has_else) {
            var dq_count: u32 = 0;
            for (expr) |ch| {
                if (ch == '"') dq_count += 1;
            }
            if (dq_count >= 4) return .string;
        }
        // Bool checks BEFORE string — .includes()/.indexOf() etc. use getSlotString
        // internally but produce bool/int, not string
        if (!has_if) {
            if (std.mem.indexOf(u8, expr, "getSlotBool") != null) return .boolean;
            if (std.mem.indexOf(u8, expr, "!= null") != null) return .boolean;
            const has_gt = std.mem.indexOf(u8, expr, "> ") != null and std.mem.indexOf(u8, expr, ">> ") == null;
            const has_lt = std.mem.indexOf(u8, expr, "< ") != null and std.mem.indexOf(u8, expr, "<< ") == null;
            if (std.mem.indexOf(u8, expr, "==") != null or
                std.mem.indexOf(u8, expr, "!=") != null or
                has_lt or has_gt) return .boolean;
        }
        // Int patterns that happen to contain getSlotString (.length, .indexOf result)
        if (std.mem.indexOf(u8, expr, ".len)") != null) return .int;
        if (std.mem.indexOf(u8, expr, "indexOf") != null) return .int;
        // Direct string getter — only when it IS the string value
        if (std.mem.indexOf(u8, expr, "getSlotString") != null) return .string;
        // String literal
        if (expr.len >= 2 and expr[0] == '"') return .string;
        // Float getters
        if (std.mem.indexOf(u8, expr, "getSlotFloat") != null or
            std.mem.indexOf(u8, expr, "getFps") != null or
            std.mem.indexOf(u8, expr, "getLayoutMs") != null or
            std.mem.indexOf(u8, expr, "getPaintMs") != null) return .float;
        return .int;
    }

    /// Collect local variable declarations between hooks and return.
    /// const → compile-time substitution. let → runtime mutable var.
    /// Also records imperative block ranges (switch, if, while, for in body).
    fn collectLocalVars(self: *Generator, func_start: u32) void {
        self.pos = func_start;
        // Skip past function header to body
        while (self.pos < self.lex.count and self.curKind() != .lbrace) self.advance_token();
        if (self.curKind() == .lbrace) self.advance_token();

        // Track where imperative body starts (after hooks/const, before return)
        var imperative_start: u32 = 0;
        var found_imperative = false;

        while (self.pos < self.lex.count) {
            if (self.isIdent("return")) break;

            // let declaration → mutable runtime variable
            if (self.isIdent("let")) {
                if (!found_imperative) {
                    imperative_start = self.pos;
                    found_imperative = true;
                }
                self.advance_token(); // skip 'let'
                if (self.curKind() == .lbracket) {
                    // Skip array destructuring (useState): let [x, y] = ...
                    self.advance_token();
                    continue;
                }
                if (self.curKind() == .identifier) {
                    const var_name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .equals) {
                        self.advance_token();
                        // Skip hooks
                        if (self.isIdent("useState") or self.isIdent("useEffect") or
                            self.isIdent("useTransition") or self.isIdent("useSpring"))
                        {
                            while (self.pos < self.lex.count and
                                self.curKind() != .semicolon and !self.isIdent("const") and
                                !self.isIdent("let") and !self.isIdent("return"))
                            {
                                self.advance_token();
                            }
                            if (self.curKind() == .semicolon) self.advance_token();
                            continue;
                        }
                        // Parse initial value
                        const expr = self.emitStateExpr() catch {
                            self.advance_token();
                            continue;
                        };
                        const st = self.inferExprType(expr);
                        // Infer type from initial value
                        const is_string = (expr.len >= 2 and expr[0] == '"') or
                            std.mem.indexOf(u8, expr, "getSlotString") != null;

                        if (self.let_count < MAX_LET_VARS) {
                            const zig_name = std.fmt.allocPrint(self.alloc, "_let_{d}", .{self.let_count}) catch "_let_x";
                            self.let_vars[self.let_count] = .{
                                .name = var_name,
                                .initial = expr,
                                .state_type = if (is_string) .string else st,
                                .zig_name = zig_name,
                            };
                            // Also register as a local var so expressions resolve it
                            if (self.local_count < MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{
                                    .name = var_name,
                                    .expr = if (is_string)
                                        (std.fmt.allocPrint(self.alloc, "{s}_text", .{zig_name}) catch "_let_x_text")
                                    else
                                        zig_name,
                                    .state_type = if (is_string) .string else st,
                                };
                                self.local_count += 1;
                            } else {
                                self.setError("Too many local variables (limit: 64)");
                            }
                            self.let_count += 1;
                        } else {
                            self.setError("Too many let variables (limit: 32)");
                        }
                        if (self.curKind() == .semicolon) self.advance_token();
                        continue;
                    }
                }
                continue;
            }

            // const declaration → compile-time substitution (existing logic)
            if (self.isIdent("const")) {
                self.advance_token();
                if (self.curKind() == .lbracket) {
                    self.advance_token();
                    continue;
                }
                // Object destructuring: const { name, age } = user
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    var destr_names: [8][]const u8 = undefined;
                    var destr_count: u32 = 0;
                    while (self.curKind() == .identifier and destr_count < 8) {
                        destr_names[destr_count] = self.curText();
                        destr_count += 1;
                        self.advance_token();
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token(); // }
                    if (self.curKind() == .equals) {
                        self.advance_token(); // =
                        if (self.curKind() == .identifier) {
                            const obj_name = self.curText();
                            self.advance_token();
                            // Resolve from object state
                            if (self.isObjectState(obj_name)) |obj_idx| {
                                for (0..destr_count) |di| {
                                    if (self.resolveObjectField(obj_idx, destr_names[di])) |state_idx| {
                                        const rid = self.regularSlotId(state_idx);
                                        const ft = self.stateTypeById(state_idx);
                                        if (self.local_count < MAX_LOCALS) {
                                            self.local_vars[self.local_count] = .{
                                                .name = destr_names[di],
                                                .expr = switch (ft) {
                                                    .string => std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}) catch "",
                                                    .float => std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}) catch "",
                                                    .boolean => std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}) catch "",
                                                    else => std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}) catch "",
                                                },
                                                .state_type = ft,
                                            };
                                            self.local_count += 1;
                                        } else {
                                            self.setError("Too many local variables (limit: 64)");
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (self.curKind() == .semicolon) self.advance_token();
                    continue;
                }
                if (self.curKind() == .identifier) {
                    const var_name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .equals) {
                        self.advance_token();
                        if (self.isIdent("useState") or self.isIdent("useEffect") or
                            self.isIdent("useTransition") or self.isIdent("useSpring"))
                        {
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

                        // Computed arrays: items.filter(...) or text.split(...)
                        if (self.curKind() == .identifier) {
                            const source_name = self.curText();
                            const look = self.pos + 1;
                            if (look + 1 < self.lex.count and self.lex.get(look).kind == .dot) {
                                const method_tok = self.lex.get(look + 1);
                                if (method_tok.kind == .identifier) {
                                    const method = method_tok.text(self.source);

                                    // .filter(): const filtered = items.filter(item => item > 25)
                                    if (std.mem.eql(u8, method, "filter")) {
                                        if (self.isArrayState(source_name)) |state_idx| {
                                            self.advance_token(); // source identifier
                                            self.advance_token(); // .
                                            self.advance_token(); // filter
                                            if (self.curKind() == .lparen) self.advance_token(); // (
                                            if (self.curKind() == .lparen) self.advance_token(); // optional inner (
                                            const param_name = self.curText();
                                            self.advance_token(); // param
                                            if (self.curKind() == .rparen) self.advance_token(); // optional inner )
                                            if (self.curKind() == .arrow) self.advance_token(); // =>

                                            // Push param as local var to resolve in predicate
                                            const saved_lc = self.local_count;
                                            if (self.local_count < MAX_LOCALS) {
                                                self.local_vars[self.local_count] = .{ .name = param_name, .expr = "_item", .state_type = .int };
                                                self.local_count += 1;
                                            }
                                            const pred_expr = self.emitStateExpr() catch "";
                                            self.local_count = saved_lc;

                                            if (self.curKind() == .rparen) self.advance_token(); // closing )
                                            if (self.computed_count < MAX_COMPUTED_ARRAYS) {
                                                self.computed_arrays[self.computed_count] = .{
                                                    .name = var_name,
                                                    .kind = .filter,
                                                    .element_type = .int,
                                                    .source_slot = self.arraySlotId(state_idx),
                                                    .predicate_expr = pred_expr,
                                                    .predicate_param = param_name,
                                                    .separator = "",
                                                };
                                                self.computed_count += 1;
                                            } else {
                                                self.setError("Too many computed arrays (limit: 16)");
                                            }
                                            if (self.curKind() == .semicolon) self.advance_token();
                                            continue;
                                        }
                                    }

                                    // .split(): const parts = text.split(",")
                                    if (std.mem.eql(u8, method, "split")) {
                                        if (self.isState(source_name)) |state_idx| {
                                            if (self.stateTypeById(state_idx) == .string) {
                                                self.advance_token(); // source identifier
                                                self.advance_token(); // .
                                                self.advance_token(); // split
                                                if (self.curKind() == .lparen) self.advance_token(); // (
                                                var sep: []const u8 = ",";
                                                if (self.curKind() == .string) {
                                                    const raw = self.curText();
                                                    // Strip quotes
                                                    sep = if (raw.len >= 2) raw[1 .. raw.len - 1] else raw;
                                                    self.advance_token();
                                                }
                                                if (self.curKind() == .rparen) self.advance_token(); // )
                                                if (self.computed_count < MAX_COMPUTED_ARRAYS) {
                                                    self.computed_arrays[self.computed_count] = .{
                                                        .name = var_name,
                                                        .kind = .split,
                                                        .element_type = .string,
                                                        .source_slot = self.regularSlotId(state_idx),
                                                        .predicate_expr = "",
                                                        .predicate_param = "",
                                                        .separator = sep,
                                                    };
                                                    self.computed_count += 1;
                                                } else {
                                                    self.setError("Too many computed arrays (limit: 16)");
                                                }
                                                if (self.curKind() == .semicolon) self.advance_token();
                                                continue;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        const expr = self.emitStateExpr() catch {
                            self.advance_token();
                            continue;
                        };
                        const st = self.inferExprType(expr);

                        if (self.local_count < MAX_LOCALS) {
                            self.local_vars[self.local_count] = .{
                                .name = var_name,
                                .expr = expr,
                                .state_type = st,
                            };
                            self.local_count += 1;
                        } else {
                            self.setError("Too many local variables (limit: 64)");
                        }
                        if (self.curKind() == .semicolon) self.advance_token();
                        continue;
                    }
                }
                continue;
            }

            // Imperative blocks: switch, if, while, for in function body
            if (self.isIdent("switch") or self.isIdent("if") or
                self.isIdent("while") or self.isIdent("for"))
            {
                if (!found_imperative) {
                    imperative_start = self.pos;
                    found_imperative = true;
                }
                // Skip past the block (balanced braces)
                var depth: u32 = 0;
                while (self.pos < self.lex.count) {
                    if (self.curKind() == .lbrace) depth += 1;
                    if (self.curKind() == .rbrace) {
                        depth -= 1;
                        if (depth == 0) {
                            self.advance_token();
                            break;
                        }
                    }
                    self.advance_token();
                }
                continue;
            }

            self.advance_token();
        }

        // Record imperative body range
        if (found_imperative) {
            self.body_imperative_start = imperative_start;
            self.body_imperative_end = self.pos; // current pos is at 'return'
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
        var no_wrap: bool = false;
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
        var on_right_click_start: ?u32 = null;
        var on_right_click_end: ?u32 = null;
        var on_dismiss_start: ?u32 = null;
        var on_dismiss_end: ?u32 = null;
        var overlay_type_str: []const u8 = "";
        var overlay_visible_expr: []const u8 = "";
        var overlay_x_expr: []const u8 = "";
        var overlay_y_expr: []const u8 = "";
        var title_str: []const u8 = "";
        var width_str: []const u8 = "400";
        var height_str: []const u8 = "300";
        var placeholder_str: []const u8 = "";
        var language_str: []const u8 = "";
        var debug_name_str: []const u8 = "";
        var test_id_str: []const u8 = "";
        var canvas_type_str: []const u8 = "";

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
        const is_canvas = std.mem.eql(u8, tag_name, "Canvas");
        const is_overlay = std.mem.eql(u8, tag_name, "Overlay");

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
                    } else if (std.mem.eql(u8, attr_name, "noWrap")) {
                        try self.skipAttrValue();
                        no_wrap = true;
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
                    } else if (std.mem.eql(u8, attr_name, "type") and is_canvas) {
                        canvas_type_str = try self.parseStringAttr();
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
                    } else if (std.mem.eql(u8, attr_name, "onRightClick")) {
                        if (self.resolveHandlerProp(&on_right_click_start, &on_right_click_end)) {} else {
                            on_right_click_start = self.pos;
                            try self.skipBalanced();
                            on_right_click_end = self.pos;
                        }
                    } else if (std.mem.eql(u8, attr_name, "onDismiss") and is_overlay) {
                        if (self.resolveHandlerProp(&on_dismiss_start, &on_dismiss_end)) {} else {
                            on_dismiss_start = self.pos;
                            try self.skipBalanced();
                            on_dismiss_end = self.pos;
                        }
                    } else if (std.mem.eql(u8, attr_name, "type") and is_overlay) {
                        const type_val = try self.parseStringAttr();
                        if (std.mem.eql(u8, type_val, "context-menu")) overlay_type_str = "context_menu"
                        else if (std.mem.eql(u8, type_val, "modal")) overlay_type_str = "modal"
                        else if (std.mem.eql(u8, type_val, "tooltip")) overlay_type_str = "tooltip"
                        else if (std.mem.eql(u8, type_val, "popover")) overlay_type_str = "popover"
                        else overlay_type_str = "context_menu";
                    } else if (std.mem.eql(u8, attr_name, "visible") and is_overlay) {
                        overlay_visible_expr = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "x") and is_overlay) {
                        overlay_x_expr = try self.parseExprAttr();
                    } else if (std.mem.eql(u8, attr_name, "y") and is_overlay) {
                        overlay_y_expr = try self.parseExprAttr();
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
        var is_prop_text_ref = false; // true = text_content is a bare identifier (_p_name), emit without quoting
        var is_dynamic_text = false;
        var dyn_fmt: []const u8 = "";
        var dyn_args: []const u8 = "";
        var text_dep_slots: [MAX_DYN_DEPS]u32 = undefined;
        var text_dep_count: u32 = 0;

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
                        } else {
                            self.setError("Too many animation bindings (limit: 64)");
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
                        } else {
                            self.setError("Too many dynamic styles (limit: 128)");
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
                        } else {
                            self.setError("Too many routes (limit: 32)");
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
                            text_dep_slots = tl.dep_slots;
                            text_dep_count = tl.dep_count;
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
                            } else {
                                self.setError("Too many dynamic styles (limit: 128)");
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
                        } else {
                            self.setError("Too many conditionals (limit: 64)");
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
                        } else {
                            self.setError("Too many conditionals (limit: 64)");
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
                        if (self.findPropBinding(ident)) |binding| {
                            self.advance_token();
                            if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                                // Dynamic text prop in inline mode — re-parse the stored
                                // template literal with full state context available now.
                                // binding.value holds the raw backtick string (e.g., `${cpu}%`)
                                if (binding.value.len >= 2 and binding.value[0] == '`') {
                                    const inner = binding.value[1 .. binding.value.len - 1];
                                    if (std.mem.indexOf(u8, inner, "${") != null) {
                                        // Parse as template literal using the raw text
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
                                        // No interpolation — static text
                                        text_content = inner;
                                    }
                                } else {
                                    text_content = binding.value;
                                }
                            } else {
                                // Resolve value: function mode returns _p_name, inline returns concrete
                                const val = if (self.emit_prop_refs)
                                    (std.fmt.allocPrint(self.alloc, "_p_{s}", .{ident}) catch "")
                                else
                                    binding.value;
                                if (std.mem.startsWith(u8, val, "_p_")) {
                                    // Component function mode: prop param ref as text
                                    text_content = val;
                                    is_prop_text_ref = true;
                                } else if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                                    text_content = val[1 .. val.len - 1];
                                } else if (std.mem.startsWith(u8, val, "state.getSlot(")) {
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
                                    is_dynamic_text = true;
                                    dyn_fmt = "{d}";
                                    dyn_args = val;
                                } else {
                                    text_content = val;
                                }
                            }
                        } else if (self.isState(ident)) |slot_id| {
                            self.advance_token();
                            // Dynamic text from state variable
                            is_dynamic_text = true;
                            const st = self.stateTypeById(slot_id);
                            const rid = self.regularSlotId(slot_id);
                            text_dep_slots[0] = rid;
                            text_dep_count = 1;
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

        // Overlay element → separate overlay layer, not a normal child
        if (is_overlay) {
            // Emit dismiss handler early (before normal handler emission)
            var ov_dismiss_name: ?[]const u8 = null;
            if (on_dismiss_start) |start| {
                ov_dismiss_name = try std.fmt.allocPrint(self.alloc, "_handler_dismiss_{d}", .{self.handler_counter});
                self.handler_counter += 1;
                const body = try self.emitHandlerBody(start, on_dismiss_end.?);
                const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ ov_dismiss_name.?, body });
                try self.handler_decls.append(self.alloc, handler_fn);
            }
            return try self.emitOverlayElement(overlay_type_str, overlay_visible_expr, overlay_x_expr, overlay_y_expr, ov_dismiss_name, &child_exprs);
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
                    .dep_slots = text_dep_slots,
                    .dep_count = text_dep_count,
                };
                self.last_dyn_id = self.dyn_count;
                self.dyn_count += 1;
            } else {
                self.setError("Too many dynamic text bindings (limit: 128)");
            }
        } else if (text_content) |tc| {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            if (is_prop_text_ref) {
                // Bare identifier (component function param) — no quoting
                try fields.appendSlice(self.alloc, ".text = ");
                try fields.appendSlice(self.alloc, tc);
            } else {
                try fields.appendSlice(self.alloc, ".text = \"");
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
        }

        // Font size
        if (font_size.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".font_size = ");
            try fields.appendSlice(self.alloc, font_size);
        }

        // No wrap
        if (no_wrap) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".no_wrap = true");
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
                    ".type_script"
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
            if (std.mem.startsWith(u8, color_str, "_p_")) {
                // Component function param ref — emit as bare identifier
                try fields.appendSlice(self.alloc, color_str);
            } else {
                try fields.appendSlice(self.alloc, try self.parseColorValue(color_str));
            }
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

        // Canvas type
        if (is_canvas and canvas_type_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".canvas_type = \"");
            try fields.appendSlice(self.alloc, canvas_type_str);
            try fields.appendSlice(self.alloc, "\"");
        }

        // Handlers — create handler functions and collect their names
        var press_handler_name: ?[]const u8 = null;
        var change_handler_name: ?[]const u8 = null;
        var scroll_handler_name: ?[]const u8 = null;
        var key_handler_name: ?[]const u8 = null;
        var right_click_handler_name: ?[]const u8 = null;
        var dismiss_handler_name: ?[]const u8 = null;

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

        if (on_right_click_start) |start| {
            right_click_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_rclick_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_right_click_end.?);
            // Declare f32 params as _fx/_fy, then cast to i64 x/y for state slot compat
            const uses_x = std.mem.indexOf(u8, body, "x") != null;
            const uses_y = std.mem.indexOf(u8, body, "y") != null;
            var preamble_buf: std.ArrayListUnmanaged(u8) = .{};
            if (uses_x) {
                try preamble_buf.appendSlice(self.alloc, "    const x: i64 = @intFromFloat(_fx);\n");
            } else {
                try preamble_buf.appendSlice(self.alloc, "    _ = _fx;\n");
            }
            if (uses_y) {
                try preamble_buf.appendSlice(self.alloc, "    const y: i64 = @intFromFloat(_fy);\n");
            } else {
                try preamble_buf.appendSlice(self.alloc, "    _ = _fy;\n");
            }
            const preamble = try self.alloc.dupe(u8, preamble_buf.items);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}(_fx: f32, _fy: f32) void {{\n{s}    {s}\n}}", .{ right_click_handler_name.?, preamble, body });
            try self.handler_decls.append(self.alloc, handler_fn);
        }

        if (on_dismiss_start) |start| {
            dismiss_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_dismiss_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const body = try self.emitHandlerBody(start, on_dismiss_end.?);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ dismiss_handler_name.?, body });
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
        if (right_click_handler_name) |n| {
            if (hf.items.len > 0) try hf.appendSlice(self.alloc, ", ");
            try hf.appendSlice(self.alloc, ".on_right_click = ");
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
            if (iid < MAX_INPUTS) self.input_multiline[iid] = is_multiline;
            self.input_count += 1;
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".input_id = {d}", .{iid}));
            if (placeholder_str.len > 0) {
                try fields.appendSlice(self.alloc, ", .placeholder = \"");
                try fields.appendSlice(self.alloc, placeholder_str);
                try fields.appendSlice(self.alloc, "\"");
            }
            if (change_handler_name != null) {
                if (iid < MAX_INPUTS) self.input_change_handlers[iid] = change_handler_name;
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
            if (self.current_inline_component) |comp_name| {
                try arr_content.appendSlice(self.alloc, " // ");
                try arr_content.appendSlice(self.alloc, comp_name);
            }
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

            // Bind component instances to this array: match unbound instances
            // to their placeholder positions in child_exprs
            for (child_exprs.items, 0..) |expr, ci| {
                if (std.mem.eql(u8, expr, ".{}")) {
                    // Find the earliest unbound component instance
                    for (0..self.comp_instance_count) |cii| {
                        if (self.comp_instances[cii].parent_arr.len == 0) {
                            self.comp_instances[cii].parent_arr = arr_name;
                            self.comp_instances[cii].parent_idx = @intCast(ci);
                            break;
                        }
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
            // Track which child indices are already claimed to avoid double-assignment
            var claimed: [64]bool = [_]bool{false} ** 64;
            for (0..self.dyn_count) |di| {
                if (!self.dyn_texts[di].has_ref) {
                    // Find the next child index that has .text = "" and isn't claimed
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
                        if (self.pending_dyn_style_count < MAX_PENDING_DYN_STYLES) {
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
                        if (self.pending_dyn_style_count < MAX_PENDING_DYN_STYLES) {
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
                            if (self.pending_anim_count < MAX_PENDING_ANIM) {
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
        // Parse ="string" or ={"string"} or ={identifier}
        if (self.curKind() == .string) {
            const tok = self.cur();
            const raw = tok.text(self.source);
            self.advance_token();
            return raw[1 .. raw.len - 1];
        }
        if (self.curKind() == .lbrace) {
            self.advance_token();
            // Check for identifier (prop/local/state reference)
            if (self.curKind() == .identifier) {
                const name = self.curText();
                if (self.findProp(name)) |val| {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    if (std.mem.startsWith(u8, val, "_p_")) return val; // param ref
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
        dep_slots: [MAX_DYN_DEPS]u32,
        dep_count: u32,
    };

    fn parseTemplateLiteral(self: *Generator) !TemplateResult {
        const tok = self.cur();
        const raw = tok.text(self.source);
        // Strip backticks
        const inner = raw[1 .. raw.len - 1];
        return self.parseTemplateLiteralFromText(inner);
    }

    /// Parse a template literal from pre-stripped inner text (no backticks).
    /// Used both for token-based parsing and for deferred prop resolution.
    fn parseTemplateLiteralFromText(self: *Generator, inner: []const u8) !TemplateResult {

        // Check for ${...} patterns
        if (std.mem.indexOf(u8, inner, "${") == null) {
            return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
        }

        // Parse template parts
        var fmt: std.ArrayListUnmanaged(u8) = .{};
        var args: std.ArrayListUnmanaged(u8) = .{};
        var dep_slots: [MAX_DYN_DEPS]u32 = undefined;
        var dep_count: u32 = 0;
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
                    if (dep_count < MAX_DYN_DEPS) {
                        dep_slots[dep_count] = rid;
                        dep_count += 1;
                    }
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
                } else if (std.mem.indexOf(u8, expr, ".")) |dot_pos| blk: {
                    // Dotted expression in template: ${obj.field} or ${array.length}
                    const obj_name = expr[0..dot_pos];
                    const field_name = expr[dot_pos + 1 ..];

                    // Computed array property: ${filtered.length}
                    if (self.isComputedArray(obj_name)) |ci| {
                        if (std.mem.eql(u8, field_name, "length")) {
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "@as(i64, @intCast(_computed_{d}_count))", .{ci}));
                            break :blk;
                        }
                    }

                    // Array state property: ${items.length}
                    if (self.isArrayState(obj_name)) |arr_state_idx| {
                        if (std.mem.eql(u8, field_name, "length")) {
                            const arr_slot = self.arraySlotId(arr_state_idx);
                            try fmt.appendSlice(self.alloc, "{d}");
                            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "@as(i64, @intCast(state.getArrayLen({d})))", .{arr_slot}));
                            break :blk;
                        }
                    }

                    if (self.isObjectState(obj_name)) |obj_idx| {
                        if (self.resolveObjectField(obj_idx, field_name)) |state_idx| {
                            const rid = self.regularSlotId(state_idx);
                            if (dep_count < MAX_DYN_DEPS) {
                                dep_slots[dep_count] = rid;
                                dep_count += 1;
                            }
                            const ft = self.stateTypeById(state_idx);
                            switch (ft) {
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
                                else => {
                                    try fmt.appendSlice(self.alloc, "{d}");
                                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                                    try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                        "state.getSlot({d})", .{rid}));
                                },
                            }
                            break :blk;
                        }
                    }
                    // Not an object field — fall through to static text
                    try fmt.appendSlice(self.alloc, expr);
                } else if (self.findPropBinding(expr)) |binding| {
                    const pval = if (self.emit_prop_refs)
                        (std.fmt.allocPrint(self.alloc, "_p_{s}", .{expr}) catch "")
                    else
                        binding.value;
                    if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                        // Dynamic text prop in inline mode — re-parse raw template with state context
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
                                    if (dep_count < MAX_DYN_DEPS) {
                                        dep_slots[dep_count] = tmpl.dep_slots[di];
                                        dep_count += 1;
                                    }
                                }
                            } else {
                                try fmt.appendSlice(self.alloc, tmpl.static_text);
                            }
                        } else {
                            try fmt.appendSlice(self.alloc, binding.value);
                        }
                    } else if (pval.len >= 2 and (pval[0] == '"' or pval[0] == '\'')) {
                        // Static string prop — inline directly into format string
                        try fmt.appendSlice(self.alloc, pval[1 .. pval.len - 1]);
                    } else if (std.mem.startsWith(u8, pval, "_p_")) {
                        // Function mode parameter reference — string in template context
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    } else if (std.mem.startsWith(u8, pval, "state.getSlotString")) {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, pval);
                    } else {
                        // Numeric state getter or expression — use {d}
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
                    if (self.map_item_type != null and self.map_item_type.? == .string) {
                        try fmt.appendSlice(self.alloc, "{s}");
                    } else {
                        try fmt.appendSlice(self.alloc, "{d}");
                    }
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
                .dep_slots = dep_slots,
                .dep_count = dep_count,
            };
        }
        return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
    }

    // ── Handler body emission ───────────────────────────────────────

    fn emitHandlerBody(self: *Generator, start: u32, _: u32) ![]const u8 {
        // Parse the handler expression between start..end tokens
        const saved_pos = self.pos;
        self.pos = start;
        defer self.pos = saved_pos;

        // Skip opening {
        if (self.curKind() == .lbrace) self.advance_token();
        // Skip () => or (param) => or (param1, param2) =>
        if (self.curKind() == .lparen) self.advance_token();
        while (self.curKind() == .identifier or self.curKind() == .comma) {
            self.advance_token();
        }
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

            // ── Control flow ─────────────────────────────────────────
            // while (condition) { body }
            if (std.mem.eql(u8, name, "while")) {
                self.advance_token(); // skip 'while'
                if (self.curKind() == .lparen) self.advance_token(); // (
                const condition = try self.emitStateExpr();
                if (self.curKind() == .rparen) self.advance_token(); // )
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    var body = std.ArrayListUnmanaged(u8){};
                    try body.appendSlice(self.alloc, "while (");
                    try body.appendSlice(self.alloc, condition);
                    try body.appendSlice(self.alloc, ") {\n");
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        const stmt = try self.emitHandlerExpr();
                        if (stmt.len > 0) {
                            try body.appendSlice(self.alloc, "        ");
                            try body.appendSlice(self.alloc, stmt);
                            try body.appendSlice(self.alloc, "\n");
                        }
                        while (self.curKind() == .semicolon) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                    try body.appendSlice(self.alloc, "    }");
                    return try self.alloc.dupe(u8, body.items);
                }
            }

            // for (let i = 0; i < n; i++) { body }
            // → { var i: i64 = 0; while (i < n) : (i += 1) { body } }
            if (std.mem.eql(u8, name, "for")) {
                self.advance_token(); // skip 'for'
                if (self.curKind() == .lparen) self.advance_token(); // (

                // Init: let i = 0 or const i = 0
                var init_name: []const u8 = "_i";
                var init_val: []const u8 = "0";
                if (self.isIdent("let") or self.isIdent("const") or self.isIdent("var")) {
                    self.advance_token(); // let/const/var
                }
                if (self.curKind() == .identifier) {
                    init_name = self.curText();
                    self.advance_token();
                }
                if (self.curKind() == .equals) {
                    self.advance_token(); // =
                    init_val = try self.emitStateExpr();
                }
                if (self.curKind() == .semicolon) self.advance_token();

                // Push loop var as local so condition/body can resolve it
                const saved_lc = self.local_count;
                if (self.local_count < MAX_LOCALS) {
                    self.local_vars[self.local_count] = .{ .name = init_name, .expr = init_name, .state_type = .int };
                    self.local_count += 1;
                }

                // Condition: i < n
                const condition = try self.emitStateExpr();
                if (self.curKind() == .semicolon) self.advance_token();

                // Update: i++ or i += 1
                var update_str: []const u8 = try std.fmt.allocPrint(self.alloc, "{s} += 1", .{init_name});
                if (self.curKind() == .identifier) {
                    const upd_name = self.curText();
                    self.advance_token();
                    if (self.curKind() == .plus and self.pos + 1 < self.lex.count and self.lex.tokens[self.pos + 1].kind == .plus) {
                        // i++ → i += 1
                        self.advance_token(); // +
                        self.advance_token(); // +
                        update_str = try std.fmt.allocPrint(self.alloc, "{s} += 1", .{upd_name});
                    } else if (self.curKind() == .minus and self.pos + 1 < self.lex.count and self.lex.tokens[self.pos + 1].kind == .minus) {
                        // i-- → i -= 1
                        self.advance_token(); // -
                        self.advance_token(); // -
                        update_str = try std.fmt.allocPrint(self.alloc, "{s} -= 1", .{upd_name});
                    } else if (self.curKind() == .plus and self.pos + 1 < self.lex.count and self.lex.tokens[self.pos + 1].kind == .equals) {
                        // i += expr
                        self.advance_token(); // +
                        self.advance_token(); // =
                        const inc = try self.emitStateExpr();
                        update_str = try std.fmt.allocPrint(self.alloc, "{s} += {s}", .{ upd_name, inc });
                    }
                }
                if (self.curKind() == .rparen) self.advance_token(); // )

                // Body
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    var body = std.ArrayListUnmanaged(u8){};
                    try body.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{{ var {s}: i64 = {s}; while ({s}) : ({s}) {{\n", .{ init_name, init_val, condition, update_str }));
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        const stmt = try self.emitHandlerExpr();
                        if (stmt.len > 0) {
                            try body.appendSlice(self.alloc, "        ");
                            try body.appendSlice(self.alloc, stmt);
                            try body.appendSlice(self.alloc, "\n");
                        }
                        while (self.curKind() == .semicolon) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                    try body.appendSlice(self.alloc, "    } }");
                    self.local_count = saved_lc;
                    return try self.alloc.dupe(u8, body.items);
                }
                self.local_count = saved_lc;
            }

            // if (condition) { body } [else if (...) { ... }]* [else { ... }]
            if (std.mem.eql(u8, name, "if")) {
                return try self.emitIfStatement();
            }

            // switch (expr) { case val: stmts; break; ... default: stmts; }
            if (std.mem.eql(u8, name, "switch")) {
                return try self.emitSwitchStatement();
            }

            // break / continue
            if (std.mem.eql(u8, name, "break")) {
                self.advance_token();
                return try self.alloc.dupe(u8, "break;");
            }
            if (std.mem.eql(u8, name, "continue")) {
                self.advance_token();
                return try self.alloc.dupe(u8, "continue;");
            }
            if (std.mem.eql(u8, name, "return")) {
                self.advance_token();
                if (self.curKind() == .semicolon or self.curKind() == .rbrace or self.curKind() == .eof) {
                    return try self.alloc.dupe(u8, "return;");
                }
                const expr = try self.emitStateExpr();
                return try std.fmt.allocPrint(self.alloc, "return {s};", .{expr});
            }

            // Compound assignment: count += expr, count -= expr, count *= expr
            if (self.isState(name)) |raw_slot_id| {
                const peek1 = self.pos + 1;
                const peek2 = self.pos + 2;
                if (peek1 < self.lex.count and peek2 < self.lex.count and
                    self.lex.tokens[peek2].kind == .equals)
                {
                    const op_kind = self.lex.tokens[peek1].kind;
                    const op_str: ?[]const u8 = switch (op_kind) {
                        .plus => "+",
                        .minus => "-",
                        .star => "*",
                        .slash => "/",
                        .percent => "%",
                        else => null,
                    };
                    if (op_str) |op| {
                        const st = self.stateTypeById(raw_slot_id);
                        const slot_id = self.regularSlotId(raw_slot_id);
                        self.advance_token(); // skip identifier
                        self.advance_token(); // skip + - * / %
                        self.advance_token(); // skip =
                        const rhs = try self.emitStateExpr();
                        const getter = switch (st) {
                            .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{slot_id}),
                            .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{slot_id}),
                            .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{slot_id}),
                            else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id}),
                        };
                        return switch (st) {
                            .float => try std.fmt.allocPrint(self.alloc, "state.setSlotFloat({d}, ({s} {s} {s}));", .{ slot_id, getter, op, rhs }),
                            else => try std.fmt.allocPrint(self.alloc, "state.setSlot({d}, ({s} {s} {s}));", .{ slot_id, getter, op, rhs }),
                        };
                    }
                }
            }

            // Let var assignment: label = expr, bonus += expr, etc.
            if (self.isLetVar(name)) |lv| {
                const peek1 = self.pos + 1;
                const peek2 = self.pos + 2;
                // Compound assignment: bonus += expr, bonus -= expr, etc.
                if (peek1 < self.lex.count and peek2 < self.lex.count and
                    self.lex.tokens[peek2].kind == .equals)
                {
                    const op_kind = self.lex.tokens[peek1].kind;
                    const op_str: ?[]const u8 = switch (op_kind) {
                        .plus => "+",
                        .minus => "-",
                        .star => "*",
                        .slash => "/",
                        .percent => "%",
                        else => null,
                    };
                    if (op_str) |op| {
                        self.advance_token(); // skip identifier
                        self.advance_token(); // skip + - * / %
                        self.advance_token(); // skip =
                        const rhs = try self.emitStateExpr();
                        return try std.fmt.allocPrint(self.alloc, "{s} = ({s} {s} {s});", .{ lv.zig_name, lv.zig_name, op, rhs });
                    }
                }
                // Plain assignment: label = expr
                if (peek1 < self.lex.count and self.lex.tokens[peek1].kind == .equals) {
                    self.advance_token(); // skip identifier
                    self.advance_token(); // skip =
                    if (lv.state_type == .string) {
                        const rhs = try self.emitStateExpr();
                        return try std.fmt.allocPrint(self.alloc, "{s}_text = {s};", .{ lv.zig_name, rhs });
                    } else {
                        const rhs = try self.emitStateExpr();
                        return try std.fmt.allocPrint(self.alloc, "{s} = {s};", .{ lv.zig_name, rhs });
                    }
                }
            }

            // Check for object setter: setUser({ ...user, age: user.age + 1 })
            if (self.isObjectSetter(name)) |obj_idx| {
                self.advance_token(); // skip setter name
                if (self.curKind() == .lparen) self.advance_token(); // (
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {

                    // Check for spread: ...user
                    if (self.curKind() == .spread) {
                        self.advance_token(); // ...
                        if (self.curKind() == .identifier) self.advance_token(); // spread source
                        if (self.curKind() == .comma) self.advance_token(); // ,
                    }

                    // Parse explicit field overrides
                    var result = std.ArrayListUnmanaged(u8){};
                    while (self.curKind() == .identifier) {
                        const field = self.curText();
                        self.advance_token(); // field name
                        if (self.curKind() == .colon) self.advance_token(); // :
                        const value_expr = try self.emitStateExpr();
                        if (self.resolveObjectField(obj_idx, field)) |state_idx| {
                            const rid = self.regularSlotId(state_idx);
                            const ft = self.stateTypeById(state_idx);
                            const setter_str = switch (ft) {
                                .string => try std.fmt.allocPrint(self.alloc, "state.setSlotString({d}, {s});", .{ rid, value_expr }),
                                .float => try std.fmt.allocPrint(self.alloc, "state.setSlotFloat({d}, {s});", .{ rid, value_expr }),
                                .boolean => try std.fmt.allocPrint(self.alloc, "state.setSlotBool({d}, {s});", .{ rid, value_expr }),
                                else => try std.fmt.allocPrint(self.alloc, "state.setSlot({d}, {s});", .{ rid, value_expr }),
                            };
                            if (result.items.len > 0) try result.appendSlice(self.alloc, "\n    ");
                            try result.appendSlice(self.alloc, setter_str);
                        }
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token(); // }
                    if (self.curKind() == .rparen) self.advance_token(); // )
                    return try self.alloc.dupe(u8, result.items);
                }
            }

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
                    if (self.isIdent("pop")) {
                        self.advance_token(); // pop
                        if (self.curKind() == .lparen) self.advance_token();
                        if (self.curKind() == .rparen) self.advance_token();
                        return try std.fmt.allocPrint(self.alloc, "_ = state.popArraySlot({d});", .{slot_id});
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

            // Panel toggle: name() where name was imported via `import { name } from '@panels'`
            // Requires explicit import — no arbitrary strings, fully traceable.
            if (self.isPanelImport(name)) {
                self.advance_token(); // name
                if (self.curKind() == .lparen) self.advance_token(); // (
                if (self.curKind() == .rparen) self.advance_token(); // )
                self.has_panels = true;
                return try std.fmt.allocPrint(self.alloc,
                    "panels.toggle(\"{s}\");", .{name});
            }
        }

        // Safety: always advance to prevent infinite loops in computeBody
        self.advance_token();
        return "";
    }

    /// Parse if/else if/else chain → Zig if/else chain
    fn emitIfStatement(self: *Generator) anyerror![]const u8 {
        self.advance_token(); // skip 'if'
        if (self.curKind() == .lparen) self.advance_token(); // (
        const condition = try self.emitStateExpr();
        if (self.curKind() == .rparen) self.advance_token(); // )

        var result = std.ArrayListUnmanaged(u8){};
        try result.appendSlice(self.alloc, "if (");
        try result.appendSlice(self.alloc, condition);
        try result.appendSlice(self.alloc, ") {\n");

        // Parse body
        if (self.curKind() == .lbrace) {
            self.advance_token(); // {
            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                const stmt = try self.emitHandlerExpr();
                if (stmt.len > 0) {
                    try result.appendSlice(self.alloc, "        ");
                    try result.appendSlice(self.alloc, stmt);
                    try result.appendSlice(self.alloc, "\n");
                }
                while (self.curKind() == .semicolon) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
        } else {
            // Brace-less single statement: if (cond) return expr;
            const stmt = try self.emitHandlerExpr();
            if (stmt.len > 0) {
                try result.appendSlice(self.alloc, "        ");
                try result.appendSlice(self.alloc, stmt);
                try result.appendSlice(self.alloc, "\n");
            }
            while (self.curKind() == .semicolon) self.advance_token();
        }

        // Handle else / else if
        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "else")) {
            self.advance_token(); // skip 'else'
            if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "if")) {
                // else if — recurse
                try result.appendSlice(self.alloc, "    } else ");
                const else_if = try self.emitIfStatement();
                try result.appendSlice(self.alloc, else_if);
                return try self.alloc.dupe(u8, result.items);
            } else {
                // else { ... }
                try result.appendSlice(self.alloc, "    } else {\n");
                if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        const stmt = try self.emitHandlerExpr();
                        if (stmt.len > 0) {
                            try result.appendSlice(self.alloc, "        ");
                            try result.appendSlice(self.alloc, stmt);
                            try result.appendSlice(self.alloc, "\n");
                        }
                        while (self.curKind() == .semicolon) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                }
                try result.appendSlice(self.alloc, "    }");
                return try self.alloc.dupe(u8, result.items);
            }
        }

        try result.appendSlice(self.alloc, "    }");
        return try self.alloc.dupe(u8, result.items);
    }

    /// Parse switch/case → chained if/else if/else
    fn emitSwitchStatement(self: *Generator) anyerror![]const u8 {
        self.advance_token(); // skip 'switch'
        if (self.curKind() == .lparen) self.advance_token(); // (
        const switch_expr = try self.emitStateExpr();
        if (self.curKind() == .rparen) self.advance_token(); // )
        if (self.curKind() == .lbrace) self.advance_token(); // {

        var result = std.ArrayListUnmanaged(u8){};
        var first_case = true;

        while (self.curKind() != .rbrace and self.curKind() != .eof) {
            if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "case")) {
                self.advance_token(); // skip 'case'
                const case_val = try self.emitStateExpr();
                if (self.curKind() == .colon) self.advance_token(); // :

                if (first_case) {
                    try result.appendSlice(self.alloc, "if (");
                    first_case = false;
                } else {
                    try result.appendSlice(self.alloc, " else if (");
                }
                try result.appendSlice(self.alloc, switch_expr);
                try result.appendSlice(self.alloc, " == ");
                try result.appendSlice(self.alloc, case_val);
                try result.appendSlice(self.alloc, ") {\n");

                // Parse statements until break/case/default/}
                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                    if (self.curKind() == .identifier) {
                        const kw = self.curText();
                        if (std.mem.eql(u8, kw, "break")) {
                            self.advance_token();
                            if (self.curKind() == .semicolon) self.advance_token();
                            break;
                        }
                        if (std.mem.eql(u8, kw, "case") or std.mem.eql(u8, kw, "default")) break;
                    }
                    const stmt = try self.emitHandlerExpr();
                    if (stmt.len > 0) {
                        try result.appendSlice(self.alloc, "        ");
                        try result.appendSlice(self.alloc, stmt);
                        try result.appendSlice(self.alloc, "\n");
                    }
                    while (self.curKind() == .semicolon) self.advance_token();
                }
                try result.appendSlice(self.alloc, "    }");
            } else if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "default")) {
                self.advance_token(); // skip 'default'
                if (self.curKind() == .colon) self.advance_token(); // :

                if (first_case) {
                    try result.appendSlice(self.alloc, "{\n");
                } else {
                    try result.appendSlice(self.alloc, " else {\n");
                }

                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                    if (self.curKind() == .identifier) {
                        const kw = self.curText();
                        if (std.mem.eql(u8, kw, "break")) {
                            self.advance_token();
                            if (self.curKind() == .semicolon) self.advance_token();
                            break;
                        }
                        if (std.mem.eql(u8, kw, "case")) break;
                    }
                    const stmt = try self.emitHandlerExpr();
                    if (stmt.len > 0) {
                        try result.appendSlice(self.alloc, "        ");
                        try result.appendSlice(self.alloc, stmt);
                        try result.appendSlice(self.alloc, "\n");
                    }
                    while (self.curKind() == .semicolon) self.advance_token();
                }
                try result.appendSlice(self.alloc, "    }");
            } else {
                self.advance_token(); // skip unexpected tokens
            }
        }
        if (self.curKind() == .rbrace) self.advance_token(); // closing }

        return try self.alloc.dupe(u8, result.items);
    }

    fn emitStateExpr(self: *Generator) ![]const u8 {
        return try self.emitTernary();
    }

    fn emitTernary(self: *Generator) ![]const u8 {
        const cond = try self.emitLogicalOr();
        // Nullish coalescing: expr ?? default
        if (self.curKind() == .question_question) {
            self.advance_token(); // skip ??
            const fallback = try self.emitTernary();
            // String: non-empty check. Int: non-zero check.
            if (self.isStringExpr(cond)) {
                return try std.fmt.allocPrint(self.alloc, "(if ({s}.len > 0) {s} else {s})", .{ cond, cond, fallback });
            } else {
                return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, cond, fallback });
            }
        }
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
        var left = try self.emitBitwiseOr();
        while (self.curKind() == .amp_amp) {
            self.advance_token();
            const right = try self.emitBitwiseOr();
            left = try std.fmt.allocPrint(self.alloc, "({s} and {s})", .{ left, right });
        }
        return left;
    }

    fn emitBitwiseOr(self: *Generator) ![]const u8 {
        var left = try self.emitBitwiseXor();
        while (self.curKind() == .pipe) {
            self.advance_token();
            const right = try self.emitBitwiseXor();
            left = try std.fmt.allocPrint(self.alloc, "({s} | {s})", .{ left, right });
        }
        return left;
    }

    fn emitBitwiseXor(self: *Generator) ![]const u8 {
        var left = try self.emitBitwiseAnd();
        while (self.curKind() == .caret) {
            self.advance_token();
            const right = try self.emitBitwiseAnd();
            left = try std.fmt.allocPrint(self.alloc, "({s} ^ {s})", .{ left, right });
        }
        return left;
    }

    fn emitBitwiseAnd(self: *Generator) ![]const u8 {
        var left = try self.emitEquality();
        while (self.curKind() == .ampersand) {
            self.advance_token();
            const right = try self.emitEquality();
            left = try std.fmt.allocPrint(self.alloc, "({s} & {s})", .{ left, right });
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
        var left = try self.emitShift();
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
            const right = try self.emitShift();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitShift(self: *Generator) ![]const u8 {
        var left = try self.emitAdditive();
        while (self.curKind() == .shift_left or self.curKind() == .shift_right) {
            const op: []const u8 = if (self.curKind() == .shift_left) "<<" else ">>";
            self.advance_token();
            const right = try self.emitAdditive();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} @intCast({s}))", .{ left, op, right });
        }
        return left;
    }

    fn isStringExpr(_: *Generator, expr: []const u8) bool {
        if (expr.len >= 2 and expr[0] == '"') return true;
        if (std.mem.indexOf(u8, expr, "getSlotString") != null) return true;
        if (std.mem.indexOf(u8, expr, "std.mem.") != null) return true;
        if (std.mem.indexOf(u8, expr, "toUpper") != null) return true;
        if (std.mem.indexOf(u8, expr, "toLower") != null) return true;
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
            // Plus — check if this is string concatenation
            self.advance_token();
            const right = try self.emitMultiplicative();
            if (self.isStringExpr(left) or self.isStringExpr(right)) {
                // Collect all + operands (left and right already have first two)
                var parts = std.ArrayListUnmanaged([]const u8){};
                try parts.append(self.alloc, left);
                try parts.append(self.alloc, right);
                while (self.curKind() == .plus) {
                    self.advance_token();
                    const next = try self.emitMultiplicative();
                    try parts.append(self.alloc, next);
                }
                // Build bufPrint format string and args
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
        // Template literal in expression context (e.g., prop value: value={`${cpu}%`})
        if (self.curKind() == .template_literal) {
            const tmpl = try self.parseTemplateLiteral();
            self.advance_token(); // consume template_literal token
            if (!tmpl.is_dynamic) {
                return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{tmpl.static_text});
            }
            // Dynamic: allocate a buffer and return a bufPrint expression
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
            // Component prop resolution — check before state/locals
            // When inside a component body, prop identifiers resolve to
            // their bound value (inline mode) or _p_name (function mode)
            if (self.findProp(name)) |prop_val| {
                self.advance_token();
                return prop_val;
            }
            // typeof → resolve statically to type string
            if (std.mem.eql(u8, name, "typeof")) {
                self.advance_token(); // skip 'typeof'
                if (self.curKind() == .identifier) {
                    const type_name = self.curText();
                    self.advance_token();
                    // Resolve type from state, local var, or default
                    const resolved_type: []const u8 = if (self.isState(type_name)) |sid|
                        switch (self.stateTypeById(sid)) {
                            .string => "\"string\"",
                            .float => "\"number\"",
                            .boolean => "\"boolean\"",
                            .int => "\"number\"",
                            .array => "\"object\"",
                        }
                    else if (self.isArrayState(type_name) != null)
                        "\"object\""
                    else
                        "\"undefined\"";
                    return try self.alloc.dupe(u8, resolved_type);
                }
                return try self.alloc.dupe(u8, "\"undefined\"");
            }
            // Computed array: filtered.length, filtered.includes(), filtered[i]
            if (self.isComputedArray(name)) |ci| {
                self.advance_token(); // identifier
                if (self.curKind() == .lbracket) {
                    self.advance_token(); // [
                    const index_expr = try self.emitStateExpr();
                    if (self.curKind() == .rbracket) self.advance_token(); // ]
                    if (self.computed_arrays[ci].element_type == .string) {
                        return try std.fmt.allocPrint(self.alloc, "_computed_{d}[@intCast({s})]", .{ ci, index_expr });
                    }
                    return try std.fmt.allocPrint(self.alloc, "@as(i64, _computed_{d}[@intCast({s})])", .{ ci, index_expr });
                }
                if (self.curKind() == .dot) {
                    self.advance_token(); // .
                    if (self.curKind() == .identifier) {
                        const method = self.curText();
                        if (std.mem.eql(u8, method, "length")) {
                            self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(_computed_{d}_count))", .{ci});
                        }
                        if (std.mem.eql(u8, method, "includes")) {
                            self.advance_token(); // includes
                            if (self.curKind() == .lparen) self.advance_token();
                            const val_expr = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "(blk_{d}: {{ for (_computed_{d}[0.._computed_{d}_count]) |_el| {{ if (_el == {s}) break :blk_{d} true; }} break :blk_{d} false; }})",
                                .{ lbl, ci, ci, val_expr, lbl, lbl });
                        }
                        if (std.mem.eql(u8, method, "indexOf")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const val_expr = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ for (_computed_{d}[0.._computed_{d}_count], 0..) |_el, _idx| {{ if (_el == {s}) break :blk_{d} @as(i64, @intCast(_idx)); }} break :blk_{d} -1; }})",
                                .{ lbl, ci, ci, val_expr, lbl, lbl });
                        }
                        if (std.mem.eql(u8, method, "find")) {
                            self.advance_token(); // find
                            if (self.curKind() == .lparen) self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const item_name = self.curText();
                            self.advance_token();
                            if (self.curKind() == .rparen) self.advance_token();
                            if (self.curKind() == .arrow) self.advance_token();
                            const saved_lc = self.local_count;
                            if (self.local_count < MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{ .name = item_name, .expr = "_el", .state_type = self.computed_arrays[ci].element_type };
                                self.local_count += 1;
                            }
                            const pred_expr = try self.emitStateExpr();
                            self.local_count = saved_lc;
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ for (_computed_{d}[0.._computed_{d}_count]) |_el| {{ if ({s}) break :blk_{d} _el; }} break :blk_{d} 0; }})",
                                .{ lbl, ci, ci, pred_expr, lbl, lbl });
                        }
                        if (std.mem.eql(u8, method, "reduce")) {
                            self.advance_token(); // reduce
                            if (self.curKind() == .lparen) self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const acc_name = self.curText();
                            self.advance_token();
                            if (self.curKind() == .comma) self.advance_token();
                            const item_name = self.curText();
                            self.advance_token();
                            if (self.curKind() == .rparen) self.advance_token();
                            if (self.curKind() == .arrow) self.advance_token();
                            const saved_lc = self.local_count;
                            if (self.local_count + 1 < MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{ .name = acc_name, .expr = "_acc", .state_type = .int };
                                self.local_count += 1;
                                self.local_vars[self.local_count] = .{ .name = item_name, .expr = "_el", .state_type = self.computed_arrays[ci].element_type };
                                self.local_count += 1;
                            }
                            const body_expr = try self.emitStateExpr();
                            self.local_count = saved_lc;
                            if (self.curKind() == .comma) self.advance_token();
                            const initial = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ var _acc: i64 = {s}; for (_computed_{d}[0.._computed_{d}_count]) |_el| {{ _acc = {s}; }} break :blk_{d} _acc; }})",
                                .{ lbl, initial, ci, ci, body_expr, lbl });
                        }
                    }
                }
                // Bare computed array name — return count (same as array without .length)
                return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(_computed_{d}_count))", .{ci});
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
                    if (self.curKind() == .identifier) {
                        const method = self.curText();
                        const arr_slot = self.arraySlotId(state_idx);

                        if (std.mem.eql(u8, method, "length")) {
                            self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(state.getArrayLen({d})))", .{arr_slot});
                        }

                        // .includes(value) → block expr loop with equality check
                        if (std.mem.eql(u8, method, "includes")) {
                            self.advance_token(); // includes
                            if (self.curKind() == .lparen) self.advance_token();
                            const val_expr = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "(blk_{d}: {{ const _sl = state.getArraySlot({d}); for (_sl) |_el| {{ if (_el == {s}) break :blk_{d} true; }} break :blk_{d} false; }})",
                                .{ lbl, arr_slot, val_expr, lbl, lbl });
                        }

                        // .indexOf(value) → block expr loop, returns index or -1
                        if (std.mem.eql(u8, method, "indexOf")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const val_expr = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ const _sl = state.getArraySlot({d}); for (_sl, 0..) |_el, _idx| {{ if (_el == {s}) break :blk_{d} @as(i64, @intCast(_idx)); }} break :blk_{d} -1; }})",
                                .{ lbl, arr_slot, val_expr, lbl, lbl });
                        }

                        // .find(item => expr) → block expr loop, returns first match or 0
                        if (std.mem.eql(u8, method, "find")) {
                            self.advance_token(); // find
                            if (self.curKind() == .lparen) self.advance_token(); // (
                            // Parse callback: (item) => expr  or  item => expr
                            if (self.curKind() == .lparen) self.advance_token(); // optional (
                            const item_name = self.curText();
                            self.advance_token(); // param
                            if (self.curKind() == .rparen) self.advance_token(); // optional )
                            if (self.curKind() == .arrow) self.advance_token(); // =>

                            // Push param as local var
                            const saved_lc = self.local_count;
                            if (self.local_count < MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{ .name = item_name, .expr = "_el", .state_type = .int };
                                self.local_count += 1;
                            }
                            const pred_expr = try self.emitStateExpr();
                            self.local_count = saved_lc;

                            if (self.curKind() == .rparen) self.advance_token(); // closing )
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ const _sl = state.getArraySlot({d}); for (_sl) |_el| {{ if ({s}) break :blk_{d} _el; }} break :blk_{d} 0; }})",
                                .{ lbl, arr_slot, pred_expr, lbl, lbl });
                        }

                        // .reduce((acc, item) => expr, initial) → block expr with accumulator
                        if (std.mem.eql(u8, method, "reduce")) {
                            self.advance_token(); // reduce
                            if (self.curKind() == .lparen) self.advance_token(); // (
                            // Parse callback: (acc, item) => expr
                            if (self.curKind() == .lparen) self.advance_token(); // (
                            const acc_name = self.curText();
                            self.advance_token(); // acc
                            if (self.curKind() == .comma) self.advance_token(); // ,
                            const item_name = self.curText();
                            self.advance_token(); // item
                            if (self.curKind() == .rparen) self.advance_token(); // )
                            if (self.curKind() == .arrow) self.advance_token(); // =>

                            // Push acc and item as local vars
                            const saved_lc = self.local_count;
                            if (self.local_count + 1 < MAX_LOCALS) {
                                self.local_vars[self.local_count] = .{ .name = acc_name, .expr = "_acc", .state_type = .int };
                                self.local_count += 1;
                                self.local_vars[self.local_count] = .{ .name = item_name, .expr = "_el", .state_type = .int };
                                self.local_count += 1;
                            }
                            const body_expr = try self.emitStateExpr();
                            self.local_count = saved_lc;

                            // Parse initial value
                            if (self.curKind() == .comma) self.advance_token(); // ,
                            const initial = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token(); // closing )

                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "@as(i64, blk_{d}: {{ var _acc: i64 = {s}; const _sl = state.getArraySlot({d}); for (_sl) |_el| {{ _acc = {s}; }} break :blk_{d} _acc; }})",
                                .{ lbl, initial, arr_slot, body_expr, lbl });
                        }
                    }
                }
                // Array getter without .length — return count as i64
                const arr_slot = self.arraySlotId(state_idx);
                return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast(state.getArrayLen({d})))", .{arr_slot});
            }
            // Object property access: user.name or user?.name
            if (self.isObjectState(name)) |obj_idx| {
                self.advance_token(); // identifier (e.g., "user")
                // Handle both . and ?. (optional chaining — object state is never null, treat same)
                if (self.curKind() == .dot or self.curKind() == .question) {
                    if (self.curKind() == .question) {
                        self.advance_token(); // ?
                    }
                    if (self.curKind() == .dot) self.advance_token(); // .
                    const field = self.curText();
                    self.advance_token(); // field name
                    if (self.resolveObjectField(obj_idx, field)) |state_idx| {
                        const rid = self.regularSlotId(state_idx);
                        const ft = self.stateTypeById(state_idx);
                        return switch (ft) {
                            .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                            .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                            .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                            else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                        };
                    }
                }
            }
            // State getter
            if (self.isState(name)) |slot_id| {
                self.advance_token();
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);

                // String method calls: name.method() or name.length
                if (st == .string and self.curKind() == .dot) {
                    const getter = try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid});
                    const dot_pos = self.pos;
                    self.advance_token(); // skip .
                    if (self.curKind() == .identifier) {
                        const method = self.curText();

                        // .length → str.len (returns i64)
                        if (std.mem.eql(u8, method, "length")) {
                            self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast({s}.len))", .{getter});
                        }

                        // .includes(sub) → std.mem.indexOf(u8, str, sub) != null
                        if (std.mem.eql(u8, method, "includes")) {
                            self.advance_token(); // method
                            if (self.curKind() == .lparen) self.advance_token();
                            const arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "(std.mem.indexOf(u8, {s}, {s}) != null)", .{ getter, arg });
                        }

                        // .indexOf(sub) → indexOf or -1
                        if (std.mem.eql(u8, method, "indexOf")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "@as(i64, if (std.mem.indexOf(u8, {s}, {s})) |idx| @as(i64, @intCast(idx)) else -1)", .{ getter, arg });
                        }

                        // .startsWith(prefix) → std.mem.startsWith
                        if (std.mem.eql(u8, method, "startsWith")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "std.mem.startsWith(u8, {s}, {s})", .{ getter, arg });
                        }

                        // .endsWith(suffix) → std.mem.endsWith
                        if (std.mem.eql(u8, method, "endsWith")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "std.mem.endsWith(u8, {s}, {s})", .{ getter, arg });
                        }

                        // .trim() → std.mem.trim
                        if (std.mem.eql(u8, method, "trim")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "std.mem.trim(u8, {s}, \" \\t\\n\\r\")", .{getter});
                        }

                        // .slice(start, end) → str[start..end]
                        if (std.mem.eql(u8, method, "slice")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const start_expr = try self.emitStateExpr();
                            var end_expr: []const u8 = try std.fmt.allocPrint(self.alloc, "{s}.len", .{getter});
                            if (self.curKind() == .comma) {
                                self.advance_token();
                                end_expr = try self.emitStateExpr();
                            }
                            if (self.curKind() == .rparen) self.advance_token();
                            return try std.fmt.allocPrint(self.alloc, "{s}[@intCast({s})..@intCast({s})]", .{ getter, start_expr, end_expr });
                        }

                        // .toUpperCase() / .toLowerCase() → inline block with buffer
                        if (std.mem.eql(u8, method, "toUpperCase")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "(blk_{d}: {{ const _src = {s}; var _ub: [256]u8 = undefined; for (_src, 0..) |ch, ci| {{ _ub[ci] = std.ascii.toUpper(ch); }} break :blk_{d} _ub[0.._src.len]; }})",
                                .{ lbl, getter, lbl });
                        }
                        if (std.mem.eql(u8, method, "toLowerCase")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "(blk_{d}: {{ const _src = {s}; var _lb: [256]u8 = undefined; for (_src, 0..) |ch, ci| {{ _lb[ci] = std.ascii.toLower(ch); }} break :blk_{d} _lb[0.._src.len]; }})",
                                .{ lbl, getter, lbl });
                        }

                        // .replace(old, new) → inline block with std.mem.replace
                        if (std.mem.eql(u8, method, "replace")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const old_arg = try self.emitStateExpr();
                            if (self.curKind() == .comma) self.advance_token();
                            const new_arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            const lbl = self.array_counter;
                            self.array_counter += 1;
                            return try std.fmt.allocPrint(self.alloc,
                                "(blk_{d}: {{ var _rb: [512]u8 = undefined; const _rn = std.mem.replace(u8, {s}, {s}, {s}, &_rb); break :blk_{d} _rb[0.._rn]; }})",
                                .{ lbl, getter, old_arg, new_arg, lbl });
                        }

                        // .split(sep).length → count occurrences + 1
                        if (std.mem.eql(u8, method, "split")) {
                            self.advance_token();
                            if (self.curKind() == .lparen) self.advance_token();
                            const sep_arg = try self.emitStateExpr();
                            if (self.curKind() == .rparen) self.advance_token();
                            // Check if followed by .length
                            if (self.curKind() == .dot) {
                                const dot_save = self.pos;
                                self.advance_token();
                                if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "length")) {
                                    self.advance_token();
                                    const lbl = self.array_counter;
                                    self.array_counter += 1;
                                    return try std.fmt.allocPrint(self.alloc,
                                        "@as(i64, blk_{d}: {{ var _cnt: i64 = 1; for ({s}) |ch| {{ if (ch == {s}[0]) _cnt += 1; }} break :blk_{d} _cnt; }})",
                                        .{ lbl, getter, sep_arg, lbl });
                                }
                                self.pos = dot_save;
                            }
                            // Bare .split() without .length — return the string as-is (can't return iterator)
                            return try self.alloc.dupe(u8, getter);
                        }
                    }
                    // Not a known method — rewind dot
                    self.pos = dot_pos;
                }

                // In animation target context, use float getter (getSlot returns i64, can't @floatCast)
                if (self.emit_float_as_f32) {
                    return try std.fmt.allocPrint(self.alloc, "@as(f32, @floatCast(state.getSlotFloat({d})))", .{rid});
                }
                return switch (st) {
                    .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                    .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                    .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                    else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                };
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
            // Utility function call: clamp(a, b, c)
            if (self.isUtilFunc(name)) |_| {
                self.advance_token(); // skip function name
                if (self.curKind() == .lparen) self.advance_token(); // (
                var call_args = std.ArrayListUnmanaged(u8){};
                try call_args.appendSlice(self.alloc, name);
                try call_args.appendSlice(self.alloc, "(");
                var arg_idx: u32 = 0;
                while (self.curKind() != .rparen and self.curKind() != .eof) {
                    if (arg_idx > 0) try call_args.appendSlice(self.alloc, ", ");
                    const arg = try self.emitStateExpr();
                    try call_args.appendSlice(self.alloc, arg);
                    arg_idx += 1;
                    if (self.curKind() == .comma) self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token(); // )
                try call_args.appendSlice(self.alloc, ")");
                return try self.alloc.dupe(u8, call_args.items);
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
            if (self.current_inline_component) |comp_name| {
                try arr_content.appendSlice(self.alloc, " // ");
                try arr_content.appendSlice(self.alloc, comp_name);
            }
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

    fn emitOverlayElement(self: *Generator, kind_str: []const u8, visible_expr: []const u8, x_expr: []const u8, y_expr: []const u8, dismiss_handler: ?[]const u8, child_exprs: *std.ArrayListUnmanaged([]const u8)) ![]const u8 {
        const ov_idx = self.overlay_count;
        if (ov_idx >= MAX_OVERLAYS) {
            self.last_dyn_id = null;
            return try self.alloc.dupe(u8, ".{ .style = .{ .display = .none } }");
        }
        const arrays_start: u32 = @intCast(self.array_decls.items.len);

        // Create array for overlay children
        if (child_exprs.items.len > 0) {
            const arr_name = try std.fmt.allocPrint(self.alloc, "_ov{d}_arr_{d}", .{ ov_idx, self.array_counter });
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

            const root_name = try std.fmt.allocPrint(self.alloc, "_ov{d}_root", .{ov_idx});
            const root_decl = try std.fmt.allocPrint(self.alloc, "var {s} = Node{{ .children = &{s} }};", .{ root_name, arr_name });
            try self.array_decls.append(self.alloc, root_decl);

            const root_expr = try std.fmt.allocPrint(self.alloc, "&{s}", .{root_name});

            // Resolve state variable names to state.getSlot() calls
            const resolved_visible = if (visible_expr.len > 0)
                (if (self.isState(visible_expr)) |slot|
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot})
                else
                    visible_expr)
            else
                visible_expr;
            const resolved_x = if (x_expr.len > 0)
                (if (self.isState(x_expr)) |slot|
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot})
                else
                    x_expr)
            else
                x_expr;
            const resolved_y = if (y_expr.len > 0)
                (if (self.isState(y_expr)) |slot|
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot})
                else
                    y_expr)
            else
                y_expr;

            self.overlays[ov_idx] = .{
                .kind = if (kind_str.len > 0) kind_str else "context_menu",
                .root_expr = root_expr,
                .visible_expr = resolved_visible,
                .x_expr = resolved_x,
                .y_expr = resolved_y,
                .dismiss_handler = dismiss_handler,
                .arrays_start = arrays_start,
                .arrays_end = @intCast(self.array_decls.items.len),
            };
            self.overlay_count += 1;
            self.has_overlays = true;
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
        const computed_idx = self.isComputedArray(array_name);
        const state_idx = if (computed_idx == null) self.isArrayState(array_name) else null;

        if (computed_idx == null and state_idx == null) {
            self.advance_token();
            return ".{}";
        }

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
        if (computed_idx) |ci| {
            self.map_item_type = self.computed_arrays[ci].element_type;
        }

        // Parse the JSX template
        const template = try self.parseMapTemplate();

        // Clear map context
        self.map_item_param = null;
        self.map_index_param = null;
        self.map_item_type = null;

        // Skip optional ) after JSX
        if (had_paren and self.curKind() == .rparen) self.advance_token();

        // Skip ) closing map call
        if (self.curKind() == .rparen) self.advance_token();

        // Record map info
        if (self.map_count < MAX_MAPS) {
            if (computed_idx) |ci| {
                self.maps[self.map_count] = .{
                    .array_slot_id = 0,
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
                    .is_computed = true,
                    .computed_idx = ci,
                    .computed_element_type = self.computed_arrays[ci].element_type,
                };
            } else {
                self.maps[self.map_count] = .{
                    .array_slot_id = self.arraySlotId(state_idx.?),
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
            }
            self.map_count += 1;
        } else {
            self.setError("Too many .map() lists (limit: 32)");
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

        var inner_nodes: [MAX_MAP_INNER]MapInnerNode = undefined;
        var inner_count: u32 = 0;

        if (!is_self_closing) {
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    const child = try self.parseMapTemplateChild();
                    if (inner_count < MAX_MAP_INNER) {
                        inner_nodes[inner_count] = child;
                        inner_count += 1;
                    }
                } else if (self.curKind() == .lbrace) {
                    self.advance_token(); // {
                    if (self.curKind() == .template_literal) {
                        const tl = try self.parseTemplateLiteral();
                        self.advance_token(); // template literal token
                        // Text on the outer element itself (Text element case)
                        if (is_text and inner_count < MAX_MAP_INNER) {
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

    /// Rewrite setter calls in <script> JS.
    /// setFoo(val) -> __setState(N, val) / __setStateString(N, val)
    fn rewriteSetterCalls(self: *Generator, js: []const u8) ![]const u8 {
        var result: std.ArrayListUnmanaged(u8) = .{};
        var line_iter = std.mem.splitScalar(u8, js, '\n');
        var first_line = true;
        while (line_iter.next()) |line| {
            const trimmed = std.mem.trim(u8, line, &[_]u8{ ' ', '\t', '\r' });
            if (std.mem.indexOf(u8, trimmed, "useState(") != null) continue;
            if (trimmed.len == 0 and first_line) continue;
            first_line = false;
            var i: usize = 0;
            while (i < line.len) {
                var matched = false;
                for (0..self.state_count) |si| {
                    const setter = self.state_slots[si].setter;
                    if (i + setter.len + 1 <= line.len and
                        std.mem.eql(u8, line[i .. i + setter.len], setter) and
                        line[i + setter.len] == '(')
                    {
                        if (i > 0 and isIdentByte(line[i - 1])) break;
                        const is_string = std.meta.activeTag(self.state_slots[si].initial) == .string;
                        const fn_name = if (is_string) "__setStateString" else "__setState";
                        try result.appendSlice(self.alloc, fn_name);
                        try result.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "({d}, ", .{si}));
                        i += setter.len + 1;
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    try result.append(self.alloc, line[i]);
                    i += 1;
                }
            }
            try result.append(self.alloc, '\n');
        }
        return try result.toOwnedSlice(self.alloc);
    }

    // ── Zig source emission ─────────────────────────────────────────

    fn emitZigSource(self: *Generator, root_expr: []const u8) ![]const u8 {
        var out: std.ArrayListUnmanaged(u8) = .{};

        // Header
        try out.appendSlice(self.alloc, "//! Generated by tsz compiler (Zig) — do not edit\n//!\n");
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "//! Source: {s}\n\n", .{std.fs.path.basename(self.input_file)}));

        // Imports — minimal set for <script> mode (no compositor/gpu/wgpu)
        const has_script = self.compute_js != null;
        try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
        try out.appendSlice(self.alloc, "const c = @import(\"framework/c.zig\").imports;\n");
        try out.appendSlice(self.alloc, "const layout = @import(\"framework/layout.zig\");\n");
        try out.appendSlice(self.alloc, "const text_mod = @import(\"framework/text.zig\");\n");
        try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\nconst LayoutRect = layout.LayoutRect;\n");
        try out.appendSlice(self.alloc, "const TextEngine = text_mod.TextEngine;\n");
        if (!has_script) {
            try out.appendSlice(self.alloc, "const image_mod = @import(\"framework/image.zig\");\nconst ImageCache = image_mod.ImageCache;\n");
            try out.appendSlice(self.alloc, "const events = @import(\"framework/events.zig\");\n");
            try out.appendSlice(self.alloc, "const mpv_mod = @import(\"framework/mpv.zig\");\n");
            try out.appendSlice(self.alloc, "const win_mgr = @import(\"framework/windows.zig\");\n");
            try out.appendSlice(self.alloc, "const watchdog = @import(\"framework/watchdog.zig\");\n");
            try out.appendSlice(self.alloc, "const leaktest = @import(\"framework/leaktest.zig\");\n");
            try out.appendSlice(self.alloc, "const input_mod = @import(\"framework/input.zig\");\n");
            try out.appendSlice(self.alloc, "const geometry = @import(\"framework/geometry.zig\");\n");
            try out.appendSlice(self.alloc, "const compositor = @import(\"framework/compositor.zig\");\n");
            try out.appendSlice(self.alloc, "const gpu = @import(\"framework/gpu.zig\");\n");
            try out.appendSlice(self.alloc, "const telemetry = @import(\"framework/telemetry.zig\");\n");
            try out.appendSlice(self.alloc, "const overlay_mod = @import(\"framework/overlay.zig\");\n");
            try out.appendSlice(self.alloc, "const inspector = @import(\"framework/inspector.zig\");\n");
            if (self.anim_hook_count > 0) try out.appendSlice(self.alloc, "const animate = @import(\"framework/animate.zig\");\n");
            if (self.has_routes) try out.appendSlice(self.alloc, "const router = @import(\"framework/router.zig\");\n");
            if (self.has_crypto) try out.appendSlice(self.alloc, "const crypto_mod = @import(\"modules/crypto.zig\");\n");
            if (self.has_panels) try out.appendSlice(self.alloc, "const panels = @import(\"framework/panels.zig\");\n");
            if (self.has_pty) {
                try out.appendSlice(self.alloc, "const pty_mod = @import(\"modules/pty.zig\");\n");
                try out.appendSlice(self.alloc, "const vterm_mod = @import(\"framework/vterm.zig\");\n");
                try out.appendSlice(self.alloc, "const classifier_mod = @import(\"framework/classifier.zig\");\n");
            }
            try out.appendSlice(self.alloc, "const testharness = @import(\"framework/testharness.zig\");\n");
        }
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
        if (has_script) {
            try out.appendSlice(self.alloc, "\nvar g_text_engine: ?*TextEngine = null;\n\n");
        } else {
            try out.appendSlice(self.alloc, "\nvar g_text_engine: ?*TextEngine = null;\nvar g_image_cache: ?*ImageCache = null;\nvar _telem_frame: u32 = 0;\n\n");
        }

        // Measure callbacks
        try out.appendSlice(self.alloc, "fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {\n    if (g_text_engine) |te| { return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap); }\n    return .{};\n}\n\n");
        try out.appendSlice(self.alloc, "fn measureImageCallback(_: []const u8) layout.ImageDims {\n    return .{};\n}\n\n");

        // Utility functions (skip in <script> mode — they're JS, not Zig)
        if (self.util_func_count > 0 and !has_script) {
            try out.appendSlice(self.alloc, "// ── Utility functions ────────────────────────────────────────────\n");
            for (0..self.util_func_count) |fi| {
                const uf = &self.util_funcs[fi];
                try out.appendSlice(self.alloc, "fn ");
                try out.appendSlice(self.alloc, uf.name);
                try out.appendSlice(self.alloc, "(");
                for (0..uf.param_count) |pi| {
                    if (pi > 0) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, uf.params[pi]);
                    try out.appendSlice(self.alloc, ": i64");
                }
                try out.appendSlice(self.alloc, ") i64 {\n");

                const saved_local_count = self.local_count;
                for (0..uf.param_count) |pi| {
                    if (self.local_count < MAX_LOCALS) {
                        self.local_vars[self.local_count] = .{
                            .name = uf.params[pi],
                            .expr = uf.params[pi],
                            .state_type = .int,
                        };
                        self.local_count += 1;
                    }
                }

                const saved_pos = self.pos;
                self.pos = uf.body_start;
                if (self.curKind() == .lbrace) self.advance_token();
                while (self.curKind() != .rbrace and self.curKind() != .eof and self.pos < uf.body_end) {
                    const stmt = self.emitHandlerExpr() catch break;
                    if (stmt.len > 0) {
                        try out.appendSlice(self.alloc, "    ");
                        try out.appendSlice(self.alloc, stmt);
                        try out.appendSlice(self.alloc, "\n");
                    }
                    while (self.curKind() == .semicolon) self.advance_token();
                }
                self.pos = saved_pos;
                self.local_count = saved_local_count;

                try out.appendSlice(self.alloc, "}\n\n");
            }
        }

        // Let var declarations (mutable runtime variables)
        if (self.let_count > 0) {
            try out.appendSlice(self.alloc, "// ── Mutable let vars ────────────────────────────────────────────\n");
            for (0..self.let_count) |i| {
                const lv = &self.let_vars[i];
                if (lv.state_type == .string) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "var {s}_text: []const u8 = \"\";\n", .{lv.zig_name}));
                } else {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "var {s}: i64 = 0;\n", .{lv.zig_name}));
                }
            }
            try out.appendSlice(self.alloc, "\n");
        }

        // computeBody — imperative statements from function body
        if (self.body_imperative_start > 0 and self.body_imperative_end > self.body_imperative_start) {
            try out.appendSlice(self.alloc, "fn computeBody() void {\n");

            const saved_pos = self.pos;
            self.pos = self.body_imperative_start;
            while (self.pos < self.body_imperative_end and self.curKind() != .eof) {
                // Skip const declarations (already handled as compile-time subs)
                if (self.isIdent("const")) {
                    while (self.pos < self.body_imperative_end and
                        self.curKind() != .semicolon and !self.isIdent("return"))
                    {
                        self.advance_token();
                    }
                    if (self.curKind() == .semicolon) self.advance_token();
                    continue;
                }
                if (self.isIdent("return")) break;

                // let x = expr → initialize the let var
                if (self.isIdent("let")) {
                    self.advance_token(); // skip 'let'
                    if (self.curKind() == .identifier) {
                        const var_name = self.curText();
                        self.advance_token(); // name
                        if (self.curKind() == .equals) {
                            self.advance_token(); // =
                            if (self.isLetVar(var_name)) |lv| {
                                const init_expr = self.emitStateExpr() catch "";
                                if (lv.state_type == .string) {
                                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                        "    {s}_text = {s};\n", .{ lv.zig_name, init_expr }));
                                } else {
                                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                        "    {s} = {s};\n", .{ lv.zig_name, init_expr }));
                                }
                            }
                        }
                    }
                    if (self.curKind() == .semicolon) self.advance_token();
                    continue;
                }

                // Imperative statements (switch, if, while, for, assignments)
                const stmt = self.emitHandlerExpr() catch break;
                if (stmt.len > 0) {
                    try out.appendSlice(self.alloc, "    ");
                    try out.appendSlice(self.alloc, stmt);
                    try out.appendSlice(self.alloc, "\n");
                }
                while (self.curKind() == .semicolon) self.advance_token();
            }
            self.pos = saved_pos;

            try out.appendSlice(self.alloc, "}\n\n");
        }

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

        // Dynamic text buffers (sized from format string)
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Dynamic text buffers ─────────────────────────────────────────\n");
            for (0..self.dyn_count) |i| {
                const buf_size = estimateBufSize(self.dyn_texts[i].fmt_string);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _dyn_buf_{d}: [{d}]u8 = undefined;\nvar _dyn_text_{d}: []const u8 = \"\";\n", .{ i, buf_size, i }));
            }
        }

        // Computed array pools (.filter(), .split() results)
        if (self.computed_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Computed arrays ─────────────────────────────────────────────\n");
            for (0..self.computed_count) |ci| {
                const ca = self.computed_arrays[ci];
                switch (ca.kind) {
                    .filter => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "const MAX_COMPUTED_{d}: usize = 256;\n" ++
                            "var _computed_{d}: [MAX_COMPUTED_{d}]i64 = undefined;\n" ++
                            "var _computed_{d}_count: usize = 0;\n",
                            .{ ci, ci, ci, ci }));
                    },
                    .split => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "const MAX_COMPUTED_{d}: usize = 64;\n" ++
                            "var _computed_{d}: [MAX_COMPUTED_{d}][]const u8 = undefined;\n" ++
                            "var _computed_{d}_count: usize = 0;\n",
                            .{ ci, ci, ci, ci }));
                    },
                }
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

        // Component init functions (for multi-use leaf components)
        if (self.comp_func_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Component init functions ────────────────────────────────────\n");
            for (0..self.comp_func_count) |fi| {
                try out.appendSlice(self.alloc, self.comp_funcs[fi].func_source);
                try out.appendSlice(self.alloc, "\n");
            }
        }

        // _initComponents() — fills in deferred component instance slots
        if (self.comp_instance_count > 0) {
            try out.appendSlice(self.alloc, "fn _initComponents() void {\n");
            for (0..self.comp_instance_count) |ci| {
                const inst = self.comp_instances[ci];
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}] = {s};\n",
                    .{ inst.parent_arr, inst.parent_idx, inst.init_call }));
            }
            try out.appendSlice(self.alloc, "}\n\n");
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

        // updateDynamicTexts (dedup: same format + args share a buffer, per-slot dirty guard)
        if (self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "fn updateDynamicTexts() void {\n");
            for (0..self.dyn_count) |i| {
                const dt = self.dyn_texts[i];
                if (!dt.has_ref) continue;
                // Check if an earlier entry has the same format + args (dedup)
                var dedup_source: ?u32 = null;
                for (0..i) |j| {
                    const prev = self.dyn_texts[j];
                    if (prev.has_ref and
                        std.mem.eql(u8, prev.fmt_string, dt.fmt_string) and
                        std.mem.eql(u8, prev.fmt_args, dt.fmt_args))
                    {
                        dedup_source = @intCast(j);
                        break;
                    }
                }
                // Determine which dep info to use (deduped texts use source's deps)
                const guard_dt = if (dedup_source) |src| self.dyn_texts[src] else dt;
                // Emit per-slot dirty guard if deps are tracked
                if (guard_dt.dep_count > 0) {
                    try out.appendSlice(self.alloc, "    if (");
                    for (0..guard_dt.dep_count) |di| {
                        if (di > 0) try out.appendSlice(self.alloc, " or ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "state.slotDirty({d})", .{guard_dt.dep_slots[di]}));
                    }
                    try out.appendSlice(self.alloc, ") {\n");
                    if (dedup_source) |src| {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {s}[{d}].text = _dyn_text_{d};\n",
                            .{ dt.arr_name, dt.arr_index, src }));
                    } else {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n        {s}[{d}].text = _dyn_text_{d};\n",
                            .{ i, i, dt.fmt_string, dt.fmt_args, dt.arr_name, dt.arr_index, i }));
                    }
                    try out.appendSlice(self.alloc, "    }\n");
                } else {
                    // No dep tracking — always update (fallback for PTY, inspector, etc.)
                    if (dedup_source) |src| {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    {s}[{d}].text = _dyn_text_{d};\n",
                            .{ dt.arr_name, dt.arr_index, src }));
                    } else {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n    {s}[{d}].text = _dyn_text_{d};\n",
                            .{ i, i, dt.fmt_string, dt.fmt_args, dt.arr_name, dt.arr_index, i }));
                    }
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

        // updateOverlays — show/hide overlays based on visible state
        if (self.overlay_count > 0) {
            try out.appendSlice(self.alloc, "fn updateOverlays() void {\n");
            for (0..self.overlay_count) |i| {
                const ov = self.overlays[i];
                if (ov.visible_expr.len > 0) {
                    // Position args
                    const x_arg = if (ov.x_expr.len > 0) ov.x_expr else "0";
                    const y_arg = if (ov.y_expr.len > 0) ov.y_expr else "0";
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    if ({s} != 0) {{ overlay_mod.show({d}, @floatFromInt({s}), @floatFromInt({s})); }} else {{ overlay_mod.hide({d}); }}\n",
                        .{ ov.visible_expr, i, x_arg, y_arg, i }));
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");
        }

        if (!has_script) {
            // _onTextInput — forwards SDL_TEXTINPUT to input module
            try out.appendSlice(self.alloc, "fn _onTextInput(text: [*:0]const u8) void {\n");
            try out.appendSlice(self.alloc, "    input_mod.handleTextInput(text);\n");
            try out.appendSlice(self.alloc, "}\n\n");

            // _onKeyDown — global key dispatch
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

        // Computed array rebuild functions
        if (self.computed_count > 0) {
            try out.appendSlice(self.alloc, "\n// ── Computed array rebuild ──────────────────────────────────────\n");
            for (0..self.computed_count) |ci| {
                const ca = self.computed_arrays[ci];
                switch (ca.kind) {
                    .filter => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "fn _rebuildComputed{d}() void {{\n" ++
                            "    const _src = state.getArraySlot({d});\n" ++
                            "    _computed_{d}_count = 0;\n" ++
                            "    for (_src) |_item| {{\n" ++
                            "        if ({s}) {{\n" ++
                            "            _computed_{d}[_computed_{d}_count] = _item;\n" ++
                            "            _computed_{d}_count += 1;\n" ++
                            "            if (_computed_{d}_count >= MAX_COMPUTED_{d}) break;\n" ++
                            "        }}\n" ++
                            "    }}\n" ++
                            "}}\n\n",
                            .{ ci, ca.source_slot, ci, ca.predicate_expr, ci, ci, ci, ci, ci }));
                    },
                    .split => {
                        // Separator is a single char (common case)
                        const sep_char: u8 = if (ca.separator.len > 0) ca.separator[0] else ',';
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "fn _rebuildComputed{d}() void {{\n" ++
                            "    const _str = state.getSlotString({d});\n" ++
                            "    _computed_{d}_count = 0;\n" ++
                            "    var _iter = std.mem.splitScalar(u8, _str, '{c}');\n" ++
                            "    while (_iter.next()) |_part| {{\n" ++
                            "        if (_computed_{d}_count >= MAX_COMPUTED_{d}) break;\n" ++
                            "        _computed_{d}[_computed_{d}_count] = _part;\n" ++
                            "        _computed_{d}_count += 1;\n" ++
                            "    }}\n" ++
                            "}}\n\n",
                            .{ ci, ca.source_slot, ci, sep_char, ci, ci, ci, ci, ci }));
                    },
                }
            }
        }

        // Map rebuild functions
        if (self.map_count > 0) {
            for (0..self.map_count) |mi| {
                const m = self.maps[mi];
                if (m.parent_arr_name.len == 0) continue;

                if (m.is_computed) {
                    // Source is a computed array
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "fn _rebuildMap{d}() void {{\n" ++
                        "    const items = _computed_{d}[0.._computed_{d}_count];\n" ++
                        "    _map_count_{d} = @min(items.len, MAX_MAP_{d});\n" ++
                        "    for (0.._map_count_{d}) |_i| {{\n" ++
                        "        const _item = items[_i];\n",
                        .{ mi, m.computed_idx, m.computed_idx, mi, mi, mi }));
                } else {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "fn _rebuildMap{d}() void {{\n" ++
                        "    const items = state.getArraySlot({d});\n" ++
                        "    _map_count_{d} = @min(items.len, MAX_MAP_{d});\n" ++
                        "    for (0.._map_count_{d}) |_i| {{\n" ++
                        "        const _item = items[_i];\n",
                        .{ mi, m.array_slot_id, mi, mi, mi }));
                }

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

        // Overlay registration
        if (self.overlay_count > 0) {
            try out.appendSlice(self.alloc, "// ── Overlay registration ──────────────────────────────────────────\n");
            for (0..self.overlay_count) |i| {
                const ov = self.overlays[i];
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _initOverlay{d}() void {{\n    const ov_id = overlay_mod.register(.{s});\n    overlay_mod.setRoot(ov_id, {s});\n",
                    .{ i, ov.kind, ov.root_expr }));
                if (ov.dismiss_handler) |dh| {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    overlay_mod.setOnDismiss(ov_id, {s});\n", .{dh}));
                }
                try out.appendSlice(self.alloc, "}\n\n");
            }
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

        // ── <script> mode: QuickJS main loop ──
        if (has_script) {
            // Emit JS_LOGIC constant
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

            // State init function
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

            // Dynamic text update function
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
                \\    qjs_runtime.initVM(JS_LOGIC);
                \\    defer qjs_runtime.deinit();
                \\    _updateDynamicTexts();
                \\
                \\    var running = true;
                \\    var fps_frames: u32 = 0;
                \\    var fps_last: u32 = c_imports.SDL_GetTicks();
                \\    var fps_display: u32 = 0;
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
                \\        qjs_runtime.tick();
                \\
                \\        if (state.isDirty()) {
                \\            _updateDynamicTexts();
                \\            state.clearDirty();
                \\        }
                \\
                \\        layout.layout(&root, 0, 0, win_w, win_h);
                \\        gpuPaintNode(&root);
                \\
                \\        // Telemetry bar
                \\        gpu.drawRect(0, win_h - 24, win_w, 24, 0, 0, 0, 0.78, 0, 0, 0, 0, 0, 0);
                \\        {
                \\            var tbuf: [256]u8 = undefined;
                \\            const tstr = std.fmt.bufPrint(&tbuf, "FPS: {d}", .{fps_display}) catch "???";
                \\            _ = gpu.drawTextWrapped(tstr, 8, win_h - 20, 13, win_w - 16, 0.7, 0.86, 0.7, 1.0);
                \\        }
                \\
                \\        gpu.frame(0.051, 0.067, 0.090);
                \\
                \\        fps_frames += 1;
                \\        const now = c_imports.SDL_GetTicks();
                \\        if (now - fps_last >= 1000) {
                \\            fps_display = fps_frames;
                \\            fps_frames = 0;
                \\            fps_last = now;
                \\        }
                \\    }
                \\}
                \\
            );

            return try out.toOwnedSlice(self.alloc);
        }

        // Standard mode (compositor/wgpu) removed — only QuickJS script mode supported.
        return error.NoComputeJS;
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
        if (std.mem.eql(u8, value, "end")) return ".end";
        if (std.mem.eql(u8, value, "space-between")) return ".space_between";
        if (std.mem.eql(u8, value, "space-around")) return ".space_around";
        if (std.mem.eql(u8, value, "space-evenly")) return ".space_evenly";
    }
    if (std.mem.eql(u8, prefix, "ai")) {
        if (std.mem.eql(u8, value, "start")) return ".start";
        if (std.mem.eql(u8, value, "center")) return ".center";
        if (std.mem.eql(u8, value, "end")) return ".end";
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
        if (std.mem.eql(u8, value, "end")) return ".end";
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

// ── Component function helpers ──────────────────────────────────────────

/// Count top-level Node elements in an array decl string.
/// Looks for ".{" patterns at the top level (not inside nested braces).
fn countNodeElements(decl: []const u8) u32 {
    // Find the content between "[_]Node{ " and the final " };"
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return 1;
    const content = decl[start + marker.len ..];
    var count: u32 = 0;
    var depth: i32 = 0;
    var i: usize = 0;
    while (i < content.len) {
        if (content[i] == '{') {
            if (depth == 0) count += 1;
            depth += 1;
        } else if (content[i] == '}') {
            depth -= 1;
            if (depth < 0) break; // closing "};" of the array
        }
        i += 1;
    }
    return if (count > 0) count else 1;
}

/// Extract the array initializer content from a decl string.
/// Input:  "var _arr_3 = [_]Node{ .{ .text = \"Top\" } }; // Chip"
/// Output: ".{ .text = \"Top\" }"
fn extractArrayInit(decl: []const u8) []const u8 {
    const marker = "[_]Node{ ";
    const start = std.mem.indexOf(u8, decl, marker) orelse return "";
    const content_start = start + marker.len;
    // Find matching end: scan for "};" at depth 0
    var depth: i32 = 0;
    var i: usize = content_start;
    while (i < decl.len) {
        if (decl[i] == '{') {
            depth += 1;
        } else if (decl[i] == '}') {
            if (depth == 0) {
                // This is the closing "}" of the array — content ends before it
                return decl[content_start..i];
            }
            depth -= 1;
        }
        i += 1;
    }
    return decl[content_start..];
}
