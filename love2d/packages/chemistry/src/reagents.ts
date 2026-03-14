import { useLoveRPC } from '@reactjit/core';
import type { Style } from '@reactjit/core';

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

export interface ReagentInfo {
  name: string;
  formula: string;
  color: string;
  description: string;
}

/** Static display data — name, formula, color, description. No compute. */
export const REAGENT_INFO: Record<ReagentType, ReagentInfo> = {
  marquis: { name: 'Marquis', formula: 'H2SO4 + HCHO', color: '#8B4513', description: 'Formaldehyde + sulfuric acid. Primary test for alkaloids and phenethylamines.' },
  mecke: { name: 'Mecke', formula: 'H2SeO3 + H2SO4', color: '#556B2F', description: 'Selenious acid + sulfuric acid. Distinguishes between opioids and phenethylamines.' },
  mandelin: { name: 'Mandelin', formula: 'NH4VO3 + H2SO4', color: '#B8860B', description: 'Ammonium vanadate + sulfuric acid. Broad spectrum alkaloid detection.' },
  simons: { name: "Simon's", formula: 'NaHCO3 + Na2[Fe(CN)5NO] + CH3CHO', color: '#4682B4', description: 'Sodium nitroprusside + acetaldehyde. Detects secondary amines.' },
  ehrlich: { name: 'Ehrlich', formula: 'DMAB + HCl', color: '#DAA520', description: 'p-Dimethylaminobenzaldehyde + HCl. Detects indole-containing compounds.' },
  liebermann: { name: 'Liebermann', formula: 'NaNO2 + H2SO4', color: '#2F4F4F', description: 'Sodium nitrite + sulfuric acid. Detects phenols and aromatic amines.' },
  froehde: { name: 'Froehde', formula: 'Na2MoO4 + H2SO4', color: '#696969', description: 'Sodium molybdate + sulfuric acid. Alkaloid differentiation.' },
  'gallic-acid': { name: 'Gallic Acid', formula: 'C7H6O5 + H2SO4', color: '#8B0000', description: 'Gallic acid + sulfuric acid. Tests for alkaloids and glycosides.' },
};

/** All reagent compute runs in Lua via chemistry:* RPCs. */
export const useReagentTest = () => useLoveRPC<ReagentResult>('chemistry:reagentTest');
export const useReagentTestMulti = () => useLoveRPC<MultiReagentResult>('chemistry:reagentTestMulti');
export const useReagentInfo = () => useLoveRPC<Record<ReagentType, ReagentInfo> | ReagentInfo>('chemistry:reagentInfo');
export const useAvailableCompounds = () => useLoveRPC<string[]>('chemistry:availableCompounds');
