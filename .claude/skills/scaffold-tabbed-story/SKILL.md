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
- **Layout3 (THIS):** Package with multiple related components that share a theme. Tab bar switches between them. Use this when you have 3+ sibling components in the same package (e.g., Effects: Blur/Glow/Shadow, Charts: Bar/Line/Pie, Masks: FishEye/Glitch/Tile).

## THE RULE (NON-NEGOTIABLE)

**There is no shared wrapper. Every story is a FLAT file with static hoisted constants.**

All data lives in a `TABS` array of `TabDef` objects at the TOP of the file, outside the
component function. The JSX reads from `TABS` — it never constructs strings, objects, or
arrays inside the component body. This prevents CodeBlock from receiving new string identities
at 60fps, which causes the Lua tokenizer to re-run continuously and leak memory.

**Do NOT create a wrapper component, a TabView abstraction, a shared layout helper, or
any indirection layer.** The story is one flat file. The TABS array is the data. The JSX
is the layout. That's it.

## THE TEMPLATE (NON-NEGOTIABLE)

The canonical template is `storybook/src/stories/Layout3Story.tsx`. You MUST read this
file before generating any Layout3 story. Do not work from memory. Do not improvise the
layout structure. Read the file, then reproduce its exact structure with your content.

```bash
cat storybook/src/stories/Layout3Story.tsx
```

## EXACT FILE STRUCTURE (DO NOT DEVIATE)

The generated file MUST have this exact structure, in this exact order. Do not reorder
sections. Do not add sections. Do not remove sections. Do not rename variables.

```
1. File docblock (copy from Layout3Story.tsx, update package name)
2. Imports (EXACT — see below)
3. Palette const C (EXACT — see below)
4. TabDef interface (EXACT — copy verbatim from Layout3Story.tsx)
5. TABS array (your content — see rules below)
6. HorizontalDivider function (EXACT — copy verbatim from Layout3Story.tsx)
7. VerticalDivider function (EXACT — copy verbatim from Layout3Story.tsx)
8. Export function <Name>Story (layout JSX — see rules below)
```

### 1. Imports (EXACT — do not add, remove, or reorder)

```tsx
import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
```

**NEVER** import from `@reactjit/core` or `@reactjit/theme`. Always use relative paths.
**NEVER** add additional imports. If you think you need another import, you are wrong.

### 2. Palette (EXACT — copy verbatim)

```tsx
const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};
```

Do NOT change these colors. Do NOT add colors. Do NOT rename keys.

### 3. TabDef interface (EXACT — copy verbatim)

```tsx
interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
  panels: string[]; // preview panel labels — 1 = single, 3 = triple split
}
```

Do NOT modify this interface. Do NOT add fields. Do NOT remove fields.

### 4. TABS array (YOUR CONTENT — rules below)

```tsx
const TABS: TabDef[] = [
  {
    id: 'component-id',       // lowercase kebab-case
    label: 'ComponentName',   // display name shown in tab and info row
    icon: 'lucide-icon-name', // Lucide icon name for the tab tile
    desc: 'One to two sentences describing what this component does.',
    usage: `<ComponentName prop={value}>
  <Child />
</ComponentName>`,
    props: [
      ['propName', 'type', 'lucide-icon'],  // every prop from the real component
    ],
    callbacks: [
      ['onEvent', '(args) => void', 'lucide-icon'],  // every on* handler, or empty []
    ],
    panels: ['Preview'],  // or ['Before', 'After'] or ['Before', 'Effect', 'Controls']
  },
  // ... more tabs
];
```

**TABS rules:**

- **id**: lowercase, kebab-case. Must be unique across all tabs.
- **label**: PascalCase component name exactly as exported from the package.
- **icon**: A real Lucide icon name that represents the component. Pick carefully.
- **desc**: 1-2 sentences. What it does, not how it works. Plain English.
- **usage**: A realistic JSX snippet showing the component in use. Use backtick template
  literal. Indent with 2 spaces. Show the most common props. Do NOT show every prop.
