//! Tests for lint.zig — pre-compilation linter
//!
//! Philosophy: test the CONTRACT, not the implementation.
//! Each test verifies a specific class of mistake is caught,
//! and that valid code is NOT flagged.
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const Lexer = h.Lexer;
const lint = @import("../lint.zig");
const Level = lint.Level;

// Use page_allocator for lint tests — diagnostic messages are arena-allocated
// strings that must outlive the Linter. page_allocator never frees, which is
// fine for small test allocations.
const test_alloc = std.heap.page_allocator;

fn runLint(src: []const u8) lint.LintResult {
    var lex = Lexer.init(src);
    lex.tokenize();
    var linter = lint.Linter.init(test_alloc, &lex, src);
    return linter.run();
}

fn hasDiag(result: lint.LintResult, needle: []const u8) bool {
    for (result.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, needle) != null) return true;
    }
    return false;
}

fn hasDiagAt(result: lint.LintResult, level: Level, needle: []const u8) bool {
    for (result.diagnostics) |d| {
        if (d.level == level and std.mem.indexOf(u8, d.message, needle) != null) return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════
// VALID CODE — must produce NO errors
// ═══════════════════════════════════════════════════════════════════════

test "valid: minimal app" {
    try testing.expectEqual(@as(u32, 0), runLint("function App() { return <Box /> }").error_count);
}

test "valid: app with state" {
    try testing.expectEqual(@as(u32, 0), runLint("function App() { const [count, setCount] = useState(0); return <Box /> }").error_count);
}

test "valid: style double braces" {
    try testing.expectEqual(@as(u32, 0), runLint("function App() { return <Box style={{ width: 100, flexGrow: 1 }} /> }").error_count);
}

test "valid: onPress" {
    try testing.expectEqual(@as(u32, 0), runLint("function App() { const [n, setN] = useState(0); return <Pressable onPress={() => setN(n + 1)} /> }").error_count);
}

test "valid: FFI pragma" {
    try testing.expectEqual(@as(u32, 0), runLint("// @ffi <time.h> -lrt\ndeclare function getTime(): number\nfunction App() { return <Text>hi</Text> }").error_count);
}

// ═══════════════════════════════════════════════════════════════════════
// BRACE BALANCE
// ═══════════════════════════════════════════════════════════════════════

test "error: unclosed brace" {
    const r = runLint("function App() { return <Box />");
    try testing.expect(r.error_count > 0);
    try testing.expect(hasDiag(r, "Unclosed brace"));
}

test "error: extra closing brace" {
    const r = runLint("function App() { return <Box /> } }");
    try testing.expect(r.error_count > 0);
    try testing.expect(hasDiag(r, "Extra closing brace"));
}

test "error: unclosed paren" {
    const r = runLint("function App( { return <Box /> }");
    try testing.expect(r.error_count > 0);
    try testing.expect(hasDiag(r, "Unclosed paren"));
}

// ═══════════════════════════════════════════════════════════════════════
// JSX TAG BALANCE
// ═══════════════════════════════════════════════════════════════════════

test "error: mismatched JSX tags" {
    const r = runLint("function App() { return <Box><Text>hi</Text></Box> }");
    // This is actually valid — Text closes Text, Box closes Box.
    // No mismatch error expected.
    var mismatch_count: u32 = 0;
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "Mismatched JSX") != null) mismatch_count += 1;
    }
    try testing.expectEqual(@as(u32, 0), mismatch_count);
}

test "error: actual mismatched JSX tags" {
    const r = runLint("function App() { return <Box><Text>hi</Box> }");
    try testing.expect(hasDiag(r, "Mismatched JSX"));
}

// ═══════════════════════════════════════════════════════════════════════
// HTML TAGS
// ═══════════════════════════════════════════════════════════════════════

