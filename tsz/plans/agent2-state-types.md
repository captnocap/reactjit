# Agent 2: State System — String State + Proper Type Detection

## What This Is

tsz is a compiler that takes `.tsz` files (React-like syntax) and compiles them to native Zig binaries. The compiler is in `tsz/compiler/`, the runtime is in `tsz/runtime/`. You're working on **both** — the state runtime and the compiler's state detection.

## Your Mission

Currently `useState()` only supports integer initial values. `useState("")` (string), `useState(true)` (boolean), and `useState(0.5)` (float) are all silently treated as `useState(0)`. You need to:

1. Add string support to the runtime state system
2. Make the compiler detect the type of the initial value
3. Emit the correct typed slot creation calls
4. Make template literals format state values according to their type

**Other agents are working on other parts of codegen.zig in parallel.** Your changes should be confined to:
- `tsz/runtime/state.zig` (full ownership)
- `tsz/compiler/codegen.zig`:
  - `StateSlot` struct (lines 31-35)
  - `collectStateHooks` (lines 373-422)
  - `parseTemplateLiteral` (lines 931-985) — type-aware formatting
  - State init emission in `emitZigSource` (lines 1398-1406)
  - A `stateType()` lookup helper near `isState()`/`isSetter()` (lines 159-171)
- A new test example `tsz/examples/string-state-test.tsz`

## Important Constraints

- **Do not modify `emitStateExpr` or `emitStateAtom`** (lines 1105-1163) — Agent 1 owns those. You expose metadata (`stateType()` helper) that Agent 1 can use later.
- **Do not modify `emitHandlerExpr`** (lines 1006-1103) — Agent 4 owns that. Typed getter/setter wiring into handlers is a future task, not this one.
- **Do not modify the JSX children loop** (lines 558-604) — Agent 3 owns that.
- **Do not modify `lexer.zig`** — Agent 1 owns that.
- **Do not modify `events.zig`, `input.zig`, or `main.zig`** — Agent 4 owns those.
- **String state is fixed-capacity.** Max 256 bytes per slot. Truncation is allowed. Strings are UTF-8 byte sequences, not grapheme-aware. No heap allocation.
- **Preserve current simple string literal handling.** Do not implement full escape decoding in this task. Quote stripping (`raw[1..raw.len-1]`) is adequate for now.
- **State persistence format change invalidates existing state files.** This is acceptable — `/tmp/tsz-state.bin` is ephemeral. Document that saved state from previous versions will be ignored after this change.

## Step 1: Runtime — Add String State

File: `tsz/runtime/state.zig`

### Current Value union (lines 17-21):
```zig
pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
};
```

### Add string variant:

```zig
const STRING_BUF_SIZE = 256;

pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
    string: struct {
        buf: [STRING_BUF_SIZE]u8,
        len: u8, // max 256, u8 is sufficient
    },
};
```

### Add string slot functions:

```zig
/// Allocate a new state slot with an initial string value.
pub fn createSlotString(initial: []const u8) usize {
    const id = slot_count;
    std.debug.assert(id < MAX_SLOTS);
    var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
    const copy_len: u8 = @intCast(@min(initial.len, STRING_BUF_SIZE));
    @memcpy(str_val.string.buf[0..copy_len], initial[0..copy_len]);
    str_val.string.len = copy_len;
    slots[id] = .{ .value = str_val, .dirty = false };
    slot_count += 1;
    return id;
}

/// Read a string state value. Only valid for string-type slots.
/// Returns empty string for non-string slots — does NOT format other types as strings.
pub fn getSlotString(id: usize) []const u8 {
    return switch (slots[id].value) {
        .string => |s| s.buf[0..s.len],
        else => "",
    };
}

/// Set a string state value. Marks dirty if changed.
pub fn setSlotString(id: usize, val: []const u8) void {
    const current = getSlotString(id);
    if (!std.mem.eql(u8, current, val)) {
        var str_val: Value = .{ .string = .{ .buf = [_]u8{0} ** STRING_BUF_SIZE, .len = 0 } };
        const copy_len: u8 = @intCast(@min(val.len, STRING_BUF_SIZE));
        @memcpy(str_val.string.buf[0..copy_len], val[0..copy_len]);
        str_val.string.len = copy_len;
        slots[id].value = str_val;
        slots[id].dirty = true;
        _dirty = true;
    }
}
```

