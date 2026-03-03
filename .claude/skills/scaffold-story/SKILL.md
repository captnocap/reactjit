---
name: scaffold-story
description: "Scaffold and populate a Layout1-style documentation story for a ReactJIT component. Use when the user says '/scaffold-story ComponentName', 'scaffold a story for X', 'create a story for X', or wants a new component documentation page in the storybook. Generates the file, then fills in real props, callbacks, starter code, and preview."
---

# Scaffold Story

Generate a Layout1 documentation page for a ReactJIT component.

## How it works

Stories use `<ComponentDoc>` from `_shared/ComponentDoc.tsx`. Pass a `docKey` and the OVERVIEW, USAGE, BEHAVIOR, PROPS, and CALLBACKS sections auto-populate from `content/sections/*.txt` via `content.json`. No manual doc writing needed.

## Step 1: Generate

```bash
bash scripts/scaffold_story.sh <ComponentName> <Section>
```

Section defaults to `Core`. Valid: `Core | Packages | Demos | Stress Test | Dev | Bad Habits | Layouts`.

Creates `storybook/src/stories/<Name>Story.tsx` and registers it in `index.ts`.

## Step 2: Verify docs exist

Check that a corresponding doc file exists in `content/sections/`:

```bash
ls content/sections/*/$(echo "<ComponentName>" | tr '[:upper:]' '[:lower:]').txt
```

The `docKey` is the lowercase filename without extension (e.g. `"box"`, `"scrollview"`, `"textinput"`). If no doc file exists, omit `docKey` and the story renders with placeholder content.

## Step 3: Edit the generated file

The scaffold generates a thin file like this:

```tsx
import React from 'react';
import { ComponentDoc } from './_shared/ComponentDoc';

export function BoxStory() {
  return <ComponentDoc docKey="box" />;
}
```

Customize as needed:

### A. docKey (required for docs integration)

The lowercase name matching a file in `content/sections/`. This auto-populates:
- **OVERVIEW** — from the doc's overview section
- **USAGE** — from the second code block in the API section
- **BEHAVIOR** — from criticalRules in the doc
- **PROPS** — parsed from the API markdown table (non-on* entries)
- **CALLBACKS** — parsed from the API markdown table (on* entries)
- **Header** — title, description, import snippet all from metadata

### B. starterCode (optional)

Override the playground's initial code. Falls back to the doc's first example.

```tsx
const STARTER_CODE = `<Box style={{ padding: 16 }}>
  <Text style={{ fontSize: 14 }}>Hello</Text>
</Box>`;

<ComponentDoc docKey="box" starterCode={STARTER_CODE} />
```

### C. preview (optional — but you should always write one)

Custom left-column preview content. Falls back to default wireframes, but a custom preview
that uses icons relevant to the component is **always better**.

**Use icons in previews.** The framework ships ~1936 Lucide icons. Use `<Image src="icon-name" />`
with bare icon names (no path, no extension). This renders as a vector icon automatically.
Icon names are case-insensitive and support kebab-case: `"heart"`, `"Heart"`, `"arrow-down"` all work.

Pick icons that **relate to what the component does** — not random decoration:
- A Button story → `mouse-pointer-click`, `pointer`
- A Search story → `search`, `filter`, `list-filter`
- A Timer story → `clock`, `timer`, `alarm-clock`
- A Modal story → `panel-top`, `maximize-2`, `x`
- An Audio story → `volume-2`, `music`, `headphones`
- A Chart story → `bar-chart`, `trending-up`, `pie-chart`

Browse all icons in the storybook's Icons page or check `packages/icons/src/iconNames.ts`.

Use `styleTooltip()` for hover tooltips on styled elements:

```tsx
import { ComponentDoc, styleTooltip, Wireframe } from './_shared/ComponentDoc';
import { Box, Text, Image } from '../../../../packages/core/src';
import { useThemeColors } from '../../../../packages/theme/src';

function ButtonPreview() {
  const c = useThemeColors();
  return (
    <>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: c.primary, borderRadius: 8, padding: 12,
      }}>
        <Image src="mouse-pointer-click" w={16} h={16} style={{ color: 'white' }} />
        <Text style={{ color: 'white', fontSize: 11 }}>{'Click me'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Image src="pointer" w={14} h={14} style={{ color: c.muted }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Hover, press, release states'}</Text>
      </Box>
    </>
  );
}

<ComponentDoc docKey="button" preview={<ButtonPreview />} />
```

### D. section (optional)

Override the footer breadcrumb. Defaults to the doc's category.

## Step 4: Validate

```bash
rjit lint
```

## Layout reference

```
┌─────────────────────────────────────────┐
│ Title  <import />           description │  Header (from docs metadata)
├───────────────────┬─────────────────────┤
│                   │ OVERVIEW            │  (from docs)
│  Preview          │ USAGE (CodeBlock)   │  (from docs API section)
│  (ScrollView)     │ BEHAVIOR            │  (from docs criticalRules)
│  custom or        │ ───────────────     │
│  default          │ PROPS               │  (from docs API table)
│  wireframes       │  name   Type        │
│                   │ ───────────────     │
│                   │ CALLBACKS           │  (from docs API table, on* entries)
│                   │  onX    sig         │
├───────────────────┴─────────────────────┤
│ Section / Name         [Playground] v0  │  Footer
└─────────────────────────────────────────┘
```

Playground mode flips center to: left=TextEditor, right=live Preview.

## Rules

- Import `ComponentDoc` from `'./_shared/ComponentDoc'`
- Import helpers (`styleTooltip`, `Wireframe`) from the same path if needed
- Import primitives from `'../../../../packages/core/src'` — never `@reactjit/core`
- Import theme from `'../../../../packages/theme/src'`
- Export must be named `<Name>Story`
- The docKey handles all documentation — do NOT manually write OVERVIEW, USAGE, PROPS, etc.
- If no doc .txt file exists for this component, omit docKey (placeholders render)

## Icons (NON-NEGOTIABLE)

Every story with a custom preview MUST use at least one `<Image src="icon-name" />` that is
**relevant to the component being documented.** The shared layout already uses icons for section
headers, breadcrumbs, and the playground button. Your job is to bring domain-relevant icons
into the preview area so the story visually communicates what the component does at a glance.

**How it works:** `<Image src="icon-name" />` resolves bare names (no `/`, no `.`) to vector
icons from the Lucide set (~1936 icons). Case-insensitive, kebab-case supported.

```tsx
<Image src="heart" w={16} h={16} />                          {/* sized */}
<Image src="search" w={12} h={12} style={{ color: c.muted }} /> {/* colored */}
<Image src="arrow-right" w={10} h={10} style={{ color: c.primary }} />
```

**Do NOT:**
- Use icons as meaningless decoration — every icon must relate to the component's purpose
- Use only wireframes when an icon would communicate better
- Skip icons entirely and ship a wireframe-only preview
- Import from `@reactjit/icons` in stories — use `<Image src="name" />` instead

**Do:**
- Pick 1-3 icons that represent the component's core function
- Use icons at small sizes (10-20px) as visual anchors alongside text
- Color icons with theme tokens (`c.muted`, `c.primary`, `c.text`)
- Combine icons with styled boxes to create mini-demonstrations
