# Supervision Vocabulary (Transport-Independent)

This file collects the vocabulary, schemas, policies, and runtime
substrate that the sweatshop cartridge inherits from the
supervisor-claude lineage.

**Transport is normalized.** The supervisor-claude documents describe
a kitty-pane implementation: `kitten @ send-text`,
`/run/user/$UID/claude-sessions/`, scrollback scraping, hook scripts
on disk. **None of that is the architecture.** The sweatshop cartridge
abstracts worker observation + intervention through `runtime/hooks/`
(`useHost`, `useTerminalRecorder`, `useConnection`, `useTelemetry`,
`process`, `useFileWatch`) and `framework/claude_sdk/` (stream-json
subprocess). A worker is a worker; the surface that delivers its
events does not matter at the cell level.

What carries forward is the **vocabulary, the schemas, the laws, the
retirement policy, and the supervisor's stance.**

## Plan / Phase / Task — canonical column set

The gallery already has `Plan`, `Phase`, `Task`. The schemas at
`/home/siah/supervisor-claude/plan-schema.md` and `task-schema.md`
are the column set those gallery shapes should support.

### Plan

`goal` / `motivation` / `constraints` / `non_goals` /
`starting_point` / `known_problems` / `dependencies` / `risks` /
`approach` / `key_decisions` / `file_map` / `boundaries` /
`phases[]` (each with a `gate`) / `parallel_tracks` /
`critical_path` / `max_concurrent_workers` / `worker_assignments` /
`shared_files` / `handoff_points` / `milestones[]` (each with
`who_approves: user | supervisor | automated`) / `done_criteria` /
`rollback_plan` / `commit_trail` / `notes` / `changelog_entry`.

### Task

`objective` / `context` / `acceptance_criteria` / `known_exists` /
`known_gaps` / `steps[]` (each with `files_touched`, `depends_on`) /
`tests[]` (with `test_type: build | conformance | visual | runtime |
manual`) / `visual_verification` / `docs_required` /
`file_boundaries` / `conflict_zones` / `commit_trail` / `priority` /
`blocked_by` / `last_edit` / `notes[]`.

### Five plan-schema rules → cell-design rules

- No plan without `non_goals` — if you can't say what it ISN'T,
  scope creeps.
- Every phase has a **gate**. *"Tasks done"* is not a gate; a gate
  is a verifiable condition.
- Parallel tracks must be explicit; default is sequential.
- `shared_files` must be called out — it's where parallel workers
  collide.
- At least one milestone per plan requires user approval, not just
  an automated check.

These are direct ports of `plan-schema.md` rules.

## M3A memory layers — five cells, not one

The sweatshop's memory is the **M3A (Multi-Modal Memory
Architecture)** ported from `~/creative/ai/bun/lib/memory/`. Five
layers, each independently armable as a cell.

- **L1 RIVER — sliding-window short-term buffer.** Recent events
  flow through. Each entry: `content`, `tokenCount`, `timestamp`,
  `evictedAt`. Evicts oldest under budget pressure. Eviction leaves
  a breadcrumb L3 can recover via resonance query.

- **L2 FEELING — affective state index.** Every significant event
  gets `affectCategory` + `intensity` (0–1) + `reasoning` +
  `decayFactor` + `isMuted` + `lastAccessedAt`. Categories:
  *confident*, *uncertain*, *frustrated*, *stuck*, *rationalizing*,
  *performing*, *focused*, *drifting*. The cockpit's per-worker
  badge reads the dominant L2.

- **L3 ECHO — three encodings with resonance scoring.** Every
  memorable event encoded three ways:
  - L3.1 Vector embeddings (via `llama_exports.zig` or another
    embedding model).
  - L3.2 Lexical FTS5 index.
  - L3.3 Entity-relation graph with typed entities (file, function,
    worker, concept) and typed relations (`touches`, `contradicts`,
    `depends_on`, `blames`, `resembles`).
  - **Resonance score 0–3** = how many of the three encodings
    matched a query. 3-resonance auto-injects on T3 escalations;
    1-resonance lands in the kernel tile's *available* list.

- **L4 WOUND — salience marker store.** High-impact events that
  deserve to be remembered more loudly than their content alone
  warrants. **Per-worker pattern history is L4 wound instances.**
  Each canonical-pivot fire writes a wound keyed on `(worker_id,
  pattern, parsed_clauses)`. Per-worker learning falls out for free
  — after N wounds on a specific worker for a specific pattern, the
  next-action queue suggests *retire* over *rebuke*.

