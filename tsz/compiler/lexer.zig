//! Lexer for .tsz — tokenizes TypeScript-like syntax + JSX
//!
//! Produces a flat array of tokens. No heap allocation — fixed-size buffer.
//! Handles: identifiers, numbers, strings, template literals, JSX tags,
//! comments, FFI pragmas, and all punctuation.

const std = @import("std");

pub const TokenKind = enum {
    // Literals
    identifier,
    number,
    string, // "..." or '...'
    template_literal, // `...`

    // Punctuation
    lparen, // (
    rparen, // )
    lbrace, // {
    rbrace, // }
    lbracket, // [
    rbracket, // ]
    comma,
    colon,
    semicolon,
    dot,
    spread, // ...
    equals, // =
    arrow, // =>
    plus,
    minus,
    star,
    slash,
    percent,
    bang, // !

    // Comparison
    eq_eq, // ==
    not_eq, // !=
    gt_eq, // >=
    lt_eq, // <=

    // Bitwise
    ampersand, // &
    pipe, // |
    caret, // ^
    tilde, // ~
    shift_left, // <<
    shift_right, // >>

    // Wrapping arithmetic (Zig)
    wrap_mul, // *%
    wrap_add, // +%
    wrap_sub, // -%
    caret_eq, // ^=

    // Logical
    amp_amp, // &&
    pipe_pipe, // ||

    // Ternary / nullish
    question, // ?
    question_question, // ??

    // JSX
    lt, // <
    gt, // >
    slash_gt, // />
    lt_slash, // </

    // Special
    ffi_pragma, // // @ffi <header> [-llib]
    comment, // // ...
    builtin, // @identifier (Zig builtins like @bitCast, @memcpy, @intCast)
    eof,
};

pub const Token = struct {
    kind: TokenKind,
    start: u32,
    end: u32, // exclusive

    pub fn text(self: Token, source: []const u8) []const u8 {
        return source[self.start..self.end];
    }
};

const MAX_TOKENS = 32768;

