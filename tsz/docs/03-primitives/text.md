---
title: Text
description: Native text rendering via FreeType — the only way to display text in tsz.
category: Primitives
keywords: text, font, freetype, color, fontSize, dynamic, template literal
related: Box, Pressable, Layout
difficulty: beginner
---

## Overview

`Text` renders a string using FreeType glyph rasterization. All visible text in a tsz app goes through this primitive — there is no HTML text node, no canvas `fillText`, no other path. Font faces are resolved at startup via fontconfig from the system font database. Glyphs are cached per codepoint per size, so repeated renders of the same text are cheap.

## Syntax

```tsz
function App() {
  return (
    <Box style={{ padding: 16 }}>
      <Text fontSize={16} color="#ffffff">Hello, world</Text>
    </Box>
  );
}
```

Dynamic text uses a template literal inside `{}`:

```tsz
<Text fontSize={16} color="#ffffff">{`Count: ${count}`}</Text>
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fontSize` | number | `16` | Font size in pixels |
| `color` | `'#rrggbb'` \| `'#rrggbbaa'` | `null` (white) | Text color as a hex string |
| `letterSpacing` | number | `0` | Extra pixels between glyphs |
| `lineHeight` | number | `0` | Override line height in pixels (`0` uses the font's natural line height) |
| `numberOfLines` | number | `0` | Max visible lines (`0` = unlimited) |
| `style` | StyleObject | `{}` | Layout properties — same as Box (see Box docs) |

### Children

Text content is the JSX children of `<Text>`. Two forms are supported:

**Static string** — placed directly inside the tags:

```tsz
<Text fontSize={14} color="#aaaaaa">Static text</Text>
```

**Dynamic expression** — a template literal inside `{}`:

```tsz
<Text fontSize={14} color="#aaaaaa">{`Value: ${someVariable}`}</Text>
```

Do not mix a static string and an expression in the same `<Text>`. Use a template literal for any text that contains a variable.

## Examples

### Basic Text

```tsz
function App() {
  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={24} color="#ffffff">Heading</Text>
      <Text fontSize={14} color="#888899">Subheading with a smaller size</Text>
    </Box>
  );
}
```

### Styled Text

```tsz
function App() {
  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a', gap: 8 }}>
      <Text fontSize={32} color="#ff79c6">Large pink text</Text>
      <Text fontSize={14} color="#4ec9b0" letterSpacing={2}>Tracked teal text</Text>
      <Text fontSize={12} color="#666688" numberOfLines={1}>
        This text is clamped to one line no matter how long it gets — it will truncate
      </Text>
    </Box>
  );
}
```

### Dynamic Text with State

```tsz
function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', gap: 16 }}>
      <Text fontSize={48} color="#ff79c6">{`${count}`}</Text>
      <Text fontSize={16} color="#78788c">{`Count is: ${count}`}</Text>
      <Pressable onPress={() => setCount(count + 1)} style={{ padding: 16, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={16} color="#ffffff">Increment</Text>
      </Pressable>
    </Box>
  );
}
```

### Text with Computed Values

```tsz
function App() {
  const [count, setCount] = useState(0);
  const doubled = count * 2;
  const label = count > 10 ? 'HIGH' : 'LOW';

  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a', gap: 8 }}>
      <Text fontSize={16} color="#aaaaaa">{`Count: ${count} (${label})`}</Text>
      <Text fontSize={14} color="#4ec9b0">{`Doubled: ${doubled}`}</Text>
    </Box>
  );
}
```

### Inherited Text Alignment

`textAlign` is set on the parent Box and inherited by child Text nodes:

```tsz
function App() {
  return (
    <Box style={{ width: 300, padding: 24, backgroundColor: '#1e1e2a', textAlign: 'center' }}>
      <Text fontSize={20} color="#ffffff">Centered heading</Text>
      <Text fontSize={14} color="#888899">Also centered</Text>
    </Box>
  );
}
```

To override alignment for a specific Text node, set `textAlign` in the Text's own `style` prop:

```tsz
<Text fontSize={14} color="#888899" style={{ textAlign: 'right' }}>Right-aligned</Text>
```

## Internals

`Text` compiles to a `layout.Node` with `.text` set to the string content and `.font_size`, `.text_color`, `.letter_spacing`, `.line_height`, `.number_of_lines` set from props. Dynamic text (`{`...`}`) generates a format string with state slot references that the runtime evaluates each frame. The layout engine calls `text.measureText` to compute the node's natural size, which FreeType measures by summing glyph advances. Glyphs are rasterized into SDL2 textures and cached in a 512-entry table keyed by `(codepoint, size_px)`.

## Gotchas

- **Do not mix static text and expressions** in the same `<Text>`. Write `{`Hello ${name}`}` not `Hello {name}`. The parser expects either a plain string or a single template literal expression.
- **`fontSize` is a prop, not a style property.** Pass it directly on the element (`fontSize={16}`), not inside `style={{ fontSize: 16 }}`.
- **`color` is a prop, not a style property.** Same rule — `color="#ffffff"` on the element, not in `style`.
- **Text has no bold/italic props** at the component level. The font face is selected by fontconfig from the system. To render bold text, change the font weight via fontconfig configuration or use a different font family.
- **Percentage widths on Text nodes** may not size as expected. Text nodes auto-size from measured glyph metrics. If you need a fixed-width text block, wrap it in a Box with explicit width.
- **`textAlign` is inherited** from the parent Box. You don't need to set it on every Text node — set it once on the container.
- **Emoji** are rendered using color bitmap fonts when available. Color glyphs ignore the `color` prop — they render in their native colors.

## See Also

- [Box](./box.md)
- [Pressable](./pressable.md)
- [Layout — Sizing Tiers](../04-layout/sizing-tiers.md)
- [Styling — Colors](../08-styling/colors.md)
