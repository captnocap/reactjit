# Agent 1: Lexer Overhaul + Expression Engine

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on the **compiler side only** — specifically the lexer and expression parser.

## Your Mission

The lexer (`tsz/compiler/lexer.zig`) is missing tokens for comparison operators, logical operators, ternary, and keywords. The expression parser (`codegen.zig:1105-1163`) only handles `+`, `-`, `*` with flat two-operand expressions. You need to:

1. Add missing tokens to the lexer
2. Replace the flat expression parser with a proper recursive descent expression parser

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/compiler/lexer.zig` (full ownership)
- `tsz/compiler/codegen.zig` lines 1105-1163 (the `emitStateExpr` and `emitStateAtom` functions)
- A new test example `tsz/examples/expressions-test.tsz`

Do NOT modify other functions in codegen.zig. Other agents own those regions.

## Important Constraints

- **No JS truthiness.** `&&` and `||` are only supported when both operands are boolean/comparison expressions. TSZ does not implement JavaScript truthiness coercion. `count && mode` (integer && integer) is NOT valid. `count > 0 && mode == 1` IS valid.
- **Do not expand FFI argument parsing** beyond the current simple behavior (bare numbers and `0` → `null` mapping). This task is not an FFI argument parser upgrade.
- **Do not add single-character `&` or `|` tokens.** Only support `&&` and `||`. No bitwise operators in this task.
- **Parenthesized expressions must preserve grouping** in emitted Zig — wrap in `()` for clarity.
- **Ternary requires `:`.** If `:` is missing after the true branch, emit a compile error, do not silently continue.
- Preserve the current fallback behavior for unknown atoms (`return "0"`) — do not attempt a general error system in this task.
- The `<`/`>` dual role (JSX delimiters vs comparison operators) works because JSX tags always follow `<identifier` / `</` patterns, while comparisons appear inside expression contexts (handler bodies, ternaries). This is adequate for now but is noted as a future consideration.

## Step 1: Lexer — Add Missing Tokens

File: `tsz/compiler/lexer.zig`

### Current TokenKind enum (lines 9-46):
```zig
pub const TokenKind = enum {
    identifier, number, string, template_literal,
    lparen, rparen, lbrace, rbrace, lbracket, rbracket,
    comma, colon, semicolon, dot, equals, arrow,
    plus, minus, star, slash, percent, bang,
    lt, gt, slash_gt, lt_slash,
    ffi_pragma, comment, eof,
};
```

### Add these tokens:
```zig
// Comparison
eq_eq,        // ==
not_eq,       // !=
gt_eq,        // >=
lt_eq,        // <=

// Logical
amp_amp,      // &&
pipe_pipe,    // ||

// Ternary
question,     // ?
```

That's it. No single `&`, no single `|`, no other new tokens.

### Where to add multi-char operator scanning

In the `tokenize()` function (line 110), there's a multi-char section starting at line 207. The order matters — **multi-char operators must be checked before single-char fallbacks**. Currently it checks `=>`, `/>`, `</`.

Add these checks BEFORE the single-char switch (line 224). The `=>` check (arrow, line 208) must come BEFORE the `==` check since `=>` is arrow, not `=` then `>`.

**Full order of multi-char checks:**
1. `=>` (arrow) — already exists at line 208
2. `==` (eq_eq) — new
3. `!=` (not_eq) — new
4. `/>` (slash_gt) — already exists at line 213
5. `</` (lt_slash) — already exists at line 218
6. `>=` (gt_eq) — new
7. `<=` (lt_eq) — new
8. `&&` (amp_amp) — new
9. `||` (pipe_pipe) — new
10. Single-char fallback switch — already exists at line 224

```zig
// After the existing => check (line 208-212):

// ==
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

// After the existing /> and </ checks (lines 213-222):

