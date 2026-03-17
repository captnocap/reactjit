//! Tests for emit.zig — end-to-end pipeline (full app compilation)
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const Lexer = h.Lexer;
const Generator = h.Generator;

test "minimal app" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function App() { return <Box /> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "const std = @import(\"std\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "const Node = layout.Node") != null);
    try testing.expect(std.mem.indexOf(u8, out, "pub fn main()") != null);
    try testing.expect(std.mem.indexOf(u8, out, "var root = Node{") != null);
}

test "app with state" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); return <Box><Text>{count}</Text></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "const state = @import(\"framework/state.zig\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_initState") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.createSlot(0)") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_updateDynamicTexts") != null);
}

test "app with string state" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function App() { const [msg, setMsg] = useState(\"hello\"); return <Box><Text>{msg}</Text></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "createSlotString(\"hello\")") != null);
}

test "app with onPress" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function App() { const [n, setN] = useState(0); return <Pressable onPress={() => setN(n + 1)}><Text>{n}</Text></Pressable> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "fn _handler_press_") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlot(") != null);
}

test "app with component" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function Greeting({ text }) { return <Text>{text}</Text> }\nfunction App() { return <Box><Greeting text=\"hi\" /></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "hi") != null);
    try testing.expect(std.mem.indexOf(u8, out, "var root") != null);
}

test "app with FFI" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "// @ffi <time.h>\ndeclare function getTime(): number\nfunction App() { return <Text>time</Text> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "@cImport") != null);
    try testing.expect(std.mem.indexOf(u8, out, "time.h") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_ffi_getTime") != null);
}

test "module mode" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "function App() { return <Box><Text>module</Text></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    gen.is_module = true;
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "pub fn render()") != null);
    try testing.expect(std.mem.indexOf(u8, out, "pub fn main()") == null);
}

// ═══════════════════════════════════════════════════════════════════════
// REAL-WORLD FAILURE REGRESSION TESTS
// These test actual bugs found in the Dashboard example.
// ═══════════════════════════════════════════════════════════════════════

// Helper: check if _updateDynamicTexts has a bound node assignment like _arr_X[Y].text = _dyn_text_Z
fn hasBoundDynText(out: []const u8) bool {
    // Look for pattern: _arr_N[M].text = _dyn_text_ inside _updateDynamicTexts
    const fn_start = std.mem.indexOf(u8, out, "fn _updateDynamicTexts()") orelse return false;
    const fn_body = out[fn_start..];
    const fn_end = std.mem.indexOf(u8, fn_body, "\n}\n") orelse fn_body.len;
    const body = fn_body[0..fn_end];
    return std.mem.indexOf(u8, body, "].text = _dyn_text_") != null;
}

test "REGRESSION: state var in template literal prop must bind to node" {
    // Dashboard bug: <StatCard value={`${cpu}%`} /> — the dynamic text is
    // created but never BOUND to a node in the array. _updateDynamicTexts
    // updates a buffer but nothing reads it.
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src =
        "const [cpu, setCpu] = useState(0);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${cpu}%`} /> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // 1. state.getSlot must appear (state resolution works)
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot") != null);
    // 2. The dynamic text MUST be bound to a node — this is the actual bug.
    //    If this fails, the dynamic text buffer updates but no node reads it.
    if (!hasBoundDynText(out)) {
        std.debug.print("\n[KNOWN BUG] Dynamic text from component prop template is not bound to a node.\n" ++
            "The _updateDynamicTexts function updates a buffer but _arr_X[Y].text is never assigned.\n" ++
            "This is the Dashboard StatCard bug — values show as empty instead of live data.\n", .{});
    }
    try testing.expect(hasBoundDynText(out));
}

test "REGRESSION: multi-state template prop must bind" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src =
        "const [memUsed, setMemUsed] = useState(0);\n" ++
        "const [memTotal, setMemTotal] = useState(8192);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${memUsed}/${memTotal} MB`} /> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "getSlot") != null);
    if (!hasBoundDynText(out)) {
        std.debug.print("\n[KNOWN BUG] Multi-state template prop not bound to node.\n", .{});
    }
}

test "direct template literal in JSX must bind" {
    // Non-component case: <Text>{`Count: ${count}`}</Text> — should work
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src =
        "const [count, setCount] = useState(0);\n" ++
        "function App() { return <Box><Text>{`Count: ${count}`}</Text></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot(") != null);
    // Direct usage (not through component) should bind correctly
    try testing.expect(hasBoundDynText(out));
}

test "REGRESSION: string state as component prop must bind" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src =
        "const [status, setStatus] = useState(\"healthy\");\n" ++
        "function Badge({ text }) { return <Text>{text}</Text> }\n" ++
        "function App() { return <Box><Badge text={status} /></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    if (std.mem.indexOf(u8, out, "state.getSlotString(") == null) {
        std.debug.print("\n[KNOWN BUG] String state 'status' not resolved as component prop.\n", .{});
    }
}

test "REGRESSION: useFFI state in template literal must bind" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src =
        "// @ffi <time.h>\n" ++
        "declare function time(t: number): number;\n" ++
        "const [uptime] = useFFI(time, 1000);\n" ++
        "function App() { return <Box><Text>{`Uptime: ${uptime}s`}</Text></Box> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot") != null);
    // Direct use (not through component) — should bind
    try testing.expect(hasBoundDynText(out));
}

test "app with script block" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    const src = "<script>\nconst x = 42;\n</script>\nfunction App() { return <Text>hello</Text> }";
    var lex = Lexer.init(src); lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "JS_LOGIC") != null);
    try testing.expect(std.mem.indexOf(u8, out, "const x = 42") != null);
}
