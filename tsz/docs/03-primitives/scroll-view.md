---
title: ScrollView
description: Overflow-clipping container with mouse wheel scrolling.
category: Primitives
keywords: scroll, scrollview, overflow, clipping, mouse wheel, scrollable, height
related: Box, Layout, Events
difficulty: beginner
---

## Overview

`ScrollView` is a `Box` that clips its children to its visible bounds and lets the user scroll vertically with the mouse wheel. Children that extend beyond the bottom of the visible area are hidden and revealed by scrolling. Use it any time content may be taller than the space available — log output, item lists, code viewers, settings panels.

## Syntax

```tsz
function App() {
  return (
    <Box style={{ width: 500, height: '100%', backgroundColor: '#1e1e2a' }}>
      <ScrollView style={{ flexGrow: 1, backgroundColor: '#16161e' }}>
        <Text fontSize={14} color="#ccccdd">Line one</Text>
        <Text fontSize={14} color="#ccccdd">Line two</Text>
        <Text fontSize={14} color="#ccccdd">...many more lines...</Text>
      </ScrollView>
    </Box>
  );
}
```

## Props / API

`ScrollView` accepts the same `style` prop as `Box`. All standard layout and visual properties apply.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| style | StyleObject | `{}` | Layout and visual properties — same set as `Box` |
| onScroll | `() => void` | none | Called whenever the scroll position changes |

### Required Style Property

| Style Key | Type | Notes |
|-----------|------|-------|
| `height` | number \| `flexGrow: 1` | Must be constrained. ScrollView is excluded from proportional fallback sizing. Without an explicit height or `flexGrow`, the container will expand to wrap all its children and no scrolling will occur. |

## Examples

### Basic Scrollable List

```tsz
function App() {
  return (
    <Box style={{ width: 400, height: '100%', padding: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={20} color="#ffffff">Log Output</Text>
      <ScrollView style={{ flexGrow: 1, backgroundColor: '#0d0d17', padding: 8 }}>
        <Text fontSize={13} color="#88cc88">[ OK ] Service started</Text>
        <Text fontSize={13} color="#88cc88">[ OK ] Connected to database</Text>
        <Text fontSize={13} color="#cc8888">[ ERR ] Timeout after 30s</Text>
        <Text fontSize={13} color="#88cc88">[ OK ] Retrying...</Text>
        <Text fontSize={13} color="#88cc88">[ OK ] Connection restored</Text>
        <Text fontSize={13} color="#aaaaaa">[ -- ] Idle</Text>
      </ScrollView>
    </Box>
  );
}
```

### Fixed-Height Scroll Region

```tsz
function App() {
  return (
    <Box style={{ width: 400, padding: 24, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 16 }}>
      <Text fontSize={22} color="#ffffff">Settings</Text>
      <ScrollView style={{ height: 250, backgroundColor: '#16161e', padding: 12 }}>
        <Text fontSize={14} color="#ccccdd">Theme: Dark</Text>
        <Text fontSize={14} color="#ccccdd">Font size: 14px</Text>
        <Text fontSize={14} color="#ccccdd">Auto-save: On</Text>
        <Text fontSize={14} color="#ccccdd">Spell check: Off</Text>
        <Text fontSize={14} color="#ccccdd">Line numbers: On</Text>
        <Text fontSize={14} color="#ccccdd">Word wrap: On</Text>
        <Text fontSize={14} color="#ccccdd">Tab size: 4</Text>
        <Text fontSize={14} color="#ccccdd">Trim whitespace: On</Text>
      </ScrollView>
      <Pressable onPress={() => {}} style={{ padding: 12, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={14} color="#ffffff">Save</Text>
      </Pressable>
    </Box>
  );
}
```

### Scroll with onChange Notification

```tsz
function App() {
  const [scrolled, setScrolled] = useState(0);

  return (
    <Box style={{ width: 400, height: '100%', backgroundColor: '#1e1e2a' }}>
      <Text fontSize={13} color="#78788c">{`Scroll events: ${scrolled}`}</Text>
      <ScrollView
        style={{ flexGrow: 1, padding: 12, backgroundColor: '#16161e' }}
        onScroll={() => setScrolled(scrolled + 1)}
      >
        <Text fontSize={14} color="#ccccdd">Scroll me with the mouse wheel.</Text>
        <Text fontSize={14} color="#ccccdd">Each wheel tick fires onScroll.</Text>
      </ScrollView>
    </Box>
  );
}
```

## Internals

`ScrollView` compiles to a `Node` with `style.overflow = .scroll`. The runtime uses two mechanisms:

**Scroll container detection** (`events.findScrollContainer`): on a mouse wheel event, the runtime walks the node tree from the cursor position inward, finding the deepest node whose `style.overflow == .scroll`. That node receives the scroll delta.

**Scroll offset** (`node.scroll_y`): a `f32` field on `Node` that tracks the current vertical scroll position in pixels. The painter uses it as a clip origin — children are offset by `-scroll_y` and clipped to the node's visible rectangle.

**Content height** (`node.content_height`): computed during layout as the full vertical extent of all children (may exceed the node's visible height). The scroll offset is clamped to `[0, content_height - visible_height]` to prevent over-scrolling.

Each mouse wheel tick contributes `dy * 30.0` pixels to the scroll offset, where `dy` is the SDL2 wheel delta (positive = scroll up, negative = scroll down in SDL convention, meaning positive `dy` scrolls content downward).

```zig
scroll_node.scroll_y -= dy * 30.0;
const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
```

## Gotchas

- `ScrollView` requires an explicit height constraint. Use `height: 300` for a fixed region or `flexGrow: 1` to fill remaining space. Without either, the container expands to wrap all children and scrolling never activates because there is no overflow.
- Only vertical scrolling is supported. Horizontal overflow is clipped but not scrollable.
- Scroll state (`scroll_y`) lives on the `Node` struct and is reset to zero whenever the app re-renders from scratch. It persists across normal reactive re-renders triggered by state changes.
- Nested `ScrollView` elements work correctly — wheel events route to the innermost scroll container under the cursor.

## See Also

- [Box](./box.md)
- [Layout — Sizing Tiers](../04-layout/sizing-tiers.md)
- [Events — Scroll](../06-events/scroll.md)
