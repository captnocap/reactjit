# TSLX Demo: Before & After

This directory shows **exactly** what TSLX conversion looks like, using the chemistry
package as the case study.

## The Problem

Every Lua capability in `before/lua-capabilities/` is reimplementing Box and Text
with raw `love.graphics` draw calls. Each one manually:

- Draws rectangles (`love.graphics.rectangle`) — Box already does this
- Prints text (`love.graphics.print`) — Text already does this
- Measures text (`font:getWidth`) — layout.lua already does this
- Handles mouse clicks (`love.mouse.isDown`) — Pressable already does this
- Implements spring animations — Box animation props already do this
- Parses colors (`Color.parse`) — style props already do this

Meanwhile `before/tsx-wrappers/` has black-box one-liners like
`<Native type="ElementTile" />` that tell the user nothing about what's inside.

And `before/zombie-ts/` has full copies of data tables (118 elements, compounds,
enthalpies) that already exist in `lua/capabilities/chemistry.lua`.

## The Fix

`after/` contains TSLX and TSL files that replace **everything**.

- **TSLX** files compose UI from `<Box>`, `<Text>`, `<Pressable>` — no `love.graphics`
- **TSL** files author compute in TypeScript syntax — compile to the same Lua
- No manual painter code, no special node types
- No manual hit testing or mouse polling
- No reimplemented springs or animations
- The user never sees or writes Lua — everything compiles to it

## The Three File Types

### `.tslx` — Component (compute + composition)

TSLX is to Lua what TSX is to JavaScript. It compiles to a Lua capability
registration. The `compute()` block handles data logic. The `render()` block
composes from primitives. If compute logic is only used by one component, it
belongs in that component's `compute()` block — same as a helper function
inside a TSX component.

### `.tsl` — Shared compute (no UI)

TSL is 1:1 TypeScript-to-Lua syntax translation. It cannot make rectangles
appear — it's pure compute. Use it for logic shared across multiple components:
element data, formula parsing, molar mass, spectra lookup. If a function is
only used by one TSLX file, inline it in the `compute()` block instead.

### The relationship

```
.ts  → compiles to → .js   (runs in browser via V8)
.tsl → compiles to → .lua  (runs in LuaJIT)
.tsx → compiles to → .js   (React component for DOM)
.tslx → compiles to → .lua (React component for Love2D)
```

TypeScript is an authoring language for JavaScript. TSL/TSLX is an authoring
language for Lua. You don't ship `.ts` to Chrome. You don't ship `.tsl` to LuaJIT.

## After Structure

```
after/
├── chemistry/              ← shared compute (TSL → Lua)
│   ├── elements.tsl           data store, getElement, valenceElectrons
│   ├── compounds.tsl          compound metadata, name→formula lookup
│   ├── formulas.tsl           parseFormula, molarMass
│   ├── spectra.tsl            IR absorptions, wavelength→color
│   ├── reagents.tsl           reagent databases, mechanisms, multi-test
│   └── stoichiometry.tsl      gas laws, molarity, equilibrium
├── ElementTile.tslx        ← imports elements
├── ElementCard.tslx        ← imports elements
├── ElementDetail.tslx      ← imports elements
├── MoleculeCard.tslx       ← imports elements, compounds, formulas
│                              (buildMolecule inlined in compute block)
├── ReactionView.tslx       ← imports formulas
│                              (balancer inlined in compute block)
└── PeriodicTable.tslx      ← composes ElementTile (composition all the way down)
```

## What Changed

| Before | After | Improvement |
|--------|-------|-------------|
| `love.graphics.rectangle` | `<Box>` | Declarative, styled, animatable |
| `love.graphics.print` | `<Text>` | Auto-measured, auto-laid-out |
| `love.mouse.isDown` + hit test | `<Pressable onPress={}>` | Built-in event handling |
| Manual spring solver | `animation="cardFlip"` | One prop |
| `font:getWidth` + cursor math | `flexWrap: "wrap", gap: 8` | Flexbox layout |
| `Color.parse("#hex")` | `color: "#hex"` | Style prop |
| Manual `drawChip` function | `chips.map(c => <Box>...)` | Composition |
| 233-line PeriodicTable.lua | `TABLE_LAYOUT.map(row => <ElementTile>)` | Composition |
| chemistry.lua (hand-written) | chemistry/*.tsl (TypeScript syntax) | Same Lua output, readable source |
| elements.ts (zombie duplicate) | Deleted — tsl IS the source | Single source of truth |
| capabilities.tsx (black box) | Deleted — tslx IS the component | Self-documenting |

## Scoping Rules

**Shared compute → TSL file.** If multiple components need `parseFormula` or
`getElement`, those live in a `.tsl` file under `chemistry/`. They compile to Lua
modules that any TSLX file can `require`.

**Component-scoped compute → TSLX compute block.** If only `ReactionView` needs
the equation balancer, the balancer lives inside `ReactionView.tslx`'s `compute()`
block. No separate file. Same reason you'd put a helper function inside a React
component file if nothing else imports it.

**Composition → TSLX render block.** If `PeriodicTable` is a grid of `ElementTile`,
it imports and composes `<ElementTile>`. Composition turtles all the way down.

## How to Read a Before File and Write the After

1. Open the Lua capability (e.g. `element_tile.lua`)
2. Find every `love.graphics.rectangle` → that's a `<Box>`
3. Find every `love.graphics.print` → that's a `<Text>`
4. Find every `love.mouse.isDown` → that's a `<Pressable>`
5. Find the data lookup (e.g. `Chemistry.getElement`) → that goes in `compute()`
6. If the data logic is shared, put it in a `.tsl` file. If it's component-only, inline it.
7. Compose them in `render()` using the same layout the Lua was calculating manually
8. The Lua capability goes away. The TSX wrapper goes away. The zombie TS goes away.
   One TSLX file (or TSLX + shared TSL) replaces all three.

## What Stays in Lua

Nothing, eventually. TSL compiles TypeScript syntax to Lua. The chemistry engine
was hand-written Lua — now it's `chemistry/*.tsl`, same algorithms, same output,
TypeScript authoring.

The only things that genuinely need hand-written Lua are framework internals
(layout engine, painter, bridge) — not user-facing components or compute.
