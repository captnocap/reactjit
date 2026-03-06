import type { Style } from '@reactjit/core';

// -- Reagent Test Types -------------------------------------------------------

export type ReagentType = 'marquis' | 'mecke' | 'mandelin' | 'simons' | 'ehrlich' | 'liebermann' | 'froehde' | 'gallic-acid';

export interface ColorReaction {
  color: string;
  description: string;
  timeMs: number;
  intermediates?: string[];
}

export interface ReagentResult {
  reagent: ReagentType;
  compound: string;
  reaction: ColorReaction | null;
  confidence: number;
  functionalGroup?: string;
  mechanism?: string;
}

export interface ReagentTestProps {
  type: ReagentType;
  sample: string;
  animated?: boolean;
  showMechanism?: boolean;
  style?: Style;
}

export interface MultiReagentResult {
  results: ReagentResult[];
  identification: string | null;
  confidence: number;
  reasoning: string;
}

// -- Reagent descriptions -----------------------------------------------------

export const REAGENT_INFO: Record<ReagentType, { name: string; formula: string; color: string; description: string }> = {
  marquis: { name: 'Marquis', formula: 'H2SO4 + HCHO', color: '#8B4513', description: 'Formaldehyde + sulfuric acid. Primary test for alkaloids and phenethylamines.' },
  mecke: { name: 'Mecke', formula: 'H2SeO3 + H2SO4', color: '#556B2F', description: 'Selenious acid + sulfuric acid. Distinguishes between opioids and phenethylamines.' },
  mandelin: { name: 'Mandelin', formula: 'NH4VO3 + H2SO4', color: '#B8860B', description: 'Ammonium vanadate + sulfuric acid. Broad spectrum alkaloid detection.' },
  simons: { name: "Simon's", formula: 'NaHCO3 + Na2[Fe(CN)5NO] + CH3CHO', color: '#4682B4', description: 'Sodium nitroprusside + acetaldehyde. Detects secondary amines.' },
  ehrlich: { name: 'Ehrlich', formula: 'DMAB + HCl', color: '#DAA520', description: 'p-Dimethylaminobenzaldehyde + HCl. Detects indole-containing compounds.' },
  liebermann: { name: 'Liebermann', formula: 'NaNO2 + H2SO4', color: '#2F4F4F', description: 'Sodium nitrite + sulfuric acid. Detects phenols and aromatic amines.' },
  froehde: { name: 'Froehde', formula: 'Na2MoO4 + H2SO4', color: '#696969', description: 'Sodium molybdate + sulfuric acid. Alkaloid differentiation.' },
  'gallic-acid': { name: 'Gallic Acid', formula: 'C7H6O5 + H2SO4', color: '#8B0000', description: 'Gallic acid + sulfuric acid. Tests for alkaloids and glycosides.' },
};

// -- Color reaction databases -------------------------------------------------
// Each reagent has a lookup table: compound → color change sequence

