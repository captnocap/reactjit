# The Canvas and the Two Substrates

The canvas is an n8n-style visual programming surface. It is the
authoring half of the sweatshop. **It is a visual editor over the
same JSX the framework already runs** — saving a graph serializes
JSX; the framework's React reconciler executes it. There is no
bespoke graph evaluator.

## Three palette tiers, one canvas

1. **Capability nodes** — runtime hooks. The verbs.
2. **Domain nodes** — gallery shapes. The nouns.
3. **Recipe stamps** — pre-wired subgraphs combining both, with
   accompanying arming. See `08-recipes.md`.

### Capability palette (runtime/hooks/)

| n8n node kind | ReactJIT hook |
|---|---|
| HTTP Request | `http.ts` |
| Webhook listener | `useHost.ts`, `websocket.ts` |
| Cron / Schedule | `useIFTTT('timer:every:…')`, `Job` row |
| Filesystem | `fs.ts`, `useFileWatch.ts`, `useFileContent.ts`, `useFileDrop.ts` |
| Database | `sqlite.ts`, `localstore.ts`, `useLocalStore.ts`, `useCRUD.ts` |
| Search | `useFuzzySearch.ts` |
| Subprocess / Shell | `process.ts` |
| Browser automation | `browser_page.ts`, `useTerminalRecorder.ts` |
| Clipboard / Media / Crypto / Math | `clipboard.ts`, `media.ts`, `useMedia.ts`, `crypto.ts`, `math.ts` |
| State | `useHotState.ts` |
| Networking | `useConnection.ts`, `useHost.ts` |
| Reactivity / event bus | `useIFTTT.ts` |
| Privacy / telemetry | `usePrivacy.ts`, `useTelemetry.ts` |

These aren't *resemblances* — they're the same things, plus more
(privacy/telemetry/hot-state are not in n8n). The hook surface IS
the n8n node catalog, already implemented.

### Domain nodes (component gallery shapes)

`cart/component-gallery/data/` holds ~70 typed shapes: `User`,
`Role`, `Goal`, `Plan`, `Phase`, `Task`, `Worker`, `Connection`,
`Model`, `Composition`, `Constraint`, `Privacy`, `Budget`,
`AgentMemory*`, `EventHook`, `Job`, `RetrievalStrategy`, etc. Each
shape's typed fields are the node's input/output ports. Each shape's
`references[]` declares which other shapes it can legally wire to.

The gallery is its own cartridge (`gallery.so`); the sweatshop
cartridge consumes its data layer as vocabulary. See
`01-console-cartridges.md`.

## Two substrates, not one

This is critical: **the canvas hosts cells that lower to two
different substrates.** They are not the same thing one level apart.

### Composition — the structural substrate

`cart/component-gallery/data/composition.ts` defines the universal
structural node:
- `variables[]` are input ports.
- `outputs[]` are output ports.
- `slots[]` are internal flow.
- A source with `kind: 'src_composition'` is a wire to another
  Composition's output port.
- Inheritance via `inheritsFromCompositionId`.
- Per-source / per-slot / post-assembly scripts.
- Open extensibility via `composition-source-kind.ts`.

**Declarative cells** (prompts, role assemblies, retrieval pipelines,
context bundles) compile to Composition rows.

### useIFTTT — the reactive substrate

`runtime/hooks/useIFTTT.ts` is the event-driven substrate:
- Triggers (`'key:ctrl+s'`, `'timer:every:5000'`,
  `'state:foo:true'`, `'system:claude:tool_use'`,
  `'system:fileDropped'`, etc.).
- Actions (`'state:set:foo:bar'`, `'send:event'`, function
  callbacks).
- String-keyed kinds, function escape hatch.
- Module bus + state map as the substrate.
- Edge-detected function triggers (false → true).

**Reactive cells** (timers, key chords, file-drops, hook events,
classifier fires, system signals) compile to `useIFTTT`
registrations.

### Both coexist

The canvas hosts both. The sequencer arms both. A cell's shape
(declarative vs. reactive) decides which substrate it lowers to. The
runtime is React; the framework reconciler runs both. No bespoke
graph evaluator.

## Wires are loose at runtime, hinted at edit time

Strict typing fights "open scene"; loose-only wastes the gallery's
declared `references[]`. The canvas uses a hybrid:

- Every wire passes JSON.
- The editor *colors* wires from the references catalog —
  - **green**: declared compatible per `references[]`.
  - **gray**: unknown but allowed.
  - **red**: known-incompatible but still allowed if you insist.

Hover any port → palette highlights every wireable target. No
enforcement, all signal.

## Open scene — nothing is required, everything composes

The gallery is a **vocabulary**, never a **prescription**. A user can
wire a 40-node Composition for one run and a single bare Worker for
the next. Neither is wrong. The editor never rejects a graph for
being "incomplete"; validators are *suggestions* (yellow underlines,
hover hints), never gates. Recipes are dense reference points; bare
graphs are the floor. **Make the dense thing easy and the sparse
thing legal.**

## Goal node has a review socket

Goals stay open until *something* emits `achieved` into their review
port. Wire whatever — a Reviewer node, a hand-typed condition, an
LLM-as-judge, an `OutcomeRubric` composition, nothing. No port wired
= goal stays open forever (a feature: "I never closed this" is
visible).

The default reviewer is a **built-in detector cell** (not a static
checklist) that walks the Green Standard's clauses and applies *only
the ones that fit the run*. Visual verify only when the run touched
visual output. Corpus check only when a corpus exists. Docs only
when the docs law is armed. See `06-laws-and-promotion.md` for the
Green Standard.

## Chat is one node on a default canvas

Canvas-first. The chat box is a `UserTurn` source node on a default
canvas. Users who never lift the lid get a normal chat. Users who do
get a real editable graph. Splice a Memory node, an MCP tool, a Job
that fires every Friday. Multiple chats = multiple canvases.

## Where the canvas lives

`cart/flow_editor.tsx` is a working node-graph cart sitting outside
`cart/app/` today: pan/zoom Canvas, port-click wiring, bezier paths,
alt-drag tiles. **The plan is to promote this in place into the
sweatshop cartridge — not duplicate it.** Building a parallel canvas
inside the sweatshop while the original lives outside would be the
Mirror-Universe pathology applied to our own construction (see
`05-pathology-catalog.md`). One canvas. The outside copy gets
removed in the same change.

## Cross-references

- Sequencer (the arming surface that complements the canvas):
  `03-sequencer-plan-trace.md`.
- Cells (what nodes-of-meaning compile to): `04-cells-and-tiers.md`.
- Recipes (pre-wired subgraphs you stamp on the canvas):
  `08-recipes.md`.
- Console + cartridge architecture: `01-console-cartridges.md`.
