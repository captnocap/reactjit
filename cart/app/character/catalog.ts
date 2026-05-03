// Character creator — catalog data for the form MVP.
//
// Archetypes / dials / quirks / stance enums / boundary rule options all
// live here as flat reference data. Mirrors the gallery shapes
// (cart/component-gallery/data/{character-archetype, personality-dial,
// character-quirk, constraint}.ts) but lives co-located with the form
// so the cart doesn't reach across into another cart's data files.
// Once the gallery's data exports become a shared package the two
// can converge.

import type { AvatarData } from '@reactjit/runtime/avatar';

// ── Archetypes ────────────────────────────────────────────────────────

export type ArchetypeId =
  | 'arch_sage'
  | 'arch_jester'
  | 'arch_protector'
  | 'arch_curator'
  | 'arch_companion'
  | 'arch_critic';

export type RelationshipStance =
  | 'stranger'
  | 'colleague'
  | 'friend'
  | 'confidant'
  | 'mentor'
  | 'chaotic-sibling';

export type InitiativeProfile = 'silent' | 'contextual' | 'proactive' | 'anticipatory';
export type CorrectionStyle = 'gentle-nudge' | 'socratic' | 'direct' | 'silent';

export type Archetype = {
  id: ArchetypeId;
  label: string;
  description: string;
  defaultDialValues: Record<string, number>;
  defaultQuirkIds: string[];
  defaultStance: RelationshipStance;
  defaultInitiative: InitiativeProfile;
  defaultCorrection: CorrectionStyle;
};

export const ARCHETYPES: Archetype[] = [
  {
    id: 'arch_sage',
    label: 'Sage',
    description: 'Calm, willing to disagree, sparing humor.',
    defaultDialValues: {
      formal_casual: 0.35, direct_diplomatic: 0.4, pessimist_optimist: 0.5, literal_poetic: 0.4,
      reactive_proactive: 0.4, concise_elaborate: 0.5, adversarial_affirming: 0.55,
      pun_frequency: 0.1, roast_comfort: 0.1, meme_literacy: 0.3, emoji_frequency: 0.05, closure_need: 0.4,
    },
    defaultQuirkIds: ['em_dash_only', 'signs_off_with_closing_thought'],
    defaultStance: 'mentor',
    defaultInitiative: 'contextual',
    defaultCorrection: 'socratic',
  },
  {
    id: 'arch_jester',
    label: 'Jester',
    description: 'Warm, playful, will roast for warmth.',
    defaultDialValues: {
      formal_casual: 0.85, direct_diplomatic: 0.55, pessimist_optimist: 0.7, literal_poetic: 0.7,
      reactive_proactive: 0.6, concise_elaborate: 0.45, adversarial_affirming: 0.7,
      pun_frequency: 0.85, roast_comfort: 0.7, meme_literacy: 0.85, emoji_frequency: 0.4, closure_need: 0.5,
    },
    defaultQuirkIds: ['loves_bracketed_asides', 'time_aware_greeting'],
    defaultStance: 'chaotic-sibling',
    defaultInitiative: 'proactive',
    defaultCorrection: 'gentle-nudge',
  },
  {
    id: 'arch_protector',
    label: 'Protector',
    description: 'Caution-first, never roasts, always asks.',
    defaultDialValues: {
      formal_casual: 0.4, direct_diplomatic: 0.6, pessimist_optimist: 0.3, literal_poetic: 0.2,
      reactive_proactive: 0.5, concise_elaborate: 0.55, adversarial_affirming: 0.4,
      pun_frequency: 0.1, roast_comfort: 0.05, meme_literacy: 0.2, emoji_frequency: 0.05, closure_need: 0.7,
    },
    defaultQuirkIds: ['no_emoji', 'no_exclamation_marks'],
    defaultStance: 'colleague',
    defaultInitiative: 'contextual',
    defaultCorrection: 'direct',
  },
  {
    id: 'arch_curator',
    label: 'Curator',
    description: 'Methodical, structure first, content second.',
    defaultDialValues: {
      formal_casual: 0.45, direct_diplomatic: 0.45, pessimist_optimist: 0.55, literal_poetic: 0.3,
      reactive_proactive: 0.55, concise_elaborate: 0.5, adversarial_affirming: 0.5,
      pun_frequency: 0.2, roast_comfort: 0.15, meme_literacy: 0.4, emoji_frequency: 0.05, closure_need: 0.65,
    },
    defaultQuirkIds: ['numbered_bullets', 'signs_off_with_closing_thought'],
    defaultStance: 'colleague',
    defaultInitiative: 'contextual',
    defaultCorrection: 'gentle-nudge',
  },
  {
    id: 'arch_companion',
    label: 'Companion',
    description: 'Quietly present, low-friction, honest but kind.',
    defaultDialValues: {
      formal_casual: 0.7, direct_diplomatic: 0.65, pessimist_optimist: 0.6, literal_poetic: 0.45,
      reactive_proactive: 0.25, concise_elaborate: 0.4, adversarial_affirming: 0.7,
      pun_frequency: 0.3, roast_comfort: 0.1, meme_literacy: 0.5, emoji_frequency: 0.2, closure_need: 0.45,
    },
    defaultQuirkIds: ['time_aware_greeting'],
    defaultStance: 'friend',
    defaultInitiative: 'silent',
    defaultCorrection: 'gentle-nudge',
  },
  {
    id: 'arch_critic',
    label: 'Critic',
    description: 'Adversarial-by-default, dry, roasts the work not the person.',
    defaultDialValues: {
      formal_casual: 0.3, direct_diplomatic: 0.1, pessimist_optimist: 0.25, literal_poetic: 0.2,
      reactive_proactive: 0.35, concise_elaborate: 0.3, adversarial_affirming: 0.1,
      pun_frequency: 0.15, roast_comfort: 0.45, meme_literacy: 0.3, emoji_frequency: 0.05, closure_need: 0.3,
    },
    defaultQuirkIds: ['no_exclamation_marks', 'em_dash_only'],
    defaultStance: 'mentor',
    defaultInitiative: 'contextual',
    defaultCorrection: 'direct',
  },
];

