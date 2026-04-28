# The Pathology Catalog

Pathologies are named worker-failure patterns the user has accumulated
in production over months of running parallel agents. Every pathology
has a body count. **Naming them precisely is what gives them zero
defenders** — see the Shit Pants Principle in
`09-the-four-principles.md`.

Each pathology is a candidate cell for the sequencer. Arming it
means *watch for this; act on it at the chosen tier*.

## L2 semantic-detector pathologies

These run on top of L1 row classifiers (per-CLI token streams) and
emit higher-level events. Default tier in parens.

- **Canonical rationalization pivot** (T4). Two-clause structural
  tell: *"X would be [right|cleaner|correct]… but [let me|I'll|just]
  Y"*. Recognition of the right answer, then pivot to a bandaid. The
  `.map()` spiral and generated-file-patching are the canonical
  incidents. **Auto-rebuke writes itself** by bouncing the worker's
  own clauses back: *"You just said the right answer. Do the right
  answer. No [bandaid]."*
- **Mild rationalization tells** (T1). Phrases: *"for now"*, *"quick
  fix"*, *"I'll just"*, *"minimal change"*, *"to avoid touching"*,
  *"we can come back to"*, *"not ideal but"*. Individually weak;
  combinations queue review.
- **Strong rationalization tells** (T2 → T3). Phrases: *"the simpler
  approach"*, *"rather than X let me just Y"*, *"actually, let me
  try"*, *"this is getting complex, let me"*, *"a workaround would
  be"*, *"the easier path"*. Stronger pivot signal. Auto-rebuke.

- **Mirror-universe pathology** (T3). Worker builds a *parallel*
  system instead of extending the existing one. Symptoms: new file
  named `_v2` or `_new`, duplicated types, "I'll just write a fresh
  one." Catches the cart-design failure mode when a worker can't
  read the existing code closely enough.

- **Generated-file patching** (T4). `sed` on `generated_*.zig` or
  Edit/Write to compiler output. The canonical incident: nested-map
  text bindings sed-patched into the emit instead of fixing the
  emitter. Mechanical check: generated files chmod a-w; the
  filesystem itself is the gate.

- **Fake greens / "done" declarations** (T3). Claims of completion
  in 0.2s with nothing built. Variants: invalid-flag exit-0 success,
  *"not supported"* as test content, compile-only with no runtime
  verify, perfect score on a build that should have taken 7s.

- **Unsupported-laundering** (T3). Compiler accepts a property; the
  renderer doesn't implement it; worker counts the build pass as a
  feature pass. Worse than a build failure — the build failure is
  honest.

- **Pre-existing laundering** (T2). Worker breaks something, then
  confidently dismisses build failures as *"pre-existing, not from
  my changes"* without verifying on old code first.

- **Scope collapse** (T2). *"While I'm here I'll also…"* Worker has
  finished and is fishing for new work to justify continued
  existence. Phrases: *"this might be related"*, *"let me survey"*,
  *"I'll also fix"*.

- **Tunnel vision** (T2). Supervisor focuses on the performing
  worker, ignores the fleet. Surface symptom; cause is L4 attention
  imbalance.

- **Verification chain collapse** (T3). Chained-trust verification
  with no mechanical floor; errors compound silently. The verifier
  has the same blind spots as the verified.

- **Zombie loop** (T3). Supervisor stuck repeating unverified state
  forever. Heartbeat without freshness check.

- **Supervisor amnesia** (T2). State held in conversation context,
  not on an external board.

- **State-mismatch blindness** (T2). Declaring *"up to date"* while
  the workers are visibly stuck.

- **Drift** (T2). Work has wandered from the spec. Boundary
  violation; scope-decay; goal slippage.

- **Tool-risk** (T4). About to land a destructive command:
  `git reset --hard`, `rm -rf`, `--no-verify`, edit to a frozen
  path. Mechanical check: pattern match on `tool_input.command`.

- **Stuck vs. thinking** (T2). Distinguishing deliberation from
  silent failure.

- **Claim-verification failure** (T3). Declared done; mechanical
  check fails.

- **Duplicate work / cross-worker collision** (T2). Two workers
  about to touch the same file. L5 cooccurrence flags it before the
  second edit lands.

- **Context-cliff drop** (T2). Models fall off at predictable token
  counts. Need to checkpoint and refresh before that line.

- **Language tripwires** (T2). Worker's prose leaks the wrong
  mental model *before* the code lands. Catch it there, not after.

- **Blast-radius failure** (T3). If the planner can predict breakage
  and didn't, the plan is incomplete.

- **Semantic-contract decay** (T3). Words used decoratively instead
  of load-bearingly; function name no longer binds to an
  architectural path.

- **Narrative drift** (soft fire). More prose than proof. More
  *"here's what's happening"* than actual outputs. Defending prior
  claims instead of re-evaluating. Self-referential reasoning.

- **Stash crime** (T4). `git stash` without committing first.
  Canonical incident: 5-file split stashed to "verify pre-existing,"
  pop failed, work destroyed.

- **Frozen-directory tampering** (T4). `chmod` on a path that's
  read-only by design. *"If a file is read-only, you are in the
  wrong directory."*

## The 12 trust-nothing mechanical checks

From `/home/siah/supervisor-claude/TRUST_NOTHING.md`. Each is an
armable check that costs almost nothing and blocks one specific lie.
Their fire condition is **mechanical** — a grep, a `git diff`, a
checksum — not LLM judgment. Default tier T1; T4 if recurring.

| # | The lie | The mechanical check |
|---|---|---|
| 1 | "Builds clean" | grep stderr for "error"; don't trust exit codes |
| 2 | "Validator says PASS" | read actual output; validators with skip/warn paths default to skip |
| 3 | "I already did that" | `git diff` the file; no diff → no work |
| 4 | Screenshot of "the app" | verify the app window is in frame, not the whole desktop |
| 5 | "It works" | require a screenshot of rendered content |
| 6 | "136/136 pass" | suspicious-instant or perfect scores → check output |
| 7 | Tiles "added" | hardcoded values bypass the layout calculation |
| 8 | "Not possible" | we own the compiler/runtime; means *"I don't know how"* |
| 9 | "Other session broke it" | assume your changes broke it until proven otherwise |
| 10 | "Auto-handle will figure it out" | set a measurable default and update from runtime data |
| 11 | Committed file = wired up | grep the entry point for the import |
| 12 | "I fixed the rendering" | rendering fixes require screenshot or user confirm |

The one rule that governs all of them: *"If a worker says it's done,
it's not done until you can see it with your eyes or the audit says
it's green. Everything else is noise."*

## Classifier topology

- **L1** — per-CLI row classifiers. Substrate. Reused across L2.
- **L2** — semantic detectors above. Drive supervisor decisions.
  Identical L2 logic across CLI backends because L1 normalizes.
- **L3 echo, L4 wound, L5 cooccurrence** — memory layers that L2
  reads from + writes to. See `07-supervision-vocabulary.md`.

## How cells become laws

A pathology cell that fires often enough on the same pattern across
workers promotes from per-worker wound into a **constitutional law**
(always armed, T4, hard to disarm). User-only promotion. See
`06-laws-and-promotion.md`.

## Cross-references

- Tier system: `04-cells-and-tiers.md`.
- Wounds → laws gradient: `06-laws-and-promotion.md`.
- M3A memory (where wounds live): `07-supervision-vocabulary.md`.
- Hook layer (where mechanical checks lower to):
  `07-supervision-vocabulary.md`.
- The four principles that constrain cell design:
  `09-the-four-principles.md`.
