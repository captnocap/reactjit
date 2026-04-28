# Cells and the Tier System

A **cell** is the unit a user toggles in the sequencer
(`03-sequencer-plan-trace.md`). Cells are heterogeneous: a cell can
be a Composition, a rule, a loop, an agent-orchestration pattern, a
mechanical check, a role definition, a constraint. The sequencer is
agnostic about cell content — it exposes the act of arming and
ordering them.

## Cell families

- **L1 per-CLI row classifiers.** Turn raw worker stream rows into
  semantic tokens (Claude Code vocabulary, Codex vocabulary, Kimi
  vocabulary). Family: *interpretation* — what does the worker's
  output *mean*?
- **L2 semantic detectors** consuming L1. Rationalization detector,
  drift detector, tool-risk gate, stuck-vs-thinking, claim verifier,
  fake-greens, duplicate-work, mirror-universe. Family: *judgment* —
  should something fire?
- **Mechanical-check cells.** A grep, a `git diff`, a checksum, a
  screenshot-window-bounds check. Cheap, deterministic, no LLM
  judgment. See the 12 trust-nothing cells in
  `05-pathology-catalog.md`.
- **Role cells.** A persona with default model, sampling preset,
  base system message, skills, capabilities, Privacy modifier. From
  the gallery's `Role` shape.
- **Constraint cells.** Open `Constraint[]` rows that attach
  arbitrary rules to other cells.
- **Memory cells.** L1–L5 of the M3A architecture, individually
  armable. See `07-supervision-vocabulary.md`.
- **Loop cells.** Read-N-write-rinse, plan-then-execute, two-model
  handoff, swarm-N-on-N-steps, Ralph-style interception.

## What a cell carries

Every cell carries:

1. **A tier** — universal modifier, T0–T4. See below.
2. **Declared modifier slots** — typed per the gallery shape (model,
   sampling, allowed_tools, privacy, budget, retrieval).
3. **An open `Constraint[]` tail** — arbitrary additional rules.

Three layers, not one. Fixed core + open tail + uniform tier.

## The T0–T4 tier system

Universal across all cells. Same cell, different tier = same *what*
with *different teeth*.

| Tier | Approx. % | Action |
|---|---|---|
| **T0 silent** | ~92% | No output. On-spec, no tells, safe. |
| **T1 auto-handle** | ~5% | Local classifier injects a canned nudge into the worker's stream. Logged, not escalated. |
| **T2 flag to user** | ~2% | Added to the next-action queue. Triage when ready. Non-interruptive. |
| **T3 escalate** | ~0.9% | Supervisor (you, Opus, whoever's at the helm) gets full context + auto-attached bundles. Judgment required. |
| **T4 emergency pause** | ~0.1% | Tool call blocked at the hook layer. Both user and supervisor alerted. |

Examples of the same cell at different tiers:
- *"watch for rationalization at T2"* — flags it for the queue.
- *"block rationalization at T4"* — hard-stops the next tool call.
- *"observe drift at T1"* — auto-injects a nudge but lets work
  continue.

## Per-cell modifier surface — three layers

### 1. Universal: tier (T0–T4)

Always present on every cell. Determines what fires when the cell
condition is met.

### 2. Declared slots — typed per shape

These come from the gallery shape the cell wraps:

- **Model** — `Model` row (claude-opus-4-7, claude-sonnet-4-6,
  claude-haiku-4-5, etc.). Per-cell override. *"Smart on plan, fast
  on execute"* lives here.
- **Sampling preset** — `InferencePreset` row (precise, thinking,
  exploratory).
- **`allowed_tools`** — explicit list (e.g.
  `&.{ "Bash", "Read", "Edit", "Grep" }`).
- **`disallowed_tools`** — inverse (e.g. `&.{ "Write", "WebFetch" }`).
- **Privacy** — `Privacy` row. Tightens / loosens what tools, paths,
  networks the cell may touch.
- **Budget** — `Budget` cap (token / dollar / wall-clock).
- **Retrieval strategy** — `RetrievalStrategy` row.
- **Connection** — `Connection` row (model + transport + identity).

These are typed; the editor knows what they accept.

### 3. Open `Constraint[]` tail

Arbitrary additional rules that don't fit a typed slot. Each is a
`Constraint` row with `kind` + `spec`. Open extensibility — new
constraint kinds register and become attachable.

## Where cells map to runtime

- **Declarative cells** lower to Composition rows
  (`02-canvas-and-substrates.md`). Slots resolve, scripts run, the
  output is a text/structured artifact the agent consumes.
- **Reactive cells** lower to `useIFTTT` registrations
  (`02-canvas-and-substrates.md`). Triggers + actions over the bus.
- **Mechanical-check cells** lower to PostToolUse / PreToolUse hook
  contributions. The hook stack already running in production
  honors the JSON contracts (`07-supervision-vocabulary.md`).
- **Role cells** resolve at worker-spawn time into the worker's
  initial config.

## Cell composition with the gallery

The gallery's existing shapes line up under this lens:

| Shape | Role under the cell lens |
|---|---|
| `Composition` | A cell's content — what fires when armed. |
| `Constraint` | A rule modifier on a cell (must / must-not). |
| `Privacy` | Per-cell or run-wide tool/network allowlist. |
| `Connection` | The rail a cell runs over. |
| `Model` | Per-cell override. |
| `Budget` | Always-armed governor cell; caps the run. |
| `EventHook` + `Job` | Cells that wake the sequencer up. |
| `Plan` / `Phase` | The serialized 1D output; the plan IS the committed contract. |
| `Task` | The agent's playhead leaf. |
| `OutcomeRubric` | The cell that emits `achieved` into the Goal review socket. |
| `AgentMemory*` | Stateful cells; arming = "this run may read/write memory." |
| `Worker` / `Session` | Concretizations during the run. |
| `Skill` / `Capability` | Composes into Role. |
| `Role` | A pose the worker takes for the duration of a run/cell. |

## Cross-references

- The sequencer surface itself: `03-sequencer-plan-trace.md`.
- Pathology cells (named, T-tagged catalog):
  `05-pathology-catalog.md`.
- Constitutional law cells (always T4): `06-laws-and-promotion.md`.
- M3A memory layers as memory cells: `07-supervision-vocabulary.md`.