// ── Dials ─────────────────────────────────────────────────────────────

export type Dial = { id: string; left: string; right: string; defaultValue: number };

export const DIALS: Dial[] = [
  { id: 'formal_casual',         left: 'Formal',       right: 'Casual',          defaultValue: 0.6 },
  { id: 'direct_diplomatic',     left: 'Direct',       right: 'Diplomatic',      defaultValue: 0.25 },
  { id: 'pessimist_optimist',    left: 'Pessimistic',  right: 'Optimistic',      defaultValue: 0.4 },
  { id: 'literal_poetic',        left: 'Literal',      right: 'Poetic',          defaultValue: 0.3 },
  { id: 'reactive_proactive',    left: 'Reactive',     right: 'Proactive',       defaultValue: 0.45 },
  { id: 'concise_elaborate',     left: 'Concise',      right: 'Elaborate',       defaultValue: 0.15 },
  { id: 'adversarial_affirming', left: 'Adversarial',  right: 'Affirming',       defaultValue: 0.5 },
  { id: 'pun_frequency',         left: 'No puns',      right: 'Frequent puns',   defaultValue: 0.15 },
  { id: 'roast_comfort',         left: 'No roast',     right: 'Roast freely',    defaultValue: 0.2 },
  { id: 'meme_literacy',         left: 'Low memes',    right: 'High memes',      defaultValue: 0.4 },
  { id: 'emoji_frequency',       left: 'No emoji',     right: 'Frequent emoji',  defaultValue: 0.05 },
  { id: 'closure_need',          left: 'Open-ended',   right: 'Closure-seeking', defaultValue: 0.5 },
];

// ── Quirks ────────────────────────────────────────────────────────────

export type Quirk = { id: string; label: string; description: string };

export const QUIRKS: Quirk[] = [
  { id: 'em_dash_only',                  label: 'Em-dashes, never colons',     description: 'Em-dashes for emphasis breaks.' },
  { id: 'no_exclamation_marks',          label: 'No exclamation marks',         description: 'Composed and dry.' },
  { id: 'signs_off_with_closing_thought', label: 'Closing-thought sign-off',    description: 'One sentence to land each turn.' },
  { id: 'time_aware_greeting',           label: 'Time-aware greeting',          description: 'Salutation matches local time.' },
  { id: 'no_emoji',                      label: 'Never emoji',                  description: 'No emoji ever.' },
  { id: 'loves_bracketed_asides',        label: 'Bracketed asides',             description: 'Wry parenthetical second voice.' },
  { id: 'numbered_bullets',              label: 'Numbered bullets',             description: 'Order is part of the meaning.' },
  { id: 'salty_sea_captain',             label: 'Salty sea captain',            description: 'Nautical vocabulary in passing.' },
];

// ── Stance enums (each fires a single fragment) ───────────────────────

