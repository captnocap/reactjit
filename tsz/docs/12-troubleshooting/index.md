---
title: Troubleshooting
description: Common errors, layout bugs, state limits, build failures, and debugging tips
category: Troubleshooting
keywords: layout bugs, state limit, string cap, ScrollView, Image, gen.zig, SDL2, FreeType, build error, debug
related: Layout, State, Runtime, Advanced
difficulty: beginner
---

## Overview

This page covers the most common mistakes when working with tsz: layout issues, state slot limits, dynamic text gotchas, image path requirements, build failures, and the generated file rule.

---

## Layout Bugs

### Root needs 100% width and height

The root component must explicitly claim the full window. Without it, the layout engine has no size to distribute and children collapse.

```tsz
// Wrong — root has no size, children get proportional fallback (1/4 of nothing)
function App() {
  return (
    <Box style={{ padding: 16 }}>
      <Text fontSize={16} color="#fff">Hello</Text>
    </Box>
  );
}

// Correct
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: 16 }}>
      <Text fontSize={16} color="#fff">Hello</Text>
    </Box>
  );
}
```

### Proportional fallback surprises

The layout engine's third sizing tier: if a container has no explicit size and no children with a size, it gets 1/4 of its parent. This cascades — a chain of unsized containers all end up at 1/4 × 1/4 × 1/4 of the root. The symptom is elements appearing as tiny squares in the corner.

Fix: add `flexGrow: 1` to space-filling containers, or set explicit `width`/`height`.

```tsz
// Wrong — sidebar and content both get 1/4 of parent
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ backgroundColor: '#1a1a2a' }}>
    <Text fontSize={14} color="#fff">Sidebar</Text>
  </Box>
  <Box style={{ backgroundColor: '#252535' }}>
    <Text fontSize={14} color="#fff">Content</Text>
  </Box>
</Box>

// Correct — sidebar is fixed, content fills remaining space
<Box style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
  <Box style={{ width: 200, backgroundColor: '#1a1a2a' }}>
    <Text fontSize={14} color="#fff">Sidebar</Text>
  </Box>
  <Box style={{ flexGrow: 1, backgroundColor: '#252535' }}>
    <Text fontSize={14} color="#fff">Content</Text>
  </Box>
</Box>
```

### Never hardcode pixel heights for full-window layouts

Hardcoded heights break on resize and on different DPI screens. Use `flexGrow: 1` instead.

```tsz
// Wrong — hardcoded 600px breaks if the window is resized
<Box style={{ height: 600, backgroundColor: '#1e1e2a' }}>
  <Text fontSize={16} color="#fff">Main area</Text>
</Box>

// Correct — fills whatever space is available
<Box style={{ flexGrow: 1, backgroundColor: '#1e1e2a' }}>
  <Text fontSize={16} color="#fff">Main area</Text>
</Box>
```

---

## ScrollView Needs Explicit Height

`ScrollView` is excluded from the proportional fallback tier. If it has no explicit height (or `flexGrow`), it collapses to zero and nothing is visible.

```tsz
// Wrong — ScrollView has no height, content is invisible
<ScrollView>
  <Text fontSize={14} color="#fff">Item 1</Text>
  <Text fontSize={14} color="#fff">Item 2</Text>
</ScrollView>

// Correct — explicit height
<ScrollView style={{ height: 300 }}>
  <Text fontSize={14} color="#fff">Item 1</Text>
  <Text fontSize={14} color="#fff">Item 2</Text>
</ScrollView>

// Also correct — inside a flex column, flex: 1 gives it remaining space
<Box style={{ height: '100%', flexDirection: 'column' }}>
  <Text fontSize={20} color="#fff">Header</Text>
  <ScrollView style={{ flexGrow: 1 }}>
    <Text fontSize={14} color="#fff">Item 1</Text>
    <Text fontSize={14} color="#fff">Item 2</Text>
  </ScrollView>
</Box>
```

---

## Dynamic Text: Don't Mix Static and Expressions in Text

`<Text>` nodes cannot contain a mix of literal string content and `{expression}` children. The compiler maps each `<Text>` to a single string slot. Mix them and one value silently wins or the output is garbled.

```tsz
// Wrong — mixing static text and expression
<Text fontSize={16} color="#fff">Count: {count}</Text>

// Correct — use a template literal
<Text fontSize={16} color="#fff">{`Count: ${count}`}</Text>

// Also wrong — two separate expressions
<Text fontSize={16} color="#fff">{label}: {value}</Text>

// Correct
<Text fontSize={16} color="#fff">{`${label}: ${value}`}</Text>
```

---

## Image: src Is Baked as an Absolute Path

