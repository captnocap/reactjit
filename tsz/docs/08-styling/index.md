---
title: Styling
description: Inline styles, Tailwind classes, classifiers, and dynamic style bindings
category: Styling
keywords: style, tailwind, className, classifier, backgroundColor, flexbox, colors, border, shadow
related: Layout, Primitives, Box, Text
difficulty: beginner
---

## Overview

Every primitive accepts a `style` prop (an inline object) and a `className` prop (a Tailwind class string). Both resolve to the same underlying `Style` struct at compile time — there is no runtime CSS engine. Classifiers (`.cls.tsz` files) let you define named styles once and reference them as `<C.Name>` anywhere in your app, functioning as a design system.

## Syntax

### Inline styles

```tsz
<Box style={{ backgroundColor: '#1e1e2a', padding: 16, borderRadius: 8 }}>
  <Text fontSize={18} color="#ffffff">Hello</Text>
</Box>
```

### Tailwind classes

```tsz
<Box className="bg-slate-800 p-4 rounded-lg flex-col gap-2">
  <Text fontSize={18} color="#ffffff">Card</Text>
</Box>
```

### Mixed (className + style)

Both can be used on the same element. The `style` prop wins on conflict.

```tsz
<Box className="flex-col gap-4" style={{ backgroundColor: '#1e1e2a', padding: 24 }}>
  <Text fontSize={16} color="#ccc">Content</Text>
</Box>
```

## Complete Style Property Reference

All properties come from the `Style` struct in `tsz/runtime/layout.zig`. Inline style keys use camelCase.

### Dimensions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `width` | `number \| '100%'` | auto | Fixed width in pixels, or `'100%'` for full parent width |
| `height` | `number \| '100%'` | auto | Fixed height in pixels, or `'100%'` for full parent height |
| `minWidth` | `number` | — | Minimum width floor |
| `maxWidth` | `number` | — | Maximum width ceiling |
| `minHeight` | `number` | — | Minimum height floor |
| `maxHeight` | `number` | — | Maximum height ceiling |
| `aspectRatio` | `number` | — | Derive missing dimension (e.g. `1.77` for 16:9) |

### Flex

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `flexDirection` | `'row' \| 'column'` | `'column'` | Main axis direction |
| `flexGrow` | `number` | `0` | Grow factor — use `1` to fill available space |
| `flexShrink` | `number` | `1` | Shrink factor when overflow |
| `flexBasis` | `number` | auto | Initial size before grow/shrink |
| `flexWrap` | `'nowrap' \| 'wrap'` | `'nowrap'` | Allow children to wrap to next line |
| `justifyContent` | `'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around' \| 'space-evenly'` | `'start'` | Main-axis child distribution |
| `alignItems` | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` | Cross-axis child alignment |
| `alignSelf` | `'auto' \| 'start' \| 'center' \| 'end' \| 'stretch'` | `'auto'` | Override parent's alignItems for this child |
| `gap` | `number` | `0` | Space between children (both axes) |

### Positioning

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | `'relative' \| 'absolute'` | `'relative'` | Absolute removes element from flex flow |
| `top` | `number` | — | Offset from top (absolute only) |
| `left` | `number` | — | Offset from left (absolute only) |
| `right` | `number` | — | Offset from right (absolute only) |
| `bottom` | `number` | — | Offset from bottom (absolute only) |
| `zIndex` | `number` | `0` | Stacking order |

### Padding

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `padding` | `number` | `0` | All four sides |
| `paddingLeft` | `number` | — | Left only (overrides `padding`) |
| `paddingRight` | `number` | — | Right only (overrides `padding`) |
| `paddingTop` | `number` | — | Top only (overrides `padding`) |
| `paddingBottom` | `number` | — | Bottom only (overrides `padding`) |

### Margin

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `margin` | `number` | `0` | All four sides |
| `marginLeft` | `number` | — | Left only (overrides `margin`) |
| `marginRight` | `number` | — | Right only (overrides `margin`) |
| `marginTop` | `number` | — | Top only (overrides `margin`) |
| `marginBottom` | `number` | — | Bottom only (overrides `margin`) |

### Display and Overflow

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `display` | `'flex' \| 'none'` | `'flex'` | Hide element and remove from layout |
| `overflow` | `'visible' \| 'hidden' \| 'scroll'` | `'visible'` | Clip or scroll overflowing content |

### Typography

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `textAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Text alignment (inherited by child Text nodes) |

