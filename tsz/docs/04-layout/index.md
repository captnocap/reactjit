---
title: Layout
description: The flexbox layout engine — how sizing, positioning, and space distribution work in tsz.
category: Layout
keywords: flexbox, flex, layout, sizing, flexGrow, flexBasis, flexDirection, justifyContent, alignItems, gap, padding, margin, percentage, absolute, proportional fallback
related: Box, ScrollView, Primitives
difficulty: intermediate
---

## Overview

Every node in tsz is laid out by a single-pass flexbox engine ported from the CSS specification. It is pixel-perfect against Firefox — stress-tested against every property combination. The same algorithm powers both the app layer and the framework's own devtools UI.

Layout runs once per frame, top-down, computing an `{x, y, w, h}` rect for every node in the tree. There is no virtual DOM diff, no layout invalidation queue, no dirty flags. The tree is walked, positions are written, the frame is painted.

---

## The Flexbox Model

Every node is a flex container. The key properties are:

| Property | Default | What it controls |
|----------|---------|-----------------|
| `flexDirection` | `'column'` | Main axis direction |
| `flexGrow` | `0` | How much free space a child absorbs |
| `flexShrink` | `1` | How much a child gives up when space is tight |
| `flexBasis` | `auto` | Starting size on the main axis before grow/shrink |
| `flexWrap` | `'nowrap'` | Whether children wrap to new lines |
| `justifyContent` | `'start'` | Distribution along the main axis |
| `alignItems` | `'stretch'` | Alignment along the cross axis |
| `alignSelf` | `'auto'` | Per-child override of `alignItems` |
| `gap` | `0` | Space between children (and between wrap lines) |

**`flexDirection` defaults to `'column'`** — this is intentional and matches how most app UIs are structured top-to-bottom. Web developers accustomed to `row` as default should note this difference.

---

## Sizing Tiers

When the engine resolves a node's size, it follows a strict priority order. The first matching tier wins:

### Tier 1: Explicit dimensions

If `width` or `height` is set, that value is used directly. Percentage strings (`'100%'`) resolve against the parent's inner dimension. Min/max constraints are applied after resolution.

```tsz
// Fixed 200px wide, 100px tall
<Box style={{ width: 200, height: 100 }} />

// Fill parent width exactly
<Box style={{ width: '100%' }} />

// Fill with constraints
<Box style={{ width: '100%', maxWidth: 600 }} />
```

### Tier 2: Content auto-sizing (shrink-wrap)

If no explicit dimension is set, the node shrinks to fit its children:
- **Text nodes** are measured via FreeType and sized to their rendered dimensions
- **Image nodes** use the image's natural pixel dimensions
- **Containers** sum children on the main axis and take the max on the cross axis

```tsz
// This Box is exactly as wide and tall as its Text content
<Box>
  <Text fontSize={14} color="#fff">Hello</Text>
</Box>
```

### Tier 3: Fill parent (default width behavior)

If a node has no explicit width and no intrinsic content, its width fills the parent's inner width. This is why `alignItems: 'stretch'` (the default) makes children fill the cross axis of their container without any explicit width.

---

## Proportional Fallback

When a container has no explicit height, no content to measure, and no children with known sizes, it falls back to receiving a proportional share of its parent. This prevents empty containers from collapsing to zero and creating invisible layout bugs.

The fallback is **1/4 of the parent's available space** on the relevant axis.

This rule applies to empty surfaces — a `Box` with no children, no text, and no explicit height. Once you add content or set `flexGrow: 1`, the fallback no longer applies.

```tsz
// This gets 1/4 of parent height — probably not what you want
<Box style={{ backgroundColor: '#ff0000' }} />

// This fills remaining space — correct
<Box style={{ flexGrow: 1, backgroundColor: '#ff0000' }} />
```

---

## Root Container Rules

The root node of every app must declare its own size explicitly. It cannot rely on a parent to fill from, because there is no parent at the root.

```tsz
// Correct: root fills the window
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#1e1e2a' }}>
      {/* children */}
    </Box>
  );
}
```

Without `width: '100%'` and `height: '100%'` on the root, the app will render at zero or indeterminate size.

---

## flex Properties

### flexGrow

A child with `flexGrow > 0` absorbs free space on the main axis after all other children are sized. Multiple growing children divide space proportionally by their `flexGrow` ratio.

```tsz
// Sidebar fixed, content takes the rest
<Box style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
  <Box style={{ width: 200, backgroundColor: '#16213e' }} />
  <Box style={{ flexGrow: 1, backgroundColor: '#0d0d1a' }} />
</Box>
```

