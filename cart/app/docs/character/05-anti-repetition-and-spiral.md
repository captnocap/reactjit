# 05 — Anti-repetition and spiral design

Two coupled mechanisms keep the quiz engine from feeling stale:

- **Anti-repetition** — never re-ask the same question with the
  same metaphor.
- **Spiral design** — each quiz builds on the answers from prior
  quizzes (PRD §3.3).

## Anti-repetition: cosine + arming

Every QuizSession carries a `repetitionEmbedding: number[]` — a
coarse hash/vector of the rendered question text. Stored on the
session row at create time. Before the author turn fires, the
engine cosine-checks the proposed targeting + scaffold against
recent sessions; matches above threshold force a reframe pass.

The cosine check is the *mechanical* guardrail. The
`metaphor-staleness` arming pattern (T1, declared by the
`personality-quiz-engine` recipe) is the *behavioral* guardrail —
even when the embedding check passes, the model is told that
re-using a metaphor family for the same dimension within the last 5
sessions is forbidden. Two checks, redundant on purpose: cheap to
run, expensive to fail.

## The reframer

When repetition is flagged, the cart fires the
`frag_quiz_reframe_enhancer` upstream of the author turn. The
reframer's only job is to pick a fresh metaphor family from a
fixed pool, EXCLUDING the prior one. Its output is a single
lowercase word (gas-station-snack / desert-island-item /
obsolete-file-format / weather / vehicle / kitchen-tool / season /
soundtrack / room / pet / instrument / weapon / color / plant /
beverage / wallpaper).

The author turn reads the chosen family and uses it as the
metaphor scaffold for the new quiz. Same dimension, different
metaphor — the user reads it as a fresh question.

## Spiral design: prior context

The `src_quiz-prior-context` source kind resolves to the last K
QuizSessions for the active manifest, formatted as Q/A pairs (no
inferences — just the rendered question and the literal answer).
K defaults to 5; computable per request.

The author turn ingests this as part of its system prompt and is
instructed to **build on** prior answers, not repeat them. So a
quiz aimed at `dim_value_hierarchy` after the user has answered
"plain peanuts" to a snack quiz might come back with "Last time
you reached for peanuts. Pick a desert-island item that explains
*why*." The dimension is the same; the framing is layered.

The prior-context source is intentionally answer-only (not
inference-only). Inferences would let the model rationalize its
own prior reading; raw answers force it to look at what the user
actually said.

## Coverage map

The quiz engine's sampling priority is driven by per-dimension
`coverageWeight: 0..1` on
`cart/component-gallery/data/manifest-dimension.ts`. Combined with
each manifest entry's `confidence: 0..1`:

```
sampling_priority(dim) = coverageWeight(dim) * (1 - confidence(dim))
```

The engine sorts dimensions by sampling priority, picks the top 1
or 2, and feeds them to the author turn as `dimensionsTargeted`.
Dimensions with high coverage weight (e.g.
`dim_communication_style` at 0.9) are over-sampled while their
confidence is low; once confidence stabilizes the priority drops
naturally and the engine moves to adjacent dimensions.

This is the "evolution trigger" from PRD §3.3 ("As confidence
rises in one area, the engine shifts to adjacent, under-explored
dimensions"). It falls out of the math; no separate trigger is
needed.

## Why three guards and not one

The cosine check is mechanical (cheap, deterministic). The arming
pattern is behavioral (the model knows the rule). The reframer is
a hard reset (it changes the metaphor family before the author
turn even sees the dimension).

A single guard fails: cosine alone misses semantic repetition
that's lexically different ("pick a gas station snack" → "pick a
roadside attraction"). Arming alone is fragile to model drift.
The reframer alone has no signal for when to fire. Three together
trap the failure modes individually.

## What's NOT in scope

- **Cross-user dedup.** We don't share repetition embeddings
  across users. Each manifest is independent.
- **Embedding model drift.** The repetitionEmbedding is opaque to
  the rest of the system; if the embedding model changes, old
  embeddings still cosine-check against new ones (signal degrades
  but doesn't break).
- **Manual override of metaphor scaffold.** The user cannot pin a
  metaphor family. If they hate cooking metaphors, the manifest's
  `dim_metaphor_affinity` will surface that and the engine will
  stop reaching for them.

## See also

- [04-quiz-as-gift.md](04-quiz-as-gift.md) for the author/infer
  loop these guards plug into.
- `cart/app/recipes/personality-quiz-engine.tsx` for the
  `metaphor-staleness` arming declaration and the reframer
  fragment.
