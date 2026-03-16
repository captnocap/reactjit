---
title: Events
description: onPress handlers, hit testing, useEffect (mount, watch, interval, every-frame), and the event → state → rebuild → paint cycle.
category: Events
keywords: onPress, useEffect, hit testing, events, handlers, interval, mount, watch, every-frame, Pressable
related: State, Pressable, ScrollView, TextInput
difficulty: beginner
---

## Overview

Events in tsz are compile-time function pointers stored directly on nodes. There is no event bus, no synthetic event system, no bubbling. A click walks the node tree back-to-front, finds the deepest node whose bounds contain the click point and which has a handler, and calls that handler directly. The handler mutates state, which marks a dirty flag, which triggers a rebuild on the next frame.

`useEffect` is the side-effect hook — it runs Zig-callable code on mount, on state changes, on a timer, or every frame. Like `useState`, all effect scheduling is resolved at compile time.

## onPress

Any `<Pressable>` can accept an `onPress` handler. The handler is an arrow function that calls setters or performs side effects:

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
      <Text fontSize={16} color="#fff">{`Clicked ${count} times`}</Text>
    </Pressable>
  );
}
```

### Available event handlers

| Handler          | When it fires                              | Signature                         |
|------------------|--------------------------------------------|-----------------------------------|
| `onPress`        | Mouse button released inside the node      | `() => void`                      |
| `onHoverEnter`   | Cursor enters the node bounds              | `() => void`                      |
| `onHoverExit`    | Cursor leaves the node bounds              | `() => void`                      |
| `onRightClick`   | Right mouse button released inside         | `(x, y) => void`                  |
| `onScroll`       | Mouse wheel over a ScrollView              | `() => void`                      |
| `onKey`          | Key press when a TextInput is focused      | `(key, mods) => void`             |
| `onChange`       | TextInput content changes                  | `() => void`                      |

### Multi-statement handlers

Handlers can contain multiple statements using a block body:

```tsz
function App() {
  const [items, setItems] = useState([1, 2, 3]);
  const [count, setCount] = useState(10);

  return (
    <Pressable onPress={() => {
      setItems.push(count);
      setCount(count + 10);
    }} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
      <Text fontSize={16} color="#fff">{`Push ${count}`}</Text>
    </Pressable>
  );
}
```

## Hit Testing

When a mouse button is released, the runtime calls `events.hitTest(root, mx, my)`. This walks the node tree depth-first, children in reverse order (last child rendered is front-most):

1. If a node has `display: none`, it and all its children are skipped.
2. Children are checked in reverse render order — the last child wins over earlier siblings.
3. A node matches if it has at least one handler set AND the cursor is within its computed bounds (`x`, `y`, `w`, `h`).
4. The deepest matching node is returned. Its `on_press` function pointer is called directly.

The same back-to-front walk is used for hover tracking (`on_hover_enter` / `on_hover_exit`) and scroll container detection.

TextInput nodes are treated as interactive even without explicit handlers — they match the hit test by virtue of having an `input_id`.

### Hover feedback

Nodes with a `backgroundColor` automatically brighten by 30 RGB units on each channel when hovered. No handler needed for this visual feedback. The brightening is applied in the painter, not via state.

## useEffect

`useEffect` registers a side-effect function that the compiler schedules according to its second argument. There are four scheduling modes:

### Mount effect

Runs once when the app starts, after state is initialized.

```tsz
useEffect(() => console.log("App started"), []);
```

The empty dependency array `[]` is the signal. The generated Zig calls this function once during `main()` initialization, before the event loop begins.

### Watch effect

Runs whenever one or more state variables change.

```tsz
function App() {
  const [count, setCount] = useState(0);

  useEffect(() => console.log("count changed"), [count]);

  return (
    <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
      <Text fontSize={16} color="#fff">{`Count: ${count}`}</Text>
    </Pressable>
  );
}
```

The dependency array names state variables to watch. The compiler resolves each name to its slot ID. In the generated Zig, the effect is gated on `state.slotDirty(slotId)`:

```zig
if (state.slotDirty(0)) { _effect_1(); }
```

Multiple dependencies use `or`:

```tsz
useEffect(() => syncToServer(), [name, count]);
// generates: if (state.slotDirty(0) or state.slotDirty(1)) { _effect_0(); }
```

### Interval effect

Runs on a fixed millisecond timer. Pass the interval as the second argument (a number, not an array).

```tsz
function App() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => setSeconds(seconds + 1), 1000);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#fff">{`Uptime: ${seconds}s`}</Text>
    </Box>
  );
}
```

The compiler generates a `u32` timer variable initialized to `SDL_GetTicks()` at startup. Each frame it checks `SDL_GetTicks() - _timer_N >= intervalMs` and calls the effect if the interval has elapsed:

```zig
{
    const _now = c.SDL_GetTicks();
    if (_now -% _timer_0 >= 1000) { _timer_0 = _now; _effect_0(); }
}
```

### Every-frame effect

Runs unconditionally on every frame. No second argument.

```tsz
useEffect(() => animate());
```

This is called at the end of the main loop tick, regardless of dirty state. Use sparingly — it runs at the full frame rate (typically 60fps or vsync rate).

### Full example with all effect types

```tsz
function App() {
  const [count, setCount] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Mount effect — runs once at startup
  useEffect(() => console.log("App started"), []);

  // Watch effect — runs when count changes
  useEffect(() => console.log("count changed"), [count]);

  // Interval effect — increment seconds every 1000ms
  useEffect(() => setSeconds(seconds + 1), 1000);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#fff">{`Count: ${count}`}</Text>
      <Text fontSize={18} color="#888">{`Seconds: ${seconds}`}</Text>
      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0', marginTop: 8 }}>
        <Text fontSize={16} color="#fff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

## The Event → State → Rebuild → Paint Cycle

This is the complete flow from user interaction to pixels on screen:

```
1. USER INPUT
   SDL delivers a mouse button event (x, y)

2. HIT TEST
   events.hitTest(root, x, y)
   → walks tree back-to-front
   → returns deepest node with a handler covering (x, y)

3. HANDLER CALL
   node.handlers.on_press()
   → compiled to: _handler_press_N()
   → calls state.setSlot(id, newValue)

4. DIRTY FLAG
   state.setSlot checks if value changed
   → if yes: slot.dirty = true, _dirty = true
   → if no: no-op, no rebuild

5. REBUILD CHECK (next frame)
   if (state.isDirty()) {
     rebuildComputedArrays();   // .filter(), .split() views
     computeBody();              // let bindings, conditionals
     updateDynamicTexts();       // fmt.bufPrint for template literals
     rebuildMaps();              // .map() list rendering
     state.clearDirty();
   }

6. WATCH EFFECTS
   Inside isDirty() block, after rebuild:
   if (state.slotDirty(N)) { _effect_M(); }

7. INTERVAL EFFECTS (every frame, outside isDirty block)
   if (SDL_GetTicks() - _timer_N >= intervalMs) { _effect_N(); }

8. EVERY-FRAME EFFECTS (every frame, outside isDirty block)
   _effect_N();

9. LAYOUT
   layout.compute(root, windowW, windowH)
   → flex pass: measures text, distributes space
   → sets node.computed.{x, y, w, h} for every node

10. PAINT
    painter.paintTree(root)
    → walks tree front-to-back
    → SDL/wgpu draw calls for backgrounds, borders, text, images
    → hover brightening applied per-node
    → SDL_RenderPresent()
```

The key invariant: **layout and paint only run when something changed** (dirty flag was set), or on the initial frame. When the app is idle — no state changes, no interval ticks, no every-frame effects — the frame cost is a single `isDirty()` check per SDL event poll.

## Internals

### Handlers are named functions, not closures

The .tsz compiler extracts each `onPress` arrow function body and emits it as a named top-level Zig function. There are no closures, no captures, no heap allocation for handler state.

```tsz
<Pressable onPress={() => setCount(count + 1)}>
```

compiles to:

```zig
fn _handler_press_0() void {
    state.setSlot(0, state.getSlot(0) + 1);
}
```

The node struct holds a function pointer to this function:

```zig
var _node = Node{
    .handlers = .{ .on_press = _handler_press_0 },
    ...
};
```

No allocation at call time. Calling a handler is a single indirect function call.

### Effect functions are also named

Each `useEffect` body is emitted as a named function `_effect_N`. The scheduling code (mount call, dirty check, interval check) is emitted separately in the appropriate location in `main()` or the per-frame tick.

### EventHandler struct

From `events.zig`, each node carries:

```zig
pub const EventHandler = struct {
    on_press:        ?*const fn () void = null,
    on_hover_enter:  ?*const fn () void = null,
    on_hover_exit:   ?*const fn () void = null,
    on_key:          ?*const fn (key: c_int, mods: u16) void = null,
    on_change_text:  ?*const fn () void = null,
    on_scroll:       ?*const fn () void = null,
    on_right_click:  ?*const fn (x: f32, y: f32) void = null,
};
```

Handlers not present in the .tsz source remain `null`. The hit test function `hasHandlers()` returns true if any field is non-null.

## Gotchas

- **onPress fires on mouse-up, not mouse-down.** There is no `onMouseDown` handler in the current API.
- **Hit testing stops at the first (deepest) matching node.** If a Pressable contains another Pressable, only the inner one receives the click. The outer one is not called.
- **Watch effects check slot-level dirty, not value equality.** If a setter is called with the same value, `setSlot` skips the write and the dirty flag is never set — so the watch effect correctly does not fire.
- **Interval effects use `SDL_GetTicks()` (u32 milliseconds).** The wrapping subtraction `_now -% _timer` handles the u32 wraparound at ~49 days of uptime.
- **Every-frame effects run even when the app is idle.** If your every-frame effect calls a setter, it will force a rebuild every frame, effectively pinning CPU. Use interval effects for polling at lower frequency.
- **`useEffect` dependencies must be state variable names.** You cannot pass computed values or object field expressions as dependencies — only the top-level state variable identifier (e.g., `[count]` not `[user.age]`).
- **Up to 64 effects per component.** Exceeding this limit is a compile error.

## See Also

- [State Management](../05-state/index.md)
- [Pressable](../03-primitives/pressable.md)
- [ScrollView](../03-primitives/scroll-view.md)
- [TextInput](../03-primitives/text-input.md)
