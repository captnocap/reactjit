# The Three Roles — Assistant, Supervisor, Worker

> **The assistant remembers the user. The supervisor remembers the
> room. The worker remembers nothing.**

The parallel character/ corpus elaborates the assistant slot with
its own spine:

> **The Character is the assistant's voice. The Manifest is the
> assistant's read of the user. The Quiz is how the read updates.**

Read the two together — this doc defines the three roles; the
character/ corpus defines what the assistant is *made of*.

The cart/app architecture has three kinds of agent. Three time
horizons, three relationships to memory, three relationships to the
user. Each does work the others cannot do. Each is forbidden from
doing the others' work.

**Conflating them — letting the supervisor accumulate user-history,
or letting the assistant retire workers, or letting workers carry
state across jobs — collapses the architecture.** The boundaries are
what make the roles legible.

## At a glance

| Role | Lives in | Time horizon | Memory | Knows user? | Customizable | Disposable |
|---|---|---|---|---|---|---|
| **Assistant** | App shell (`cart/app/`) | Persistent — sessions, weeks, months | Full M3A + Manifest across user lifetime | Yes — long-term goals, voice, history, intentions | Yes — as a Character | No |
| **Supervisor** | Sweatshop cartridge (or any cartridge with workers) | ~15–30 minutes (project session) | Project-scoped M3A: hot L1–L3, persistent L4 wounds + L5 cooccurrence within the session | No — only "the person who started this run" | No — same shape every run | No within session |
| **Worker** | Spawned by supervisor | One job, one task | None beyond the briefing template | No | No | Yes — by design |

## The Assistant

- **Lives in the app shell.** Persistent across cartridge switches.
  When the user moves from sweatshop to composer to chatbot, the
  assistant comes with them.
- **Fully customizable as a Character.** The user shapes its voice
  via the Character Creator: dial values, archetype, quirk list,
  stance / initiative / correction enums, boundary rules, knowledge
  sources. The user can keep many Characters and switch the active
  one at settings grain; voice doesn't switch when Role does. See
  the parallel character/ corpus —
  `character/01-character-as-voice.md` for the Character shape,
  `character/02-dials-archetypes-quirks.md` for the three parametric
  layers.
- **Holds the user's ongoing memory** (M3A) **and the assistant's
  evolving read of the user** (Manifest). The full M3A from
  `07-supervision-vocabulary.md` is the substrate — decay-weighted,
  L4 wounds and L5 cooccurrences accumulating over the user's
  lifetime. The **Manifest**
  (`character/03-manifest-as-evolving-read.md`) is the structured
  inferred-read on top: nine curated dimensions with confidence
  scores, accumulated through Quizzes. **Distinct from
  `User.preferences.accommodations[]`** — the *declared* trait list
  from onboarding. **M3A is what the assistant has *seen*; Manifest
  is what the assistant *thinks it knows*; accommodations are what
  the user *told it directly*.** Three orthogonal substrates; none
  overwrites another.
- **Holds the user's long-term goals.** The vision, the product, the
  careful intentions, the things that matter beyond *"this PR."* The
  assistant knows that the user is two months into a refactor, that
  the refactor has a stated aesthetic, that last week the user said
  *"I never want this layer to know about that."* Long-running
  pattern observations live in the Manifest's `recurringThemes` —
  short, write-only-by-the-assistant, included in the
  request-resolve preamble at low weight.
- **Updates its read via Quizzes.** When the Manifest needs more
  signal on a dimension, the assistant authors a quiz using the
  chat-loom intent surface; the user taps a card on the home page;
  the Manifest updates. **Quizzes must read as gifts, not surveys**
  — UX rule, not a soft preference. The recipe rejects survey-shaped
  output. See `character/04-quiz-as-gift.md`.
- **Computes friction with the active Character.** When the
  Character's voice mismatches the Manifest's read, the
  **CharacterCompatibility** row surfaces friction alerts (hard /
  soft) with recommended adjustments. Adjustments are advisory —
  never auto-applied. *Voice never changes silently underneath the
  user.* See `character/06-compatibility-and-friction.md`.
- **CAN steer the supervisor — but only when applicable.** When the
  assistant notices the supervisor's tactical execution is drifting
  from a long-term goal the user holds, it signals. Mechanism in
  `## Inter-role coordination` below.