```tsz
// Three columns — left gets 1/4, center gets 2/4, right gets 1/4
<Box style={{ flexDirection: 'row', width: '100%' }}>
  <Box style={{ flexGrow: 1, flexBasis: 0 }} />
  <Box style={{ flexGrow: 2, flexBasis: 0 }} />
  <Box style={{ flexGrow: 1, flexBasis: 0 }} />
</Box>
```

When using `flexGrow` for proportional columns, always set `flexBasis: 0`. Otherwise the items start at their intrinsic size and grow from there, producing unequal results when children have different content.

### flexShrink

When children overflow the container on the main axis, shrink distributes the overflow proportionally. Default is `1` (CSS default). Set to `0` to prevent a child from shrinking below its natural size.

```tsz
// Icon never shrinks; label takes the squeeze
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ width: 24, height: 24, flexShrink: 0 }} />
  <Text style={{ flexShrink: 1 }} fontSize={14} color="#fff">{label}</Text>
</Box>
```

### flexBasis

The starting size of a child on the main axis before grow/shrink applies. Takes priority over `width`/`height` for the main axis.

- `null` (default): uses the child's natural width or height
- A pixel value: fixed starting size
- `0`: ignore natural size entirely — pure grow ratio

```tsz
// Equal thirds regardless of content
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ flexBasis: 0, flexGrow: 1 }} />
  <Box style={{ flexBasis: 0, flexGrow: 1 }} />
  <Box style={{ flexBasis: 0, flexGrow: 1 }} />
</Box>
```

### flexWrap

By default children never wrap — they stay on one line and may overflow or shrink. Set `flexWrap: 'wrap'` to let children flow onto new lines when they exceed the container width.

```tsz
// Tag cloud — chips wrap naturally
<Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
  <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, backgroundColor: '#4ec9b0', borderRadius: 12 }}>
    <Text fontSize={12} color="#fff">Zig</Text>
  </Box>
  <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, backgroundColor: '#569cd6', borderRadius: 12 }}>
    <Text fontSize={12} color="#fff">SDL2</Text>
  </Box>
  {/* more chips... */}
</Box>
```

`gap` applies both between items on a line and between lines when wrapping.

---

## Alignment

### justifyContent

Controls how children are distributed along the **main axis** (the direction of `flexDirection`).

| Value | Behavior |
|-------|----------|
| `'start'` | Pack at the start (default) |
| `'center'` | Center as a group |
| `'end'` | Pack at the end |
| `'space-between'` | First and last at edges, equal gaps between |
| `'space-around'` | Equal space around each item (half-size at edges) |
| `'space-evenly'` | Equal space between all items and edges |

```tsz
// Evenly spaced row of three items
<Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
  <Box style={{ width: 60, height: 60 }} />
  <Box style={{ width: 60, height: 60 }} />
  <Box style={{ width: 60, height: 60 }} />
</Box>
```

### alignItems

Controls how children are positioned on the **cross axis** (perpendicular to `flexDirection`).

| Value | Behavior |
|-------|----------|
| `'stretch'` | Stretch to fill cross axis (default) |
| `'start'` | Align to cross-start |
| `'center'` | Center on cross axis |
| `'end'` | Align to cross-end |

```tsz
// Vertically center children in a row
<Box style={{ flexDirection: 'row', alignItems: 'center', height: 80 }}>
  <Text fontSize={14} color="#fff">Label</Text>
  <Box style={{ width: 24, height: 24, backgroundColor: '#4ec9b0' }} />
</Box>
```

### alignSelf

A per-child override of the parent's `alignItems`. Useful when one child needs different cross-axis behavior than its siblings.

| Value | Behavior |
|-------|----------|
| `'auto'` | Inherit parent's `alignItems` (default) |
| `'start'` | Align to cross-start |
| `'center'` | Center on cross axis |
| `'end'` | Align to cross-end |
| `'stretch'` | Stretch to fill cross axis |

```tsz
// Most children stretch; avatar stays intrinsic size
<Box style={{ flexDirection: 'row', alignItems: 'stretch' }}>
  <Box style={{ alignSelf: 'center', width: 40, height: 40, borderRadius: 20 }} />
  <Box style={{ flexGrow: 1 }}>
    <Text fontSize={14} color="#fff">Name</Text>
    <Text fontSize={11} color="#888">Status</Text>
  </Box>
</Box>
```

---

## Spacing

### gap

Uniform space between children on the main axis. When `flexWrap: 'wrap'` is set, `gap` also applies between lines.

```tsz
<Box style={{ gap: 12 }}>
  <Text fontSize={16} color="#fff">Item A</Text>
  <Text fontSize={16} color="#fff">Item B</Text>
  <Text fontSize={16} color="#fff">Item C</Text>
</Box>
```