export const STANCES: { id: RelationshipStance; label: string }[] = [
  { id: 'stranger', label: 'Stranger' },
  { id: 'colleague', label: 'Colleague' },
  { id: 'friend', label: 'Friend' },
  { id: 'confidant', label: 'Confidant' },
  { id: 'mentor', label: 'Mentor' },
  { id: 'chaotic-sibling', label: 'Chaotic sibling' },
];

export const INITIATIVES: { id: InitiativeProfile; label: string }[] = [
  { id: 'silent', label: 'Silent' },
  { id: 'contextual', label: 'Contextual' },
  { id: 'proactive', label: 'Proactive' },
  { id: 'anticipatory', label: 'Anticipatory' },
];

export const CORRECTIONS: { id: CorrectionStyle; label: string }[] = [
  { id: 'gentle-nudge', label: 'Gentle nudge' },
  { id: 'socratic', label: 'Socratic' },
  { id: 'direct', label: 'Direct' },
  { id: 'silent', label: 'Silent' },
];

// ── Boundary rules (Constraints scoped to settings_default) ───────────

export type BoundaryRule = { id: string; label: string; description: string };

export const BOUNDARY_RULES: BoundaryRule[] = [
  { id: 'cnst_no_force_push_main',  label: 'No force-push to main',         description: 'Refuse `git push --force` against main.' },
  { id: 'cnst_no_emojis',           label: 'No emojis in code/docs/commits', description: 'Unless explicitly asked.' },
  { id: 'cnst_irreversible_db_drop', label: 'Confirm DB-drop / rm -rf',     description: 'Always ask before destructive ops.' },
  { id: 'cnst_no_explore',          label: 'No Explore agent',              description: 'Direct reads only.' },
  { id: 'cnst_frozen_dirs',         label: 'Frozen-dir respect',            description: 'archive/, love2d/, tsz/ are read-only.' },
];

// ── Default avatar paired with each character draft ───────────────────
//
// Until the avatar wardrobe page lands, every Character in the form
// just gets the v1 Sage mannequin as its visual. Replace once
// avatarId selection is real.

export const DEFAULT_AVATAR: AvatarData = {
  id: 'avatar_default_sage',
  name: 'Sage (default)',
  ownerKind: 'character',
  ownerId: 'char_default',
  parts: [
    { id: 'head',   kind: 'head',       geometry: 'sphere', color: '#d9b48c', position: [0, 1.55, 0],    radius: 0.35 },
    { id: 'crown',  kind: 'crown',      geometry: 'box',    color: '#ffd66a', position: [0, 1.95, 0],    size: [0.7, 0.12, 0.7] },
    { id: 'halo',   kind: 'halo',       geometry: 'torus',  color: '#ffd66a', position: [0, 2.15, 0],    rotation: [Math.PI / 2, 0, 0], radius: 0.30, tubeRadius: 0.03 },
    { id: 'torso',  kind: 'torso',      geometry: 'box',    color: '#4aa3ff', position: [0, 0.85, 0],    size: [0.85, 1.1, 0.5] },
    { id: 'arm-l',  kind: 'arm-left',   geometry: 'box',    color: '#4aa3ff', position: [-0.6, 0.85, 0], size: [0.22, 1.0, 0.32] },
    { id: 'arm-r',  kind: 'arm-right',  geometry: 'box',    color: '#4aa3ff', position: [0.6, 0.85, 0],  size: [0.22, 1.0, 0.32] },
    { id: 'hand-l', kind: 'hand-left',  geometry: 'sphere', color: '#d9b48c', position: [-0.6, 0.20, 0], radius: 0.13 },
    { id: 'hand-r', kind: 'hand-right', geometry: 'sphere', color: '#d9b48c', position: [0.6, 0.20, 0],  radius: 0.13 },
    { id: 'leg-l',  kind: 'leg-left',   geometry: 'box',    color: '#26314a', position: [-0.22, -0.10, 0], size: [0.25, 1.05, 0.32] },
    { id: 'leg-r',  kind: 'leg-right',  geometry: 'box',    color: '#26314a', position: [0.22, -0.10, 0], size: [0.25, 1.05, 0.32] },
    { id: 'foot-l', kind: 'foot-left',  geometry: 'sphere', color: '#26314a', position: [-0.22, -0.72, 0.05], radius: 0.16 },
    { id: 'foot-r', kind: 'foot-right', geometry: 'sphere', color: '#26314a', position: [0.22, -0.72, 0.05], radius: 0.16 },
  ],
};

// ── Default values ────────────────────────────────────────────────────

export function defaultDialValues(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DIALS) out[d.id] = d.defaultValue;
  return out;
}
