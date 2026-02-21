# TODO: Global Search Bar + Lua Magnifying Glass Overlay

## 1. Global fuzzy search bar

A search bar that searches across the entire storybook application — stories, docs, component names, prop names, section titles, code content — and deep-links you directly to the result.

### Behavior

- **Activation:** keyboard shortcut (Ctrl+K or `/`) opens a floating search overlay, similar to VS Code's command palette or Spotlight
- **Fuzzy matching:** type partial terms and get ranked results. "pres btn" finds Pressable, "flex wrap" finds the Flex Wrap story, "backgroundColor" finds docs and stories that use it
- **Result types:**
  - Stories → navigates to that story in the sidebar
  - Doc sections → navigates to that doc page
  - Components/hooks → navigates to the story or doc that covers them
  - Props → navigates to the relevant component story/doc with the prop highlighted
- **Deep linking:** selecting a result sets the active story/doc/section directly, scrolling to the match if possible
- **Index:** built at startup from the story registry (`stories/index.ts` titles + categories), doc content (`generated/content.json`), and optionally component source metadata

### Implementation

- **Search index:** at mount time, build a flat array of `{ type, label, keywords, target }` entries from stories + docs. Store in a ref or module-level variable.
- **Fuzzy matching:** simple substring + Levenshtein distance scoring. No need for a library — a 30-line fuzzy scorer is enough for the dataset size.
- **UI:** floating overlay Box with TextInput, result list below. Pressable results. Rendered via a top-level Portal or direct child of the storybook root so it sits above everything.
- **Navigation:** the storybook already has `setActiveIdx` (stories) and `handleSelect` (docs) + `setMode` (stories/docs/playground). The search just calls the right setter.

### Scope of searchable content

| Source | What's indexed | Navigate to |
|--------|---------------|-------------|
| `stories/index.ts` | title, category, id | Story by index |
| `generated/content.json` | section titles, file keys, body text | Doc page by sectionId + fileKey |
| Component exports (`@ilovereact/core`) | Component names, prop names | Relevant story or doc |
| Playground templates | Template names | Playground with template loaded |

## 2. Lua-owned magnifying glass overlay

Replace the current `ZoomControls` React component (the `+` / `100%` / `-` buttons in the docs sidebar, `DocsViewer.tsx:16-46`) with a Lua-side magnifying glass overlay that lives in the corner of the viewport and works on ALL pages — stories, docs, and playground.

### Why Lua-owned

- Works everywhere without each page/mode needing to wire up font scale context
- Lives outside the React tree — no re-renders, no provider nesting, no context drilling
- Can affect the entire rendering pipeline at the paint level (scale transforms on the canvas) rather than individually scaling font sizes
- Persists across page navigation — zoom level doesn't reset when switching stories

### Current state

- `DocsFontScale.tsx` — React context provider, stores a scale multiplier (0.8-2.5x)
- `useScaledFont(baseSize)` — hook that multiplies font sizes by the scale
- Only works in docs because only `DocsViewer` wraps in `<FontScaleProvider>`
- The `+`/`-` buttons are wedged into the docs sidebar bottom

### Proposed approach

1. **Lua module: `lua/zoom.lua`**
   - Stores global zoom level (persisted in Love2D save directory)
   - Exposes `zoom.getScale()`, `zoom.increase()`, `zoom.decrease()`, `zoom.reset()`
   - Applies via `love.graphics.scale()` at the start of the paint pass, or by scaling the root node's computed dimensions

2. **Overlay rendering** (in `lua/init.lua` or `lua/devtools.lua`)
   - Small magnifying glass icon in the bottom-right corner (or top-right)
   - Built from Box geometry (circle + handle), not a font glyph
   - Click to cycle zoom or show a small popup with `+` / `-` / reset
   - Always visible, on every page, rendered after everything else (like the error overlay)
   - Subtle — semi-transparent, doesn't obstruct content

3. **Remove React-side zoom**
   - Delete `DocsFontScale.tsx` and `ZoomControls` from `DocsViewer.tsx`
   - Remove `FontScaleProvider` wrapper and `useScaledFont` usage in doc components
   - The Lua zoom replaces all of it

### Keyboard shortcuts

- `Ctrl+=` / `Ctrl+-` — zoom in/out (standard browser convention)
- `Ctrl+0` — reset to 100%
- These are handled in Lua's `keypressed`, never reach the React tree

## Files involved

| File | Role |
|------|------|
| New: `storybook/src/SearchOverlay.tsx` | Floating search UI |
| `storybook/src/native-main.tsx` | Mount search overlay, wire navigation |
| `storybook/src/stories/index.ts` | Search index source (stories) |
| `storybook/src/generated/content.json` | Search index source (docs) |
| New: `lua/zoom.lua` | Lua-side zoom state + persistence |
| `lua/init.lua` or `lua/devtools.lua` | Render magnifier overlay, handle zoom keys |
| `storybook/src/docs/DocsViewer.tsx` | Remove ZoomControls + FontScaleProvider |
| `storybook/src/docs/DocsFontScale.tsx` | Delete entirely |
| `storybook/src/docs/DocPage.tsx` | Remove useScaledFont usage |
