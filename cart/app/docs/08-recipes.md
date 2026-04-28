# Recipes

A **recipe** in the sweatshop is a stampable, reusable pattern that
seeds both a graph and a sequencer arming. **Recipes carry both
halves in one file.** Forking is at the recipe level; sequences are
recipes-with-arming.

## The file shape

A recipe TSX file exports two faces of the same content:

```tsx
import type { RecipeDocument } from "./recipe-document";

// Display form — drives the doc page in the cartridge.
export const recipe: RecipeDocument = {
  slug: "build-agents-that-remember-your-users",
  title: "Build agents that remember your users",
  sourcePath: "cart/app/recipes/build-agents-that-remember-your-users.md",
  instructions: "…",
  sections: [/* paragraph / bullet-list / code-block sections */],
};

// Stampable form — what the canvas drops in.
export default function RememberYourUsers() {
  return (
    <Composition kind="…">
      {/* graph subgraph */}
    </Composition>
  );
}

// Arming form — what the sequencer pre-toggles when stamped.
export const arming: RecipeArming = {
  cells: [
    { kind: "role", id: "role_reviewer", tier: "T2" },
    { kind: "law", id: "LAW-003", tier: "T4" },
    { kind: "memory", id: "L4_wound_writer", tier: "T0" },
    /* … */
  ],
  modifiers: {
    /* per-cell overrides */
  },
};
```

Three exports, one file. The recipe ships with documentation, a
stampable subgraph, and a recommended arming. Stamp = drop the
subgraph + apply the arming. The user can override either half post-
stamp.

## What lives at `cart/app/recipes/`

Today (pre-cartridge-split): published Anthropic recipes ported into
the ReactJIT dialect. Doc form via `RecipeDocument`
(paragraph / bullet-list / code-block). Examples on disk:

- `build-agents-that-remember-your-users.{md,ts}`
- `context-management-for-long-running-agents.{md,ts}`
- `context-management-on-a-200k-token-window.{md,ts}`
- `frontend-aesthetics-prompting-guide.{md,ts}`
- `giving-claude-a-crop-tool-for-better-image-analysis.{md,ts}`
- `knowledge-graph-construction-with-claude.{md,ts}`
- `sre-incident-response-agent.{md,ts}`

Tomorrow (after cartridge-split): each recipe gains the JSX default
export + arming export, and the directory migrates into the
sweatshop cartridge.

## Default recipes that ship with the sweatshop cartridge

### Strict Supervisor recipe

The canonical example of a recipe that carries arming end-to-end.
Stamping it brings:

- A **Reviewer role** with the **blindness Privacy modifier** (no
  source reads, no grep, no implementation discussion — observation
  through action streams only).
- The **constitutional law set armed at T4** (LAW-001 / 003 / 005 /
  006 / 007 / 018; see `06-laws-and-promotion.md`).
- The **12 trust-nothing checks armed at T1** (see
  `05-pathology-catalog.md`).
- The **no-subagents Constraint** (workers MUST NOT spawn subagents
  — when they do, the supervisor goes blind; see
  `07-supervision-vocabulary.md`).
- The **Green Standard wired to the Goal review socket** (mechanical
  five-clause check — correct source path, real build, visible
  result, docs if applicable, corpus unchanged; see
  `06-laws-and-promotion.md`).

This is the recipe a user stamps when they want maximum supervision
on a real engagement.

### Spec-Authored Plan recipe

Stamps a `Plan` node populated with the plan-schema columns
(`07-supervision-vocabulary.md`), gates per phase, milestones with
`who_approves`, and a default Reviewer wired to `done_criteria`.

### Other recipes carry their own arming

When a recipe gets ported (e.g. `build-agents-that-remember-your-
users`), the recipe author authors both halves: the subgraph the
recipe describes, and the arming it implies. *"This recipe expects
memory writes — arm L1 River and L4 Wound at T0."* *"This recipe
involves long-running tasks — arm context-cliff watch at T2."* The
recipe is opinionated about what cells should be on for it to do
its named job.

## Goal review socket — the default reviewer recipe

When a Goal node has nothing wired to its review socket, the
default behavior is **a built-in detector cell** (not a static
checklist). The detector walks the Green Standard's clauses
(`06-laws-and-promotion.md`) and applies *only the ones that fit
the run*:

- Visual verify only when the run touched visual output.
- Corpus check only when a corpus exists.
- Docs only when the docs law is armed for this run.
- Real-build check always (zero-cost mechanical check).
- Source-path check always.

The clause-applies-here decision is part of the cell, so a
non-visual run does not fail review on a missing screenshot. See
`02-canvas-and-substrates.md` for the Goal node and review-socket
mechanics.

## Empty-sequencer behavior

Zero cells armed = **framework default**. Permissive. The agent runs
as it would with no sequencer at all. Worth one line in the chrome:
*"no cells armed — running with framework defaults"* — so the user
knows the floor is exposed, not hidden.

Locked is a posture you opt into via the Strict Supervisor recipe,
not the floor.

## Recipes vs. sequences vs. compositions

- **Composition** (gallery shape) — the unit of structural cell
  content. A prompt assembly, a retrieval pipeline, a role assembly.
- **Recipe** — a TSX file exporting (doc, subgraph, arming).
  Stampable. Reusable. The unit users fork.
- **Sequence** — historical. The state of the sequencer at a moment
  in time, with notes/body-count/parent-ref. Sequences ARE recipes
  in this design — one file shape, one directory.
  `inheritsFromCompositionId` is the parent-ref precedent.

Forking *"Siah's standard ReactJIT-feature-pass v3"* shows you which
laws have bodies and which are unfired drafts. The fork is a new
recipe with a parent reference and a `notes[]` timeline.

## Cross-references

- Recipe documents (current display form): `recipe-document.ts` in
  this directory's parent.
- Strict Supervisor recipe details: `07-supervision-vocabulary.md`
  (blindness, no-subagents, retirement policy).
- Constitutional law set: `06-laws-and-promotion.md`.
- 12 trust-nothing cells: `05-pathology-catalog.md`.
- Green Standard: `06-laws-and-promotion.md`.
- Goal review socket: `02-canvas-and-substrates.md`.
