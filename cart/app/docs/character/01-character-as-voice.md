# 01 — Character as voice

A **Character** is the assistant's voice. It is not a Role and it
is not a Persona-in-the-abstract. It is the configurable surface
the user shapes when they ask "what should this sound like."

## What a Character carries

The shape lives at
`cart/component-gallery/data/character.ts`. A row carries:

- **Visual identity** — `name`, `displayName`, `bio`, `avatarRef`,
  `voiceThumbnailRef`, `themeId`. UI affordance only; the inference
  layer does not read these (the active theme propagates via the
  classifier system, not via prompt).
- **Archetype seed** — `archetypeId` (FK →
  `cart/component-gallery/data/character-archetype.ts`). Pre-fills
  the dial values + quirk list when the user picks an archetype on
  the Character Creator page. Cosmetic the moment a dial is touched.
- **Dial map** — `dialValues: Record<dialId, number>` against
  `cart/component-gallery/data/personality-dial.ts`. Twelve bipolar
  0..1 axes (Formal↔Casual, Direct↔Diplomatic, …). Near-pole values
  fire fragments; mid-range values stay quiet.
- **Quirk list** — `quirkIds[]` (FK →
  `cart/component-gallery/data/character-quirk.ts`). Each quirk
  maps 1:1 to a `PromptFragment`. Categorical opt-in / opt-out
  rules that don't fit on a dial axis.
- **Three small enums** — `relationshipStance` (stranger /
  colleague / friend / confidant / mentor / chaotic-sibling),
  `initiativeProfile` (silent / contextual / proactive /
  anticipatory), `correctionStyle` (gentle-nudge / socratic /
  direct / silent). Each fires a single fragment.
- **Boundary rules** — `boundaryRuleIds[]` (FK →
  `cart/component-gallery/data/constraint.ts`). Existing Constraint
  shape; nothing new invented for boundaries.
- **Knowledge sources** — list of file / url / inline locators
  the assistant should treat as canon.
- **Composition override** — `compositionId?` opt-in. When unset,
  the default `comp_character_who` shipped by the character-creator
  recipe is used.

## Why a richer Role and not a parallel type

Role (`cart/component-gallery/data/role.ts`) is profession-shaped:
it bundles `defaultModelId`, `defaultPresetId`,
`baseSystemMessageId`, and a `skills[]` list. A Role is "Planner"
or "Reviewer." A Character is "calm-mentor-Sage" or
"chaotic-sibling-Aug."

The two compose orthogonally. A Planner Role played by the
chaotic-sibling Character produces a planner that opens with
"alright sibling, here's the lay of the land —". A Reviewer Role
played by the Sage Character produces a reviewer that signs off
with a single closing thought. Same Role, different voice; same
Character, different responsibilities.

Keeping them separate also keeps the data model honest. Role
constraints are about *what the worker is allowed to do*; Character
constraints are about *what the voice sounds like and what
behaviors it refuses*. Settings.activeCharacterId (planned) +
RoleAssignment cover the two axes independently.

## How a Character composes into runtime

At request-resolve time the active Character feeds the master
composition's `who` slot via the `src_character-snapshot` source
kind:

1. Archetype voice fragment (if `archetypeId` set).
2. Dial-derived fragments — for each dial whose value is < 0.15 or
   > 0.85, fire the matching `fragmentMappings[].fragmentId`.
3. Quirk fragments — one per `quirkIds[]`.
4. Stance / initiative / correction fragments.

Boundary-rule Constraints are NOT in the snapshot; they flow
through the existing `src_active-constraints` source kind. That
keeps the runtime's constraint-handling path single-source.

The default composition is `comp_character_who`, declared by
[`cart/app/recipes/character-creator.tsx`](../../recipes/
character-creator.tsx). It extends `comp_who_default` and
overrides the `identity` slot, slotting the character snapshot
ahead of the existing `src_user-bio` source. A character with
empty values composes to nothing — the slot falls back to the
default identity preamble.

## Identity grain vs settings grain

Character lives at **settings grain**: switching the active
Settings profile can swap the active character. A user can keep
many characters; the active one is selected by
`Settings.activeCharacterId` (planned field).

The active character does NOT switch when the active Role does.
A user playing Planner→Reviewer→Implementer in one session
keeps the same voice throughout. Voice is calmer to switch than
profession.

## See also

- [02-dials-archetypes-quirks.md](02-dials-archetypes-quirks.md)
  for the three parametric layers in detail.
- [06-compatibility-and-friction.md](06-compatibility-and-friction.md)
  for how Character + Manifest produce friction alerts.
- `cart/app/recipes/character-creator.md` for the recipe that
  declares all the fragments + the composition.
