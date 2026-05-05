# The Composer

The composer is the **UI authoring half** of cart/app. It is a Figma-style
infinite canvas where the artifact you draw IS the JSX a cart will run —
no export step, no translation layer.

It is the sibling of the sweatshop canvas (`02-canvas-and-substrates.md`).
The sweatshop canvas wires capability hooks into runtime graphs; the
composer wires primitives into rendered surfaces. Different cartridge
of the same shell.

Today: `cart/composer.tsx`, ~880 lines, single-file standalone. It
already does: SNode tree → JSX, JSX → SNode tree (live two-way), 3×3
flex alignment grid, double-click-to-resize with parent clamping, color
swatches, hex inputs, layers tree, ordered insertion.

This doc is the **plan** for what it becomes once it moves under
`cart/app/`. Each section is a discrete decision; reference by anchor.

---

## Substrate

Same as everywhere else in this stack: a tree of `SNode`. One node per
visible primitive. Children stack under their parent, clamped to the
parent's content box (padding-aware), no overflow, no absolute
positioning.

```ts
type Kind = 'Box' | 'Text' | 'Pressable' | 'Page' | <gallery atoms…>;
type Align = 'flex-start' | 'center' | 'flex-end';

interface SNode {
  id: string;
  kind: Kind;
  text?: string;
  bg?: string;
  color?: string;
  width?: number;
  height?: number;
  padding?: number;
  alignH?: Align;     // alignItems
  alignV?: Align;     // justifyContent
  flexDirection?: 'row' | 'column';
  // …grows: gap, margin, radius, shadow, transition, conditional, shape
  children: SNode[];
}
```

The tree is the canonical edit surface. The visual canvas, the code
editor, the AI tool calls (§ AI), and the collaboration sync (§ Collab)
are all just different observers and editors of the same `SNode[]`.

---

## Surface layout

Three columns, code drawer at bottom.

```
┌──────────────────────────────────────────────────────────────┐
│  TOOLBAR                                                     │
├────────┬───────────────────────────────────────┬─────────────┤
│        │                                       │ PROPERTIES  │
│ ATOMS  │                                       │             │
│        │           CANVAS (∞ pan/zoom)         │             │
│        │       ┌──────┐    ┌──────┐            ├─────────────┤
│        │       │ page │    │ page │            │ LAYERS      │
│        │       └──────┘    └──────┘            │             │
│        │                                       │             │
├────────┴───────────────────────────────────────┴─────────────┤
│  CODE  (syntax-highlighted, live two-way)                    │
└──────────────────────────────────────────────────────────────┘
```

**Layers move from left to right.** They sit *under* properties on the
right column, because the right side is the per-selection inspector
(properties for what you're editing, layers for what you're editing
*inside of*). Left column becomes the atom palette.

---

## Toolbar

Three groups, left to right:

1. **Tools** — modal cursor. Exactly one is active.
   - `select` (default) — click to select, double-click to resize handles
   - `move` — pan the canvas
   - `draw` — click-drag in empty space to spawn the current primitive
2. **Page** — dropdown of presets. Picking one drops a new `<Page>`
   (a `canvas.node` of kind `Page`) at the click point. Defaults:
   `1920×1080`, `1440×900`, `1280×800`, `1024×768`, `iPhone 16 Pro
   (393×852)`, `iPad (1024×768)`, plus `custom…`.
3. **Atoms** — primitive drop targets. Click to arm; next click on the
   canvas drops one. Currently: `Box`, `Text`, `Pressable`. Grows to
   include component-gallery shapes (§ Gallery atoms).

---

## Properties panel

Per-selection inspector. Sections appear conditionally based on what
the selected node accepts.

- **Content** — `text` for Text/Pressable.
- **Size** — `width`, `height`, `padding`. Clamped to parent (no
  overflow); see § Layout laws.