// >= (must check before single >)
if (ch == '>' and self.peekAt(1) == '=') {
    self.pos += 2;
    self.emit(.gt_eq, start, start + 2);
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
```

Add `?` to the single-char switch at line 225:
```zig
'?' => .question,
```

Bare `&` and `|` remain unhandled (they fall through as unknown characters and get skipped). This is intentional — we only support `&&` and `||`.

## Step 2: Expression Parser — Recursive Descent

File: `tsz/compiler/codegen.zig`, lines 1105-1163

### Current implementation:

`emitStateExpr` (line 1105) parses flat `atom OP atom` with only `+`, `-`, `*`.
`emitStateAtom` (line 1128) handles numbers, state getters, FFI calls, and bare identifiers.

### Replace with recursive descent:

The standard precedence levels (low to high):
1. Ternary: `? :`
2. Logical OR: `||`
3. Logical AND: `&&`
4. Equality: `==`, `!=`
5. Comparison: `<`, `>`, `<=`, `>=`
6. Additive: `+`, `-`
7. Multiplicative: `*`, `/`, `%`
8. Unary: `!`, `-`
9. Atom: number, string, boolean literal, state getter, FFI call, identifier, `(expr)`

Replace `emitStateExpr` and `emitStateAtom` with these functions:

```zig
fn emitStateExpr(self: *Generator) ![]const u8 {
    return try self.emitTernary();
}

fn emitTernary(self: *Generator) ![]const u8 {
    const cond = try self.emitLogicalOr();
    if (self.curKind() == .question) {
        self.advance_token(); // skip ?
        const then_val = try self.emitTernary(); // right-associative
        // Ternary requires colon — fail if missing
        if (self.curKind() != .colon) {
            std.debug.print("[tsz] Ternary missing ':' at pos {d}\n", .{self.pos});
            return error.ExpectedColonInTernary;
        }
        self.advance_token(); // skip :
        const else_val = try self.emitTernary();
        return try std.fmt.allocPrint(self.alloc,
            "(if ({s}) {s} else {s})", .{ cond, then_val, else_val });
    }
    return cond;
}

fn emitLogicalOr(self: *Generator) ![]const u8 {
    var left = try self.emitLogicalAnd();
    while (self.curKind() == .pipe_pipe) {
        self.advance_token();
        const right = try self.emitLogicalAnd();
        // Zig uses `or` for logical OR (not `||` which is bitwise)
        // Both operands must be bool (comparison results, boolean state, or ! expressions)
        left = try std.fmt.allocPrint(self.alloc,
            "({s} or {s})", .{ left, right });
    }
    return left;
}

fn emitLogicalAnd(self: *Generator) ![]const u8 {
    var left = try self.emitEquality();
    while (self.curKind() == .amp_amp) {
        self.advance_token();
        const right = try self.emitEquality();
        // Zig uses `and` for logical AND (not `&&` which is bitwise)
        // Both operands must be bool (comparison results, boolean state, or ! expressions)
        left = try std.fmt.allocPrint(self.alloc,
            "({s} and {s})", .{ left, right });
    }
    return left;
}

fn emitEquality(self: *Generator) ![]const u8 {
    var left = try self.emitComparison();
    while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
        const op = if (self.curKind() == .eq_eq) "==" else "!=";
        self.advance_token();
        const right = try self.emitComparison();
        left = try std.fmt.allocPrint(self.alloc,
            "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitComparison(self: *Generator) ![]const u8 {
    var left = try self.emitAdditive();
    // Note: .lt and .gt are also JSX tokens, but in expression context they're comparisons.
    // This works because expression parsing only runs inside handler bodies and ternaries,
    // never during JSX tag scanning.
    while (self.curKind() == .lt or self.curKind() == .gt or
           self.curKind() == .lt_eq or self.curKind() == .gt_eq)
    {
        const op = switch (self.curKind()) {
            .lt => "<",
            .gt => ">",
            .lt_eq => "<=",
            .gt_eq => ">=",
            else => unreachable,
        };
        self.advance_token();
        const right = try self.emitAdditive();
        left = try std.fmt.allocPrint(self.alloc,
            "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitAdditive(self: *Generator) ![]const u8 {
    var left = try self.emitMultiplicative();
    while (self.curKind() == .plus or self.curKind() == .minus) {
        const op = self.curText();
        self.advance_token();
        const right = try self.emitMultiplicative();
        left = try std.fmt.allocPrint(self.alloc,
            "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitMultiplicative(self: *Generator) ![]const u8 {
    var left = try self.emitUnary();
    while (self.curKind() == .star or self.curKind() == .slash or
           self.curKind() == .percent)
    {
        const op = self.curText();
        self.advance_token();
        const right = try self.emitUnary();
        left = try std.fmt.allocPrint(self.alloc,
            "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitUnary(self: *Generator) ![]const u8 {
    if (self.curKind() == .bang) {
        self.advance_token();
        const operand = try self.emitUnary();
        return try std.fmt.allocPrint(self.alloc, "(!{s})", .{operand});
    }
    if (self.curKind() == .minus) {
        self.advance_token();
        const operand = try self.emitUnary();
        return try std.fmt.allocPrint(self.alloc, "(-{s})", .{operand});
    }
    return try self.emitStateAtom();
}
```

### Update `emitStateAtom` (line 1128):

Keep the existing FFI call logic **exactly as-is** (intentionally narrow — this task does not upgrade FFI argument parsing). Add parenthesized expressions, boolean literals, and string literals.

```zig
fn emitStateAtom(self: *Generator) ![]const u8 {
    // Parenthesized expression — preserve grouping in emitted Zig
    if (self.curKind() == .lparen) {
        self.advance_token(); // (
        const inner = try self.emitStateExpr();
        if (self.curKind() == .rparen) self.advance_token(); // )
        return try std.fmt.allocPrint(self.alloc, "({s})", .{inner});
    }
    // Number literal
    if (self.curKind() == .number) {
        const val = self.curText();
        self.advance_token();
        return val;
    }
    // String literal
    if (self.curKind() == .string) {
        const val = self.curText();
        self.advance_token();
        return val;
    }
    if (self.curKind() == .identifier) {
        const name = self.curText();
        // Boolean literals
        if (std.mem.eql(u8, name, "true") or std.mem.eql(u8, name, "false")) {
            self.advance_token();
            return name;
        }
        // State getter
        if (self.isState(name)) |slot_id| {
            self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
        }
        // FFI call in expression position
        // NOTE: This is intentionally narrow — only bare numbers and 0→null mapping.
        // Do not attempt full argument expression parsing here.
        if (self.isFFIFunc(name)) {
            self.advance_token();
            if (self.curKind() == .lparen) self.advance_token();
            var ffi_args: std.ArrayListUnmanaged(u8) = .{};
            while (self.curKind() != .rparen and self.curKind() != .eof) {
                if (self.curKind() == .number) {
                    if (std.mem.eql(u8, self.curText(), "0")) {
                        try ffi_args.appendSlice(self.alloc, "null");
                    } else {
                        try ffi_args.appendSlice(self.alloc, self.curText());
                    }
                }
                self.advance_token();
            }
            if (self.curKind() == .rparen) self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "ffi.{s}({s})", .{ name, ffi_args.items });
        }
        // Bare identifier — return as-is
        self.advance_token();
        return name;
    }
    self.advance_token();
    return "0";
}
```

### Important: Zig expression mapping

| JavaScript | Zig | Notes |
|-----------|-----|-------|
| `&&` | `and` | Both operands must be `bool`. No truthiness. |
| `\|\|` | `or` | Both operands must be `bool`. No truthiness. |
| `!` | `!` | Same. |
| `a ? b : c` | `if (a) b else c` | `a` must be `bool`. |
| `===` / `!==` | `==` / `!=` | Zig is strict typed, no loose equality. |

**For comparisons on state values:** `state.getSlot(0)` returns `i64`. Comparing `i64 > i64` returns `bool`. This works.

**For ternary returning values to state setters:** `state.setSlot(0, if (x > 5) 0 else 1)` — this works because both branches are `i64`.

**What does NOT work:** `count && mode` where both are `i64`. Zig `and` requires `bool` operands. Users must write `count != 0 && mode != 0` or use comparison expressions. This is intentional — we do not support JS truthiness.

## Step 3: Test Example

Create `tsz/examples/expressions-test.tsz`:

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Mode: ${mode}`}</Text>

      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Increment</Text>
      </Pressable>

      <Pressable onPress={() => setCount(count * 2 + 1)} style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Double + 1</Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode == 0 ? 1 : 0)} style={{ padding: 16, backgroundColor: '#c586c0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Toggle Mode</Text>
      </Pressable>
    </Box>
  );
}
```

This tests: multi-operand arithmetic (`count * 2 + 1`), ternary in handler (`mode == 0 ? 1 : 0`), and comparison operators.

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/expressions-test.tsz
```

If the compiler builds and the example compiles to a native binary without errors, you're done. Run the binary to visually confirm the buttons work.

## What NOT to Touch

- Do not modify `emitHandlerExpr` (lines 1006-1103) — Agent 4 owns that
- Do not modify `collectStateHooks` (lines 373-422) — Agent 2 owns that
- Do not modify the JSX children loop (lines 558-604) — Agent 3 owns that
- Do not modify `emitZigSource` (lines 1238+) — Agent 2 owns state emission there
- Do not modify any runtime files (`state.zig`, `events.zig`, `input.zig`, `main.zig`)

## Commit

After verification, commit with: `feat(tsz): add comparison/logical/ternary tokens and recursive descent expression parser`
