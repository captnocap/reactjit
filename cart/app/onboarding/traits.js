// Onboarding Step3 trait catalog. Each chip carries a worker-facing
// `note` that gets persisted as a User.preferences.accommodations[]
// entry on lock-in. The label is the chip text the user clicks; the
// note is the calibration hint a worker reads later. Both flow through
// the same setTraits write — keeping them colocated here is the single
// source of truth, imported by Step3 (chip render) and state.jsx
// (id → accommodation row mapping).
//
// Order is deliberately shuffled so the categories blur — no visual
// grouping makes one trait feel more or less weighty than another.

export const TRAITS = [
  { id: 'coffee',         label: 'Coffee person',        note: 'Casual; harmless context.' },
  { id: 'reader',         label: 'Marathon reader',      note: 'Comfortable with long-form text. Dense reference material is fine; padding is still not.' },
  { id: 'cyclist',        label: 'Cyclist',              note: 'Hobby context only.' },
  { id: 'night_owl',      label: 'Night owl',            note: 'Active late; "good morning" greetings can land flat. Don\'t infer schedule from message timestamps.' },
  { id: 'detail',         label: 'Detail-oriented',      note: 'Cares about precision. Flag handwaved implementation details rather than glossing.' },
  { id: 'vegetarian',     label: 'Vegetarian',           note: 'Default to meat-free options when food / recipes come up.' },
  { id: 'instrument',     label: 'Plays an instrument',  note: 'Music-domain analogies are usable.' },
  { id: 'big_picture',    label: 'Big-picture thinker',  note: 'Open with the shape, then drill in. Bottom-up walkthroughs without context lose them.' },
  { id: 'cook',           label: 'Cooking enthusiast',   note: 'Cooking analogies land well.' },
  { id: 'tea',            label: 'Tea person',           note: 'Casual; harmless context.' },
  { id: 'gamer',          label: 'Gamer',                note: 'Game-mechanics analogies (state machines, turn loops) land well.' },
  { id: 'puzzles',        label: 'Loves puzzles',        note: 'Likes to be shown the puzzle, not just the answer; surface the constraint that made the choice non-obvious.' },
  { id: 'hiker',          label: 'Hiker',                note: 'Hobby context only.' },
  { id: 'scifi',          label: 'Sci-fi reader',        note: 'Genre analogies are usable; speculative framings are fine.' },
  { id: 'anime',          label: 'Anime watcher',        note: 'Pop-culture context is usable.' },
  { id: 'early_riser',    label: 'Early riser',          note: 'Active early; long evening sessions may indicate fatigue.' },
  { id: 'indoor',         label: 'Indoor person',        note: 'Don\'t default to "go outside" suggestions when stuck.' },
  { id: 'outdoor',        label: 'Outdoor person',       note: 'Outdoor / movement framings are welcome.' },
  { id: 'rock',           label: 'Rock music',           note: 'Music-genre context.' },
  { id: 'electronic',     label: 'Electronic music',     note: 'Music-genre context.' },
  { id: 'philosophy',     label: 'Philosophy reader',    note: 'Comfortable with abstract / first-principles framings; don\'t over-translate to concrete examples.' },
];

export const TRAITS_BY_ID = TRAITS.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, /** @type {Record<string, { id: string, label: string, note: string }>} */ ({}));

// Map a list of trait ids to UserPreferences.accommodations[] entries.
// Unknown ids are dropped silently — drift between Step3 and persisted
// state shouldn't crash hydration of older saves.
export function traitsToAccommodations(ids) {
  if (!Array.isArray(ids)) return [];
  const out = [];
  for (const id of ids) {
    const t = TRAITS_BY_ID[id];
    if (!t) continue;
    out.push({ id: `acc_${id}`, label: t.label, note: t.note });
  }
  return out;
}

// Reverse: pull trait ids back out of an accommodations[] array. The
// `id` prefix scheme (`acc_<traitId>`) is the canonical encoding.
export function accommodationsToTraits(accommodations) {
  if (!Array.isArray(accommodations)) return [];
  const out = [];
  for (const a of accommodations) {
    if (!a || typeof a.id !== 'string') continue;
    if (!a.id.startsWith('acc_')) continue;
    const id = a.id.slice(4);
    if (TRAITS_BY_ID[id]) out.push(id);
  }
  return out;
}
