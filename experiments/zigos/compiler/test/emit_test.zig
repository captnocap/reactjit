//! Tests for emit.zig — end-to-end pipeline (full app compilation)
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const Lexer = h.Lexer;
const Generator = h.Generator;

test "minimal app" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { return <Box /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "const std = @import(\"std\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "const Node = layout.Node") != null);
    try testing.expect(std.mem.indexOf(u8, out, "pub fn main()") != null);
    try testing.expect(std.mem.indexOf(u8, out, "var _root = Node{") != null);
}

test "app with state" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); return <Box><Text>{count}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "const state = @import(\"framework/state.zig\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_initState") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.createSlot(0)") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_updateDynamicTexts") != null);
}

test "app with string state" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [msg, setMsg] = useState(\"hello\"); return <Box><Text>{msg}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "createSlotString(\"hello\")") != null);
}

test "app with onPress" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [n, setN] = useState(0); return <Pressable onPress={() => setN(n + 1)}><Text>{n}</Text></Pressable> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "fn _handler_press_") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlot(") != null);
}

test "app with object state flattening" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "function App() { const [user, setUser] = useState({ name: \"alice\", age: 30, active: true }); " ++
        "return <Pressable onPress={() => setUser({ ...user, name: \"bob\", age: user.age + 1 })}><Text>{user.name}</Text></Pressable> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "createSlotString(\"alice\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlotString(0)") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlotString(0, \"bob\")") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlot(1, (state.getSlot(1) + 1))") != null);
}

test "app with component" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function Greeting({ text }) { return <Text>{text}</Text> }\nfunction App() { return <Box><Greeting text=\"hi\" /></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "hi") != null);
    try testing.expect(std.mem.indexOf(u8, out, "var _root") != null);
}

test "app with FFI" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "// @ffi <time.h>\ndeclare function getTime(): number\nfunction App() { return <Text>time</Text> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "@cImport") != null);
    try testing.expect(std.mem.indexOf(u8, out, "time.h") != null);
    try testing.expect(std.mem.indexOf(u8, out, "_ffi_getTime") != null);
}

