# TODO: @ilovereact/theme — Full Theme System with Provider, Shaders, and Built-in Palettes

## Vision

A `<ThemeProvider>` that works like dark/light mode switching but for entire visual identities — colors, typography, spacing, border radii, shadows, and eventually shaders and sprite maps. Ship with curated palettes (Catppuccin, Dracula, Nord, etc.), let users define their own, and make it trivial to drop into any app.

## Current state

- `packages/shared/src/colors.ts` exports a static Catppuccin Mocha palette as `colors`
- No theme context, no provider, no dynamic switching
- Every component and story hardcodes color values inline (`'#1e293b'`, `'#e2e8f0'`, etc.)
- No shader support anywhere in the Lua pipeline

## Package: `packages/theme/`

New package: `@ilovereact/theme`

### Core API

```tsx
import { ThemeProvider, useTheme, useThemeColor } from '@ilovereact/theme';

// Wrap app root
<ThemeProvider theme="catppuccin-mocha">
  <App />
</ThemeProvider>

// Switch themes at runtime
const { theme, setTheme, themes } = useTheme();
setTheme('dracula');

// Use semantic colors
const { bg, text, primary, surface, border, accent, muted, error, success, warning } = useThemeColor();
<Box style={{ backgroundColor: bg, borderColor: border }}>
  <Text style={{ color: text, fontSize: 14 }}>Hello</Text>
</Box>
```

### Theme shape

```typescript
interface Theme {
  name: string;
  displayName: string;

  // Semantic color tokens (what components consume)
  colors: {
    // Backgrounds
    bg: string;           // app background
    bgAlt: string;        // card/surface background
    bgElevated: string;   // modal/overlay background

    // Text
    text: string;         // primary text
    textSecondary: string;// secondary/muted text
    textDim: string;      // disabled/placeholder text

    // Interactive
    primary: string;      // primary action (buttons, links)
    primaryHover: string;
    primaryPressed: string;

    // Surfaces & borders
    surface: string;
    surfaceHover: string;
    border: string;
    borderFocus: string;

    // Status
    accent: string;
    error: string;
    warning: string;
    success: string;
    info: string;

    // Raw palette (full color ramp for custom use)
    palette: Record<string, string>;
  };

  // Typography defaults
  typography: {
    fontFamily?: string;
    fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
    fontWeight: { normal: string; medium: string; bold: string };
    lineHeight: { tight: number; normal: number; relaxed: number };
  };

  // Spacing scale
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };

  // Border radii
  radii: { none: number; sm: number; md: number; lg: number; full: number };

  // Shadows (Love2D box shadows)
  shadows: {
    sm: ShadowDef;
    md: ShadowDef;
    lg: ShadowDef;
  };

  // Shader config (Love2D only, see below)
  shader?: ShaderDef;

  // Sprite map overrides (see below)
  sprites?: SpriteMapDef;
}
```

### Built-in themes to ship

| Theme | Source | Style |
|-------|--------|-------|
| `catppuccin-latte` | Catppuccin | Light, pastel warm |
| `catppuccin-frappe` | Catppuccin | Mid-dark, muted |
| `catppuccin-macchiato` | Catppuccin | Dark, balanced |
| `catppuccin-mocha` | Catppuccin | Darkest, current default |
| `dracula` | Dracula | Dark, saturated purples/greens |
| `dracula-soft` | Dracula | Softer contrast variant |
| `nord` | Nord | Cool blue-grey, arctic |
| `nord-light` | Nord | Light variant |
| `gruvbox-dark` | Gruvbox | Warm retro dark |
| `gruvbox-light` | Gruvbox | Warm retro light |
| `tokyo-night` | Tokyo Night | Dark, neon accents |
| `tokyo-night-storm` | Tokyo Night | Slightly lighter variant |
| `one-dark` | Atom One Dark | Classic dark IDE |
| `solarized-dark` | Solarized | Precision-engineered dark |
| `solarized-light` | Solarized | Precision-engineered light |
| `rose-pine` | Rose Pine | Dark, muted, elegant |
| `rose-pine-dawn` | Rose Pine | Light variant |

### Custom themes

```tsx
import { createTheme, ThemeProvider } from '@ilovereact/theme';

const myTheme = createTheme({
  name: 'my-brand',
  extends: 'catppuccin-mocha', // inherit and override
  colors: {
    primary: '#ff6b6b',
    accent: '#ffd93d',
    bg: '#0a0a0f',
  },
});

<ThemeProvider theme={myTheme}>
  <App />
</ThemeProvider>
```

## Component & primitive integration

### Granular prop-level theming

Every component and primitive needs to accept theme tokens as props AND fall back to the theme context when not specified:

```tsx
// Explicit override — always wins
<Box bg="primary" borderColor="border" p="md" radius="lg">
  <Text color="text" size="md" weight="bold">Title</Text>
</Box>

// No props — reads from theme context
<Box>
  <Text>Uses theme defaults</Text>
</Box>
```

