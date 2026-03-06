// @reactjit/chemistry — Periodic table, molecules, reactions, and conversions.
//
// Pure data + hooks + drop-in widgets. No bridge required for core chemistry.
// Ties into @reactjit/convert for unit conversions, @reactjit/math for geometry.

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

// -- Molecule builder + compound library --------------------------------------
export { buildMolecule, lookupCompound, searchCompounds, listCompounds, COMPOUNDS } from './molecules';

// -- Reaction engine ----------------------------------------------------------
export { balanceEquation, getEnthalpy } from './reactions';

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

// -- Drop-in widgets ----------------------------------------------------------
export { PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView } from './widgets';

// -- Side effect: register chemistry conversions into @reactjit/convert -------
import './conversions';