- **L5 COOCCURRENCE — typed graph of what appears with what.**
  Nodes: worker / file / concept / tool-call / rule / pathology.
  Edges track co-occurrence over time windows. Drives **cross-worker
  collision prediction** (W1 editing X + W3 strong cooccurrence with
  W1 on X → T2 collision warning). Catches *"these files tend to
  break together."*

The wounds → laws gradient (`06-laws-and-promotion.md`) operates on
L4. Memory cells are individually arm-able in the sequencer.

## The supervisor's blindness as a Privacy mode

From `/home/siah/supervisor-claude/CLAUDE.md`:

> You cannot see code. You do not read source files. You do not
> grep. You do not reason about implementation details. You only see
> the action stream.

This is a **role-with-Privacy-modifier cell**. The Reviewer role's
`Privacy` slot can be tightened to *"no source reads, no grep, no
implementation discussion"* — observation through action streams
only. Maps cleanly onto the gallery's `Privacy` shape and
`Role.requiredCapabilities`.

The benefit is named explicitly: *a verifier with the same trust-
default and blind spots as the verified will fail.* Mechanical
blindness is enforced by tool restriction, not vibes.

## "No subagents" as a Constraint cell

The strict supervisor recipe ships with one Constraint hardcoded:
*"workers MUST NOT spawn subagents — when they do, the supervisor
goes entirely blind."* The subagent's edits, tool calls, and
reasoning don't surface in the observation stream — only the final
summary, by which point it's done and unverifiable.

Cell-level Constraint, not a global rule of the cart, but the
default for the Strict Supervisor recipe (`08-recipes.md`).

## Retirement policy — worker lifecycle

From `/home/siah/supervisor-claude/claude-sweatshop/lifecycle/retirement-policy.md`.
**Workers are disposable; supervisor memory is not.**

### Soft fire — replace at next break

- 3 repeated law violations (same law, same worker —
  context-poisoned).
- 5 consecutive non-progress turns.
- Repo state changed materially under them (internal model is
  stale).
- Defending instead of testing.
- Narrative drift (more prose than proof).
- Scope collapse (*"while I'm here I'll also…"*).

### Hard fire — replace immediately

- Destructive git operation in a shared repo.
- Generated-file fraud.
- Frozen-directory tampering.
- False *"done"* after a direct supervisor warning.
- Unsupported counted as green after correction.

### Replacement briefing template

```
## Assignment
[Current task — one paragraph max]

## Active Laws
[Law codes that apply to this task]

## Current State
- Tests passing: [list]
- Tests failing: [list]
- Known blockers: [list]

## Why the Previous Worker Was Retired
[One sentence — e.g., "Repeated LAW-003 violations, declaring features done without visual verification."]

## Files to Read First
[3–5 specific file paths relevant to the task]

## What NOT to Do
[Specific restrictions from the laws and the previous worker's mistakes]
```

*Short, actionable, no sludge from the old session.*

This is a per-worker lifecycle cell family —
*fire-on-condition*, *brief-replacement-with-template*,
*carry-which-state-forward*. The L4-Wound → retirement gradient is
the soft-fire condition expressed in M3A terms. **Short-lived
workers, long-lived supervisor.** Retirement is not failure; it is
the architecture.

## The hook layer is the compile target

A committed plan is not just prose for the agent to read. The same
authoring crystallizes into JSON the existing hook stack already
honors. These hooks are **already running in production** and the
sweatshop cartridge reads from / extends them:

- **`supervisor-log.sh`** — PreToolUse / PostToolUse / SessionStart /
  Stop. Appends to `/run/user/$UID/claude-sessions/supervisor.db`.
  The same schema as v1 supervisor-dashboard's `db/schema.sql`. The
  cartridge reads this DB; it does not recreate it.
- **`auto-commit.sh`** — PostToolUse (Edit/Write). Every edit
  commits to a separate `edit-trail` git branch with an LLM-authored
  message. **Restore points already exist** as standard git history.
  Rewinding is `git checkout edit-trail <commit> -- <file>`. The
  cell *"commit checkpoint between passes"* lowers to this.
- **`guard-build.sh`** — PreToolUse with 5ms timeout. Pattern-
  matches `tool_input.command` against forbidden commands; returns
  `{"decision":"block","reason":"…"}`. **T4 enforcement, already
  working.** New rules add as additional PreToolUse hooks emitting
  the same JSON shape.
