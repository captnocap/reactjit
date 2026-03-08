// @reactjit/chemistry — Periodic table, molecules, reactions, reagent tests,
// spectrometry, phase diagrams, PubChem API, and unit conversions.
//
// Pure data + hooks for static chemistry.
// Lua capabilities (60fps painters) for all visual components.
// PubChem REST API for live compound lookups.

// -- Types --------------------------------------------------------------------
export type {
  Element, ElementCategory, Phase,
  Bond, BondType,
  AtomCount, Molecule, MolecularGeometry,
  Reaction, ReactionSide,
  EquilibriumState,
  PeriodicTableProps, ElementTileProps, ElementCardProps, ElementDetailProps, MoleculeCardProps,
  ElectronShellProps, ReactionViewProps,
} from './types';

// -- Element data (118 elements) — sync lookup for render, filtered queries via RPC
export { ELEMENTS, getElement } from './elements';

// -- Compound library (data only — computation in Lua) ------------------------
export { COMPOUNDS } from './molecules';

// -- Enthalpy data (reference) ------------------------------------------------
export { ENTHALPIES } from './reactions';

// -- Utilities ----------------------------------------------------------------
export { useChemCompute, CONSTANTS } from './utils';

// -- React hooks --------------------------------------------------------------
export { useElement, useMolecule, useReaction, useEquilibrium, usePeriodicTableFilter } from './hooks';

// -- Chemistry notation (mhchem \ce{} + chemfig via LaTeX typesetter) ----------
export { ChemFormula, ChemEquation, IsoNotation, ChemFig } from './notation';
export type { ChemFormulaProps, ChemEquationProps, IsoNotationProps, ChemFigProps } from './notation';

// -- Lua capabilities (60fps painters via <Native>) ---------------------------
export {
  PeriodicTable, ElementTile, ElementCard, ElementDetail, MoleculeCard, ElectronShell, ReactionView,
  ReagentTest, SpectrumView, PhaseDiagram, BohrModel, StructureView,
} from './capabilities';
export type { ReagentTestProps, SpectrumViewProps, PhaseDiagramProps, BohrModelProps, StructureViewProps } from './capabilities';

// -- Reagent tests (compute in Lua, RPC hooks here) ---------------------------
export { useReagentTest, useReagentTestMulti, useReagentInfo, useAvailableCompounds, REAGENT_INFO } from './reagents';
export type { ReagentType, ColorReaction, ReagentResult, MultiReagentResult, ReagentInfo } from './reagents';

// -- Spectra (compute in Lua, RPC hooks here) ---------------------------------
export { useIdentifyIR, useWavelengthToColor, useAbsorptionColor, useIRAbsorptions } from './spectra';
export type { SpectrumType, SpectralPeak, Spectrum, IRAbsorption } from './spectra';

// -- PubChem API (async fetch, no hooks — callers store results themselves) ----
export {
  fetchCompound, searchCompoundsPubChem, fetchSynonyms, fetchDescription, fetchHazards,
} from './pubchem';
export type { PubChemCompound, PubChemSearchResult } from './pubchem';
