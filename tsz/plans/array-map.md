# Dynamic Lists (.map) for tsz

## Why This Is a Blocker

The devtools plan needs `.map()` for:
- **Sparkline**: 120 `<Box>` elements from a frame history array
- **Wireframe**: N `<Box>` elements from the node tree
- **Elements tab**: N `<Text>` lines from the tree hierarchy
- **Any list UI**: todo lists, chat messages, search results, feeds

Without `.map()`, you can't render a variable number of children.

## The Problem

The node tree is **static** — compiled to fixed `[_]Node{...}` arrays:
```zig
var _arr_0 = [_]Node{ .{ .text = "Item 1" }, .{ .text = "Item 2" } };
var root = Node{ .children = &_arr_0 };
```

`.map()` needs a **runtime-variable** number of children. But the layout engine already supports this — `children: []Node` is a slice, not a fixed array. We just need a pre-allocated pool that the map function fills each frame.

## What the User Writes

```tsx
function App() {
  const [items, setItems] = useState([1, 2, 3]);

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {items.map((item, index) => (
        <Box key={index} style={{ padding: 8, backgroundColor: '#2d2d3d', marginTop: 4 }}>
          <Text fontSize={14} color="#ffffff">{`Item ${item}`}</Text>
        </Box>
      ))}
    </Box>
  );
}
```

## Design: Pre-Allocated Node Pool

### The approach

At compile time, allocate a fixed-size pool of Nodes for each `.map()` call. At runtime, a rebuild function fills the pool based on current state and updates the parent's `children` slice to point at the filled portion.

```
Compile time:
  var _map_pool_0: [MAX_MAP_ITEMS]Node = undefined;  // pre-allocated
  var _map_count_0: usize = 0;                       // how many are active

Runtime (each frame when state is dirty):
  rebuildMap0() {
    _map_count_0 = 0;
    for each item in state array:
      _map_pool_0[_map_count_0] = Node{ ... item-specific fields ... };
      _map_count_0 += 1;
    parent_arr[map_child_index].children = _map_pool_0[0.._map_count_0];
  }
```

The parent node's `.children` slice is updated to point at `_map_pool_0[0.._map_count_0]`. Layout sees the correct number of children. Paint renders them. No dynamic allocation.

### Pool size

`MAX_MAP_ITEMS = 256` per map call. If a list has more than 256 items, it should be in a ScrollView with virtualization (future work). 256 is enough for any devtools tab.

## Implementation

### Step 1: Array State

**Prerequisite:** `useState([1, 2, 3])` needs array state support.

Add to `tsz/runtime/state.zig`:

```zig
const MAX_ARRAY_LEN = 256;
const MAX_ARRAY_SLOTS = 16;

pub const ArraySlot = struct {
    values: [MAX_ARRAY_LEN]i64,
    count: usize,
    dirty: bool,
};

var array_slots: [MAX_ARRAY_SLOTS]ArraySlot = undefined;
var array_slot_count: usize = 0;

pub fn createArraySlot(initial: []const i64) usize;
pub fn getArraySlot(id: usize) []const i64;  // returns values[0..count]
pub fn setArraySlot(id: usize, values: []const i64) void;
pub fn pushArraySlot(id: usize, value: i64) void;
pub fn getArrayLen(id: usize) usize;
```

The compiler detects `useState([1, 2, 3])` — array literal initializer:
- Token pattern: `useState` `(` `[` number `,` number ... `]` `)`
- Creates an array slot instead of a scalar slot

### Step 2: Compiler — Detect .map() in JSX

In the JSX children loop (codegen.zig, around line 1020), detect the `.map()` pattern:

```
{ identifier . map ( ( params ) => <JSXElement> ) }
```

Token sequence:
1. `{` (lbrace)
2. identifier (state getter name — e.g., `items`)
3. `.` (dot)
4. `map` (identifier)
5. `(` (lparen)
6. `(` params — `(item)` or `(item, index)`
7. `)` `=>` arrow function
8. JSX element (the template for each item)
9. `)` rparen closing map
10. `}` rbrace

### Detection helper

```zig
fn isMapAhead(self: *Generator) bool {
    var look = self.pos;
    // Check: identifier . map (
    if (self.lex.get(look).kind != .identifier) return false;
    look += 1;
    if (self.lex.get(look).kind != .dot) return false;
    look += 1;
    const map_tok = self.lex.get(look);
    if (map_tok.kind != .identifier) return false;
    if (!std.mem.eql(u8, map_tok.text(self.source), "map")) return false;
    return true;
}
```

### Step 3: Parse .map() and emit pool + rebuild function

When `.map()` is detected:

```zig
fn parseMapExpression(self: *Generator) !MapResult {
    // 1. Get the array state variable
    const array_name = self.curText();  // e.g., "items"
    const array_slot = self.isArrayState(array_name) orelse return error.NotArrayState;
    self.advance_token(); // identifier
    self.advance_token(); // .
    self.advance_token(); // map
    self.advance_token(); // (

    // 2. Parse callback params: (item) or (item, index)
    self.advance_token(); // (
    const item_param = self.curText();
    self.advance_token(); // item
    var index_param: ?[]const u8 = null;
    if (self.curKind() == .comma) {
        self.advance_token(); // ,
        index_param = self.curText();
        self.advance_token(); // index
    }
    self.advance_token(); // )
    self.advance_token(); // =>

    // 3. Parse the JSX template (with item_param as a substitution variable)
    // The template references `item` and `index` — these need to be
    // resolved at rebuild time, not compile time
    const template_start = self.pos;
    // Skip optional ( around JSX
    if (self.curKind() == .lparen) self.advance_token();
    const template = try self.parseJSXElement();
    if (self.curKind() == .rparen) self.advance_token();
    const template_end = self.pos;

    self.advance_token(); // ) closing map

    return .{
        .array_slot = array_slot,
        .item_param = item_param,
        .index_param = index_param,
        .template = template,
        .template_start = template_start,
        .template_end = template_end,
    };
}
```

