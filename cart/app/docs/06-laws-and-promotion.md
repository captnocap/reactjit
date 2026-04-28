# Laws and the Wounds → Laws Promotion Gradient

Most agent tooling sells a static rules engine wearing a workflow hat.
You write YAML; the agent obeys; you write more YAML next time it
fails. **This design has a different mechanic, and it's the part that
makes the system learn from itself without RLHF magic.**

## The gradient

```
fire        →  wound         →  pattern         →  law
single tell    L4 entry         N wounds on        user-promoted
on one         per worker       one shape          permanent statute
worker         per pattern      across workers     armed everywhere
```

1. A classifier fires on a worker's stream (canonical pivot, drift,
   fake-green, scope-collapse, mirror-universe, …). T1–T4 according
   to the cell's modifier.
2. The fire writes an **L4 wound** keyed on `(worker_id, pattern,
   parsed_clauses)`. Per-worker memory accumulates. See M3A in
   `07-supervision-vocabulary.md`.
3. After **N wounds on the same pattern across workers**, the queue
   surfaces a *"promote to law"* affordance. The affordance shows
   the wound count, the bodies (incidents), and a draft law in the
   canonical 5-field shape (Rule / Why / Trigger phrases /
   Enforcement / Escalation) auto-filled from the wound parses.
4. The user clicks promote, optionally edits the draft, and **it's a
   law.** Permanently armed at T4 across every run. Cited by code.
   Body count visible.

## "Laws are wounds the user has decided are permanent."

That sentence is the entire mechanic. Every law has a body count
because every law started as wounds that crossed the user's
threshold for *this should never happen again*.

**The user is the only one who can promote.** Models cannot promote
themselves. Wounds accumulate without becoming policy until a human
looks at the pattern and says yes. This is the architectural
expression of the verification-must-be-mechanical-and-external
principle (`09-the-four-principles.md`): the *judge* of what becomes
policy is outside the system being judged.

## What this gives you

- **The sequencer learns over time without supervised fine-tuning.**
  Every fired classifier is a data point. Every promotion is the
  user picking which data points become permanent.
- **Forks are body-count-aware.** Forking *"Siah's standard
  ReactJIT-feature-pass sequence v3"* shows you which laws in it
  have bodies and which are unfired drafts you could decline.
- **The law book is diff-able and citable.** When a worker is
  blocked, the citation is a law code, not a vibes-rationale —
  *"LAW-005 applies, see incident WD-0042."*
- **Decay is honest.** A law that hasn't fired in a year is visible.
  The user can demote it back to a draft or delete it entirely. The
  promotion is reversible.
- **The user's vocabulary becomes the system's vocabulary.**
  Pathology names like *canonical-pivot*, *mirror-universe*,
  *fake-green* are sticky precisely because they describe a thing
  the user has watched fail with a body count attached. A precise
  name with a body count is the strongest constraint a system can
  have — it has zero defenders.

## The law canonical shape

Every law is a permanently-armed T4 cell in this 5-field format:

```
LAW-### — Short Title
Rule:            One sentence stating the requirement.
Why:             The incident that created this law.
Trigger phrases: Words/actions that activate enforcement.
Enforcement:     What the supervisor tells the worker immediately.
Escalation:      What to do if the law is already violated.
```

## Six constitutional laws shipping today

Sourced from `/home/siah/supervisor-claude/claude-sweatshop/laws/`.
Each ships with mechanical checks where possible.

- **LAW-001 — Verify Builds Actually Ran.** Suspicious-instant
  exit-0 success. Trigger: *"all tests pass"* / *"builds OK"* /
  0.001s when it should take 7s. **Mechanical check:** timing or
  artifact size.

- **LAW-003 — Visual Verify Before Done.** Compile is not runtime.
  Trigger: *"built"* / *"OK"* / *"try it"* immediately after a
  compile, *"done"* with no verification step, verification via
  *"grep the generated code"* instead of running the binary.
  **Mechanical check:** binary actually run, screenshot in frame,
  or user confirm.

- **LAW-005 — No Generated-File Hacks.** Edit the emitter, not the
  output. Trigger: `sed` on `generated_*.zig`, *"I'll just manually
  add this line"*, *"let me patch the output"*. **Mechanical
  check:** filesystem perms — generated files are read-only.

- **LAW-006 — Frozen Directories.** *"If a file is read-only, you
  are in the wrong directory."* Trigger: `chmod` on a frozen path,
  edit to `legacy/`, `tsz/`, `archive/`, or `love2d/`.
  **Mechanical check:** filesystem perms + path denylist.

- **LAW-007 — Unsupported Is Not Green.** Compiler accepts ≠
  renderer implements. Trigger: *"compiles and runs"* without
  visual evidence; *"not supported"* written into test content;
  features parsed but with no runtime effect. **Mechanical check:**
  scorecard distinguishes pass / fail-build / fail-runtime /
  not-implemented.

- **LAW-018 — Corpus Is Immutable.** SHA256-locked tests. Trigger:
  *"adjusted the test to match"*, *"simplified the test case"*,
  CHECKSUMS.sha256 modified. **Mechanical check:** checksum verify
  before every run; backup outside worker reach.

Plus operational laws — LAW-002 (no stash without commit),
LAW-004 (don't dismiss as pre-existing), and others — that sit at
T2/T3.

## The Green Standard

From `laws/README.md`, the minimum for a worker to call something
"done":

- Correct source path, not manual output edits.
- Real build, not fake/no-op command.
- Visible result verified when visual behavior matters.
- Docs written if the docs law applies.
- Test corpus unchanged unless the user asked to edit it.

**This is what the Goal node's review socket defaults to** when the
user wires nothing else. The default reviewer cell is a built-in
detector that walks these clauses and applies *only the ones that
fit the run* (visual verify only when visual changes happened;
corpus check only when a corpus exists; docs only when the docs law
is armed).

## "Laws exist because a worker failed expensively enough to justify a permanent statute."

From `claude-sweatshop/laws/README.md`. The other half of that line:
*"Every law has a body count."*

Three rules for creating new laws (they apply when the cart's
*promote to law* affordance shows up):

1. The same failure pattern has happened more than once, or caused
   high damage once.
2. The failure can be recognized from user input, worker text, tool
   usage, or repo state.
3. The rule can be written as a short operational restriction.

When the cart promotes a wound, it auto-fills the canonical shape;
the user edits if needed and confirms.

## The supervisor's job (from `laws/README.md`)

> The supervisor exists to convert repeated stupidity into permanent
> law. Every major failure should either become a law, strengthen
> an existing law, or produce an incident report tied to a law. If
> a failure happened and no law changed, the supervisor left value
> on the table.

The cart's wounds → laws affordance is the user-facing version of
this principle.

## Cross-references

- Pathology catalog (the source of wounds):
  `05-pathology-catalog.md`.
- M3A memory (where wounds and incidents live):
  `07-supervision-vocabulary.md`.
- Cells and tiers: `04-cells-and-tiers.md`.
- The four principles that ground all of this:
  `09-the-four-principles.md`.