// HTML tags are now accepted natively — no warnings expected
test "no warn: div" { try testing.expect(!hasDiag(runLint("function App() { return <div /> }"), "<Box>")); }
test "no warn: span" { try testing.expect(!hasDiag(runLint("function App() { return <span>hi</span> }"), "<Text>")); }
test "no warn: img" { try testing.expect(!hasDiag(runLint("function App() { return <img src=\"x\" /> }"), "<Image>")); }
test "no warn: button" { try testing.expect(!hasDiag(runLint("function App() { return <button>click</button> }"), "<Pressable>")); }
test "no warn: input" { try testing.expect(!hasDiag(runLint("function App() { return <input /> }"), "<TextInput>")); }

// ═══════════════════════════════════════════════════════════════════════
// REACT HABITS
// ═══════════════════════════════════════════════════════════════════════

test "warn: onClick" {
    const r = runLint("function App() { return <Box onClick={() => {}} /> }");
    try testing.expect(hasDiag(r, "onClick"));
    try testing.expect(hasDiag(r, "onPress"));
}

test "warn: className" { try testing.expect(hasDiag(runLint("function App() { return <Box className=\"foo\" /> }"), "className")); }
test "no warn: useEffect (now supported)" { try testing.expect(!hasDiag(runLint("function App() { useEffect(() => {}, []); return <Box /> }"), "useEffect")); }
test "hint: useMemo" { try testing.expect(hasDiag(runLint("function App() { const x = useMemo(() => 42, []); return <Box /> }"), "useMemo")); }

// ═══════════════════════════════════════════════════════════════════════
// STYLE PROPERTIES
// ═══════════════════════════════════════════════════════════════════════

test "error: paddingHorizontal" {
    const r = runLint("function App() { return <Box style={{ paddingHorizontal: 10 }} /> }");
    try testing.expect(r.error_count > 0);
    try testing.expect(hasDiag(r, "paddingHorizontal"));
}

test "error: marginVertical" {
    const r = runLint("function App() { return <Box style={{ marginVertical: 10 }} /> }");
    try testing.expect(r.error_count > 0);
    try testing.expect(hasDiag(r, "marginVertical"));
}

test "warn: unknown style property" {
    const r = runLint("function App() { return <Box style={{ backgrounColor: 'red' }} /> }");
    try testing.expect(hasDiagAt(r, .warn, "backgrounColor"));
}

test "warn: kebab-case style" {
    const r = runLint("function App() { return <Box style={{ 'flex-direction': 'row' }} /> }");
    try testing.expect(hasDiag(r, "kebab-case"));
}

test "warn: invalid enum value" {
    const r = runLint("function App() { return <Box style={{ justifyContent: 'middle' }} /> }");
    try testing.expect(hasDiag(r, "Invalid value"));
}

test "valid: known style properties" {
    const r = runLint("function App() { return <Box style={{ width: 100, height: 50, flexGrow: 1, backgroundColor: '#fff', flexDirection: 'row', padding: 8 }} /> }");
    var unknown_count: u32 = 0;
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "Unknown style property") != null) unknown_count += 1;
    }
    try testing.expectEqual(@as(u32, 0), unknown_count);
}

// ═══════════════════════════════════════════════════════════════════════
// useState SYNTAX
// ═══════════════════════════════════════════════════════════════════════

test "error: useState without destructuring" {
    try testing.expect(hasDiag(runLint("function App() { const count = useState(0); return <Box /> }"), "destructuring"));
}

test "valid: correct useState" {
    const r = runLint("function App() { const [count, setCount] = useState(0); return <Box /> }");
    var n: u32 = 0;
    for (r.diagnostics) |d| { if (std.mem.indexOf(u8, d.message, "useState") != null and d.level == .err) n += 1; }
    try testing.expectEqual(@as(u32, 0), n);
}

test "error: duplicate state" {
    try testing.expect(hasDiag(runLint("function App() { const [count, setCount] = useState(0); const [count, setCount2] = useState(1); return <Box /> }"), "Duplicate state"));
}

