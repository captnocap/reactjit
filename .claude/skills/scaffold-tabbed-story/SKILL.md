---
name: scaffold-tabbed-story
description: "Scaffold and populate a Layout3-style tabbed multi-component documentation story for a ReactJIT package. Use when the user says '/scaffold-tabbed-story PackageName', 'scaffold a tabbed story for X', 'create a multi-component story for X', 'tabbed story for X', or wants a new package documentation page that showcases multiple related components with a tab bar. Generates the file with tabbed layout (preview area + info row + tab bar), then fills in real components, props, callbacks, usage, and panel counts."
---

# Scaffold Tabbed Story

Generate a Layout3 tabbed documentation page for a ReactJIT package that contains
multiple related components. Each component gets its own tab. Clicking a tab swaps
the preview area, description, code example, and props panel.

## WHEN TO USE THIS vs Layout1 vs Layout2

- **Layout1 (scaffold-story):** Single component documentation. One preview, one props panel.
- **Layout2 (scaffold-package-story):** Hook/API-heavy packages. Narrative walkthrough with zigzag bands.
- **Layout3 (THIS):** Package with multiple related components that share a theme. Tab bar switches between them. Use this when you have 3+ sibling components in the same package (e.g., Effects: Blur/Glow/Shadow, Charts: Bar/Line/Pie, Masks: FishEye/Glitch/Tile). Also works for a single component with multiple modes/source types (e.g., Render: Screen/Webcam/VM/Display).

## THE RULE (NON-NEGOTIABLE)

**There is no shared wrapper. Every story is a FLAT file with static hoisted constants.**

All data lives in a `TABS` array of `TabDef` objects at the TOP of the file, outside the
component function. The JSX reads from `TABS` — it never constructs strings, objects, or
arrays inside the component body. This prevents CodeBlock from receiving new string identities
at 60fps, which causes the Lua tokenizer to re-run continuously and leak memory.

**Do NOT create a wrapper component, a TabView abstraction, a shared layout helper, or
any indirection layer.** The story is one flat file. The TABS array is the data. The JSX
is the layout. That's it.

## THE PREVIEW AREA (NON-NEGOTIABLE — READ THIS TWICE)

The preview area is the largest region of the story. It has `flexGrow: 1` and fills ALL
vertical space between the header and the info row. **It MUST contain a LIVE DEMO of the
active tab's component.** Not a placeholder. Not an icon box. Not a centered thumbnail.
A real, full-sized, interactive component preview.

**What "live preview" means:**
- For `<Render source="screen:0">` → render an actual `<Render>` component filling the area
- For `<Blur radius={8}>` → render actual blurred content filling the area
- For `<BarChart data={...}>` → render an actual chart filling the area
- The preview fills the entire available space with `flexGrow: 1`

**How it works in the code:**
Each story defines a `renderPreview` function OUTSIDE the component (hoisted, not inside
the render body). This function takes `(tab: TabDef, themeColors)` and returns JSX.
It switches on `tab.id` to render the right live component for each tab.

```tsx
// ── Preview renderer (hoisted — NOT inside the component body) ──

function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  switch (tab.id) {
    case 'screen':
      return <Render source="screen:0" style={{ flexGrow: 1 }} />;
    case 'webcam':
      return <Render source="cam:0" fps={30} style={{ flexGrow: 1 }} />;
    // ... one case per tab
    default:
      return null;
  }
}
```

**The preview area JSX in the story:**
```tsx
{/* ── Preview area — LIVE DEMO of the active tab ── */}
<Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
  {renderPreview(tab, c)}
</Box>
```

That's it. One Box with flexGrow: 1. One function call. The preview fills the space.

**If the component can't run in the storybook** (needs hardware, external service, etc.),
render a visually rich placeholder that FILLS the space — a styled mockup, a diagram, a
large code sample, a status card grid. Never a 64px icon centered in 500px of void.

