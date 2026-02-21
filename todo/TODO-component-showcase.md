# Component Showcase Mode

A dev/designer writes a single .tsx file, ships it as a binary to a client. The component is perfectly centered on screen, no boilerplate, no layout scaffolding — just the component on display.

## The idea

Lower the barrier to "send someone a working interactive demo" to a single file. The developer writes one component, the framework wraps it in a centered viewport with a clean background, builds it into a self-extracting binary. Client double-clicks, sees the component. No browser, no install, no "npm start".

## Workflow

```bash
ilovereact showcase MyCard.tsx           # → ./MyCard binary
ilovereact showcase LoginForm.tsx --bg "#1a1a2e"
ilovereact showcase Dashboard.tsx --size 1280x720
```

The CLI:
1. Wraps the default export in a centered full-viewport container
2. Adds a clean background (configurable)
3. Builds dist:love
4. Outputs a single binary named after the component

## What the wrapper does automatically

- `width: 100%, height: 100%` root with centered content
- Dark neutral background (or configurable)
- Component auto-sizes to its content (no explicit dimensions needed)
- Maybe a subtle filename/watermark in the corner for context
- F12 inspector still works for the client to poke around

## Why this matters

- Designer and developer iterate on a component together
- Ship to client as a file, not a URL or a repo
- Client sees exactly what it looks like — not a mockup, not a screenshot, the real thing running live
- Interactive — buttons click, inputs type, animations play
- Cross-platform binary means no "works on my machine"

## Single-file convention

The .tsx file just exports a component:

```tsx
import { Box, Text, Pressable } from '@ilovereact/core';

export default function PricingCard() {
  return (
    <Box style={{ width: 320, padding: 24, backgroundColor: '#1e293b', borderRadius: 12 }}>
      <Text style={{ fontSize: 24, color: '#f1f5f9' }}>Pro Plan</Text>
      <Text style={{ fontSize: 14, color: '#94a3b8' }}>$29/mo</Text>
    </Box>
  );
}
```

That's it. No App.tsx, no main.lua, no package.json. One file in, one binary out.
