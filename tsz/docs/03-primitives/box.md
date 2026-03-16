---
title: Box
description: Flexbox layout container — the universal building block for all UI structure.
category: Primitives
keywords: box, container, flexbox, layout, style, padding, margin, flex
related: Text, Pressable, ScrollView, Layout
difficulty: beginner
---

## Overview

`Box` is the core layout primitive. Every UI structure in tsz is composed from nested Boxes. It renders as a rectangular region with optional background, border, and shadow — and arranges its children using a CSS-compatible flexbox engine. There is no `div`, no `View`, no `Panel` — just `Box`.

## Syntax

```tsz
function App() {
  return (
    <Box style={{ padding: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={16} color="#ffffff">Hello</Text>
    </Box>
  );
}
```

## Props / API

Box takes a single `style` prop. All layout and visual properties go inside it.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| style | StyleObject | `{}` | All layout and visual properties (see tables below) |

### Flexbox Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `flexDirection` | `'row'` \| `'column'` | `'column'` | Main axis direction |
| `flexGrow` | number | `0` | How much free space this child absorbs |
| `flexShrink` | number | `1` | How much this child shrinks when space is tight |
| `flexBasis` | number | `null` (auto) | Hypothetical size before growing/shrinking |
| `flexWrap` | `'nowrap'` \| `'wrap'` | `'nowrap'` | Whether children wrap to new lines |
| `justifyContent` | `'start'` \| `'center'` \| `'end'` \| `'space-between'` \| `'space-around'` \| `'space-evenly'` | `'start'` | Distribution along the main axis |
| `alignItems` | `'start'` \| `'center'` \| `'end'` \| `'stretch'` | `'stretch'` | Alignment along the cross axis |
| `alignSelf` | `'auto'` \| `'start'` \| `'center'` \| `'end'` \| `'stretch'` | `'auto'` | Per-child cross-axis override |
| `gap` | number | `0` | Pixels between children (and between wrapped lines) |

### Sizing Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | number \| `'100%'` | `null` (auto) | Explicit width in pixels or percentage |
| `height` | number \| `'100%'` | `null` (auto) | Explicit height in pixels or percentage |
| `minWidth` | number | `null` | Minimum width constraint |
| `maxWidth` | number | `null` | Maximum width constraint |
| `minHeight` | number | `null` | Minimum height constraint |
| `maxHeight` | number | `null` | Maximum height constraint |
| `aspectRatio` | number | `null` | Derive missing dimension from the other (e.g. `1.77` for 16:9) |

### Spacing Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `padding` | number | `0` | Uniform inner spacing on all sides |
| `paddingLeft` | number | `null` | Left inner spacing (overrides `padding`) |
| `paddingRight` | number | `null` | Right inner spacing (overrides `padding`) |
| `paddingTop` | number | `null` | Top inner spacing (overrides `padding`) |
| `paddingBottom` | number | `null` | Bottom inner spacing (overrides `padding`) |
| `margin` | number | `0` | Uniform outer spacing on all sides |
| `marginLeft` | number | `null` | Left outer spacing (overrides `margin`) |
| `marginRight` | number | `null` | Right outer spacing (overrides `margin`) |
| `marginTop` | number | `null` | Top outer spacing (overrides `margin`) |
| `marginBottom` | number | `null` | Bottom outer spacing (overrides `margin`) |

### Visual Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `backgroundColor` | `'#rrggbb'` \| `'#rrggbbaa'` | `null` | Fill color (transparent if omitted) |
| `borderRadius` | number | `0` | Corner rounding in pixels |
| `borderWidth` | number | `0` | Border thickness in pixels |
| `borderColor` | `'#rrggbb'` | `null` | Border color |
| `opacity` | number | `1.0` | Transparency — `0.0` fully transparent, `1.0` fully opaque |
| `zIndex` | number | `0` | Stacking order within the same parent |

### Transform Properties

Transforms are visual-only — they do not affect layout.

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `rotation` | number | `0` | Rotation in degrees |
| `scaleX` | number | `1.0` | Horizontal scale factor |
| `scaleY` | number | `1.0` | Vertical scale factor |

### Gradient Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `gradientColorEnd` | `'#rrggbb'` | `null` | End color for gradient (start color is `backgroundColor`) |
| `gradientDirection` | `'vertical'` \| `'horizontal'` | `'none'` | Gradient axis (`'none'` disables gradient) |

### Shadow Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `shadowOffsetX` | number | `0` | Horizontal shadow offset in pixels |
| `shadowOffsetY` | number | `0` | Vertical shadow offset in pixels |
| `shadowBlur` | number | `0` | Shadow blur radius in pixels |
| `shadowColor` | `'#rrggbb'` | `null` | Shadow color |