This means:
1. `Box` gets shorthand props: `bg`, `borderColor`, `p`/`px`/`py`, `radius` that resolve against the theme
2. `Text` gets shorthand props: `color`, `size`, `weight` that resolve against the theme
3. `Pressable` gets themed default states (hover, pressed, disabled colors from theme)
4. All form components (Checkbox, Radio, Select, Switch, Slider, TextInput, TextEditor) get themed defaults
5. Navigation components (NavPanel, Tabs, Breadcrumbs, Toolbar) get themed defaults
6. Data components (Table, BarChart, ProgressBar, Sparkline) get themed color ramps

### Migration path

- Phase 1: Create the theme package and context. Components read from it when available, fall back to current hardcoded values when no provider exists. Zero breaking changes.
- Phase 2: Update each component to use theme tokens as defaults. Still works without a provider (falls back to built-in Catppuccin Mocha).
- Phase 3: Update all storybook stories to use semantic tokens. Add a theme switcher to the storybook tab bar.

## Shaders (Love2D)

Love2D has native GLSL shader support via `love.graphics.newShader()`. Themes can define post-processing shaders that apply to the entire viewport or to individual components.

### Use cases

- **CRT/retro shader** — scanlines, curvature, bloom. A theme that makes your app look like a terminal.
- **Frosted glass** — blur effect behind overlays/modals (approximated with multi-pass or pre-rendered blur)
- **Color grading** — per-theme color LUT / curve adjustment applied as a post-process
- **Glow/neon** — bloom pass on bright colors for cyberpunk themes
- **Pixel/mosaic** — downsample effect for retro game aesthetics
- **Vignette** — subtle darkening at edges for immersive themes

### Implementation

```lua
-- In lua/theme_shaders.lua
local Shaders = {}

function Shaders.apply(shaderDef)
  -- Compile GLSL from theme's shader config
  -- Apply as post-process canvas effect in the paint pass
end

-- In painter.lua, after all nodes are painted:
if theme.shader then
  Shaders.apply(theme.shader)
end
```

The shader is defined in the theme:

```typescript
shader: {
  fragment: `
    vec4 effect(vec4 color, Image tex, vec2 uv, vec2 px) {
      // CRT scanline effect
      float scanline = sin(uv.y * 800.0) * 0.04;
      return color - scanline;
    }
  `,
  uniforms: { intensity: 0.5 },
}
```

## Sprite map theming

Allow themes to override how certain UI elements are rendered by swapping in sprite sheets instead of Box-based geometry. For example:

- A "pixel art" theme that renders buttons, checkboxes, scrollbars from a sprite atlas
- A "handdrawn" theme with sketchy borders and imperfect shapes
- A "terminal" theme that renders everything as character cells

```typescript
sprites: {
  checkbox: { sheet: 'theme-sprites.png', checked: [0, 0, 16, 16], unchecked: [16, 0, 16, 16] },
  radio: { sheet: 'theme-sprites.png', selected: [32, 0, 16, 16], unselected: [48, 0, 16, 16] },
  button: { sheet: 'theme-sprites.png', normal: [0, 16, 48, 16], pressed: [48, 16, 48, 16] },
  scrollThumb: { sheet: 'theme-sprites.png', rect: [0, 32, 8, 16] },
}
```

The painter checks if the current theme has a sprite override for the element type and renders the sprite quad instead of the default Box geometry.

## Reactive themes

Themes that change based on runtime conditions:

- **Time-based** — auto-switch light/dark based on time of day
- **System-based** — respect OS dark mode preference (where available)
- **State-based** — theme shifts with app state (e.g., error state tints the entire UI red, focus mode desaturates background elements)
- **Animated transitions** — smooth interpolation between themes when switching (animate all color tokens over 300ms using the existing spring animation system)

```tsx
// Auto light/dark
<ThemeProvider theme="auto" light="catppuccin-latte" dark="catppuccin-mocha">

// Animated switching
const { setTheme } = useTheme();
setTheme('dracula', { animated: true, duration: 300 });
```

## User-facing theme switcher component

A drop-in component for any app:

```tsx
import { ThemeSwitcher } from '@ilovereact/theme';

// Minimal — floating pill in corner
<ThemeSwitcher position="bottom-right" />

// Inline — renders as a settings row
<ThemeSwitcher inline />

// Custom — just the hook
const { theme, setTheme, themes } = useTheme();
```

Shows a preview swatch for each theme, current theme highlighted, click to switch.

## Files to create/modify