- **`check-file-length.sh`** — PostToolUse. Returns
  `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}}`.
  **T1 auto-injection, already working** — the mechanism that lets
  a classifier write a fresh user-message back into the worker's
  stream.
- **`session-ping.sh`**, **`edit-log.sh`**, **`preflight-hook.sh`** —
  cross-session awareness, edit feed, preflight validation.
- **`ralph.sh`** — supervisor → worker message relay. The send-
  correction / approve / reject / rebuke cockpit actions resolve to
  this primitive (or its equivalent in the normalized transport).

When the playhead sweeps, the prose form goes to the agent for
context; the **structured form goes to the hook layer as a JSON
contract**. Same authoring surface, two readers, both already in
production.

## The cockpit (running surface)

The cockpit is the runtime UI the user watches while the agent
runs. **Game-shaped**: RTS / air-traffic-control, not Jira. All
state visible at once on an infinite canvas of tiles. Peripheral
awareness, not tab-switching. Hotkey-first input. Sound cues for
things that need the user. A threat counter that tells you at a
glance whether you can look away.

**You do not look at code in this cockpit.** You watch:
- Worker buffers + tool-call snippets streaming.
- `.autotest` output — is the worker generating signal points so it
  stops asking to run broken files?
- `tests/screenshots/` — visual pass/fail.
- The git audit tile — is work safe and flowing?

Primary activity: steering the worker around like a bull ride with a
blindfold on.

### Cockpit tiles (sample)

- Worker tiles (N) — terminal buffer + tool-call stream + L2 affect
  badge per worker.
- Worker strip (chrome) — persistent bottom/side strip with all
  workers as name + status + heartbeat.
- Queue tile — prioritized next-action list.
- Spec anchor tile — the crystallized spec, pinned.
- Kernel tile — context budget as tetris-block visualization.
- Memory tile — five mini-panels, one per M3A layer.
- Git audit tile — `progress`-style commits/day, per-worker fresh
  files, restore-point timeline from the `edit-trail` branch.
- Autotest tile — latest `.autotest` per worker.
- Screenshot wall — thumbnails per worker's most recent build
  output.
- Brainstorm panel — conversation surface (active in brainstorm
  mode).
- Law ticker — live flag feed when a pathology fires + which law
  was cited.

**No editor. No source-file browser. No file tree. No inline diff
viewer.** The user does not write code in the cockpit; they steer
workers. Tabs at the cockpit-level are wrong; tabs *inside* a single
tile (terminal / tool calls / recent edits / autotest) are fine
because you're inspecting one worker.

## Brainstorm vs Enforce modes

- **Brainstorm** = canvas + sequencer authoring. Supervisor is
  collaborator, not enforcer. Worker tiles hidden or minimized.
  Conversation panel centered. Past bundles surface as chips in a
  sidebar as the conversation touches familiar topics. Everything
  recorded for crystallization.
- **Enforce** = the plan is committed and the agent is running.
  Classifiers watching. Rule engine active. Queue triage driving
  attention. The cockpit shape applies here, not in authoring.

The crystallize step *is* the playhead sweep
(`03-sequencer-plan-trace.md`).

## What this means for the cart/app design

- The gallery's `Plan` / `Phase` / `Task` should mirror
  plan-schema.md / task-schema.md so an existing supervisor-claude
  workflow ports directly. Most fields already exist; the columns
  worth adding are explicit (`gate` per phase, `who_approves` per
  milestone, `file_boundaries` + `conflict_zones` per task,
  `commit_trail` per task).
- A **Constitutional Cells** bank is one of the default sequencer
  banks — laws, always armed at T4, hard to disarm. Disarming
  requires explicit user override and is logged to the trace.
- **Transport stays normalized.** A worker is a worker, whether the
  framework drives it via `framework/claude_sdk/` stream-json,
  `useHost` (HTTP listener), `useTerminalRecorder` (PTY scrape), or
  a yet-unwritten transport. Cells reference the Worker shape; they
  never name kitty.

## Cross-references

- Pathology catalog (the L2 detector cells): `05-pathology-catalog.md`.
- Laws + wounds → laws gradient: `06-laws-and-promotion.md`.
- Recipes (Strict Supervisor recipe stamps the blindness +
  no-subagents + Green Standard): `08-recipes.md`.
- The four principles: `09-the-four-principles.md`.
