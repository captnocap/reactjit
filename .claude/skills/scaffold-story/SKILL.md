---
name: scaffold-story
description: "Scaffold and populate a Layout1-style documentation story for a ReactJIT component. Use when the user says '/scaffold-story ComponentName', 'scaffold a story for X', 'create a story for X', or wants a new component documentation page in the storybook. Generates the file, then fills in real props, callbacks, starter code, and preview."
---

# Scaffold Story

Generate a Layout1 documentation page for a ReactJIT component.

## THE RULE (NON-NEGOTIABLE)

**There is no ComponentDoc. There is no shared wrapper. There never will be again.**

Every story is a FLAT file that inlines all its documentation as static hoisted constants.
You read the .txt doc file, you copy the values by hand into const declarations at the top
of the story file, and the JSX references those constants. That's it.

**WHY:** A previous version of this used a `<ComponentDoc>` wrapper component. That wrapper
re-rendered every frame, fed CodeBlock a new string identity at 60fps, and caused the Lua
tokenizer to re-run continuously — an 18-hour memory leak. The fix is structural: static
constants hoisted outside the component body = stable identity = no churn. Never re-wrap.

## Step 1: Read the doc file

Find the corresponding doc .txt file:

```bash
ls content/sections/*/$(echo "<ComponentName>" | tr '[:upper:]' '[:lower:]').txt
```

Read it. You'll need values from these sections:

| Doc section          | Maps to story constant     | Maps to UI section     |
|----------------------|----------------------------|------------------------|
| METADATA.title       | Used inline in header      | Header title           |
| METADATA.description | Used inline in header      | Header description     |
| METADATA.category    | Used inline in footer      | Footer breadcrumb      |
| API/SYNTAX import    | Header snippet pill        | Syntax-colored pill    |
| API/SYNTAX usage     | `USAGE_CODE` const         | USAGE CodeBlock        |
| API/SYNTAX props     | `PROPS` const (non-on*)    | PROPS two-column       |
| API/SYNTAX props     | `CALLBACKS` const (on*)    | CALLBACKS list         |
| OVERVIEW paragraph   | Used inline                | OVERVIEW section       |
| CRITICAL RULES       | `BEHAVIOR_NOTES` const     | BEHAVIOR bullet list   |
| EXAMPLES first block | `STARTER_CODE` const       | Playground starter     |

## Step 2: Create the story file

Copy the structure from `storybook/src/stories/Layout1Story.tsx` — the canonical template.

Replace ALL placeholder text with real values from the doc file. Every value goes into a
`const` declaration at the TOP of the file, outside the component function.

```tsx
// ── Static data from content/sections/05-components/box.txt ──

const USAGE_CODE = `<Box style={{ padding: 16 }}>
  <Text>Hello</Text>
</Box>`;

const STARTER_CODE = `<Box style={{...}}>...</Box>`;

const PROPS: [string, string, string][] = [
  ['style', 'Style', 'layout'],
  ['children', 'ReactNode', 'layers'],
  // ... every prop from the doc, by hand
];

const CALLBACKS: [string, string, string][] = [
  ['onClick', '(e) => void', 'pointer'],
  // ... every on* handler from the doc, by hand
];

const BEHAVIOR_NOTES = [
  'Box is a flex container. Default direction is column.',
  // ... from critical rules or key behavioral notes
];
```

**Prop tuples are [name, type, icon].** Pick a relevant Lucide icon name for each prop.

## Step 3: Build the preview

The left panel shows a visual demonstration of the component. Use:
- Styled boxes with `tooltip={styleTooltip({...})}` for hover info
- `<Image src="icon-name" />` with icons relevant to the component
- `<Wireframe label="X" style={{...}} />` for structural placeholders

Pick 1-3 icons that represent the component's core function. Examples:
- Button → `mouse-pointer-click`, `pointer`
- Search → `search`, `filter`
- Modal → `panel-top`, `x`
- Chart → `bar-chart`, `trending-up`

## Step 4: Syntax-color the header snippet

The header pill uses colored Text fragments for JSX syntax:

```tsx
<Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
<Text style={{ color: SYN.component, fontSize: 10 }}>{'Box'}</Text>
<Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
<Text style={{ color: SYN.prop, fontSize: 10 }}>{'style'}</Text>
<Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
<Text style={{ color: SYN.value, fontSize: 10 }}>{'{...}'}</Text>
<Text style={{ color: SYN.tag, fontSize: 10 }}>{' />'}</Text>
```

## Step 5: Register and validate

Add the import + entry in `storybook/src/stories/index.ts`:

```tsx
import { BoxStory } from './BoxStory';
// ...
{ id: 'box', title: 'Box', section: 'Core', component: BoxStory },
```

Then:

```bash
make build-storybook-love   # verify it builds
rjit lint                   # if inside a project context
```

## What NOT to do

- **NEVER** create a shared ComponentDoc, DocPage, StoryDoc, or ANY wrapper component
- **NEVER** build a hook/loader that reads .txt files at runtime (useDocContent is dead)
- **NEVER** pass doc content as props to a shared component
- **NEVER** create strings/objects inside the component body — hoist everything as `const`
- **NEVER** import from `_shared/ComponentDoc` — it no longer exists
- Import primitives from `'../../../packages/core/src'` — never `@reactjit/core`
- Import theme from `'../../../packages/theme/src'`
- Export must be named `<Name>Story`

## Layout reference

```
┌─────────────────────────────────────────┐
│ [icon] Title  <Snippet />  description  │  Header (from docs metadata)
├───────────────────┬─────────────────────┤
│                   │ OVERVIEW            │  inline from docs
│  Preview          │ USAGE (CodeBlock)   │  USAGE_CODE const
│  (centered)       │ BEHAVIOR            │  BEHAVIOR_NOTES const
│  styled boxes     │ ───────────────     │
│  + icons          │ PROPS               │  PROPS const [name,type,icon]
│  + tooltips       │  [icon] name  Type  │
│  + wireframes     │ ───────────────     │
│                   │ CALLBACKS           │  CALLBACKS const [name,sig,icon]
│  (centered)       │  [icon] onX  sig    │  (centered)
├───────────────────┴─────────────────────┤
│ [folder] Section / [icon] Name  [Play]  │  Footer
└─────────────────────────────────────────┘
```

Both panels are centered (ScrollView with justifyContent/alignItems center).
Playground mode flips center to: left=TextEditor, right=live Preview.
