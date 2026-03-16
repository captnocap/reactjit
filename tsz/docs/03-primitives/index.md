---
title: Primitives
description: The seven built-in elements that every tsz UI is composed from.
category: Primitives
keywords: box, text, image, pressable, scrollview, textinput, window, primitives, elements
related: Layout, State, Events
difficulty: beginner
---

## Overview

Every tsz UI is built from seven primitives. There are no other node types. A dashboard is Boxes and Text. A form is TextInputs inside Boxes. A multi-panel tool is Windows containing Boxes. The framework provides no special-purpose widgets — complexity comes from composition, not from a component library.

Each primitive compiles to a `layout.Node` struct literal in generated Zig code. The struct is stack-allocated, the children array is a fixed-size Zig array, and all event handlers are compile-time function pointers. There is no heap allocation, no virtual DOM, and no reconciler at runtime.

## Primitives

### [Box](./box.md)

The universal layout container. Renders a rectangular region and arranges its children using a CSS-compatible flexbox engine. Takes a `style` prop with all layout and visual properties. Every other primitive is placed inside a Box or is itself Box-like.

```tsz
<Box style={{ padding: 16, backgroundColor: '#1e1e2a', flexDirection: 'row', gap: 8 }}>
  <Text fontSize={14} color="#ffffff">Hello</Text>
</Box>
```

### [Text](./text.md)

Renders a string with FreeType glyph rasterization. Accepts `fontSize`, `color`, `letterSpacing`, `lineHeight`, and `numberOfLines`. Text nodes measure their own natural size and wrap to fit their parent container. Dynamic text uses template literals inside `{}`.

```tsz
<Text fontSize={20} color="#ff79c6">{`Count: ${count}`}</Text>
```

### [Image](./image.md)

Loads and displays an image file. Decodes via stb_image and caches the SDL texture across frames. Accepts a `src` prop (relative path to the image file) and a `style` prop for sizing. The image scales to fill the node's computed dimensions.

```tsz
<Image src="assets/logo.png" style={{ width: 64, height: 64 }} />
```

### [Pressable](./pressable.md)

A Box that responds to mouse clicks. Takes `onPress`, `onHoverEnter`, and `onHoverExit` event handlers in addition to the `style` prop. Hover state brightens the background automatically. Used for all interactive controls — buttons, list items, tabs.

```tsz
<Pressable onPress={() => setCount(count + 1)} style={{ padding: 12, backgroundColor: '#4ec9b0' }}>
  <Text fontSize={16} color="#ffffff">Click me</Text>
</Pressable>
```

### [ScrollView](./scroll-view.md)

A Box with overflow clipping and mouse wheel scrolling. Children that exceed the visible height are clipped and scrollable via the mouse wheel. Requires an explicit `height` in the style prop — ScrollView is excluded from the proportional fallback sizing that other containers use.

```tsz
<ScrollView style={{ height: 300, backgroundColor: '#1e1e2a' }}>
  <Text fontSize={14} color="#ccccdd">...long content...</Text>
</ScrollView>
```

### [TextInput](./text-input.md)

A single-line text field. Accepts `placeholder`, `fontSize`, `color`, `style`, and an `onChange` handler. Each `TextInput` in a component is assigned a compile-time numeric ID. Call `getText(id)` to read the current value. `TextArea` is the multiline variant — it accepts newlines and Tab-to-indent.

```tsz
<TextInput
  placeholder="Search..."
  fontSize={16}
  color="#ffffff"
  style={{ padding: 12, backgroundColor: '#282838' }}
/>
```

### [Window](./window.md)

Declares a secondary SDL2 window in the same process. Takes `title`, `width`, and `height` props. The window does not appear until `openWindow(index)` is called. Multiple windows share the same address space — state variables are visible from all windows without any IPC. Up to 8 windows per app.

```tsz
<Pressable onPress={() => openWindow(0)} style={{ padding: 12, backgroundColor: '#56a0d6' }}>
  <Text fontSize={14} color="#ffffff">Open Panel</Text>
</Pressable>

<Window title="Panel" width={400} height={300}>
  <Box style={{ padding: 24, backgroundColor: '#1a1a2e' }}>
    <Text fontSize={16} color="#ffffff">Secondary window</Text>
  </Box>
</Window>
```

## See Also

- [Layout — Sizing Tiers](../04-layout/sizing-tiers.md)
- [Layout — Flexbox](../04-layout/flexbox.md)
- [State](../05-state/index.md)
- [Events](../06-events/index.md)
