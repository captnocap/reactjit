// Computation moved to lua/capabilities/chemistry.lua (LuaJIT).
// This file retains type re-exports and the enthalpy table for reference.
export type { Reaction, ReactionSide } from './types';

// Enthalpy data (kJ/mol) — kept here as reference; Lua has a copy too.
export const ENTHALPIES: Record<string, number> = {
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
