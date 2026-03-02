---
name: scaffold-story
description: "Scaffold and populate a Layout1-style documentation story for a ReactJIT component. Use when the user says '/scaffold-story ComponentName', 'scaffold a story for X', 'create a story for X', or wants a new component documentation page in the storybook. Generates the file, then fills in real props, callbacks, starter code, and preview."
---

# Scaffold Story

Generate a Layout1 documentation page for a ReactJIT component.

## Step 1: Generate

```bash
bash scripts/scaffold_story.sh <ComponentName> <Section>
```

Section defaults to `Core`. Valid: `Core | Packages | Demos | Stress Test | Dev | Bad Habits | Layouts`.

Creates `storybook/src/stories/<Name>Story.tsx` and registers it in `index.ts`.

## Step 2: Find real props

Read the component source to get actual props and callbacks:

- Core primitives: `packages/core/src/types.ts` (BoxProps, TextProps, etc.) and `packages/core/src/primitives.tsx`
- Other components: search `packages/*/src/` for the export
- Capabilities: check `lua/capabilities/` for the Lua-side schema

Split into data/layout props vs event callbacks.

## Step 3: Edit the generated file

Open `storybook/src/stories/<Name>Story.tsx`. Edit these sections:

### A. PROPS array (~line 67)

Replace placeholder with real props. These render in a 2-column grid.

```tsx
const PROPS: [string, string][] = [
  ['style', 'ViewStyle'],
  ['source', 'ImageSource'],
  ['resizeMode', "'cover' | 'contain' | 'stretch'"],
  ['borderRadius', 'number'],
  ['children', 'ReactNode'],
];
```

### B. CALLBACKS array (~line 73)

Replace with real event handlers. These render full-width, single column.

```tsx
const CALLBACKS: [string, string][] = [
  ['onLoad', '(e: LoadEvent) => void'],
  ['onError', '(e: ErrorEvent) => void'],
];
```

### C. STARTER_CODE (~line 52)

A self-contained JSX snippet demonstrating the component. Only `Box` and `Text` are guaranteed available in the playground eval context.

```tsx
const STARTER_CODE = `<Box style={{ padding: 16, gap: 8 }}>
  <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
    Hello from the playground
  </Text>
</Box>`;
```

### D. Header text (~lines 133, 147, 154)

Three strings to replace:

- **Title** (~line 133): Already set to `<Name>` by the scaffold — usually fine as-is
- **Snippet** (~line 147): Replace `'<Name prop={value} />'` with a realistic one-liner usage
- **Description** (~line 154): Replace with a real one-sentence description

### E. Documentation sections (right column)

The right column has five sections separated by dividers. Fill in real content:

- **OVERVIEW** — one paragraph describing what this component is and when to use it
- **USAGE** — a `<CodeBlock language="tsx">` showing a realistic usage example
- **BEHAVIOR** — 2-4 bullet-style `<Text>` nodes describing key behaviors and defaults
- **PROPS** — auto-generated 2-column grid (from the PROPS array)
- **CALLBACKS** — auto-generated single-column list (from the CALLBACKS array)

### F. Preview panel with style tooltips (left column)

The left side of docs mode shows preview elements. **Any element with custom visual styles must show those styles in a tooltip on hover.**

Use `styleTooltip()` (defined in the template) to auto-generate tooltips:

```tsx
{(() => {
  const custom = { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16 };
  return (
    <Box style={{ ...custom, justifyContent: 'center' }} tooltip={styleTooltip(custom)}>
      <Text style={{ color: 'white', fontSize: 10 }}>{'Styled element'}</Text>
    </Box>
  );
})()}
```

**Pattern:** Define custom styles as a separate `const`, spread into the Box's `style`, pass to `styleTooltip()`. This keeps custom styles co-located and the tooltip auto-generated.

**Gets a tooltip:** `backgroundColor`, `borderRadius`, `borderWidth`, `borderColor`, `padding`, `width`, `height`, `opacity`, `shadowColor` — any visual property.

**No tooltip:** `flexGrow`, `flexShrink`, `flexBasis`, `flexDirection`, `flexWrap`, `alignItems`, `alignSelf`, `justifyContent`, `overflow`, `position`, `zIndex`, `display` — pure structural properties. A Box that only has structural styles gets no tooltip.

## Step 4: Validate

```bash
rjit lint
```

## Layout reference

```
┌─────────────────────────────────────────┐
│ Title  <snippet />        description   │  Header
├───────────────────┬─────────────────────┤
│                   │ OVERVIEW            │
│  Preview          │ USAGE (CodeBlock)   │
│  (ScrollView)     │ BEHAVIOR            │  Center
│  hover styled     │ ───────────────     │  (flexGrow:1)
│  elements for     │ PROPS               │
│  style tooltips   │  name   Type        │
│                   │ ───────────────     │
│                   │ CALLBACKS           │
│                   │  onX    sig         │
├───────────────────┴─────────────────────┤
│ Section / Name         [Playground] v0  │  Footer
└─────────────────────────────────────────┘
```

Playground mode flips center to: left=TextEditor, right=live Preview.

## Rules

- Import from `'../../../packages/core/src'` — never `@reactjit/core`
- Import theme from `'../../../packages/theme/src'`
- Always `useThemeColors()` — never hardcode hex colors
- Export must be named `<Name>Story`
- Max ~10 props (auto-split into 2 columns)
- Callbacks render single-column, full-width
- Preview elements with custom visual styles MUST use `styleTooltip()` for hover tooltips
