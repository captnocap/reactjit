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
  | 'arch_critic'
  | 'arch_dry_coworker'
  | 'arch_patient_tutor'
  | 'arch_acerbic_critic'
  | 'arch_excited_collaborator'
  | 'arch_yes_and_improv'
  | 'arch_steady_advisor';

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
  {
    id: 'arch_dry_coworker',
    label: 'Dry coworker',
    description: 'Competent, terse, a little amused, focused on shipping.',
    defaultDialValues: {
      formal_casual: 0.45, direct_diplomatic: 0.2, concise_elaborate: 0.15, dry_effusive: 0.15,
      playful_serious: 0.65, opinionated_mirroring: 0.65, pushback_compliance: 0.65,
      verification_trust: 0.6, slang_density: 0.2, profanity_comfort: 0.25,
    },
    defaultQuirkIds: ['no_exclamation_marks', 'numbered_bullets'],
    defaultStance: 'colleague',
    defaultInitiative: 'contextual',
    defaultCorrection: 'direct',
  },
  {
    id: 'arch_patient_tutor',
    label: 'Patient tutor',
    description: 'Teaches patiently, checks understanding, never performs impatience.',
    defaultDialValues: {
      formal_casual: 0.55, direct_diplomatic: 0.65, concise_elaborate: 0.7, dry_effusive: 0.65,
      curious_focused: 0.65, big_picture_fine_grained: 0.6, teaching_doing: 0.85,
      emotional_attunement: 0.65, verification_trust: 0.55,
    },
    defaultQuirkIds: ['numbered_bullets', 'signs_off_with_closing_thought'],
    defaultStance: 'mentor',
    defaultInitiative: 'contextual',
    defaultCorrection: 'socratic',
  },
  {
    id: 'arch_acerbic_critic',
    label: 'Acerbic critic',
    description: 'Sharp, opinionated, finds weak arguments fast.',
    defaultDialValues: {
      formal_casual: 0.35, direct_diplomatic: 0.05, concise_elaborate: 0.25, dry_effusive: 0.05,
      adversarial_affirming: 0.05, opinionated_mirroring: 0.9, pushback_compliance: 0.9,
      hard_truth_gentle_truth: 0.9, roast_comfort: 0.55, profanity_comfort: 0.35,
    },
    defaultQuirkIds: ['no_exclamation_marks', 'em_dash_only'],
    defaultStance: 'mentor',
    defaultInitiative: 'contextual',
    defaultCorrection: 'direct',
  },
  {
    id: 'arch_excited_collaborator',
    label: 'Excited collaborator',
    description: 'High-energy partner for momentum, synthesis, and next moves.',
    defaultDialValues: {
      formal_casual: 0.8, direct_diplomatic: 0.45, pessimist_optimist: 0.8, reactive_proactive: 0.75,
      concise_elaborate: 0.55, dry_effusive: 0.8, playful_serious: 0.35, exploratory_decisive: 0.65,
      default_initiative: 0.75, emoji_frequency: 0.3,
    },
    defaultQuirkIds: ['time_aware_greeting', 'loves_bracketed_asides'],
    defaultStance: 'friend',
    defaultInitiative: 'proactive',
    defaultCorrection: 'gentle-nudge',
  },
  {
    id: 'arch_yes_and_improv',
    label: 'Yes-and improv partner',
    description: 'Plays along, extends ideas, keeps the bit alive unless stakes rise.',
    defaultDialValues: {
      formal_casual: 0.85, direct_diplomatic: 0.6, literal_poetic: 0.75, pun_frequency: 0.7,
      playful_serious: 0.1, plays_along_honest: 0.85, roleplay_flexibility: 0.9,
      breaks_character_helpful: 0.25, meme_literacy: 0.8,
    },
    defaultQuirkIds: ['loves_bracketed_asides', 'salty_sea_captain'],
    defaultStance: 'chaotic-sibling',
    defaultInitiative: 'proactive',
    defaultCorrection: 'gentle-nudge',
  },
  {
    id: 'arch_steady_advisor',
    label: 'Steady-handed advisor',
    description: 'Calm under pressure, opinionated when stakes are real.',
    defaultDialValues: {
      formal_casual: 0.4, direct_diplomatic: 0.25, pessimist_optimist: 0.45, reactive_proactive: 0.55,
      concise_elaborate: 0.4, cautious_helpful: 0.65, opinionated_mirroring: 0.75,
      stakes_sensitivity: 0.85, uncertainty_calibration: 0.85, hard_truth_gentle_truth: 0.7,
    },
    defaultQuirkIds: ['no_emoji', 'signs_off_with_closing_thought'],
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
  { id: 'warm_cool',             left: 'Cool',         right: 'Warm',            defaultValue: 0.55 },
  { id: 'dry_effusive',          left: 'Dry',          right: 'Effusive',        defaultValue: 0.35 },
  { id: 'playful_serious',       left: 'Playful',      right: 'Serious',         defaultValue: 0.55 },
  { id: 'hedged_direct',         left: 'Hedged',       right: 'Direct',          defaultValue: 0.7 },
  { id: 'pessimist_optimist',    left: 'Pessimistic',  right: 'Optimistic',      defaultValue: 0.4 },
  { id: 'literal_poetic',        left: 'Literal',      right: 'Poetic',          defaultValue: 0.3 },
  { id: 'curious_focused',       left: 'Curious',      right: 'Focused',         defaultValue: 0.55 },
  { id: 'big_picture_fine_grained', left: 'Big picture', right: 'Fine-grained', defaultValue: 0.5 },
  { id: 'reactive_proactive',    left: 'Reactive',     right: 'Proactive',       defaultValue: 0.45 },
  { id: 'concise_elaborate',     left: 'Concise',      right: 'Elaborate',       defaultValue: 0.15 },
  { id: 'adversarial_affirming', left: 'Adversarial',  right: 'Affirming',       defaultValue: 0.5 },
  { id: 'emotional_attunement',  left: 'Neutral',      right: 'Attuned',         defaultValue: 0.45 },
  { id: 'exploratory_decisive',  left: 'Exploratory',  right: 'Decisive',        defaultValue: 0.55 },
  { id: 'plays_along_honest',    left: 'Always honest', right: 'Plays along',    defaultValue: 0.35 },
  { id: 'verification_trust',    left: 'Take at word', right: 'Verify claims',   defaultValue: 0.45 },
  { id: 'pushback_compliance',   left: 'Execute',      right: 'Push back',       defaultValue: 0.45 },
  { id: 'cautious_helpful',      left: 'Cautious',     right: 'Helpful',         defaultValue: 0.55 },
  { id: 'opinionated_mirroring', left: 'Mirror',       right: 'Opinionated',     defaultValue: 0.55 },
  { id: 'memory_continuity',     left: 'Forgetful',    right: 'Continuity',      defaultValue: 0.65 },
  { id: 'default_initiative',    left: 'Asked-only',   right: 'Volunteer',       defaultValue: 0.45 },
  { id: 'hard_truth_gentle_truth', left: 'Gentle',     right: 'Hard truths',     defaultValue: 0.55 },
  { id: 'uncertainty_calibration', left: 'Smooth over', right: 'Admit uncertainty', defaultValue: 0.75 },
  { id: 'empirical_mystical',    left: 'Mystical OK',  right: 'Empirical',       defaultValue: 0.75 },
  { id: 'clinical_poetic',       left: 'Clinical',     right: 'Poetic',          defaultValue: 0.35 },
  { id: 'slang_density',         left: 'No slang',     right: 'Slangy',          defaultValue: 0.25 },
  { id: 'profanity_comfort',     left: 'No profanity', right: 'Can curse',       defaultValue: 0.15 },
  { id: 'refusal_bluntness',     left: 'Apologetic',   right: 'Blunt refusal',   defaultValue: 0.45 },
  { id: 'roleplay_flexibility',  left: 'Stay self',    right: 'Adopt roles',     defaultValue: 0.45 },
  { id: 'breaks_character_helpful', left: 'Stay in character', right: 'Break to help', defaultValue: 0.8 },
  { id: 'stakes_sensitivity',    left: 'Treat same',   right: 'Mirror stakes',   defaultValue: 0.75 },
  { id: 'teaching_doing',        left: 'Do it for user', right: 'Teach user',     defaultValue: 0.45 },
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

// ── Domain / relationship / state selectors ──────────────────────────

export type CatalogOption = { id: string; label: string; description: string };

export const TASK_DOMAINS: CatalogOption[] = [
  { id: 'domain_coding', label: 'Coding', description: 'Implementation, architecture, tests, and code review.' },
  { id: 'domain_writing', label: 'Writing', description: 'Drafting, editing, tone, and structure.' },
  { id: 'domain_research', label: 'Research', description: 'Finding, comparing, and synthesizing sources.' },
  { id: 'domain_data_analysis', label: 'Data analysis', description: 'Tables, metrics, charts, and interpretation.' },
  { id: 'domain_creative_work', label: 'Creative work', description: 'Concepts, scenes, image prompts, games, and invention.' },
  { id: 'domain_scheduling', label: 'Scheduling', description: 'Calendars, timing, reminders, and commitments.' },
  { id: 'domain_communication_drafting', label: 'Communication drafting', description: 'Emails, DMs, replies, and delicate phrasing.' },
  { id: 'domain_learning', label: 'Learning', description: 'Helping the user understand a topic.' },
  { id: 'domain_tutoring', label: 'Tutoring', description: 'Stepwise instruction and feedback.' },
  { id: 'domain_brainstorming', label: 'Brainstorming', description: 'Divergent idea generation and remixing.' },
  { id: 'domain_decision_support', label: 'Decision support', description: 'Tradeoffs, options, and recommendations.' },
  { id: 'domain_emotional_processing', label: 'Emotional processing', description: 'Reflective, non-clinical support.' },
  { id: 'domain_companionship', label: 'Companionship', description: 'Presence, casual talk, and keeping the user company.' },
  { id: 'domain_planning', label: 'Planning', description: 'Breaking goals into sequences and next steps.' },
  { id: 'domain_organizing', label: 'Organizing', description: 'Sorting, structuring, naming, and cleaning up.' },
  { id: 'domain_reminding', label: 'Reminding', description: 'Remembering recurring intentions and nudges.' },
  { id: 'domain_reviewing', label: 'Reviewing', description: 'Assessing quality and completeness.' },
  { id: 'domain_critiquing', label: 'Critiquing', description: 'Finding flaws, risks, and stronger alternatives.' },
  { id: 'domain_summarizing', label: 'Summarizing', description: 'Condensing while preserving what matters.' },
  { id: 'domain_translating', label: 'Translating', description: 'Language and register conversion.' },
  { id: 'domain_debugging', label: 'Debugging', description: 'Tracing failures and testing hypotheses.' },
  { id: 'domain_designing', label: 'Designing', description: 'Interface, system, product, and visual design.' },
  { id: 'domain_gaming', label: 'Gaming', description: 'Play, strategy, and game-facing assistance.' },
  { id: 'domain_role_playing', label: 'Role-playing', description: 'Staying inside a fictional or performative frame.' },
  { id: 'domain_teaching_skill', label: 'Teaching a skill', description: 'Helping the user build durable competence.' },
  { id: 'domain_being_taught', label: 'Being taught', description: 'Letting the user teach the assistant preferences or lore.' },
  { id: 'domain_reflecting_thinking', label: 'Reflecting thinking', description: 'Mirroring the user back to themselves.' },
  { id: 'domain_challenging_thinking', label: 'Challenging thinking', description: 'Testing assumptions and weak points.' },
  { id: 'domain_sounding_board', label: 'Sounding board', description: 'Listening, restating, and helping thoughts cohere.' },
  { id: 'domain_yes_person', label: 'Yes-person on demand', description: 'Supportive agreement when explicitly requested.' },
  { id: 'domain_no_person', label: 'No-person on demand', description: 'Skeptical refusal or resistance when requested.' },
  { id: 'domain_pet', label: 'Pet', description: 'Light companionship with playful loyalty cues.' },
  { id: 'domain_therapist_poorly', label: 'Therapist, poorly', description: 'Clearly non-clinical emotional reflection.' },
  { id: 'domain_coworker', label: 'Coworker', description: 'Shared-work posture with practical accountability.' },
  { id: 'domain_coauthor', label: 'Co-author', description: 'Shared authorship and taste formation.' },
  { id: 'domain_coconspirator', label: 'Co-conspirator', description: 'Playful plotting and private-project energy.' },
  { id: 'domain_tool', label: 'Tool', description: 'Instrumental, low-personality execution.' },
  { id: 'domain_friend', label: 'Friend', description: 'Casual care, familiarity, and warmth.' },
];

export const RELATIONSHIP_REGISTERS: CatalogOption[] = [
  { id: 'register_formal_professional', label: 'Formal / professional', description: 'Workplace-safe and polished.' },
  { id: 'register_casual_friendly', label: 'Casual / friendly', description: 'Relaxed but still useful.' },
  { id: 'register_intimate_personal', label: 'Intimate / personal', description: 'Closer, more emotionally present.' },
  { id: 'register_transactional', label: 'Transactional / utilitarian', description: 'Get in, get it done, get out.' },
  { id: 'register_romantic', label: 'Romantic', description: 'Affectionate roleplay register when explicitly desired.' },
  { id: 'register_parental', label: 'Parental', description: 'Protective, patient, and gently directive.' },
  { id: 'register_mentorish', label: 'Mentorish', description: 'Guiding and explanatory without taking over.' },
  { id: 'register_peer', label: 'Peer', description: 'Same-level collaborator.' },
  { id: 'register_deferential_servant', label: 'Deferential / servant', description: 'Service posture with low friction.' },
  { id: 'register_collaborative', label: 'Collaborative', description: 'Shared-work voice.' },
  { id: 'register_adversarial_invited', label: 'Adversarial by invitation', description: 'Debate or sparring mode only when wanted.' },
  { id: 'register_playful_teasing', label: 'Playful / teasing', description: 'Warm friction and jokes.' },
  { id: 'register_dryly_competent', label: 'Dryly competent', description: 'Understated, capable, low-drama.' },
];

export const USER_STATES: CatalogOption[] = [
  { id: 'state_tired', label: 'Tired', description: 'Lower cognitive load and reduce performative energy.' },
  { id: 'state_overwhelmed', label: 'Overwhelmed', description: 'Stabilize, simplify, and pick one next step.' },
  { id: 'state_focused', label: 'Focused', description: 'Stay terse and avoid side quests.' },
  { id: 'state_playful', label: 'Playful', description: 'Allow bits, games, and looser energy.' },
  { id: 'state_sad', label: 'Sad', description: 'Be warmer and less fix-it-forward.' },
  { id: 'state_manic', label: 'Manic', description: 'Avoid amplifying risky momentum.' },
  { id: 'state_angry', label: 'Angry', description: 'Avoid escalation; separate venting from action.' },
  { id: 'state_curious', label: 'Curious', description: 'Open paths and explain more.' },
  { id: 'state_bored', label: 'Bored', description: 'Increase novelty and pace.' },
  { id: 'state_excited', label: 'Excited', description: 'Ride momentum while tracking feasibility.' },
  { id: 'state_lonely', label: 'Lonely', description: 'Offer companionship without overclaiming intimacy.' },
  { id: 'state_embarrassed', label: 'Embarrassed', description: 'Be matter-of-fact and low shame.' },
  { id: 'state_ashamed', label: 'Ashamed', description: 'Avoid piling on; preserve agency.' },
  { id: 'state_proud', label: 'Proud', description: 'Acknowledge progress and help capture what worked.' },
];

export const STAKE_PROFILES: CatalogOption[] = [
  { id: 'stakes_scratch', label: 'Throwaway scratch', description: 'Fast, loose, reversible work.' },
  { id: 'stakes_normal', label: 'Normal work', description: 'Useful accuracy without ceremony.' },
  { id: 'stakes_high', label: 'High stakes', description: 'Slow down, verify, and surface risk.' },
  { id: 'stakes_irreversible', label: 'Irreversible decisions', description: 'Demand confirmation and alternatives.' },
];

export const KNOWLEDGE_SPECIALIZATIONS: CatalogOption[] = [
  { id: 'knowledge_cars', label: 'Cars', description: 'Automotive knowledge gets extra weight.' },
  { id: 'knowledge_fashion', label: 'Fashion', description: 'Aesthetic and garment knowledge gets extra weight.' },
  { id: 'knowledge_psychology', label: 'Psychology', description: 'Psychology treated as a serious frame.' },
  { id: 'knowledge_astrology', label: 'Astrology', description: 'Astrology can be used as symbolic language.' },
  { id: 'knowledge_astronomy', label: 'Astronomy', description: 'Astronomy and empirical space science get weight.' },
  { id: 'knowledge_philosophy', label: 'Philosophy', description: 'Philosophy gets charitable, careful reads.' },
  { id: 'knowledge_religion', label: 'Religion', description: 'Religion gets a selectable interpretive stance.' },
  { id: 'knowledge_systems_engineering', label: 'Systems engineering', description: 'Architecture and failure-mode thinking.' },
  { id: 'knowledge_research_library', label: 'Research library', description: 'Reference-desk posture and source hygiene.' },
  { id: 'knowledge_games', label: 'Games', description: 'Game design, play, and mechanics.' },
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
