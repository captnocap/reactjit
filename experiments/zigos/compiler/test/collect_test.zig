//! Tests for collect.zig — token scanning and declaration collection
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const tokenize = h.tokenize;
const makeGen = h.makeGen;
const codegen = h.codegen;
const Lexer = h.Lexer;
const Generator = h.Generator;
const collect = @import("../collect.zig");

test "collectFFIPragmas" {
    const src = "// @ffi <math.h> -lm\n// @ffi <stdio.h>";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectFFIPragmas(&gen);
    try testing.expectEqual(@as(usize, 2), gen.ffi_headers.items.len);
    try testing.expectEqualStrings("math.h", gen.ffi_headers.items[0]);
    try testing.expectEqualStrings("stdio.h", gen.ffi_headers.items[1]);
    try testing.expectEqual(@as(usize, 1), gen.ffi_libs.items.len);
    try testing.expectEqualStrings("m", gen.ffi_libs.items[0]);
}

test "collectFFIPragmas none" {
    const src = "const x = 42;";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectFFIPragmas(&gen);
    try testing.expectEqual(@as(usize, 0), gen.ffi_headers.items.len);
}

test "collectDeclaredFunctions" {
    const src = "declare function getTime(): number\ndeclare function getName(id: number): string";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectDeclaredFunctions(&gen);
    try testing.expectEqual(@as(usize, 2), gen.ffi_funcs.items.len);
    try testing.expectEqualStrings("getTime", gen.ffi_funcs.items[0]);
    try testing.expectEqual(codegen.StateType.int, gen.ffi_return_types.items[0]);
    try testing.expectEqual(codegen.StateType.string, gen.ffi_return_types.items[1]);
    try testing.expectEqual(@as(u32, 0), gen.ffi_arg_counts.items[0]);
    try testing.expectEqual(@as(u32, 1), gen.ffi_arg_counts.items[1]);
}

test "collectDeclaredFunctions boolean" {
    const src = "declare function isActive(): boolean";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectDeclaredFunctions(&gen);
    try testing.expectEqual(codegen.StateType.boolean, gen.ffi_return_types.items[0]);
}

test "findAppFunction finds App" {
    const src = "function Helper() { return <Box /> }\nfunction App() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    const result = collect.findAppFunction(&gen).?;
    gen.pos = result;
    try testing.expect(gen.isIdent("function"));
    gen.advance_token();
    try testing.expectEqualStrings("App", gen.curText());
}

test "findAppFunction falls back to last" {
    const src = "function MyWidget() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    const result = collect.findAppFunction(&gen).?;
    gen.pos = result; gen.advance_token();
    try testing.expectEqualStrings("MyWidget", gen.curText());
}

test "collectComponents" {
    const src = "function Header({ title }) { return <Box><Text>{title}</Text></Box> }\nfunction App() { return <Header title=\"hi\" /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectComponents(&gen);
    try testing.expectEqual(@as(u32, 1), gen.component_count);
    try testing.expectEqualStrings("Header", gen.components[0].name);
    try testing.expectEqual(@as(u32, 1), gen.components[0].prop_count);
}

test "collectComponents multiple props" {
    const src = "function Card({ title, color, size }) { return <Box /> }\nfunction App() { return <Card /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectComponents(&gen);
    try testing.expectEqual(@as(u32, 3), gen.components[0].prop_count);
}

test "collectComponents skips App" {
    const src = "function App() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectComponents(&gen);
    try testing.expectEqual(@as(u32, 0), gen.component_count);
}

test "collectComponents skips lowercase" {
    const src = "function helper() { return <Box /> }\nfunction App() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectComponents(&gen);
    try testing.expectEqual(@as(u32, 0), gen.component_count);
}

test "collectStateHooks int" {
    const src = "function App() { const [count, setCount] = useState(0); return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    gen.pos = 0; collect.collectStateHooks(&gen, collect.findAppFunction(&gen).?);
    try testing.expectEqual(@as(u32, 1), gen.state_count);
    try testing.expectEqualStrings("count", gen.state_slots[0].getter);
    try testing.expectEqual(codegen.StateType.int, std.meta.activeTag(gen.state_slots[0].initial));
}

test "collectStateHooks float" {
    const src = "function App() { const [temp, setTemp] = useState(98.6); return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    gen.pos = 0; collect.collectStateHooks(&gen, collect.findAppFunction(&gen).?);
    try testing.expectEqual(codegen.StateType.float, std.meta.activeTag(gen.state_slots[0].initial));
}

test "collectStateHooks string" {
    const src = "function App() { const [name, setName] = useState(\"hello\"); return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    gen.pos = 0; collect.collectStateHooks(&gen, collect.findAppFunction(&gen).?);
    try testing.expectEqual(codegen.StateType.string, std.meta.activeTag(gen.state_slots[0].initial));
    try testing.expectEqualStrings("hello", gen.state_slots[0].initial.string);
}

test "collectStateHooks boolean" {
    const src = "function App() { const [active, setActive] = useState(true); return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    gen.pos = 0; collect.collectStateHooks(&gen, collect.findAppFunction(&gen).?);
    try testing.expect(gen.state_slots[0].initial.boolean);
}

test "collectStateHooks multiple" {
    const src = "function App() { const [a, setA] = useState(0); const [b, setB] = useState(\"hi\"); return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    gen.pos = 0; collect.collectStateHooks(&gen, collect.findAppFunction(&gen).?);
    try testing.expectEqual(@as(u32, 2), gen.state_count);
}

test "countComponentUsage" {
    const src = "function Card({ title }) { return <Box /> }\nfunction App() { return <Box><Card /><Card /><Card /></Box> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.collectComponents(&gen);
    gen.pos = 0; collect.countComponentUsage(&gen, collect.findAppFunction(&gen).?);
    try testing.expectEqual(@as(u32, 3), gen.components[0].usage_count);
}

test "extractComputeBlock" {
    const src = "<script>\nconst x = 42;\n</script>\nfunction App() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.extractComputeBlock(&gen);
    try testing.expect(gen.compute_js != null);
    try testing.expect(std.mem.indexOf(u8, gen.compute_js.?, "const x = 42") != null);
}

test "extractComputeBlock none" {
    const src = "function App() { return <Box /> }";
    var lex = tokenize(src); var a = arena(); defer a.deinit();
    var gen = makeGen(a.allocator(), &lex, src);
    collect.extractComputeBlock(&gen);
    try testing.expect(gen.compute_js == null);
}
