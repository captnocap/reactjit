//! Codegen hub — Generator struct, types, constants, helpers, and pipeline orchestrator.
//!
//! The Generator holds ALL compiler state (tokens, collected declarations, counters).
//! generate() drives the full pipeline:
//!
//!   Phase 1:   collectFFIPragmas        — scan for // @ffi <header.h> -llib
//!   Phase 2:   collectDeclaredFunctions — scan for `declare function foo(): type`
//!   Phase 3:   collectClassifiers       — scan for classifier({...}) style abstractions
//!   Phase 4:   collectComponents        — scan for function MyComp({props}) { return <...> }
//!   Phase 4.5: collectUtilFunctions     — scan for lowercase function helpers
//!   Phase 5:   extractComputeBlock      — extract <script>...</script> JS logic
//!   Phase 6:   collectStateHooks        — scan for useState/useFFI/useTransition/useSpring declarations
//!   Phase 6.25:collectEffectHooks      — scan for useEffect lifecycle hooks
//!   Phase 6.5: collectLetVars           — scan for `let x = expr` mutable vars
//!   Phase 7:   countComponentUsage      — count <MyComp> references for optimization
//!   Phase 7.5: collectAppConditionals   — scan root-level {state && <JSX>} patterns
//!   Phase 7.9: validate                 — catch unknown tags, bad props, unknown idents
//!   Phase 8:   parseJSXElement          — recursive-descent JSX → Zig node tree
//!   Phase 9:   emitZigSource            — assemble final .zig output file
//!
//! Delegates work to:
//!   collect.zig     — phases 1-7.5 (token scanning and declaration collection)
//!   validate.zig    — phase 7.9 (pre-emission error checking)
//!   jsx.zig         — phase 8 (JSX element parsing)
//!   components.zig  — component inlining (called from jsx.zig)
//!   handlers.zig    — handler bodies and expression chain (called from jsx.zig)
//!   attrs.zig       — attribute/style/template parsing (called from jsx.zig)
//!   emit.zig        — phase 9 (final Zig source emission)

const std = @import("std");
const lexer_mod = @import("lexer.zig");
pub const Token = lexer_mod.Token;
pub const TokenKind = lexer_mod.TokenKind;
pub const Lexer = lexer_mod.Lexer;
pub const tailwind = @import("tailwind.zig");

// Pipeline modules
const collect = @import("collect.zig");
const jsx = @import("jsx.zig");
const emit_mod = @import("emit.zig");
const validate = @import("validate.zig");

// ── Constants ────────────────────────────────────────────────────────

pub const MAX_LOCALS = 64;
pub const MAX_COMPONENTS = 64;
pub const MAX_COMPONENT_PROPS = 64;
pub const MAX_ARRAYS = 512;
pub const MAX_STATE_SLOTS = 128;
pub const MAX_DYN_TEXTS = 128;
pub const MAX_ARRAY_INIT = 64;
pub const MAX_CLASSIFIERS = 512;
pub const MAX_COMP_FUNCS = 32;
pub const MAX_COMP_INSTANCES = 128;
pub const MAX_COMP_INNER = 8;
pub const MAX_DYN_DEPS = 8;
pub const MAX_FFI_HEADERS = 32;
pub const MAX_FFI_LIBS = 32;
pub const MAX_FFI_FUNCS = 128;
pub const MAX_ROUTES = 32;
pub const MAX_CONDITIONALS = 128;
pub const MAX_APP_CONDS = 128;
pub const MAX_DYN_STYLES = 128;
pub const MAX_FFI_HOOKS = 16;
pub const MAX_EFFECT_HOOKS = 32;
pub const MAX_ANIM_HOOKS = 16;
pub const MAX_UTIL_FUNCS = 32;
pub const MAX_UTIL_PARAMS = 16;
pub const MAX_LET_VARS = 32;
pub const MAX_OBJECT_STATE_FIELDS = 16;
pub const MAX_OBJECT_STATE_VARS = 16;

// ── Types ────────────────────────────────────────────────────────────

pub const RouteInfo = struct {
    path: []const u8,
    arr_name: []const u8,
    child_idx: u32,
};

pub const CondKind = enum {
    show_hide, // {expr && <A/>} — toggle visibility
    ternary, // {expr ? <A/> : <B/>} — swap two subtrees
};

pub const ConditionalInfo = struct {
    kind: CondKind = .show_hide,
    cond_expr: []const u8,
    arr_name: []const u8,
    true_idx: u32, // child index shown when condition is true
    false_idx: u32 = 0, // child index shown when condition is false (ternary only)
};

