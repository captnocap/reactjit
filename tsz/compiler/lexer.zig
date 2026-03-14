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
    equals, // =
    arrow, // =>
    plus,
    minus,
    star,
    slash,
    percent,
    bang, // !

    // JSX
    lt, // <
    gt, // >
    slash_gt, // />
    lt_slash, // </

    // Special
    ffi_pragma, // // @ffi <header> [-llib]
    comment, // // ...
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

const MAX_TOKENS = 16384;

pub const Lexer = struct {
    source: []const u8,
    pos: u32,
    tokens: [MAX_TOKENS]Token,
    count: u32,

    pub fn init(source: []const u8) Lexer {
        return .{
            .source = source,
            .pos = 0,
            .tokens = undefined,
            .count = 0,
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
        if (self.count >= MAX_TOKENS) return;
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

            // Numbers
            if (ch >= '0' and ch <= '9') {
                while (self.pos < self.source.len and
                    ((self.source[self.pos] >= '0' and self.source[self.pos] <= '9') or
                    self.source[self.pos] == '.'))
                {
                    self.pos += 1;
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
                '<' => .lt,
                '>' => .gt,
                else => null,
            };

            if (single) |kind| {
                self.pos += 1;
                self.emit(kind, start, start + 1);
                continue;
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
