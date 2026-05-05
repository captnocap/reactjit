# 03 — Manifest as evolving read

The **UserManifest** is the assistant's evolving read of the user.
Distinct from `User.preferences.accommodations[]`. Both coexist;
neither overwrites the other.

## Declared vs inferred

The user shape (`cart/component-gallery/data/user.ts`) carries
`preferences.accommodations[]` — the trait list captured by
onboarding Step 3 (`cart/app/onboarding/Step3.jsx` + the catalog at
`cart/app/onboarding/traits.js`). Those are *declared* traits: the
user picked them. They never decay; they never get
"contradicted" by an inference. They are first-person facts.

The manifest (`cart/component-gallery/data/user-manifest.ts`) is
the *inferred* model: confidence-scored values along a curated set
of dimensions, accumulated through quizzes and conversational
moments. The manifest is what the assistant *thinks* it knows. It
can be wrong; it can drift; it carries provenance for audit.

A user who declared "ADHD" in onboarding has it forever in
`accommodations[]`. The manifest can independently observe that
the same user reads as "depth-safe" along the curiosity-pattern
dimension at confidence 0.6. The two are not the same axis and
should not be folded together.

## Dimension catalog

The dimensions are curated reference data, similar to
`cart/app/onboarding/traits.js`. Catalog:
`cart/component-gallery/data/manifest-dimension.ts`. Nine in v1:

| dimension | axis | options |
| --- | --- | --- |
| `dim_communication_style` | multipolar | terse / verbose / emotional / clinical / narrative |
| `dim_decision_drivers` | multipolar | gut / data / social-proof / principle / precedent |
| `dim_stress_responses` | multipolar | withdraw / attack / deflect / solve / narrate |
| `dim_curiosity_patterns` | bipolar | breadth-fringe ↔ depth-safe |
| `dim_value_hierarchy` | categorical | achievement / connection / stability / novelty / control / craft / autonomy |
| `dim_humor_alignment` | multipolar | dark / wholesome / absurd / dry / self-deprecating / none |
| `dim_trust_cadence` | bipolar | instant ↔ never |
| `dim_argument_style` | multipolar | combat / discuss / avoid / mediate / pivot |
| `dim_metaphor_affinity` | categorical | music / cooking / gaming / nautical / sports / plants / machinery / narrative |

Each dimension carries a `coverageWeight: 0..1` driving the quiz
engine's sampling priority. High coverage weight + low confidence
= the engine over-samples. Mid-confidence + low-weight stays quiet.

`dim_metaphor_affinity` is the one dimension whose value loops back
into the quiz engine itself: it lets the reframing pass pick a
metaphor family the user has *already* reacted to positively.

## Per-dimension state

Each manifest entry is:

```ts
{
  dimensionId: string;
  currentValue: string | number;
  confidence: number;             // 0..1
  lastReinforcedAt: string;
  sourceQuizIds: string[];        // quizzes that supported this value
  contradictoryQuizIds: string[]; // quizzes whose answer disagreed
  provenanceNote?: string;
}
```

The `sourceQuizIds` / `contradictoryQuizIds` split is load-bearing:
a dimension with five sources and zero contradictions reads as
stable; one with five sources and one contradiction reads as
stable-with-flagged-anomaly. The anomaly-detection lane fires only
when contradictions appear at confidence > 0.6.

## How confidence updates

Per-quiz delta is small and capped:

- **Reinforcement** (same value as current): `+0.10..+0.20`. The
  user has confirmed what was already inferred.
- **Fresh inference** (no prior value): `+0.15..+0.25`. Modest —
  the manifest stabilizes through repetition.
- **Contradiction** at confidence > 0.6: `0`. Never deduct on
  contradiction. Append to `contradictoryQuizIds`, leave
  `currentValue` unchanged, emit `manifest:anomaly-detected`.
- **Contradiction** at confidence ≤ 0.6: replace `currentValue`,
  reset `confidence` to the fresh-inference range, append to
  `sourceQuizIds`. The prior value was tentative.

Per-quiz delta is hard-capped at `±0.25` so a single answer cannot
snap a dimension.

## How the manifest composes into runtime

At request-resolve time the active manifest feeds the master `who`
slot via the `src_user-manifest-snapshot` source kind. The
snapshot resolves the top-N highest-confidence dimensions
(threshold + N are computeScript params; defaults `threshold=0.5`,
`N=4`) into a "things I have inferred about you so far" preamble.

Low-confidence dimensions stay out of the preamble entirely. The
assistant should not act on a 0.3-confidence read; it should keep
quizzing.

## Recurring themes

`UserManifest.recurringThemes: string[]` carries free-form
observations the assistant has noticed across sessions but that
don't fit a dimension cleanly. These are short — one sentence
each — and they get included in the snapshot at low weight. They
exist for the "the assistant *gets* me" moment that pure
dimensional reads can't deliver.

A theme like "Goal-shaped input, not implementation-shaped"
captures a pattern across many turns; no single quiz could produce
it. Themes are write-only-by-the-assistant; the user does not edit
them directly.

## See also

- [04-quiz-as-gift.md](04-quiz-as-gift.md) for how dimensions get
  sampled.
- [05-anti-repetition-and-spiral.md](05-anti-repetition-and-spiral.md)
  for the coverage map driving sampling priority.
- [06-compatibility-and-friction.md](06-compatibility-and-friction.md)
  for what happens when the manifest and the active character
  disagree.
