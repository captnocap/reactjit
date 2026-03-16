---
title: Pressable
description: Interactive container that responds to mouse press, hover, and right-click events.
category: Primitives
keywords: pressable, onPress, click, button, interactive, event, handler, hover
related: Box, Events, useState
difficulty: beginner
---

## Overview

`Pressable` is a `Box`-like container with event handler support. It accepts the same flex and visual style props as `Box`, plus handler props (`onPress`, `onRightClick`, `onScroll`). Any child elements are rendered inside it. Use it whenever something needs to respond to user interaction — buttons, toggles, list rows, nav items.

Hover feedback is automatic: any `Pressable` (or any node with a `backgroundColor`) brightens by ~20% when the cursor is over it. No extra prop is needed.

## Syntax

```tsz
function App() {
  return (
    <Pressable onPress={() => doSomething()} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
      <Text fontSize={16} color="#ffffff">Click me</Text>
    </Pressable>
  );
}
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| onPress | `() => void` | — | Called when the user clicks the element. |
| onRightClick | `(x: number, y: number) => void` | — | Called on right mouse button click. Receives click coordinates as integers. |
| onScroll | `() => void` | — | Called when a mouse wheel event lands on this node. |
| style | StyleObject | `{}` | Flexbox layout + visual properties. Same set as `Box`. |
| className | `string` | — | Space-separated Tailwind or Bootstrap class names, resolved at compile time. |
| debugName | `string` | — | Label shown in devtools overlays. Not rendered. |
| testId | `string` | — | Identifier for automated testing. Not rendered. |

The `x` and `y` parameters of `onRightClick` are passed as `f32` coordinates from the runtime and converted to `i64` in the generated handler. Use them as integers in your handler body.

## Examples

### Button

```tsz
function App() {
  return (
    <Pressable
      onPress={() => console.log('clicked')}
      style={{ padding: 12, backgroundColor: '#4ec9b0', borderRadius: 6 }}
    >
      <Text fontSize={14} color="#ffffff">Save</Text>
    </Pressable>
  );
}
```

### Counter increment and decrement

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ padding: 32, gap: 16, flexDirection: 'column', backgroundColor: '#1e1e2a' }}>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Box style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => setCount(count + 1)}
          style={{ flexGrow: 1, padding: 16, backgroundColor: '#4ec9b0' }}
        >
          <Text fontSize={16} color="#ffffff">+</Text>
        </Pressable>
        <Pressable
          onPress={() => setCount(count - 1)}
          style={{ flexGrow: 1, padding: 16, backgroundColor: '#eb5757' }}
        >
          <Text fontSize={16} color="#ffffff">-</Text>
        </Pressable>
      </Box>
      <Pressable
        onPress={() => setCount(0)}
        style={{ padding: 12, backgroundColor: '#282838' }}
      >
        <Text fontSize={14} color="#78788c">Reset</Text>
      </Pressable>
    </Box>
  );
}
```

### Multiple state updates in one handler

Arrow function bodies can contain multiple statements in braces:

```tsz
function App() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', gap: 16, flexDirection: 'column' }}>
      <Text fontSize={16} color="#808080">{`A=${a}  B=${b}`}</Text>
      <Pressable
        onPress={() => { setA(a + 1); setB(b + 10); }}
        style={{ padding: 16, backgroundColor: '#4ec9b0', borderRadius: 8 }}
      >
        <Text fontSize={14} color="#ffffff">Increment Both</Text>
      </Pressable>
      <Pressable
        onPress={() => { setA(0); setB(0); }}
        style={{ padding: 16, backgroundColor: '#569cd6', borderRadius: 8 }}
      >
        <Text fontSize={14} color="#ffffff">Reset Both</Text>
      </Pressable>
    </Box>
  );
}
```

### Right-click with coordinates

```tsz
function App() {
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);

  return (
    <Pressable
      onRightClick={(x, y) => { setLastX(x); setLastY(y); }}
      style={{ padding: 32, backgroundColor: '#282838', width: '100%', height: '100%' }}
    >
      <Text fontSize={16} color="#ffffff">{`Right-clicked at ${lastX}, ${lastY}`}</Text>
    </Pressable>
  );
}
```

## Internals

Each `onPress` handler in `.tsz` compiles to a named Zig function with the signature `fn () void`. The compiler assigns a unique numeric suffix per handler in the file (e.g. `_handler_press_0`, `_handler_press_1`). The function is registered on the node's `handlers.on_press` field as a compile-time function pointer.

```zig
// Generated from: onPress={() => setCount(count + 1)}
fn _handler_press_0() void {
    state.set(0, state.get(0) + 1);
}
```

Hit testing in `events.zig` walks the node tree back-to-front (last child wins, matching paint order). The deepest node whose computed AABB contains the cursor coordinates and has at least one handler set is the hit target. `display: none` nodes are skipped entirely.

Hover feedback is applied unconditionally by the painter: any node with a `backgroundColor` has its RGB channels brightened by 30 per-channel (clamped to 255) while the cursor is inside its bounds. This does not require any prop on `Pressable` — it applies to all hovered nodes with a background color.

The `onHoverEnter` and `onHoverExit` callbacks exist in the runtime's `EventHandler` struct and are dispatched in the event loop, but they are not yet exposed as `.tsz` props.

## Gotchas

- **Hover brightening applies to any node with `backgroundColor`**, not just `Pressable`. If a plain `Box` child has a background color and sits under the cursor, it will brighten too.
- **Hit testing uses computed layout bounds.** A `Pressable` with no explicit size and no children has zero dimensions and cannot be clicked.
- **`onRightClick` coordinates are integers in the handler body.** The runtime passes `f32` values but the generated preamble converts them with `@intFromFloat`. Treat `x` and `y` as `i64` in your handler.
- **Multiple statements in `onPress` require braces:** `onPress={() => { setA(1); setB(2); }}`. A single expression does not need them: `onPress={() => setCount(count + 1)}`.
- **`Pressable` is structurally a `Box`.** All flex layout rules apply — it needs content or explicit dimensions to have a non-zero hit area.

## See Also

- [Box](./box.md)
- [Events](../06-events/index.md)
- [useState](../05-state/use-state.md)
