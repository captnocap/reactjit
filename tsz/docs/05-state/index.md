---
title: State Management
description: Compile-time state slots — useState with zero heap allocation, reactive re-render on change.
category: State
keywords: useState, state slots, reactive, re-render, array state, object state, string state, bool state
related: Events, Pressable, useEffect
difficulty: beginner
---

## Overview

State in tsz is managed through `useState`, which looks identical to React's hook but compiles to something fundamentally different. Every `useState` call is analyzed at compile time and assigned a fixed slot index in a flat array. There is no hook list, no fiber, no runtime reconciler. When a setter is called, it writes to the slot, marks a dirty flag, and the main loop rebuilds the tree on the next frame.

Up to 256 scalar slots and 16 array slots are available per app. All storage is statically allocated — no heap.

## Syntax

```tsz
function App() {
  const [value, setValue] = useState(initialValue);

  return (
    <Pressable onPress={() => setValue(value + 1)}>
      <Text fontSize={24} color="#fff">{`${value}`}</Text>
    </Pressable>
  );
}
```

The initial value determines the slot type. Supported types:

| Initial value          | Slot type | Example                                  |
|------------------------|-----------|------------------------------------------|
| Integer literal        | `int`     | `useState(0)`, `useState(42)`            |
| Float literal          | `float`   | `useState(3.14)`, `useState(0.5)`        |
| `true` / `false`       | `bool`    | `useState(true)`                         |
| String literal         | `string`  | `useState("hello")`                      |
| Array literal          | `array`   | `useState([10, 20, 30])`                 |
| Object literal         | `object`  | `useState({ name: "Alice", age: 30 })`   |

## Examples

