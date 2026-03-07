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

// -- Element data (118 elements) ----------------------------------------------
export { ELEMENTS, getElement, getElementsByCategory, getElementsByPeriod, getElementsByGroup, getElementsByPhase } from './elements';

// -- Compound library (data only — computation in Lua) ------------------------
export { COMPOUNDS } from './molecules';

// -- Enthalpy data (reference) ------------------------------------------------
export { ENTHALPIES } from './reactions';

// -- Utilities ----------------------------------------------------------------
export {
  parseFormula, molarMass, atomCount, massComposition,
  electronConfig, valenceElectrons,
  electronegativityDiff, bondCharacter,
  oxidationStates, isotopeNotation, empiricalFormula,
  massToMoles, molesToMass, molesToParticles, particlesToMoles, massToParticles,
  idealGasPressure, idealGasVolume, idealGasMoles,
  molarity, dilution,
  CONSTANTS,
} from './utils';

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

// -- Reagent test data (pure TS, also mirrored in Lua for rendering) ----------
export {
  runReagentTest, runMultiReagentTest,
  getAvailableCompounds, getAllTestedCompounds,
  REAGENT_INFO,
} from './reagents';
export type { ReagentType, ColorReaction, ReagentResult, MultiReagentResult } from './reagents';

// -- Spectra data + IR absorption reference -----------------------------------
export {
  getSpectra, getSpectrum, listAvailableSpectra,
  identifyIRPeaks, wavelengthToColor, absorptionToObservedColor,
  IR_ABSORPTIONS,
} from './spectra';
export type { SpectrumType, SpectralPeak, Spectrum, IRAbsorption } from './spectra';

// -- PubChem API --------------------------------------------------------------
export {
  fetchCompound, searchCompoundsPubChem, fetchSynonyms, fetchDescription, fetchHazards,
} from './pubchem';
export type { PubChemCompound, PubChemSearchResult } from './pubchem';

// -- Side effect: register chemistry conversions into @reactjit/convert -------
import './conversions';
