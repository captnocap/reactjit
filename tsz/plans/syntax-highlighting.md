# Syntax Highlighting for tsz

## The 18-Hour Bug We're Not Repeating

In the Lua stack, a tokenizer loop exit used `i = len` instead of `i = len+1`. The outer loop (`while i <= len`) would re-enter, re-tokenize, accumulate token tables, and thrash the GC. It took 18 hours to find because it only leaked under specific code patterns that triggered the wrong exit path.

**Prevention in Zig:** We don't have this class of bug. Zig tokenizers use bounded `while` loops with explicit length checks. There's no GC — allocations are explicit. Token arrays are stack/arena allocated, not heap-grown Lua tables. The architectural advantage of Zig eliminates the entire bug category.

## What Lua Has

### `love2d/lua/syntax.lua` (~1,800 lines)

Hand-written tokenizers for 22 languages:
- JavaScript/TypeScript/JSX/TSX, Python, Lua, Bash, JSON, CSS/SCSS, HTML, Rust, Go, Ruby, PHP, C/C++, Java, Kotlin, Swift, **Zig**, SQL, GLSL, YAML, Markdown

Each language function: `tokenize<Lang>(line) → [{text, color}, ...]`

Color palette: Catppuccin Mocha (52 semantic colors) — reference: `syntax.lua:19-52`

### `love2d/lua/codeblock.lua` (~880 lines)

Rendering component that:
- Splits code into lines
- Tokenizes each line (cached per-node, weak-keyed)
- Renders tokens left-to-right with per-token color
- Churn detection: kills highlighting if >30 re-tokenizations/sec
- Horizontal scrollbar, copy button, text selection

### Rendering path (Lua)
```
code string → split lines → tokenize each line → for each token:
  love.graphics.setColor(token.color)
  love.graphics.print(token.text, x, y)
  x += font:getWidth(token.text)
```

## What tsz Has (Current Blocker)

`tsz/runtime/text.zig` renders text with a **single color per call**:
```zig
pub fn drawText(self: *TextEngine, text: []const u8, x: f32, y: f32, size_px: u16, color: Color) void
```

The glyph renderer already loops character-by-character internally — it just uses the same color for all of them. The fix is adding a function that accepts token spans.

## Implementation

### Phase 1: Multi-Color Text Rendering

**File:** `tsz/runtime/text.zig`

Add a new function that renders text with per-span coloring:

```zig
pub const ColorSpan = struct {
    text: []const u8,
    color: Color,
};

/// Render a sequence of colored text spans on a single line.
/// Each span picks up where the previous one left off (x advances).
pub fn drawColorSpans(self: *TextEngine, spans: []const ColorSpan, x: f32, y: f32, size_px: u16) void {
    var cx = x;
    for (spans) |span| {
        // Set color for this span
        // Render glyphs, advancing cx
        self.drawText(span.text, cx, y, size_px, span.color);
        // Advance x by measured width
        const m = self.measureText(span.text, size_px);
        cx += m.width;
    }
}
```

This is the minimum viable change — it reuses the existing `drawText` internally, just calls it per-span. The SDL_SetTextureColorMod call inside drawText already handles color switching between calls.

**Optimization (later):** Instead of calling `drawText` N times per line (N spans), the inner glyph loop could accept a span array directly and switch colors mid-loop. But the simple version works first.

### Phase 2: Tokenizer

**New file:** `tsz/runtime/syntax.zig`

Port the tokenizer from `love2d/lua/syntax.lua`. Start with **5 languages** that matter most for tsz users:

1. **Zig** — they're writing .tsz which compiles to Zig
2. **TypeScript/TSX** — the .tsz syntax IS TypeScript-like
3. **JSON** — config files, API responses
4. **Bash** — shell commands
5. **Markdown** — documentation

Each tokenizer is a function:
```zig
pub fn tokenizeLine(line: []const u8, lang: Language, out: []ColorSpan) usize
```

**Returns:** number of spans written to `out` buffer.

**Language enum:**
```zig
pub const Language = enum {
    zig, typescript, json, bash, markdown, plain,
};
```

**Token categories → colors (Catppuccin Mocha):**

```zig
const Colors = struct {
    keyword: Color = Color.rgb(203, 166, 247),   // mauve — const, let, fn, if, else, return
    string: Color = Color.rgb(166, 227, 161),    // green — "hello", 'world', `template`
    number: Color = Color.rgb(250, 179, 135),    // peach — 42, 3.14, 0xFF
    comment: Color = Color.rgb(108, 112, 134),   // overlay0 — // comment, /* block */
    function_name: Color = Color.rgb(137, 180, 250), // blue — function calls
    type_name: Color = Color.rgb(148, 226, 213), // teal — type names, capitalized
    operator: Color = Color.rgb(148, 226, 213),  // teal — +, -, =, ==, =>
    punctuation: Color = Color.rgb(147, 153, 178), // overlay2 — (), {}, [], ;
    text: Color = Color.rgb(205, 214, 244),      // text — default/identifier
    tag: Color = Color.rgb(137, 180, 250),       // blue — <Box>, </Text>
    attribute: Color = Color.rgb(250, 179, 135), // peach — style=, onClick=
    value: Color = Color.rgb(166, 227, 161),     // green — prop values
};
```

Reference: `love2d/lua/syntax.lua:19-52` (Catppuccin palette)

### Tokenizer approach

**Byte-by-byte scan with explicit state.** Same approach as Lua but without the GC pitfalls.

For each line:
1. Start at position 0
2. Check what the current byte is (letter, digit, quote, slash, etc.)
3. Consume a token (keyword, string, number, comment, identifier, operator)
4. Write to output span array with the appropriate color
5. Advance position past the token
6. Repeat until end of line

