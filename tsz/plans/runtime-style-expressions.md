# Runtime Style Expressions

## The Problem

All style values in tsz are **compile-time constants**:
```zig
.style = .{ .width = 100, .background_color = Color.rgb(78, 201, 176) }
```

Users write `style={{ width: count * 10 }}` expecting it to update when `count` changes. Currently it bakes `count`'s initial value and never updates. This breaks:
- Conditional colors: `backgroundColor: isActive ? '#4ec9b0' : '#2d2d3d'`
- Computed dimensions: `width: count * 20`
- State-driven opacity: `opacity: isVisible ? 1.0 : 0.0`
- Dynamic padding/margin based on state

## How Love2D Solves It

React evaluates expressions every render. When state changes, React re-renders, evaluates new style values, sends UPDATE commands to `tree.lua` which merges them into `node.style` in-place.

Reference: `love2d/lua/tree.lua:200-245` (UPDATE command applies style diff)

tsz has no React. The tree is static. But we already have the pattern for runtime updates — **`updateDynamicTexts()`** does exactly this for text content. Style expressions need the same approach.

## Design: `updateDynamicStyles()`

Same pattern as dynamic text. The compiler detects style values that reference state, emits them as runtime expressions that update node style fields when state changes.

### What the user writes

```tsx
function App() {
  const [active, setActive] = useState(0);
  const [size, setSize] = useState(100);

  return (
    <Box style={{
      width: size,
      backgroundColor: active ? '#4ec9b0' : '#2d2d3d',
      opacity: active ? 1.0 : 0.5,
      padding: size / 10,
    }}>
      <Text fontSize={24} color="#ffffff">{`Size: ${size}`}</Text>
    </Box>
  );
}
```

### What the compiler generates

```zig
var _arr_0 = [_]Node{ .{ .text = "", .font_size = 24, .text_color = Color.rgb(255, 255, 255) } };
var root = Node{
    // Static defaults (initial values)
    .style = .{ .width = 100, .background_color = Color.rgb(78, 201, 176), .opacity = 1.0, .padding = 10 },
    .children = &_arr_0,
};

fn updateDynamicStyles() void {
    // width = size (state slot 1)
    root.style.width = @floatFromInt(state.getSlot(1));
    // backgroundColor = active ? '#4ec9b0' : '#2d2d3d'
    root.style.background_color = if (state.getSlot(0) != 0)
        Color.rgb(78, 201, 176) else Color.rgb(45, 45, 61);
    // opacity = active ? 1.0 : 0.5
    root.style.opacity = if (state.getSlot(0) != 0) 1.0 else 0.5;
    // padding = size / 10
    root.style.padding = @floatFromInt(@divTrunc(state.getSlot(1), 10));
}
```

Called in the main loop alongside existing update functions:
```zig
if (state.isDirty()) {
    updateDynamicTexts();
    updateDynamicStyles();   // ← new
    updateConditionals();
    // watch effects...
    state.clearDirty();
}
```

## Implementation

### Step 1: Detect Dynamic Style Values

**File: `tsz/compiler/codegen.zig` — `parseStyleAttr()`**

Currently, style values are parsed as literals only. The parser needs to detect when a value references state:

```zig
// Current: only handles literals
if (mapStyleKey(key)) |zig_key| {
    const val = self.curText();  // literal number
    self.advance_token();
    // emit static: .width = 100
}

// New: check if value is a state variable or expression
if (mapStyleKey(key)) |zig_key| {
    if (self.isStateDependentValue()) {
        // Parse expression using emitStateExpr()
        const expr = try self.emitStateExpr();
        // Record as dynamic style for updateDynamicStyles()
        self.recordDynamicStyle(node_path, zig_key, expr);
        // Still emit initial value for the static struct
        // (use initial state value)
    } else {
        // Existing: static literal
    }
}
```

### Detection: Is a value state-dependent?

A style value is dynamic if it contains:
- A state getter name (`count`, `active`, etc.)
- A ternary expression referencing state
- An arithmetic expression referencing state

Check by scanning the value tokens: if any identifier is a state getter (via `isState()`), the value is dynamic.

```zig
fn isStateDependentValue(self: *Generator) bool {
    // Lookahead: scan tokens until comma, rbrace, or end of value
    var look = self.pos;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .comma or kind == .rbrace) break;
        if (kind == .identifier) {
            const name = self.lex.get(look).text(self.source);
            if (self.isState(name) != null) return true;
        }
        look += 1;
    }
    return false;
}
```

### Step 2: Track Dynamic Styles

Add to Generator struct:

```zig
const MAX_DYN_STYLES = 64;

const DynStyle = struct {
    node_path: []const u8,     // e.g., "root" or "_arr_0[1]"
    field: []const u8,          // e.g., "width" or "background_color"
    expression: []const u8,     // e.g., "@floatFromInt(state.getSlot(1))"
    is_color: bool,             // needs Color.rgb() wrapping
};

dyn_styles: [MAX_DYN_STYLES]DynStyle,
dyn_style_count: u32,
```

