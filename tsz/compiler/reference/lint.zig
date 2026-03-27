//! Pre-compilation linter for .tsz files.
//!
//! Catches structural and style issues that cause confusing failures.
//! Runs on tokens only — no Generator needed. Complements validate.zig
//! (which runs post-collection with full semantic context).
//!
//! Error:   Will definitely fail compilation or produce wrong output
//! Warning: Likely a bug — silent misbehavior
//! Hint:    Probably unintended — worth checking

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const TokenKind = lexer_mod.TokenKind;
const attrs = @import("attrs.zig");

pub const Level = enum { err, warn, hint };

pub const Diagnostic = struct {
    offset: u32,
    line: u32,
    col: u32,
    level: Level,
    message: []const u8,
};

pub const LintResult = struct {
    diagnostics: []Diagnostic,
    error_count: u32,
    warning_count: u32,
    hint_count: u32,
};

const MAX_DIAG = 256;

pub const Linter = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    diags: [MAX_DIAG]Diagnostic,
    count: u32,
    errors: u32,
    warnings: u32,
    hints: u32,

    pub fn init(alloc: std.mem.Allocator, lex: *const Lexer, source: []const u8) Linter {
        return .{
            .alloc = alloc,
            .lex = lex,
            .source = source,
            .diags = undefined,
            .count = 0,
            .errors = 0,
            .warnings = 0,
            .hints = 0,
        };
    }

    fn emit(self: *Linter, offset: u32, level: Level, message: []const u8) void {
        if (self.count >= MAX_DIAG) return;
        const loc = offsetToLineCol(self.source, offset);
        self.diags[self.count] = .{
            .offset = offset,
            .line = loc.line,
            .col = loc.col,
            .level = level,
            .message = message,
        };
        self.count += 1;
        switch (level) {
            .err => self.errors += 1,
            .warn => self.warnings += 1,
            .hint => self.hints += 1,
        }
    }

    fn tok(self: *Linter, idx: u32) lexer_mod.Token {
        return self.lex.get(idx);
    }

    fn text(self: *Linter, idx: u32) []const u8 {
        return self.tok(idx).text(self.source);
    }

    fn kind(self: *Linter, idx: u32) TokenKind {
        return self.tok(idx).kind;
    }

    fn isIdent(self: *Linter, idx: u32, name: []const u8) bool {
        return self.kind(idx) == .identifier and std.mem.eql(u8, self.text(idx), name);
    }

    // ── Checks ──

    pub fn run(self: *Linter) LintResult {
        self.checkBraceBalance();
        self.checkJSXBalance();
        self.checkHTMLTags();
        self.checkReactHabits();
        self.checkStyleProperties();
        self.checkUseStateSyntax();
        self.checkDuplicateState();
        self.checkFFIPragmaFormat();
        self.checkSingleBraceStyle();
        self.checkNoAppFunction();
        self.checkChildOverflow();
        self.checkPropConditionals();
        self.checkMultiReturn();

        return .{
            .diagnostics = self.diags[0..self.count],
            .error_count = self.errors,
            .warning_count = self.warnings,
            .hint_count = self.hints,
        };
    }

    /// Unbalanced braces, parens, brackets
    fn checkBraceBalance(self: *Linter) void {
        var braces: i32 = 0;
        var parens: i32 = 0;
        var brackets: i32 = 0;
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            const k = self.kind(i);
            switch (k) {
                .lbrace => braces += 1,
                .rbrace => braces -= 1,
                .lparen => parens += 1,
                .rparen => parens -= 1,
                .lbracket => brackets += 1,
                .rbracket => brackets -= 1,
                .eof => break,
                else => {},
            }
            if (braces < 0) {
                self.emit(self.tok(i).start, .err, "Extra closing brace '}' — no matching '{'");
                braces = 0;
            }
            if (parens < 0) {
                self.emit(self.tok(i).start, .err, "Extra closing paren ')' — no matching '('");
                parens = 0;
            }
            if (brackets < 0) {
                self.emit(self.tok(i).start, .err, "Extra closing bracket ']' — no matching '['");
                brackets = 0;
            }
        }
        if (braces > 0) self.emit(self.tok(if (i > 0) i - 1 else 0).start, .err, "Unclosed brace '{' — missing '}'");
        if (parens > 0) self.emit(self.tok(if (i > 0) i - 1 else 0).start, .err, "Unclosed paren '(' — missing ')'");
        if (brackets > 0) self.emit(self.tok(if (i > 0) i - 1 else 0).start, .err, "Unclosed bracket '[' — missing ']'");
    }

    /// Mismatched JSX tags: <Box>...</Text>
    fn checkJSXBalance(self: *Linter) void {
        var tag_stack: [128]struct { name: []const u8, offset: u32 } = undefined;
        var depth: u32 = 0;
        var i: u32 = 0;

        while (i < self.lex.count) : (i += 1) {
            const k = self.kind(i);
            if (k == .eof) break;

            // Opening tag: < Identifier ... > (not < / or < >)
            if (k == .lt and i + 1 < self.lex.count and self.kind(i + 1) == .identifier) {
                const tag_name = self.text(i + 1);
                // Skip empty tags
                if (tag_name.len == 0) {
                    i += 1;
                    continue;
                }
                // Raw <script>/<zscript> contents are not JSX and may contain '<' operators.
                // Skip directly to the matching closing tag so balance checking doesn't
                // misinterpret expressions like `j < list.length` as nested JSX tags.
                if (std.mem.eql(u8, tag_name, "script") or std.mem.eql(u8, tag_name, "zscript")) {
                    var j = i + 2;
                    while (j < self.lex.count and self.kind(j) != .gt and self.kind(j) != .eof) j += 1;
                    i = j;
                    while (i < self.lex.count) : (i += 1) {
                        if (self.kind(i) == .lt_slash and
                            i + 1 < self.lex.count and
                            self.kind(i + 1) == .identifier)
                        {
                            const close_name = self.text(i + 1);
                            if (std.mem.eql(u8, close_name, tag_name)) {
                                while (i < self.lex.count and self.kind(i) != .gt and self.kind(i) != .eof) i += 1;
                                break;
                            }
                        }
                    }
                    continue;
                }
                // Scan forward to see if self-closing
                var j = i + 2;
                var is_self_closing = false;
                while (j < self.lex.count) {
                    const jk = self.kind(j);
                    if (jk == .slash_gt) { is_self_closing = true; break; }
                    if (jk == .gt) break;
                    if (jk == .eof) break;
                    j += 1;
                }
                if (!is_self_closing and depth < 128) {
                    tag_stack[depth] = .{ .name = tag_name, .offset = self.tok(i + 1).start };
                    depth += 1;
                }
                i = j; // skip past the tag
                continue;
            }

            // Closing tag: </ Identifier >
            if (k == .lt_slash and i + 1 < self.lex.count and self.kind(i + 1) == .identifier) {
                const close_name = self.text(i + 1);
                if (depth > 0) {
                    const expected = tag_stack[depth - 1].name;
                    if (!std.mem.eql(u8, expected, close_name)) {
                        const msg = std.fmt.allocPrint(self.alloc,
                            "Mismatched JSX: opened <{s}> but closed with </{s}>", .{ expected, close_name }) catch "Mismatched JSX tags";
                        self.emit(self.tok(i + 1).start, .err, msg);
                    }
                    depth -= 1;
                }
                // Skip past >
                i += 1;
                while (i < self.lex.count and self.kind(i) != .gt and self.kind(i) != .eof) i += 1;
                continue;
            }

            // Fragment close: </>
            if (k == .lt_slash and i + 1 < self.lex.count and self.kind(i + 1) == .gt) {
                // Don't check — fragments are anonymous
                i += 1;
            }
        }
    }

    /// HTML tags used instead of primitives — now accepted natively, no warning needed.
    fn checkHTMLTags(self: *Linter) void {
        _ = self;
    }

    /// React habits that don't work in .tsz
    fn checkReactHabits(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) != .identifier) continue;
            const name = self.text(i);

            // onClick → onPress
            if (std.mem.eql(u8, name, "onClick") and i + 1 < self.lex.count and self.kind(i + 1) == .equals) {
                self.emit(self.tok(i).start, .warn, "'onClick' is not supported — use 'onPress' instead");
            }
            // onContextMenu → onRightClick
            if (std.mem.eql(u8, name, "onContextMenu") and i + 1 < self.lex.count and self.kind(i + 1) == .equals) {
                self.emit(self.tok(i).start, .warn, "'onContextMenu' is not supported — use 'onRightClick' instead");
            }
            // className → style
            if (std.mem.eql(u8, name, "className") and i + 1 < self.lex.count and self.kind(i + 1) == .equals) {
                self.emit(self.tok(i).start, .warn, "'className' is not supported — use 'style={{...}}' or a classifier instead");
            }
            // useEffect — supported since Phase 6.25
            // (mount, watch, frame, interval variants)
            // useRef
            if (std.mem.eql(u8, name, "useRef")) {
                self.emit(self.tok(i).start, .warn, "'useRef' is not supported in .tsz");
            }
            // useMemo / useCallback
            if (std.mem.eql(u8, name, "useMemo") or std.mem.eql(u8, name, "useCallback")) {
                self.emit(self.tok(i).start, .hint, "useMemo/useCallback are not needed in .tsz — all components are compile-time inlined");
            }
        }
    }

    /// Unknown or problematic style properties
    fn checkStyleProperties(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            // Find style={{ ... }} blocks
            if (!self.isIdent(i, "style")) continue;
            if (i + 1 >= self.lex.count or self.kind(i + 1) != .equals) continue;

            // Skip to the inner brace
            var j = i + 2;
            if (j < self.lex.count and self.kind(j) == .lbrace) j += 1;
            if (j < self.lex.count and self.kind(j) == .lbrace) j += 1;

            // Scan property names until }
            while (j < self.lex.count and self.kind(j) != .rbrace and self.kind(j) != .eof) {
                // Style keys can be identifiers or quoted strings ('flex-direction')
                var prop: []const u8 = "";
                if (self.kind(j) == .identifier) {
                    prop = self.text(j);
                } else if (self.kind(j) == .string) {
                    const raw = self.text(j);
                    if (raw.len >= 2) prop = raw[1 .. raw.len - 1];
                }
                if (prop.len > 0) {

                    // Check for unsupported shorthand properties
                    if (std.mem.eql(u8, prop, "paddingHorizontal") or std.mem.eql(u8, prop, "paddingVertical")) {
                        const msg = std.fmt.allocPrint(self.alloc,
                            "'{s}' is not supported — use paddingLeft/paddingRight or paddingTop/paddingBottom", .{prop}) catch "Unsupported shorthand";
                        self.emit(self.tok(j).start, .err, msg);
                    }
                    if (std.mem.eql(u8, prop, "marginHorizontal") or std.mem.eql(u8, prop, "marginVertical")) {
                        const msg = std.fmt.allocPrint(self.alloc,
                            "'{s}' is not supported — use marginLeft/marginRight or marginTop/marginBottom", .{prop}) catch "Unsupported shorthand";
                        self.emit(self.tok(j).start, .err, msg);
                    }

                    // Check for CSS-style properties that need camelCase
                    if (std.mem.indexOf(u8, prop, "-") != null) {
                        const msg = std.fmt.allocPrint(self.alloc,
                            "'{s}' uses kebab-case — use camelCase (e.g. 'flexDirection' not 'flex-direction')", .{prop}) catch "Use camelCase";
                        self.emit(self.tok(j).start, .warn, msg);
                    }

                    // transition: { ... } — skip the entire nested config block
                    if (std.mem.eql(u8, prop, "transition") and j + 1 < self.lex.count and self.kind(j + 1) == .colon) {
                        j += 2; // skip "transition" and ":"
                        if (j < self.lex.count and self.kind(j) == .lbrace) {
                            var depth: u32 = 1;
                            j += 1;
                            while (j < self.lex.count and depth > 0) : (j += 1) {
                                if (self.kind(j) == .lbrace) depth += 1;
                                if (self.kind(j) == .rbrace) depth -= 1;
                            }
                        }
                        continue;
                    }

                    // Check if it's a known style property
                    if (j + 1 < self.lex.count and self.kind(j + 1) == .colon) {
                        const is_known = attrs.mapStyleKey(prop) != null or
                            attrs.mapStyleKeyI16(prop) != null or
                            attrs.mapColorKey(prop) != null or
                            attrs.mapEnumKey(prop) != null or
                            std.mem.eql(u8, prop, "color") or
                            std.mem.eql(u8, prop, "fontSize") or
                            std.mem.eql(u8, prop, "fontWeight") or
                            std.mem.eql(u8, prop, "letterSpacing") or
                            std.mem.eql(u8, prop, "lineHeight");

                        if (!is_known and prop.len > 0 and prop[0] >= 'a' and prop[0] <= 'z') {
                            const msg = std.fmt.allocPrint(self.alloc,
                                "Unknown style property '{s}' — will be silently ignored", .{prop}) catch "Unknown style property";
                            self.emit(self.tok(j).start, .warn, msg);
                        }

                        // Check enum values
                        if (attrs.mapEnumKey(prop)) |mapping| {
                            // Skip past colon to the value
                            const vj = j + 2;
                            if (vj < self.lex.count and self.kind(vj) == .string) {
                                const raw = self.text(vj);
                                if (raw.len >= 2) {
                                    const val = raw[1 .. raw.len - 1];
                                    if (attrs.mapEnumValue(mapping.prefix, val) == null) {
                                        const msg = std.fmt.allocPrint(self.alloc,
                                            "Invalid value '{s}' for '{s}' — will be silently ignored", .{ val, prop }) catch "Invalid enum value";
                                        self.emit(self.tok(vj).start, .warn, msg);
                                    }
                                }
                            }
                        }
                    }
                }
                j += 1;
            }
            i = j;
        }
    }

    /// useState must use [getter, setter] destructuring
    fn checkUseStateSyntax(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (!self.isIdent(i, "useState")) continue;
            // Look backwards for the pattern: const [ getter , setter ] = useState
            if (i < 4) {
                self.emit(self.tok(i).start, .err, "useState must use destructuring: const [value, setter] = useState(...)");
                continue;
            }
            // Walk backwards: expect = ] setter , getter [ const/let
            var valid = false;
            if (i >= 1 and self.kind(i - 1) == .equals) {
                if (i >= 2 and self.kind(i - 2) == .rbracket) {
                    valid = true;
                }
            }
            if (!valid) {
                self.emit(self.tok(i).start, .err, "useState must use destructuring: const [value, setter] = useState(...)");
            }
        }
    }

    /// Duplicate state getter names
    fn checkDuplicateState(self: *Linter) void {
        var getters: [128][]const u8 = undefined;
        var getter_offsets: [128]u32 = undefined;
        var getter_count: u32 = 0;

        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            // Pattern: const [ GETTER ,
            if (self.isIdent(i, "const") and i + 2 < self.lex.count and
                self.kind(i + 1) == .lbracket and self.kind(i + 2) == .identifier)
            {
                // Check if this is a useState pattern
                const getter = self.text(i + 2);
                // Look for useState later
                var j = i + 3;
                while (j < self.lex.count and j < i + 10) : (j += 1) {
                    if (self.isIdent(j, "useState") or self.isIdent(j, "useFFI")) {
                        // Check for duplicate
                        for (getters[0..getter_count]) |existing| {
                            if (std.mem.eql(u8, existing, getter)) {
                                const msg = std.fmt.allocPrint(self.alloc,
                                    "Duplicate state variable '{s}' — already declared above", .{getter}) catch "Duplicate state";
                                self.emit(self.tok(i + 2).start, .err, msg);
                                break;
                            }
                        }
                        if (getter_count < 128) {
                            getters[getter_count] = getter;
                            getter_offsets[getter_count] = self.tok(i + 2).start;
                            getter_count += 1;
                        }
                        break;
                    }
                }
            }
        }
    }

    /// FFI pragma format: // @ffi <header.h> -llib
    fn checkFFIPragmaFormat(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) != .ffi_pragma) continue;
            const pragma = self.text(i);
            if (std.mem.indexOf(u8, pragma, "<") == null) {
                self.emit(self.tok(i).start, .err, "FFI pragma must use angle brackets: // @ffi <header.h> [-llib]");
            }
        }
    }

    /// style={} with single braces (should be style={{}})
    fn checkSingleBraceStyle(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (!self.isIdent(i, "style")) continue;
            if (i + 2 >= self.lex.count) continue;
            if (self.kind(i + 1) != .equals) continue;
            if (self.kind(i + 2) != .lbrace) continue;
            // style={ ... } — check if next token after { is NOT {
            if (i + 3 < self.lex.count and self.kind(i + 3) != .lbrace) {
                // Could be style={someVar} which is fine, or style={width: 100} which is wrong
                // Only warn if we see an identifier followed by colon (object literal without double braces)
                if (i + 4 < self.lex.count and self.kind(i + 3) == .identifier and self.kind(i + 4) == .colon) {
                    self.emit(self.tok(i + 2).start, .err, "style needs double braces: style={{ ... }} not style={ ... }");
                }
            }
        }
    }

    /// No App function or no function at all
    fn checkNoAppFunction(self: *Linter) void {
        var has_function = false;
        var has_app = false;
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) == .eof) break;
            if (self.isIdent(i, "function")) {
                has_function = true;
                if (i + 1 < self.lex.count and self.isIdent(i + 1, "App")) {
                    has_app = true;
                }
            }
        }
        if (!has_function) {
            self.emit(0, .err, "No function found — .tsz files need at least one function (ideally 'App')");
        } else if (!has_app) {
            self.emit(0, .hint, "No 'App' function found — the compiler will use the last function as the entry point");
        }
    }

    /// Child overflow detection — warns when a child has explicit pixel
    /// dimensions larger than its parent's explicit pixel dimensions.
    ///
    /// Tracks JSX nesting with a dimension stack. Only fires on explicit
    /// pixel values (not percentages, not flexGrow, not auto-sized).
    /// Also accounts for parent padding reducing available space.
    fn checkChildOverflow(self: *Linter) void {
        const MAX_DEPTH = 64;
        const DimEntry = struct {
            width: ?f32 = null,
            height: ?f32 = null,
            pad_l: f32 = 0,
            pad_r: f32 = 0,
            pad_t: f32 = 0,
            pad_b: f32 = 0,
            pad_all: f32 = 0, // shorthand 'padding'
            tag_offset: u32 = 0,

            fn availWidth(e: *const @This()) ?f32 {
                const w = e.width orelse return null;
                const pl = if (e.pad_l > 0) e.pad_l else e.pad_all;
                const pr = if (e.pad_r > 0) e.pad_r else e.pad_all;
                return w - pl - pr;
            }

            fn availHeight(e: *const @This()) ?f32 {
                const h = e.height orelse return null;
                const pt = if (e.pad_t > 0) e.pad_t else e.pad_all;
                const pb = if (e.pad_b > 0) e.pad_b else e.pad_all;
                return h - pt - pb;
            }
        };

        var stack: [MAX_DEPTH]DimEntry = undefined;
        var depth: u32 = 0;
        var i: u32 = 0;

        while (i < self.lex.count) : (i += 1) {
            const k = self.kind(i);
            if (k == .eof) break;

            // Opening tag: < Identifier ...
            if (k == .lt and i + 1 < self.lex.count and self.kind(i + 1) == .identifier) {
                const tag_name = self.text(i + 1);
                // Skip unknown lowercase tags (HTML tags are now accepted)
                if (tag_name.len == 0) {
                    i += 1;
                    continue;
                }

                // Parse the element's style dimensions
                var entry = DimEntry{ .tag_offset = self.tok(i + 1).start };
                var j = i + 2;

                // Scan for style={{ ... }} within this tag
                while (j < self.lex.count) {
                    const jk = self.kind(j);
                    if (jk == .gt or jk == .slash_gt or jk == .eof) break;

                    if (self.isIdent(j, "style") and j + 3 < self.lex.count and
                        self.kind(j + 1) == .equals and self.kind(j + 2) == .lbrace and
                        self.kind(j + 3) == .lbrace)
                    {
                        // Parse style object
                        var sj = j + 4;
                        while (sj < self.lex.count and self.kind(sj) != .rbrace and self.kind(sj) != .eof) {
                            if (self.kind(sj) == .identifier and sj + 2 < self.lex.count and
                                self.kind(sj + 1) == .colon)
                            {
                                const prop = self.text(sj);
                                const val = self.parseNumericValue(sj + 2);

                                if (val) |v| {
                                    if (std.mem.eql(u8, prop, "width")) { entry.width = v; }
                                    else if (std.mem.eql(u8, prop, "height")) { entry.height = v; }
                                    else if (std.mem.eql(u8, prop, "padding")) { entry.pad_all = v; }
                                    else if (std.mem.eql(u8, prop, "paddingLeft")) { entry.pad_l = v; }
                                    else if (std.mem.eql(u8, prop, "paddingRight")) { entry.pad_r = v; }
                                    else if (std.mem.eql(u8, prop, "paddingTop")) { entry.pad_t = v; }
                                    else if (std.mem.eql(u8, prop, "paddingBottom")) { entry.pad_b = v; }
                                }
                            }
                            sj += 1;
                        }
                    }
                    j += 1;
                }

                // Check if self-closing
                var is_self_closing = false;
                var scan = i + 2;
                while (scan < self.lex.count) {
                    const sk = self.kind(scan);
                    if (sk == .slash_gt) { is_self_closing = true; break; }
                    if (sk == .gt) break;
                    if (sk == .eof) break;
                    scan += 1;
                }

                // Compare child against parent
                if (depth > 0 and !is_self_closing) {
                    const parent = &stack[depth - 1];
                    if (entry.width) |cw| {
                        if (parent.availWidth()) |pw| {
                            if (cw > pw) {
                                const msg = std.fmt.allocPrint(self.alloc,
                                    "Child width ({d:.0}px) exceeds parent's available width ({d:.0}px) — will overflow", .{ cw, pw }) catch "Child wider than parent";
                                self.emit(entry.tag_offset, .warn, msg);
                            }
                        }
                    }
                    if (entry.height) |ch| {
                        if (parent.availHeight()) |ph| {
                            if (ch > ph) {
                                const msg = std.fmt.allocPrint(self.alloc,
                                    "Child height ({d:.0}px) exceeds parent's available height ({d:.0}px) — will overflow", .{ ch, ph }) catch "Child taller than parent";
                                self.emit(entry.tag_offset, .warn, msg);
                            }
                        }
                    }
                } else if (is_self_closing and depth > 0) {
                    // Self-closing — check but don't push
                    const parent = &stack[depth - 1];
                    if (entry.width) |cw| {
                        if (parent.availWidth()) |pw| {
                            if (cw > pw) {
                                const msg = std.fmt.allocPrint(self.alloc,
                                    "Child width ({d:.0}px) exceeds parent's available width ({d:.0}px) — will overflow", .{ cw, pw }) catch "Child wider than parent";
                                self.emit(entry.tag_offset, .warn, msg);
                            }
                        }
                    }
                    if (entry.height) |ch| {
                        if (parent.availHeight()) |ph| {
                            if (ch > ph) {
                                const msg = std.fmt.allocPrint(self.alloc,
                                    "Child height ({d:.0}px) exceeds parent's available height ({d:.0}px) — will overflow", .{ ch, ph }) catch "Child taller than parent";
                                self.emit(entry.tag_offset, .warn, msg);
                            }
                        }
                    }
                    i = scan;
                    continue;
                }

                if (!is_self_closing and depth < MAX_DEPTH) {
                    stack[depth] = entry;
                    depth += 1;
                }

                i = scan;
                continue;
            }

            // Closing tag: </ Identifier >
            if (k == .lt_slash and i + 1 < self.lex.count and self.kind(i + 1) == .identifier) {
                if (depth > 0) depth -= 1;
                while (i < self.lex.count and self.kind(i) != .gt and self.kind(i) != .eof) i += 1;
                continue;
            }

            // Fragment close: </>
            if (k == .lt_slash and i + 1 < self.lex.count and self.kind(i + 1) == .gt) {
                // Fragments don't have dimensions, but might have pushed a stack entry
                i += 1;
            }
        }
    }

    /// Detect component functions that use {prop == N && <JSX>} conditionals.
    /// These require ALL callers to pass the prop — unpassed props default to 0,
    /// which may silently show/hide the wrong variant.
    fn checkPropConditionals(self: *Linter) void {
        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) == .eof) break;
            // Find: function ComponentName({ prop1, prop2, ... })
            if (!self.isIdent(i, "function")) continue;
            if (i + 1 >= self.lex.count or self.kind(i + 1) != .identifier) continue;
            const func_name = self.text(i + 1);
            // Skip App — it's the entry point, not a component
            if (std.mem.eql(u8, func_name, "App")) continue;
            // Must start uppercase (component convention)
            if (func_name.len == 0 or func_name[0] < 'A' or func_name[0] > 'Z') continue;

            // Collect declared prop names from ({ prop1, prop2 })
            var prop_names: [32][]const u8 = undefined;
            var prop_count: u32 = 0;
            var j = i + 2;
            // Skip to opening ( then {
            while (j < self.lex.count and self.kind(j) != .lbrace and self.kind(j) != .eof) j += 1;
            j += 1; // skip {
            while (j < self.lex.count and self.kind(j) != .rbrace and self.kind(j) != .eof) {
                if (self.kind(j) == .identifier and prop_count < 32) {
                    prop_names[prop_count] = self.text(j);
                    prop_count += 1;
                }
                j += 1;
            }
            if (prop_count == 0) continue;

            // Now scan the function body for {prop == N && or {prop != N &&
            // Track brace depth to stay within this function
            var body_depth: u32 = 0;
            var found_body = false;
            while (j < self.lex.count) : (j += 1) {
                const k = self.kind(j);
                if (k == .eof) break;
                if (k == .lbrace) { body_depth += 1; found_body = true; }
                if (k == .rbrace) {
                    if (body_depth <= 1 and found_body) break; // end of function
                    if (body_depth > 0) body_depth -= 1;
                }
                // Pattern: identifier (== | !=) number &&
                if (k == .identifier and j + 3 < self.lex.count) {
                    const ident = self.text(j);
                    const next_k = self.kind(j + 1);
                    if ((next_k == .eq_eq or next_k == .not_eq) and self.kind(j + 2) == .number) {
                        if (self.kind(j + 3) == .amp_amp) {
                            // Check if ident is a declared prop
                            for (prop_names[0..prop_count]) |pn| {
                                if (std.mem.eql(u8, pn, ident)) {
                                    const msg = std.fmt.allocPrint(self.alloc,
                                        "Component '{s}' uses conditional on prop '{s}' — callers that omit this prop will default to 0", .{ func_name, ident }) catch "Prop conditional warning";
                                    self.emit(self.tok(j).start, .hint, msg);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            i = j;
        }
    }

    /// Detect component functions with multiple return statements.
    /// The compiler only handles a single return — extra returns are silently
    /// skipped and their JSX content leaks through as bare text.
    fn checkMultiReturn(self: *Linter) void {
        var i: u32 = 0;
        var in_script = false;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) == .eof) break;
            // Track <script> blocks — functions inside are JS helpers, not components
            if (self.kind(i) == .lt and i + 1 < self.lex.count and self.isIdent(i + 1, "script")) {
                in_script = true;
                continue;
            }
            if (self.kind(i) == .lt_slash and i + 1 < self.lex.count and self.isIdent(i + 1, "script")) {
                in_script = false;
                continue;
            }
            if (in_script) continue;
            // Find: function Name(
            if (!self.isIdent(i, "function")) continue;
            if (i + 1 >= self.lex.count or self.kind(i + 1) != .identifier) continue;
            const func_name = self.text(i + 1);
            // Skip App — entry point, single return is enforced elsewhere
            if (std.mem.eql(u8, func_name, "App")) continue;

            // Skip past parameter list (...) to find function body {
            var j = i + 2;
            while (j < self.lex.count and self.kind(j) != .rparen and self.kind(j) != .eof) j += 1;
            j += 1; // skip )
            while (j < self.lex.count and self.kind(j) != .lbrace and self.kind(j) != .eof) j += 1;
            if (j >= self.lex.count) continue;

            // Count return statements at depth 1 (top-level of function body)
            var depth: u32 = 0;
            var return_count: u32 = 0;
            var first_return_offset: u32 = 0;
            while (j < self.lex.count) : (j += 1) {
                const k = self.kind(j);
                if (k == .eof) break;
                if (k == .lbrace) depth += 1;
                if (k == .rbrace) {
                    if (depth <= 1) break; // end of function
                    depth -= 1;
                }
                // return at any depth inside the function body (skip text content like <Tag>return</Tag>)
                if (depth >= 1 and self.isIdent(j, "return") and (j == 0 or self.kind(j - 1) != .gt)) {
                    return_count += 1;
                    if (return_count == 1) first_return_offset = self.tok(j).start;
                }
            }
            if (return_count > 1) {
                const msg = std.fmt.allocPrint(self.alloc,
                    "Component '{s}' has {d} return statements — compiler only handles one. Use Fragment + {{prop && <JSX>}} conditionals instead of if/return", .{ func_name, return_count }) catch "Multi-return component";
                self.emit(first_return_offset, .warn, msg);
            }
            i = j;
        }
    }

    /// Try to parse a numeric pixel value from a token position.
    /// Returns null for percentages, strings, expressions, variables.
    fn parseNumericValue(self: *Linter, idx: u32) ?f32 {
        if (idx >= self.lex.count) return null;
        const k = self.kind(idx);

        if (k == .number) {
            const num_text = self.text(idx);
            return std.fmt.parseFloat(f32, num_text) catch null;
        }

        // Skip percentage strings like '100%'
        if (k == .string) {
            const raw = self.text(idx);
            if (raw.len >= 2) {
                const inner = raw[1 .. raw.len - 1];
                if (std.mem.indexOf(u8, inner, "%") != null) return null;
                // Try parsing as a number string (e.g., '400')
                return std.fmt.parseFloat(f32, inner) catch null;
            }
        }

        return null;
    }
};

// ── Helpers ──

fn offsetToLineCol(source: []const u8, offset: u32) struct { line: u32, col: u32 } {
    var line: u32 = 1;
    var col: u32 = 1;
    var i: u32 = 0;
    while (i < offset and i < source.len) : (i += 1) {
        if (source[i] == '\n') {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    return .{ .line = line, .col = col };
}

/// Format diagnostics for terminal output
pub fn formatDiagnostics(alloc: std.mem.Allocator, result: LintResult, filename: []const u8) ![]const u8 {
    if (result.diagnostics.len == 0) return "";
    var out: std.ArrayListUnmanaged(u8) = .{};
    for (result.diagnostics) |d| {
        const level_str = switch (d.level) {
            .err => "error",
            .warn => "warning",
            .hint => "hint",
        };
        try out.appendSlice(alloc, try std.fmt.allocPrint(alloc,
            "{s}:{d}:{d}: {s}: {s}\n", .{ filename, d.line, d.col, level_str, d.message }));
    }
    try out.appendSlice(alloc, try std.fmt.allocPrint(alloc,
        "\n{d} error(s), {d} warning(s), {d} hint(s)\n",
        .{ result.error_count, result.warning_count, result.hint_count }));
    return try alloc.dupe(u8, out.items);
}
