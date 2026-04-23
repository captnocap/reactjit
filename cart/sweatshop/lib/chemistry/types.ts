import type { Style, LoveEvent } from '@reactjit/core';

// -- Element ------------------------------------------------------------------

export type ElementCategory =
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide';

export type Phase = 'solid' | 'liquid' | 'gas' | 'unknown';

export interface Element {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  category: ElementCategory;
  group: number;
  period: number;
  phase: Phase;
  electronegativity: number | null;
  electronConfig: string;
  shells: number[];
  cpkColor: string;
  meltingPoint: number | null;
  boilingPoint: number | null;
  density: number | null;
  firstIonization?: number | null;
  isotopeCount?: number | null;
  discoverer?: string | null;
  yearDiscovered?: number | null;
}

// -- Bond ---------------------------------------------------------------------

export type BondType = 'single' | 'double' | 'triple' | 'ionic' | 'metallic' | 'hydrogen';

export interface Bond {
  from: number;
  to: number;
  type: BondType;
  order: number;
  length?: number;
  energy?: number;
}

// -- Molecule -----------------------------------------------------------------

export interface AtomCount {
  symbol: string;
  count: number;
  number: number;
}

export type MolecularGeometry =
  | 'linear'
  | 'bent'
  | 'trigonal-planar'
  | 'trigonal-pyramidal'
  | 'tetrahedral'
  | 'trigonal-bipyramidal'
  | 'octahedral'
  | 'see-saw'
  | 'square-planar'
  | 'square-pyramidal'
  | 't-shaped';

export interface Molecule {
  formula: string;
  name?: string;
  atoms: AtomCount[];
  bonds: Bond[];
  molarMass: number;
  geometry?: MolecularGeometry;
  polarity?: 'polar' | 'nonpolar';
  iupac?: string;
}

// -- Reaction -----------------------------------------------------------------

export interface ReactionSide {
  coefficient: number;
  formula: string;
}

export interface Reaction {
  equation: string;
  balanced: string;
  reactants: ReactionSide[];
  products: ReactionSide[];
  enthalpy?: number;
  type?: 'synthesis' | 'decomposition' | 'single-replacement' | 'double-replacement' | 'combustion' | 'acid-base' | 'redox';
  isBalanced: boolean;
}

// -- Equilibrium --------------------------------------------------------------

export interface EquilibriumState {
  kEq: number;
  direction: 'forward' | 'reverse' | 'equilibrium';
  shift?: 'left' | 'right' | 'none';
  temperature: number;
  pressure: number;
}

// -- Widget Props -------------------------------------------------------------

export interface PeriodicTableProps {
  onSelect?: (element: Element) => void;
  selected?: number | null;
  tileSize?: number;
  style?: Style;
}

export interface ElementTileProps {
  element: number | string;
  selected?: boolean;
  flipped?: boolean;
  size?: number;
  style?: Style;
  onPress?: (element: Element) => void;
}

export interface ElementDetailProps {
  element: number | string;
  style?: Style;
}

export interface ElementCardProps {
  element: number | string;
  style?: Style;
}

export interface MoleculeCardProps {
  formula: string;
  showBonds?: boolean;
  style?: Style;
}

export interface ElectronShellProps {
  element: number | string;
  animated?: boolean;
  style?: Style;
}

export interface ReactionViewProps {
  equation: string;
  animated?: boolean;
  showEnergy?: boolean;
  style?: Style;
}