### Positioning Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `position` | `'relative'` \| `'absolute'` | `'relative'` | `'absolute'` removes from flow and positions relative to parent |
| `top` | number | `null` | Offset from top (absolute only) |
| `left` | number | `null` | Offset from left (absolute only) |
| `right` | number | `null` | Offset from right (absolute only) |
| `bottom` | number | `null` | Offset from bottom (absolute only) |

### Display / Overflow Properties

| Style Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `display` | `'flex'` \| `'none'` | `'flex'` | `'none'` removes the node from layout and painting |
| `overflow` | `'visible'` \| `'hidden'` \| `'scroll'` | `'visible'` | Clip children to box bounds |
| `textAlign` | `'left'` \| `'center'` \| `'right'` | `'left'` | Text alignment — inherited by child Text nodes |

## Examples

### Basic Container

```tsz
function App() {
  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={16} color="#ffffff">Content goes here</Text>
    </Box>
  );
}
```

### Row Layout

```tsz
function App() {
  return (
    <Box style={{ flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={14} color="#aaaaaa">Left</Text>
      <Text fontSize={14} color="#aaaaaa">Center</Text>
      <Text fontSize={14} color="#aaaaaa">Right</Text>
    </Box>
  );
}
```

### Nested Boxes

```tsz
function App() {
  return (
    <Box style={{ padding: 16, backgroundColor: '#1e1e2a', gap: 12 }}>
      <Box style={{ padding: 12, backgroundColor: '#2d2d3f', borderRadius: 8 }}>
        <Text fontSize={14} color="#ffffff">Card one</Text>
      </Box>
      <Box style={{ padding: 12, backgroundColor: '#2d2d3f', borderRadius: 8 }}>
        <Text fontSize={14} color="#ffffff">Card two</Text>
      </Box>
    </Box>
  );
}
```

### Responsive Layout with flexGrow

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'column' }}>
      <Box style={{ padding: 12, backgroundColor: '#16161e' }}>
        <Text fontSize={14} color="#aaaaaa">Header — fixed size</Text>
      </Box>
      <Box style={{ flexGrow: 1, padding: 24, backgroundColor: '#1e1e2a' }}>
        <Text fontSize={16} color="#ffffff">Main content — fills remaining space</Text>
      </Box>
      <Box style={{ padding: 12, backgroundColor: '#16161e' }}>
        <Text fontSize={12} color="#666688">Footer — fixed size</Text>
      </Box>
    </Box>
  );
}
```

### Gradient Background

```tsz
function App() {
  return (
    <Box style={{
      width: 300,
      height: 80,
      borderRadius: 12,
      backgroundColor: '#4ec9b0',
      gradientColorEnd: '#569cd6',
      gradientDirection: 'horizontal',
    }}>
      <Text fontSize={18} color="#ffffff">Gradient</Text>
    </Box>
  );
}
```

## Internals

`Box` compiles to a `layout.Node` struct literal in the generated `.zig` file. Style properties map directly to fields on `layout.Style`. The codegen function `parseStyleAttr` reads the `style={{ ... }}` object and emits the corresponding Zig struct fields — `backgroundColor` becomes `.background_color = Color.rgb(...)`, `flexDirection: 'row'` becomes `.flex_direction = .row`, and so on. No allocation, no dictionary lookup — the mapping is resolved at compile time.

## Gotchas

- Root containers need `width: '100%', height: '100%'` to fill the window. Without it, the root Box shrink-wraps its children and may not fill the screen.
- Use `flexGrow: 1` to fill remaining space, not a hardcoded pixel height. Hardcoded heights break when the window is resized or when siblings change size.
- `paddingHorizontal` and `paddingVertical` are not supported. Use `paddingLeft` + `paddingRight` or `paddingTop` + `paddingBottom`.
- `position: 'absolute'` is relative to the parent Box, not the window. Nest inside the correct ancestor.
- `display: 'none'` completely removes the node from layout — it takes no space and is invisible. There is no `visibility: 'hidden'` equivalent; use `opacity: 0` if you need to preserve space.
- `overflow: 'scroll'` on a Box does not enable scrolling by itself — use `ScrollView` for scrollable regions.
- Transforms (`rotation`, `scaleX`, `scaleY`) are visual-only. A rotated Box still occupies its original layout rectangle for hit-testing and child placement.

## See Also

- [Text](./text.md)
- [Pressable](./pressable.md)
- [ScrollView](./scroll-view.md)
- [Layout — Sizing Tiers](../04-layout/sizing-tiers.md)
- [Layout — Flexbox](../04-layout/flexbox.md)