### padding

Space inside the node, between its border and its children. Shorthand sets all four sides; per-side overrides take priority.

| Prop | Type | Default |
|------|------|---------|
| `padding` | `number` | `0` |
| `paddingTop` | `number` | `undefined` |
| `paddingBottom` | `number` | `undefined` |
| `paddingLeft` | `number` | `undefined` |
| `paddingRight` | `number` | `undefined` |

Per-side values override the shorthand. `paddingLeft: 16` with `padding: 8` gives left=16, all others=8.

Do **not** use `paddingHorizontal` or `paddingVertical` — these are rejected by the linter. Use explicit per-side props.

### margin

Space outside the node, between it and its siblings (and the parent's padding edge). Same structure as padding.

| Prop | Type | Default |
|------|------|---------|
| `margin` | `number` | `0` |
| `marginTop` | `number` | `undefined` |
| `marginBottom` | `number` | `undefined` |
| `marginLeft` | `number` | `undefined` |
| `marginRight` | `number` | `undefined` |

---

## Percentage Values

Width and height accept percentage strings. The percentage resolves against the parent's inner dimension (after padding).

```tsz
// Half of parent's inner width
<Box style={{ width: '50%' }} />

// Full height of parent
<Box style={{ height: '100%' }} />
```

`minWidth`, `maxWidth`, `minHeight`, `maxHeight`, and `flexBasis` also accept percentage values.

```tsz
// Grows but caps at half the parent width
<Box style={{ flexGrow: 1, maxWidth: '50%' }} />
```

Percentages are encoded internally as negative floats (`-0.5` = 50%). This is a compiler detail — in `.tsz` source, always write the string form: `'100%'`, `'50%'`.

---

## Absolute Positioning

Setting `position: 'absolute'` removes a node from the flex flow. It no longer contributes to its siblings' layout. It is positioned relative to the nearest parent's **padding box** using `top`, `left`, `right`, `bottom`.

```tsz
// Notification dot pinned to top-right of card
<Box style={{ position: 'relative', padding: 16, backgroundColor: '#1a1a2e' }}>
  <Text fontSize={16} color="#fff">Card content</Text>
  <Box style={{
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    backgroundColor: '#ff4444',
    borderRadius: 6
  }} />
</Box>
```

Sizing rules for absolute children:
- **Width**: explicit `width` > `left + right` constraint (derives width from both anchors) > intrinsic
- **Height**: explicit `height` > `top + bottom` constraint > intrinsic

```tsz
// Absolute overlay fills parent entirely
<Box style={{
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)'
}} />
```

---

## Constraints

`minWidth`, `maxWidth`, `minHeight`, `maxHeight` clamp the resolved size after grow/shrink distribution. They accept pixels or percentage strings.

```tsz
// Grows but never smaller than 80px or larger than 200px
<Box style={{ flexGrow: 1, minWidth: 80, maxWidth: 200 }} />
```

The flex algorithm handles min/max correctly across multiple passes — if a child hits its max, the remaining free space is redistributed to unfrozen siblings.

---

## Aspect Ratio

`aspectRatio` derives the missing dimension from the known one.

```tsz
// Square avatar
<Box style={{ width: 48, aspectRatio: 1, borderRadius: 24 }} />

// 16:9 video frame
<Box style={{ width: '100%', aspectRatio: 1.778 }} />
```

If both `width` and `height` are explicit, `aspectRatio` has no effect.

---

## Display None

`display: 'none'` hides a node and removes it entirely from layout. It occupies zero space and is invisible to siblings.

```tsz
<Box style={{ display: isVisible ? 'flex' : 'none' }}>
  <Text fontSize={14} color="#fff">Conditional content</Text>
</Box>
```

---

## Examples

### Row layout with sidebar

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row' }}>
      <Box style={{ width: 220, backgroundColor: '#16213e', padding: 16, gap: 8 }}>
        <Text fontSize={14} color="#e94560">Navigation</Text>
        <Text fontSize={12} color="#aabbcc">Dashboard</Text>
        <Text fontSize={12} color="#aabbcc">Settings</Text>
      </Box>
      <Box style={{ flexGrow: 1, backgroundColor: '#0d0d1a', padding: 24 }}>
        <Text fontSize={20} color="#ffffff">Main content</Text>
      </Box>
    </Box>
  );
}
```

### Responsive columns with flexGrow

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, backgroundColor: '#1e1e2a', borderRadius: 8 }}>
          <Text fontSize={13} color="#4ec9b0">CPU</Text>
          <Text fontSize={24} color="#ffffff">42%</Text>
        </Box>
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, backgroundColor: '#1e1e2a', borderRadius: 8 }}>
          <Text fontSize={13} color="#569cd6">Memory</Text>
          <Text fontSize={24} color="#ffffff">2.1 GB</Text>
        </Box>
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 16, backgroundColor: '#1e1e2a', borderRadius: 8 }}>
          <Text fontSize={13} color="#c678dd">Disk</Text>
          <Text fontSize={24} color="#ffffff">58%</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

### Centered content

```tsz
function App() {
  return (
    <Box style={{
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0d0d1a'
    }}>
      <Box style={{ padding: 32, backgroundColor: '#1e1e2a', borderRadius: 16, gap: 12, alignItems: 'center' }}>
        <Text fontSize={28} color="#ffffff">Hello</Text>
        <Text fontSize={14} color="#888899">Welcome to tsz</Text>
      </Box>
    </Box>
  );
}
```

### Two-panel layout with header and footer

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0d0d1a', gap: 0 }}>
      {/* Header */}
      <Box style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, backgroundColor: '#1a1a2e' }}>
        <Text fontSize={16} color="#ffffff">My App</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={12} color="#666688">v1.0</Text>
      </Box>

      {/* Body: sidebar + content */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        <Box style={{ width: 200, backgroundColor: '#12122a', padding: 12, gap: 6 }}>
          <Text fontSize={12} color="#4ec9b0">Section A</Text>
          <Text fontSize={12} color="#4ec9b0">Section B</Text>
        </Box>
        <Box style={{ flexGrow: 1, padding: 24, gap: 12 }}>
          <Text fontSize={18} color="#ffffff">Content area</Text>
          <Text fontSize={13} color="#888899">Body text goes here.</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box style={{ height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' }}>
        <Text fontSize={11} color="#555566">Status: OK</Text>
      </Box>
    </Box>
  );
}
```