- **props**: Array of `[name, type, iconName]` tuples. Include EVERY prop the component
  accepts. `name` is the exact prop name. `type` is the TypeScript type. `iconName` is
  a Lucide icon that visually represents what the prop controls.
- **callbacks**: Array of `[name, signature, iconName]` tuples. Include EVERY `on*` handler.
  If the component has no callbacks, use an empty array `[]`.
- **panels**: Array of string labels for the preview area split:
  - `['Preview']` — single panel (simple components with one visual state)
  - `['Before', 'After']` — two panels (components that transform input)
  - `['Before', 'Effect', 'Controls']` — three panels (complex effects with parameters)
  - `['Input', 'Output']` — two panels (data transformers)
  - Use whatever labels make sense for the component. The labels appear as small text
    under placeholder icons in each panel.

**How to fill TABS with real data:**

1. Read the package entry point: `cat packages/<pkg>/src/index.ts`
2. For each exported component, read its source file to get the real props interface
3. Copy every prop name and type exactly. Do NOT guess. Do NOT abbreviate.
4. Write a realistic usage snippet based on how the component is actually used
5. Write the description based on what the component actually does, not what you imagine

### 5. Helper functions (generated by script — do NOT modify)

The scaffold script generates `HorizontalDivider` and `VerticalDivider` exactly as they
appear in Layout3Story.tsx. Do NOT modify them. Do NOT inline them. Do NOT rename them.

### 6. The story component (generated by script — only fill TODO markers)

The scaffold script generates the ENTIRE layout JSX with `__NAME__`, `__PKG__`, and
`__SECTION__` already replaced. The export function is already named `<Name>Story`.
The header already has the correct title and badge. The footer already has the correct
breadcrumb section and package name.

**The ONLY things you modify are the TODO markers.** Everything else — the preview area
JSX, info row JSX, tab bar JSX, footer counter, all styles, all pixel values, all
structural comments — is already correct. Do NOT change padding values. Do NOT change
font sizes. Do NOT change gap values. Do NOT change heights. Do NOT change
flexGrow/flexShrink/flexBasis. Do NOT rearrange the JSX tree.

**The TODO markers that need updating:**
- Header: `src="package"` icon (2 places — header and footer) → change to package-specific icon
- Header: `'TODO: Package description'` → change to real one-liner
- TABS array: every field in every tab entry → replace with real component data

## EXACT PIXEL VALUES (NON-NEGOTIABLE)

These values come from Layout3Story.tsx. Do NOT change them.

| Element | Property | Value | Why |
|---|---|---|---|
| Header | paddingLeft/Right | 20 | Standard story header |
| Header | paddingTop/Bottom | 12 | Standard story header |
| Header | gap | 14 | Standard story header |
| Header icon | width/height | 18 | Standard story header |
| Header title | fontSize | 20 | Standard story header |
| Header badge | fontSize | 10 | Standard story badge |
| Header badge | borderRadius | 4 | Standard story badge |
| Header badge | paddingLeft/Right | 8 | Standard story badge |
| Header badge | paddingTop/Bottom | 3 | Standard story badge |
| Header desc | fontSize | 10 | Standard story header |
| Preview panel icon box | width/height | 64 | Tab preview placeholder |
| Preview panel icon box | borderRadius | 8 | Tab preview placeholder |
| Preview panel icon | width/height | 28 | Tab preview placeholder |
| Preview panel label | fontSize | 8 | Tab preview placeholder |
| Info row | height | 120 | Fixed — prevents footer clip |
| Info row | overflow | 'hidden' | Clips long content cleanly |
| Info row columns | padding | 12 | Three-column info strip |
| Info row columns | gap | 6 | Three-column info strip |
| Info row tab.label | fontSize | 14 | Active tab name in info row |
| Info row tab.desc | fontSize | 10 | Description text |
| Info row section headers | fontSize | 8 | USAGE / PROPS / CALLBACKS labels |
| Info row section headers | letterSpacing | 1 | Uppercase label spacing |
| Info row CodeBlock | fontSize | 9 | Usage code snippet |
| Info row prop rows | gap (outer) | 3 | Prop list spacing |
| Info row prop rows | gap (inner) | 5 | Icon-name-type spacing |
| Info row prop icons | width/height | 10 | Prop/callback row icons |
| Info row prop name | fontSize | 9 | Prop name text |
| Info row prop type | fontSize | 9 | Prop type text |
| Tab bar (ScrollView) | height | 86 | Fits one row with breathing room |
| Tab bar inner Box | paddingLeft/Right/Top/Bottom | 8 | Tab tile padding |
| Tab bar inner Box | gap | 8 | Space between tab tiles |
| Tab tile | width/height | 50 | Individual tab button |
| Tab tile | borderRadius | 6 | Tab button corners |
| Tab tile active | borderWidth | 2 | Selected tab border |
| Tab tile inactive | borderWidth | 1 | Unselected tab border |
| Tab tile icon | width/height | 16 | Icon inside tab tile |
| Tab tile label | fontSize | 7 | Label under tab icon |
| Tab tile | gap | 6 | Icon-to-label spacing |
| Footer | paddingLeft/Right | 20 | Standard story footer |
| Footer | paddingTop/Bottom | 6 | Standard story footer |
| Footer | gap | 12 | Standard story footer |
| Footer icons | width/height | 12 | Breadcrumb icons |
| Footer text | fontSize | 9 | Breadcrumb text |

