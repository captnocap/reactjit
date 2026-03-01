---
name: reactjit-new-poc
description: >
  Scaffold and build a new ReactJIT PoC demo. Use when the user asks to "make a demo",
  "new PoC", "new example", "scaffold a project", "build me a ... demo", "create a
  new app", or wants to prototype any UI idea in the examples/ directory. Covers all
  targets (Love2D, terminal, web, CC, Neovim, Hammerspoon, AwesomeWM).
---

# New ReactJIT PoC Demo

## Workflow

```bash
cd examples/
reactjit init <name>        # scaffolds everything — do NOT mkdir or copy files manually
cd <name>
# write src/App.tsx (and any sub-components under src/)
reactjit lint               # after every component change
reactjit build              # lint gate + bundle
reactjit screenshot --output /tmp/preview.png   # visual verify — read the image
reactjit build dist:<target>  # when ready to ship (love, terminal, web, cc, nvim, hs, awesome)
```

That's the entire workflow. The CLI handles entry points, esbuild flags, runtime files,
and distribution packaging. The only files to edit are under `src/`.

## Writing Components

Import primitives from `@reactjit/core`:

```tsx
import React, { useState } from 'react';
import { Box, Text, Pressable, Image, ScrollView, TextInput, Modal } from '@reactjit/core';
```

Also available: `Slider`, `Switch`, `Checkbox`, `Radio`, `RadioGroup`, `Select`, `FlatList`.

Animation: `useAnimation`, `useSpring`, `AnimatedValue`, `Easing`, `parallel`, `sequence`, `stagger`, `loop`.

Bridge hooks (Love2D ↔ JS): `useLove`, `useLoveEvent`, `useLoveRPC`, `useLoveState`, `useLoveReady`, `useLoveSend`.

## Layout Rules

These cause silent broken layouts if violated. The linter catches all of them.

1. **Root container** — `width: '100%', height: '100%'`. Never `flexGrow: 1` on root.
2. **Every `<Text>` needs `fontSize`** — unmeasurable without it.
3. **Row + `justifyContent` needs `width`** — Box has no intrinsic width.
4. **Template literals for dynamic text** — `` {`Count: ${n}`} `` not `Count: {n}`.
5. **No `█` in `<Text>`** — use `<Box backgroundColor="..." />` for filled pixels.
6. **Auto-sizing works** — containers without explicit dimensions size to fit children (bottom-up measurement). Use it for cards, badges, labels. Only set explicit dims on root, percentage-child parents, or performance-critical layouts (10+ children).
7. **Fill the viewport** — Love2D is a fixed canvas, not a scrolling page. Think in rows.

Escape hatch: `// rjit-ignore-next-line` suppresses lint for the next JSX element.

## Minimal Valid App

```tsx
import React, { useState } from 'react';
import { Box, Text, Pressable } from '@reactjit/core';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: '#e2e8f0', fontSize: 24 }}>Hello</Text>
      <Pressable onPress={() => setCount(c => c + 1)}>
        <Text style={{ color: '#3b82f6', fontSize: 14 }}>{`Clicks: ${count}`}</Text>
      </Pressable>
    </Box>
  );
}
```

## Style Quick Reference

**Layout:** `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `flexDirection` (`'row'`|`'column'`), `flexGrow`, `flexShrink`, `flexWrap`, `justifyContent`, `alignItems`, `alignSelf`, `gap`, `padding`/`paddingTop`/etc., `margin`/`marginTop`/etc., `display` (`'flex'`|`'none'`).

**Visual:** `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `overflow` (`'visible'`|`'hidden'`|`'scroll'`), `opacity`, `zIndex`, `shadowColor`/`shadowOffsetX`/`shadowOffsetY`/`shadowBlur`, `backgroundGradient: { direction, colors }`, `transform: { translateX, translateY, rotate, scaleX, scaleY }`.

**Text:** `color`, `fontSize`, `fontFamily`, `fontWeight`, `textAlign`, `textOverflow` (`'ellipsis'`), `lineHeight`, `letterSpacing`.

**Position:** `position` (`'relative'`|`'absolute'`), `top`, `bottom`, `left`, `right`.

Colors accept CSS strings (`'#ff0000'`, `'rgba(0,0,0,0.5)'`).

## Verify

After writing or modifying any component:

```bash
reactjit lint
reactjit screenshot --output /tmp/preview.png
```

Read the screenshot image to confirm the layout before moving on.