// ═══════════════════════════════════════════════════════════════════════
// FFI / SINGLE-BRACE / NO APP
// ═══════════════════════════════════════════════════════════════════════

test "error: FFI pragma without angle brackets" {
    try testing.expect(hasDiag(runLint("// @ffi math.h -lm\nfunction App() { return <Box /> }"), "angle brackets"));
}

test "error: style single braces" {
    try testing.expect(hasDiag(runLint("function App() { return <Box style={width: 100} /> }"), "double braces"));
}

test "error: no function" {
    try testing.expect(hasDiag(runLint("const x = 42;"), "No function found"));
}

test "hint: no App function" {
    try testing.expect(hasDiagAt(runLint("function MyWidget() { return <Box /> }"), .hint, "No 'App'"));
}

// ═══════════════════════════════════════════════════════════════════════
// LINE/COL ACCURACY
// ═══════════════════════════════════════════════════════════════════════

test "diagnostics have correct line numbers" {
    // Use onClick (still warned) to verify line numbers are accurate
    const src = "// line 1\n// line 2\nfunction App() { return <Box onClick={() => {}} /> }";
    var lex = Lexer.init(src);
    lex.tokenize();
    var linter = lint.Linter.init(test_alloc, &lex, src);
    const r = linter.run();
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "onClick") != null) {
            try testing.expectEqual(@as(u32, 3), d.line);
            return;
        }
    }
    return error.TestUnexpectedResult;
}

// ═══════════════════════════════════════════════════════════════════════
// CHILD OVERFLOW
// ═══════════════════════════════════════════════════════════════════════

test "warn: child width exceeds parent" {
    const r = runLint("function App() { return <Box style={{ width: 400 }}><Box style={{ width: 500 }}>hi</Box></Box> }");
    try testing.expect(hasDiagAt(r, .warn, "exceeds parent"));
    try testing.expect(hasDiag(r, "width"));
}

test "warn: child height exceeds parent" {
    const r = runLint("function App() { return <Box style={{ height: 200 }}><Box style={{ height: 300 }}>hi</Box></Box> }");
    try testing.expect(hasDiagAt(r, .warn, "exceeds parent"));
    try testing.expect(hasDiag(r, "height"));
}

test "valid: child fits in parent" {
    const r = runLint("function App() { return <Box style={{ width: 400 }}><Box style={{ width: 200 }}>hi</Box></Box> }");
    var overflow_count: u32 = 0;
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "exceeds parent") != null) overflow_count += 1;
    }
    try testing.expectEqual(@as(u32, 0), overflow_count);
}

test "valid: child uses percentage width" {
    const r = runLint("function App() { return <Box style={{ width: 400 }}><Box style={{ width: '100%' }}>hi</Box></Box> }");
    var overflow_count: u32 = 0;
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "exceeds parent") != null) overflow_count += 1;
    }
    try testing.expectEqual(@as(u32, 0), overflow_count);
}

test "valid: no parent dimensions — no overflow warning" {
    const r = runLint("function App() { return <Box><Box style={{ width: 9999 }}>hi</Box></Box> }");
    var overflow_count: u32 = 0;
    for (r.diagnostics) |d| {
        if (std.mem.indexOf(u8, d.message, "exceeds parent") != null) overflow_count += 1;
    }
    try testing.expectEqual(@as(u32, 0), overflow_count);
}

test "warn: padding reduces available space" {
    const r = runLint("function App() { return <Box style={{ width: 400, padding: 50 }}><Box style={{ width: 350 }}>hi</Box></Box> }");
    try testing.expect(hasDiagAt(r, .warn, "exceeds parent"));
    try testing.expect(hasDiag(r, "width"));
}

test "warn: self-closing child overflow" {
    const r = runLint("function App() { return <Box style={{ width: 200 }}><Box style={{ width: 300 }} /></Box> }");
    try testing.expect(hasDiagAt(r, .warn, "exceeds parent"));
}