**Fixed output buffer:** `out: []ColorSpan` is caller-provided. Max 256 spans per line (more than enough — a 200-char line rarely has more than ~40 tokens). No allocation.

**Keyword lookup:** Small hash map or sorted array + binary search. For TypeScript:
```
const, let, var, function, return, if, else, for, while, switch, case, break,
continue, import, export, from, default, class, extends, new, this, typeof,
instanceof, in, of, async, await, try, catch, throw, finally, yield, true,
false, null, undefined, void, type, interface, enum, declare, readonly, as
```

Reference: `love2d/lua/syntax.lua` — each language tokenizer (JavaScript: ~lines 200-450, Python: ~lines 450-600, etc.)

### Phase 3: CodeBlock Primitive

**Compiler change:** `tsz/compiler/codegen.zig`

Add a `<CodeBlock>` primitive that the compiler recognizes:

```tsx
<CodeBlock language="typescript" fontSize={14}>{`
  const x = 42;
  function hello() {
    return "world";
  }
`}</CodeBlock>
```

The compiler emits a node with:
- `.text = "const x = 42;\nfunction hello() {\n  return \"world\";\n}"`
- A flag indicating it's a code block (needs syntax-highlighted rendering)

**How to flag it:** Add a field to the Node struct:

```zig
// In layout.zig Node struct:
code_language: ?syntax.Language = null,  // null = normal text, set = syntax highlighted
```

When `code_language` is set, the painter calls `syntax.tokenizeLine()` + `text.drawColorSpans()` instead of `text.drawText()`.

### Phase 4: Painter Integration

In the generated painter code (or `main.zig` template), when rendering a text node:

```zig
if (node.code_language) |lang| {
    // Syntax-highlighted rendering
    var spans: [256]syntax.ColorSpan = undefined;
    // Split text by newlines, render each line
    var line_y = screen_y + pad_t;
    var lines_iter = std.mem.splitScalar(u8, node.text.?, '\n');
    while (lines_iter.next()) |line| {
        const span_count = syntax.tokenizeLine(line, lang, &spans);
        text_engine.drawColorSpans(spans[0..span_count], screen_x + pad_l, line_y, node.font_size);
        line_y += @as(f32, @floatFromInt(node.font_size)) + 2; // line height
    }
} else {
    // Normal single-color text rendering (existing path)
    text_engine.drawTextWrapped(txt, ...);
}
```

Reference: `love2d/lua/codeblock.lua:666-671` (token rendering loop)

### Phase 5: Churn Protection

Reference: `love2d/lua/codeblock.lua:27-132` (churn detection, kill switch)

In Lua, code prop identity changes could cause re-tokenization every frame (React re-rendering creates new string references). The kill switch disables highlighting if >30 identity changes/sec with same content.

**In tsz this is less of a risk** because:
- Node tree is static (no React reconciliation)
- Text content only changes via state (not re-created each frame)
- No GC — token arrays are stack-allocated

But if dynamic code display is added (e.g., showing live generated code), add a simple guard:
```zig
var last_tokenized_hash: u64 = 0;
// Only re-tokenize if content hash changed
const hash = std.hash.Wyhash.hash(0, text);
if (hash != last_tokenized_hash) {
    last_tokenized_hash = hash;
    // tokenize...
}
```

## Files

| File | Change |
|------|--------|
| `tsz/runtime/text.zig` | Add `ColorSpan` struct + `drawColorSpans()` function |
| `tsz/runtime/syntax.zig` | **New** — tokenizers for 5 languages, color palette |
| `tsz/runtime/layout.zig` | Add `code_language: ?Language` to Node struct |
| `tsz/compiler/codegen.zig` | Recognize `<CodeBlock>` tag, set `code_language` field |
| Painter (template or generated) | Branch on `code_language` for syntax-highlighted vs normal rendering |

## Implementation Order

1. `drawColorSpans` in text.zig — enables multi-color text
2. Tokenizer for TypeScript/TSX in syntax.zig — the primary use case
3. `code_language` field in Node + painter branch — wires it through
4. `<CodeBlock>` in compiler — user-facing primitive
5. Additional language tokenizers (Zig, JSON, Bash, Markdown)
6. Churn protection (if needed)

## Agent Split

| Agent | Phases | Files |
|-------|--------|-------|
| A | 1-2 | text.zig (drawColorSpans), syntax.zig (tokenizers) |
| B | 3-4 | layout.zig (Node field), codegen.zig (CodeBlock tag), painter integration |

A runs first. B follows.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/codeblock-test.tsz
```

Example .tsz:
```tsx
function App() {
  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={20} color="#ffffff">Syntax Highlighting Demo</Text>
      <CodeBlock language="typescript" fontSize={14}>{`
const greeting = "Hello, world!";

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// This should be gray
console.log(greeting);
      `}</CodeBlock>
    </Box>
  );
}
```

Expected: keywords in purple, strings in green, numbers in peach, comments in gray, functions in blue. All rendered natively at 60fps with zero allocation per frame.

## Why This Won't Leak

The Lua leak happened because:
1. Lua tables grow dynamically (each `tokens[#tokens+1] = ...` can trigger realloc)
2. Token tables were recreated every frame if the cache miss logic was wrong
3. LuaJIT's GC doesn't immediately free dead tables — they pile up

In Zig:
1. `spans: [256]ColorSpan` is stack-allocated — freed when the function returns
2. No dynamic growth — fixed buffer, write index, bounds check
3. No GC — memory is deterministic
4. Re-tokenization only happens if content hash changes

The entire bug category doesn't exist in this architecture.
