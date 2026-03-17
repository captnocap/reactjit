//! Tests for jsx.zig — JSX element parsing
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const Lexer = h.Lexer;
const Generator = h.Generator;
const jsx = @import("../jsx.zig");

test "self-closing Box" {
    var a = arena(); defer a.deinit();
    const src = "<Box />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.startsWith(u8, r, ".{"));
}

test "Box with style" {
    var a = arena(); defer a.deinit();
    const src = "<Box style={{ width: 100 }} />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".style") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".width = 100") != null);
}

test "Box with flexGrow and padding" {
    var a = arena(); defer a.deinit();
    const src = "<Box style={{ flexGrow: 1, padding: 8 }} />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".flex_grow = 1") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".padding = 8") != null);
}

test "Text with static content" {
    var a = arena(); defer a.deinit();
    const src = "<Text>Hello World</Text>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".text = \"Hello World\"") != null);
}

test "Text with fontSize" {
    var a = arena(); defer a.deinit();
    const src = "<Text fontSize={24}>Hi</Text>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".font_size = 24") != null);
}

test "Text with color" {
    var a = arena(); defer a.deinit();
    const src = "<Text color=\"red\">hello</Text>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".text_color") != null);
    try testing.expect(std.mem.indexOf(u8, r, "255, 0, 0") != null);
}

test "Box with children" {
    var a = arena(); defer a.deinit();
    const src = "<Box><Text>A</Text><Text>B</Text></Box>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".children") != null);
    try testing.expectEqual(@as(usize, 1), gen.array_decls.items.len);
}

test "fragment" {
    var a = arena(); defer a.deinit();
    const src = "<><Box /><Box /></>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".children") != null);
}

test "empty fragment" {
    var a = arena(); defer a.deinit();
    const src = "<></>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    try testing.expectEqualStrings(".{}", try jsx.parseJSXElement(&gen));
}

test "onPress generates handler" {
    var a = arena(); defer a.deinit();
    const src = "<Pressable onPress={() => setCount(count + 1)} />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "count", .setter = "setCount", .initial = .{ .int = 0 } };
    gen.state_count = 1; gen.has_state = true;
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".handlers") != null);
    try testing.expect(gen.handler_decls.items.len > 0);
}

test "dynamic text from state" {
    var a = arena(); defer a.deinit();
    const src = "<Box><Text>{count}</Text></Box>";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    gen.state_slots[0] = .{ .getter = "count", .setter = "setCount", .initial = .{ .int = 0 } };
    gen.state_count = 1; gen.has_state = true;
    _ = try jsx.parseJSXElement(&gen);
    try testing.expect(gen.dyn_count > 0);
}

test "Image with src" {
    var a = arena(); defer a.deinit();
    const src = "<Image src=\"logo.png\" />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".image_src") != null);
    try testing.expect(std.mem.indexOf(u8, r, "logo.png") != null);
}

test "enum style values" {
    var a = arena(); defer a.deinit();
    const src = "<Box style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch' }} />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".flex_direction = .row") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".justify_content = .center") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".align_items = .stretch") != null);
}

test "percentage width" {
    var a = arena(); defer a.deinit();
    const src = "<Box style={{ width: '100%' }} />";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(a.allocator(), &lex, src, "test.tsz");
    const r = try jsx.parseJSXElement(&gen);
    try testing.expect(std.mem.indexOf(u8, r, ".width") != null);
    try testing.expect(std.mem.indexOf(u8, r, "-1") != null);
}
