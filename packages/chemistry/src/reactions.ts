import { parseFormula } from './utils';
import type { Reaction, ReactionSide } from './types';

// -- Equation parsing ---------------------------------------------------------

function parseSide(side: string): ReactionSide[] {
  return side.split('+').map(term => {
    term = term.trim();
    const match = term.match(/^(\d+)?\s*(.+)$/);
    if (!match) return { coefficient: 1, formula: term };
    return {
      coefficient: match[1] ? parseInt(match[1], 10) : 1,
      formula: match[2].trim(),
    };
  });
}

function parseEquation(equation: string): { reactants: ReactionSide[]; products: ReactionSide[] } | null {
  // Support various arrow styles
  const normalized = equation.replace(/→|=>|-->|->|=/, '→');
  const parts = normalized.split('→');
  if (parts.length !== 2) return null;
  return {
    reactants: parseSide(parts[0]),
    products: parseSide(parts[1]),
  };
}

// -- Equation balancing -------------------------------------------------------

function getAtomCounts(sides: ReactionSide[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sides) {
    const atoms = parseFormula(s.formula);
    for (const a of atoms) {
      counts.set(a.symbol, (counts.get(a.symbol) ?? 0) + a.count * s.coefficient);
    }
  }
  return counts;
}

function countsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    if (b.get(k) !== v) return false;
  }
  return true;
}

function tryBalance(reactants: ReactionSide[], products: ReactionSide[], maxCoeff: number = 10): { reactants: ReactionSide[]; products: ReactionSide[] } | null {
  const all = [...reactants, ...products];
  const n = all.length;
  const maxes = new Array(n).fill(maxCoeff);
  const coeffs = new Array(n).fill(1);

  // Brute force small coefficient search (works for most simple equations)
  function search(idx: number): boolean {
    if (idx === n) {
      const r = reactants.map((s, i) => ({ ...s, coefficient: coeffs[i] }));
      const p = products.map((s, i) => ({ ...s, coefficient: coeffs[reactants.length + i] }));
      return countsEqual(getAtomCounts(r), getAtomCounts(p));
    }
    for (let c = 1; c <= maxes[idx]; c++) {
      coeffs[idx] = c;
      if (search(idx + 1)) return true;
    }
    return false;
  }

  if (search(0)) {
    return {
      reactants: reactants.map((s, i) => ({ ...s, coefficient: coeffs[i] })),
      products: products.map((s, i) => ({ ...s, coefficient: coeffs[reactants.length + i] })),
    };
  }
  return null;
}

export function balanceEquation(equation: string): Reaction {
  const parsed = parseEquation(equation);
  if (!parsed) {
    return { equation, balanced: equation, reactants: [], products: [], isBalanced: false };
  }

  // Check if already balanced
  const lhs = getAtomCounts(parsed.reactants);
  const rhs = getAtomCounts(parsed.products);
  const alreadyBalanced = countsEqual(lhs, rhs);

  if (alreadyBalanced) {
    const balanced = formatEquation(parsed.reactants, parsed.products);
    return {
      equation,
      balanced,
      reactants: parsed.reactants,
      products: parsed.products,
      type: classifyReaction(parsed.reactants, parsed.products),
      isBalanced: true,
    };
  }

  // Try to balance
  const result = tryBalance(parsed.reactants, parsed.products);
  if (result) {
    const balanced = formatEquation(result.reactants, result.products);
    return {
      equation,
      balanced,
      reactants: result.reactants,
      products: result.products,
      type: classifyReaction(result.reactants, result.products),
      isBalanced: true,
    };
  }

  return {
    equation,
    balanced: equation,
    reactants: parsed.reactants,
    products: parsed.products,
    isBalanced: false,
  };
}

function formatEquation(reactants: ReactionSide[], products: ReactionSide[]): string {
  const fmtSide = (sides: ReactionSide[]) =>
    sides.map(s => (s.coefficient > 1 ? `${s.coefficient}` : '') + s.formula).join(' + ');
  return `${fmtSide(reactants)} -> ${fmtSide(products)}`;
}

// -- Reaction classification --------------------------------------------------

function classifyReaction(reactants: ReactionSide[], products: ReactionSide[]): Reaction['type'] {
  const rCount = reactants.length;
  const pCount = products.length;

  // Combustion: anything + O2 -> CO2 + H2O
  const hasO2 = reactants.some(r => r.formula === 'O2');
  const hasCO2 = products.some(p => p.formula === 'CO2');
  const hasH2O = products.some(p => p.formula === 'H2O');
  if (hasO2 && hasCO2 && hasH2O) return 'combustion';

  // Synthesis: A + B -> AB
  if (rCount >= 2 && pCount === 1) return 'synthesis';

  // Decomposition: AB -> A + B
  if (rCount === 1 && pCount >= 2) return 'decomposition';

  // Single replacement: A + BC -> AC + B
  if (rCount === 2 && pCount === 2) {
    const r1atoms = parseFormula(reactants[0].formula);
    const r2atoms = parseFormula(reactants[1].formula);
    if (r1atoms.length === 1 || r2atoms.length === 1) return 'single-replacement';
    return 'double-replacement';
  }

  return undefined;
}

// -- Enthalpy data (common reactions, kJ/mol) ---------------------------------

const ENTHALPIES: Record<string, number> = {
  '2H2 + O2 -> 2H2O': -571.6,
  'C + O2 -> CO2': -393.5,
  'CH4 + 2O2 -> CO2 + 2H2O': -890.4,
  'N2 + 3H2 -> 2NH3': -92.2,
  'C3H8 + 5O2 -> 3CO2 + 4H2O': -2220,
  '2C2H6 + 7O2 -> 4CO2 + 6H2O': -3120,
  'CaCO3 -> CaO + CO2': 178.1,
  '2H2O -> 2H2 + O2': 571.6,
  'Fe2O3 + 3CO -> 2Fe + 3CO2': -24.8,
  '2Na + Cl2 -> 2NaCl': -822.2,
  'C6H12O6 + 6O2 -> 6CO2 + 6H2O': -2803,
};

export function getEnthalpy(balanced: string): number | undefined {
  return ENTHALPIES[balanced];
}
