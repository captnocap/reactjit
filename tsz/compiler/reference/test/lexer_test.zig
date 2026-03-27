//! Tests for lexer.zig — tokenizer
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const tokenize = h.tokenize;
const expectToken = h.expectToken;
const expectKind = h.expectKind;
const TokenKind = h.TokenKind;

test "empty source produces only EOF" {
    const lex = tokenize("");
    try testing.expectEqual(@as(u32, 1), lex.count);
    try expectKind(&lex, 0, .eof);
}

test "whitespace-only source produces only EOF" {
    const lex = tokenize("   \t\n\r  ");
    try testing.expectEqual(@as(u32, 1), lex.count);
    try expectKind(&lex, 0, .eof);
}

test "single identifier" {
    const src = "hello";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "hello");
    try expectKind(&lex, 1, .eof);
}

test "multiple identifiers" {
    const src = "foo bar baz";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "foo");
    try expectToken(&lex, 1, .identifier, src, "bar");
    try expectToken(&lex, 2, .identifier, src, "baz");
    try expectKind(&lex, 3, .eof);
}

test "identifier with underscore and dollar" {
    const src = "_private $jquery foo_bar";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "_private");
    try expectToken(&lex, 1, .identifier, src, "$jquery");
    try expectToken(&lex, 2, .identifier, src, "foo_bar");
}

test "identifier with digits" {
    const src = "item1 x2y abc123";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "item1");
    try expectToken(&lex, 1, .identifier, src, "x2y");
    try expectToken(&lex, 2, .identifier, src, "abc123");
}

test "decimal numbers" {
    const src = "42 3.14 0 100";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "42");
    try expectToken(&lex, 1, .number, src, "3.14");
    try expectToken(&lex, 2, .number, src, "0");
    try expectToken(&lex, 3, .number, src, "100");
}

test "hex numbers" {
    const src = "0xFF 0x1A 0XAB";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "0xFF");
    try expectToken(&lex, 1, .number, src, "0x1A");
    try expectToken(&lex, 2, .number, src, "0XAB");
}

test "binary numbers" {
    const src = "0b1010 0B110";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "0b1010");
    try expectToken(&lex, 1, .number, src, "0B110");
}

test "octal numbers" {
    const src = "0o77 0O12";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "0o77");
    try expectToken(&lex, 1, .number, src, "0O12");
}

test "scientific notation" {
    const src = "1e6 2.5E-3 1e+10";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "1e6");
    try expectToken(&lex, 1, .number, src, "2.5E-3");
    try expectToken(&lex, 2, .number, src, "1e+10");
}

test "numbers with underscores" {
    const src = "1_000_000 0xFF_FF";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .number, src, "1_000_000");
    try expectToken(&lex, 1, .number, src, "0xFF_FF");
}

test "double-quoted string" {
    const src = "\"hello world\"";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .string, src, "\"hello world\"");
}

test "single-quoted string" {
    const src = "'hello'";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .string, src, "'hello'");
}

test "string with escapes" {
    const src = "\"hello\\nworld\"";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .string, src, "\"hello\\nworld\"");
}

test "template literal simple" {
    const src = "`hello world`";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .template_literal, src, "`hello world`");
}

test "template literal with interpolation" {
    const src = "`count: ${value}`";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .template_literal, src, "`count: ${value}`");
}

test "template literal with nested braces" {
    const src = "`${a + {b: 1}}`";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .template_literal);
}

test "single-char punctuation" {
    const src = "( ) { } [ ] , : ; . = + - * / % ! & | ^ ~ < > ?";
    const lex = tokenize(src);
    const expected = [_]TokenKind{
        .lparen, .rparen, .lbrace, .rbrace, .lbracket, .rbracket,
        .comma,  .colon,  .semicolon, .dot, .equals, .plus,
        .minus,  .star,   .slash,  .percent, .bang,  .ampersand,
        .pipe,   .caret,  .tilde, .lt,    .gt,    .question,
    };
    for (expected, 0..) |exp, i| {
        try expectKind(&lex, @intCast(i), exp);
    }
}

test "arrow operator" { const src = "=>"; const lex = tokenize(src); try expectToken(&lex, 0, .arrow, src, "=>"); }
test "equality operators" { const src = "== !="; const lex = tokenize(src); try expectKind(&lex, 0, .eq_eq); try expectKind(&lex, 1, .not_eq); }

test "comparison operators" {
    const src = ">= <= >> <<";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .gt_eq);
    try expectKind(&lex, 1, .lt_eq);
    try expectKind(&lex, 2, .shift_right);
    try expectKind(&lex, 3, .shift_left);
}

test "logical operators" { const src = "&& ||"; const lex = tokenize(src); try expectKind(&lex, 0, .amp_amp); try expectKind(&lex, 1, .pipe_pipe); }
test "JSX operators" { const src = "/> </"; const lex = tokenize(src); try expectKind(&lex, 0, .slash_gt); try expectKind(&lex, 1, .lt_slash); }

