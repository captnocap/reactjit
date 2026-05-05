# 02 — Dials, archetypes, quirks

Three parametric layers shape a Character's voice. They are
deliberately separate; each carries a different cost, a different
edit affordance, and a different runtime contract.

## Dials

Dials are bipolar 0..1 axes. Catalog:
`cart/component-gallery/data/personality-dial.ts`. Twelve in v1:

| dial | left ↔ right |
| --- | --- |
| `dial_formal_casual` | Formal ↔ Casual |
| `dial_direct_diplomatic` | Direct ↔ Diplomatic |
| `dial_pessimist_optimist` | Pessimistic ↔ Optimistic |
| `dial_literal_poetic` | Literal ↔ Poetic |
| `dial_reactive_proactive` | Reactive ↔ Proactive |
| `dial_concise_elaborate` | Concise ↔ Elaborate |
| `dial_adversarial_affirming` | Adversarial ↔ Affirming |
| `dial_pun_frequency` | No puns ↔ Frequent puns |
| `dial_roast_comfort` | No roast ↔ Roast freely |
| `dial_meme_literacy` | Low ↔ High meme literacy |
| `dial_emoji_frequency` | No emoji ↔ Frequent emoji |
| `dial_closure_need` | Open-ended ↔ Closure-seeking |

Each dial carries a `fragmentMappings[]` list — one entry per
extreme — pointing at a `PromptFragment` row. The interpolation
rule is **nearest-pole-only**:

- value < 0.15 → fire the `atValue ≈ 0.05` fragment at full weight
- value > 0.85 → fire the `atValue ≈ 0.95` fragment at full weight
- 0.15 ≤ value ≤ 0.85 → fire nothing

The mid-range silence is the point. Twelve dials at 0.5 produce no
contribution; the prompt budget stays predictable. A character with
a sharp signature pushes 3-5 dials to a pole and lets the rest sit
neutral.

A continuous-blend variant is possible but deferred. v1 keeps the
selection categorical so the budget model is boring.

## Archetypes

Archetypes are templates. Catalog:
`cart/component-gallery/data/character-archetype.ts`. Six in v1
(Sage / Jester / Protector / Curator / Companion / Critic) with
realistic dial-value seeds and quirk lists.

The archetype is a **seed**, not a gate. The user picks one on the
Character Creator's first screen so they see a coherent voice
rather than 12 sliders sitting at 0.5. The moment any dial is
touched, the archetype link is cosmetic — the Character row owns
the authoritative dial values, and the `archetypeId` pointer
survives only for UI grouping ("characters descended from Sage").

Archetypes have no runtime effect beyond the archetype voice
fragment they fire (if `archetypeId` is set). That fragment is one
short paragraph — distinct from the dial-derived fragments — that
sets a baseline framing the dials then refine.

## Quirks

Quirks are categorical opt-ins. Catalog:
`cart/component-gallery/data/character-quirk.ts`. Eight in v1:

| quirk | category | what it does |
| --- | --- | --- |
| `quirk_em_dash_only` | formatting-habit | em-dashes instead of colons |
| `quirk_no_exclamation_marks` | format-rule | drop exclamation marks |
| `quirk_signs_off_with_closing_thought` | signature-signoff | one closing-thought sentence per turn |
| `quirk_time_aware_greeting` | signature-greeting | salutation calibrated to local time |
| `quirk_no_emoji` | emoji-policy | no emoji ever |
| `quirk_loves_bracketed_asides` | verbal-tic | parenthetical second-voice asides |
| `quirk_numbered_bullets` | formatting-habit | always numbered, never plain dashes |
| `quirk_salty_sea_captain` | catchphrase | nautical vocabulary in passing |

Each quirk is exactly one `PromptFragment`. The quirk row carries
`fragmentId` as a 1:1 pointer. There is no "intensity slider" on a
quirk — intensity is reflected in the fragment body itself. If a
quirk needs a knob, it should be a dial.

## Why three layers, not one

A single big "personality knobs" surface fails three ways:

1. Too many knobs, no shape — users abandon mid-configuration.
2. No template seeding — the empty state looks like a job, not a
   gift.
3. Categorical rules don't fit on continuous axes — "always uses
   em-dashes" is not a 0..1 spectrum, it's a rule.

Three layers map cleanly:

- **Dials** for continuous, parametric voice traits.
- **Archetypes** for "give me something coherent to start with."
- **Quirks** for the categorical "always do / never do" rules.

The layers are also independently editable. A user can swap
archetypes without losing their custom quirks (the Character row
holds quirks separately from the archetype's `defaultQuirkIds`,
which are only consulted on first seeding).

## See also

- [01-character-as-voice.md](01-character-as-voice.md) for what
  composes them all into runtime.
- `cart/app/recipes/character-creator.tsx` for the actual fragment
  bodies (24 dial-pole fragments + 8 quirk fragments + 6 archetype
  fragments + 14 stance/initiative/correction fragments).