`<Image src="./photo.png" />` — the `src` string is embedded verbatim in the generated Zig. The path is resolved relative to the working directory at runtime, not at compile time. If you move the binary or the image file, the image will fail to load silently (the node renders as an empty box).

```tsz
// Works when running from the project root
<Image src="assets/photo.png" style={{ width: 120, height: 80 }} />

// Fragile — will break if the binary is moved
<Image src="./photo.png" style={{ width: 120, height: 80 }} />
```

Use paths relative to where you will run the binary, or use absolute paths for system images.

---

## State Limits

### 256 slot limit

The state system supports a maximum of 256 slots per app. Each `useState()` call consumes one slot. Object state (via `useState({...})`) consumes one slot per field. If you exceed 256 slots, the compiler emits an error.

### 255-byte string cap

State strings are capped at 255 bytes. Strings longer than this are silently truncated. This applies to `useState('')` and any dynamic string binding.

```tsz
// Fine — short strings
const [name, setName] = useState('');
const [status, setStatus] = useState('idle');

// Risk — very long strings will be truncated at 255 bytes
const [description, setDescription] = useState('');
// Don't store large documents in state; use FFI + C memory for large buffers
```

### State is global within a compiled fragment

There is no per-component-instance state isolation. If two `<InfoCard />` elements are rendered, they share the same state slots. Use distinct state variables for each instance when needed.

---

## Build Errors

### Missing SDL2 or FreeType

```
error: library 'SDL2' not found
error: library 'freetype' not found
```

Install the system packages:

```bash
# Debian/Ubuntu
sudo apt install libsdl2-dev libfreetype-dev

# Arch
sudo pacman -S sdl2 freetype2

# macOS
brew install sdl2 freetype
```

### Missing libmpv (optional)

`playVideo()` requires libmpv. If you don't need video, you can build without it — the compiler only links mpv when `playVideo()` is used. To install:

```bash
sudo apt install libmpv-dev   # Debian/Ubuntu
sudo pacman -S mpv            # Arch
```

### Missing wgpu-native

wgpu-native is fetched as a Zig package dependency. If the build fails with a wgpu error, run:

```bash
zig build --fetch
```

from the repo root to download dependencies.

### Font not found at runtime

The text engine tries these paths in order:

1. `fonts/base/DejaVuSans-Regular.ttf` (relative to cwd)
2. `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`
3. `C:/Windows/Fonts/segoeui.ttf`
4. `C:/Windows/Fonts/arial.ttf`

If none are found, the app fails to start. Either place a font at `fonts/base/DejaVuSans-Regular.ttf` relative to your working directory, or install DejaVu fonts on the system.

---

## Never Edit .gen.zig Files

Files ending in `.gen.zig` are generated output from the `.tsz` compiler. Editing them directly will be overwritten on the next `tsz compile-runtime` or `zig build engine-app` run.

```
tsz/runtime/compiled/framework/   ← generated, never edit
tsz/runtime/compiled/user/        ← generated, never edit
tsz/runtime/generated_app.zig     ← generated, never edit
```

If a `.gen.zig` has a bug, find the corresponding `.tsz` source, fix it there, and recompile.

```bash
# Fix the .tsz source, then recompile:
./zig-out/bin/tsz compile-runtime tsz/devtools/DevtoolsPanel.tsz
```

---

## Debugging Tips

### Check layout with background colors

Add temporary `backgroundColor` to boxes to see their computed bounds:

```tsz
<Box style={{ flexGrow: 1, backgroundColor: '#ff000033' }}>
  {/* your content */}
</Box>
```

### Watchdog diagnostic output

When the watchdog fires, the full diagnostic is printed to stderr and displayed in the BSOD screen. The RSS trend and memory breakdown tell you where memory went. Check the "LIKELY CAUSE" section first.

### Inspect generated Zig

When a layout or render behaves unexpectedly, read the generated Zig:

```bash
./zig-out/bin/tsz build app.tsz
cat tsz/runtime/generated_app.zig
```

The generated code is readable — it's the same struct literals and array slices that a Zig developer would write by hand. Finding the relevant `_arr_N` and checking its `.style` fields often reveals a missing or wrong value.

### State slot numbering

The compiler assigns state slots sequentially. If you have multiple `useState` calls and one is behaving as if it holds a different value, count the slots from the top of the file to find which slot index each one maps to. The runtime state module (`state.zig`) stores them as a flat array.

## See Also

- [Layout](../04-layout/index.md)
- [State](../05-state/index.md)
- [Runtime Internals](../10-runtime/index.md)
- [Advanced Patterns](../11-advanced/index.md)