**DO NOT:**
- Render a tiny icon box centered in the preview area
- Leave the preview area empty or near-empty
- Use `justifyContent: 'center', alignItems: 'center'` to center a small element in a huge space
- Use the old `panels` array / icon-box pattern — it is DEAD, it produced useless output

## THE TEMPLATE (NON-NEGOTIABLE)

The canonical template is `storybook/src/stories/Layout3Story.tsx`. You MUST read this
file before generating any Layout3 story. Do not work from memory. Do not improvise the
layout structure. Read the file, then reproduce its exact structure with your content.

```bash
cat storybook/src/stories/Layout3Story.tsx
```

## STEP-BY-STEP PROCEDURE

### Step 0: Check existence

If the story file already exists:
1. Read it and extract all content (tab data, descriptions, code blocks, preview logic)
2. Delete the old file
3. Run the scaffold script to generate a fresh skeleton
4. Port the extracted content into the new skeleton's TODO markers
5. Continue to Step 2

### Step 1: Generate the skeleton

```bash
bash scripts/scaffold_tabbed_story.sh <Name> [Section]
```

- `<Name>` is PascalCase (e.g., `Effects`, `Masks`, `Charts`)
- `[Section]` defaults to `Packages` — use `Core`, `Demos`, `Dev`, etc. as needed
- The script creates `storybook/src/stories/<Name>Story.tsx` and registers it in `index.ts`
- It replaces `__NAME__`, `__PKG__`, and `__SECTION__` placeholders automatically
- It refuses to overwrite existing files (use Step 0 flow for existing stories)

The generated file has `TODO:` markers at every location that needs real content.

### Step 2: Read the package exports

```bash
cat packages/<pkg>/src/index.ts
ls packages/<pkg>/src/
```

For each exported component, read its source to get the real props interface:

```bash
cat packages/<pkg>/src/ComponentName.tsx
```

### Step 3: Fill in every TODO marker

The generated file has TODO markers in these locations. Fill in ALL of them:

**In the TABS array (one set per tab):**
- `id: 'todo-component-a'` — change to lowercase kebab-case component id
- `label: 'TODO: ComponentA'` — change to real PascalCase component name
- `icon: 'box'` — change to a Lucide icon that represents the component
- `desc: 'TODO: Description...'` — change to 1-2 real sentences
- `usage: 'TODO: Real usage...'` — change to a real JSX snippet
- `props: [['TODO: propName', ...]]` — replace with real props from the source
- `callbacks: []` — add real on* handlers if the component has them

**Add or remove tab entries** to match the actual number of components in the package.
The skeleton starts with 3 placeholder tabs. If the package has 5 components, add 2 more.
If it has 2, delete 1.

**In the renderPreview function:**
- Replace every `{/* TODO: ... */}` case with a LIVE component demo
- The component should have `style={{ flexGrow: 1 }}` or equivalent to fill the space
- If the component needs props, use realistic defaults
- If the component can't run (needs hardware), build a visually rich full-area mockup

**In the header:**
- `TODO: Change "package" to an icon...` — update the `src="package"` to a real icon
- `TODO: Package description` — change to a real one-liner

**In the footer:**
- `TODO: Change "package" to match...` — update the `src="package"` to match header

### Step 4: Build and verify

```bash
make build-storybook-love
```

Fix any build errors. Do NOT skip this step.

## EXACT FILE STRUCTURE (DO NOT DEVIATE)

The scaffold script generates this exact structure. Do NOT reorder sections. Do NOT add
sections. Do NOT remove sections. Do NOT rename variables. The ONLY thing you change is
the content inside `TODO:` markers, the TABS array entries, and the renderPreview cases.

```
1. File docblock (auto-generated with package name)
2. Imports (EXACT — do not add, remove, or reorder — UNLESS you need the component being documented)
3. Palette const C (EXACT — do not change colors or keys)
4. TabDef interface (EXACT — do not add or remove fields)
5. TABS array (YOUR CONTENT — replace placeholder tabs)
6. renderPreview function (YOUR CONTENT — one case per tab with live component)
7. HorizontalDivider function (EXACT — do not modify)
8. VerticalDivider function (EXACT — do not modify)
9. Export function <Name>Story (layout JSX — only fill TODO markers)
```

