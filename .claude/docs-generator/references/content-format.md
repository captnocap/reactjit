# Content File Format Specification

All documentation lives as `.txt` files in `content/sections/`. Each file uses this exact structure:

## Template

```
=== METADATA ===
title: Component Name
description: One-line summary
category: Components
platforms: love2d, web, terminal, cc, nvim, hs, awesome
keywords: keyword1, keyword2
related: OtherComponent, AnotherHook
difficulty: beginner

=== OVERVIEW ===
Prose description. Single newlines are reflowed into paragraphs.
Double newlines create paragraph breaks.

=== API / SYNTAX ===
```tsx
import { Thing } from '@reactjit/core';
```

Props:
| Prop     | Type    | Default   | Description           |
|----------|---------|-----------|-----------------------|
| style    | Style   | undefined | Flexbox layout props  |

=== EXAMPLES ===
Example 1: Short title
---
```tsx
<Box style={{ width: '100%' }}>
  <Text style={{ fontSize: 16 }}>Hello</Text>
</Box>
```
---
Platforms: All

Example 2: Another example
---
```tsx
// code here
```
---
Platforms: love2d, web

=== PLATFORM NOTES ===
Love2D:
  Platform-specific behavior or limitations.

Web:
  Web-specific notes.

Terminal:
  Grid target notes.

=== CRITICAL RULES ===
- Rule one that users must follow
- Rule two

=== SEE ALSO ===
- RelatedComponent
- AnotherTopic
```

## Rules

- `=== METADATA ===` is required. `title`, `description`, `category`, `platforms` are required fields.
- `difficulty` is one of: `beginner`, `intermediate`, `advanced`
- Valid `category` values: Getting Started, Architecture, CLI, Layout, Components, Hooks, Animation, Routing, Targets, Advanced, Troubleshooting, API Reference
- Valid `platforms`: love2d, web, terminal, cc, nvim, hs, awesome
- Examples use `---` as delimiters around code blocks
- Sections can be omitted if not applicable (e.g. hooks don't need PLATFORM NOTES)
- For `index.txt` files (section overviews): use OVERVIEW and optionally EXAMPLES, skip API/SYNTAX

## Section Numbering

```
01-getting-started/    Getting started, philosophy, installation
02-architecture/       Rendering pipeline, reconciler, layout engine, transport, painter
03-cli-reference/      CLI commands: init, dev, build, update, lint, screenshot
04-layout-system/      Flexbox, sizing, spacing, visual styling, transforms, critical rules
05-components/         All primitives and compound components
06-hooks/              Framework hooks (useLove, useLoveEvent, useLoveRPC, etc.)
07-animation/          AnimatedValue, useAnimation, useSpring, useTransition, easing
08-routing/            Router system
09-targets/            Per-target guides (Love2D, Web, Terminal, CC, Neovim, HS, AwesomeWM)
10-advanced/           Event handling, performance, debugging, custom targets, networking
11-troubleshooting/    Common errors, FAQ
12-api-reference/      Style properties, types
```

## File Naming

- Lowercase, hyphen-separated: `scroll-view.txt`, `use-love-event.txt`
- Each section has an `index.txt` for the section overview
- Component files match their React component name in lowercase: `box.txt`, `text.txt`, `flatlist.txt`

## Build Pipeline

After writing/editing content files:
```bash
npm run build:docs                # Parse, validate, generate dist/llms/*.txt + storybook/src/generated/content.json
npm run validate:docs             # Validate only (no generation)
npm run build:storybook           # Runs build:docs then esbuild (for full storybook rebuild)
```

Generated outputs:
- `dist/llms/llms.txt` — Full concatenated documentation
- `dist/llms/api.txt`, `components.txt`, `hooks.txt`, etc. — Topic slices
- `dist/llms/cheatsheet.txt` — Compact quick reference
- `dist/llms/examples.txt` — All code examples extracted
- `storybook/src/generated/content.json` — JSON for React docs viewer