### Step 3: Parse Color Expressions

For `backgroundColor: active ? '#4ec9b0' : '#2d2d3d'`, the compiler needs to:
1. Detect ternary with string operands
2. Parse both color values to `Color.rgb(...)`
3. Emit: `if (state.getSlot(0) != 0) Color.rgb(78, 201, 176) else Color.rgb(45, 45, 61)`

```zig
fn parseDynamicColorValue(self: *Generator) ![]const u8 {
    // Parse the expression — it may be:
    // - A ternary: condition ? '#color1' : '#color2'
    // - A state variable holding a color index
    const expr = try self.emitStateExpr();

    // If the expression is a ternary with string branches, resolve colors
    // The expression parser already handles ternary → if/else
    // We need to detect color strings in the if/else branches
    // and convert them to Color.rgb() calls

    return expr;
}
```

### Step 4: Emit `updateDynamicStyles()`

In `emitZigSource()`, after `updateDynamicTexts`:

```zig
if (self.dyn_style_count > 0) {
    try out.appendSlice(self.alloc, "fn updateDynamicStyles() void {\n");
    for (0..self.dyn_style_count) |i| {
        const ds = self.dyn_styles[i];
        if (ds.is_color) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}.style.{s} = {s};\n",
                .{ ds.node_path, ds.field, ds.expression }));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}.style.{s} = {s};\n",
                .{ ds.node_path, ds.field, ds.expression }));
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");
}
```

### Step 5: Wire Into Loop

In the dirty check block:
```zig
if (state.isDirty()) {
    updateDynamicTexts();
    if (self.dyn_style_count > 0) try out.appendSlice(self.alloc, "updateDynamicStyles(); ");
    updateConditionals();
    state.clearDirty();
}
```

Also call at init time (after state creation) to set initial values.

### Step 6: Node Path Tracking

The trickiest part: `updateDynamicStyles()` needs to know WHICH node to update. Nodes live in arrays (`_arr_0[2]`, `root`, etc.). The compiler needs to track the "path" to each node during JSX parsing.

During `parseJSXElement()`, maintain a path stack:
- Root element → `"root"`
- First child of root → `"_arr_0[0]"`
- Second child → `"_arr_0[1]"`
- Nested child → `"_arr_1[0]"` (using the array name from array construction)

The dynamic style records this path so `updateDynamicStyles()` can emit:
```zig
root.style.width = ...;         // root node
_arr_0[1].style.padding = ...;  // second child of root
```

## Supported Expression Types in Style Values

| Style Expression | Generated Zig |
|-----------------|---------------|
| `width: count * 20` | `.width = @floatFromInt(state.getSlot(0) * 20)` |
| `opacity: active ? 1.0 : 0.5` | `.opacity = if (state.getSlot(1) != 0) 1.0 else 0.5` |
| `backgroundColor: active ? '#4ec9b0' : '#2d2d3d'` | `.background_color = if (...) Color.rgb(78,201,176) else Color.rgb(45,45,61)` |
| `padding: size / 10` | `.padding = @floatFromInt(@divTrunc(state.getSlot(1), 10))` |
| `height: 100` (static) | `.height = 100` (no dynamic entry, same as today) |

## Files

| File | Change |
|------|--------|
| `tsz/compiler/codegen.zig` | `isStateDependentValue()`, `recordDynamicStyle()`, emit `updateDynamicStyles()` |
| No runtime changes needed | Style struct fields already exist and are mutable (`var` nodes) |

**Key insight: no runtime file changes.** Node structs are already `var` (mutable). The layout engine already reads `.style` each frame. We just need the compiler to emit code that WRITES to those style fields when state changes — same pattern as `updateDynamicTexts()`.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/dynamic-style-test.tsz
```

Example:
```tsx
function App() {
  const [active, setActive] = useState(0);
  const [size, setSize] = useState(200);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Box style={{
        width: size,
        height: size,
        backgroundColor: active ? '#4ec9b0' : '#569cd6',
        opacity: active ? 1.0 : 0.5,
        borderRadius: size / 10,
      }}>
        <Text fontSize={18} color="#ffffff">{`${size}x${size}`}</Text>
      </Box>

      <Pressable onPress={() => setActive(active == 0 ? 1 : 0)} style={{ padding: 12, backgroundColor: '#333', marginTop: 8 }}>
        <Text fontSize={14} color="#ffffff">Toggle Active</Text>
      </Pressable>

      <Pressable onPress={() => setSize(size + 50)} style={{ padding: 12, backgroundColor: '#333', marginTop: 4 }}>
        <Text fontSize={14} color="#ffffff">Grow</Text>
      </Pressable>
    </Box>
  );
}
```

Expected: Box starts 200x200 blue at 50% opacity. Click "Toggle Active" → turns green at 100% opacity. Click "Grow" → box grows by 50px, borderRadius scales proportionally.
