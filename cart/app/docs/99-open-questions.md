# Open Questions, Committed Positions, and Genuine Opens

This file is the running log of *what is decided* and *what is
still open*. Most items are committed; the genuinely-open list is
short and concrete.

## Committed positions

### Plan format

**Structured (JSON/YAML) is canonical; prose is rendered from it.**
Same grid + same modifiers → same structural plan, byte-for-byte.
Narration is a render pass — deterministic per-cell template by
default, optionally LLM-augmented for readability, **always
re-derivable from the same structural input**. A human-authored
commentary band may annotate a pass; it cannot change semantics.
The hook layer reads the structured form; the agent reads the
rendered prose; both come from one source. No drift between the
contract the agent obeys and the contract the hooks enforce.

See `03-sequencer-plan-trace.md`.

### Per-cell modifier surface

**Three layers, not one.** A universal **tier** (T0–T4) on every
cell. Per-shape declared **slots** (model, sampling, allowed_tools,
privacy, budget, retrieval — typed per the gallery shapes). An open
**`Constraint[]` tail** for the rest. Fixed core + open tail +
uniform tier.

See `04-cells-and-tiers.md`.

### Sequence sharing

**Sequences = recipes-with-arming. One file shape, one directory.**
`cart/app/recipes/` is the home; the recipe file shape carries both
the graph stamp and the arming, from day one. Adding the second
half later forces a migration. Parent reference via Composition's
`inheritsFromCompositionId`. A `notes[]` timeline records body-count
entries (which incident, which run, what fired).

See `08-recipes.md`.

### Sequencer surface

**Inline panel during composition** (so the user can glance at
arming while wiring the graph), **promote to a dedicated
`/sequencer` route for the play sweep** (the sweep needs the whole
viewport — animation, prose render, pause-and-edit). **Not a
modal.** The chrome, onboarding provider, and theme classifiers
carry through both surfaces.

See `03-sequencer-plan-trace.md`.

### Recipes carry arming

Settled. The Strict Supervisor recipe is the canonical example.
Recipe file shape carries both halves on day one.

See `08-recipes.md`.

### Empty sequencer

**Permissive.** Empty = framework default, agent runs as it would
with no sequencer at all. Worth one line in the chrome: *"no cells
armed — running with framework defaults"*. Locked is a posture you
opt into via the Strict Supervisor recipe.

See `08-recipes.md`.

### Live-trace over the grid

**Secondary view, off by default.** The cockpit is the primary
runtime UI per the RTS framing. Grid-replay over the sequencer is a
**post-mortem and historical-stepping surface**, useful for *"why
did pass 3 fire that?"* after the fact.

See `03-sequencer-plan-trace.md`, `07-supervision-vocabulary.md`.

### The two substrates

**Composition is the structural substrate; useIFTTT is the reactive
substrate.** They are not the same thing one level apart. The
canvas hosts both. The sequencer arms both. A cell's shape
(declarative vs. reactive) decides which substrate it lowers to.

See `02-canvas-and-substrates.md`.

### Console + cartridge architecture

**`cart/app/` is the console shell. The sweatshop is the first
product cartridge. The component gallery is its sibling cartridge.
A chatbot is a probable third.** Each ships as a `.so` with the
standard ABI. The cartridge ABI is the fence between them.

See `01-console-cartridges.md`.

### Wounds → laws is user-only

**Models cannot self-promote.** Wounds accumulate without becoming
policy until a human looks at the pattern and says yes. The
*judge* of what becomes policy is outside the system being judged.

See `06-laws-and-promotion.md`, `09-the-four-principles.md`.

### Verification must be mechanical, external, adversarial

**Reviewer cells default to mechanical checks** (build green /
fixture passes / pixel diff / `git diff` / edit-trail diff /
checksum verify). LLM-as-judge is the backstop, not the floor.

See `09-the-four-principles.md`.

### The flow_editor.tsx promotion path

**Promote in place into the sweatshop cartridge — do not duplicate.**
Building a parallel canvas inside the sweatshop while the original
lives outside would be the Mirror-Universe pathology applied to our
own construction. One canvas. The outside copy gets removed in the
same change.

See `02-canvas-and-substrates.md`, `05-pathology-catalog.md`.

### Goal review socket default

**Built-in detector cell, not a static checklist.** Walks the Green
Standard's clauses and applies *only the ones that fit the run*.

See `06-laws-and-promotion.md`, `08-recipes.md`.

### Transport normalization

**A worker is a worker, regardless of transport.** The sweatshop
cartridge abstracts worker observation + intervention through
`runtime/hooks/` and `framework/claude_sdk/`. Cells reference the
Worker shape; they never name kitty.

See `07-supervision-vocabulary.md`.

## Genuinely open

These are the remaining open items. They are *concrete decisions
that will need to be made when the cartridge is built*, not
architectural ambiguities.

### Where the canvas lives inside `cart/app/canvas/`

Promotion of `cart/flow_editor.tsx` is committed (above); the file
structure inside `canvas/` (one TSX file, a `canvas/` directory
with sub-modules, classifier file shape, etc.) is open and follows
whatever the cart already does for similar surfaces.

### Per-cell render templates

Every cell-kind needs a default deterministic prose-render. Authoring
those is real work and the templates need to be diff-able — they
are the cell's contribution to the structural plan. Likely lives
alongside the cell definition (one file per cell-kind, exporting
the template).

### Wound-promotion threshold (`N`)

*"After N wounds on a pattern, surface promote-to-law."* The user's
threshold is personal — not one-size-fits-all. Probably a
per-pattern setting with a sane default (`3`?), tuned over time.

### Cross-recipe modifier conflicts

Two recipes stamp on the same canvas; both want to set `Privacy` on
the Reviewer cell to different values. Last-write-wins is a
foot-gun; merge-with-warning is the right shape, but the merge rule
per modifier-kind needs to be specified per shape. Open.

### Run-to-run state inheritance per memory layer

L4 wounds survive across runs; L1 River doesn't. What about
everything in between? L2 Feeling carries for *this user, this
worker* but probably not across worker retirements. L3 Echo persists
but is decay-weighted. L5 Cooccurrence accumulates indefinitely.
Worth a single rule per layer.

### The recipe migration path

Today's recipes are doc-only (`RecipeDocument`). Tomorrow each adds
a JSX default export + arming export. Open: do we author both
halves manually for the existing 7 recipes, or generate the JSX
form from the doc form? Probably manual for the existing ones, with
a recipe-authoring CLI for new ones.

### The cartridge selector UX

`cart/app/page.jsx` becomes the cartridge selector. Open: what does
the selector look like? Tile grid? List? Recent + pinned? Auto-load
the user's default? This is shell-level, but the sweatshop
cartridge needs to know how it's being launched (default vs. user-
selected vs. deep-link from another cartridge).

### Inter-cartridge state access shape

`framework/cartridge.zig:387` exposes cross-cartridge state access.
Open: the shape of the API the sweatshop cartridge uses to read
gallery rows or to receive a chatbot transcript. Probably typed by
the gallery shapes, with a small dispatch layer.

## What this corpus does not commit

This corpus does not commit specific implementations:

- Visual aesthetics of any surface.
- Performance budgets per cell.
- Wire protocol between cartridges.
- Database schema choice (SQLite is implied by existing hooks but
  not specified here).
- Specific embedding model.
- Specific local-LLM endpoint.

Those are specification-level decisions for whoever builds the
cartridge.

## Cross-references

- The spine + index: `README.md`.
- Each topic doc: `01-console-cartridges.md` through
  `09-the-four-principles.md`.
