---
title: Window
description: Secondary SDL2 window in the same process — shared state, no IPC.
category: Primitives
keywords: window, multi-window, secondary window, SDL2, openWindow, panel, inspector
related: Box, State, Runtime
difficulty: intermediate
---

## Overview

`Window` declares a secondary SDL2 window. Unlike spawning a separate process, all windows in a tsz app share the same address space — state variables, computed values, and function calls are all directly visible from every window without sockets, pipes, or serialization. A Window does not appear when the app starts; call `openWindow(index)` to show it. Closing the window via the OS title bar destroys it; call `openWindow` again to re-open it. Up to 8 windows per app.

## Syntax

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ width: 500, padding: 32, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 16 }}>
      <Text fontSize={28} color="#ffffff">Main Window</Text>

      <Pressable onPress={() => openWindow(0)} style={{ padding: 14, backgroundColor: '#56a0d6' }}>
        <Text fontSize={15} color="#ffffff">Open Panel</Text>
      </Pressable>

      <Window title="Panel" width={350} height={250}>
        <Box style={{ padding: 24, backgroundColor: '#1a1a2e' }}>
          <Text fontSize={22} color="#ffffff">Panel</Text>
          <Text fontSize={16} color="#56a0d6">{`Count: ${count}`}</Text>
        </Box>
      </Window>
    </Box>
  );
}
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | required | Title bar text |
| `width` | number | `400` | Initial window width in pixels |
| `height` | number | `300` | Initial window height in pixels |

`Window` does not take a `style` prop. Its children are placed inside a root `Node` that fills the window.

## openWindow

`openWindow(index)` is a built-in function available in any `.tsz` file. It shows the window at the given index. Indices are assigned in declaration order: the first `Window` element in the source is `0`, the second is `1`, and so on.

If the window is already open, `openWindow` is a no-op (the runtime checks `win_mgr.isRootOpen` before creating a new SDL window).

```tsz
// Open the first declared Window
<Pressable onPress={() => openWindow(0)} ...>
```

There is no `closeWindow`. The user closes secondary windows via the OS title bar (the X button). The window is destroyed when closed and can be re-opened with `openWindow`.

## Examples

### Inspector Panel Showing Shared State

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ width: 500, padding: 32, flexDirection: 'column', gap: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={28} color="#ffffff">Main Window</Text>
      <Text fontSize={13} color="#78788c">
        State is shared across windows. No TCP. No sockets. Just memory.
      </Text>

      <Box style={{ padding: 20, backgroundColor: '#282838' }}>
        <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => setCount(count + 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#4ec9b0' }}>
          <Text fontSize={16} color="#ffffff">+</Text>
        </Pressable>
        <Pressable onPress={() => setCount(count - 1)} style={{ flexGrow: 1, padding: 16, backgroundColor: '#eb5757' }}>
          <Text fontSize={16} color="#ffffff">-</Text>
        </Pressable>
      </Box>

      <Pressable onPress={() => openWindow(0)} style={{ padding: 16, backgroundColor: '#56a0d6' }}>
        <Text fontSize={16} color="#ffffff">Open Inspector</Text>
      </Pressable>

      <Window title="Inspector" width={350} height={250}>
        <Box style={{ padding: 24, flexDirection: 'column', gap: 12, backgroundColor: '#1a1a2e' }}>
          <Text fontSize={22} color="#ffffff">Inspector</Text>
          <Text fontSize={14} color="#78788c">Separate SDL2 window. Same process.</Text>
          <Box style={{ padding: 16, backgroundColor: '#282838' }}>
            <Text fontSize={36} color="#56a0d6">{`Count: ${count}`}</Text>
          </Box>
        </Box>
      </Window>
    </Box>
  );
}
```

The `count` state variable displayed in the Inspector reflects the same slot as the main window. When the user clicks `+` in the main window, the Inspector updates on the next frame — there is no subscription, no event bus, no message passing.

### Multiple Windows

```tsz
function App() {
  return (
    <Box style={{ width: 400, padding: 24, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 12 }}>
      <Text fontSize={22} color="#ffffff">Launcher</Text>

      <Pressable onPress={() => openWindow(0)} style={{ padding: 12, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={14} color="#ffffff">Open Log Viewer</Text>
      </Pressable>
      <Pressable onPress={() => openWindow(1)} style={{ padding: 12, backgroundColor: '#56a0d6' }}>
        <Text fontSize={14} color="#ffffff">Open Settings</Text>
      </Pressable>

      <Window title="Log Viewer" width={600} height={400}>
        <Box style={{ padding: 16, backgroundColor: '#0d0d17' }}>
          <Text fontSize={13} color="#88cc88">Log output here...</Text>
        </Box>
      </Window>

      <Window title="Settings" width={400} height={300}>
        <Box style={{ padding: 24, backgroundColor: '#1e1e2a' }}>
          <Text fontSize={18} color="#ffffff">Settings</Text>
        </Box>
      </Window>
    </Box>
  );
}
```

`openWindow(0)` opens the Log Viewer, `openWindow(1)` opens the Settings window.

## Internals

`Window` elements are handled separately from the main node tree. The codegen does not emit a `Node` for a `Window` — instead it records the window's title, width, height, and child tree. In the generated Zig:

- A root node (`_win0_root`) is declared as a global, holding the window's child tree.
- A helper function (`_openWindow0`) is emitted:

```zig
fn _openWindow0() void {
    if (win_mgr.isRootOpen(&_win0_root)) return;
    if (win_mgr.open("Panel", 350, 250)) |win_idx| {
        win_mgr.setRoot(win_idx, &_win0_root);
    }
}
```

- The `<Window>` element itself emits an invisible placeholder node (`.{ .style = .{ .display = .none } }`) in the main tree so the tree structure is valid Zig.

`win_mgr.open` creates a new SDL2 `SDL_Window` + `SDL_Renderer` + `TextEngine` + `ImageCache` — each secondary window is fully self-contained for rendering. Layout and paint for all active windows run in the main loop via `win_mgr.layoutAll()` and `win_mgr.paintAndPresent()`.

The hard limit is `MAX_WINDOWS = 8` in `windows.zig`. Attempting to open more windows beyond the limit causes `win_mgr.open` to return `null` and the window silently fails to appear.

## Gotchas

- `Window` indices are zero-based and assigned in source order. The first `<Window>` in the file is `openWindow(0)`, the second is `openWindow(1)`. If you reorder `Window` elements, the indices change and all `openWindow` calls must be updated.
- `Window` does not accept a `style` prop. Style the content by giving the top-level child `Box` a `width: '100%', height: '100%'` so it fills the window.
- Secondary windows are resizable by default (SDL `SDL_WINDOW_RESIZABLE` flag). The layout re-runs at the new size on the next frame.
- Each window gets its own `TextEngine` and `ImageCache`. Font glyphs and image textures are not shared between windows — they are loaded independently per window.
- Closing a secondary window via the OS destroys the SDL window and its renderer. The root node (`_win0_root`) remains in memory. `openWindow` can re-create the SDL window and reattach it.
- Maximum 8 windows total (including the main window). The hard limit is `MAX_WINDOWS = 8` in `tsz/runtime/windows.zig`.

## See Also

- [Box](./box.md)
- [State](../05-state/index.md)
- [Runtime — Multi-Window](../10-runtime/windows.md)
