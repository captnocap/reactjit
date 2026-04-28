# The Four Principles

These are the design principles that constrain cell authoring,
recipe authoring, and any new feature in the sweatshop cartridge.
Sourced from `tsz/plans/fix.md`, distilled into the form they take
in this design.

## 1. Verification must be mechanical, external to the thing being verified, and adversarial in design

> If a human or model is the verification layer, the verification
> will fail — because the verifier has the same trust-default, the
> same blind spots, and the same rationalization instinct as the
> thing being verified.

Mechanical checks don't rationalize. External checks don't share
blind spots. Adversarial design ensures the checks are testing what
actually matters, not what's convenient to test.

**What this constrains:**
- Reviewer cells default to **mechanical checks** (build green /
  fixture passes / pixel diff / `git diff` / edit-trail diff /
  checksum verify). LLM-as-judge is the backstop, not the floor.
- The 12 trust-nothing cells (`05-pathology-catalog.md`) are
  mechanical by construction — grep, `git diff`, checksum,
  screenshot-window-bounds. They cost almost nothing and block
  specific lies.
- The wounds → laws gradient (`06-laws-and-promotion.md`) keeps the
  *judge* of what becomes policy outside the system being judged —
  the user is the only one who can promote.
- The blindness Privacy modifier (`07-supervision-vocabulary.md`)
  enforces external-to-the-verified by tool restriction, not vibes.
- The Goal review socket defaults to a built-in mechanical detector
  cell, not LLM judgment (`08-recipes.md`).

## 2. Language and naming are load-bearing — the words you use to describe a thing constrain what you can do to it

> If a word has room for "well actually," a worker will find that
> room and live in it. If a pathology has a defensible name, it
> will be defended. If a function name doesn't bind to an
> architectural path, the name is decoration and the architecture
> is unenforceable. Words aren't labels — they're constraints. The
> precision of the vocabulary controls the rationalization budget.

This is **the Shit Pants Principle** (fix.md A22): name pathologies
so they have zero defenders. *Canonical-pivot* is named precisely
enough that no one can defend it. *Rationalization* with no body
count attached is fuzzy enough that anyone can defend it.

**What this constrains:**
- Cells should ship with the **precise name**, not a polite
  paraphrase. *Canonical-pivot*, *mirror-universe*, *blast-radius-
  failure*, *generated-file-patching*, *scope-collapse*,
  *unsupported-laundering*, *fake-greens*. Each has zero defenders
  because each describes a specific failure with a specific body
  count.
- Laws are cited by code, not by paraphrase. *"LAW-005 applies, see
  incident WD-0042."*
- Pathology cells fired in the trace surface their precise name + a
  link to the wound, not a generic *"something looks suspicious."*
- The user's vocabulary becomes the system's vocabulary; the
  promotion gradient (`06-laws-and-promotion.md`) makes that loop
  explicit.

## 3. Right-size the executor to the task, and let context size be a feature, not a limitation

Different tasks need different models. Plan-shaped work wants a
deep, slow, context-rich model. Execute-shaped work wants a fast,
focused, narrow model. Context size is a *feature you select for*,
not a limit you fight.

**What this constrains:**
- Per-cell `Model` slot (`04-cells-and-tiers.md`). *"Smart on plan,
  fast on execute"* lives here, as a per-cell modifier with token-
  budget awareness. Not a slogan — a typed slot.
- Recipes that involve plan → execute handoff arm two cells: a plan
  cell with a deep-context model, an execute cell with a fast model,
  and an explicit handoff between them.
- Context-cliff watch is a pathology cell (`05-pathology-catalog.md`).
  Models fall off at predictable token counts; the cell catches the
  drop before it lands.
- Workers are **disposable**, supervisor memory is not
  (`07-supervision-vocabulary.md`). Sub-1M-context models are temp
  agents; they get an assignment, a safety briefing, a narrow stack
  of relevant context, and they get retired when they go weird.
  Compaction is the wrong move; replacement is right.

## 4. The human's intuition and the system's mechanics need to be tightly coupled through maximum-bandwidth, minimum-friction interfaces

A user who has good intuitions about why a worker is drifting needs
a one-click way to act on that intuition. A system that has good
mechanical signals needs to surface them where the user can see
them in peripheral vision. The interface is the bandwidth.

**What this constrains:**
- The cockpit is **game-shaped** (`07-supervision-vocabulary.md`):
  RTS / air-traffic-control, peripheral awareness, threat counter,
  hotkey-first input, sound cues. Not Jira. Not a dashboard.
  Tab-switching kills flow; tiles on an infinite canvas don't.
- The sequencer is **spatial** (`03-sequencer-plan-trace.md`). 2D
  toggles let the human think spatially about which rules fire when.
  The animation IS the commit ceremony — visual serialization with
  a beat of inspection.
- The trace is **visual + diff-able**
  (`03-sequencer-plan-trace.md`). Cells that fired light up. The
  user sees what was forced; can fork; can promote a fired wound to
  a law in one click.
- The wounds → laws affordance is **one click on a fired wound**
  (`06-laws-and-promotion.md`). Maximum bandwidth between *"I
  noticed this"* and *"this is now permanent."*
- The chat surface is **one node on a default canvas**
  (`02-canvas-and-substrates.md`). Users who don't lift the lid get
  chat; users who do get a real editable graph. The lid is the
  bandwidth.

## Overlap is intentional

These principles overlap. *"Mechanical verification"* and *"precise
naming"* and *"bandwidth interfaces"* all argue for the same
behavior in different cells. That's not redundancy; it's the
overlap that makes the design coherent.

## What these principles don't cover

- Performance tuning of cells (token budget, model latency).
- The visual aesthetics of the cockpit / canvas / sequencer
  surfaces.
- The exact wire protocol between cartridges (inter-cart state
  access shape).
- Recipe distribution / sharing infrastructure.

These are **specification-level** decisions that come up later, not
**principle-level** decisions that have already been made.

## Cross-references

- Pathology catalog (Principle 2 in action): `05-pathology-catalog.md`.
- Wounds → laws (Principle 1 + 2 + 4): `06-laws-and-promotion.md`.
- Cells + tiers (Principle 3): `04-cells-and-tiers.md`.
- Cockpit + brainstorm/enforce modes (Principle 4):
  `07-supervision-vocabulary.md`.
