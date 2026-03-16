# Content File Format Specification (tsz)

All documentation lives as `.md` files in `tsz/docs/`. Each file uses this exact structure:

## Template

```markdown
---
title: Feature Name
description: One-line summary
category: Primitives
keywords: keyword1, keyword2
related: OtherFeature, AnotherConcept
difficulty: beginner
---

## Overview

Prose description. What it is, when to use it, how it fits in the stack.
2-4 sentences. No filler.

## Syntax

```tsz
import Component from './Component.tsz';

function App() {
  return (
    <Component prop={value}>
      <Text>Hello</Text>
    </Component>
  );
}
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| style | StyleObject | {} | Flexbox layout + visual props |

## Examples

### Basic Usage

```tsz
function App() {
  return (
    <Box style={{ padding: 16, backgroundColor: '#1e1e2a' }}>
      <Text fontSize={16} color="#fff">Hello</Text>
    </Box>
  );
}
```

### With State

```tsz
function App() {
  const [count, setCount] = useState(0);
  return (
    <Pressable onPress={() => setCount(count + 1)}>
      <Text fontSize={24} color="#fff">{`Count: ${count}`}</Text>
    </Pressable>
  );
}
```

## Internals

_Optional._ How this compiles to Zig. What runtime module handles it.
Only include for contributors or when understanding the mapping helps users debug.

## Gotchas

- Common mistake one
- Thing that silently breaks

## See Also

- [RelatedFeature](../section/related-feature.md)
- [AnotherConcept](../section/another-concept.md)
```

## Rules

- Frontmatter is required. `title`, `description`, `category`, `keywords` are required fields.
- `difficulty` is one of: `beginner`, `intermediate`, `advanced`
- Valid `category` values: Getting Started, Architecture, Compiler, Primitives, Layout, State, Events, FFI, Styling, CLI, Runtime, Advanced, Troubleshooting
- Code blocks use `tsz` language tag for .tsz code, `zig` for Zig internals, `bash` for shell commands
- Examples must be copy-pasteable — no pseudocode, no elided sections
- Sections can be omitted if not applicable (e.g. CLI commands don't need Props/API)
- For `index.md` files (section overviews): use Overview and optionally Examples, skip Props/API

## Section Numbering

```
01-getting-started/    Installation, first app, build commands
02-architecture/       Compiler pipeline, runtime structure, layout engine
03-primitives/         Box, Text, Image, Pressable, ScrollView, TextInput, Window
04-layout/             Flexbox, sizing tiers, proportional fallback, style props
05-state/              useState, reactive re-render, state slots
06-events/             onPress, hit testing, hover, scroll, keyboard
07-ffi/                C interop, @ffi directive, declare function, linking
08-styling/            Inline styles, Tailwind classes, colors, borders, shadows
09-cli/                tsz build, tsz run, tsz gui, tsz tray
10-runtime/            Watchdog, BSOD, multi-window, video, image loading
11-advanced/           Component composition, imports, children forwarding, devtools
12-troubleshooting/    Common errors, debugging, layout bugs
```

## File Naming

- Lowercase, hyphen-separated: `scroll-view.md`, `use-state.md`
- Each section has an `index.md` for the section overview
- Primitive files match their component name in lowercase: `box.md`, `text.md`, `pressable.md`
- Runtime module files match Zig source: `watchdog.md`, `bsod.md`, `mpv.md`

## Style Guide

- **Precision over verbosity.** Say what the user needs to know, nothing more.
- **Show minimal working case first**, then variations. Don't start with the 10-prop version.
- **Document behavior, not implementation.** Users care about what it does. Save Zig internals for the Internals section.
- **.tsz is the language.** Examples are always in `.tsz` syntax unless showing build commands or Zig internals.
- **React terminology is fine.** The .tsz authoring surface is intentionally React — `useState`, `useEffect`, JSX, props, children, component composition. Use familiar React terms when describing the API. Just be clear about what's different under the hood (compiles to Zig, no virtual DOM, no runtime reconciler).
- **Explain the dogfooding model.** The .tsz compiler is a code generator. Primitives (Box, Text, etc.) are defined once in hand-written Zig. Everything built on them — user apps, framework UI, devtools, crash screens — is `.tsz` compiled to `.gen.zig`. The pre-compile step exists so you don't hand-write Zig UI that reimplements the same primitives. Both hand-written and generated .zig are just Zig code; the difference is one was generated correctly from declared primitives.
- **No Love2D references in user-facing docs.** The Lua stack is an implementation detail of the port. Users don't need to know.