pub const Lexer = struct {
    source: []const u8,
    pos: u32,
    tokens: [MAX_TOKENS]Token,
    count: u32,
    overflow: bool,

    pub fn init(source: []const u8) Lexer {
        return .{
            .source = source,
            .pos = 0,
            .tokens = undefined,
            .count = 0,
            .overflow = false,
        };
    }

    fn peek(self: *Lexer) u8 {
        if (self.pos >= self.source.len) return 0;
        return self.source[self.pos];
    }

    fn peekAt(self: *Lexer, offset: u32) u8 {
        const p = self.pos + offset;
        if (p >= self.source.len) return 0;
        return self.source[p];
    }

    fn advance(self: *Lexer) u8 {
        if (self.pos >= self.source.len) return 0;
        const ch = self.source[self.pos];
        self.pos += 1;
        return ch;
    }

    fn emit(self: *Lexer, kind: TokenKind, start: u32, end: u32) void {
        if (self.count >= MAX_TOKENS) {
            if (!self.overflow) {
                self.overflow = true;
                std.debug.print("[tsz] Token limit exceeded ({d}). Source file is too large for single-pass compilation.\n", .{MAX_TOKENS});
            }
            return;
        }
        self.tokens[self.count] = .{ .kind = kind, .start = start, .end = end };
        self.count += 1;
    }

    fn skipWhitespace(self: *Lexer) void {
        while (self.pos < self.source.len) {
            const ch = self.source[self.pos];
            if (ch == ' ' or ch == '\t' or ch == '\n' or ch == '\r') {
                self.pos += 1;
            } else {
                break;
            }
        }
    }

    pub fn tokenize(self: *Lexer) void {
        while (self.pos < self.source.len) {
            self.skipWhitespace();
            if (self.pos >= self.source.len) break;

            const start = self.pos;
            const ch = self.peek();

            // Comments and FFI pragmas
            if (ch == '/' and self.peekAt(1) == '/') {
                self.pos += 2;
                // Check for @ffi pragma
                self.skipWhitespace();
                if (self.pos + 4 <= self.source.len and
                    std.mem.eql(u8, self.source[self.pos..][0..4], "@ffi"))
                {
                    // Scan to end of line
                    while (self.pos < self.source.len and self.source[self.pos] != '\n') {
                        self.pos += 1;
                    }
                    self.emit(.ffi_pragma, start, self.pos);
                } else {
                    // Regular comment — scan to end of line
                    while (self.pos < self.source.len and self.source[self.pos] != '\n') {
                        self.pos += 1;
                    }
                    self.emit(.comment, start, self.pos);
                }
                continue;
            }

            // String literals
            if (ch == '"' or ch == '\'') {
                const quote = ch;
                self.pos += 1;
                while (self.pos < self.source.len) {
                    if (self.source[self.pos] == '\\') {
                        self.pos += 2; // skip escape
                    } else if (self.source[self.pos] == quote) {
                        self.pos += 1;
                        break;
                    } else {
                        self.pos += 1;
                    }
                }
                self.emit(.string, start, self.pos);
                continue;
            }

            // Template literals
            if (ch == '`') {
                self.pos += 1;
                while (self.pos < self.source.len) {
                    if (self.source[self.pos] == '\\') {
                        self.pos += 2;
                    } else if (self.source[self.pos] == '`') {
                        self.pos += 1;
                        break;
                    } else if (self.source[self.pos] == '$' and self.peekAt(1) == '{') {
                        // Skip ${...} — scan for matching }
                        self.pos += 2;
                        var depth: u32 = 1;
                        while (self.pos < self.source.len and depth > 0) {
                            if (self.source[self.pos] == '{') depth += 1;
                            if (self.source[self.pos] == '}') depth -= 1;
                            if (depth > 0) self.pos += 1;
                        }
                        if (self.pos < self.source.len) self.pos += 1; // skip }
                    } else {
                        self.pos += 1;
                    }
                }
                self.emit(.template_literal, start, self.pos);
                continue;
            }

            // Numbers (decimal, hex 0x, binary 0b, octal 0o, scientific 1e-6)
            if (ch >= '0' and ch <= '9') {
                if (ch == '0' and self.pos + 1 < self.source.len and
                    (self.source[self.pos + 1] == 'x' or self.source[self.pos + 1] == 'X' or
                    self.source[self.pos + 1] == 'b' or self.source[self.pos + 1] == 'B' or
                    self.source[self.pos + 1] == 'o' or self.source[self.pos + 1] == 'O'))
                {
                    self.pos += 2; // skip '0' + x/b/o prefix
                    while (self.pos < self.source.len and
                        ((self.source[self.pos] >= '0' and self.source[self.pos] <= '9') or
                        (self.source[self.pos] >= 'a' and self.source[self.pos] <= 'f') or
                        (self.source[self.pos] >= 'A' and self.source[self.pos] <= 'F') or
                        self.source[self.pos] == '_'))
                    {
                        self.pos += 1;
                    }
                } else {
                    while (self.pos < self.source.len and
                        ((self.source[self.pos] >= '0' and self.source[self.pos] <= '9') or
                        self.source[self.pos] == '_' or
                        // Consume '.' as decimal only if not followed by another '.' (range operator)
                        (self.source[self.pos] == '.' and (self.pos + 1 >= self.source.len or self.source[self.pos + 1] != '.'))))
                    {
                        self.pos += 1;
                    }
                    // Scientific notation: e/E followed by optional +/- and digits
                    if (self.pos < self.source.len and
                        (self.source[self.pos] == 'e' or self.source[self.pos] == 'E'))
                    {
                        self.pos += 1; // consume e/E
                        // Optional sign
                        if (self.pos < self.source.len and
                            (self.source[self.pos] == '+' or self.source[self.pos] == '-'))
                        {
                            self.pos += 1;
                        }
                        // Exponent digits
                        while (self.pos < self.source.len and
                            (self.source[self.pos] >= '0' and self.source[self.pos] <= '9'))
                        {
                            self.pos += 1;
                        }
                    }
                }
                self.emit(.number, start, self.pos);
                continue;
            }

            // Identifiers and keywords
            if (isIdentStart(ch)) {
                while (self.pos < self.source.len and isIdentCont(self.source[self.pos])) {
                    self.pos += 1;
                }
                self.emit(.identifier, start, self.pos);
                continue;
            }

            // Multi-char operators
            if (ch == '=' and self.peekAt(1) == '>') {
                self.pos += 2;
                self.emit(.arrow, start, start + 2);
                continue;
            }
            // == (must check after =>)
            if (ch == '=' and self.peekAt(1) == '=') {
                self.pos += 2;
                self.emit(.eq_eq, start, start + 2);
                continue;
            }
            // !=
            if (ch == '!' and self.peekAt(1) == '=') {
                self.pos += 2;
                self.emit(.not_eq, start, start + 2);
                continue;
            }
            if (ch == '/' and self.peekAt(1) == '>') {
                self.pos += 2;
                self.emit(.slash_gt, start, start + 2);
                continue;
            }
            if (ch == '<' and self.peekAt(1) == '/') {
                self.pos += 2;
                self.emit(.lt_slash, start, start + 2);
                continue;
            }
            // Wrapping operators: *%, +% (must check before single * and +)
            if (ch == '*' and self.peekAt(1) == '%') {
                self.pos += 2;
                self.emit(.wrap_mul, start, start + 2);
                continue;
            }
            if (ch == '+' and self.peekAt(1) == '%') {
                self.pos += 2;
                self.emit(.wrap_add, start, start + 2);
                continue;
            }
            if (ch == '-' and self.peekAt(1) == '%') {
                self.pos += 2;
                self.emit(.wrap_sub, start, start + 2);
                continue;
            }
            if (ch == '^' and self.peekAt(1) == '=') {
                self.pos += 2;
                self.emit(.caret_eq, start, start + 2);
                continue;
            }
            // >> (must check before >=)
            if (ch == '>' and self.peekAt(1) == '>') {
                self.pos += 2;
                self.emit(.shift_right, start, start + 2);
                continue;
            }
            // >= (must check before single >)
            if (ch == '>' and self.peekAt(1) == '=') {
                self.pos += 2;
                self.emit(.gt_eq, start, start + 2);
                continue;
            }
            // << (must check before <=)
            if (ch == '<' and self.peekAt(1) == '<') {
                self.pos += 2;
                self.emit(.shift_left, start, start + 2);
                continue;
            }
            // <= (must check before single <)
            if (ch == '<' and self.peekAt(1) == '=') {
                self.pos += 2;
                self.emit(.lt_eq, start, start + 2);
                continue;
            }
            // &&
            if (ch == '&' and self.peekAt(1) == '&') {
                self.pos += 2;
                self.emit(.amp_amp, start, start + 2);
                continue;
            }
            // ||
            if (ch == '|' and self.peekAt(1) == '|') {
                self.pos += 2;
                self.emit(.pipe_pipe, start, start + 2);
                continue;
            }

            // Spread operator (must check before single-char dot)
            if (ch == '.' and self.peekAt(1) == '.' and self.peekAt(2) == '.') {
                self.pos += 3;
                self.emit(.spread, start, start + 3);
                continue;
            }

            // ?? (nullish coalescing, must check before single ?)
            if (ch == '?' and self.peekAt(1) == '?') {
                self.pos += 2;
                self.emit(.question_question, start, start + 2);
                continue;
            }

            // Single-char tokens
            const single: ?TokenKind = switch (ch) {
                '(' => .lparen,
                ')' => .rparen,
                '{' => .lbrace,
                '}' => .rbrace,
                '[' => .lbracket,
                ']' => .rbracket,
                ',' => .comma,
                ':' => .colon,
                ';' => .semicolon,
                '.' => .dot,
                '=' => .equals,
                '+' => .plus,
                '-' => .minus,
                '*' => .star,
                '/' => .slash,
                '%' => .percent,
                '!' => .bang,
                '&' => .ampersand,
                '|' => .pipe,
                '^' => .caret,
                '~' => .tilde,
                '<' => .lt,
                '>' => .gt,
                '?' => .question,
                else => null,
            };

            if (single) |kind| {
                self.pos += 1;
                self.emit(kind, start, start + 1);
                continue;
            }

            // Zig builtins: @identifier or @"escaped identifier"
            if (ch == '@' and self.pos + 1 < self.source.len) {
                if (self.source[self.pos + 1] == '"') {
                    // @"..." — Zig escaped identifier (e.g., @"2d", @"type")
                    self.pos += 2; // skip @"
                    while (self.pos < self.source.len and self.source[self.pos] != '"') {
                        self.pos += 1;
                    }
                    if (self.pos < self.source.len) self.pos += 1; // skip closing "
                    self.emit(.builtin, start, self.pos);
                    continue;
                }
                if (isIdentStart(self.source[self.pos + 1])) {
                    self.pos += 1; // skip @
                    while (self.pos < self.source.len and isIdentCont(self.source[self.pos])) {
                        self.pos += 1;
                    }
                    self.emit(.builtin, start, self.pos);
                    continue;
                }
            }

            // Unknown character — skip
            self.pos += 1;
        }

        self.emit(.eof, self.pos, self.pos);
    }

    /// Get token at index.
    pub fn get(self: *const Lexer, idx: u32) Token {
        if (idx >= self.count) return .{ .kind = .eof, .start = @intCast(self.source.len), .end = @intCast(self.source.len) };
        return self.tokens[idx];
    }
};

fn isIdentStart(ch: u8) bool {
    // Allow ASCII letters, underscore, dollar, AND any non-ASCII byte (>= 0x80).
    // Non-ASCII bytes are UTF-8 continuation/lead bytes — treating them as
    // identifier characters keeps multi-byte Unicode text intact in the token stream.
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or ch == '_' or ch == '$' or ch >= 0x80;
}

fn isIdentCont(ch: u8) bool {
    return isIdentStart(ch) or (ch >= '0' and ch <= '9');
}
