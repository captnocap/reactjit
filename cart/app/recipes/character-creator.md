# Character creator — voice as data

A single recipe that defines what a Character is and how it
composes into runtime. Drop `<CharacterCreator />` on the canvas and
you get the prompt fragments, source kinds, compositions, and event
hooks the Character Creator page reads and writes against.

## Scope

The character is the *assistant's voice*. It is **not** the role
the assistant plays (Planner / Reviewer / Implementer — those live
on `cart/component-gallery/data/role.ts`). It is **not** the user
manifest (the assistant's read of the user — that's
`cart/app/recipes/personality-quiz-engine.md`). It is the
configurable surface the user shapes when they ask "what should this
sound like."

A character carries:

- A **visual identity** — name, displayName, avatarRef,
  voiceThumbnailRef, themeId. UI affordance only.
- An **archetype seed** — pointer to a row in
  `cart/component-gallery/data/character-archetype.ts`. Templates,
  not gates; every dial is overridable.
- A **dial map** — `dialValues: Record<dialId, number>` against the
  `cart/component-gallery/data/personality-dial.ts` registry. Twelve
  bipolar 0..1 axes. Near-pole values fire fragments; mid-range
  values stay quiet.
- A **quirk list** — `quirkIds[]` against
  `cart/component-gallery/data/character-quirk.ts`. Each quirk maps
  1:1 to a `PromptFragment`. Categorical opt-in / opt-out rules
  that don't fit on an axis (em-dashes-only, never emoji, signs off
  with closing thought).
- A **relationship stance** + **initiative profile** + **correction
  style** — three small enums that each fire a single fragment.
- A **boundary rule list** — `boundaryRuleIds[]` against
  `cart/component-gallery/data/constraint.ts`. The "donts" of the
  character. Constraints already do the right thing — surface
  + scope + severity + violationResponse — so no new shape.

## How a character composes

At request-resolve time the active Character feeds the master
composition's `who` slot via the new `src_character-snapshot` source
kind (registered in
`cart/component-gallery/data/composition-source-kind.ts`):

1. Archetype voice fragment (if `archetypeId` set)
2. Dial-derived fragments — for each dial whose value is < 0.15 or
   > 0.85, fire the matching `fragmentMappings[].fragmentId`. Mid-
   range dials contribute nothing.
3. Quirk fragments — one per `quirkIds[]`.
4. Stance / initiative / correction fragments — small static set,
   one fragment per enum value.
5. Boundary-rule constraints — surfaced to the runtime as active
   `Constraint` rows, not fragments. The composer's
   `src_active-constraints` source kind already reads them.

The default character composition is `comp_character_who`, declared
by this recipe. It extends `comp_who_default` and overrides the
identity slot. Characters can opt out via their own
`compositionId`; net-additive — null falls back to the default.

## Why dials interpolate, not pick

Twelve sliders at 0.5 produce no contribution. That's the point. A
character with a sharp signature has 3-5 dials pushed to a pole and
the rest neutral; a character that's "just a little snappy" sits at
0.35 / 0.65 and produces almost nothing on the wire. The composer
budget stays predictable.

The interpolation rule is `nearest-pole-only`: at a value of 0.05,
the leftLabel fragment fires at full weight; at 0.95, the rightLabel
fragment fires at full weight; between 0.15 and 0.85, neither fires.
A future revision could blend continuously, but v1 keeps the
selection categorical to keep the prompt-budget model boring.

## Why archetypes are templates, not gates

Archetypes seed the dials so the user sees a coherent voice on the
first screen rather than 12 sliders sitting at 0.5. The moment a dial
is touched, the archetype link is cosmetic. The character carries the
authoritative dial values; the archetype pointer survives only for UI
grouping ("characters descended from Sage").

## What the .tsx stamp deposits

- Three families of `PromptFragment` rows: archetype voices (one per
  archetype id), dial poles (`frag_dial_<id>_low` / `_high` pairs),
  and quirks (`frag_quirk_<id>`). Plus stance / initiative /
  correction fragments.
- One `CompositionSourceKind` row: `src_character-snapshot`.
- One `Composition` row: `comp_character_who`. Extends
  `comp_who_default`, overrides the `identity` slot with the
  character snapshot ahead of `src_user-bio`, ahead of role base.
- One `EventHook`: `system:character:saved` →
  emit-event(`character:applied`) +
  mark-status(`character:active`). The shell subscribes and swaps
  active theme + classifier set.
- Two arming recommendations: `scope-collapse` at T1 (don't lock
  onto the archetype template; let dials override) and
  `premature-commitment` at T2 (don't apply mid-turn — wait for the
  next boundary).

## Reciprocity

PRD §4.5 calls for the assistant to reciprocate when the user
reveals via quizzes — "the more the user reveals via surveys, the
more the assistant should reciprocate with transparency about its
own logic, limits, or internal state." That's a future fragment
that conditionally injects "and here's what I'm currently calibrating
on" — gated on `manifest.dimensions[].confidence > 0.5` for a
bounded set of dimensions. Plumbed in
`cart/app/recipes/personality-quiz-engine.md`, not here.
