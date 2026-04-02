# Tooltip is available — use it on graph nodes

A `tooltip` prop just landed on the framework. Any element can now show a tooltip on hover with zero boilerplate.

## Usage

```tsx
<Box tooltip="Node ID: 42, type: constraint" style={{ ... }}>
  <Text>Node</Text>
</Box>
```

That's it. One prop. The framework handles:
- Show on hover enter, hide on hover exit
- Positioning (centered above the element, flips below if clipped)
- Rendering on top of everything (painted after the main tree)
- Text measurement + auto-sizing

## For the constraint graph

This would be useful for:
- Showing node details (type, value, constraints) on hover
- Showing wire/edge metadata (weight, direction)
- Any element where space is too tight for a label

## What changed

- `framework/tooltip.zig` — new module (state + overlay rendering)
- `framework/engine.zig` — wired into hover + paint
- `framework/layout.zig` — `tooltip` field on Node
- Compiler — parses `tooltip="text"` prop, auto-sets `hoverable`
