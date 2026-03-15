# Typed Object/Record State

## The Problem

State is limited to scalars (int, float, bool, string) and flat arrays. No structured data:

```tsx
// CAN'T DO THIS
const [user, setUser] = useState({ name: "Alice", age: 30, active: true });
<Text>{`Hello, ${user.name}!`}</Text>
<Pressable onPress={() => setUser({ ...user, age: user.age + 1 })}>
```

This blocks: forms, settings, API responses, any multi-field data structure.

## Design: Compile-Time Field Flattening

Objects in .tsz compile to **multiple scalar state slots** — one per field. No runtime
object representation needed. The compiler sees the shape at compile time and expands it.

### What the user writes

```tsx
const [user, setUser] = useState({ name: "Alice", age: 30, active: true });
```

### What the compiler emits

```zig
// "user" becomes 3 separate slots:
_ = state.createSlotString("Alice");   // slot N   → user.name
_ = state.createSlot(30);              // slot N+1 → user.age
_ = state.createSlotBool(true);        // slot N+2 → user.active
```

### Property access

```tsx
{`Hello, ${user.name}!`}
// Compiles to:
state.getSlotString(N)    // user.name → slot N
```

```tsx
{`Age: ${user.age}`}
// Compiles to:
state.getSlot(N+1)        // user.age → slot N+1
```

### Setter — full object

```tsx
setUser({ name: "Bob", age: 25, active: false })
// Compiles to:
state.setSlotString(N, "Bob");
state.setSlot(N+1, 25);
state.setSlotBool(N+2, false);
```

### Setter — spread update

```tsx
setUser({ ...user, age: user.age + 1 })
// Compiles to (only changed field):
state.setSlot(N+1, state.getSlot(N+1) + 1);
// name and active unchanged — no setter calls emitted
```

The compiler sees `...user` and knows it means "keep all fields except the ones
explicitly overridden." It only emits setters for the overridden fields.

## Implementation

### Step 1: Object Initializer Detection

**File: `tsz/compiler/codegen.zig` — `collectStateHooks()`**

Currently detects: `useState(0)`, `useState("")`, `useState(true)`, `useState([...])`.

Add detection for `useState({ key: value, ... })`:

Token pattern:
```
useState ( { identifier : value , identifier : value , ... } )
```

```zig
} else if (self.curKind() == .lbrace) {
    // Object initializer: useState({ name: "Alice", age: 30 })
    self.advance_token(); // {
    var field_names: [MAX_OBJECT_FIELDS][]const u8 = undefined;
    var field_types: [MAX_OBJECT_FIELDS]StateType = undefined;
    var field_int_vals: [MAX_OBJECT_FIELDS]i64 = undefined;
    var field_float_vals: [MAX_OBJECT_FIELDS]f64 = undefined;
    var field_string_vals: [MAX_OBJECT_FIELDS][]const u8 = undefined;
    var field_bool_vals: [MAX_OBJECT_FIELDS]bool = undefined;
    var field_count: u32 = 0;

    while (self.curKind() == .identifier and field_count < MAX_OBJECT_FIELDS) {
        field_names[field_count] = self.curText();
        self.advance_token(); // key
        if (self.curKind() == .colon) self.advance_token(); // :
        // Parse value — detect type same as scalar useState
        // ... (number, string, bool detection)
        field_count += 1;
        if (self.curKind() == .comma) self.advance_token();
    }
    if (self.curKind() == .rbrace) self.advance_token(); // }
}
```

### Step 2: Object State Metadata

Add to codegen:

```zig
const MAX_OBJECT_FIELDS = 16;

const ObjectStateInfo = struct {
    getter: []const u8,          // "user"
    setter: []const u8,          // "setUser"
    field_names: [MAX_OBJECT_FIELDS][]const u8,
    field_types: [MAX_OBJECT_FIELDS]StateType,
    field_slot_base: u32,        // first slot ID for this object
    field_count: u32,
};

const MAX_OBJECTS = 16;
object_states: [MAX_OBJECTS]ObjectStateInfo,
object_count: u32,
```

Each field gets its own scalar state slot. The object metadata maps
`user.name` → `slot_base + 0`, `user.age` → `slot_base + 1`, etc.

### Step 3: Property Access in Expressions

In `emitStateAtom()`, after checking `isState(name)`:

```zig
// Check for object property access: user.name
if (self.isObjectState(name)) |obj_idx| {
    self.advance_token(); // identifier (e.g., "user")
    if (self.curKind() == .dot) {
        self.advance_token(); // .
        const field = self.curText();
        self.advance_token(); // field name
        const slot_id = self.resolveObjectField(obj_idx, field);
        const field_type = self.object_states[obj_idx].field_types[slot_id - self.object_states[obj_idx].field_slot_base];
        return try self.stateGetterByType(slot_id, field_type);
    }
}
```

