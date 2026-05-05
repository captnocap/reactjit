# 07 — Quirk unlock loop

PRD §4.4: "User manifest discoveries can unlock new quirks or
options in the Character Creator." This is the cheapest possible
implementation of that loop.

## The loop

```
quiz answered
  → manifest dimension reaches confidence ≥ 0.7
  → cart emits system:manifest:dimension-confident { dimensionId, value }
  → unlock table maps (dimensionId, value) to a set of (archetype | quirk) ids
  → cart adds them to the active settings' available-quirks set
  → next visit to /character shows the new options as fresh
```

No magic, no LLM call in the unlock path. The unlock table is a
small static mapping; reaching a confident read is a *signal*,
not a *generation*.

## The unlock table

Lives in
`cart/app/character/lib/unlock-table.ts` (planned). Shape:

```ts
type UnlockEntry = {
  dimensionId: string;
  triggerValue: string | number;
  unlocks: Array<
    | { kind: 'quirk'; id: string }
    | { kind: 'archetype'; id: string }
    | { kind: 'theme'; id: string }
  >;
  badgeText: string;
};
```

A few illustrative entries (real entries land with the page):

| trigger | unlocks | badge |
| --- | --- | --- |
| `dim_metaphor_affinity = nautical` | `arch_salty_captain`, `quirk_salty_sea_captain`, `theme:characterAccentNautical` | "Yarr." |
| `dim_humor_alignment = absurd` | `arch_jester` (highlighted), new quirk `quirk_non_sequitur_asides` | "Surreal mode" |
| `dim_decision_drivers = principle` | `arch_sage` (highlighted), `arch_critic` (highlighted) | "Principles unlocked" |
| `dim_curiosity_patterns = breadth-fringe` | new quirk `quirk_wide_curiosity_lateral_tangents` | "Tangent-friendly" |

The badge is what the user sees. The framing is "the assistant
*figured out something about you* and rolled out something
matched to that." Reciprocity-shaped, never extractive.

## Why a static table and not LLM-generated

Two reasons.

First, predictability. The user should be able to see the
unlock-table from the Character Creator's "what's locked?"
affordance — every potential unlock laid out plainly with its
trigger. An LLM-generated unlock would be opaque and fragile.

Second, cost. Unlocking is a hot path (every confident dimension
should consider it); a deterministic lookup is essentially free.

LLMs have a role: they can *suggest* new unlock-table entries
when a recipe lands a new archetype or quirk. The table itself
remains hand-curated.

## Locked-state UX

The Character Creator shows locked archetypes / quirks dimmed,
with a small badge listing the trigger ("Earned through 3+ quizzes
on humor alignment"). Users can see what's locked and how to
unlock — no hidden state.

Locked items are not **gated**. A user who specifically wants the
salty-captain archetype before the manifest has read them as
nautical-affinitive can unlock it manually from settings. The
unlock loop is a *positive* surface (it surfaces things you might
want), never a *gating* surface.

## Versioning

The unlock-table is versioned. When entries are added, existing
manifests with already-confident readings that match a new
trigger get their unlocks applied retroactively (one-time on
boot, idempotent). When entries are removed, already-unlocked
items stay unlocked — we never revoke.

## What this is NOT

- **A leveling system.** No XP, no progress bars, no badges
  outside the unlock table. The PRD's "no percentage bars; use
  organic metaphors" rule applies here too.
- **A persuasion system.** We don't surface unlocks pre-emptively
  to push the user to answer more quizzes. Unlocks land
  passively when the user happens to visit /character next.
- **A monetization hook.** Every unlock is free. The loop exists
  to tighten the assistant↔user feedback, not to drive
  engagement.

## See also

- [03-manifest-as-evolving-read.md](03-manifest-as-evolving-read.md)
  for confidence semantics that drive the trigger.
- [02-dials-archetypes-quirks.md](02-dials-archetypes-quirks.md)
  for the catalog the unlocks slot into.
