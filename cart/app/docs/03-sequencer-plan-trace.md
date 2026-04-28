# The Sequencer, the Plan, the Trace

The sequencer is the **arming half** of the sweatshop. The canvas
defines what is *possible*; the sequencer defines what is *armed for
this run*. The output of the sequencer is the **plan** — text the
agent reads and JSON the hook layer enforces, both emitted from one
source.

## Build-time vs runtime — the spine

> **The sequencer is build-time. The plan is runtime. The prose is
> the seam.**

Authoring is separated from execution. The sequencer's job is to let
the human think spatially about which rules fire when. The plan's
job is to be a serialized contract the agent can follow.
**Conflating them — driving execution live from the grid — would put
the human back at the playhead.** Author once, animate to commit,
walk away.

## The sequencer

A 2D toggle grid. Each toggle is a **cell** — a behavior, rule, pose,
or loop the user wants armed. See `04-cells-and-tiers.md` for what a
cell *is* and what modifiers attach to it.

**Steps are not units of time.** A step in this sequencer is not a
clock tick. It is whatever heterogeneous thing the user wants armed
for the run. Examples:

- Pinning the `CLAUDE.md` to a specific scope.
- Chaining `explore → write` across distinct models (smart for the
  read, fast for the edit).
- Spawning parallel agents in groups; double agents for two
  approaches.
- Ralph-style interception of all pathologies.
- Mandatory checkpoint commits at every cell boundary.
- Preamble allowing or forbidding scope (*"do NOT touch X"*).
- A long planning phase by smart agents → execution by fast agents.
- A 50k-token tight loop: read N lines, write code, rinse, repeat.

The sequencer doesn't constrain what a cell *contains*. It exposes
**the act of arming and ordering** them as a planning artifact.

## The animation is the commit ceremony

You set up the grid. You hit play. The playhead sweeps left to
right. As it crosses each column, the rules for that pass light up
and serialize into the plan. By the time the playhead reaches the
right edge, you have a full plan written out, pass-by-pass.

The animation is **literal serialization, made visible.** It is also
a moment of **inspection** — a beat between *"I think this is the
plan"* and *"the agent has the plan."* If pass 3 lights up with the
wrong modifiers, you pause. You don't get that beat with form-fill
plans.

### Determinism rule for the sweep

The structural plan emitted by the sweep is **fully deterministic**
from the grid state — same grid + same modifiers → same plan,
byte-for-byte.

The prose narration is a render pass over that structure:
- Deterministic per-cell template by default.
- Optionally LLM-augmented for readability.
- **Always re-derivable from the same structural input.**

If LLM-narrated, the structured form remains canonical and the
narration is regenerated, never edited into a state the structure
can't reproduce. Otherwise re-sweeping the same grid yields a
different plan, and the user is debugging which version of the
contract a given run actually ran under.

## The plan — two readers, one source

The structured form is canonical; the prose is rendered from it. A
human-authored commentary band may annotate a pass; it cannot change
semantics.

- **The agent reads the prose.** Markdown narrative, pass-by-pass,
  in natural language.
- **The hook layer reads the structured form.** JSON the existing
  hook stack already honors. Precedent in production today:
  `guard-build.sh` returns `{"decision":"block","reason":"…"}`;
  `check-file-length.sh` returns
  `{"hookSpecificOutput":{"additionalContext":"…"}}`. The plan-file
  is just those decisions enumerated up front instead of per-event.
- **One source emits both.** Co-emission from the same structural
  representation. No drift.

See `07-supervision-vocabulary.md` for the hook layer that reads the
structured form.

## Why this factoring

- **Authoring separated from execution.** Author once, walk away.
  Live commits are scary; this gives a beat of inspection between
  *"I think this is the plan"* and *"the agent has the plan."*
- **The serialized output is portable.** Once it's prose, the plan
  travels — into the conversation, the PR, the Claude Code session,
  like any other plan. No sequencer-aware agent needed; any LLM can
  read it.
- **It produces a diff-able artifact.** *"Here is the sequence I ran
  for the last refactor; here is the sequence for this one; here is
  what changed."* Sequences become reusable templates. They version.
  They fork. *"Siah's standard ReactJIT feature-pass sequence v3."*

## The trace — score after the music

Run the plan, capture which cells fired, when, on what input, with
what cost, with what the agent considered and skipped. **That trace
written down IS the agent's true system prompt for the run,
computed.**

Same shape as the sequencer state at run-start, augmented with what
actually happened. Diffable, shareable, forkable. The L4 wounds and
L5 cooccurrence updates are part of the trace pipeline; see
`07-supervision-vocabulary.md`.

## Surface within the sweatshop cartridge

- **Inline panel during composition** — when the user is wiring on
  the canvas and wants to glance at arming, the sequencer shows up
  as a panel. Cheap toggling, no context switch.
- **Dedicated route for the play sweep** — the sweep needs the whole
  viewport (animation, prose render, pause-and-edit). Promotes from
  inline panel to full route when play is hit.
- **Not a modal.** Modals interrupt; this is something you live
  inside.

## Live trace over the grid

Off by default during live runs. The cockpit (`07-supervision-vocabulary.md`)
is the primary runtime UI per the RTS framing — peripheral
awareness, threat counter, worker tiles, queue triage. Grid-replay
over the sequencer is a **post-mortem and historical-stepping
surface** — useful for *"why did pass 3 fire that?"* after the fact.

## Cross-references

- Cells, tiers, modifiers: `04-cells-and-tiers.md`.
- Pathology catalog (what cells *catch*): `05-pathology-catalog.md`.
- Hook layer (what the structured plan compiles to):
  `07-supervision-vocabulary.md`.
- Recipes (pre-armed sequencer states): `08-recipes.md`.