test "spread operator" {
    const src = "...args";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .spread);
    try expectToken(&lex, 1, .identifier, src, "args");
}

test "nullish coalescing" {
    const src = "a ?? b";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "a");
    try expectKind(&lex, 1, .question_question);
    try expectToken(&lex, 2, .identifier, src, "b");
}

test "wrapping arithmetic operators" { const src = "*% +% -%"; const lex = tokenize(src); try expectKind(&lex, 0, .wrap_mul); try expectKind(&lex, 1, .wrap_add); try expectKind(&lex, 2, .wrap_sub); }
test "caret equals" { const src = "^="; const lex = tokenize(src); try expectKind(&lex, 0, .caret_eq); }

test "comment" {
    const src = "a // this is a comment\nb";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "a");
    try expectKind(&lex, 1, .comment);
    try expectToken(&lex, 2, .identifier, src, "b");
}

test "ffi pragma" {
    const src = "// @ffi <math.h> -lm";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .ffi_pragma);
    try testing.expect(std.mem.indexOf(u8, lex.get(0).text(src), "math.h") != null);
}

test "zig builtin" {
    const src = "@bitCast @intFromEnum";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .builtin, src, "@bitCast");
    try expectToken(&lex, 1, .builtin, src, "@intFromEnum");
}

test "zig escaped identifier" { const src = "@\"2d\""; const lex = tokenize(src); try expectToken(&lex, 0, .builtin, src, "@\"2d\""); }

test "JSX-like expression" {
    const src = "<Box style={{ width: 100 }} />";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .lt);
    try expectToken(&lex, 1, .identifier, src, "Box");
    try expectKind(&lex, 11, .slash_gt);
}

test "closing tag" {
    const src = "</Box>";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .lt_slash);
    try expectToken(&lex, 1, .identifier, src, "Box");
    try expectKind(&lex, 2, .gt);
}

test "arrow before equals before eq_eq" {
    const src = "=> = ==";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .arrow);
    try expectKind(&lex, 1, .equals);
    try expectKind(&lex, 2, .eq_eq);
}

test "shift before comparison" {
    const src = ">> >= > <<  <= <";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .shift_right);
    try expectKind(&lex, 1, .gt_eq);
    try expectKind(&lex, 2, .gt);
    try expectKind(&lex, 3, .shift_left);
    try expectKind(&lex, 4, .lt_eq);
    try expectKind(&lex, 5, .lt);
}

test "overflow flag not set" { const lex = tokenize("a b c"); try testing.expect(!lex.overflow); }
test "get beyond count returns EOF" { const lex = tokenize("a"); try testing.expectEqual(TokenKind.eof, lex.get(999).kind); }

test "adjacent operators" {
    const src = "a+b*c";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "a");
    try expectKind(&lex, 1, .plus);
    try expectToken(&lex, 2, .identifier, src, "b");
    try expectKind(&lex, 3, .star);
    try expectToken(&lex, 4, .identifier, src, "c");
}

test "JSX self-closing with attributes" {
    const src = "<Text fontSize={14} color=\"red\" />";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .lt);
    try expectToken(&lex, 1, .identifier, src, "Text");
    try expectKind(&lex, 10, .slash_gt);
}

test "useState pattern" {
    const src = "const [count, setCount] = useState(0)";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "const");
    try expectKind(&lex, 1, .lbracket);
    try expectToken(&lex, 2, .identifier, src, "count");
    try expectKind(&lex, 6, .equals);
    try expectToken(&lex, 7, .identifier, src, "useState");
}

test "REGRESSION: bare // comment must not eat next line" {
    // This was the Dashboard bug — a bare `//` comment with no text caused
    // skipWhitespace() to eat the newline AND the next line's content.
    // `const [uptime] = useFFI(...)` on the next line was swallowed.
    const src = "//\nconst [count, setCount] = useState(0)";
    const lex = tokenize(src);
    // The comment should be one token, then the next line should tokenize normally
    try expectKind(&lex, 0, .comment);
    // The CRITICAL check: "const" must be the very next token after the comment.
    // If the lexer ate the next line, this will be EOF or something wrong.
    try expectToken(&lex, 1, .identifier, src, "const");
    try expectKind(&lex, 2, .lbracket);
    try expectToken(&lex, 3, .identifier, src, "count");
}

test "bare // comment followed by code on next line" {
    // Variant: empty comment with trailing spaces
    const src = "//   \nfunction App() {}";
    const lex = tokenize(src);
    try expectKind(&lex, 0, .comment);
    try expectToken(&lex, 1, .identifier, src, "function");
}

test "arrow function in handler" {
    const src = "onPress={() => setCount(count + 1)}";
    const lex = tokenize(src);
    try expectToken(&lex, 0, .identifier, src, "onPress");
    try expectKind(&lex, 5, .arrow);
    try expectToken(&lex, 6, .identifier, src, "setCount");
}
