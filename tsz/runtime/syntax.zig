//! Syntax Highlighting Tokenizer
//!
//! Byte-by-byte line tokenizers for 5 languages. No allocation —
//! writes to a caller-provided ColorSpan buffer.
//! Ported from love2d/lua/syntax.lua (Catppuccin Mocha palette).

const std = @import("std");
const layout = @import("layout.zig");
const text_mod = @import("text.zig");

const Color = layout.Color;
const ColorSpan = text_mod.ColorSpan;

// ── Language ────────────────────────────────────────────────────────────────

pub const Language = enum {
    zig,
    typescript,
    json,
    bash,
    markdown,
    plain,

    /// Detect language from a file extension or name hint.
    pub fn fromString(s: []const u8) Language {
        if (std.mem.eql(u8, s, "zig")) return .zig;
        if (std.mem.eql(u8, s, "typescript") or std.mem.eql(u8, s, "ts") or
            std.mem.eql(u8, s, "tsx") or std.mem.eql(u8, s, "jsx") or
            std.mem.eql(u8, s, "javascript") or std.mem.eql(u8, s, "js")) return .typescript;
        if (std.mem.eql(u8, s, "json")) return .json;
        if (std.mem.eql(u8, s, "bash") or std.mem.eql(u8, s, "sh") or
            std.mem.eql(u8, s, "shell") or std.mem.eql(u8, s, "zsh")) return .bash;
        if (std.mem.eql(u8, s, "markdown") or std.mem.eql(u8, s, "md")) return .markdown;
        return .plain;
    }
};

// ── Catppuccin Mocha Palette ────────────────────────────────────────────────

const C = struct {
    const keyword = Color.rgb(203, 166, 247); // mauve
    const string = Color.rgb(166, 227, 161); // green
    const number = Color.rgb(250, 179, 135); // peach
    const comment = Color.rgb(108, 112, 134); // overlay0
    const function_name = Color.rgb(137, 180, 250); // blue
    const type_name = Color.rgb(148, 226, 213); // teal
    const operator = Color.rgb(148, 226, 213); // teal
    const punctuation = Color.rgb(147, 153, 178); // overlay2
    const text = Color.rgb(205, 214, 244); // text
    const tag = Color.rgb(137, 180, 250); // blue
    const attribute = Color.rgb(250, 179, 135); // peach
    const builtin = Color.rgb(250, 179, 135); // peach
    const variable = Color.rgb(243, 139, 168); // red (for $vars in bash)
    const heading = Color.rgb(137, 180, 250); // blue (markdown headings)
    const bold_text = Color.rgb(250, 179, 135); // peach (markdown bold)
    const link = Color.rgb(148, 226, 213); // teal (markdown links)
};

// ── Public API ──────────────────────────────────────────────────────────────

