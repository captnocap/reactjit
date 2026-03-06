// @reactjit/chemistry — Periodic table, molecules, reactions, reagent tests,
// spectrometry, phase diagrams, PubChem API, and unit conversions.
//
// Pure data + hooks + widgets (React-rendered) for static chemistry.
// Lua capabilities (60fps painters) for reagent tests, spectra, phase diagrams.
// PubChem REST API for live compound lookups.

// -- Types --------------------------------------------------------------------
export type {
  Element, ElementCategory, Phase,
  Bond, BondType,
  AtomCount, Molecule, MolecularGeometry,
  Reaction, ReactionSide,
  EquilibriumState,
  PeriodicTableProps, ElementCardProps, MoleculeCardProps,
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

// -- Drop-in widgets (React-rendered) -----------------------------------------
export { PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView } from './widgets';

// -- Lua capabilities (60fps painters via <Native>) ---------------------------
export { ReagentTest, SpectrumView, PhaseDiagram } from './capabilities';
export type { ReagentTestProps, SpectrumViewProps, PhaseDiagramProps } from './capabilities';

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
