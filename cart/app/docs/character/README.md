# Character & Personality — Design Corpus

Design corpus for the Character Creator + Personality Survey
system — the shell-level surfaces that let the user *sculpt* the
assistant's voice and let the assistant *evolve a read* of the user.

This is a parallel sub-corpus to `cart/app/docs/` (the sweatshop
cartridge corpus). Same retrieval-friendly conventions: numbered
chunks, exact-filename cross-references, one self-contained chunk
per file. The split is by topic, not narrative.

## The spine

> The Character is the assistant's voice. The Manifest is the
> assistant's read of the user. The Quiz is how the read updates.

That sentence is the architecture. Three atoms, one substrate
(Composition / PromptFragment / Constraint). Everything below is
the consequence.

This corpus elaborates the **assistant** slot of the cart/app
trinity established at [`../12-the-three-roles.md`](../12-the-three-roles.md).
That doc defines the three roles (assistant / supervisor / worker);
this one defines what the assistant is *made of*. Read the two
together — that doc tells you where the assistant sits relative to
supervisor and worker; this corpus tells you what the assistant
*is* underneath.

## Where this lives in the app

`cart/app/character/` (planned) hosts the Character Creator page at
`/character`. `cart/app/manifest/` (planned) hosts the Personality
Survey + manifest viewer at `/manifest`. Both are shell-level
routes, alongside `/`, `/settings`, `/about` — see
[`cart/app/app.md`](../../app.md). The data shapes ship today;
the page implementations land in a follow-up.

The render layer for quizzes is the existing chat-loom intent
surface: `cart/testing_carts/chat-loom.tsx` defines the canonical
tagset, `runtime/intent/parser.parseIntent` parses the LLM's
output, `runtime/intent/render.RenderIntent` mounts it. We do not
build a separate quiz UI — the assistant authors the quiz, the
runtime renders it.

## User flow

1. **First boot.** User runs onboarding (`cart/app/onboarding/`)
   and lands at the home page. A `char_default` Character row
   exists from seed; the user can sculpt or replace it via
   `/character` whenever.
2. **Manifest accumulates.** As the user converses, the assistant
   notices recurring patterns and queues quizzes — a card on the
   home page surfaces a fresh quiz whenever the engine has one
   ready. Users can decline or postpone; nothing is forced.
3. **Quiz round-trip.** User taps a quiz card → the chat-loom intent
   tree mounts inline → user submits → the cart fires the infer
   turn → the manifest updates → compatibility recomputes → if a
   friction alert fires, a one-line nudge appears in the home
   page's status row.
4. **Character switch.** From `/character`, the user picks (or
   creates, or sculpts) a character. On save, the active settings
   profile points at the new character; the next request resolves
   through `comp_character_who` and the voice changes.

## Index

- [01-character-as-voice.md](01-character-as-voice.md) — what a
  Character is, what it composes into, why it's a richer Role and
  not a parallel type.
- [02-dials-archetypes-quirks.md](02-dials-archetypes-quirks.md) —
  the three parametric layers. Why dials interpolate (not pick),
  why archetypes are templates (not gates), why quirks are atomic
  fragments.
- [03-manifest-as-evolving-read.md](03-manifest-as-evolving-read.md)
  — what the UserManifest is, how it differs from
  `User.preferences.accommodations[]`, how confidence works,
  anomaly-detection lane.
- [04-quiz-as-gift.md](04-quiz-as-gift.md) — the chat-loom intent
  surface as the rendering layer, the two-turn author/infer loop,
  why quizzes must read as gifts.
- [05-anti-repetition-and-spiral.md](05-anti-repetition-and-spiral.md)
  — repetition embedding cosine guardrail, coverage map, spiral
  design via prior-context source, metaphor-staleness arming.
- [06-compatibility-and-friction.md](06-compatibility-and-friction.md)
  — what Compatibility computes, when friction alerts surface, the
  reciprocity-balance principle.
- [07-quirk-unlock-loop.md](07-quirk-unlock-loop.md) — the
  quiz-to-quirk feedback loop. Manifest discoveries unlock
  archetypes / quirks in the Character Creator.
- [99-open-questions.md](99-open-questions.md) — committed
  positions + genuine opens.

## Frozen positions

- The Character is **voice-shaped**, the Role is **profession-shaped**.
  A character can play many roles; a role can be played by many
  characters. They never merge.
- The Manifest is the *inferred* model. `User.preferences.
  accommodations[]` is the *declared* trait list from onboarding.
  The two coexist; the manifest never overwrites accommodations.
- Quiz UI is rendered by **chat-loom**, never by a custom widget.
  The author turn's chat-loom intent tree IS the UI.
- Quizzes must read as **gifts**, not surveys. PRD §5 is the
  load-bearing UX rule. Recipe rejects survey-shaped output.
- Boundary rules use the existing **Constraint** shape. We do not
  invent a parallel "boundary rule" type.
- Dial interpolation is **nearest-pole-only** in v1. Mid-range
  values fire nothing. Future revision can blend continuously
  but only when there's evidence the budget model holds.