/// Tokenize a single line of code into colored spans.
/// Returns the number of spans written to `out`.
/// No allocation — all output goes into the caller-provided buffer.
pub fn tokenizeLine(line: []const u8, lang: Language, out: []ColorSpan) usize {
    return switch (lang) {
        .typescript => tokenizeTypeScript(line, out),
        .zig => tokenizeZig(line, out),
        .json => tokenizeJSON(line, out),
        .bash => tokenizeBash(line, out),
        .markdown => tokenizeMarkdown(line, out),
        .plain => tokenizePlain(line, out),
    };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn isAlpha(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or ch == '_';
}

fn isDigit(ch: u8) bool {
    return ch >= '0' and ch <= '9';
}

fn isAlnum(ch: u8) bool {
    return isAlpha(ch) or isDigit(ch);
}

fn isHexDigit(ch: u8) bool {
    return isDigit(ch) or (ch >= 'a' and ch <= 'f') or (ch >= 'A' and ch <= 'F');
}

fn isUpper(ch: u8) bool {
    return ch >= 'A' and ch <= 'Z';
}

fn isSpace(ch: u8) bool {
    return ch == ' ' or ch == '\t';
}

fn emit(out: []ColorSpan, count: *usize, text: []const u8, color: Color) void {
    if (count.* < out.len and text.len > 0) {
        out[count.*] = .{ .text = text, .color = color };
        count.* += 1;
    }
}

fn inWordList(word: []const u8, list: []const []const u8) bool {
    for (list) |kw| {
        if (std.mem.eql(u8, word, kw)) return true;
    }
    return false;
}

// ── TypeScript / TSX Tokenizer ──────────────────────────────────────────────

const ts_keywords = [_][]const u8{
    "const",    "let",       "var",       "function",  "return",
    "if",       "else",      "for",       "while",     "switch",
    "case",     "break",     "continue",  "import",    "export",
    "from",     "default",   "class",     "extends",   "new",
    "this",     "typeof",    "instanceof", "in",       "of",
    "async",    "await",     "try",       "catch",     "throw",
    "finally",  "yield",     "true",      "false",     "null",
    "undefined", "void",     "type",      "interface", "enum",
    "declare",  "readonly",  "as",        "do",        "delete",
    "super",    "with",      "static",    "implements", "abstract",
    "private",  "protected", "public",    "satisfies",
};

fn tokenizeTypeScript(line: []const u8, out: []ColorSpan) usize {
    var count: usize = 0;
    var i: usize = 0;

    while (i < line.len and count < out.len) {
        const ch = line[i];

        // Whitespace
        if (isSpace(ch)) {
            const start = i;
            while (i < line.len and isSpace(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.text);
            continue;
        }

        // Line comment
        if (ch == '/' and i + 1 < line.len and line[i + 1] == '/') {
            emit(out, &count, line[i..], C.comment);
            return count;
        }

        // Block comment start (partial — only within a single line)
        if (ch == '/' and i + 1 < line.len and line[i + 1] == '*') {
            const start = i;
            i += 2;
            while (i + 1 < line.len) : (i += 1) {
                if (line[i] == '*' and line[i + 1] == '/') {
                    i += 2;
                    break;
                }
            } else {
                i = line.len; // unclosed — rest of line is comment
            }
            emit(out, &count, line[start..i], C.comment);
            continue;
        }

        // Strings
        if (ch == '"' or ch == '\'' or ch == '`') {
            const start = i;
            const quote = ch;
            i += 1;
            while (i < line.len) {
                if (line[i] == '\\' and i + 1 < line.len) {
                    i += 2; // skip escaped char
                } else if (line[i] == quote) {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            emit(out, &count, line[start..i], C.string);
            continue;
        }

        // Numbers
        if (isDigit(ch) or (ch == '.' and i + 1 < line.len and isDigit(line[i + 1]))) {
            const start = i;
            if (ch == '0' and i + 1 < line.len and (line[i + 1] == 'x' or line[i + 1] == 'X')) {
                i += 2;
                while (i < line.len and isHexDigit(line[i])) : (i += 1) {}
            } else if (ch == '0' and i + 1 < line.len and (line[i + 1] == 'b' or line[i + 1] == 'B')) {
                i += 2;
                while (i < line.len and (line[i] == '0' or line[i] == '1')) : (i += 1) {}
            } else {
                while (i < line.len and (isDigit(line[i]) or line[i] == '.')) : (i += 1) {}
                if (i < line.len and (line[i] == 'e' or line[i] == 'E')) {
                    i += 1;
                    if (i < line.len and (line[i] == '+' or line[i] == '-')) i += 1;
                    while (i < line.len and isDigit(line[i])) : (i += 1) {}
                }
            }
            // Suffix: n for BigInt
            if (i < line.len and line[i] == 'n') i += 1;
            emit(out, &count, line[start..i], C.number);
            continue;
        }

        // JSX tags: < followed by uppercase or / (closing tag)
        if (ch == '<') {
            // Check if this looks like a JSX tag
            if (i + 1 < line.len and (isUpper(line[i + 1]) or line[i + 1] == '/')) {
                const start = i;
                i += 1;
                if (i < line.len and line[i] == '/') i += 1;
                // Consume tag name
                while (i < line.len and isAlnum(line[i])) : (i += 1) {}
                emit(out, &count, line[start..i], C.tag);
                // Consume attributes until >
                while (i < line.len and line[i] != '>') {
                    if (isAlpha(line[i])) {
                        const attr_start = i;
                        while (i < line.len and isAlnum(line[i])) : (i += 1) {}
                        emit(out, &count, line[attr_start..i], C.attribute);
                    } else if (line[i] == '=' or line[i] == '{' or line[i] == '}') {
                        emit(out, &count, line[i .. i + 1], C.punctuation);
                        i += 1;
                    } else if (line[i] == '"' or line[i] == '\'') {
                        const qs = i;
                        const q = line[i];
                        i += 1;
                        while (i < line.len and line[i] != q) : (i += 1) {}
                        if (i < line.len) i += 1;
                        emit(out, &count, line[qs..i], C.string);
                    } else if (line[i] == '/') {
                        emit(out, &count, line[i .. i + 1], C.tag);
                        i += 1;
                    } else if (isSpace(line[i])) {
                        const ws = i;
                        while (i < line.len and isSpace(line[i])) : (i += 1) {}
                        emit(out, &count, line[ws..i], C.text);
                    } else {
                        i += 1;
                    }
                }
                if (i < line.len and line[i] == '>') {
                    emit(out, &count, line[i .. i + 1], C.tag);
                    i += 1;
                }
                continue;
            }
        }

        // Identifiers and keywords
        if (isAlpha(ch)) {
            const start = i;
            while (i < line.len and isAlnum(line[i])) : (i += 1) {}
            const word = line[start..i];

            if (inWordList(word, &ts_keywords)) {
                emit(out, &count, word, C.keyword);
            } else if (isUpper(word[0])) {
                emit(out, &count, word, C.type_name);
            } else if (i < line.len and line[i] == '(') {
                emit(out, &count, word, C.function_name);
            } else {
                emit(out, &count, word, C.text);
            }
            continue;
        }

        // Operators
        if (ch == '=' or ch == '!' or ch == '+' or ch == '-' or ch == '*' or
            ch == '/' or ch == '%' or ch == '&' or ch == '|' or ch == '^' or
            ch == '~' or ch == '<' or ch == '>' or ch == '?')
        {
            const start = i;
            i += 1;
            // Consume multi-char operators (==, ===, =>, !=, !==, <=, >=, &&, ||, ??, etc.)
            while (i < line.len and (line[i] == '=' or line[i] == '>' or line[i] == '&' or
                line[i] == '|' or line[i] == '?')) : (i += 1)
            {
                if (i > start + 2) break; // max 3-char operator
            }
            emit(out, &count, line[start..i], C.operator);
            continue;
        }

        // Punctuation
        if (ch == '(' or ch == ')' or ch == '{' or ch == '}' or ch == '[' or ch == ']' or
            ch == ';' or ch == ':' or ch == ',' or ch == '.')
        {
            emit(out, &count, line[i .. i + 1], C.punctuation);
            i += 1;
            continue;
        }

        // Anything else — emit as text
        emit(out, &count, line[i .. i + 1], C.text);
        i += 1;
    }

    return count;
}

// ── Zig Tokenizer ───────────────────────────────────────────────────────────

const zig_keywords = [_][]const u8{
    "const",      "var",        "fn",         "return",     "if",
    "else",       "while",      "for",        "switch",     "break",
    "continue",   "pub",        "struct",     "enum",       "union",
    "error",      "try",        "catch",      "defer",      "errdefer",
    "comptime",   "inline",     "test",       "usingnamespace",
    "orelse",     "and",        "or",         "unreachable",
    "undefined",  "true",       "false",      "null",       "threadlocal",
    "extern",     "align",      "volatile",   "allowzero",  "noalias",
    "nosuspend",  "suspend",    "resume",     "async",      "await",
    "anyframe",   "anytype",    "anyerror",   "linksection",
};

const zig_types = [_][]const u8{
    "u8",   "u16",  "u32",  "u64",  "u128",  "usize",
    "i8",   "i16",  "i32",  "i64",  "i128",  "isize",
    "f16",  "f32",  "f64",  "f128",
    "bool", "void", "noreturn", "type", "comptime_int", "comptime_float",
};

fn tokenizeZig(line: []const u8, out: []ColorSpan) usize {
    var count: usize = 0;
    var i: usize = 0;

    while (i < line.len and count < out.len) {
        const ch = line[i];

        // Whitespace
        if (isSpace(ch)) {
            const start = i;
            while (i < line.len and isSpace(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.text);
            continue;
        }

        // Line comment
        if (ch == '/' and i + 1 < line.len and line[i + 1] == '/') {
            emit(out, &count, line[i..], C.comment);
            return count;
        }

        // Strings
        if (ch == '"') {
            const start = i;
            i += 1;
            while (i < line.len) {
                if (line[i] == '\\' and i + 1 < line.len) {
                    i += 2;
                } else if (line[i] == '"') {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            emit(out, &count, line[start..i], C.string);
            continue;
        }

        // Char literals
        if (ch == '\'') {
            const start = i;
            i += 1;
            if (i < line.len and line[i] == '\\') {
                i += 2; // escape sequence
            } else if (i < line.len) {
                i += 1;
            }
            if (i < line.len and line[i] == '\'') i += 1;
            emit(out, &count, line[start..i], C.string);
            continue;
        }

        // Builtins: @identifier
        if (ch == '@' and i + 1 < line.len and isAlpha(line[i + 1])) {
            const start = i;
            i += 1;
            while (i < line.len and isAlnum(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.builtin);
            continue;
        }

        // Numbers
        if (isDigit(ch)) {
            const start = i;
            if (ch == '0' and i + 1 < line.len) {
                if (line[i + 1] == 'x') {
                    i += 2;
                    while (i < line.len and (isHexDigit(line[i]) or line[i] == '_')) : (i += 1) {}
                } else if (line[i + 1] == 'b') {
                    i += 2;
                    while (i < line.len and (line[i] == '0' or line[i] == '1' or line[i] == '_')) : (i += 1) {}
                } else if (line[i + 1] == 'o') {
                    i += 2;
                    while (i < line.len and (line[i] >= '0' and line[i] <= '7' or line[i] == '_')) : (i += 1) {}
                } else {
                    while (i < line.len and (isDigit(line[i]) or line[i] == '_' or line[i] == '.')) : (i += 1) {}
                }
            } else {
                while (i < line.len and (isDigit(line[i]) or line[i] == '_' or line[i] == '.')) : (i += 1) {}
            }
            emit(out, &count, line[start..i], C.number);
            continue;
        }

        // Identifiers and keywords
        if (isAlpha(ch)) {
            const start = i;
            while (i < line.len and isAlnum(line[i])) : (i += 1) {}
            const word = line[start..i];

            if (inWordList(word, &zig_keywords)) {
                emit(out, &count, word, C.keyword);
            } else if (inWordList(word, &zig_types)) {
                emit(out, &count, word, C.type_name);
            } else if (isUpper(word[0])) {
                emit(out, &count, word, C.type_name);
            } else if (i < line.len and line[i] == '(') {
                emit(out, &count, word, C.function_name);
            } else {
                emit(out, &count, word, C.text);
            }
            continue;
        }

        // Operators
        if (ch == '=' or ch == '!' or ch == '+' or ch == '-' or ch == '*' or
            ch == '/' or ch == '%' or ch == '&' or ch == '|' or ch == '^' or
            ch == '~' or ch == '<' or ch == '>')
        {
            const start = i;
            i += 1;
            while (i < line.len and (line[i] == '=' or line[i] == '>' or line[i] == '.' or
                line[i] == '*' or line[i] == '+')) : (i += 1)
            {
                if (i > start + 2) break;
            }
            emit(out, &count, line[start..i], C.operator);
            continue;
        }

        // Punctuation
        if (ch == '(' or ch == ')' or ch == '{' or ch == '}' or ch == '[' or ch == ']' or
            ch == ';' or ch == ':' or ch == ',' or ch == '.')
        {
            emit(out, &count, line[i .. i + 1], C.punctuation);
            i += 1;
            continue;
        }

        emit(out, &count, line[i .. i + 1], C.text);
        i += 1;
    }

    return count;
}

// ── JSON Tokenizer ──────────────────────────────────────────────────────────

fn tokenizeJSON(line: []const u8, out: []ColorSpan) usize {
    var count: usize = 0;
    var i: usize = 0;

    while (i < line.len and count < out.len) {
        const ch = line[i];

        if (isSpace(ch)) {
            const start = i;
            while (i < line.len and isSpace(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.text);
            continue;
        }

        // Strings — keys (followed by :) get type_name color, values get string color
        if (ch == '"') {
            const start = i;
            i += 1;
            while (i < line.len) {
                if (line[i] == '\\' and i + 1 < line.len) {
                    i += 2;
                } else if (line[i] == '"') {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            // Check if this is a key (followed by optional whitespace then ':')
            var j = i;
            while (j < line.len and isSpace(line[j])) : (j += 1) {}
            const color = if (j < line.len and line[j] == ':') C.type_name else C.string;
            emit(out, &count, line[start..i], color);
            continue;
        }

        // Numbers
        if (isDigit(ch) or (ch == '-' and i + 1 < line.len and isDigit(line[i + 1]))) {
            const start = i;
            if (ch == '-') i += 1;
            while (i < line.len and (isDigit(line[i]) or line[i] == '.')) : (i += 1) {}
            if (i < line.len and (line[i] == 'e' or line[i] == 'E')) {
                i += 1;
                if (i < line.len and (line[i] == '+' or line[i] == '-')) i += 1;
                while (i < line.len and isDigit(line[i])) : (i += 1) {}
            }
            emit(out, &count, line[start..i], C.number);
            continue;
        }

        // Keywords: true, false, null
        if (isAlpha(ch)) {
            const start = i;
            while (i < line.len and isAlpha(line[i])) : (i += 1) {}
            const word = line[start..i];
            if (std.mem.eql(u8, word, "true") or std.mem.eql(u8, word, "false") or
                std.mem.eql(u8, word, "null"))
            {
                emit(out, &count, word, C.keyword);
            } else {
                emit(out, &count, word, C.text);
            }
            continue;
        }

        // Punctuation
        if (ch == '{' or ch == '}' or ch == '[' or ch == ']' or ch == ':' or ch == ',') {
            emit(out, &count, line[i .. i + 1], C.punctuation);
            i += 1;
            continue;
        }

        emit(out, &count, line[i .. i + 1], C.text);
        i += 1;
    }

    return count;
}

// ── Bash Tokenizer ──────────────────────────────────────────────────────────

const bash_keywords = [_][]const u8{
    "if",     "then",   "else",    "elif",    "fi",
    "for",    "while",  "do",      "done",    "case",
    "esac",   "function", "in",    "return",  "export",
    "local",  "source", "declare", "readonly", "unset",
    "set",    "shift",  "select",  "until",   "trap",
    "break",  "continue", "exit",  "eval",    "exec",
};

fn tokenizeBash(line: []const u8, out: []ColorSpan) usize {
    var count: usize = 0;
    var i: usize = 0;

    while (i < line.len and count < out.len) {
        const ch = line[i];

        if (isSpace(ch)) {
            const start = i;
            while (i < line.len and isSpace(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.text);
            continue;
        }

        // Comment
        if (ch == '#') {
            emit(out, &count, line[i..], C.comment);
            return count;
        }

        // Variables: $VAR, ${VAR}, $0-$9, $$, $?, $!, $@, $*
        if (ch == '$') {
            const start = i;
            i += 1;
            if (i < line.len and line[i] == '{') {
                i += 1;
                while (i < line.len and line[i] != '}') : (i += 1) {}
                if (i < line.len) i += 1; // skip }
            } else if (i < line.len and line[i] == '(') {
                // $(command) — just color the $( part
                i += 1;
                emit(out, &count, line[start..i], C.variable);
                continue;
            } else {
                while (i < line.len and (isAlnum(line[i]) or line[i] == '?' or
                    line[i] == '!' or line[i] == '@' or line[i] == '*' or
                    line[i] == '#'))
                {
                    i += 1;
                    // Single special char variables
                    if (i == start + 2 and !isAlnum(line[i - 1])) break;
                }
            }
            emit(out, &count, line[start..i], C.variable);
            continue;
        }

        // Strings
        if (ch == '"' or ch == '\'') {
            const start = i;
            const quote = ch;
            i += 1;
            while (i < line.len) {
                if (quote == '"' and line[i] == '\\' and i + 1 < line.len) {
                    i += 2;
                } else if (line[i] == quote) {
                    i += 1;
                    break;
                } else {
                    i += 1;
                }
            }
            emit(out, &count, line[start..i], C.string);
            continue;
        }

        // Numbers
        if (isDigit(ch)) {
            const start = i;
            while (i < line.len and isDigit(line[i])) : (i += 1) {}
            emit(out, &count, line[start..i], C.number);
            continue;
        }

        // Identifiers and keywords
        if (isAlpha(ch)) {
            const start = i;
            while (i < line.len and (isAlnum(line[i]) or line[i] == '-')) : (i += 1) {}
            const word = line[start..i];

            if (inWordList(word, &bash_keywords)) {
                emit(out, &count, word, C.keyword);
            } else {
                emit(out, &count, word, C.text);
            }
            continue;
        }

        // Operators and redirects
        if (ch == '|' or ch == '&' or ch == '>' or ch == '<' or ch == ';' or ch == '!') {
            const start = i;
            i += 1;
            if (i < line.len and (line[i] == '|' or line[i] == '&' or line[i] == '>')) {
                i += 1;
            }
            emit(out, &count, line[start..i], C.operator);
            continue;
        }

        // Punctuation
        if (ch == '(' or ch == ')' or ch == '{' or ch == '}' or ch == '[' or ch == ']' or
            ch == '=' or ch == ',')
        {
            emit(out, &count, line[i .. i + 1], C.punctuation);
            i += 1;
            continue;
        }

        emit(out, &count, line[i .. i + 1], C.text);
        i += 1;
    }

    return count;
}

// ── Markdown Tokenizer ──────────────────────────────────────────────────────

fn tokenizeMarkdown(line: []const u8, out: []ColorSpan) usize {
    var count: usize = 0;

    // Trim leading whitespace for heading detection
    var leading: usize = 0;
    while (leading < line.len and isSpace(line[leading])) : (leading += 1) {}

    // Leading whitespace
    if (leading > 0) {
        emit(out, &count, line[0..leading], C.text);
    }

    // Headings: # ## ### etc.
    if (leading < line.len and line[leading] == '#') {
        emit(out, &count, line[leading..], C.heading);
        return count;
    }

    // Code fence: ``` or ~~~
    if (leading < line.len and (line[leading] == '`' or line[leading] == '~')) {
        var fence_count: usize = 0;
        var j = leading;
        while (j < line.len and line[j] == line[leading]) : (j += 1) {
            fence_count += 1;
        }
        if (fence_count >= 3) {
            emit(out, &count, line[leading..], C.comment);
            return count;
        }
    }

    // Inline content — scan character by character
    var i: usize = leading;
    while (i < line.len and count < out.len) {
        const ch = line[i];

        // Inline code: `...`
        if (ch == '`') {
            const start = i;
            i += 1;
            while (i < line.len and line[i] != '`') : (i += 1) {}
            if (i < line.len) i += 1;
            emit(out, &count, line[start..i], C.string);
            continue;
        }

        // Bold: **...**
        if (ch == '*' and i + 1 < line.len and line[i + 1] == '*') {
            const start = i;
            i += 2;
            while (i + 1 < line.len) : (i += 1) {
                if (line[i] == '*' and line[i + 1] == '*') {
                    i += 2;
                    break;
                }
            } else {
                i = line.len;
            }
            emit(out, &count, line[start..i], C.bold_text);
            continue;
        }

        // Link: [text](url)
        if (ch == '[') {
            const start = i;
            i += 1;
            while (i < line.len and line[i] != ']') : (i += 1) {}
            if (i < line.len) i += 1; // ]
            if (i < line.len and line[i] == '(') {
                i += 1;
                while (i < line.len and line[i] != ')') : (i += 1) {}
                if (i < line.len) i += 1; // )
                emit(out, &count, line[start..i], C.link);
                continue;
            }
            // Not a link — just emit bracket text
            emit(out, &count, line[start..i], C.text);
            continue;
        }

        // List markers: - * + followed by space
        if ((ch == '-' or ch == '*' or ch == '+') and
            i == leading and i + 1 < line.len and line[i + 1] == ' ')
        {
            emit(out, &count, line[i .. i + 1], C.punctuation);
            i += 1;
            continue;
        }

        // Everything else is plain text — batch consecutive chars
        const start = i;
        while (i < line.len and line[i] != '`' and line[i] != '*' and
            line[i] != '[' and line[i] != '#') : (i += 1)
        {}
        if (i > start) {
            emit(out, &count, line[start..i], C.text);
        } else {
            // Single special char that didn't start a pattern
            emit(out, &count, line[i .. i + 1], C.text);
            i += 1;
        }
    }

    return count;
}

// ── Plain Text (no highlighting) ────────────────────────────────────────────

fn tokenizePlain(line: []const u8, out: []ColorSpan) usize {
    if (line.len == 0 or out.len == 0) return 0;
    out[0] = .{ .text = line, .color = C.text };
    return 1;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test "tokenize typescript basic" {
    var spans: [256]ColorSpan = undefined;
    const count = tokenizeLine("const x = 42;", .typescript, &spans);
    try std.testing.expect(count > 0);
    // First non-whitespace span should be "const" with keyword color
    try std.testing.expectEqualStrings("const", spans[0].text);
    try std.testing.expectEqual(C.keyword.r, spans[0].color.r);
}

test "tokenize typescript comment" {
    var spans: [256]ColorSpan = undefined;
    const count = tokenizeLine("// hello world", .typescript, &spans);
    try std.testing.expect(count == 1);
    try std.testing.expectEqual(C.comment.r, spans[0].color.r);
}

test "tokenize zig keyword" {
    var spans: [256]ColorSpan = undefined;
    const count = tokenizeLine("pub fn main() void {", .zig, &spans);
    try std.testing.expect(count > 0);
    try std.testing.expectEqualStrings("pub", spans[0].text);
    try std.testing.expectEqual(C.keyword.r, spans[0].color.r);
}

test "tokenize json" {
    var spans: [256]ColorSpan = undefined;
    const count = tokenizeLine("  \"key\": \"value\",", .json, &spans);
    try std.testing.expect(count > 0);
}

test "tokenize plain" {
    var spans: [256]ColorSpan = undefined;
    const count = tokenizeLine("hello world", .plain, &spans);
    try std.testing.expectEqual(@as(usize, 1), count);
}

test "language from string" {
    try std.testing.expectEqual(Language.typescript, Language.fromString("ts"));
    try std.testing.expectEqual(Language.zig, Language.fromString("zig"));
    try std.testing.expectEqual(Language.json, Language.fromString("json"));
    try std.testing.expectEqual(Language.bash, Language.fromString("sh"));
    try std.testing.expectEqual(Language.markdown, Language.fromString("md"));
    try std.testing.expectEqual(Language.plain, Language.fromString("unknown"));
}