---

## Common Anti-Patterns

### Hardcoded pixel heights to fit a known window size

This breaks when the window resizes or content changes.

```tsz
// Bad: hardcoded to assume 900px window minus 60px header
<Box style={{ height: 840 }}>

// Good: use flexGrow to fill remaining space
<Box style={{ flexGrow: 1 }}>
```

### Manual pixel budgeting

Computing sizes by hand and distributing them manually creates layouts that break the moment any value changes.

```tsz
// Bad: three columns that must add up to 900
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ width: 300 }} />
  <Box style={{ width: 300 }} />
  <Box style={{ width: 300 }} />
</Box>

// Good: let flex distribute
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ flexGrow: 1, flexBasis: 0 }} />
  <Box style={{ flexGrow: 1, flexBasis: 0 }} />
  <Box style={{ flexGrow: 1, flexBasis: 0 }} />
</Box>
```

### Fixed dimensions where auto-sizing works

Setting explicit sizes on containers that should shrink-wrap their content prevents the layout engine from adapting to content changes.

```tsz
// Bad: hardcoded height for a button
<Box style={{ width: 120, height: 40, padding: 10 }}>
  <Text fontSize={14} color="#fff">Click me</Text>
</Box>

// Good: let padding and text size determine the height
<Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10 }}>
  <Text fontSize={14} color="#fff">Click me</Text>
</Box>
```

### Forgetting flexBasis: 0 on proportional columns

Without `flexBasis: 0`, columns start at their content size and grow from there. A column with more text will be wider even if all `flexGrow` values are equal.

```tsz
// Bad: unequal starting points make "equal" grow unequal
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ flexGrow: 1 }}><Text fontSize={12} color="#fff">Short</Text></Box>
  <Box style={{ flexGrow: 1 }}><Text fontSize={12} color="#fff">Much longer text</Text></Box>
</Box>

// Good: force equal starting size
<Box style={{ flexDirection: 'row' }}>
  <Box style={{ flexGrow: 1, flexBasis: 0 }}><Text fontSize={12} color="#fff">Short</Text></Box>
  <Box style={{ flexGrow: 1, flexBasis: 0 }}><Text fontSize={12} color="#fff">Much longer text</Text></Box>
</Box>
```

### Missing root dimensions

```tsz
// Bad: root has no declared size
function App() {
  return <Box style={{ backgroundColor: '#0d0d1a' }}>{/* ... */}</Box>;
}

// Good: root fills the viewport
function App() {
  return <Box style={{ width: '100%', height: '100%', backgroundColor: '#0d0d1a' }}>{/* ... */}</Box>;
}
```

### ScrollView without explicit height

