# 99 — Open questions

Committed positions and genuine opens for the Character /
Personality system. Updated when the answer firms.

## Committed (don't relitigate)

- **Character ≠ Role.** They never merge. See
  [01-character-as-voice.md](01-character-as-voice.md). A
  character can play many roles; a role can be played by many
  characters.
- **Manifest ≠ accommodations.** Declared traits stay on
  `User.preferences.accommodations[]`. Inferred traits stay on
  `UserManifest`. They coexist, never fold.
- **Quiz UI = chat-loom.** No custom quiz widget. The author
  turn's intent tree IS the UI.
- **Boundary rules = Constraint.** No parallel "BoundaryRule"
  type.
- **Dial interpolation is nearest-pole-only in v1.** Mid-range
  fires nothing. Continuous blend is a future revision when we
  have evidence the budget model holds.
- **No auto-applied adjustments.** Compatibility surfaces
  adjustments; the user always taps to apply. Voice does not
  change under the user.
- **Unlock table is static.** LLMs may suggest new entries; the
  table is hand-curated.

## Genuinely open

### Avatar / voice-thumbnail pipeline

The Character row carries `avatarRef?: string` and
`voiceThumbnailRef?: string` — opaque locators. Where the actual
asset comes from is open. Candidates:

- **Local file path.** User uploads, cart copies to
  `~/.app/characters/<id>/avatar.png`. Simplest.
- **External URL.** Cart fetches on demand. Privacy-leaky.
- **Generated from prompt.** Calls an image / TTS model. Adds
  cost and latency.

The data shape is stable across all three; the pipeline is
deferred. UI shows a placeholder until the pipeline lands.

### Character grain across profiles

Today: Character is profile-grain via `Settings.activeCharacterId`
(planned). Switching profiles can swap the active character.

But: should a single character be visible across profiles, or is
each profile an island? The user might want their
`char_chaos_sibling` available on every profile (it's *their*
character). Or they might want a strict-work profile to never
show their playful character (cleaner switch).

Leaning: Characters are owned by a User (already true via
`character.userId`) and *exposed* via the active Settings. A
"shared characters" multi-select on Settings would let users
opt-in to which characters surface per profile. Deferred until
multi-profile lands in earnest.

### Manifest privacy tier

PRD §6: "User can mark manifest fields as 'assistant only,'
'anonymized,' or 'deletable.'" We have not threaded this through
the existing `Privacy` shape
(`cart/component-gallery/data/privacy.ts`).

Sketch: extend `Privacy` with a `manifest` namespace mirroring the
`tools` / `filesystem` shape — per-dimension visibility ('visible'
/ 'anonymized' / 'hidden'). The composer's
`src_user-manifest-snapshot` reads the privacy tier and skips
hidden dimensions. Anonymized dimensions get a hash-stable but
opaque token. Deletable dimensions can be wiped from the UI with
a recompute pass.

Deferred to a Privacy revision; data shapes here don't depend on
the answer.

### Character-vs-character interview mode

PRD doesn't ask for this directly, but: when multiple characters
exist, can the user have them *talk to each other* about a topic?
A `comp_character_dialogue` composition would slot two character
snapshots into a dialogue prompt and let them pass turns.

Open whether this is a Character feature or a worker-spawn
feature (one Worker per Character, with a router between them).
Leaning: worker-spawn — Characters compose into voice, Workers
compose into runs. Deferred until the activity registry lands.

### Reciprocity fragment threshold

The reciprocity fragment ("here's what I'm currently calibrating
on") fires when a bounded set of manifest dimensions reach
confidence > 0.5. *Which* dimensions? All of them produces
constant volunteered context; few of them produces opportunistic
disclosure.

Leaning: a curated set carried on the recipe, not the user. The
recipe author decides which dimensions are reciprocity-worthy
(probably the social / emotional ones — humor, trust, argument
style, communication style — not the metaphor-affinity which
isn't *about* the user in the same way).

### How quizzes know to surface

Today: cart fires the quiz author when on the home / manifest
page, an under-sampled dimension exists, and debounce passes.
Open: should the quiz author also fire mid-conversation when an
opportunity is genuinely good (e.g. user says something that
implies a humor preference)?

Leaning: no, for now. Mid-conversation surfacing risks breaking
flow. A "you just said X — mind if I confirm?" inline path is
plausible but requires a recipe of its own. Deferred.

### Character export / import

A character is a single row + its referenced fragments + its
boundary-rule constraints. Exporting it (for sharing across
devices, or for a community gallery of characters) is plausible
but raises questions about prompt-fragment portability — fragments
are settings-scoped today.

Sketch: a `CharacterPack` shape that bundles the character row,
its custom prompt fragments (with new ids on import), its
boundary-rule constraints (settings-rebound on import), and any
custom quirks. Versioned, signed by the author. Deferred until a
real sharing flow exists.

## Closed by previous decisions

- **Should the character carry a model preference?** No — that's a
  Role concern. Settings.defaultModelId continues to win.
- **Should friction be calculated at every turn?** No — event-
  driven recompute is sufficient. See
  [06-compatibility-and-friction.md](06-compatibility-and-friction.md).
- **Should quizzes ever block the UI?** No. Always declinable,
  always async.
