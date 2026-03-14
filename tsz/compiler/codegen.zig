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

const MAX_ARRAYS = 256;
const MAX_HANDLERS = 64;
const MAX_STATE_SLOTS = 32;
const MAX_DYN_TEXTS = 32;
const MAX_FFI_HEADERS = 16;
const MAX_FFI_LIBS = 16;
const MAX_FFI_FUNCS = 64;
const MAX_WINDOWS = 8;

const DynText = struct {
    buf_id: u32,
    fmt_string: []const u8,
    fmt_args: []const u8,
    arr_name: []const u8,
    arr_index: u32,
    has_ref: bool,
};

const StateSlot = struct {
    getter: []const u8,
    setter: []const u8,
    initial: i64,
};

const WindowInfo = struct {
    title: []const u8,
    width: u32,
    height: u32,
    arrays_start: u32, // index into array_decls
    arrays_end: u32,
    root_expr: []const u8,
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

    // Dynamic text
    dyn_texts: [MAX_DYN_TEXTS]DynText,
    dyn_count: u32,
    last_dyn_id: ?u32,

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

    // Classifiers: name → { primitive_type, style_fields_string }
    classifier_names: [128][]const u8,
    classifier_primitives: [128][]const u8,
    classifier_styles: [128][]const u8,
    classifier_text_props: [128][]const u8, // fontSize, color for Text classifiers
    classifier_count: u32,

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
            .ffi_headers = .{},
            .ffi_libs = .{},
            .ffi_funcs = .{},
            .windows = undefined,
            .window_count = 0,
            .input_count = 0,
            .input_multiline = [_]bool{false} ** 16,
            .classifier_names = undefined,
            .classifier_primitives = undefined,
            .classifier_styles = undefined,
            .classifier_text_props = undefined,
            .classifier_count = 0,
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

    fn isSetter(self: *Generator, name: []const u8) ?u32 {
        for (0..self.state_count) |i| {
            if (std.mem.eql(u8, self.state_slots[i].setter, name)) return @intCast(i);
        }
        return null;
    }

    fn isFFIFunc(self: *Generator, name: []const u8) bool {
        for (self.ffi_funcs.items) |f| {
            if (std.mem.eql(u8, f, name)) return true;
        }
        return false;
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

        // Phase 2: Collect declare functions
        self.pos = 0;
        self.collectDeclaredFunctions();

        // Phase 3: Collect classifiers
        self.pos = 0;
        self.collectClassifiers();

        // Phase 4: Find App function and collect useState
        self.pos = 0;
        const app_start = self.findAppFunction() orelse return error.NoAppFunction;
        self.collectStateHooks(app_start);

        // Phase 4: Find return JSX and generate node tree
        self.pos = app_start;
        self.findReturnStatement();
        const root_expr = try self.parseJSXElement();

        // Phase 5: Emit full Zig source
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
                                var initial: i64 = 0;
                                if (self.curKind() == .number) {
                                    initial = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
                                    self.advance_token();
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

        // Parse attributes
        var style_str: []const u8 = "";
        var font_size: []const u8 = "";
        var color_str: []const u8 = "";
        var src_str: []const u8 = "";
        var on_press_start: ?u32 = null;
        var on_press_end: ?u32 = null;
        var title_str: []const u8 = "";
        var width_str: []const u8 = "400";
        var height_str: []const u8 = "300";
        var placeholder_str: []const u8 = "";

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

        const is_window = std.mem.eql(u8, tag_name, "Window");
        const is_scroll = std.mem.eql(u8, tag_name, "ScrollView");
        const is_text_input = std.mem.eql(u8, tag_name, "TextInput") or std.mem.eql(u8, tag_name, "TextArea");
        const is_multiline = std.mem.eql(u8, tag_name, "TextArea");

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
                    } else if (std.mem.eql(u8, attr_name, "onPress")) {
                        // Record the token range for the handler
                        on_press_start = self.pos;
                        try self.skipBalanced();
                        on_press_end = self.pos;
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
        if (style_str.len > 0) try style_parts.appendSlice(self.alloc, style_str);
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

        if (!self_closing) {
            // Parse children until closing tag
            while (self.curKind() != .lt_slash and self.curKind() != .eof) {
                if (self.curKind() == .lt) {
                    // Child JSX element
                    self.last_dyn_id = null;
                    const child = try self.parseJSXElement();
                    try child_exprs.append(self.alloc, child);
                } else if (self.curKind() == .lbrace) {
                    // Expression: {`template`} or {children}
                    self.advance_token(); // skip {
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
                    } else if (self.curKind() == .identifier) {
                        // Could be {children} or {varName}
                        self.advance_token();
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

        // Handler
        if (on_press_start) |start| {
            const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
            self.handler_counter += 1;

            const body = try self.emitHandlerBody(start, on_press_end.?);
            const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n    {s}\n}}", .{ handler_name, body });
            try self.handler_decls.append(self.alloc, handler_fn);

            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".handlers = .{ .on_press = ");
            try fields.appendSlice(self.alloc, handler_name);
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
            if (self.curKind() == .identifier) {
                const key = self.curText();
                self.advance_token();
                if (self.curKind() == .colon) self.advance_token();

                // Get value
                if (std.mem.eql(u8, key, "backgroundColor")) {
                    const val = try self.parseStringAttrInline();
                    const color = try self.parseColorValue(val);
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".background_color = ");
                    try fields.appendSlice(self.alloc, color);
                    
                } else if (mapStyleKey(key)) |zig_key| {
                    const val = self.curText();
                    self.advance_token();
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, zig_key);
                    try fields.appendSlice(self.alloc, " = ");
                    try fields.appendSlice(self.alloc, val);
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
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    const arg = try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
                    try args.appendSlice(self.alloc, arg);
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
        // Skip () =>
        if (self.curKind() == .lparen) self.advance_token();
        if (self.curKind() == .rparen) self.advance_token();
        if (self.curKind() == .arrow) self.advance_token();

        // Parse the expression
        return try self.emitHandlerExpr();
    }

    fn emitHandlerExpr(self: *Generator) ![]const u8 {
        if (self.curKind() == .identifier) {
            const name = self.curText();

            // Check for state setter: setCount(...)
            if (self.isSetter(name)) |slot_id| {
                self.advance_token(); // skip setter name
                if (self.curKind() == .lparen) self.advance_token();
                const arg = try self.emitStateExpr();
                if (self.curKind() == .rparen) self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "state.setSlot({d}, {s});", .{ slot_id, arg });
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
        // Parse a state expression: count + 1, count - 1, time(0), etc.
        var result: std.ArrayListUnmanaged(u8) = .{};

        const first = try self.emitStateAtom();
        try result.appendSlice(self.alloc, first);

        // Check for binary operator
        if (self.curKind() == .plus or self.curKind() == .minus or
            self.curKind() == .star)
        {
            const op = self.curText();
            self.advance_token();
            try result.appendSlice(self.alloc, " ");
            try result.appendSlice(self.alloc, op);
            try result.appendSlice(self.alloc, " ");
            const right = try self.emitStateAtom();
            try result.appendSlice(self.alloc, right);
        }

        return try self.alloc.dupe(u8, result.items);
    }

    fn emitStateAtom(self: *Generator) ![]const u8 {
        if (self.curKind() == .number) {
            const val = self.curText();
            self.advance_token();
            return val;
        }
        if (self.curKind() == .identifier) {
            const name = self.curText();
            if (self.isState(name)) |slot_id| {
                self.advance_token();
                return try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
            }
            // FFI call in expression position
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

    // ── Color parsing ───────────────────────────────────────────────

    fn parseColorValue(self: *Generator, hex: []const u8) ![]const u8 {
        if (hex.len == 0) return "Color.rgb(255, 255, 255)";
        const h = if (hex[0] == '#') hex[1..] else hex;
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
        if (self.has_state) try out.appendSlice(self.alloc, "const state = @import(\"state.zig\");\n");

        // FFI imports
        if (self.ffi_headers.items.len > 0) {
            try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
            for (self.ffi_headers.items) |h| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
            }
            try out.appendSlice(self.alloc, "});\n");
        }

        // Globals
        try out.appendSlice(self.alloc, "\nvar g_text_engine: ?*TextEngine = null;\nvar g_image_cache: ?*ImageCache = null;\n\n");

        // Measure callbacks
        try out.appendSlice(self.alloc, "fn measureCallback(t: []const u8, font_size: u16, max_width: f32) layout.TextMetrics {\n    if (g_text_engine) |te| { return te.measureTextWrapped(t, font_size, max_width); }\n    return .{};\n}\n\n");
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
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "\n// ── Secondary window {d}: \"{s}\" ─────────\nvar _win{d}_root = Node{s};\n", .{ i, w.title, i, w.root_expr[2..] }));
        }

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

        // Painter (same as JS compiler template)
        try out.appendSlice(self.alloc, @embedFile("painter_template.txt"));

        // Main function
        try out.appendSlice(self.alloc, @embedFile("main_template.txt"));

        // State init
        if (self.has_state) {
            for (0..self.state_count) |i| {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlot({d});\n", .{self.state_slots[i].initial}));
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
        }
        if (self.dyn_count > 0) try out.appendSlice(self.alloc, "    updateDynamicTexts();\n");

        // Window init + main loop
        try out.appendSlice(self.alloc, "    defer win_mgr.deinitAll();\n    watchdog.init(512);\n\n");
        try out.appendSlice(self.alloc, @embedFile("loop_template.txt"));

        // State check in loop
        if (self.has_state and self.dyn_count > 0) {
            try out.appendSlice(self.alloc, "        if (state.isDirty()) { updateDynamicTexts(); state.clearDirty(); }\n");
        }

        // Layout + paint + present
        try out.appendSlice(self.alloc, "        if (watchdog.check()) {\n            win_mgr.deinitAll();\n            c.SDL_DestroyRenderer(renderer);\n            c.SDL_DestroyWindow(window);\n            bsod.show(watchdog.getLastReason(), watchdog.getLastDetail());\n            return;\n        }\n");
        try out.appendSlice(self.alloc, "        mpv_mod.poll();\n");
        try out.appendSlice(self.alloc, "        layout.layout(&root, 0, 0, win_w, win_h);\n");
        try out.appendSlice(self.alloc, "        painter.clear(Color.rgb(24, 24, 32));\n");
        try out.appendSlice(self.alloc, "        sel_paint_state = 0;\n");
        try out.appendSlice(self.alloc, "        painter.paintTree(&root, 0, 0);\n");
        try out.appendSlice(self.alloc, "        painter.present();\n");
        try out.appendSlice(self.alloc, "        win_mgr.layoutAll();\n");
        try out.appendSlice(self.alloc, "        win_mgr.paintAndPresent(brighten);\n");
        try out.appendSlice(self.alloc, "    }\n}\n");

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
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, key, m[0])) return m[1];
    }
    return null;
}

const EnumMapping = struct { field: []const u8, prefix: []const u8 };

fn mapEnumKey(key: []const u8) ?EnumMapping {
    if (std.mem.eql(u8, key, "flexDirection")) return .{ .field = "flex_direction", .prefix = "fd" };
    if (std.mem.eql(u8, key, "justifyContent")) return .{ .field = "justify_content", .prefix = "jc" };
    if (std.mem.eql(u8, key, "alignItems")) return .{ .field = "align_items", .prefix = "ai" };
    if (std.mem.eql(u8, key, "display")) return .{ .field = "display", .prefix = "d" };
    if (std.mem.eql(u8, key, "textAlign")) return .{ .field = "text_align", .prefix = "ta" };
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
    return null;
}