`ScrollView` is excluded from the proportional fallback. Without an explicit height (or `flexGrow: 1` in a flex context that provides a definite height), it collapses.

```tsz
// Bad: ScrollView with no height
<ScrollView>...</ScrollView>

// Good: explicit height
<ScrollView style={{ height: 300 }}>...</ScrollView>

// Also good: flexGrow in a definite-height container
<Box style={{ flexGrow: 1 }}>
  <ScrollView style={{ flexGrow: 1 }}>...</ScrollView>
</Box>
```

---

## Style Property Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `width` | `number \| string` | `undefined` | Explicit width in px or `'N%'` |
| `height` | `number \| string` | `undefined` | Explicit height in px or `'N%'` |
| `minWidth` | `number \| string` | `undefined` | Minimum width constraint |
| `maxWidth` | `number \| string` | `undefined` | Maximum width constraint |
| `minHeight` | `number \| string` | `undefined` | Minimum height constraint |
| `maxHeight` | `number \| string` | `undefined` | Maximum height constraint |
| `flexDirection` | `'row' \| 'column'` | `'column'` | Main axis direction |
| `flexGrow` | `number` | `0` | Proportion of free space to absorb |
| `flexShrink` | `number` | `1` | Proportion of overflow to give up |
| `flexBasis` | `number \| string` | `undefined` | Starting size before grow/shrink |
| `flexWrap` | `'nowrap' \| 'wrap'` | `'nowrap'` | Line wrapping behavior |
| `justifyContent` | `'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around' \| 'space-evenly'` | `'start'` | Main axis distribution |
| `alignItems` | `'stretch' \| 'start' \| 'center' \| 'end'` | `'stretch'` | Cross axis alignment |
| `alignSelf` | `'auto' \| 'stretch' \| 'start' \| 'center' \| 'end'` | `'auto'` | Per-child cross axis override |
| `gap` | `number` | `0` | Space between children (and lines) |
| `padding` | `number` | `0` | Inner spacing, all sides |
| `paddingTop` | `number` | `undefined` | Inner spacing, top side |
| `paddingBottom` | `number` | `undefined` | Inner spacing, bottom side |
| `paddingLeft` | `number` | `undefined` | Inner spacing, left side |
| `paddingRight` | `number` | `undefined` | Inner spacing, right side |
| `margin` | `number` | `0` | Outer spacing, all sides |
| `marginTop` | `number` | `undefined` | Outer spacing, top side |
| `marginBottom` | `number` | `undefined` | Outer spacing, bottom side |
| `marginLeft` | `number` | `undefined` | Outer spacing, left side |
| `marginRight` | `number` | `undefined` | Outer spacing, right side |
| `position` | `'relative' \| 'absolute'` | `'relative'` | Flow mode |
| `top` | `number` | `undefined` | Absolute offset from parent top |
| `bottom` | `number` | `undefined` | Absolute offset from parent bottom |
| `left` | `number` | `undefined` | Absolute offset from parent left |
| `right` | `number` | `undefined` | Absolute offset from parent right |
| `aspectRatio` | `number` | `undefined` | width/height ratio |
| `display` | `'flex' \| 'none'` | `'flex'` | Hide and remove from layout |
| `overflow` | `'visible' \| 'hidden' \| 'scroll'` | `'visible'` | Clip or scroll overflow |

---

## Internals

The layout engine lives in `tsz/runtime/layout.zig`. It is a direct port of `love2d/lua/layout.lua` — both are co-references and fixes flow both directions.

The algorithm runs as a single recursive descent:

1. **Resolve own size** — explicit dimensions, flex-assigned width from parent, percentage resolution, min/max clamping
2. **Collect visible children** — compute intrinsic sizes bottom-up, separate out absolute-positioned children
3. **Split into flex lines** — for `flexWrap: 'wrap'`, group children into lines that fit within the main axis
4. **Distribute space per line** — multi-pass grow (with max-constraint redistribution), proportional shrink with min-content floor
5. **Re-measure text nodes** — after flex distribution finalizes widths, text nodes are re-measured for correct wrapping height
6. **Compute cross axis** — line height, stretch, alignment offsets
7. **Position children** — write `{x, y, w, h}` for each child and recurse
8. **Lay out absolute children** — positioned independently, out of flow
9. **Auto-height** — if no explicit height, shrink-wrap to content extents

Percentages are encoded as negative floats: `-0.5` means `50%` of parent. This avoids a union type for dimensions.

---

## See Also

- [Box](../03-primitives/box.md)
- [ScrollView](../03-primitives/scroll-view.md)
- [Styling](../08-styling/index.md)
- [Troubleshooting](../12-troubleshooting/index.md)