- **Survives everything.** Cartridge crashes, hot reloads, supervisor
  turnover, worker pool churn. The assistant is the longest-lived
  agent in the system.

The assistant's analogue is a chief of staff — knows the principal,
knows the long arc, doesn't run individual meetings.

## The Supervisor

- **Lives inside the sweatshop cartridge** (or any cartridge that
  hires workers — chatbot probably doesn't, composer might for AI
  tool calls; see `## Open` below).
- **Not customized.** Same shape every run, same job, same
  vocabulary. The supervisor IS the pathology catalog
  (`05-pathology-catalog.md`) + the law book
  (`06-laws-and-promotion.md`) + the verification + the cockpit + the
  trace.
- **Knows the last ~15–30 minutes of the project better than anyone
  else.** Hot L1 (recent events stream), fast-decay L2 (current
  affective state of workers + room), live L3 (what's been touched,
  what builds, what tests pass), per-worker L4 (wound history within
  the project — survives worker retirement, does not survive session
  end), L5 cooccurrence (file collision graph for *"these files tend
  to break together this run"*).
- **Does not know who the user is** beyond *"the person who started
  this session."* Does not know their long-term goals, their broader
  project arc, their personality. Cares about: what the user
  *requested for this run*, and whether the workers are executing
  it.
- **Workers are at large under the supervisor at all times.** Every
  tool call passes through hooks the supervisor controls. Every L2
  detector fire is the supervisor's decision to escalate or not.
  Worker retirement is the supervisor's call.
- **Receives steering signals from the assistant**, but is not
  subordinate. The supervisor decides what to do with an
  assistant-advisory note — ack and act, ack and defer, note that the
  user explicitly overrode this in-session, or escalate back to the
  user.
- **Forgets when the session ends.** The trace + the
  wounds-promoted-to-laws + the `edit-trail` git branch are what
  survive. The supervisor itself doesn't carry forward.

The supervisor's analogue is a shift lead — knows the room, knows the
team on shift, knows the work in flight, doesn't know what the
company's doing next quarter.

## The Worker

Worker mechanics are documented in detail at
`07-supervision-vocabulary.md` (retirement policy, replacement
briefing template). Brief recap for completeness:

- **Hired per job, retired per soft-fire / hard-fire conditions.** No
  persistent identity across jobs.
- **Carries no memory beyond the briefing template.** Assignment,
  active laws, current state, why previous worker was retired, files
  to read first, what NOT to do. Five sections, no sludge from prior
  sessions.
- **Operates under the supervisor's enforcement.** Every tool call
  passes through the hook layer the supervisor controls.
- **Cannot promote wounds to laws.** Cannot read the supervisor's
  pathology catalog directly — only its outputs as in-stream
  enforcement.
- **Disposable by design.** Replacement is the architecture, not
  failure recovery. *"Workers are disposable; supervisor memory is
  not."*

The worker's analogue is a contractor on a single ticket. Does the
work, leaves.

## Inter-role coordination

The three roles have asymmetric relationships. Each can signal one
direction without overriding.

```
                  ┌──────────────┐
                  │  Assistant   │  long-term, knows user
                  └──────┬───────┘
           advisory only │ ← cannot command
                         ▼
                  ┌──────────────┐
                  │  Supervisor  │  short-term, knows room
                  └──────┬───────┘
        full authority   │ ← can command, retire, brief
                         ▼
                  ┌──────────────┐
                  │   Worker     │  no memory, knows brief
                  └──────────────┘
```

### Assistant → Supervisor (advisory only)

The assistant emits **advisory notes** when it notices long-term-goal
divergence. The supervisor sees these in their queue, marked as
long-term-aligned input. The supervisor decides what to do with them.

What the assistant **does not** get:

- Direct hook-layer access (cannot block tool calls).
- Worker management (cannot retire or brief).
- Cell arming (cannot toggle the sequencer).
- Law promotion (only the user can — see
  `06-laws-and-promotion.md`).

Likely shapes for the advisory mechanism (open, see `## Open`):

- A new cell-kind, *assistant-advisory*, that fires at T2
  (queue-flag, non-interruptive) when divergence is detected.
- A peripheral cockpit tile dedicated to assistant signals — visible
  but not interrupting the supervisor's primary attention.
- An advisory log captured in the trace, citable in the post-mortem
  (*"the assistant flagged this drift at minute 7; supervisor noted
  but proceeded under user's session-level override"*).

### Supervisor → Worker (full authority)

Standard. Hook-layer enforcement, briefing template on hire,
retirement on conditions. Documented at
`07-supervision-vocabulary.md`.

### User → all three

The user sits above all three.

- **Promotes wounds to laws.** Only the user can
  (`06-laws-and-promotion.md`).
- **Approves milestones.** `who_approves: user` is the only
  hard-binding milestone gate
  (`07-supervision-vocabulary.md`).
- **Customizes the assistant.** Voice, model, allowed tools,
  persona, what it remembers.
- **Stamps recipes that arm the supervisor.** Strict Supervisor
  recipe and others (`08-recipes.md`).
- **Hires/retires the supervisor's session** by starting/ending the
  run.

Models cannot self-promote into a higher role. The architecture is
**strictly hierarchical with respect to authority over persistent
state.**

## What each role cannot do

The negative space matters as much as the positive.

| Role | Cannot |
|---|---|
| **Assistant** | Edit code. Retire workers. Block tool calls. Arm cells. Override the supervisor in tactical calls. Promote wounds to laws. |
| **Supervisor** | Read the assistant's user-history, Character, Manifest, or CharacterCompatibility. Customize itself. Survive past session end (only its trace + wounds + laws survive). Speak to the user about anything beyond the current run. |
| **Worker** | Accumulate state across jobs. Promote wounds. Read the pathology catalog or any of the assistant's substrates (Character / Manifest / Compatibility). Hire other workers (the no-subagents Constraint, see `07-supervision-vocabulary.md`). Survive a hard-fire. |

These are not *"shouldn't"* — they are architectural restrictions.
**A supervisor that has access to the assistant's user-history has
stopped being a supervisor and has become a second assistant.** A
worker that survives across jobs has stopped being a worker and has
become a junior supervisor. **The boundaries are what make the roles
legible.**

## Memory partitioning

Maps onto M3A layers from `07-supervision-vocabulary.md`. Same
engine, different scopes.

| Layer | Assistant | Supervisor | Worker |
|---|---|---|---|
| **L1 River** | Long-window across sessions, decay-weighted | ~15–30 min sliding within session | Conversation context inside the worker process; dies on retirement |
| **L2 Feeling** | User's affect over time (their patterns, their off days) | Per-worker affect right now (which workers are stuck, drifting, performing) | None |
| **L3 Echo** | User's full vector + lexical + entity graph; lifelong | Project-scoped vector + lexical + entity graph; resets per session, hot during | None |
| **L4 Wound** | User-level wounds (incidents the user wants remembered across the arc of their work) | Per-worker wound history within the project; survives worker retirement, does not survive session end | None |
| **L5 Cooccurrence** | User-level: which projects, which concepts, which collaborators co-occur over months | Project-scoped collision graph: which files break together this run | None |

The assistant's M3A grows over the user's lifetime. The supervisor's
M3A is born and dies with each project session. The worker has
neither.

**Beyond M3A, the assistant has substrates the supervisor and worker
do not have:**

- **Character** — the user-shaped voice. Configuration, not memory.
  See `character/01-character-as-voice.md`.
- **Manifest** — the assistant's structured inferred read of the
  user. Confidence-scored dimensions accumulated through Quizzes.
  See `character/03-manifest-as-evolving-read.md`. Distinct from
  `User.preferences.accommodations[]` (declared traits from
  onboarding) and from M3A (what the assistant has seen).
- **CharacterCompatibility** — the friction analysis between
  Character and Manifest. Recomputed on save / on inference / on
  user-initiated check. See `character/06-compatibility-and-friction.md`.

All three are per-user-lifetime and **never visible to supervisors
or workers**. They follow the assistant across cartridge switches
via the shell-level state path described in `## Cross-cartridge
state access` below.

## Where each role lives in the cartridge architecture

```
cart/app/                   ← console shell
├── (chrome)
├── (assistant)             ← persistent, survives cartridge switches
├── onboarding/
└── cartridges/
    ├── sweatshop.so        ← hires the supervisor + workers
    │   ├── (supervisor)    ← ~15–30 min memory, project-scoped
    │   └── (worker pool)   ← spawned/retired per job
    ├── composer.so         ← may hire workers for AI tool calls
    │                         (own supervisor or none? see Open)
    ├── chatbot.so          ← probably no supervisor, no workers;
    │                         assistant talks directly to a model
    └── gallery.so          ← no supervisor, no workers
```

The assistant lives at the shell level because **it's the one agent
the user has a relationship with**, and that relationship needs to
outlive any single cartridge.

The supervisor lives inside whichever cartridge has workers to
manage.

## Cross-cartridge state access

`framework/cartridge.zig:387` exposes cross-cartridge state access.
The assistant uses this to follow the user as they switch cartridges:

- The assistant reads the sweatshop's trace + memories so it can
  speak to the user about *"the refactor you ran yesterday, that
  fired LAW-005 three times."*
- The assistant reads the composer's recent SNode tree edits so it
  can suggest *"the layout you've been gravitating toward this
  week."*
- The assistant reads the chatbot's transcript and folds it into its
  own L1 River.

The assistant **does not** read worker pool internals or hook-layer
state — those belong to the supervisor.

The supervisor and workers cannot read up into the shell-level
assistant memory. **Cross-cartridge state access is
downward-permissive (assistant reads into cartridges) and
upward-restricted (supervisors and workers cannot read up into
shell-level user memory).**

## Cross-references

The parallel **character/** corpus — the assistant's substrates in
detail. This doc establishes the trinity; that corpus elaborates
the assistant slot.

- Index: `character/README.md`.
- Character (voice the user shapes):
  `character/01-character-as-voice.md`.
- Dials, archetypes, quirks (the three parametric layers):
  `character/02-dials-archetypes-quirks.md`.
- Manifest (the assistant's inferred read of the user):
  `character/03-manifest-as-evolving-read.md`.
- Quizzes (the update mechanism — gifts, not surveys):
  `character/04-quiz-as-gift.md`.
- Anti-repetition + spiral design (how quizzes don't repeat):
  `character/05-anti-repetition-and-spiral.md`.
- CharacterCompatibility (friction between voice and read):
  `character/06-compatibility-and-friction.md`.
- Quirk unlock loop (manifest discoveries unlock content):
  `character/07-quirk-unlock-loop.md`.

This corpus:

- Console + cartridge architecture: `01-console-cartridges.md`.
- Supervisor + worker mechanics in detail:
  `07-supervision-vocabulary.md`.
- Wounds → laws (user-only promotion path):
  `06-laws-and-promotion.md`.
- Pathology catalog (the supervisor's vocabulary):
  `05-pathology-catalog.md`.
- Cells and tiers (the supervisor's intervention surface):
  `04-cells-and-tiers.md`.
- Recipes (Strict Supervisor + others; arm the supervisor on
  stamp): `08-recipes.md`.
- The four principles (verification external; right-size executor;
  bandwidth interfaces): `09-the-four-principles.md`.

## Open

These are concrete decisions left for when the architecture is
built.

- **The advisory mechanism shape.** Cell-kind vs cockpit tile vs
  queue entry. Likely some combination. The display surface in the
  supervisor's cockpit needs a slot for assistant signals that's
  visible but not interrupting.
- **Composer supervisor.** Does the composer cartridge get its own
  (lightweight) supervisor, or does the AI tool API run unsupervised
  because the surface area is small (5 ops, all on one canonical
  tree)? Lean: lightweight supervisor that primarily watches for
  *mirror-universe* and *unsupported-laundering* on the SNode tree.
- **Chatbot cartridge.** Confirmed no supervisor, no workers. The
  assistant talks directly to a model. Open: does the chatbot's
  transcript flow back to the assistant's L1 River? Lean yes — the
  assistant should remember the conversation.
- **Multi-supervisor sessions.** A user runs sweatshop and composer
  simultaneously, both with supervisors. Do they coordinate? Lean:
  no, they operate independently; the assistant is the only
  cross-supervisor channel.
- **Assistant-advisory threshold tuning.** The assistant should not
  flag every minor drift. Some user-tunable sensitivity setting
  needed. Probably a per-goal setting: *"flag aggressively when this
  goal is at risk; flag conservatively for that one."*
- **Character portability.** Does the assistant's Character travel
  with the user (export/import)? Or is it tied to this install?
  Lean: exportable, like a recipe.
- **Manifest portability.** Same question for the Manifest. Lean:
  yes, but with privacy considerations — the Manifest reveals more
  about the user than the Character does. Probably exports as a
  separate optional artifact alongside the Character, with explicit
  user opt-in per-export.
