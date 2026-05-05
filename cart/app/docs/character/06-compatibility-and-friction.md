# 06 — Compatibility and friction

When a Character meets a UserManifest, friction emerges. The
`CharacterCompatibility` row captures it.

## Shape

`cart/component-gallery/data/character-compatibility.ts` declares
the row:

```ts
{
  id: string;
  characterId: string;
  userManifestId: string;
  alignmentScore: number;             // 0..1, higher = lower friction
  frictionAlerts: FrictionAlert[];
  recommendedAdjustments: RecommendedAdjustment[];
  computedAt: string;
}
```

The score is **derived** from the two inputs but **stored**. The
cart recomputes on every save of either side and on every
`system:quiz:inferred` event (declared by the
`personality-quiz-engine` recipe). The stored row carries the
frozen friction alerts with their evidence quiz pointers so the
UI doesn't have to recompute on every render.

## What gets compared

The compatibility recomputer (a pure function we'll implement in
`cart/app/character/lib/compute-compatibility.ts` when the page
ships) walks each manifest dimension and asks: "given this
character's dial values, quirks, stance, initiative, correction —
is the user's read of this dimension *served*?"

Examples that surface as `frictionAlerts`:

- `dim_communication_style: terse` (high confidence) × character
  with `dial_concise_elaborate > 0.7` (elaborate side) →
  **hard friction**. The user reads as terse; the character is
  configured to elaborate.
- `dim_humor_alignment: none` × character with
  `dial_pun_frequency > 0.7` → **hard friction**.
- `dim_trust_cadence: never` × character with
  `relationshipStance: chaotic-sibling` → **hard friction**. Loud
  warmth lands as overstep when trust is slow.
- `dim_argument_style: avoid` × character with
  `dial_adversarial_affirming < 0.2` (adversarial side) →
  **soft friction**. May be desired (user wants to be challenged
  past their avoidance) or not. Surfaces as a soft alert; user
  decides.
- `dim_communication_style: emotional` × character with
  `correctionStyle: silent` → **soft friction**. The user wants
  engagement; the character refuses unsolicited correction.

`alignmentScore` is computed as `1 - Σ(severity_weight * 1{alert
fires})` clamped to `[0, 1]`. Hard friction weights more than soft.

## Recommended adjustments

Each friction alert can carry recommended adjustments — concrete
suggestions the Character Creator UI can offer in one tap. They
target a specific field (dial / archetype / quirk / stance /
initiative / correction) with a `currentValue → suggestedValue`
delta and a one-line reason.

Adjustments are advisory. The user is never forced. PRD §4.2
("the assistant's personality *shifts within bounds* based on the
user manifest, without losing its core identity") is honored
through the user explicitly tapping the recommendation, not
through silent runtime adaptation.

We do not auto-apply adjustments. Voice should never change
underneath the user.

## When friction surfaces

- **Character save.** On `system:character:saved`, recompute. If
  any hard alert fires, the home page shows a one-line nudge
  ("This voice may not land — let me explain why" → opens the
  Compatibility panel).
- **Manifest update.** On `system:quiz:inferred`, recompute. New
  inferences can flip a soft alert to hard (or clear an existing
  alert).
- **User-initiated.** From the Character Creator's "check fit"
  affordance, recompute on demand.

The home-page nudge is a soft surface — never a modal, never
blocking. Users can dismiss; the alert persists on the
Compatibility panel for as long as it's true.

## Reciprocity

PRD §4.5 ("The more the user reveals via surveys, the more the
assistant should reciprocate with transparency about its own
logic, limits, or internal state") becomes a reciprocity fragment
that conditionally injects "and here's what I'm currently
calibrating on" — gated on `manifest.dimensions[].confidence >
0.5` for a bounded set of dimensions. The fragment lives in the
quiz-engine recipe's deferred set; it ships when the
mutual-adaptation recipe lands.

## Stale rows

A row's `computedAt` says when it's from. If either side has been
updated since, the UI flags the row as stale and a recompute is
queued. Stale alerts still show — they're a recent signal even if
not the latest — but the UI labels them visibly.

## What this is NOT

- **A scoring system that rates the user.** The score rates the
  *match between user and active character*. A "low alignment"
  reading with the chaotic-sibling character paired with a
  terse-low-trust user is a fact about a mismatch, not a fact
  about the user.
- **An auto-corrector.** Adjustments are recommendations, never
  applied without explicit user action.
- **A continuous friction monitor.** We don't recompute on every
  turn. Recompute is event-driven (save / inference / explicit).

## See also

- [03-manifest-as-evolving-read.md](03-manifest-as-evolving-read.md)
  for the dimensions friction is computed against.
- [07-quirk-unlock-loop.md](07-quirk-unlock-loop.md) for the
  feedback loop that lets manifest discoveries unlock Character
  Creator content.