pub const AppConditional = struct {
    cond_expr: []const u8,
    child_idx: u32,
};

pub const PropType = enum {
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

pub const PropBinding = struct {
    name: []const u8,
    value: []const u8,
    prop_type: PropType = .string,
};

pub const StateType = enum { int, float, boolean, string, array };

pub const StateInitial = union(StateType) {
    int: i64,
    float: f64,
    boolean: bool,
    string: []const u8,
    array: struct {
        values: [MAX_ARRAY_INIT]i64,
        count: u32,
    },
};

pub const StateSlot = struct {
    getter: []const u8,
    setter: []const u8,
    initial: StateInitial,
};

pub const ObjectField = struct {
    field_name: []const u8,
    slot_id: u32,
    state_type: StateType,
};

pub const ObjectStateVar = struct {
    getter: []const u8,
    setter: []const u8,
    fields: [MAX_OBJECT_STATE_FIELDS]ObjectField,
    field_count: u32,
};

pub const ComponentInfo = struct {
    name: []const u8,
    prop_names: [MAX_COMPONENT_PROPS][]const u8,
    prop_count: u32,
    body_pos: u32,
    has_children: bool,
    usage_count: u32,
    func_generated: bool,
};

pub const LocalVar = struct {
    name: []const u8,
    expr: []const u8,
    state_type: StateType,
};

pub const UtilFunc = struct {
    name: []const u8,
    params: [MAX_UTIL_PARAMS][]const u8,
    param_count: u32,
    body_start: u32, // token pos of opening {
    body_end: u32, // token pos of closing }
};

pub const LetVar = struct {
    name: []const u8,
    initial: []const u8, // initial value expression
    state_type: StateType, // inferred type
    zig_name: []const u8, // runtime var name (_let_0, _let_1, etc.)
};

pub const DynText = struct {
    buf_id: u32,
    fmt_string: []const u8,
    fmt_args: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
    dep_slots: [MAX_DYN_DEPS]u32,
    dep_count: u32,
};

pub const DynStyle = struct {
    field: []const u8, // Zig style field: "text_color", "opacity", "width", etc.
    expression: []const u8, // Zig expression: "Color.rgb(...)", "@as(f32, ...)"
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
};

pub const FFIHook = struct {
    getter: []const u8,
    ffi_func: []const u8,
    interval_ms: u32,
    return_type: StateType,
    slot_id: u32,
};

pub const AnimKind = enum { transition, spring };
pub const EasingKind = enum { linear, ease_in, ease_out, ease_in_out };

pub const AnimHook = struct {
    kind: AnimKind,
    slot_id: u32,
    vel_slot_id: u32,
    target_expr: []const u8,
    duration_ms: u32,
    easing: EasingKind,
    stiffness: f32,
    damping: f32,
};

pub const EffectKind = enum { mount, watch, frame, interval };

pub const EffectHook = struct {
    kind: EffectKind,
    body_start: u32, // token pos of arrow function body `{`
    body_end: u32, // token pos of closing `}`
    dep_slots: [8]u32, // slot IDs being watched (for .watch)
    dep_count: u32,
    interval_ms: u32, // for .interval
};

pub const CompFunc = struct {
    name: []const u8,
    func_source: []const u8,
    inner_count: u32,
    inner_sizes: [MAX_COMP_INNER]u32,
};

pub const CompInstance = struct {
    func_idx: u32,
    storage_names: [MAX_COMP_INNER][]const u8,
    init_call: []const u8,
    parent_arr: []const u8,
    parent_idx: u32,
};

pub const TemplateResult = struct {
    is_dynamic: bool,
    static_text: []const u8,
    fmt: []const u8,
    args: []const u8,
    dep_slots: [MAX_DYN_DEPS]u32,
    dep_count: u32,
};

// ═══════════════════════════════════════════════════════════════════════
// Generator
// ═══════════════════════════════════════════════════════════════════════

pub const Generator = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    input_file: []const u8,
    pos: u32,

    // Collected node array declarations
    array_decls: std.ArrayListUnmanaged([]const u8),
    array_counter: u32,

    // Event handler functions
    handler_decls: std.ArrayListUnmanaged([]const u8),
    handler_counter: u32,

    // State (useState declarations)
    state_slots: [MAX_STATE_SLOTS]StateSlot,
    state_count: u32,
    obj_state_vars: [MAX_OBJECT_STATE_VARS]ObjectStateVar,
    obj_state_count: u32,
    has_state: bool,

    // Dynamic text (template literals that update from state)
    dyn_texts: [MAX_DYN_TEXTS]DynText,
    dyn_count: u32,
    last_dyn_id: ?u32,

    // Dynamic styles (state-dependent style values)
    dyn_styles: [MAX_DYN_STYLES]DynStyle,
    dyn_style_count: u32,

    // Classifiers (style.cls.tsz)
    classifier_names: [MAX_CLASSIFIERS][]const u8,
    classifier_primitives: [MAX_CLASSIFIERS][]const u8,
    classifier_styles: [MAX_CLASSIFIERS][]const u8,
    classifier_text_props: [MAX_CLASSIFIERS][]const u8,
    classifier_count: u32,

    // Local variables (compile-time const substitution)
    local_vars: [MAX_LOCALS]LocalVar,
    local_count: u32,

    // Utility functions (non-component, non-App, lowercase)
    util_funcs: [MAX_UTIL_FUNCS]UtilFunc,
    util_func_count: u32,

    // Mutable let vars (runtime variables, not compile-time substitution)
    let_vars: [MAX_LET_VARS]LetVar,
    let_count: u32,

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
    ffi_return_types: std.ArrayListUnmanaged(StateType),
    ffi_arg_counts: std.ArrayListUnmanaged(u32),

    // useFFI hooks (Zig-side polling)
    ffi_hooks: [MAX_FFI_HOOKS]FFIHook,
    ffi_hook_count: u32,

    // Animation hooks (per-frame transition/spring updates)
    anim_hooks: [MAX_ANIM_HOOKS]AnimHook,
    anim_hook_count: u32,

    // useEffect hooks (lifecycle effects)
    effect_hooks: [MAX_EFFECT_HOOKS]EffectHook,
    effect_hook_count: u32,

    // Embedded JS logic (<script> or _script.tsz)
    compute_js: ?[]const u8 = null,

    // Module mode: emit a .gen.zig fragment, not a full app
    is_module: bool = false,

    // Embedded mode: full app WITHOUT main(), pub exports, framework-relative imports, isolated state
    is_embedded: bool = false,

    // When true, string literals in emitStateAtom convert '#hex' to Color.rgb(...)
    emit_colors_as_rgb: bool = false,

    // When true, findProp returns "_p_NAME" instead of concrete value
    emit_prop_refs: bool = false,

    // Routes
    routes: [MAX_ROUTES]RouteInfo,
    route_count: u32,
    has_routes: bool,
    has_theme: bool,
    last_route_path: ?[]const u8,
    routes_bind_from: ?u32,
    inline_depth: u32,

    // Conditionals ({expr && <JSX>})
    conditionals: [MAX_CONDITIONALS]ConditionalInfo,
    conditional_count: u32,

    // Top-level App conditionals (pre-pass)
    app_conds: [MAX_APP_CONDS]AppConditional,
    app_cond_count: u32,

    // TextInput compile-time ID assignment
    input_counter: u32,
    input_multiline: [16]bool,
    input_change_handler: [16][]const u8, // handler function name per input ID

    compile_error: ?[]const u8,

    // Multi-error collection — collect ALL errors, not just the first
    errors: std.ArrayListUnmanaged(CompileMessage),
    warnings: std.ArrayListUnmanaged(CompileMessage),
    strict_mode: bool,

    pub const CompileMessage = struct {
        line: u32,
        col: u32,
        msg: []const u8,
    };

    // ── Error reporting ──

    pub const SourceLoc = struct {
        line: u32,
        col: u32,
    };

    /// Convert a byte offset into the source to a 1-based line:col pair.
    pub fn lineCol(self: *const Generator, offset: u32) SourceLoc {
        var line: u32 = 1;
        var col: u32 = 1;
        const limit = @min(offset, @as(u32, @intCast(self.source.len)));
        for (self.source[0..limit]) |ch| {
            if (ch == '\n') {
                line += 1;
                col = 1;
            } else {
                col += 1;
            }
        }
        return .{ .line = line, .col = col };
    }

    /// Set a compile error with automatic file:line:col from the current token.
    pub fn setError(self: *Generator, msg: []const u8) void {
        const tok = self.cur();
        const loc = self.lineCol(tok.start);
        std.debug.print("[tsz] {s}:{d}:{d}: error: {s}\n", .{
            std.fs.path.basename(self.input_file), loc.line, loc.col, msg,
        });
        self.errors.append(self.alloc, .{ .line = loc.line, .col = loc.col, .msg = msg }) catch {};
        if (self.compile_error == null) self.compile_error = msg;
    }

    /// Set a compile error at a specific source offset (for when pos has moved past the problem).
    pub fn setErrorAt(self: *Generator, offset: u32, msg: []const u8) void {
        const loc = self.lineCol(offset);
        std.debug.print("[tsz] {s}:{d}:{d}: error: {s}\n", .{
            std.fs.path.basename(self.input_file), loc.line, loc.col, msg,
        });
        self.errors.append(self.alloc, .{ .line = loc.line, .col = loc.col, .msg = msg }) catch {};
        if (self.compile_error == null) self.compile_error = msg;
    }

    /// Add a warning. In strict mode, promotes to error.
    pub fn addWarning(self: *Generator, offset: u32, msg: []const u8) void {
        const loc = self.lineCol(offset);
        if (self.strict_mode) {
            std.debug.print("[tsz] {s}:{d}:{d}: error (--strict): {s}\n", .{
                std.fs.path.basename(self.input_file), loc.line, loc.col, msg,
            });
            self.errors.append(self.alloc, .{ .line = loc.line, .col = loc.col, .msg = msg }) catch {};
            if (self.compile_error == null) self.compile_error = msg;
        } else {
            self.warnings.append(self.alloc, .{ .line = loc.line, .col = loc.col, .msg = msg }) catch {};
        }
    }

    /// Print the full error/warning summary after compilation.
    /// Deduplicates repeated messages at the same location.
    pub fn printDiagnosticSummary(self: *Generator) void {
        const basename = std.fs.path.basename(self.input_file);
        if (self.errors.items.len > 0 or self.warnings.items.len > 0) {
            std.debug.print("\n[tsz] ── Diagnostic summary for {s} ──\n", .{basename});
        }
        if (self.errors.items.len > 0) {
            std.debug.print("[tsz] {d} error(s):\n", .{self.errors.items.len});
            printDeduped(self.errors.items, basename);
        }
        if (self.warnings.items.len > 0) {
            std.debug.print("[tsz] {d} warning(s):\n", .{self.warnings.items.len});
            printDeduped(self.warnings.items, basename);
        }
        if (self.errors.items.len > 0) {
            std.debug.print("[tsz] Build FAILED — {d} error(s), {d} warning(s)\n\n", .{ self.errors.items.len, self.warnings.items.len });
        } else if (self.warnings.items.len > 0) {
            std.debug.print("[tsz] Build OK — {d} warning(s)\n\n", .{self.warnings.items.len});
        }
    }

    fn printDeduped(items: []const CompileMessage, basename: []const u8) void {
        var i: usize = 0;
        while (i < items.len) {
            const entry = items[i];
            var count: usize = 1;
            while (i + count < items.len) {
                const next = items[i + count];
                if (next.line == entry.line and next.col == entry.col and
                    std.mem.eql(u8, next.msg, entry.msg))
                {
                    count += 1;
                } else break;
            }
            if (count > 1) {
                std.debug.print("[tsz]   {s}:{d}:{d}: {s} (x{d})\n", .{ basename, entry.line, entry.col, entry.msg, count });
            } else {
                std.debug.print("[tsz]   {s}:{d}:{d}: {s}\n", .{ basename, entry.line, entry.col, entry.msg });
            }
            i += count;
        }
    }

    // ── Init ──

    pub fn init(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8, input_file: []const u8) Generator {
        return .{
            .alloc = alloc,
            .lex = lex,
            .source = source,
            .input_file = input_file,
            .pos = 0,
            .array_decls = .{},
            .handler_decls = .{},
            .handler_counter = 0,
            .array_counter = 0,
            .state_slots = undefined,
            .state_count = 0,
            .obj_state_vars = undefined,
            .obj_state_count = 0,
            .has_state = false,
            .dyn_texts = undefined,
            .dyn_count = 0,
            .dyn_styles = undefined,
            .dyn_style_count = 0,
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
            .ffi_arg_counts = .{},
            .ffi_hooks = undefined,
            .ffi_hook_count = 0,
            .anim_hooks = undefined,
            .anim_hook_count = 0,
            .effect_hooks = undefined,
            .effect_hook_count = 0,
            .local_vars = undefined,
            .local_count = 0,
            .util_funcs = undefined,
            .util_func_count = 0,
            .let_vars = undefined,
            .let_count = 0,
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
            .routes = undefined,
            .route_count = 0,
            .has_routes = false,
            .has_theme = false,
            .last_route_path = null,
            .routes_bind_from = null,
            .inline_depth = 0,
            .conditionals = undefined,
            .conditional_count = 0,
            .app_conds = undefined,
            .app_cond_count = 0,
            .input_counter = 0,
            .input_multiline = [_]bool{false} ** 16,
            .input_change_handler = [_][]const u8{""} ** 16,
            .compile_error = null,
            .errors = .{},
            .warnings = .{},
            .strict_mode = false,
        };
    }

    // ── Token helpers ──

    pub fn advance_token(self: *Generator) void {
        if (self.pos < self.lex.count) self.pos += 1;
    }
    pub fn cur(self: *Generator) Token {
        return self.lex.get(self.pos);
    }
    pub fn curText(self: *Generator) []const u8 {
        return self.cur().text(self.source);
    }
    pub fn curKind(self: *Generator) TokenKind {
        return if (self.pos < self.lex.count) self.lex.get(self.pos).kind else .eof;
    }
    pub fn isIdent(self: *Generator, name: []const u8) bool {
        return self.curKind() == .identifier and std.mem.eql(u8, self.curText(), name);
    }

    // ── Lookup helpers ──

    pub fn ffiReturnType(self: *Generator, name: []const u8) StateType {
        for (self.ffi_funcs.items, 0..) |f, i| {
            if (std.mem.eql(u8, f, name)) {
                if (i < self.ffi_return_types.items.len) return self.ffi_return_types.items[i];
                return .int;
            }
        }
        return .int;
    }

    pub fn ffiArgCount(self: *Generator, name: []const u8) u32 {
        for (self.ffi_funcs.items, 0..) |f, i| {
            if (std.mem.eql(u8, f, name)) {
                if (i < self.ffi_arg_counts.items.len) return self.ffi_arg_counts.items[i];
                return 0;
            }
        }
        return 0;
    }

    pub fn isSetter(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].setter, name)) return @intCast(i);
        }
        return null;
    }

    pub fn isObjectStateVar(self: *Generator, name: []const u8) ?*const ObjectStateVar {
        for (0..self.obj_state_count) |i| {
            if (std.mem.eql(u8, self.obj_state_vars[i].getter, name)) return &self.obj_state_vars[i];
        }
        return null;
    }

    pub fn objectStateVarBySetter(self: *Generator, name: []const u8) ?*const ObjectStateVar {
        for (0..self.obj_state_count) |i| {
            if (std.mem.eql(u8, self.obj_state_vars[i].setter, name)) return &self.obj_state_vars[i];
        }
        return null;
    }

    pub fn resolveObjectStateField(self: *Generator, obj_name: []const u8, field_name: []const u8) ?*const ObjectField {
        const obj = self.isObjectStateVar(obj_name) orelse return null;
        for (0..obj.field_count) |i| {
            if (std.mem.eql(u8, obj.fields[i].field_name, field_name)) return &obj.fields[i];
        }
        return null;
    }

    pub fn isFFIFunc(self: *Generator, name: []const u8) bool {
        for (self.ffi_funcs.items) |f| {
            if (std.mem.eql(u8, f, name)) return true;
        }
        return false;
    }

    pub fn findClassifier(self: *Generator, name: []const u8) ?u32 {
        for (0..self.classifier_count) |i| {
            if (std.mem.eql(u8, self.classifier_names[i], name)) return @intCast(i);
        }
        return null;
    }

    pub fn findComponent(self: *Generator, name: []const u8) ?*ComponentInfo {
        for (0..self.component_count) |i| {
            if (std.mem.eql(u8, self.components[i].name, name)) return &self.components[i];
        }
        return null;
    }

    pub fn isLocalVar(self: *Generator, name: []const u8) ?*const LocalVar {
        for (0..self.local_count) |i| {
            if (std.mem.eql(u8, self.local_vars[i].name, name)) return &self.local_vars[i];
        }
        return null;
    }

    pub fn isUtilFunc(self: *Generator, name: []const u8) ?*const UtilFunc {
        for (0..self.util_func_count) |i| {
            if (std.mem.eql(u8, self.util_funcs[i].name, name)) return &self.util_funcs[i];
        }
        return null;
    }

    pub fn isLetVar(self: *Generator, name: []const u8) ?*const LetVar {
        for (0..self.let_count) |i| {
            if (std.mem.eql(u8, self.let_vars[i].name, name)) return &self.let_vars[i];
        }
        return null;
    }

    pub fn isState(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].getter, name)) return @intCast(i);
        }
        return null;
    }

    pub fn stateTypeById(self: *Generator, slot_id: u32) StateType {
        return std.meta.activeTag(self.state_slots[slot_id].initial);
    }

    pub fn regularSlotId(self: *Generator, state_idx: u32) u32 {
        var count: u32 = 0;
        for (0..state_idx) |j| {
            if (std.meta.activeTag(self.state_slots[j].initial) != .array) count += 1;
        }
        return count;
    }

    pub fn findProp(self: *Generator, name: []const u8) ?[]const u8 {
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

    pub fn findPropBinding(self: *Generator, name: []const u8) ?*const PropBinding {
        var i: u32 = self.prop_stack_count;
        while (i > 0) {
            i -= 1;
            if (std.mem.eql(u8, self.prop_stack[i].name, name)) {
                return &self.prop_stack[i];
            }
        }
        return null;
    }

    pub fn classifyExpr(self: *Generator, expr: []const u8) PropType {
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

    pub fn zigTypeForPropType(pt: PropType) []const u8 {
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

    pub fn estimateBufSize(fmt: []const u8) u32 {
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

    pub fn isIdentByte(ch: u8) bool {
        return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
    }

    pub fn isStringExpr(_: *Generator, expr: []const u8) bool {
        if (expr.len >= 2 and expr[0] == '"' and expr[expr.len - 1] == '"') return true;
        if (std.mem.startsWith(u8, expr, "state.getSlotString(")) return true;
        return false;
    }

    // ── Pipeline ──

    pub fn generate(self: *Generator) ![]const u8 {
        if (self.lex.overflow) return error.TokenLimitExceeded;

        // Phase 1: FFI pragmas
        collect.collectFFIPragmas(self);

        // Phase 2: Declared functions
        self.pos = 0;
        collect.collectDeclaredFunctions(self);

        // Phase 3: Classifiers
        self.pos = 0;
        collect.collectClassifiers(self);

        // Phase 4: Component definitions
        self.pos = 0;
        collect.collectComponents(self);

        // Phase 4.5: Utility functions (lowercase, non-App)
        collect.collectUtilFunctions(self);

        // Phase 5: Extract <script> block
        self.pos = 0;
        collect.extractComputeBlock(self);

        // Phase 6: Collect useState
        self.pos = 0;
        collect.collectStateHooksTopLevel(self);
        self.pos = 0;
        const app_start = collect.findAppFunction(self) orelse return error.NoAppFunction;

        // Seed prop_stack if the app function is itself a named component with props.
        // This lets validation and compile-time conditional evaluation resolve prop
        // references when a component file is compiled standalone (e.g. as a cart).
        {
            const saved_p = self.pos;
            self.pos = app_start;
            self.advance_token(); // skip "function" keyword
            if (self.curKind() == .identifier) {
                const app_name = self.curText();
                for (0..self.component_count) |ci| {
                    if (std.mem.eql(u8, self.components[ci].name, app_name)) {
                        const comp = &self.components[ci];
                        for (0..comp.prop_count) |pi| {
                            if (self.prop_stack_count < MAX_COMPONENT_PROPS) {
                                self.prop_stack[self.prop_stack_count] = .{
                                    .name = comp.prop_names[pi],
                                    .value = "",
                                    .prop_type = .string,
                                };
                                self.prop_stack_count += 1;
                            }
                        }
                        break;
                    }
                }
            }
            self.pos = saved_p;
        }

        collect.collectStateHooks(self, app_start);

        // Phase 6.25: Collect useEffect hooks (needs state slots to resolve deps)
        collect.collectEffectHooks(self, app_start);

        // Phase 6.5: Collect let variables
        collect.collectLetVars(self, app_start);

        // Phase 7: Count component usage in App body
        collect.countComponentUsage(self, app_start);

        // Phase 7.5: Collect top-level state conditionals
        self.pos = app_start;
        collect.findReturnStatement(self);
        collect.collectAppConditionals(self);

        // Phase 7.9: Validate before emission — catch bad tags, unknown idents, prop mismatches
        validate.validate(self, app_start);
        if (self.compile_error) |_| return error.ValidationFailed;

        // Phase 8: Find return JSX and generate node tree
        self.pos = app_start;
        collect.findReturnStatement(self);
        const has_jsx = self.curKind() == .lt;
        const root_expr = if (has_jsx) try jsx.parseJSXElement(self) else ".{}";

        if (self.compile_error) |_| return error.LimitExceeded;

        return emit_mod.emitZigSource(self, root_expr);
    }
};