### Visual

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `backgroundColor` | `string` | transparent | Background fill color (hex string) |
| `borderRadius` | `number` | `0` | Corner rounding in pixels |
| `opacity` | `number` | `1.0` | Element transparency (0.0–1.0) |

### Border

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `borderWidth` | `number` | `0` | Border stroke width in pixels |
| `borderColor` | `string` | — | Border stroke color (hex string) |

### Transform

Transform properties are visual only — they do not affect layout geometry.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rotation` | `number` | `0` | Rotation in degrees |
| `scaleX` | `number` | `1.0` | Horizontal scale factor |
| `scaleY` | `number` | `1.0` | Vertical scale factor |

### Gradient

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `gradientColorEnd` | `string` | — | End color of gradient (hex string); `backgroundColor` is start |
| `gradientDirection` | `'vertical' \| 'horizontal'` | `'none'` | Gradient axis |

### Shadow

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shadowOffsetX` | `number` | `0` | Horizontal shadow offset |
| `shadowOffsetY` | `number` | `0` | Vertical shadow offset |
| `shadowBlur` | `number` | `0` | Shadow blur radius |
| `shadowColor` | `string` | — | Shadow color (hex string) |

## Tailwind Classes

Pass a space-separated string to `className`. Pseudo-variants (`hover:`, `focus:`) are silently stripped — only the base class applies.

### Flex direction

| Class | Effect |
|-------|--------|
| `flex-row` | `flexDirection: row` |
| `flex-col` | `flexDirection: column` |

### Flex grow / shrink

| Class | Effect |
|-------|--------|
| `flex-1` | `flexGrow: 1` |
| `flex-0` | `flexGrow: 0` |
| `flex-grow` | `flexGrow: 1` |
| `flex-shrink` | `flexShrink: 1` |
| `flex-shrink-0` | `flexShrink: 0` |

### Justify content

| Class | Effect |
|-------|--------|
| `justify-start` | `justifyContent: start` |
| `justify-center` | `justifyContent: center` |
| `justify-end` | `justifyContent: end` |
| `justify-between` | `justifyContent: space-between` |
| `justify-around` | `justifyContent: space-around` |
| `justify-evenly` | `justifyContent: space-evenly` |

### Align items

| Class | Effect |
|-------|--------|
| `items-start` | `alignItems: start` |
| `items-center` | `alignItems: center` |
| `items-end` | `alignItems: end` |
| `items-stretch` | `alignItems: stretch` |

### Display / overflow

| Class | Effect |
|-------|--------|
| `hidden` | `display: none` |
| `overflow-hidden` | `overflow: hidden` |
| `overflow-scroll` | `overflow: scroll` |
| `overflow-visible` | `overflow: visible` |

### Width and height

| Class | Effect |
|-------|--------|
| `w-full` | `width: 100%` |
| `h-full` | `height: 100%` |
| `w-{n}` | width from spacing scale |
| `h-{n}` | height from spacing scale |
| `min-w-{n}` | minWidth |
| `max-w-{n}` | maxWidth |
| `min-h-{n}` | minHeight |
| `max-h-{n}` | maxHeight |

### Padding

| Class | Effect |
|-------|--------|
| `p-{n}` | all sides |
| `px-{n}` | left + right |
| `py-{n}` | top + bottom |
| `pl-{n}` | left |
| `pr-{n}` | right |
| `pt-{n}` | top |
| `pb-{n}` | bottom |

### Margin

| Class | Effect |
|-------|--------|
| `m-{n}` | all sides |
| `mx-{n}` | left + right |
| `my-{n}` | top + bottom |
| `ml-{n}` | left |
| `mr-{n}` | right |
| `mt-{n}` | top |
| `mb-{n}` | bottom |

### Gap

| Class | Effect |
|-------|--------|
| `gap-{n}` | gap between children |

### Border radius

| Class | Pixels |
|-------|--------|
| `rounded-none` | 0 |
| `rounded-sm` | 2 |
| `rounded` | 4 |
| `rounded-md` | 6 |
| `rounded-lg` | 8 |
| `rounded-xl` | 12 |
| `rounded-2xl` | 16 |
| `rounded-3xl` | 24 |
| `rounded-full` | 9999 |

### Background colors

Use `bg-{color}-{shade}`:

```tsz
<Box className="bg-blue-500 p-4 rounded-lg">
```

**Supported colors and shades:**