const MARQUIS_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#1a0a2e', description: 'Deep purple to black', timeMs: 3000, intermediates: ['#f5f5dc', '#9370DB', '#4B0082', '#1a0a2e'] },
  'MDA': { color: '#1a0a2e', description: 'Black/dark purple', timeMs: 2500, intermediates: ['#f5f5dc', '#8B008B', '#2d0047', '#1a0a2e'] },
  'Amphetamine': { color: '#FF8C00', description: 'Orange to dark reddish-brown', timeMs: 4000, intermediates: ['#f5f5dc', '#FFA500', '#FF6347', '#8B4513'] },
  'Methamphetamine': { color: '#FF4500', description: 'Orange to dark orange', timeMs: 3500, intermediates: ['#f5f5dc', '#FFD700', '#FF8C00', '#FF4500'] },
  'Heroin': { color: '#800080', description: 'Purple', timeMs: 2000, intermediates: ['#f5f5dc', '#DDA0DD', '#9932CC', '#800080'] },
  'Morphine': { color: '#800080', description: 'Deep purple', timeMs: 2500, intermediates: ['#f5f5dc', '#DA70D6', '#9400D3', '#800080'] },
  'Codeine': { color: '#800080', description: 'Deep purple', timeMs: 3000, intermediates: ['#f5f5dc', '#EE82EE', '#9932CC', '#800080'] },
  'Cocaine': { color: '#f5f5dc', description: 'No reaction (remains clear)', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'LSD': { color: '#808000', description: 'Olive to black', timeMs: 5000, intermediates: ['#f5f5dc', '#BDB76B', '#808000', '#2F4F4F'] },
  'Aspirin': { color: '#FF6347', description: 'Reddish', timeMs: 2000, intermediates: ['#f5f5dc', '#FFA07A', '#FF6347'] },
  'Sugar': { color: '#f5f5dc', description: 'No significant reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'Caffeine': { color: '#f5f5dc', description: 'No significant reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
};

const MECKE_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#006400', description: 'Blue-green to dark green', timeMs: 3000, intermediates: ['#f5f5dc', '#20B2AA', '#008080', '#006400'] },
  'MDA': { color: '#006400', description: 'Green to blue-green', timeMs: 2500, intermediates: ['#f5f5dc', '#3CB371', '#2E8B57', '#006400'] },
  'Heroin': { color: '#006400', description: 'Deep blue-green', timeMs: 2000, intermediates: ['#f5f5dc', '#66CDAA', '#2E8B57', '#006400'] },
  'Morphine': { color: '#006400', description: 'Deep green', timeMs: 2500, intermediates: ['#f5f5dc', '#90EE90', '#228B22', '#006400'] },
  'Cocaine': { color: '#808000', description: 'Slow olive green', timeMs: 8000, intermediates: ['#f5f5dc', '#BDB76B', '#808000'] },
  'Amphetamine': { color: '#f5f5dc', description: 'No reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'Methamphetamine': { color: '#f5f5dc', description: 'No reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'LSD': { color: '#8B4513', description: 'Brownish-black', timeMs: 4000, intermediates: ['#f5f5dc', '#D2B48C', '#A0522D', '#8B4513'] },
};

const MANDELIN_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#1a0a2e', description: 'Black', timeMs: 2000, intermediates: ['#f5f5dc', '#696969', '#2F2F2F', '#1a0a2e'] },
  'MDA': { color: '#1a0a2e', description: 'Black to dark green', timeMs: 2500, intermediates: ['#f5f5dc', '#556B2F', '#2F4F4F', '#1a0a2e'] },
  'Amphetamine': { color: '#006400', description: 'Dark green', timeMs: 3000, intermediates: ['#f5f5dc', '#8FBC8F', '#2E8B57', '#006400'] },
  'Methamphetamine': { color: '#006400', description: 'Green', timeMs: 3500, intermediates: ['#f5f5dc', '#90EE90', '#32CD32', '#006400'] },
  'Cocaine': { color: '#FF8C00', description: 'Orange', timeMs: 2000, intermediates: ['#f5f5dc', '#FFD700', '#FF8C00'] },
  'Heroin': { color: '#808080', description: 'Brownish gray', timeMs: 3000, intermediates: ['#f5f5dc', '#D2B48C', '#808080'] },
  'Ketamine': { color: '#FF4500', description: 'Orange', timeMs: 2000, intermediates: ['#f5f5dc', '#FFA500', '#FF4500'] },
};

const SIMONS_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#00008B', description: 'Blue (secondary amine)', timeMs: 1500, intermediates: ['#f5f5dc', '#87CEEB', '#4169E1', '#00008B'] },
  'Methamphetamine': { color: '#00008B', description: 'Blue (secondary amine)', timeMs: 1500, intermediates: ['#f5f5dc', '#87CEEB', '#4169E1', '#00008B'] },
  'MDA': { color: '#f5f5dc', description: 'No reaction (primary amine)', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'Amphetamine': { color: '#f5f5dc', description: 'No reaction (primary amine)', timeMs: 1000, intermediates: ['#f5f5dc'] },
};

