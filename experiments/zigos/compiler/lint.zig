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
                // Skip lowercase tags (html-like, handled by checkHTMLTags)
                if (tag_name.len == 0 or (tag_name[0] >= 'a' and tag_name[0] <= 'z')) {
                    i += 1;
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

    /// HTML tags used instead of primitives
    fn checkHTMLTags(self: *Linter) void {
        const html_map = .{
            .{ "div", "Box" },
            .{ "span", "Text" },
            .{ "p", "Text" },
            .{ "h1", "Text" },
            .{ "h2", "Text" },
            .{ "h3", "Text" },
            .{ "h4", "Text" },
            .{ "h5", "Text" },
            .{ "h6", "Text" },
            .{ "img", "Image" },
            .{ "button", "Pressable" },
            .{ "a", "Pressable" },
            .{ "input", "TextInput" },
            .{ "textarea", "TextInput" },
            .{ "section", "Box" },
            .{ "main", "Box" },
            .{ "nav", "Box" },
            .{ "header", "Box" },
            .{ "footer", "Box" },
            .{ "article", "Box" },
            .{ "aside", "Box" },
            .{ "ul", "Box" },
            .{ "ol", "Box" },
            .{ "li", "Box" },
            .{ "form", "Box" },
            .{ "label", "Text" },
        };

        var i: u32 = 0;
        while (i < self.lex.count) : (i += 1) {
            if (self.kind(i) == .lt and i + 1 < self.lex.count and self.kind(i + 1) == .identifier) {
                const tag = self.text(i + 1);
                inline for (html_map) |entry| {
                    if (std.mem.eql(u8, tag, entry[0])) {
                        const msg = std.fmt.allocPrint(self.alloc,
                            "<{s}> is not a .tsz primitive — use <{s}> instead", .{ entry[0], entry[1] }) catch "Use .tsz primitive";
                        self.emit(self.tok(i + 1).start, .warn, msg);
                        break;
                    }
                }
            }
        }
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
            // className → style
            if (std.mem.eql(u8, name, "className") and i + 1 < self.lex.count and self.kind(i + 1) == .equals) {
                self.emit(self.tok(i).start, .warn, "'className' is not supported — use 'style={{...}}' or a classifier instead");
            }
            // useEffect
            if (std.mem.eql(u8, name, "useEffect")) {
                self.emit(self.tok(i).start, .warn, "'useEffect' is not supported in .tsz — use <script> blocks or useFFI hooks");
            }
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