| Color | Shades |
|-------|--------|
| `slate` | 50 100 200 300 400 500 600 700 800 900 950 |
| `gray` | 50 100 200 300 400 500 600 700 800 900 950 |
| `zinc` | 50 100 200 300 400 500 600 700 800 900 950 |
| `red` | 50 100 200 300 400 500 600 700 800 900 |
| `orange` | 400 500 600 |
| `yellow` | 400 500 600 |
| `green` | 50 100 200 300 400 500 600 700 800 900 |
| `blue` | 50 100 200 300 400 500 600 700 800 900 |
| `indigo` | 500 600 700 |
| `purple` | 500 600 700 |
| `violet` | 500 600 700 |
| `pink` | 500 600 700 |
| `rose` | 500 600 700 |
| `cyan` | 400 500 600 |
| `teal` | 400 500 600 |
| `emerald` | 400 500 600 |

Named colors: `bg-white`, `bg-black`.

### Spacing scale

The Tailwind `{n}` suffix maps to pixels (1 unit = 4px):

| n | px | n | px | n | px |
|---|----|----|----|----|-----|
| 0 | 0 | 6 | 24 | 20 | 80 |
| 0.5 | 2 | 7 | 28 | 24 | 96 |
| 1 | 4 | 8 | 32 | 28 | 112 |
| 1.5 | 6 | 9 | 36 | 32 | 128 |
| 2 | 8 | 10 | 40 | 36 | 144 |
| 2.5 | 10 | 11 | 44 | 40 | 160 |
| 3 | 12 | 12 | 48 | 44 | 176 |
| 3.5 | 14 | 14 | 56 | 48 | 192 |
| 4 | 16 | 16 | 64 | 52 | 208 |
| 5 | 20 | | | 56 | 224 |
| | | | | 60 | 240 |
| | | | | 64 | 256 |
| | | | | 72 | 288 |
| | | | | 80 | 320 |
| | | | | 96 | 384 |

### Arbitrary values

Wrap a raw pixel number in square brackets:

```tsz
<Box className="p-[20] gap-[6] w-[350] rounded-[10]">
```

For colors, use a hex value:

```tsz
<Box className="bg-[#1e1e2a] p-4">
```

## Classifiers

A `.cls.tsz` file defines a set of named style presets — the equivalent of a design token system. Define once, use everywhere as `<C.Name>`.

### Defining classifiers

```tsz
// style.cls.tsz
classifier({
  Panel: { type: 'Box', style: { width: '100%', height: '100%', backgroundColor: '#1a1a2e' } },
  Section: { type: 'Box', style: { padding: 24 } },
  Row: { type: 'Box', style: { flexDirection: 'row', marginTop: 16 } },
  Spacer: { type: 'Box', style: { flexGrow: 1 } },

  Card: { type: 'Box', style: { padding: 16, backgroundColor: '#16213e', borderRadius: 8, flexGrow: 1, flexBasis: 0 } },
  Button: { type: 'Pressable', style: { padding: 12, backgroundColor: '#0f3460', borderRadius: 6 } },

  Heading: { type: 'Text', fontSize: 24, color: '#e94560' },
  Caption: { type: 'Text', fontSize: 12, color: '#555555' },
  ButtonText: { type: 'Text', fontSize: 14, color: '#ffffff' },
})
```

Each entry has:
- `type`: the primitive to render (`'Box'`, `'Text'`, `'Pressable'`, etc.)
- `style`: style properties (for Box/Pressable/etc.)
- `fontSize`, `color`: text properties (for Text)

### Using classifiers

Import the `.cls.tsz` file and reference entries as `<C.Name>`:

```tsz
import C from './style.cls.tsz';

function App() {
  return (
    <C.Panel>
      <C.Section>
        <C.Heading>Dashboard</C.Heading>
        <C.Row>
          <C.Card>
            <C.Caption>Metric A</C.Caption>
          </C.Card>
          <C.Card>
            <C.Caption>Metric B</C.Caption>
          </C.Card>
        </C.Row>
        <C.Button>
          <C.ButtonText>Action</C.ButtonText>
        </C.Button>
      </C.Section>
    </C.Panel>
  );
}
```

`<C.Name>` expands to the primitive with its predefined style and text props. You can still pass children to any classifier element.

## Dynamic Styles

Style values can be state-dependent expressions. Any state variable or expression can appear as a style value:

