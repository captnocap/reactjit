# TODO: @ilovereact/theme — Full Theme System with Provider, Shaders, and Built-in Palettes

## Vision

A `<ThemeProvider>` that works like dark/light mode switching but for entire visual identities — colors, typography, spacing, border radii, shadows, and eventually shaders and sprite maps. Ship with curated palettes (Catppuccin, Dracula, Nord, etc.), let users define their own, and make it trivial to drop into any app.

## What's done

### Phase 1: Theme package + provider + context ✅

- `packages/theme/` — new `@ilovereact/theme` package
- `ThemeProvider` — React context, sends `theme:set` to Lua bridge on mount/switch
- `useTheme()` — returns `{ themeId, setTheme, colors, typography, spacing, radii }`
- `useThemeColors()` — shorthand, returns just the semantic color tokens
- `createTheme()` — factory with `extends` support for custom themes
- `registerTheme()` — register custom themes at runtime
- Registered in `tsconfig.base.json`, `package.json` workspaces, `Makefile` cli-setup

### Phase 2: Built-in palettes (17 themes) ✅

All themes defined in both TypeScript (IDE autocomplete) and Lua (runtime):

| Theme | Family | Style |
|-------|--------|-------|
| `catppuccin-latte` | Catppuccin | Light, pastel warm |
| `catppuccin-frappe` | Catppuccin | Mid-dark, muted |
| `catppuccin-macchiato` | Catppuccin | Dark, balanced |
| `catppuccin-mocha` | Catppuccin | Darkest, **default** |
| `dracula` | Dracula | Dark, saturated purples/greens |
| `dracula-soft` | Dracula | Softer contrast variant |
| `nord` | Nord | Cool blue-grey, arctic |
| `nord-light` | Nord | Light variant |
| `gruvbox-dark` | Gruvbox | Warm retro dark |
| `gruvbox-light` | Gruvbox | Warm retro light |
| `tokyo-night` | Tokyo Night | Dark, neon accents |
| `tokyo-night-storm` | Tokyo Night | Slightly lighter variant |
| `one-dark` | One Dark | Classic dark IDE |
| `solarized-dark` | Solarized | Precision-engineered dark |
| `solarized-light` | Solarized | Precision-engineered light |
| `rose-pine` | Rosé Pine | Dark, muted, elegant |
| `rose-pine-dawn` | Rosé Pine | Light variant |

TypeScript: `packages/theme/src/themes/` (one file per family + index)
Lua: `lua/themes/` (one file per family + init.lua loader)

### Phase 3: Lua bridge integration ✅

- `lua/init.lua` — `theme:set` command handler in the command routing loop
- Theme state: `currentThemeName`, `currentTheme` (table reference)
- Public API: `ReactLove.getTheme()`, `ReactLove.getThemeName()`, `ReactLove.getThemes()`
- `tree.markDirty()` on theme switch to force repaint
- `Makefile` syncs `lua/themes/` to `cli/runtime/` and dist staging

### Phase 4: Storybook integration ✅

- `native-main.tsx` wrapped in `<ThemeProvider>`
- Storybook chrome (sidebar, tab bar, content area) uses `useThemeColors()`
- `ThemeSwitcher` component in tab bar (dropdown with grouped themes + color swatches)
- `ThemeStory` — showcase story with color swatches, click-to-switch cards
- `ThemeSwitcherStory` — demonstrates the ThemeSwitcher component

### Phase 5: Docs + playground migration to theme context ✅

All 10 files in `storybook/src/docs/` and `storybook/src/playground/` migrated from hardcoded hex colors to `useThemeColors()` tokens. Switching themes in Stories then clicking Docs or Playground now feels consistent — same colors follow throughout.

Files migrated:
- DocsSidebar.tsx, DocsViewer.tsx, DocPage.tsx, CodeBlock.tsx, ExampleCard.tsx, MetadataBadges.tsx
- PlaygroundPanel.tsx, StatusBar.tsx, Preview.tsx, TemplatePicker.tsx

Intentional data colors (PLATFORM_COLORS, CATEGORY_COLORS, DIFFICULTY_COLORS) preserved as hardcoded.

### Phase 6: Extended theme shape — typography, spacing, radii ✅

Theme interface extended beyond colors:

```typescript
interface ThemeTypography {
  fontSize: { xs: 8, sm: 10, md: 12, lg: 16, xl: 20, xxl: 28 };
  fontWeight: { normal: 'normal', medium: '500', bold: 'bold' };
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 };
}
interface ThemeSpacing { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
interface ThemeRadii { none: 0, sm: 4, md: 8, lg: 12, full: 9999 }
```

