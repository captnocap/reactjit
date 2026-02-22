# Storybook CLAUDE.md

The storybook is not a demo app. It is the canonical reference implementation of
ReactJIT. Every framework capability must be demonstrated here. When you add a
story, you are writing the specification.

## Mental Model

Think of each story as a living document that proves a feature works and teaches
someone how to use it. The story IS the documentation. If the story is confusing
or incomplete, the feature is confusing and incomplete.

Stories must be target-agnostic. The same component renders in SDL2 (natively)
and in the browser (web mode). Do not write stories that assume DOM or that
call browser APIs.

## Story Registration

Every story must be registered in `src/stories/index.ts`. That file is the single
source of discovery for both native and web rendering. Unregistered stories are
invisible.

```typescript
// src/stories/index.ts
import { MyFeatureStory } from './MyFeatureStory';

export const stories: StoryDef[] = [
  // ...
  { id: 'my-feature', title: 'My Feature', section: 'Core', component: MyFeatureStory },
];
```

Sections: `'Core'` | `'Packages'` | `'Demos'` | `'Stress Test'` | `'Dev'`

Pick the section that matches the nature of the feature, not where the code lives.

## Story File Shape

```typescript
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// Named export matching the filename (e.g., MyFeatureStory.tsx → MyFeatureStory)
export function MyFeatureStory() {
  return (
    <StoryPage>
      <StorySection index={1} title="Basic Usage">
        {/* content */}
      </StorySection>
    </StoryPage>
  );
}
```

Always: named export, scaffold wrapper, `useThemeColors()` for content colors.

## Imports

Stories use relative paths that go up to the monorepo source directly:

```typescript
import { Box, Text, Pressable, Slider, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/core/src';
import type { LoveEvent } from '../../../packages/core/src/types';
```

Do not import from published package names like `@reactjit/core`. The storybook
reads from source; relative imports are what keep it in sync without a build step.

## Color System

Always use `useThemeColors()`. Never hardcode colors.

```typescript
const c = useThemeColors();

// Available tokens:
c.text          // primary text
c.bg            // page background
c.bgElevated    // card / panel background
c.surface       // slightly lifted surface
c.primary       // accent / action color
c.border        // subtle separator
c.muted         // secondary / dimmed text
```

## Layout Patterns

### Content stories MUST use the scaffold (NON-NEGOTIABLE)

Content stories (anything with numbered sections, scrollable content, docs-style layout)
**MUST** use `StoryPage` and `StorySection` from `_shared/StoryScaffold.tsx`.
Do NOT hand-write the outer wrapper. Do NOT create your own Section component.
Do NOT use Box with `overflow: 'scroll'` as a page wrapper.

```typescript
import { StoryPage, StorySection } from './_shared/StoryScaffold';

export function MyFeatureStory() {
  return (
    <StoryPage>
      <StorySection index={1} title="Basic Usage">
        {/* section content */}
      </StorySection>
      <StorySection index={2} title="Advanced">
        {/* section content */}
      </StorySection>
    </StoryPage>
  );
}
```

`StoryPage` handles: ScrollView wrapper, centering, max-width (760), padding, gap.
`StorySection` handles: numbered title, card background, border, border-radius, padding.

You write only the content inside each section. Everything else is enforced.

### Full-viewport stories are the exception

Dashboard-style layouts (OverflowStress, AudioRack, Effects, Games, Emulator, 3D, etc.)
fill the viewport directly and do NOT use the scaffold:

```typescript
export function MyDashboardStory() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      {/* custom layout */}
    </Box>
  );
}
```

### Row containers

Row containers **must** have an explicit width or `justifyContent` does nothing:

```typescript
<Box style={{
  width: '100%',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
}}>
```

### Filling remaining space

Use `flexGrow: 1`, never hardcoded pixel heights that assume a window size:

```typescript
<Box style={{ flexGrow: 1 }}>
  {/* absorbs what header and footer don't use */}
</Box>
```

### Text rules

- Every `<Text>` must have an explicit `fontSize`. The linter enforces this.
- Never put Unicode symbols (▶ ⏸ ● ✓ arrows etc.) in `<Text>`. Use Box geometry instead.
- Use `c.text`, `c.muted`, `c.primary` for text colors — never raw hex in stories.

## Sub-Components

Internal helper components are fine and encouraged. Define them in the same file,
above the main export. Keep them simple and unambiguous.
Do NOT create a local `Section` component — use `StorySection` from the scaffold.

