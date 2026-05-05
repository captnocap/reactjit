# Personality quiz engine — gift-shaped discovery

A two-turn loop that lets the assistant author a quiz aimed at a
specific manifest gap, render it through the chat-loom intent
surface, and infer manifest deltas from the answer. Drop
`<PersonalityQuizEngine />` on the canvas and you get the prompt
fragments, source kinds, compositions, and event hooks that drive
the loop.

## Frame

This is the *user-facing surface* of the
`cart/component-gallery/data/user-manifest.ts` data shape. The
manifest is the assistant's evolving read of the user; the quiz is
how the read updates. Every quiz the assistant authors must read as
**a gift** (PRD §5: "The survey should feel like the assistant is
giving the user something — insight, entertainment, a mirror — not
taking data."). Quizzes that read as data collection fail the
recipe, regardless of accuracy.

Render layer is `cart/testing_carts/chat-loom.tsx` — the intent
parser + renderer accept a constrained tagset (`<Title>`, `<Text>`,
`<Card>`, `<Form>`/`<Field>`/`<Submit>`, `<Btn>`, `<Badge>`,
`<Divider>`, `<Spacer>`, `<Code>`, `<Kbd>`, etc.). The author turn's
output IS the quiz UI. No custom renderer.

## The two turns

### Turn 1 — author

Inputs (resolved at composition time):

- **Active character voice** — `src_character-snapshot` (so the
  quiz lands in the character's voice, not a generic LLM voice).
- **Current manifest snapshot** — `src_user-manifest-snapshot`
  (top-N highest-confidence dimensions, formatted as "things I have
  inferred about you so far").
- **Under-sampled dimensions** — computed: dimensions where
  `confidence < 0.5` AND `coverageWeight > 0.5`. The author should
  pick 1-2 from this list.
- **Last K Q/A pairs** — `src_quiz-prior-context` (no inferences,
  just question + answer) so the author can build on prior answers
  per the spiral-design pattern in PRD §3.3.
- **Reframe scaffold** — if the targeted dimension was quizzed in
  any of the prior K sessions, the engine flags the prior
  `metaphorScaffold` and the author MUST pick a different metaphor
  family.

System prompt for turn 1 — the `frag_quiz_author` fragment — pins
the author to the chat-loom DSL and instructs:

- Wrap the entire response in `[ ... ]`.
- One quiz per turn. Title + optional one-line kicker, then either
  a `<Form>` (multi-question) or a row of `<Btn>`s (one-pick branch).
- The quiz must read as a gift the assistant is offering, not data
  the assistant is collecting. If it reads as a survey, redo.
- Every `<Btn reply="…">` and every `<Submit reply="…">` must use
  templates that reproduce the user's choice in normalized form for
  the infer turn (`reply="I picked: {q1}"` or
  `reply="A1: {q1}\nA2: {q2}"`).
- Pick exactly one metaphor family per quiz (gas-station snack,
  desert island item, obsolete file format, weather, vehicle, …)
  and stick to it. The metaphor family lands in
  `quiz-session.metaphorScaffold`.

### Turn 2 — infer

After the chat-loom round-trip fires `system:quiz:answered` on the
IFTTT bus, the cart runs the infer turn. Inputs:

- **Question text** — from the QuizSession.questions[].
- **User's literal answer** — the interpolated reply string.
- **Targeted dimensions** — `quizSession.dimensionsTargeted[]`.
- **Current manifest values + confidence** for those dimensions.

System prompt for turn 2 — the `frag_quiz_infer` fragment — emits
a JSON `ManifestDelta[]` with strict shape (one delta per affected
dimension; `confidenceDelta` capped at +/-0.25 per quiz; reasons
short and specific). The delta lands on the user manifest:

- Same `currentValue` as before → reinforce: append to
  `sourceQuizIds`, increment confidence by `+confidenceDelta`.
- Different value → contradiction lane: append to
  `contradictoryQuizIds`, leave `currentValue` unchanged for now,
  emit a `manifest:anomaly-detected` event so the recheck loop
  can queue a re-check quiz on the next idle window.

## Anti-repetition guardrail

Every QuizSession carries a `repetitionEmbedding` — a coarse
hash/vector of the rendered quiz text. Before the author turn fires,
the engine cosine-checks the proposed targeting + metaphor against
recent sessions; if any prior session matches above threshold the
author is forced to redo with a different metaphor. The
`metaphor-staleness` arming pattern (T1) restates the same rule for
the model itself — even when the embedding check passes, the model
should pick a fresh family if the same dimension has been quizzed
recently.

## Confidence calibration

Per-quiz confidence deltas are small. A reinforcement is +0.10 to
+0.20; a fresh first-time inference is +0.15 to +0.25; a
contradiction is 0 (we never *deduct* confidence on a contradiction;
we route it to the recheck lane). The manifest stabilizes through
repetition, not through any single answer.

## Anomaly detection

When `inferences[].nextValue !== currentValue` for a dimension whose
confidence is already > 0.6, the cart emits
`manifest:anomaly-detected` on the IFTTT bus. The home page (or any
listener) can show a one-line "let me ask one more thing" surface;
on accept, the cart fires the author turn with that single
dimension forced into `dimensionsTargeted` and a new
`metaphorScaffold` selected.

## What the .tsx stamp deposits

- Three `PromptFragment` rows: `frag_quiz_author` (turn 1 system),
  `frag_quiz_infer` (turn 2 system), `frag_quiz_reframe_enhancer`
  (the reframer pass that picks a fresh metaphor when the same
  dimension is being re-quizzed).
- Two `CompositionSourceKind` registrations:
  `src_user-manifest-snapshot`, `src_quiz-prior-context`.
- Two `Composition` rows: `comp_quiz_author` (turn 1 assembly),
  `comp_quiz_infer` (turn 2 assembly).
- Three `EventHook` rows: `system:quiz:rendered`,
  `system:quiz:answered`, `system:quiz:inferred`.
- Three arming recommendations: `scope-collapse` at T1 (don't
  generalize from a single answer), `premature-commitment` at T2
  (don't lock a dimension on first reinforcement),
  `metaphor-staleness` at T1 (don't reuse a recent metaphor for the
  same dimension).