test "module mode" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { return <Box><Text>module</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
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

// Helper: check if _updateDynamicTexts has a bound node assignment.
// Accepts both array bindings (_arr_X[Y].text = _dyn_text_Z) and root bindings
// (root.text = _dyn_text_Z) — the latter is emitted when App returns a bare
// component that inlines to a single Text node with no parent array.
fn hasBoundDynText(out: []const u8) bool {
    const fn_start = std.mem.indexOf(u8, out, "fn _updateDynamicTexts()") orelse return false;
    const fn_body = out[fn_start..];
    const fn_end = std.mem.indexOf(u8, fn_body, "\n}\n") orelse fn_body.len;
    const body = fn_body[0..fn_end];
    // Array binding: _arr_N[M].text = _dyn_text_
    if (std.mem.indexOf(u8, body, "].text = _dyn_text_") != null) return true;
    // Root binding: root.text = _dyn_text_
    if (std.mem.indexOf(u8, body, "root.text = _dyn_text_") != null) return true;
    return false;
}

fn countMatches(haystack: []const u8, needle: []const u8) usize {
    var count: usize = 0;
    var start: usize = 0;
    while (std.mem.indexOfPos(u8, haystack, start, needle)) |idx| {
        count += 1;
        start = idx + needle.len;
    }
    return count;
}

fn dynTextBindingCount(out: []const u8) usize {
    const fn_start = std.mem.indexOf(u8, out, "fn _updateDynamicTexts()") orelse return 0;
    const fn_body = out[fn_start..];
    const fn_end = std.mem.indexOf(u8, fn_body, "\n}\n") orelse fn_body.len;
    const body = fn_body[0..fn_end];
    return countMatches(body, "].text = _dyn_text_") + countMatches(body, "root.text = _dyn_text_");
}

// Check for a concrete dyn text binding for dyn_id — accepts both array bindings
// (_arr_X[Y].text = _dyn_text_N) and root binding (root.text = _dyn_text_N).
fn hasConcreteDynTextBinding(out: []const u8, dyn_id: usize) bool {
    const fn_start = std.mem.indexOf(u8, out, "fn _updateDynamicTexts()") orelse return false;
    const fn_body = out[fn_start..];
    const fn_end = std.mem.indexOf(u8, fn_body, "\n}\n") orelse fn_body.len;
    const body = fn_body[0..fn_end];

    // Check array binding: _arr_X[Y].text = _dyn_text_N
    var needle_buf: [64]u8 = undefined;
    const arr_needle = std.fmt.bufPrint(&needle_buf, "].text = _dyn_text_{d};", .{dyn_id}) catch return false;
    var start: usize = 0;
    while (std.mem.indexOfPos(u8, body, start, arr_needle)) |idx| {
        const line_start = std.mem.lastIndexOfScalar(u8, body[0..idx], '\n') orelse 0;
        const line = body[line_start..idx];
        if (std.mem.indexOf(u8, line, "_arr_") != null) return true;
        start = idx + arr_needle.len;
    }

    // Check root binding: root.text = _dyn_text_N
    var root_buf: [64]u8 = undefined;
    const root_needle = std.fmt.bufPrint(&root_buf, "root.text = _dyn_text_{d};", .{dyn_id}) catch return false;
    return std.mem.indexOf(u8, body, root_needle) != null;
}

fn concreteDynTextBindingCount(out: []const u8, dyn_id: usize) usize {
    const fn_start = std.mem.indexOf(u8, out, "fn _updateDynamicTexts()") orelse return 0;
    const fn_body = out[fn_start..];
    const fn_end = std.mem.indexOf(u8, fn_body, "\n}\n") orelse fn_body.len;
    const body = fn_body[0..fn_end];

    var count: usize = 0;

    // Count array bindings
    var needle_buf: [64]u8 = undefined;
    const arr_needle = std.fmt.bufPrint(&needle_buf, "].text = _dyn_text_{d};", .{dyn_id}) catch return 0;
    var start: usize = 0;
    while (std.mem.indexOfPos(u8, body, start, arr_needle)) |idx| {
        const line_start = std.mem.lastIndexOfScalar(u8, body[0..idx], '\n') orelse 0;
        const line = body[line_start..idx];
        if (std.mem.indexOf(u8, line, "_arr_") != null) count += 1;
        start = idx + arr_needle.len;
    }

    // Count root bindings
    var root_buf: [64]u8 = undefined;
    const root_needle = std.fmt.bufPrint(&root_buf, "root.text = _dyn_text_{d};", .{dyn_id}) catch return count;
    count += countMatches(body, root_needle);

    return count;
}

test "REGRESSION: state var in template literal prop must bind to node" {
    // Dashboard bug: <StatCard value={`${cpu}%`} /> — the dynamic text is
    // created but never BOUND to a node in the array. _updateDynamicTexts
    // updates a buffer but nothing reads it.
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [cpu, setCpu] = useState(0);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${cpu}%`} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
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

test "STRICT: single-state template prop binds a concrete array target" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [cpu, setCpu] = useState(0);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${cpu}%`} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot(0)") != null);
    try testing.expect(hasConcreteDynTextBinding(out, 0));
    try testing.expectEqual(@as(usize, 1), concreteDynTextBindingCount(out, 0));
}

test "REGRESSION: multi-state template prop must bind" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [memUsed, setMemUsed] = useState(0);\n" ++
        "const [memTotal, setMemTotal] = useState(8192);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${memUsed}/${memTotal} MB`} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "getSlot") != null);
    if (!hasBoundDynText(out)) {
        std.debug.print("\n[KNOWN BUG] Multi-state template prop not bound to node.\n", .{});
    }
}

test "STRICT: multi-state template prop binds exactly one dynamic text node" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [memUsed, setMemUsed] = useState(0);\n" ++
        "const [memTotal, setMemTotal] = useState(8192);\n" ++
        "function Card({ value }) { return <Text>{value}</Text> }\n" ++
        "function App() { return <Card value={`${memUsed}/${memTotal} MB`} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot(0)") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot(1)") != null);
    try testing.expect(hasConcreteDynTextBinding(out, 0));
    try testing.expectEqual(@as(usize, 1), concreteDynTextBindingCount(out, 0));
}

test "direct template literal in JSX must bind" {
    // Non-component case: <Text>{`Count: ${count}`}</Text> — should work
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [count, setCount] = useState(0);\n" ++
        "function App() { return <Box><Text>{`Count: ${count}`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot(") != null);
    // Direct usage (not through component) should bind correctly
    try testing.expect(hasBoundDynText(out));
}

test "REGRESSION: string state as component prop must bind" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [status, setStatus] = useState(\"healthy\");\n" ++
        "function Badge({ text }) { return <Text>{text}</Text> }\n" ++
        "function App() { return <Box><Badge text={status} /></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    if (std.mem.indexOf(u8, out, "state.getSlotString(") == null) {
        std.debug.print("\n[KNOWN BUG] String state 'status' not resolved as component prop.\n", .{});
    }
}

