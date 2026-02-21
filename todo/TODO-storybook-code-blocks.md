# TODO: Copyable Code Blocks + Right-Click Copy-to-Clipboard for Storybook

## Two features, one goal: see it, copy it, use it

### 1. Code blocks alongside every story

Every story should show the source code that produces what you're looking at. Not a separate "code" tab — inline, right there, so you see the visual output and the code that made it side by side.

**What this means per story:**
- Each story gets a collapsible/expandable code block below (or beside) the visual demo
- The code block shows the minimal JSX to reproduce what's rendered
- Syntax highlighted (even if basic — keyword coloring via Text nodes with color)
- A "Copy" button on the code block (same pattern as the error overlay copy button)
- Code should be the clean, importable version — `import { Box, Text } from '@ilovereact/core'`, not the `../../../packages/shared/src` storybook-internal paths

**Implementation approach:**
- Each `StoryDef` in `stories/index.ts` gets an optional `source: string` field with the example code
- The storybook shell renders the source below the story component when present
- A `CodeBlock` component handles syntax coloring + copy button
- Could also explore reading source at build time via esbuild plugin, but static strings are simpler and let us curate what's shown

### 2. Right-click any rendered element → copy its JSX to clipboard

This is the power feature. You're looking at a button, a card, a chart, a layout — you right-click it and get the JSX that produced it on your clipboard. No hunting through stories, no reading docs.

**How this could work:**

The inspector already knows which node you're hovering (it shows the node tree, computed layout, styles). The data needed to reconstruct JSX is already in the instance tree:
- `node.type` → element type (`Box`, `Text`, `Pressable`, etc.)
- `node.style` → all style props
- `node.props` → event handlers, text content, etc.
- `node.children` → recursive structure

**Approach:**
1. Add a "Copy JSX" option to the inspector's right-click/context menu (or a keyboard shortcut like Ctrl+C when a node is selected in the inspector)
2. Walk the selected node's subtree and serialize it back to JSX:
   ```jsx
   <Box style={{ flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#1e293b', borderRadius: 8 }}>
     <Text style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 'bold' }}>Settings</Text>
     <Text style={{ fontSize: 11, color: '#64748b' }}>Configure your app</Text>
   </Box>
   ```
3. Copy the serialized JSX string to clipboard via `love.system.setClipboardText()`
4. Flash a "Copied!" indicator (same pattern as the error overlay)

**Challenges:**
- Event handlers can't be serialized — strip them or replace with placeholder comments (`{/* onPress handler */}`)
- Deep subtrees need sensible truncation or depth limiting
- Style objects need to be reconstructed from the flat Lua node format back to JSX object syntax
- Some nodes are generated (list items, map results) — the serialized JSX is the expanded version, not the `.map()` loop. That's fine — it's what they see, not how it was built

**Stretch: component-level copy**
- If the selected node is the root of a known story component, offer "Copy full component" which grabs the curated source from the `StoryDef.source` field instead of serializing the tree. This gives cleaner, idiomatic code.

## Files involved

| File | Role |
|------|------|
| `storybook/src/stories/index.ts` | Add `source` field to `StoryDef` |
| `storybook/src/native-main.tsx` | Render code block below story content |
| New: `storybook/src/CodeBlock.tsx` | Syntax-highlighted code display + copy button |
| `lua/devtools.lua` | Add "Copy JSX" to inspector context menu / keybind |
| New: `lua/jsx_serializer.lua` | Walk instance tree → JSX string |
| `lua/errors.lua` | Reference for copy-to-clipboard pattern |

## Priority

1. Code blocks with copy button (high — immediate usability win)
2. Inspector "Copy JSX" for selected node (medium — power user feature, builds on existing inspector)
3. Component-level curated source copy (low — nice to have, depends on #1)