- **Layout** — `flexDirection`, `gap`, `wrap`, plus quick-row buttons:
  `[row] [col] [flex-row] [flex-col]`. The four buttons are one-click
  presets:
  - `row` — `flexDirection: 'row'`, no flex on children
  - `col` — `flexDirection: 'column'`, no flex on children
  - `flex-row` — `flexDirection: 'row'`, children get `flexGrow: 1`
  - `flex-col` — `flexDirection: 'column'`, children get `flexGrow: 1`
- **Align** — 3×3 grid (already shipped). Sets `alignItems` +
  `justifyContent` in one click.
- **Background** — palette + hex.
- **Text color** — palette + hex.
- **Border** — width, color, radius (per-corner expansion when
  expanded).
- **Shadow** — preset offsets (sm/md/lg/xl) + custom.
- **Animation** — `transition` (property + duration + easing), looping
  toggle, on-mount toggle. Maps to `framework/animation/` props.
- **Conditional** — `showIf` (string expression), `repeatFor` (bind to
  a shape's array field). Compiles to JSX `{cond && <…/>}` or
  `{xs.map(x => <…/>)}`.
- **Shape** — bind a `<Box>` to a gallery shape (`User`, `Plan`, etc.)
  to make it a card/list/form template. See § Gallery atoms.

---

## Layers panel

Same as today, just in a new home (right column, under properties).

- Tree of nodes for the **selected page**.
- Click row → select.
- ▲▼ reorder siblings.
- ✕ delete.
- Drag to re-parent (deferred; not in v1).
- Group / ungroup (Cmd-G / Shift-Cmd-G; deferred).

---

## Pages

A page is a `<Page>` node — a kind of `canvas.node` with a fixed
`width` × `height` and a chrome bar showing its name and resolution.
Multiple pages live on the same canvas; pan/zoom/drop more like
Figma frames.

A page is just a Box with extras: a label, a snap grid, and the rule
that top-level children inside it stack via flex (no absolute
positioning — the existing composer's behavior, generalized).

**Every page has a 1×1 grid** — snap to whole pixels by default,
toggleable to 4/8/16. The grid renders as a subtle dotted overlay
under selection mode.

---

## Layout laws

Same as today, generalized to any nesting depth on any page.

1. **No clipping over parent.** A child's effective width/height is
   clamped to `parent.contentBox` at edit time and at parse time.
2. **Padding-aware.** `parent.contentBox = parent.size − padding × 2`
   (and later: `− margin × 2` once margin lands).
3. **Margin enters next.** Margin shrinks the child's drag area
   symmetrically; clamping subtracts both `padding` and the child's
   own `margin`.
4. **Pages obey the same laws.** A `<Page>` is a parent like any
   other; nodes inside one can't escape its frame.
5. **Resize handle clamps live.** The drag tick already runs every
   frame against `maxSizeIn(parent)`; this generalizes to clamp
   against margin too.

The contract: **what you see on the canvas is what the JSX renders.**
No phantom overflow, no Figma-style "this looks fine in design but
breaks in the browser."

---

## Code editor

Bottom drawer. Live two-way (already shipped).

**New:** syntax highlighting. Tokens to colorize:
- tag names (`Box`, `Text`, `Pressable`, `Page`) — accent
- attribute names (`style`, `color`) — fg
- strings — green
- numbers — orange
- punctuation (`< > = { } / ;`) — dim
- comments — dim italic

Implementation options:
- **Token-stream pass over the existing parser** — the parser already
  walks the source; emit `{ start, end, kind }` tokens alongside the
  tree, render highlighted spans. Tightly coupled, but no new dep.
- **Highlight.js / shiki port** — heavier; not warranted yet.

Go with the first. Same parser, second output.

---

## Gallery atoms

`cart/component-gallery/data/` holds ~70 typed shapes
(`02-canvas-and-substrates.md` lists them). Each shape becomes:

- A **toolbar atom** — clicking it spawns a Box pre-shaped to display
  one record of that shape (label fields, image, action button).
- A **mock instance** when dropped — placeholder values so the canvas
  shows realistic content immediately. ("Lorem ipsum" but typed.)
- A **bind target** for the **Shape** property — pick a shape, the Box
  becomes a card template; pick `repeatFor: shape.collection` and it
  becomes a list.

Same data layer the sweatshop canvas consumes as vocabulary; here it
serves as **layout fodder**. A user mocks "a profile card" by dropping
the `User` atom and arranging fields visually.

---

## AI assistance

Lives in cart/app, which already hosts the chat surface
(`cart/app/chat`). The assistant gets tool calls that operate on the
SNode tree:

```ts
composer.add({ kind: 'Box', parent: '<id>', props: { … } })
composer.patch({ id: '<id>', props: { … } })
composer.move({ id: '<id>', delta: -1 })
composer.delete({ id: '<id>' })
composer.layoutPreset({ id: '<id>', preset: 'flex-col' })
composer.bindShape({ id: '<id>', shape: 'User' })
```

The user's hand and the assistant's tool calls patch the **same
canonical tree**. Both surfaces (canvas + code) reflect changes the
moment they land. The assistant can:

- "Make this card more compact" → patch padding/gap.
- "Center the inner Box" → patch alignH/alignV.
- "Add a confirm button next to the cancel" → add a sibling Pressable
  with matching style.
- "Make this a list of users" → bindShape + repeatFor.

**Read path matters too.** The assistant can ask `composer.snapshot()`
to get the SNode tree as JSON and reason about it before suggesting
changes — the same shape we already serialize/deserialize.

---

## Collaboration

Multiple cursors on the same canvas. Trivial extension of the same
"tree is canonical" contract: every patch op (the same five tool calls
above) is broadcast over a websocket. Last-writer-wins per-id is good
enough for v1; CRDT for properties when concurrent editing of the same
node becomes common.

Identity: cart/app already has session/auth surfaces. Reuse them; add a
`presence` field to the room state.

---

## Roadmap

Numbered to match how we'll actually ship.

1. **Lift composer into cart/app/composer/.** Same UX, same file split
   (router + cartridge). State persists between session reloads via
   `useHotState`.
2. **Right-column reflow.** Properties on top, layers below. Left
   column reserved for atoms.
3. **Page primitive.** `<Page>` as a kind, page presets in toolbar,
   1×1 grid overlay.
4. **Tool modes.** select/move/draw modal cursor, drop-on-click for
   atoms.
5. **Layout quick-buttons + flexDirection / gap.** `row/col/flex-row/
   flex-col` presets.
6. **Border / shadow / radius properties.**
7. **Syntax highlighting** on the code editor (parser-driven).
8. **Gallery atoms in toolbar.** Drop a `User`, mock a card.
9. **Shape binding + conditional.** `repeatFor`, `showIf`.
10. **Animation properties.** Hook into `framework/animation/`.
11. **AI tool calls.** Five-op API exposed to the chat assistant.
12. **Collaboration.** Presence, broadcast patches, multiple cursors.

Each step ships independently and is usable on its own. Steps 1–4
deliver the layout the user described above; steps 5–7 catch the
properties surface up to the visual fidelity people expect; 8–10
unlock realistic mock-ups; 11–12 are what nobody else has shipped.

---

## What this isn't

- **Not a Figma export.** The artifact is the runtime, not a deliverable
  to hand off to engineers.
- **Not a v0 / Bolt clone.** Hands-on visual editing is first-class;
  prompting is one input, not the only one.
- **Not the sweatshop canvas.** Sweatshop wires logic; the composer
  arranges UI. Both serialize JSX, both consume gallery shapes —
  different cartridges, same substrate.

See also:
- `02-canvas-and-substrates.md` — sibling surface, different domain.
- `04-cells-and-tiers.md` — how primitives get promoted from gallery
  shape to first-class component.
- `06-laws-and-promotion.md` — the discipline that lets a hand-drawn
  card graduate into a checked-in component.