```typescript
// Helper for content INSIDE a StorySection (not a replacement for it)
function StatusRow({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: 12, color: c.text }}>{value}</Text>
    </Box>
  );
}
```

## Interactive Controls

### Button / Pressable pattern

State-driven styles using the callback form:

```typescript
<Pressable
  onPress={handlePress}
  style={({ pressed, hovered }) => ({
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 5,
    backgroundColor: pressed ? c.primary : hovered ? c.surface : c.bgElevated,
    borderWidth: 1,
    borderColor: c.border,
  })}
>
  <Text style={{ fontSize: 13, color: c.text }}>Label</Text>
</Pressable>
```

### Slider + label triplet

The standard control row for numeric parameters:

```typescript
<Box style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
  <Text style={{ fontSize: 12, color: c.muted, width: 80 }}>Speed</Text>
  <Box style={{ flexGrow: 1 }}>
    <Slider value={speed} min={0.1} max={3.0} onValueChange={setSpeed} />
  </Box>
  <Text style={{ fontSize: 12, color: c.text, width: 36 }}>{speed.toFixed(1)}</Text>
</Box>
```

## Capabilities System

When writing a story for a capability, the story should demonstrate:

1. **Minimal usage** — one-liner example in a comment or code pane
2. **Live component** — the actual capability rendered and running
3. **Props as controls** — sliders or toggles that drive the capability's schema props

The schema is the contract. Every prop in the Lua schema should be controllable in the story.

```typescript
// One-liner usage the story is proving works:
// <Boids count={60} speed={1.2} />

export function BoidsStory() {
  const [count, setCount] = useState(60);
  const [speed, setSpeed] = useState(1.2);

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Box style={{ /* controls sidebar */ }}>
        {/* sliders for count, speed, etc. */}
      </Box>
      <Box style={{ flexGrow: 1 }}>
        <Boids count={count} speed={speed} />
      </Box>
    </Box>
  );
}
```

## TSL Capabilities

When a capability uses TSL-generated Lua (TypeScript-like source that transpiles to Lua),
the story should expose the full workflow: TSL source → generated Lua → React usage.

Use tab-switching code panes to show all three. The user should understand what they're
authoring, what runs, and how to use it — without reading any docs outside the story.

```typescript
// Three tabs:
// "TSL" — the TypeScript-like source the user authors
// "Lua" — the generated LuaJIT code that actually runs
// "React" — the one-liner component usage
```

The right panel (or main area) shows the live capability. Controls update it in real-time.

## State Management

- `useState` for all interactive state in stories
- `useThemeColors()` for colors (always)
- `useCapabilities()` if you need AI-discoverable schema metadata
- `useBridge()` only for RPC calls to Lua (use sparingly — capabilities are preferred)
- `useHotkey()`, `useClipboard()`, etc. for utility hooks

Do not use `useEffect` for things the capability system handles automatically
(ticking, drawing, lifecycle). If you find yourself calling bridge RPCs in
`useEffect`, that's a sign the capability needs a real Lua implementation.

## What a Good Story Proves

A story earns its place by answering all of these:

1. Does the feature render correctly at all?
2. Are the props doing what they say they do (controls, not just static)?
3. Does it behave correctly at edge values (min, max, empty, 0)?
4. Is the one-liner obvious from looking at the story?
5. Would someone understand how to use this feature having only read the story?

If the answer to any of these is "no" or "sort of", the story is incomplete.

## What NOT to Do

- **Do not hardcode colors.** Always `useThemeColors()`.
- **Do not hardcode pixel heights to fit a known window size.** Use `flexGrow`.
- **Do not add a story and forget to register it in `index.ts`.** It won't appear anywhere.
- **Do not import from `@reactjit/core` by package name.** Use the relative path to source.
- **Do not put Unicode art in `<Text>`.** Use Box geometry or the `usePixelArt` hook.
- **Do not write a story that only shows a static, non-interactive snapshot.** If a feature
  has props, those props should be controllable.
- **Do not create `storybook/lua/` or `storybook/reactjit/` as real directories.** Both are
  gitignored and should remain absent. The storybook reads Lua from the monorepo root via
  symlink, and TypeScript via relative source imports. Nothing to copy, nothing to sync.

## Commit Discipline

After adding or modifying a story:

1. `reactjit lint` — catch layout violations before they ship
2. `reactjit screenshot --output /tmp/preview.png` — verify visually
3. Commit with a clear message: `feat(story): add TslBoids story demonstrating TSL workflow`

Stories are features. Treat them like features. Commit them like features.