### Step 4: Emit pool and rebuild function

For each `.map()` call, emit:

```zig
// Pool
const MAX_MAP_0 = 256;
var _map_pool_0: [MAX_MAP_0]Node = [_]Node{.{}} ** MAX_MAP_0;
var _map_inner_0: [MAX_MAP_0][4]Node = undefined;  // inner children per item (if template has children)
var _map_count_0: usize = 0;

// Rebuild function
fn _rebuildMap0() void {
    const items = state.getArraySlot(0);  // the array
    _map_count_0 = @min(items.len, MAX_MAP_0);
    for (0.._map_count_0) |i| {
        const item = items[i];
        // Build node from template, substituting `item` and `index`
        _map_pool_0[i] = .{
            .style = .{ .padding = 8, .background_color = Color.rgb(45, 45, 61), .margin_top = 4 },
            .children = &_map_inner_0[i],
        };
        // Dynamic text with item value
        var buf: [64]u8 = undefined;
        const text = std.fmt.bufPrint(&buf, "Item {d}", .{item}) catch "";
        _map_inner_0[i][0] = .{ .text = text, .font_size = 14, .text_color = Color.rgb(255, 255, 255) };
    }
    // Update parent's children slice
    _arr_root[MAP_CHILD_INDEX].children = _map_pool_0[0.._map_count_0];
}
```

### Step 5: Wire rebuild into the main loop

Call `_rebuildMap0()` when the array state changes:

```zig
if (state.isDirty()) {
    updateDynamicTexts();
    updateConditionals();
    _rebuildMap0();  // rebuild mapped children
    // watch effects...
    state.clearDirty();
}
```

Also call at init time (after state creation).

### Step 6: Text in map items

The trickiest part: template literals inside `.map()` reference `item` which is a loop variable, not a state slot. The dynamic text system needs to handle per-item formatting.

**Approach:** Each map item gets its own text buffer. Pre-allocate `MAX_MAP_0` text buffers:

```zig
var _map_text_bufs_0: [MAX_MAP_0][256]u8 = undefined;
var _map_texts_0: [MAX_MAP_0][]const u8 = [_][]const u8{""} ** MAX_MAP_0;
```

In the rebuild function:
```zig
_map_texts_0[i] = std.fmt.bufPrint(&_map_text_bufs_0[i], "Item {d}", .{item}) catch "";
_map_inner_0[i][0].text = _map_texts_0[i];
```

## Simpler Alternative: Range-Based Map

For devtools specifically, the data source isn't always a state array — it might be telemetry data or node tree introspection. A simpler pattern:

```tsx
// Instead of items.map(), support a range:
{range(0, 120).map(i => (
  <Box style={{ width: 2, height: getFrameHeight(i), backgroundColor: getFrameColor(i) }} />
))}
```

Where `range(0, N)` is a built-in that generates indices, and `getFrameHeight`/`getFrameColor` are built-in telemetry getters.

This avoids the need for array state entirely for the devtools case.

## Files

| File | Change |
|------|--------|
| `tsz/runtime/state.zig` | Add `ArraySlot` type, `createArraySlot`, `getArraySlot`, `pushArraySlot` |
| `tsz/compiler/codegen.zig` | Detect `.map()` in JSX children, parse template, emit pool + rebuild function |
| `tsz/compiler/codegen.zig` | Detect `useState([...])` array initializer |
| `tsz/compiler/codegen.zig` | Emit rebuild calls in main loop dirty check |

## Dependencies

- **Conditional rendering** — already landed (display toggle pattern)
- **useEffect** — already landed (rebuild on dirty)
- **Expressions** — already landed (index arithmetic in templates)

## Implementation Order

1. **Array state** in `state.zig` — createArraySlot, getArraySlot, setArraySlot, pushArraySlot
2. **Array initializer detection** in codegen — `useState([1, 2, 3])` → array slot
3. **`.map()` detection** in JSX children — isMapAhead, parseMapExpression
4. **Pool + rebuild emission** — pre-allocated node pool, rebuild function, wire into dirty check
5. **Per-item text buffers** — dynamic text inside map templates
6. **`range()` built-in** — for index-based iteration without state arrays

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/map-test.tsz
```

Example:
```tsx
function App() {
  const [items, setItems] = useState([1, 2, 3, 4, 5]);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={20} color="#ffffff">Dynamic List</Text>
      <Pressable onPress={() => pushItem(items.length + 1)} style={{ padding: 12, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={14} color="#ffffff">Add Item</Text>
      </Pressable>
      <ScrollView style={{ flexGrow: 1, marginTop: 8 }}>
        {items.map((item, index) => (
          <Box style={{ padding: 8, backgroundColor: '#2d2d3d', marginTop: 4, borderRadius: 4 }}>
            <Text fontSize={14} color="#ffffff">{`Item #${index}: value ${item}`}</Text>
          </Box>
        ))}
      </ScrollView>
    </Box>
  );
}
```

Expected: List starts with 5 items. Click "Add Item" → new item appears at bottom. All rendered dynamically from array state.