## STEP-BY-STEP PROCEDURE

### Step 0: Check existence

If the story file already exists:
1. Read it and extract all content (tab data, descriptions, code blocks)
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
- `panels: ['Preview']` — set to real panel layout (1, 2, or 3 panels)

**Add or remove tab entries** to match the actual number of components in the package.
The skeleton starts with 3 placeholder tabs. If the package has 5 components, add 2 more.
If it has 2, delete 1.

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

## LAYOUT REFERENCE

```
+-------------------------------------------+
| [icon] Title  [@reactjit/x]  description  |  Header (flexShrink: 0)
+-------+----------+--------+--------------+
|       |          |        |              |  Preview area (flexGrow: 1)
| Panel | Divider  | Panel  | ...          |  N panels from tab.panels
| [icon]|          | [icon] |              |  Each: icon box + label
| label |          | label  |              |
+-------+----------+--------+--------------+
| Description | USAGE      | PROPS        |  Info row (height: 120, overflow: hidden)
| tab.label   | CodeBlock  |  icon name T |
| tab.desc    | tab.usage  |  icon name T |
|             |            | CALLBACKS    |
|             |            |  icon name S |
+-------------------------------------------+
| [tab][tab][tab][tab][tab][tab][tab][tab]  |  Tab bar (ScrollView height: 86)
|  centered, flexWrap, gap: 8              |
+-------------------------------------------+
| [folder] Pkg / [icon] Name    N of M     |  Footer (flexShrink: 0)
+-------------------------------------------+
```

## What NOT to do

- **NEVER** create a shared wrapper, TabView, Layout3, or any abstraction
- **NEVER** create strings or objects inside the component body — everything in TABS
- **NEVER** change pixel values, font sizes, padding, gap, or height from the template
- **NEVER** import from `@reactjit/core` — use `'../../../packages/core/src'`
- **NEVER** hardcode colors — use `useThemeColors()` tokens + the `C` accent palette
- **NEVER** add extra sections, bands, or chrome not present in Layout3Story.tsx
- **NEVER** use `alignItems: 'flex-start'` — use `'start'` (ReactJIT convention)
- **NEVER** use `paddingHorizontal` or `paddingVertical` — use explicit Left/Right/Top/Bottom
- **NEVER** guess prop names or types — read the actual source files
- **NEVER** omit the `panels` field on any tab — every tab MUST have panels
- **NEVER** use ScrollView without an explicit `height` — it will collapse to zero
- **NEVER** skip reading Layout3Story.tsx first — your memory of it is wrong, read it
