# Sweatshop Cartridge — Design Corpus

This is the design corpus for the **sweatshop cartridge** — the first
non-trivial product cartridge to ship under the `cart/app/` console
shell. Written for retrieval, not narrative reading. Each file is a
self-contained chunk; cross-references use exact filenames so
embedding-driven retrieval can chain hops.

## The spine

> The sequencer is build-time. The plan is runtime. The prose is the
> seam.

That sentence is the entire architecture. Authoring (canvas +
sequencer) is separated from execution (plan + agent + trace). The
plan is text — the agent reads its prose; the hook layer reads its
structured form; both come from one source. The sequencer is gone by
then.

## How `cart/app/` is structured

`cart/app/` is the **console shell** — chrome, onboarding, cartridge
selector, cartridge loader. PlayStation/Xbox-style: minimal,
persistent, hosts everything else. Surface logic lives in cartridges.

The `<Cartridge>` primitive (`runtime/primitives.tsx:156`) backed by
`framework/cartridge.zig` is the formal mechanism. Each cartridge is a
`.so` with its own ABI, its own crash domain, its own hot-reload
cycle.

Cartridges that ship under the shell:
- **Sweatshop** — the canvas / sequencer / cockpit. This corpus.
- **Component gallery** — the storybook of typed shapes.
- **Chatbot** (planned) — non-agentic chat.

Each is a `.so`. The cartridge ABI is the fence between them.

## Index

- [01-console-cartridges.md](01-console-cartridges.md) — the console
  shell, cartridge ABI, gallery as cartridge, hot reload + crash
  isolation + inter-cart state.
- [02-canvas-and-substrates.md](02-canvas-and-substrates.md) — n8n-
  style canvas, the two substrates (Composition + useIFTTT), wire
  typing, capability palette.
- [03-sequencer-plan-trace.md](03-sequencer-plan-trace.md) — toggle
  grid, animation as commit ceremony, deterministic plan, two-reader
  output.
- [04-cells-and-tiers.md](04-cells-and-tiers.md) — what a cell is,
  cell families, T0–T4 tier system, modifier surface.
- [05-pathology-catalog.md](05-pathology-catalog.md) — named
  pathologies, 12 trust-nothing mechanical checks, classifier
  topology.
- [06-laws-and-promotion.md](06-laws-and-promotion.md) — wounds → laws
  gradient, constitutional laws, law canonical shape.
- [07-supervision-vocabulary.md](07-supervision-vocabulary.md) —
  plan/task schemas, blindness, retirement policy, hook layer, M3A
  memory layers.
- [12-the-three-roles.md](12-the-three-roles.md) — assistant +
  supervisor + worker, three time horizons, three memories,
  advisory-only signaling between them, memory partitioning across
  roles.
- [08-recipes.md](08-recipes.md) — recipe file shape (graph + arming),
  Strict Supervisor recipe, Goal review socket default.
- [09-the-four-principles.md](09-the-four-principles.md) — design
  constraints that bind cell authoring.
- [10-current-substrate.md](10-current-substrate.md) — concrete
  inventory of what works today (with code paths) and what
  infrastructure is still needed.
- [99-open-questions.md](99-open-questions.md) — committed positions
  + what's genuinely open.

## User flow (continuous from onboarding)

1. **First boot.** User runs onboarding (`cart/app/onboarding/`). At
   Step5 they type their first goal. `OnboardingProvider` holds it,
   then `markComplete()` flips the cart into its post-onboarding
   home. Onboarding is shell-level (precedes any cartridge).
2. **Land at the cartridge selector** — today the `page.jsx`
   placeholder; in the console model, this is where the user picks
   sweatshop / chatbot / gallery (or auto-loads a default).
3. **Inside the sweatshop cartridge:** compose on the canvas (hand-
   wired or recipe-stamped), arm cells in the sequencer, hit play.
4. **Playhead sweep.** Structural plan emits, prose renders, user
   pauses on any pass that looks wrong, commits.
5. **Run.** Agent executes inside the contract. No babysitting.
6. **Review the trace.** What fired, what was skipped, what cost
   what. Diff against past sequences. Save, fork, share.

Subsequent runs skip steps 1–2.

## What's frozen vs. what's open

These positions are committed (see `99-open-questions.md` for full
leans):

- Console + cartridge architecture; gallery is a cartridge.
- Build-time/runtime split with prose as the seam.
- Structured plan canonical, prose rendered, both deterministic.
- Two substrates (Composition structural + useIFTTT reactive)
  coexist on the canvas.
- Three-layer modifier surface (tier + declared slots + open
  `Constraint[]` tail).
- Recipes carry both graph and arming in one file shape.
- Inline panel for arming during composition + dedicated route for
  the play sweep. Not a modal.
- Empty sequencer = framework default, permissive.
- Live-trace as post-mortem, not primary runtime UI.
- L4-Wound → law promotion is user-only, never model-self-promote.
- Verification must be mechanical, external, adversarial.

Genuinely open items live in `99-open-questions.md`.

## Source documents this corpus distills

The corpus is derived from these prior writings; the original notes
remain authoritative for context the corpus omits:

- `tsz/plans/fix.md` — 3700-line living doc of pathologies, classifier
  tiers, M3A memory, brainstorm/enforce modes. **Note:** any portion
  about intent-syntax / chad-only / lane pivots / `.tsz` dialect is
  historical and not the direction this corpus takes. The
  vocabulary, schemas, and supervision principles carry forward.
- `/home/siah/supervisor-claude/CLAUDE.md` — the spec-enforcement
  supervisor stance. Transport (kitty panes) is one surface; the
  vocabulary is what carries forward.
- `/home/siah/supervisor-claude/claude-sweatshop/` — pathology
  catalog, law book, retirement policy, plan/task schemas, hooks.
- `/home/siah/supervisor-claude/TRUST_NOTHING.md` — 12-point
  worker-lie catalog feeding the trust-nothing check cells.
- `/home/siah/supervisor-claude/plan-schema.md`,
  `task-schema.md` — canonical column sets for `Plan` / `Phase` /
  `Task`.
