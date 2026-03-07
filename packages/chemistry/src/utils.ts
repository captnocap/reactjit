import { useLoveRPC } from '@reactjit/core';

/** All chemistry util math runs in Lua via chemistry:compute RPC. */
export const useChemCompute = () => useLoveRPC<any>('chemistry:compute');

/** Physical constants — CODATA 2018. Data only, not compute. */
export const CONSTANTS = {
  AVOGADRO: 6.02214076e23,
  R_GAS: 8.314,
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