### Integer counter

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Box style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => setCount(count + 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#4ec9b0' }}>
          <Text fontSize={16} color="#fff">+</Text>
        </Pressable>
        <Pressable onPress={() => setCount(count - 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#eb5757' }}>
          <Text fontSize={16} color="#fff">-</Text>
        </Pressable>
      </Box>
      <Pressable onPress={() => setCount(0)} style={{ padding: 12, backgroundColor: '#282838' }}>
        <Text fontSize={14} color="#78788c">Reset</Text>
      </Pressable>
    </Box>
  );
}
```

### Multiple types

```tsz
function App() {
  const [name, setName] = useState("World");
  const [count, setCount] = useState(0);
  const [pi, setPi] = useState(3.14);
  const [active, setActive] = useState(true);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', flexGrow: 1 }}>
      <Text fontSize={24} color="#fff">{`Hello, ${name}!`}</Text>
      <Text fontSize={18} color="#888">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888">{`Pi: ${pi}`}</Text>
      <Text fontSize={18} color="#888">{`Active: ${active}`}</Text>
      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#fff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

### String state

String slots hold up to 255 bytes in a fixed inline buffer. No heap allocation.

```tsz
function App() {
  const [label, setLabel] = useState("idle");

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', gap: 12 }}>
      <Text fontSize={24} color="#fff">{`Status: ${label}`}</Text>
      <Pressable onPress={() => setLabel("running")} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#fff">Start</Text>
      </Pressable>
      <Pressable onPress={() => setLabel("idle")} style={{ padding: 16, backgroundColor: '#eb5757' }}>
        <Text fontSize={16} color="#fff">Stop</Text>
      </Pressable>
    </Box>
  );
}
```

### Array state

Arrays hold up to 256 `i64` elements per slot. The setter exposes `.push()` and `.pop()` as special mutations. Up to 16 array slots per app.

```tsz
function App() {
  const [items, setItems] = useState([10, 20, 30, 40, 50]);

  const total = items.reduce((sum, item) => sum + item, 0);
  const firstBig = items.find(item => item > 25);

  return (
    <Box style={{ padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#fff">Array Methods</Text>
      <Text fontSize={20} color="#4ec9b0">{`Total: ${total}`}</Text>
      <Text fontSize={20} color="#6c5ce7">{`First > 25: ${firstBig}`}</Text>
      <Text fontSize={14} color="#78788c">{`Count: ${items.length}`}</Text>
      <Pressable onPress={() => setItems.push(99)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#fff">Push 99</Text>
      </Pressable>
      <Pressable onPress={() => setItems.pop()} style={{ padding: 16, backgroundColor: '#eb5757' }}>
        <Text fontSize={16} color="#fff">Pop</Text>
      </Pressable>
    </Box>
  );
}
```

Supported array operations in .tsz:

| Syntax                          | Behavior                                     |
|---------------------------------|----------------------------------------------|
| `setItems.push(value)`          | Append an element                            |
| `setItems.pop()`                | Remove the last element                      |
| `items.length`                  | Current count                                |
| `items.reduce((acc, x) => ...)` | Fold to a single value                       |
| `items.find(x => x > n)`        | First element matching predicate             |
| `items.includes(n)`             | Boolean membership test                      |
| `items.indexOf(n)`              | First index of value, or -1                  |
| `items.filter(x => ...)`        | Computed filtered view (read-only)           |

### Object state

Object state expands each field into its own typed slot at compile time. The spread-update pattern `{ ...user, field: newValue }` is how you update individual fields.

```tsz
function App() {
  const [user, setUser] = useState({ name: "Alice", age: 30, active: true });

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', gap: 12 }}>
      <Text fontSize={24} color="#fff">{`Hello, ${user.name}!`}</Text>
      <Text fontSize={18} color="#888">{`Age: ${user.age}`}</Text>
      <Text fontSize={18} color="#888">{`Active: ${user.active}`}</Text>
      <Pressable onPress={() => setUser({ ...user, age: user.age + 1 })}
        style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#fff">Birthday</Text>
      </Pressable>
      <Pressable onPress={() => setUser({ ...user, active: !user.active })}
        style={{ padding: 16, backgroundColor: '#569cd6', marginTop: 4 }}>
        <Text fontSize={16} color="#fff">Toggle Active</Text>
      </Pressable>
    </Box>
  );
}
```

Object fields support the same types as scalar `useState`: `int`, `float`, `bool`, `string`.

## Internals

### Compile-time slot assignment

During code generation (Phase 4), the compiler scans the function body for `const [getter, setter] = useState(initial)` patterns before emitting any Zig. Each `useState` call is assigned an integer slot ID starting at 0. The ID is burned into the generated Zig as an integer literal — there is no runtime slot lookup by name.

For scalar types, the generated `pub fn main()` calls `state.createSlot`, `state.createSlotFloat`, `state.createSlotBool`, or `state.createSlotString` once at startup:

```zig
_ = state.createSlot(0);          // useState(0)    → slot 0
_ = state.createSlotFloat(3.14);  // useState(3.14) → slot 1
_ = state.createSlotBool(true);   // useState(true) → slot 2
_ = state.createSlotString("hi"); // useState("hi") → slot 3
```

For array state, `state.createArraySlot` is called with the initial elements:

```zig
_ = state.createArraySlot(&[_]i64{ 10, 20, 30 }); // slot 0 in the array pool
```

For object state, each field gets its own scalar slot. `useState({ name: "Alice", age: 30 })` generates two slots — a string slot for `name` and an int slot for `age`.

### The StateSlot struct

Each scalar slot is a tagged union:

```zig
pub const Value = union(enum) {
    int: i64,
    float: f64,
    boolean: bool,
    string: struct { buf: [256]u8, len: u8 },
};

pub const StateSlot = struct {
    value: Value,
    dirty: bool,
};
```

All 256 slots are pre-allocated in a static array. No slot is ever freed or reallocated.

### The dirty flag

`state.setSlot` / `state.setSlotFloat` / `state.setSlotBool` / `state.setSlotString` each compare the new value against the current value. If it differs, they:

1. Write the new value into the slot
2. Set `slot.dirty = true` on the individual slot
3. Set the global `_dirty = true`

The main event loop checks `state.isDirty()` once per frame. If true, it rebuilds computed values, re-evaluates dynamic text, and clears dirty flags via `state.clearDirty()`. The tree is not rebuilt on every frame — only when something actually changed.

### Hot-reload state persistence

In dev mode, a `SIGUSR1` signal triggers `state.saveState()`, which serializes all slots to `/tmp/tsz-state.bin`. On restart, `state.loadState()` restores them, preserving state across recompiles. The file is deleted after reading (one-shot restore).

## Gotchas

- **String state is capped at 255 bytes.** Longer strings are silently truncated. There is no error.
- **Array state holds only `i64` values.** Float arrays are not supported.
- **Up to 16 array slots per app.** The limit is compile-time fixed (`MAX_ARRAY_SLOTS = 16`).
- **Object field types are inferred from their initial values.** A field initialized as `0` is an int slot — you cannot later store a float in it.
- **`setItems.push(value)` is setter-dot notation, not a method call on the array.** `items.push(value)` will not work — the push goes through the setter.
- **Setting state to the same value is a no-op.** The dirty flag is only set when the value changes. Equality is checked before writing.
- **Do not mix text and expressions directly in `<Text>`.** Use template literals: `` {`Count: ${count}`} `` not `{"Count: " + count}`.

## See Also

- [Events](../06-events/index.md)
- [Pressable](../03-primitives/pressable.md)
- [useEffect](../06-events/index.md#useeffect)
