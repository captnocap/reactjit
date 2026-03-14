# Agent 3: Conditional JSX Rendering (Ternary + Logical AND)

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on the **compiler's JSX parser** to add conditional rendering.

## Your Mission

Currently the JSX children loop (codegen.zig lines 558-604) only handles:
- Child JSX elements (`<Tag>`)
- Expression blocks with template literals (`{`...`}`)
- Bare identifiers (`{children}`)
- Raw text content

You're adding:
- **Ternary in JSX:** `{condition ? <A/> : <B/>}`
- **Logical AND in JSX:** `{condition && <A/>}`

Dynamic lists (`.map()`) are **not in scope** for this task — they need their own plan.

**This is tricky work with multiple failure modes.** Work incrementally:
1. Get ternary parsing working first with a minimal test
2. Verify the generated Zig compiles and runs correctly
3. Then add logical AND
4. Then review your own generated output for edge cases

Do not try to implement everything at once.

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/compiler/codegen.zig` lines 558-604 (JSX children parsing loop)
- `tsz/compiler/codegen.zig` lines 715-764 (children array construction)
- New helper functions you add (place them after `emitWindowElement`, around line 1208)
- Generator struct fields (for condition tracking)
- `emitZigSource` — new `updateConditionals()` function emission
- A new test example `tsz/examples/conditional-test.tsz`

## Important Constraints

- **Do not build a second expression parser.** Agent 1 is building `emitStateExpr()` as a proper recursive descent parser. Your condition parsing should call `emitStateExpr()` to parse the condition expression, not re-implement expression assembly by token-splicing. This keeps one expression language, not three divergent ones.
- **Do not modify `emitStateExpr`/`emitStateAtom`** — Agent 1 owns those. You call them, you don't change them.
- **Do not modify the lexer** — Agent 1 owns that. You need `.question` and `.amp_amp` tokens; see Token Dependencies below.
- **Do not modify `state.zig`, `events.zig`, `input.zig`, `main.zig`**.
- **Ternary requires `:`.** If `:` is missing after the true branch, fail with an error, don't silently continue.

## Design Approach: Display Toggle

The node tree in tsz is **static** — it's compiled to fixed `[_]Node{...}` arrays. You can't add/remove nodes at runtime. But you CAN toggle `.style.display` between `.flex` and `.none` at runtime.

**Strategy:** For `{cond ? <A/> : <B/>}`, emit BOTH branches as children, and add runtime code that sets one to `display: none` based on the condition.

This means:
1. Both branches exist in the array at compile time
2. A function runs each frame that sets `.style.display` on each branch based on state
3. Layout skips `display: none` nodes (already implemented in `layout.zig`)

## Step 1: Condition Tracking Data Structures

Add to the Generator struct (around line 46). This is a meaningful struct addition — it affects `init` and all codegen passes, so be deliberate about it.

```zig
const MAX_CONDS = 32;

const CondKind = enum {
    ternary,    // show one, hide other
    show_hide,  // show or hide single element
};

const CondInfo = struct {
    kind: CondKind,
    condition: []const u8,  // Zig expression (from emitStateExpr)
    arr_name: []const u8,   // array containing the conditional nodes
    true_idx: u32,          // index of true branch in array
    false_idx: u32,         // index of false branch (same as true_idx for show_hide)
};
```

Add to Generator struct fields:
```zig
conds: [MAX_CONDS]CondInfo,
cond_count: u32,
```

Initialize in `Generator.init`:
```zig
.conds = undefined,
.cond_count = 0,
```

## Step 2: Parse Ternary in JSX Children

### Lookahead detection

Add a helper to detect ternary patterns. Called after consuming the `{` token, scanning forward without consuming to find `?` before `}`:

```zig
/// Lookahead: check if tokens from current pos to matching } contain a ? (ternary).
/// Tracks brace/paren/bracket depth to avoid false matches inside nested expressions.
fn isTernaryAhead(self: *Generator) bool {
    var look = self.pos;
    var brace_depth: u32 = 0;
    var paren_depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) brace_depth += 1;
        if (kind == .rbrace) {
            if (brace_depth == 0) return false;
            brace_depth -= 1;
        }
        if (kind == .lparen) paren_depth += 1;
        if (kind == .rparen and paren_depth > 0) paren_depth -= 1;
        if (kind == .question and brace_depth == 0 and paren_depth == 0) return true;
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}
```

### Parse the condition using Agent 1's expression parser

The key insight: **call `emitStateExpr()`** to parse the condition, don't token-splice it yourself. `emitStateExpr` already knows how to resolve state getters, handle operators, and emit valid Zig.

```zig
const TernaryResult = struct {
    condition: []const u8,
    true_expr: []const u8,
    false_expr: []const u8,
};