**Critical: `getSlotString` must NOT format non-string types into stack-local buffers and return slices to them.** That would be returning a dangling pointer — instant UB. If the slot isn't a string, return `""`. Type-to-string conversion belongs at template formatting time, not in the getter.

### Update `saveState` and `loadState`:

The current save/load only handles i64. Add a type tag byte.

**`saveState`:** For each slot, write 1 byte for the type tag (0=int, 1=float, 2=bool, 3=string), then the value data:
- int: 8 bytes (i64)
- float: 8 bytes (f64)
- bool: 1 byte
- string: 1 byte length + N bytes content

**`loadState`:** Read the type byte, restore the correct type. If the file format doesn't match (e.g., stale file from before this change), the read will fail gracefully and return false — existing behavior handles this via `catch return false`.

**Note:** This is a breaking change to the state file format. Previous state files will be silently ignored (read fails, returns false, app starts with fresh state). This is acceptable.

## Step 2: Compiler — State Type Detection

File: `tsz/compiler/codegen.zig`

### Update StateSlot struct (lines 31-35):

Use a tagged union for the initial value — cleaner and harder to misuse than separate fields:

```zig
const StateType = enum { int, float, boolean, string };

const StateInitial = union(StateType) {
    int: i64,
    float: f64,
    boolean: bool,
    string: []const u8,
};

const StateSlot = struct {
    getter: []const u8,
    setter: []const u8,
    initial: StateInitial,
};
```

### Add type lookup helper (near lines 159-171):

This exposes type metadata so other agents can use it later without touching your code:

```zig
fn stateType(self: *Generator, name: []const u8) ?StateType {
    for (0..self.state_count) |i| {
        if (std.mem.eql(u8, self.state_slots[i].getter, name)) return self.state_slots[i].initial;
    }
    return null;
}
```

Wait — `stateType` should return the `StateType` enum, not the union. Use the active tag:

```zig
fn stateType(self: *Generator, name: []const u8) ?StateType {
    for (0..self.state_count) |i| {
        if (std.mem.eql(u8, self.state_slots[i].getter, name)) return std.meta.activeTag(self.state_slots[i].initial);
    }
    return null;
}

fn stateTypeById(self: *Generator, slot_id: u32) StateType {
    return std.meta.activeTag(self.state_slots[slot_id].initial);
}
```

### Update collectStateHooks (lines 373-422):

Currently at line 397-401, it only parses integer:
```zig
var initial: i64 = 0;
if (self.curKind() == .number) {
    initial = std.fmt.parseInt(i64, self.curText(), 10) catch 0;
    self.advance_token();
}
```

Replace with type-detecting logic:
```zig
var initial: StateInitial = .{ .int = 0 };

if (self.curKind() == .number) {
    const num_text = self.curText();
    // Check if float (contains '.')
    if (std.mem.indexOf(u8, num_text, ".") != null) {
        initial = .{ .float = std.fmt.parseFloat(f64, num_text) catch 0.0 };
    } else {
        initial = .{ .int = std.fmt.parseInt(i64, num_text, 10) catch 0 };
    }
    self.advance_token();
} else if (self.curKind() == .string) {
    // useState("hello") or useState('')
    // Simple quote stripping — no full escape decode in this task
    const raw = self.curText();
    initial = .{ .string = raw[1 .. raw.len - 1] };
    self.advance_token();
} else if (self.curKind() == .identifier) {
    const val = self.curText();
    if (std.mem.eql(u8, val, "true")) {
        initial = .{ .boolean = true };
        self.advance_token();
    } else if (std.mem.eql(u8, val, "false")) {
        initial = .{ .boolean = false };
        self.advance_token();
    }
}
```

