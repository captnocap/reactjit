# 04 — Quiz as gift

A quiz is the assistant authoring a short, playful surface aimed
at one or two manifest dimensions where its read is still thin.
It must read as a **gift** the assistant is offering — not a
survey the assistant is collecting.

## Render layer is chat-loom

The quiz UI is the existing chat-loom intent surface
(`cart/testing_carts/chat-loom.tsx`). The author turn's output is
a chat-loom intent tree wrapped in `[ ... ]`; the cart parses it
via `runtime/intent/parser.parseIntent` and mounts it via
`runtime/intent/render.RenderIntent`. We do not build a custom
quiz widget — the assistant's output IS the quiz UI.

This matters: the assistant's voice (and the active character's
theme tokens) propagate through the intent surface natively. A
Sage-character quiz reads in Sage's voice; a Jester-character quiz
reads in Jester's voice. Same render path.

## The two turns

The loop is declared in
[`cart/app/recipes/personality-quiz-engine.tsx`](../../recipes/
personality-quiz-engine.tsx) and lives in two compositions
(`comp_quiz_author` + `comp_quiz_infer`).

### Turn 1 — author

Inputs (resolved at composition time):

1. **Active character snapshot** — `src_character-snapshot`. The
   quiz lands in the character's voice.
2. **Current manifest snapshot** — `src_user-manifest-snapshot`.
   So the assistant knows what it already thinks.
3. **Under-sampled dimensions** — computed: dimensions where
   `confidence < 0.5` AND `coverageWeight > 0.5`. The author
   picks 1-2.
4. **Last K Q/A pairs** — `src_quiz-prior-context`. So the next
   quiz can build on prior answers (spiral design, PRD §3.3).
5. **Reframe scaffold** — when the targeted dimension was quizzed
   recently with metaphor family `M`, the engine instructs the
   author to pick a different family.

Output: a chat-loom intent tree wrapped in `[ ... ]`. Either:

- A `<Form>` with up to 3 `<Field>`s and a `<Submit>` whose
  `reply` template interpolates each field, OR
- A row of 3-5 `<Btn>`s with `reply` templates that reproduce
  the user's choice in normalized form.

NEVER both. NEVER more than one quiz per turn. NEVER label it
"survey" or "quiz of data."

### Turn 2 — infer

After the chat-loom round-trip emits `system:quiz:answered`, the
cart fires the infer composition. Inputs: question text + answer
string + targeted dimension list with current values + confidence.

Output: a JSON `ManifestDelta[]` (no prose, no code fences). Each
delta carries `dimensionId`, `previousValue`, `nextValue`,
`confidenceDelta` (capped `±0.25`), and a one-sentence reason
specific to the answer.

The cart applies the deltas to the manifest (per
[03-manifest-as-evolving-read.md](03-manifest-as-evolving-read.md))
and emits `system:quiz:inferred` so compatibility recomputes.

## Why "gift" is load-bearing

The PRD's UX rule (PRD §5: "The quiz should feel like the
assistant is *giving* the user something — insight, entertainment,
a mirror — not taking data") translates directly into the
recipe's system prompt. Survey-shaped output is rejected at the
author turn.

Empirically — pulling forward the lesson from
`cart/app/recipes/onboarding-first-impression.md` — survey-
shaped data collection produces clinical, voiceless outputs. Gift-
shaped framing produces outputs the user shares unprompted (a
qualitative win the PRD calls "Users return to adjust the assistant
profile unprompted"). The frame matters more than the questions.

The assistant is not allowed to output a quiz like "Tell me about
your stress response." It must output something like "Pick a gas
station snack to reveal your conflict style." The metaphor IS the
gift.

## Gating

The cart fires the author turn ONLY when:

- The user is on the home page or the manifest page (not mid-
  task in another flow).
- At least one dimension has `confidence < 0.5` AND
  `coverageWeight > 0.5`.
- No quiz with status `pending` or `rendered` already exists.
- The last `system:quiz:rendered` event was more than N minutes
  ago (debounce).

The user can also explicitly request a quiz from the Character
Creator's "let me get to know you better" affordance — that path
bypasses the debounce.

## Failure modes the recipe traps

- **Survey-shaped output.** Author asks "What is your stress
  response?" → cart rejects, queues a re-author with the gift-
  shaping fragment escalated.
- **Multiple quizzes in one tree.** Author emits two `<Form>`s
  → cart slices to the first.
- **Reply template missing.** Author emits `<Btn>label</Btn>`
  with no `reply` → cart fabricates `reply="I picked: <label>"`.
- **Off-axis answer at infer time.** Infer emits a
  `nextValue` not in the dimension's `options[]` → cart drops
  the delta, marks the dimension as inconclusive, queues a
  reframe quiz.

## See also

- [05-anti-repetition-and-spiral.md](05-anti-repetition-and-spiral.md)
  for how the engine avoids déjà vu.
- `cart/app/recipes/personality-quiz-engine.md` for the full
  recipe narrative including confidence-calibration table.
- `cart/testing_carts/chat-loom.tsx` for the canonical tagset
  reference.