fn parseTernaryJSX(self: *Generator) !TernaryResult {
    // Parse condition using the real expression parser
    const condition = try self.emitStateExpr();

    // Expect ? token
    if (self.curKind() != .question) {
        std.debug.print("[tsz] Expected '?' in ternary at pos {d}\n", .{self.pos});
        return error.ExpectedQuestionInTernary;
    }
    self.advance_token(); // skip ?

    // Skip optional ( around true branch
    if (self.curKind() == .lparen) self.advance_token();

    // Parse true branch — must be a JSX element
    const true_expr = try self.parseJSXElement();

    // Skip optional ) after true branch
    if (self.curKind() == .rparen) self.advance_token();

    // Expect : token
    if (self.curKind() != .colon) {
        std.debug.print("[tsz] Ternary missing ':' at pos {d}\n", .{self.pos});
        return error.ExpectedColonInTernary;
    }
    self.advance_token(); // skip :

    // Skip optional ( around false branch
    if (self.curKind() == .lparen) self.advance_token();

    // Parse false branch — must be a JSX element
    const false_expr = try self.parseJSXElement();

    // Skip optional ) after false branch
    if (self.curKind() == .rparen) self.advance_token();

    return .{
        .condition = condition,
        .true_expr = true_expr,
        .false_expr = false_expr,
    };
}
```

### Wire into the JSX children loop

In the `else if (self.curKind() == .lbrace)` branch (line 566), after consuming `{`:

```zig
if (self.curKind() == .lbrace) {
    self.advance_token(); // skip {

    if (self.curKind() == .template_literal) {
        // ... existing template literal handling (lines 569-578) ...
    } else if (self.isTernaryAhead()) {
        // Ternary: {condition ? <TrueJSX/> : <FalseJSX/>}
        const ternary = try self.parseTernaryJSX();
        // Both branches become children; display toggled at runtime
        try child_exprs.append(self.alloc, ternary.true_expr);
        try child_exprs.append(self.alloc, ternary.false_expr);
        // Record condition — array name assigned during array construction below
        if (self.cond_count < MAX_CONDS) {
            self.conds[self.cond_count] = .{
                .kind = .ternary,
                .condition = ternary.condition,
                .arr_name = "",  // assigned in Step 3
                .true_idx = @intCast(child_exprs.items.len - 2),
                .false_idx = @intCast(child_exprs.items.len - 1),
            };
            self.cond_count += 1;
        }
    } else if (self.curKind() == .identifier) {
        // ... existing identifier handling (lines 579-582) ...
    }

    if (self.curKind() == .rbrace) self.advance_token();
}
```

## Step 3: Bind Conditions to Their Array

This is the trickiest part. The condition's `true_idx`/`false_idx` refer to positions in `child_exprs` — which becomes a specific `_arr_N` array. The binding must happen **at array construction time**, not via global late-binding.

In the children array construction (lines 715-764), after the array declaration is appended to `self.array_decls` (line 729), bind any pending conditions that belong to THIS array:

```zig
// After: try self.array_decls.append(self.alloc, ...);

// Bind conditions whose indices belong to this child array.
// A condition belongs here if its true_idx is within [0, child_exprs.items.len).
// Conditions are created during this parseJSXElement call, so unbound conditions
// (arr_name == "") with valid indices belong to the array we just created.
for (0..self.cond_count) |ci| {
    if (self.conds[ci].arr_name.len > 0) continue; // already bound
    if (self.conds[ci].true_idx < child_exprs.items.len) {
        self.conds[ci].arr_name = arr_name;
    }
}
```

**Why this works for now:** Each `parseJSXElement` call processes one element and its direct children. Conditions created during that call have indices relative to that element's `child_exprs`. The array is created immediately after, so unbound conditions map to the most recently created array.

**Where this breaks:** Deeply nested conditionals (conditional inside conditional) or conditionals split across imported components. Those are future problems — this task handles flat conditionals in a single component.

**After getting this working, manually inspect the generated Zig output** (`tsz/runtime/generated_app.zig`) to verify the array names and indices are correct. This is the most likely failure point.

## Step 4: Emit `updateConditionals`

In `emitZigSource`, after the `updateDynamicTexts` function (around line 1325), emit the toggle function:

```zig
if (self.cond_count > 0) {
    try out.appendSlice(self.alloc, "fn updateConditionals() void {\n");
    for (0..self.cond_count) |i| {
        const ci = self.conds[i];
        if (ci.arr_name.len == 0) continue; // unbound, skip
        switch (ci.kind) {
            .show_hide => {
                // && pattern: single element, show/hide
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}].style.display = if ({s} != 0) .flex else .none;\n",
                    .{ ci.arr_name, ci.true_idx, ci.condition }));
            },
            .ternary => {
                // ternary pattern: show one, hide other
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    if ({s} != 0) {{ {s}[{d}].style.display = .flex; {s}[{d}].style.display = .none; }}" ++
                    " else {{ {s}[{d}].style.display = .none; {s}[{d}].style.display = .flex; }}\n",
                    .{ ci.condition, ci.arr_name, ci.true_idx, ci.arr_name, ci.false_idx,
                       ci.arr_name, ci.true_idx, ci.arr_name, ci.false_idx }));
            },
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");
}
```

### Call updateConditionals

In the state dirty check (line 1424-1426), expand to include conditionals:

```zig
if (self.has_state) {
    var dirty_body: std.ArrayListUnmanaged(u8) = .{};
    try dirty_body.appendSlice(self.alloc, "        if (state.isDirty()) { ");
    if (self.dyn_count > 0) try dirty_body.appendSlice(self.alloc, "updateDynamicTexts(); ");
    if (self.cond_count > 0) try dirty_body.appendSlice(self.alloc, "updateConditionals(); ");
    try dirty_body.appendSlice(self.alloc, "state.clearDirty(); }\n");
    try out.appendSlice(self.alloc, dirty_body.items);
}
```

Also call at init time (after `updateDynamicTexts()` at line 1417):
```zig
if (self.cond_count > 0) try out.appendSlice(self.alloc, "    updateConditionals();\n");
```

## Step 5: Logical AND in JSX

The pattern `{condition && <Element/>}` is simpler — one element, show or hide.

### Detection

```zig
fn isLogicalAndAhead(self: *Generator) bool {
    var look = self.pos;
    var brace_depth: u32 = 0;
    var paren_depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) brace_depth += 1;
        if (kind == .rbrace) {
            if (brace_depth == 0) return false;
            brace_depth -= 1;
        }
        if (kind == .lparen) paren_depth += 1;
        if (kind == .rparen and paren_depth > 0) paren_depth -= 1;
        if (kind == .amp_amp and brace_depth == 0 and paren_depth == 0) return true;
        if (kind == .question and brace_depth == 0 and paren_depth == 0) return false; // ternary, not &&
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}
```

### Parse

```zig
fn parseLogicalAndJSX(self: *Generator) !struct { condition: []const u8, element: []const u8 } {
    // Parse condition using the real expression parser
    const condition = try self.emitStateExpr();

    // Expect && token
    if (self.curKind() != .amp_amp) {
        std.debug.print("[tsz] Expected '&&' at pos {d}\n", .{self.pos});
        return error.ExpectedLogicalAnd;
    }
    self.advance_token(); // skip &&

    // Skip optional ( around element
    if (self.curKind() == .lparen) self.advance_token();

    // Parse the element
    const element = try self.parseJSXElement();

    // Skip optional ) after element
    if (self.curKind() == .rparen) self.advance_token();

    return .{
        .condition = condition,
        .element = element,
    };
}
```

### Wire into children loop

Add the `&&` check **before** the ternary check (since `isLogicalAndAhead` returns false for ternaries, the order doesn't strictly matter, but checking `&&` first avoids unnecessary lookahead):

```zig
} else if (self.isLogicalAndAhead()) {
    const result = try self.parseLogicalAndJSX();
    try child_exprs.append(self.alloc, result.element);
    if (self.cond_count < MAX_CONDS) {
        self.conds[self.cond_count] = .{
            .kind = .show_hide,
            .condition = result.condition,
            .arr_name = "",
            .true_idx = @intCast(child_exprs.items.len - 1),
            .false_idx = @intCast(child_exprs.items.len - 1),
        };
        self.cond_count += 1;
    }
} else if (self.isTernaryAhead()) {
    // ... ternary handling ...
```

## Step 6: Test Example

Create `tsz/examples/conditional-test.tsz`:

```tsx
function App() {
  const [mode, setMode] = useState(0);
  const [show, setShow] = useState(1);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Mode: ${mode}`}</Text>

      <Pressable onPress={() => setMode(mode == 0 ? 1 : 0)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Toggle Mode</Text>
      </Pressable>

      <Pressable onPress={() => setShow(show == 0 ? 1 : 0)} style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Toggle Show</Text>
      </Pressable>

      {mode ? (
        <Box style={{ padding: 16, backgroundColor: '#2d5a3d', marginTop: 16 }}>
          <Text fontSize={18} color="#4ec9b0">Mode is ON</Text>
        </Box>
      ) : (
        <Box style={{ padding: 16, backgroundColor: '#5a2d2d', marginTop: 16 }}>
          <Text fontSize={18} color="#c586c0">Mode is OFF</Text>
        </Box>
      )}

      {show && (
        <Box style={{ padding: 16, backgroundColor: '#2d3d5a', marginTop: 8 }}>
          <Text fontSize={18} color="#569cd6">This is conditionally shown</Text>
        </Box>
      )}
    </Box>
  );
}
```

## Verification

**Do this incrementally, not all at once:**

### Phase 1: Ternary only
1. Implement Steps 1-4 (ternary parsing + display toggle)
2. Build: `zig build tsz-compiler`
3. Create a minimal test with just the ternary (no `&&` yet)
4. Compile: `./zig-out/bin/tsz build tsz/examples/conditional-test.tsz`
5. **Inspect `tsz/runtime/generated_app.zig`** — verify:
   - Both branches exist in the array
   - `updateConditionals()` function exists
   - Array name and indices match what you expect
6. Run the binary, toggle the mode button

### Phase 2: Logical AND
7. Add Step 5 (logical AND)
8. Rebuild compiler, recompile test
9. Inspect generated code again — verify the show/hide toggle
10. Run, test both buttons

### Phase 3: Edge cases
11. Try nested elements inside conditional branches
12. Try conditionals with multi-word conditions (if Agent 1's expression parser is merged)
13. Check that non-conditional siblings still render correctly

## What NOT to Touch

- Do not modify `lexer.zig` — Agent 1 owns that
- Do not modify `state.zig` — Agent 2 owns that
- Do not modify `collectStateHooks` (lines 373-422) — Agent 2 owns that
- Do not modify `emitStateExpr`/`emitStateAtom` (lines 1105-1163) — Agent 1 owns that (you CALL `emitStateExpr`, you don't modify it)
- Do not modify `emitHandlerExpr` (lines 1006-1103) — Agent 4 owns that
- Do not modify `events.zig`, `input.zig`, `main.zig` — Agent 4 owns those

## Token Dependencies

Your work needs `.question` and `.amp_amp` tokens. Agent 1 is adding these. If you're building before Agent 1's merge:
1. Add `question` and `amp_amp` to the `TokenKind` enum in `lexer.zig`
2. Add `'?' => .question` to the single-char switch
3. Add the `&&` multi-char check to `tokenize()`

Keep these changes minimal so they merge cleanly with Agent 1's full lexer overhaul.

## Known Limitations

These are NOT bugs — they're explicit scope boundaries:
- **No `.map()` / dynamic lists** — that needs its own plan (requires runtime array resizing or pre-allocated pools)
- **Nested conditionals** (conditional inside a conditional branch) may produce incorrect array bindings — test and fix if hit, but don't over-engineer for it
- **Condition must evaluate to integer for `!= 0` check** — boolean state will need `state.getSlotBool()` once Agent 2's typed state is merged

## Commit

After verification, commit with: `feat(tsz): add ternary and logical AND conditional rendering in JSX`