### Step 4: Property Access in Template Literals

In `parseTemplateLiteral()`, detect `${user.name}`:

Currently handles `${identifier}` → `state.getSlot(N)`.
Add: `${identifier.field}` → resolve through object metadata.

```zig
// Inside template ${...} parsing:
if (std.mem.indexOf(u8, expr, ".")) |dot_pos| {
    const obj_name = expr[0..dot_pos];
    const field_name = expr[dot_pos + 1..];
    if (self.isObjectState(obj_name)) |obj_idx| {
        const slot = self.resolveObjectField(obj_idx, field_name);
        // Emit getter with correct type format
    }
}
```

### Step 5: Object Setter in Handlers

In `emitHandlerExpr()`, detect `setUser(...)`:

**Full object:** `setUser({ name: "Bob", age: 25, active: false })`
→ emit setter for each field

**Spread update:** `setUser({ ...user, age: user.age + 1 })`
→ detect `...user`, only emit setters for explicitly overridden fields

```zig
if (self.isObjectSetter(name)) |obj_idx| {
    self.advance_token(); // setter name
    if (self.curKind() == .lparen) self.advance_token(); // (
    if (self.curKind() == .lbrace) {
        self.advance_token(); // {

        // Check for spread: ...user
        var has_spread = false;
        if (self.curKind() == .dot and self.peekKind(1) == .dot and self.peekKind(2) == .dot) {
            self.advance_token(); // .
            self.advance_token(); // .
            self.advance_token(); // .
            self.advance_token(); // identifier (the spread source)
            has_spread = true;
            if (self.curKind() == .comma) self.advance_token();
        }

        // Parse explicit field overrides
        var result: std.ArrayListUnmanaged(u8) = .{};
        while (self.curKind() == .identifier) {
            const field = self.curText();
            self.advance_token(); // field name
            if (self.curKind() == .colon) self.advance_token(); // :
            const value_expr = try self.emitStateExpr();
            const slot = self.resolveObjectField(obj_idx, field);
            const field_type = self.getObjectFieldType(obj_idx, field);
            // Emit typed setter
            try result.appendSlice(self.alloc,
                try self.stateSetterByType(slot, field_type, value_expr));
            try result.appendSlice(self.alloc, "\n    ");
            if (self.curKind() == .comma) self.advance_token();
        }
        // ... close brace/paren
        return try self.alloc.dupe(u8, result.items);
    }
}
```

### Step 6: Spread Operator Token

The lexer needs `...` (three dots). Currently `.` is a single-char token.

Add to lexer:
```zig
// In tokenize(), before single-char dot:
if (ch == '.' and self.peekAt(1) == '.' and self.peekAt(2) == '.') {
    self.pos += 3;
    self.emit(.spread, start, start + 3);
    continue;
}
```

Add `spread` to `TokenKind` enum.

## Nested Objects (Deferred)

`useState({ user: { name: "Alice" }, settings: { theme: "dark" } })` — nested objects
would need recursive flattening. Defer this. Flat objects cover 90% of use cases.

## Files

| File | Change |
|------|--------|
| `tsz/compiler/lexer.zig` | Add `spread` token (`...`) |
| `tsz/compiler/codegen.zig` | Object initializer detection, field metadata, property access in expressions/templates, spread setter |
| No runtime changes | Objects flatten to existing scalar slots |

**Key insight: no runtime changes.** Objects are a compile-time abstraction over existing
scalar slots. `state.zig` doesn't know objects exist — it just sees slots.

## Verification

```bash
zig build tsz-compiler && ./zig-out/bin/tsz build tsz/examples/object-state-test.tsz
```

```tsx
function App() {
  const [user, setUser] = useState({ name: "Alice", age: 30, active: true });

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`Hello, ${user.name}!`}</Text>
      <Text fontSize={18} color="#888888">{`Age: ${user.age}`}</Text>
      <Text fontSize={18} color="#888888">{`Active: ${user.active}`}</Text>

      <Pressable onPress={() => setUser({ ...user, age: user.age + 1 })}
        style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#ffffff">Birthday</Text>
      </Pressable>

      <Pressable onPress={() => setUser({ ...user, active: !user.active })}
        style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 4 }}>
        <Text fontSize={16} color="#ffffff">Toggle Active</Text>
      </Pressable>
    </Box>
  );
}
```

Expected: Displays name, age, active. "Birthday" increments age. "Toggle Active" flips boolean.
All state changes are independent — only the changed field's slot is touched.