### Imports

```tsx
import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
```

**NEVER** import from `@reactjit/core` or `@reactjit/theme`. Always use relative paths.

You MAY add imports for components being documented in the preview. For example, if the
story documents `<Render>`, you need to import `Render` from core. If it documents a
package like `@reactjit/audio`, import from `'../../../packages/audio/src'`. This is the
ONE exception to the "never add imports" rule — you need the component to render it live.

### Palette (EXACT — do not change)

```tsx
const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};
```

### TabDef interface (EXACT — do not modify)

```tsx
interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
}
```

### TABS array (YOUR CONTENT)

Each tab entry:

```tsx
{
  id: 'component-id',       // lowercase kebab-case, unique
  label: 'ComponentName',   // PascalCase, exactly as exported
  icon: 'lucide-icon-name', // real Lucide icon name
  desc: 'What this component does in 1-2 sentences.',
  usage: `<ComponentName prop={value}>
  <Child />
</ComponentName>`,
  props: [
    ['propName', 'type', 'lucide-icon'],  // every prop from the real source
  ],
  callbacks: [
    ['onEvent', '(args) => void', 'lucide-icon'],  // every on* handler, or []
  ],
}
```

**How to fill TABS with real data:**
1. Read the package entry point: `cat packages/<pkg>/src/index.ts`
2. For each exported component, read its source file to get the real props interface
3. Copy every prop name and type exactly. Do NOT guess. Do NOT abbreviate.
4. Write a realistic usage snippet based on how the component is actually used
5. Write the description based on what the component actually does, not what you imagine

### renderPreview function (YOUR CONTENT — LIVE COMPONENTS)

This function is hoisted OUTSIDE the component. It takes the active tab and theme colors
and returns JSX for the live preview. One switch case per tab.

```tsx
function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  switch (tab.id) {
    case 'blur':
      return (
        <Blur radius={8} style={{ flexGrow: 1 }}>
          <Image src="photo.jpg" style={{ flexGrow: 1, objectFit: 'cover' }} />
        </Blur>
      );
    case 'glow':
      return (
        <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Glow color="#8b5cf6" spread={20}>
            <Box style={{ width: 200, height: 200, backgroundColor: c.surface, borderRadius: 16 }} />
          </Glow>
        </Box>
      );
    default:
      return null;
  }
}
```

**Rules for renderPreview:**
- Every case MUST produce content that visually fills or meaningfully occupies the preview area
- Use `flexGrow: 1` on the outermost element of each case
- Use theme colors (`c.surface`, `c.text`, etc.) not hardcoded colors
- If a component needs data (chart data, image sources), define it as a hoisted const above
- If a component can't actually run, build a FULL-AREA mockup (status cards, diagrams, etc.)
- NEVER return a small centered icon. NEVER return near-empty space.

### Layout JSX (generated by script — only fill TODO markers)

The scaffold script generates the ENTIRE layout JSX. The preview area is:

```tsx
{/* ── Preview area — LIVE DEMO of the active tab ── */}
<Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
  {renderPreview(tab, c)}
</Box>
```

**The TODO markers that need updating:**
- Header: `src="package"` icon (2 places — header and footer) — change to package-specific icon
- Header: `'TODO: Package description'` — change to real one-liner
- TABS array: every field in every tab entry — replace with real component data
- renderPreview: every switch case — replace with live component demos

## EXACT PIXEL VALUES (NON-NEGOTIABLE)

These values are baked into the scaffold script. Do NOT change them.