| File | Role |
|------|------|
| New: `packages/theme/` | New package — provider, context, themes, utilities |
| New: `packages/theme/src/ThemeProvider.tsx` | React context + provider |
| New: `packages/theme/src/themes/` | Built-in theme definitions (one file per theme) |
| New: `packages/theme/src/useTheme.ts` | Hook for consuming/switching themes |
| New: `packages/theme/src/createTheme.ts` | Theme factory with `extends` support |
| New: `packages/theme/src/ThemeSwitcher.tsx` | Drop-in switcher component |
| New: `lua/theme_shaders.lua` | GLSL shader compilation + post-process pipeline |
| `lua/painter.lua` | Shader post-process pass, sprite map rendering path |
| `packages/shared/src/primitives.tsx` | Box/Text shorthand props that resolve against theme |
| `packages/shared/src/colors.ts` | Refactor into theme format, keep for backwards compat |
| `storybook/src/native-main.tsx` | Wrap in ThemeProvider, add theme switcher to tab bar |
| All story files | Migrate hardcoded colors to semantic tokens |

## Priority order

1. **Theme package + provider + context** — the foundation
2. **Built-in palettes** (Catppuccin variants, Dracula, Nord) — immediate value
3. **Component integration** — primitives read theme tokens
4. **Theme switcher component** — user-facing
5. **Storybook integration** — theme picker in tab bar, stories use tokens
6. **Animated transitions** — polish
7. **Shaders** — Love2D-specific wow factor
8. **Sprite maps** — advanced theming
9. **Reactive/auto themes** — convenience

---

notes from the dev:
i didnt write the todo, you did claude but i read it. looks good. here are some notes.

Smart. **Theme definitions live in Lua.** React only needs to know the current theme ID, not the entire object.

Flow:
1. React: `setTheme('dracula')`
2. Bridge sends: `{ setTheme: 'dracula' }`
3. Lua: loads/caches the theme table
4. Lua painter reads from `currentTheme.colors.primary` directly on the next frame
5. Zero deserialization, zero object construction, just table lookups

No frame delay. No bridge saturation. Pure Lua-side state.

**This means:**

- **`packages/theme/src/themes/`** — TypeScript definitions that match Lua structure (for IDE autocomplete in React code)
- **`lua/themes/`** — The actual theme tables (one file per theme, or one big themes.lua with all of them)
- **`lua/painter.lua`** — already reads `currentTheme` when rendering primitives
- **`lua/theme_shaders.lua`** — compiles shaders from theme defs, posts-processes using Love2D's shader API
- **`lua/bridge.lua`** or similar — `setTheme(id)` function that validates the ID and switches the global `currentTheme` reference

**React side:**
```tsx
const { theme, setTheme } = useTheme();
// theme is just the ID string: 'dracula'
// setTheme('nord') sends 1 message to Lua, Lua does all the work
```

**Lua side:**
```lua
-- lua/themes.lua
return {
  ['catppuccin-mocha'] = {
    colors = {
      bg = '#1e1e2e',
      text = '#cdd6f4',
      primary = '#89b4fa',
      -- ...
    },
    typography = { /* ... */ },
    -- ...
  },
  ['dracula'] = { /* ... */ },
  -- ...
}

-- lua/painter.lua or main loop
local themes = require('themes')
currentTheme = themes['catppuccin-mocha']

-- In drawBox():
love.graphics.setColor(parseHex(currentTheme.colors.bg))
```

**For shaders:**
```lua
-- lua/theme_shaders.lua
local function compileShader(themeDef)
  if themeDef.shader then
    return love.graphics.newShader(themeDef.shader.fragment)
  end
  return nil
end

-- In painter loop:
local themeShader = compileShader(currentTheme)
if themeShader then
  love.graphics.setShader(themeShader)
  -- draw to canvas
  love.graphics.setShader()
end
```

**For sprite maps:**
```lua
-- In painter.lua, when rendering a checkbox:
if currentTheme.sprites and currentTheme.sprites.checkbox then
  local spriteRect = checked and 
    currentTheme.sprites.checkbox.checked or 
    currentTheme.sprites.checkbox.unchecked
  drawSprite(spriteRect.sheet, spriteRect.rect, x, y)
else
  -- fallback to Box rendering
  drawBox(...)
end
```

**The TypeScript definitions in React are just hints:**

```typescript
// packages/theme/src/types.ts
export interface Theme {
  colors: {
    bg: string;
    text: string;
    primary: string;
    // ...
  };
  typography: { /* ... */ };
  sprites?: {
    checkbox: { checked: [x, y, w, h]; unchecked: [x, y, w, h] };
    // ...
  };
  shader?: {
    fragment: string;
    uniforms?: Record<string, number>;
  };
}
```

They live in TypeScript for IDE support, but the *actual* theme data is in Lua. React's `useTheme()` hook doesn't fetch the full theme object — it just tracks the current theme ID.

This is genuinely elegant. You get:
- **Zero serialization cost**
- **No bridge overhead on theme switch**
- **Shader compilation happens once per theme, not per frame**
- **Sprite map lookups are just table indexing**
- **IDE autocomplete in React via TypeScript**
- **All the heavy lifting happens where it's cheap**

When do you want to start building this?