```tsz
function App() {
  const [active, setActive] = useState(0);
  const [size, setSize] = useState(200);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Box style={{
        width: size,
        height: size,
        backgroundColor: active ? '#4ec9b0' : '#569cd6',
        opacity: active ? 1.0 : 0.5,
        borderRadius: size / 10,
      }}>
        <Text fontSize={18} color="#ffffff">{`${size}x${size}`}</Text>
      </Box>

      <Pressable
        onPress={() => setActive(active == 0 ? 1 : 0)}
        style={{ padding: 12, backgroundColor: '#333333', marginTop: 8 }}
      >
        <Text fontSize={14} color="#ffffff">Toggle</Text>
      </Pressable>

      <Pressable
        onPress={() => setSize(size + 50)}
        style={{ padding: 12, backgroundColor: '#333333', marginTop: 4 }}
      >
        <Text fontSize={14} color="#ffffff">Grow</Text>
      </Pressable>
    </Box>
  );
}
```

The compiler detects state-dependent style values and emits them as dynamic bindings that update whenever the referenced state changes.

## Color Formats

Colors are always hex strings in inline styles:

```tsz
backgroundColor: '#1e1e2a'   // 6-digit hex
backgroundColor: '#fff'      // 3-digit hex also accepted
```

In `className`, use Tailwind palette names (`bg-blue-500`) or arbitrary hex (`bg-[#1e1e2a]`).

In `Text` and classifier `color` fields, pass the hex string directly:

```tsz
<Text fontSize={16} color="#4ec9b0">text</Text>
```

Named CSS color strings (like `"white"`, `"gray"`, `"silver"`) are accepted in some contexts but hex is the reliable format.

## Examples

### Card with shadow and gradient

```tsz
function App() {
  return (
    <Box style={{
      padding: 32,
      backgroundColor: '#1e1e2a',
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      gap: 16,
    }}>
      <Box style={{
        padding: 24,
        backgroundColor: '#2d2d4e',
        gradientColorEnd: '#1e1e2a',
        gradientDirection: 'vertical',
        borderRadius: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowBlur: 16,
        shadowColor: '#00000066',
      }}>
        <Text fontSize={24} color="#ffffff">Gradient Card</Text>
        <Text fontSize={14} color="#aaaacc">With drop shadow</Text>
      </Box>
    </Box>
  );
}
```

### Tailwind layout grid

```tsz
function App() {
  return (
    <Box className="flex-col p-6 gap-4 bg-slate-900" style={{ width: '100%', height: '100%' }}>
      <Box className="flex-row gap-4">
        <Box className="flex-1 p-4 bg-slate-800 rounded-lg">
          <Text fontSize={16} color="#ffffff">Column A</Text>
        </Box>
        <Box className="flex-1 p-4 bg-slate-800 rounded-lg">
          <Text fontSize={16} color="#ffffff">Column B</Text>
        </Box>
        <Box className="flex-1 p-4 bg-slate-800 rounded-lg">
          <Text fontSize={16} color="#ffffff">Column C</Text>
        </Box>
      </Box>
      <Box className="p-4 bg-slate-800 rounded-lg flex-1">
        <Text fontSize={14} color="#94a3b8">Content area</Text>
      </Box>
    </Box>
  );
}
```

### Arbitrary Tailwind values

```tsz
function App() {
  return (
    <Box className="flex-col gap-[6] p-[20] bg-[#0d1117]" style={{ width: '100%', height: '100%' }}>
      <Box className="p-[12] rounded-[10] bg-[#161b22]">
        <Text fontSize={14} color="#c9d1d9">Custom spacing and color</Text>
      </Box>
    </Box>
  );
}
```

## Gotchas

- `paddingHorizontal` and `paddingVertical` do not exist — use `paddingLeft`/`paddingRight` and `paddingTop`/`paddingBottom`.
- Root containers need `width: '100%', height: '100%'` or they will shrink-wrap to their content size.
- `flexDirection` defaults to `'column'`, not `'row'`. This is intentional — vertical stacking is the most common layout.
- Tailwind shades outside the supported list (see table above) are silently ignored. If a color doesn't appear, check that the shade exists.
- Pseudo-variants in className (`hover:bg-blue-500`) are stripped — only the base style applies. Hover effects must be done with state.
- `display: 'none'` removes the element from layout entirely, not just visually. Use `opacity: 0` if you need to preserve space.
- `rotation`, `scaleX`, and `scaleY` are visual transforms applied by the compositor. They do not affect hit testing or layout.
- Gradient requires both `gradientColorEnd` and `gradientDirection` — setting only one has no effect.

## See Also

- [Layout](../04-layout/index.md)
- [Box](../03-primitives/box.md)
- [Text](../03-primitives/text.md)
- [State](../05-state/index.md)
