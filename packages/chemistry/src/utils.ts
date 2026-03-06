import { getElement, ELEMENTS } from './elements';
import type { AtomCount } from './types';

// -- Formula parsing ----------------------------------------------------------

const FORMULA_RE = /([A-Z][a-z]?)(\d*)/g;

export function parseFormula(formula: string): AtomCount[] {
  const counts: AtomCount[] = [];
  const seen = new Map<string, AtomCount>();

  let match: RegExpExecArray | null;
  FORMULA_RE.lastIndex = 0;
  while ((match = FORMULA_RE.exec(formula)) !== null) {
    const symbol = match[1];
    const count = match[2] ? parseInt(match[2], 10) : 1;
    if (!symbol) continue;
    const el = getElement(symbol);
    if (!el) continue;

    const existing = seen.get(symbol);
    if (existing) {
      existing.count += count;
    } else {
      const entry: AtomCount = { symbol, count, number: el.number };
      seen.set(symbol, entry);
      counts.push(entry);
    }
  }
  return counts;
}

// -- Molar mass ---------------------------------------------------------------

export function molarMass(formula: string): number {
  const atoms = parseFormula(formula);
  let mass = 0;
  for (const a of atoms) {
    const el = getElement(a.symbol);
    if (el) mass += el.mass * a.count;
  }
  return Math.round(mass * 1000) / 1000;
}

// -- Atom count ---------------------------------------------------------------

export function atomCount(formula: string): number {
  return parseFormula(formula).reduce((sum, a) => sum + a.count, 0);
}

// -- Composition by mass ------------------------------------------------------

export function massComposition(formula: string): Record<string, number> {
  const atoms = parseFormula(formula);
  const total = molarMass(formula);
  if (total === 0) return {};
  const result: Record<string, number> = {};
  for (const a of atoms) {
    const el = getElement(a.symbol);
    if (el) result[a.symbol] = Math.round((el.mass * a.count / total) * 10000) / 100;
  }
  return result;
}

// -- Electron configuration ---------------------------------------------------

export function electronConfig(atomicNumber: number): string {
  const el = getElement(atomicNumber);
  return el?.electronConfig ?? '';
}

export function valenceElectrons(atomicNumber: number): number {
  const el = getElement(atomicNumber);
  if (!el) return 0;
  const shells = el.shells;
  return shells[shells.length - 1];
}

// -- Electronegativity difference ---------------------------------------------

export function electronegativityDiff(symbol1: string, symbol2: string): number | null {
  const e1 = getElement(symbol1);
  const e2 = getElement(symbol2);
  if (!e1?.electronegativity || !e2?.electronegativity) return null;
  return Math.abs(e1.electronegativity - e2.electronegativity);
}

export function bondCharacter(symbol1: string, symbol2: string): 'nonpolar-covalent' | 'polar-covalent' | 'ionic' | null {
  const diff = electronegativityDiff(symbol1, symbol2);
  if (diff === null) return null;
  if (diff < 0.5) return 'nonpolar-covalent';
  if (diff < 1.7) return 'polar-covalent';
  return 'ionic';
}

// -- Oxidation states (common) ------------------------------------------------

const COMMON_OXIDATION: Record<string, number[]> = {
  H: [1, -1], He: [0],
  Li: [1], Be: [2], B: [3], C: [-4, -3, -2, -1, 0, 1, 2, 3, 4], N: [-3, -2, -1, 0, 1, 2, 3, 4, 5], O: [-2, -1], F: [-1], Ne: [0],
  Na: [1], Mg: [2], Al: [3], Si: [-4, 4], P: [-3, 3, 5], S: [-2, 2, 4, 6], Cl: [-1, 1, 3, 5, 7], Ar: [0],
  K: [1], Ca: [2], Fe: [2, 3], Cu: [1, 2], Zn: [2], Ag: [1], Au: [1, 3], Pt: [2, 4],
  Mn: [2, 3, 4, 7], Cr: [2, 3, 6], Co: [2, 3], Ni: [2], Ti: [2, 3, 4], V: [2, 3, 4, 5],
  Sn: [2, 4], Pb: [2, 4], Hg: [1, 2], Br: [-1, 1, 3, 5], I: [-1, 1, 3, 5, 7],
};

export function oxidationStates(symbol: string): number[] {
  return COMMON_OXIDATION[symbol] ?? [];
}

// -- Isotope notation ---------------------------------------------------------

export function isotopeNotation(symbol: string, massNumber: number): string {
  const el = getElement(symbol);
  if (!el) return `${massNumber}${symbol}`;
  return `${massNumber}${el.symbol}`;
}

// -- Empirical formula --------------------------------------------------------

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function empiricalFormula(formula: string): string {
  const atoms = parseFormula(formula);
  if (atoms.length === 0) return '';
  const counts = atoms.map(a => a.count);
  const d = counts.reduce((a, b) => gcd(a, b));
  return atoms.map(a => a.symbol + (a.count / d > 1 ? a.count / d : '')).join('');
}

// -- Moles / mass / particles conversions -------------------------------------

const AVOGADRO = 6.02214076e23;
const R_GAS = 8.314; // J/(mol*K)

export function massToMoles(mass: number, formula: string): number {
  const mm = molarMass(formula);
  return mm > 0 ? mass / mm : 0;
}

export function molesToMass(moles: number, formula: string): number {
  return moles * molarMass(formula);
}

export function molesToParticles(moles: number): number {
  return moles * AVOGADRO;
}

export function particlesToMoles(particles: number): number {
  return particles / AVOGADRO;
}

export function massToParticles(mass: number, formula: string): number {
  return molesToParticles(massToMoles(mass, formula));
}

// -- Ideal gas law ------------------------------------------------------------

export function idealGasPressure(n: number, T: number, V: number): number {
  return (n * R_GAS * T) / V;
}

export function idealGasVolume(n: number, T: number, P: number): number {
  return (n * R_GAS * T) / P;
}

export function idealGasMoles(P: number, V: number, T: number): number {
  return (P * V) / (R_GAS * T);
}

// -- Molarity -----------------------------------------------------------------

export function molarity(moles: number, liters: number): number {
  return liters > 0 ? moles / liters : 0;
}

export function dilution(M1: number, V1: number, M2: number): number {
  return M2 > 0 ? (M1 * V1) / M2 : 0;
}

// -- Constants ----------------------------------------------------------------

export const CONSTANTS = {
  AVOGADRO,
  R_GAS,
  BOLTZMANN: 1.380649e-23,
  PLANCK: 6.62607015e-34,
  SPEED_OF_LIGHT: 2.99792458e8,
  ELECTRON_MASS: 9.1093837015e-31,
  PROTON_MASS: 1.67262192369e-27,
  NEUTRON_MASS: 1.67492749804e-27,
  FARADAY: 96485.33212,
  ELEMENTARY_CHARGE: 1.602176634e-19,
  ATOMIC_MASS_UNIT: 1.66053906660e-27,
} as const;
