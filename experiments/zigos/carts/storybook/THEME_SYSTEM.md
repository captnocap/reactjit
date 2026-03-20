# Theme System — Design & Architecture

## Philosophy

Desktop-first. The default `style` on every classifier is the desktop experience. Mobile/tablet are breakpoint overrides that degrade gracefully — not a mobile-first build-up that produces dogshit desktop apps.

Nothing is forced. A classifier with just `style: {}` works exactly as it always has. Themes, variants, breakpoints, and style tokens are all opt-in per classifier.

## Three Tiers of Theming

| Tier | What changes | Mechanism | Example |
|------|-------------|-----------|---------|
| **Colors** | Palette | `theme-bg` → `Theme.get(.bg)` | Dark / Light |
| **Style tokens** | Individual f32 values | `theme-radiusMd` → `Theme.getFloat(.radius_md)` | Rounded / Sharp |
| **Layout variants** | Entire style blocks | `setVariant(N)` → style array swap | Magazine / Brutalist |

Tiers 1+2 change how things look. Tier 3 changes where things are.

### Color Tokens (implemented)

```
backgroundColor: 'theme-bg'
borderColor: 'theme-border'
color: 'theme-text'
```

Resolved at runtime via `Theme.get(.token)`. Swap the palette with `Theme.setPalette()` — every node picks up new colors next frame.

### Style Tokens (implemented)

```
borderRadius: 'theme-radiusMd'
padding: 'theme-spacingLg'
gap: 'theme-spacingSm'
```

Resolved at runtime via `Theme.getFloat(.token)`. Swap with `Theme.setStylePalette()`. Built-in presets: `rounded_airy` and `sharp_dense`.

Available tokens: `radiusSm`, `radiusMd`, `radiusLg`, `spacingSm`, `spacingMd`, `spacingLg`, `borderThin`, `borderMedium`, `fontSm`, `fontMd`, `fontLg`.

### Layout Variants (implemented)

```
classifier({
  Card: {
    type: 'Box',
    style: { flexDirection: 'column', padding: 16, borderRadius: 8 },
    variants: {
      magazine: { style: { flexDirection: 'row', padding: 20, borderRadius: 16 } },
      brutalist: { style: { flexDirection: 'column', padding: 8, borderRadius: 0 } },
    }
  }
})
```

The base `style` is variant 0. Named variants are 1, 2, etc. Toggle with `setVariant(N)` in handlers. The engine swaps the entire style block each frame — same children, different spatial arrangement.

### Theme Presets

A preset bundles all three tiers:

```zig
Theme.applyPreset(.{
    .variant = 1,                    // layout variant
    .colors = catppuccin_mocha,      // color palette
    .styles = rounded_airy,          // style token palette
});
```

One call, atomic swap, next frame everything resolves to the new values.

## Breakpoints (designed, not yet built)

Responsive overrides per window-width tier. Desktop is the default — breakpoint blocks only need to declare what changes.

### Syntax

```
classifier({
  Footer: {
    type: 'Box',
    style: { flexDirection: 'row', gap: 12, padding: 20 },
    variants: {
      compact: { style: { gap: 8 } },
    },
    bp: {
      sm: {
        style: { flexDirection: 'column', gap: 4, padding: 8 },
        variants: {
          compact: { style: { gap: 2, padding: 4 } },
        }
      },
      md: {
        style: { gap: 8, padding: 12 },
      },
    }
  }
})
```

### Tiers

| Tier | Width | Use case |
|------|-------|----------|
| `sm` | 0-639px | Phone |
| `md` | 640-1023px | Tablet |
| `lg` | 1024-1439px | Desktop (default) |
| `xl` | 1440px+ | Widescreen |

### Resolution Order

1. Start with the base `style` (desktop default)
2. If a breakpoint tier matches and has `style`, override with it
3. If the active variant is set and the resolved tier has `variants`, override with that variant's style

### What This Means

- A classifier with no `bp` key works identically to today. Zero cost.
- A classifier with `bp.sm` only changes on phones. Desktop is untouched.
- Each breakpoint tier can have its own variant set — mobile might have different layout variants than desktop, or none at all.
- The engine already has `breakpoint.zig` with `update(win_w)` and `current()` returning sm/md/lg/xl. The compiler just needs to emit the right style arrays and the engine selects based on current breakpoint.

### Why Not Mobile-First

Mobile-first means your default is the constrained case. Every desktop feature is an override on top of a phone layout. This produces:
- Desktop apps that feel like stretched phone apps
- Verbose breakpoint overrides for the primary use case
- Design decisions anchored to the smallest screen

Desktop-first means your default is the best experience. You degrade intentionally for smaller screens. The base `style` is what most users see. Breakpoint overrides are surgical — only declare what changes.

## Runtime

The engine repaints every frame. Layout runs every frame. There is no dirty tracking or invalidation needed. When a theme preset is applied, a variant is toggled, or a breakpoint changes — the next frame just uses the new values. Colors resolve through `Theme.get()`, floats through `Theme.getFloat()`, styles through `variant_array[activeVariant()]`. The painting picks up the new computed positions and draws them.

## Files

| File | Role |
|------|------|
| `framework/theme.zig` | Color palette, style palette, variant state, presets |
| `framework/breakpoint.zig` | Window-width tiers (sm/md/lg/xl) |
| `compiler/attrs.zig` | `theme-*` prefix parsing for colors and f32 values |
| `compiler/collect.zig` | `variants: {}` parsing in classifiers |
| `compiler/jsx.zig` | Variant update tracking and route binding |
| `compiler/emit.zig` | Variant style array emission |
| `compiler/handlers.zig` | `setVariant(N)` handler support |
