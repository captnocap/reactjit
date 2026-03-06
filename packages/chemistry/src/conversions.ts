import { register, registerUnitGroup } from '@reactjit/convert';

// -- Amount of substance (base: mol) ------------------------------------------

registerUnitGroup('amount', 'mol', {
  mmol: 0.001,
  umol: 1e-6,
  nmol: 1e-9,
  kmol: 1000,
});

// -- Concentration (base: mol/L = M) ------------------------------------------

registerUnitGroup('concentration', 'M', {
  mM: 0.001,
  uM: 1e-6,
  nM: 1e-9,
  pM: 1e-12,
});

// -- Atomic mass (base: amu / Da) ---------------------------------------------

registerUnitGroup('atomic-mass', 'amu', {
  Da: 1,          // Dalton = 1 amu
  kDa: 1000,
  MDa: 1e6,
});

// AMU to kg
register('amu', 'kg', (amu: number) => amu * 1.66053906660e-27, 'atomic-mass');
register('kg', 'amu', (kg: number) => kg / 1.66053906660e-27, 'atomic-mass');

// -- Energy per mole conversions (chemistry-specific) -------------------------

register('kj_mol', 'kcal_mol', (kj: number) => kj / 4.184, 'energy-molar');
register('kcal_mol', 'kj_mol', (kcal: number) => kcal * 4.184, 'energy-molar');
register('kj_mol', 'ev_particle', (kj: number) => kj / 96.485, 'energy-molar');
register('ev_particle', 'kj_mol', (ev: number) => ev * 96.485, 'energy-molar');
register('kj_mol', 'j_mol', (kj: number) => kj * 1000, 'energy-molar');
register('j_mol', 'kj_mol', (j: number) => j / 1000, 'energy-molar');

// -- Wavelength / frequency / energy (spectroscopy) ---------------------------

const C = 2.99792458e8;    // speed of light, m/s
const H = 6.62607015e-34;  // Planck constant, J*s
const NA = 6.02214076e23;  // Avogadro

register('nm', 'cm_inv', (nm: number) => 1e7 / nm, 'spectroscopy');
register('cm_inv', 'nm', (cm1: number) => 1e7 / cm1, 'spectroscopy');
register('nm', 'hz', (nm: number) => C / (nm * 1e-9), 'spectroscopy');
register('hz', 'nm', (hz: number) => C / hz * 1e9, 'spectroscopy');
register('nm', 'ev_photon', (nm: number) => (H * C) / (nm * 1e-9) / 1.602176634e-19, 'spectroscopy');
register('ev_photon', 'nm', (ev: number) => (H * C) / (ev * 1.602176634e-19) * 1e9, 'spectroscopy');
register('nm', 'kj_mol_photon', (nm: number) => (H * C * NA) / (nm * 1e-9) / 1000, 'spectroscopy');
register('kj_mol_photon', 'nm', (kj: number) => (H * C * NA) / (kj * 1000) * 1e9, 'spectroscopy');

// -- pH / pOH / [H+] / [OH-] -------------------------------------------------

register('ph', 'h_plus', (ph: number) => Math.pow(10, -ph), 'acidity');
register('h_plus', 'ph', (h: number) => -Math.log10(h), 'acidity');
register('ph', 'poh', (ph: number) => 14 - ph, 'acidity');
register('poh', 'ph', (poh: number) => 14 - poh, 'acidity');
register('poh', 'oh_minus', (poh: number) => Math.pow(10, -poh), 'acidity');
register('oh_minus', 'poh', (oh: number) => -Math.log10(oh), 'acidity');

// -- Gas volume at STP (1 mol = 22.414 L) ------------------------------------

register('mol_gas', 'l_stp', (mol: number) => mol * 22.414, 'gas-volume');
register('l_stp', 'mol_gas', (l: number) => l / 22.414, 'gas-volume');