- `packages/theme/src/defaults.ts` — shared default values
- `packages/theme/src/types.ts` — ThemeTypography, ThemeSpacing, ThemeRadii interfaces
- All 8 theme family files updated with `typography: defaultTypography`, etc.
- `useThemeTypography()`, `useThemeSpacing()`, `useThemeRadii()` hooks added
- `createTheme()` deep-merges typography/spacing/radii with defaults
- ThemeProvider context value includes all fields
- Lua side: `lua/themes/defaults.lua` + `lua/themes/init.lua` merges defaults into each theme

### Phase 7: ThemeSwitcher component ✅

Drop-in `<ThemeSwitcher>` component in `@ilovereact/theme`:

```tsx
import { ThemeSwitcher } from '@ilovereact/theme';
<ThemeSwitcher />  // shows current theme + color swatches, opens overlay panel
```

- Shows current theme name + 3 color swatches (bg, primary, accent)
- Opens overlay panel with all themes grouped by family
- Each option shows displayName + color preview
- Uses `useTheme()` for read/write, `useThemeColors()` for its own styling
- Replaced the old ThemeCycleButton in the storybook tab bar
- Storybook story: `ThemeSwitcherStory.tsx`

### Phase 8: Component-level token resolution (shorthand props) ✅

Box and Text primitives auto-resolve theme token names in color fields:

```tsx
<Box bg="primary" />              // resolves to e.g. "#cba6f7"
<Box bg="surface" />              // resolves to e.g. "#313244"
<Text color="textSecondary" />    // resolves to e.g. "#a6adc8"
```

Architecture (avoids circular deps):
- `ThemeColorsContext` in `packages/shared/src/context.ts` — holds flat `Record<string, string>` of token→color
- `ThemeProvider` populates it with semantic tokens + palette entries
- `resolveColor()` and `resolveStyleColors()` in `primitives.tsx`
- Wired into Box (all 4 style objects) and Text
- When no ThemeProvider present, `useThemeColorsOptional()` returns null → no-op, fully backward compatible

---

## What's NOT done yet

### Shaders (Love2D GLSL post-processing)

Themes define post-processing shaders applied to the entire viewport:

- **CRT/retro** — scanlines, curvature, bloom
- **Frosted glass** — blur behind overlays/modals
- **Color grading** — per-theme LUT / curve adjustment
- **Glow/neon** — bloom on bright colors for cyberpunk themes
- **Pixel/mosaic** — downsample for retro aesthetics
- **Vignette** — edge darkening

Implementation: `lua/theme_shaders.lua` compiles GLSL from theme defs, painter applies as post-process canvas effect.

```lua
if currentTheme.shader then
  love.graphics.setShader(compiledShader)
  -- draw to canvas
  love.graphics.setShader()
end
```

### Sprite map theming

Themes override UI elements with sprite sheets:

- Pixel art buttons, checkboxes, scrollbars from a sprite atlas
- Handdrawn theme with sketchy borders
- Terminal theme rendering everything as character cells

Painter checks `currentTheme.sprites` and renders sprite quads instead of Box geometry.

### Animated theme transitions

Smooth interpolation between themes using the existing spring animation system:

```tsx
setTheme('dracula', { animated: true, duration: 300 });
```

All color tokens animate over 300ms. Requires interpolating hex colors in Lua.

### Reactive/auto themes

- **Time-based** — auto-switch light/dark based on time of day
- **System-based** — respect OS dark mode preference
- **State-based** — theme shifts with app state (error tints UI red, etc.)

```tsx
<ThemeProvider theme="auto" light="catppuccin-latte" dark="catppuccin-mocha">
```

### Shadows in theme shape

```typescript
shadows: { sm: ShadowDef; md: ShadowDef; lg: ShadowDef };
```

Currently omitted because Love2D doesn't support CSS-style box shadows natively. Would need shader-based implementation.

### Refactor `packages/shared/src/colors.ts`

The static Catppuccin Mocha palette export still exists. Could be made dynamic (re-exports from active theme) or deprecated in favor of `useThemeColors()`.

---

## Priority for remaining work

1. **Animated transitions** — polish, uses existing spring system
2. **Shaders** — Love2D wow factor
3. **Sprite maps** — advanced theming
4. **Reactive/auto themes** — convenience
5. **Shadows** — needs shader implementation first

---

## Architecture notes (from the dev)

**Theme definitions live in Lua.** React only needs the theme ID string.

Flow:
1. React: `setTheme('dracula')`
2. Bridge sends: `{ type: 'theme:set', payload: { name: 'dracula' } }`
3. Lua: switches `currentTheme` table pointer
4. Lua painter reads from `currentTheme.colors.primary` on the next frame
5. Zero deserialization, zero object construction, just table lookups

TypeScript definitions exist purely for IDE autocomplete. The actual theme data is Lua tables.

Benefits:
- Zero serialization cost
- No bridge overhead on theme switch
- Shader compilation happens once per theme, not per frame
- Sprite map lookups are just table indexing
- IDE autocomplete in React via TypeScript
- All heavy lifting happens where it's cheap (Lua)
