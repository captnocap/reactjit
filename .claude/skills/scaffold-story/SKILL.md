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

### C. preview (optional)

Custom left-column preview content. Falls back to default wireframes.

Use `styleTooltip()` for hover tooltips on styled elements:

```tsx
import { ComponentDoc, styleTooltip, Wireframe } from './_shared/ComponentDoc';

function BoxPreview() {
  const custom = { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16 };
  return (
    <Box style={{ ...custom, justifyContent: 'center', alignItems: 'center' }} tooltip={styleTooltip(custom)}>
      <Text style={{ color: 'white', fontSize: 10 }}>{'Styled element'}</Text>
    </Box>
  );
}

<ComponentDoc docKey="box" preview={<BoxPreview />} />
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
- Import primitives from `'../../../packages/core/src'` — never `@reactjit/core`
- Import theme from `'../../../packages/theme/src'`
- Export must be named `<Name>Story`
- The docKey handles all documentation — do NOT manually write OVERVIEW, USAGE, PROPS, etc.
- If no doc .txt file exists for this component, omit docKey (placeholders render)