const EHRLICH_REACTIONS: Record<string, ColorReaction> = {
  'LSD': { color: '#800080', description: 'Purple (indole ring)', timeMs: 5000, intermediates: ['#f5f5dc', '#DDA0DD', '#BA55D3', '#800080'] },
  'Psilocybin': { color: '#800080', description: 'Purple (indole ring)', timeMs: 8000, intermediates: ['#f5f5dc', '#EE82EE', '#9932CC', '#800080'] },
  'DMT': { color: '#800080', description: 'Purple to pink-purple', timeMs: 3000, intermediates: ['#f5f5dc', '#FF69B4', '#C71585', '#800080'] },
  'Tryptophan': { color: '#DDA0DD', description: 'Light purple (indole)', timeMs: 6000, intermediates: ['#f5f5dc', '#E6E6FA', '#DDA0DD'] },
  'MDMA': { color: '#f5f5dc', description: 'No reaction (no indole ring)', timeMs: 1000, intermediates: ['#f5f5dc'] },
  'Cocaine': { color: '#f5f5dc', description: 'No reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
};

const LIEBERMANN_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#1a0a2e', description: 'Black', timeMs: 2000, intermediates: ['#f5f5dc', '#696969', '#1a0a2e'] },
  'MDA': { color: '#1a0a2e', description: 'Black', timeMs: 2000, intermediates: ['#f5f5dc', '#696969', '#1a0a2e'] },
  'Cocaine': { color: '#FFD700', description: 'Yellow to orange', timeMs: 3000, intermediates: ['#f5f5dc', '#FFFACD', '#FFD700'] },
  'Morphine': { color: '#1a0a2e', description: 'Black', timeMs: 2500, intermediates: ['#f5f5dc', '#556B2F', '#1a0a2e'] },
};

const FROEHDE_REACTIONS: Record<string, ColorReaction> = {
  'MDMA': { color: '#1a0a2e', description: 'Purple to black', timeMs: 3000, intermediates: ['#f5f5dc', '#9370DB', '#4B0082', '#1a0a2e'] },
  'Heroin': { color: '#006400', description: 'Green to blue-green', timeMs: 2500, intermediates: ['#f5f5dc', '#3CB371', '#008080', '#006400'] },
  'Morphine': { color: '#800080', description: 'Purple', timeMs: 2000, intermediates: ['#f5f5dc', '#DDA0DD', '#800080'] },
  'Codeine': { color: '#006400', description: 'Green', timeMs: 3000, intermediates: ['#f5f5dc', '#90EE90', '#006400'] },
  'Cocaine': { color: '#f5f5dc', description: 'No reaction', timeMs: 1000, intermediates: ['#f5f5dc'] },
};

const REAGENT_DATABASES: Record<ReagentType, Record<string, ColorReaction>> = {
  marquis: MARQUIS_REACTIONS,
  mecke: MECKE_REACTIONS,
  mandelin: MANDELIN_REACTIONS,
  simons: SIMONS_REACTIONS,
  ehrlich: EHRLICH_REACTIONS,
  liebermann: LIEBERMANN_REACTIONS,
  froehde: FROEHDE_REACTIONS,
  'gallic-acid': {},
};

// -- Functional group explanations --------------------------------------------