| Element | Property | Value |
|---|---|---|
| Header | paddingLeft/Right | 20 |
| Header | paddingTop/Bottom | 12 |
| Header | gap | 14 |
| Header icon | width/height | 18 |
| Header title | fontSize | 20 |
| Header badge | fontSize | 10 |
| Header badge | borderRadius | 4 |
| Header badge | paddingLeft/Right | 8 |
| Header badge | paddingTop/Bottom | 3 |
| Header desc | fontSize | 10 |
| Info row | height | 120 |
| Info row | overflow | 'hidden' |
| Info row columns | padding | 12 |
| Info row columns | gap | 6 |
| Info row tab.label | fontSize | 14 |
| Info row tab.desc | fontSize | 10 |
| Info row section headers | fontSize | 8 |
| Info row section headers | letterSpacing | 1 |
| Info row CodeBlock | fontSize | 9 |
| Info row prop rows | gap (outer) | 3 |
| Info row prop rows | gap (inner) | 5 |
| Info row prop icons | width/height | 10 |
| Info row prop name/type | fontSize | 9 |
| Tab bar (ScrollView) | height | 86 |
| Tab bar inner Box | padding (all sides) | 8 |
| Tab bar inner Box | gap | 8 |
| Tab tile | width/height | 50 |
| Tab tile | borderRadius | 6 |
| Tab tile active | borderWidth | 2 |
| Tab tile inactive | borderWidth | 1 |
| Tab tile icon | width/height | 16 |
| Tab tile label | fontSize | 7 |
| Tab tile | gap | 6 |
| Footer | paddingLeft/Right | 20 |
| Footer | paddingTop/Bottom | 6 |
| Footer | gap | 12 |
| Footer icons | width/height | 12 |
| Footer text | fontSize | 9 |

## LAYOUT REFERENCE

```
+-------------------------------------------+
| [icon] Title  [@reactjit/x]  description  |  Header (flexShrink: 0)
+-------------------------------------------+
|                                           |
|       LIVE COMPONENT PREVIEW              |  Preview area (flexGrow: 1)
|       (fills entire space)                |  renderPreview(tab, c)
|       NOT a tiny icon in a void           |
|                                           |
+-------------------------------------------+
| Description | USAGE      | PROPS         |  Info row (height: 120, overflow: hidden)
| tab.label   | CodeBlock  |  icon name T  |
| tab.desc    | tab.usage  |  icon name T  |
|             |            | CALLBACKS     |
|             |            |  icon name S  |
+-------------------------------------------+
| [tab][tab][tab][tab][tab][tab][tab][tab]  |  Tab bar (ScrollView height: 86)
|  centered, flexWrap, gap: 8              |
+-------------------------------------------+
| [folder] Pkg / [icon] Name    N of M     |  Footer (flexShrink: 0)
+-------------------------------------------+
```

## What NOT to do

- **NEVER** render a tiny icon box centered in the preview area — the preview is for LIVE COMPONENTS
- **NEVER** leave the preview area empty or with just a centered placeholder
- **NEVER** use the old `panels` array pattern with icon boxes — it is deprecated and produces garbage
- **NEVER** create a shared wrapper, TabView, Layout3, or any abstraction
- **NEVER** create strings or objects inside the component body — everything in TABS or hoisted consts
- **NEVER** change pixel values, font sizes, padding, gap, or height from the template
- **NEVER** import from `@reactjit/core` — use `'../../../packages/core/src'`
- **NEVER** hardcode colors — use `useThemeColors()` tokens + the `C` accent palette
- **NEVER** add extra sections, bands, or chrome not present in the scaffold output
- **NEVER** use `alignItems: 'flex-start'` — use `'start'` (ReactJIT convention)
- **NEVER** use `paddingHorizontal` or `paddingVertical` — use explicit Left/Right/Top/Bottom
- **NEVER** guess prop names or types — read the actual source files
- **NEVER** use ScrollView without an explicit `height` — it will collapse to zero
- **NEVER** skip reading Layout3Story.tsx first — your memory of it is wrong, read it
- **NEVER** use `git checkout` to undo changes to shared files — use Edit to surgically fix
