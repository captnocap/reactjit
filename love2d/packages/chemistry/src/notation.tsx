/**
 * Chemistry notation components — proper typesetting via mhchem (\ce{}) and
 * chemfig (\chemfig{}) in the ReactJIT LaTeX renderer.
 *
 * All rendering is Lua-owned (latex_parser.lua + latex_layout.lua).
 * These are one-liner wrappers; the string conversion is the whole job.
 */

import React from 'react';
import { Math } from '@reactjit/core';
import type { Style } from '@reactjit/core';

// -- ChemFormula ---------------------------------------------------------------

export interface ChemFormulaProps {
  /** Chemical formula using standard notation: H2O, H2SO4, Ca(OH)2, SO4^{2-} */
  formula: string;
  fontSize?: number;
  color?: string;
  style?: Style;
}

/**
 * Renders a chemical formula with proper subscript/superscript notation.
 *
 *   <ChemFormula formula="H2SO4" />
 *   <ChemFormula formula="SO4^{2-}" />
 *   <ChemFormula formula="Ca(OH)2" />
 */
export function ChemFormula({ formula, fontSize = 16, color, style }: ChemFormulaProps) {
  return <Math tex={`\\ce{${formula}}`} fontSize={fontSize} color={color} style={style} />;
}

// -- ChemEquation --------------------------------------------------------------

export interface ChemEquationProps {
  /**
   * Full chemical equation string.
   * Use -> for reaction, <=> for equilibrium, <-> for reversible.
   * Examples:
   *   "2H2 + O2 -> 2H2O"
   *   "N2 + 3H2 <=> 2NH3"
   *   "CO2 + H2O <-> H2CO3"
   */
  equation: string;
  fontSize?: number;
  color?: string;
  style?: Style;
}

/**
 * Renders a balanced chemical equation with proper notation and arrows.
 *
 *   <ChemEquation equation="2H2 + O2 -> 2H2O" />
 *   <ChemEquation equation="N2 + 3H2 <=> 2NH3" />
 */
export function ChemEquation({ equation, fontSize = 16, color, style }: ChemEquationProps) {
  return <Math tex={`\\ce{${equation}}`} fontSize={fontSize} color={color} style={style} />;
}

// -- IsoNotation ---------------------------------------------------------------

export interface IsoNotationProps {
  /** Element symbol, e.g. "U", "C", "Fe" */
  symbol: string;
  /** Mass number (top-left) */
  mass: number;
  /** Atomic number (bottom-left, optional) */
  atomic?: number;
  fontSize?: number;
  color?: string;
  style?: Style;
}

/**
 * Renders standard nuclear isotope notation.
 *
 *   <IsoNotation symbol="U" mass={235} atomic={92} />   →  ²³⁵₉₂U
 *   <IsoNotation symbol="C" mass={14} />                →  ¹⁴C
 */
export function IsoNotation({ symbol, mass, atomic, fontSize = 16, color, style }: IsoNotationProps) {
  const tex = atomic !== undefined
    ? `{}^{${mass}}_{${atomic}}\\text{${symbol}}`
    : `{}^{${mass}}\\text{${symbol}}`;
  return <Math tex={tex} fontSize={fontSize} color={color} style={style} />;
}

// -- ChemFig -------------------------------------------------------------------

export interface ChemFigProps {
  /**
   * Linear structural formula using chemfig-style bond notation.
   * Use - for single bond, = for double bond, # for triple bond.
   * Examples:
   *   "H-O-H"        water
   *   "H-C(=O)-OH"   formic acid (simplified)
   *   "H-C#N"        hydrogen cyanide
   *   "C2H5-OH"      ethanol
   */
  formula: string;
  fontSize?: number;
  color?: string;
  style?: Style;
}

/**
 * Renders a linear structural formula with bond symbols.
 * Single (-), double (═), triple (≡) bonds with element subscripts.
 *
 *   <ChemFig formula="H-O-H" />
 *   <ChemFig formula="H-C#N" />
 */
export function ChemFig({ formula, fontSize = 16, color, style }: ChemFigProps) {
  return <Math tex={`\\chemfig{${formula}}`} fontSize={fontSize} color={color} style={style} />;
}