Then update the slot storage:
```zig
self.state_slots[self.state_count] = .{
    .getter = getter,
    .setter = setter,
    .initial = initial,
};
```

### Update state init emission in emitZigSource (lines 1398-1406):

Currently at line 1401:
```zig
try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
    "    _ = state.createSlot({d});\n", .{self.state_slots[i].initial}));
```

Replace with type-aware emission:
```zig
for (0..self.state_count) |i| {
    const slot = self.state_slots[i];
    switch (slot.initial) {
        .int => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlot({d});\n", .{v})),
        .float => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotFloat({d});\n", .{v})),
        .boolean => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotBool({});\n", .{v})),
        .string => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _ = state.createSlotString(\"{s}\");\n", .{v})),
    }
}
```

### Update template literal rendering for typed state

In `parseTemplateLiteral` (lines 931-985), when a state variable appears in `${name}`, it currently emits `state.getSlot({id})` with `{d}` format. For typed state, use the correct getter and format specifier.

At line 961-965:
```zig
if (self.isState(expr)) |slot_id| {
    try fmt.appendSlice(self.alloc, "{d}");
    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
    const arg = try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{slot_id});
    try args.appendSlice(self.alloc, arg);
}
```

Replace with type-aware version:
```zig
if (self.isState(expr)) |slot_id| {
    const st = self.stateTypeById(slot_id);
    switch (st) {
        .string => {
            try fmt.appendSlice(self.alloc, "{s}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "state.getSlotString({d})", .{slot_id}));
        },
        .float => {
            try fmt.appendSlice(self.alloc, "{d}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "state.getSlotFloat({d})", .{slot_id}));
        },
        .boolean => {
            try fmt.appendSlice(self.alloc, "{s}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "if (state.getSlotBool({d})) \"true\" else \"false\"", .{slot_id}));
        },
        .int => {
            try fmt.appendSlice(self.alloc, "{d}");
            if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
            try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "state.getSlot({d})", .{slot_id}));
        },
    }
}
```

**Note on float formatting:** `{d}` is used (Zig's default numeric format), not `{d:.2}`. Display precision is a formatting policy decision, not a type system concern. If fixed decimal display is wanted later, that's a separate feature.

## Step 3: Test Example

Create `tsz/examples/string-state-test.tsz`:

```tsx
function App() {
  const [name, setName] = useState("World");
  const [count, setCount] = useState(0);
  const [pi, setPi] = useState(3.14);
  const [active, setActive] = useState(true);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Hello, ${name}!`}</Text>
      <Text fontSize={18} color="#888888">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888888">{`Pi: ${pi}`}</Text>
      <Text fontSize={18} color="#888888">{`Active: ${active}`}</Text>

      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

This tests: string state display in template literal, integer state, float state, boolean state display. All four types should render correctly with their appropriate format.

## Verification

```bash
cd /home/siah/creative/reactjit
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/string-state-test.tsz
```

Check the generated code in `tsz/runtime/generated_app.zig` — verify it uses:
- `state.createSlotString("World")` for the name slot
- `state.createSlot(0)` for the count slot
- `state.createSlotFloat(...)` for the pi slot
- `state.createSlotBool(true)` for the active slot
- Template formatting uses `getSlotString`, `getSlot`, `getSlotFloat`, `getSlotBool` respectively

Run the binary to confirm all four values display correctly.

## What This Plan Does NOT Do

These are explicitly deferred — not forgotten, just not in scope:
- **Typed getter/setter in expression parser** — Agent 1 owns `emitStateAtom`. The `stateType()`/`stateTypeById()` helpers exist for Agent 1 to use later.
- **Typed setter in handler emission** — Agent 4 owns `emitHandlerExpr`. Handlers currently use `state.setSlot()` (integer). Wiring typed setters into handlers is a follow-up task.
- **Full string escape decoding** — quote stripping is adequate for now.
- **String operations in expressions** — concatenation, `.length`, etc. are future work.
- **Rich float formatting** — `{d}` default format, no fixed precision.

## Commit

After verification, commit with: `feat(tsz): add typed state (string/float/bool) with detection and template formatting`