const MECHANISMS: Record<string, Record<string, string>> = {
  marquis: {
    'MDMA': 'Formaldehyde attacks the methylenedioxy ring via electrophilic aromatic substitution. The electron-rich aromatic system donates electrons to the aldehyde, forming a carbocation intermediate that absorbs in the visible spectrum (purple). The 3,4-methylenedioxy group is the chromophore.',
    'Amphetamine': 'The primary amine undergoes condensation with formaldehyde forming a Schiff base. Sulfuric acid catalyzes further oxidation, producing orange quinone-like chromophores.',
    'Heroin': 'The phenolic hydroxyl group (exposed after ester hydrolysis by H2SO4) reacts with formaldehyde. The resulting conjugated system absorbs yellow-green light, appearing purple.',
    'Cocaine': 'No reactive functional groups accessible to formaldehyde under these conditions. The tropane nitrogen is tertiary and sterically hindered; the benzoyl ester is stable in concentrated H2SO4.',
  },
  ehrlich: {
    'LSD': 'DMAB attacks position 2 of the indole ring via electrophilic substitution. The resulting azomethine dye has extended conjugation spanning the indole + DMAB systems, absorbing in the yellow-green range (appearing purple). This is specific to the indole NH.',
    'Psilocybin': 'Same indole ring mechanism as LSD. The 4-phosphoryloxy group does not interfere with position 2 substitution. Slower reaction due to the electron-withdrawing phosphate.',
    'DMT': 'Fastest Ehrlich reaction — unsubstituted indole with electron-donating dimethylamine. DMAB attacks C-2 readily.',
  },
  simons: {
    'MDMA': 'Sodium nitroprusside forms a colored complex specifically with secondary amines. The nitrogen lone pair coordinates to iron in the [Fe(CN)5NO]2- complex. MDMA has a secondary amine (N-methyl); MDA has a primary amine and does not react.',
    'Methamphetamine': 'Same mechanism — secondary amine (N-methyl) coordinates to the nitroprusside iron center.',
    'MDA': 'Primary amines do not form the colored nitroprusside complex. This is the key distinction: Marquis alone cannot distinguish MDA from MDMA; adding Simon\'s resolves the ambiguity.',
  },
};

// -- Core functions -----------------------------------------------------------

export function runReagentTest(reagent: ReagentType, compound: string): ReagentResult {
  const db = REAGENT_DATABASES[reagent];
  const reaction = db?.[compound] ?? null;
  const mechanism = MECHANISMS[reagent]?.[compound];

  return {
    reagent,
    compound,
    reaction,
    confidence: reaction ? (reaction.color === '#f5f5dc' ? 0 : 0.65) : 0,
    functionalGroup: mechanism ? extractFunctionalGroup(mechanism) : undefined,
    mechanism,
  };
}

export function runMultiReagentTest(reagents: ReagentType[], compound: string): MultiReagentResult {
  const results = reagents.map(r => runReagentTest(r, compound));
  const reacting = results.filter(r => r.reaction && r.reaction.color !== '#f5f5dc');
  const confidence = Math.min(1, reacting.length * 0.3 + (reacting.length >= 3 ? 0.15 : 0));

  let identification: string | null = null;
  let reasoning = '';

  if (reacting.length === 0) {
    reasoning = 'No color change observed with any reagent. Compound is either inert to these tests or not in the database.';
  } else if (reacting.length === 1) {
    identification = compound;
    reasoning = `Single reagent match (${REAGENT_INFO[reacting[0].reagent].name}). Presumptive identification only — additional tests recommended.`;
  } else if (reacting.length >= 2) {
    identification = compound;
    const names = reacting.map(r => REAGENT_INFO[r.reagent].name).join(', ');
    reasoning = `Corroborated by ${reacting.length} reagents (${names}). ${confidence >= 0.8 ? 'High' : 'Moderate'} confidence identification.`;
  }

  return { results, identification, confidence, reasoning };
}

export function getAvailableCompounds(reagent: ReagentType): string[] {
  return Object.keys(REAGENT_DATABASES[reagent] ?? {});
}

export function getAllTestedCompounds(): string[] {
  const compounds = new Set<string>();
  for (const db of Object.values(REAGENT_DATABASES)) {
    for (const key of Object.keys(db)) compounds.add(key);
  }
  return [...compounds].sort();
}

function extractFunctionalGroup(mechanism: string): string | undefined {
  const groups = ['indole', 'methylenedioxy', 'phenol', 'primary amine', 'secondary amine', 'tertiary amine', 'hydroxyl', 'ester', 'tropane'];
  for (const g of groups) {
    if (mechanism.toLowerCase().includes(g)) return g;
  }
  return undefined;
}