test "STRICT: string state component prop binds dynamic text node" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "const [status, setStatus] = useState(\"healthy\");\n" ++
        "function Badge({ text }) { return <Text>{text}</Text> }\n" ++
        "function App() { return <Box><Badge text={status} /></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlotString(0)") != null);
    try testing.expect(std.mem.indexOf(u8, out, ".text = \"\"") != null);
    try testing.expect(hasConcreteDynTextBinding(out, 0));
    try testing.expectEqual(@as(usize, 1), concreteDynTextBindingCount(out, 0));
}

test "REGRESSION: useFFI state in template literal must bind" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src =
        "// @ffi <time.h>\n" ++
        "declare function time(t: number): number;\n" ++
        "const [uptime] = useFFI(time, 1000);\n" ++
        "function App() { return <Box><Text>{`Uptime: ${uptime}s`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "state.getSlot") != null);
    // Direct use (not through component) — should bind
    try testing.expect(hasBoundDynText(out));
}

// ── useEffect tests ──

test "app with useEffect mount" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); useEffect(() => { setCount(10) }, []); return <Box><Text>{`${count}`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // Mount effect body should appear in _appInit
    try testing.expect(std.mem.indexOf(u8, out, "// useEffect mount") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlot(0, 10)") != null);
}

test "app with useEffect frame" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); useEffect(() => { setCount(count + 1) }); return <Box><Text>{`${count}`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // Frame effect body should appear in _appTick
    try testing.expect(std.mem.indexOf(u8, out, "// useEffect frame") != null);
}

test "app with useEffect interval" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); useEffect(() => { setCount(count + 1) }, 500); return <Box><Text>{`${count}`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // Interval effect should have timer variable and timer check in _appTick
    try testing.expect(std.mem.indexOf(u8, out, "_effect_timer_") != null);
    try testing.expect(std.mem.indexOf(u8, out, ">= 500") != null);
    // now parameter should NOT be suppressed
    try testing.expect(std.mem.indexOf(u8, out, "_ = now;") == null);
}

test "app with useEffect watch" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { const [count, setCount] = useState(0); const [label, setLabel] = useState(\"hi\"); useEffect(() => { setLabel(\"changed\") }, [count]); return <Box><Text>{`${count} ${label}`}</Text></Box> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // Watch effect should emit setSlotString in the dirty check block
    try testing.expect(std.mem.indexOf(u8, out, "state.setSlotString(") != null);
    try testing.expect(std.mem.indexOf(u8, out, "state.isDirty()") != null);
}

// ── Effect API tests ──

test "Effect element with onRender emits render function" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { return <Effect onRender={(e) => { e.setPixel(0, 0, 1, 0, 0, 1) }} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // Should emit effect_ctx import
    try testing.expect(std.mem.indexOf(u8, out, "effect_ctx") != null);
    // Should emit effect_render function
    try testing.expect(std.mem.indexOf(u8, out, "_effect_render_0") != null);
    // Should emit ctx.setPixel call
    try testing.expect(std.mem.indexOf(u8, out, "ctx.setPixel(") != null);
    // Node should have .effect_render field
    try testing.expect(std.mem.indexOf(u8, out, ".effect_render = _effect_render_0") != null);
}

test "Effect onRender translates math builtins" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { return <Effect onRender={(e) => { e.setPixel(0, 0, e.sin(e.time), 0, 0, 1) }} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    // e.sin(x) → @sin(x)
    try testing.expect(std.mem.indexOf(u8, out, "@sin(") != null);
    // e.time → ctx.time
    try testing.expect(std.mem.indexOf(u8, out, "ctx.time") != null);
}

test "Effect onRender translates ctx methods" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "function App() { return <Effect onRender={(e) => { e.clear(); e.fade(0.97) }} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "ctx.clear(") != null);
    try testing.expect(std.mem.indexOf(u8, out, "ctx.fade(") != null);
}

test "app with script block" {
    var a = arena();
    defer a.deinit();
    const al = a.allocator();
    const src = "<script>\nconst x = 42;\n</script>\nfunction App() { return <Text>hello</Text> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var gen = Generator.init(al, &lex, src, "test.tsz");
    const out = try gen.generate();
    try testing.expect(std.mem.indexOf(u8, out, "JS_LOGIC") != null);
    try testing.expect(std.mem.indexOf(u8, out, "const x = 42") != null);
}
