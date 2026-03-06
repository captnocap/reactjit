import type { Style } from '@reactjit/core';

// -- Spectrum Types -----------------------------------------------------------

export type SpectrumType = 'ir' | 'uv-vis' | 'mass-spec' | 'nmr' | 'raman';

export interface SpectralPeak {
  position: number;
  intensity: number;
  label?: string;
  assignment?: string;
}

export interface Spectrum {
  type: SpectrumType;
  compound: string;
  peaks: SpectralPeak[];
  xLabel: string;
  yLabel: string;
  xRange: [number, number];
  yRange: [number, number];
}

export interface SpectrumViewProps {
  spectrum: Spectrum;
  highlightPeak?: number;
  showLabels?: boolean;
  style?: Style;
}

// -- Functional group IR frequencies ------------------------------------------

export interface IRAbsorption {
  group: string;
  bond: string;
  rangeMin: number;
  rangeMax: number;
  intensity: 'strong' | 'medium' | 'weak' | 'variable';
  description: string;
}

export const IR_ABSORPTIONS: IRAbsorption[] = [
  { group: 'Alcohol', bond: 'O-H stretch', rangeMin: 3200, rangeMax: 3550, intensity: 'strong', description: 'Broad peak, hydrogen bonding' },
  { group: 'Carboxylic Acid', bond: 'O-H stretch', rangeMin: 2500, rangeMax: 3300, intensity: 'strong', description: 'Very broad, overlaps C-H' },
  { group: 'Amine', bond: 'N-H stretch', rangeMin: 3300, rangeMax: 3500, intensity: 'medium', description: 'Primary: two peaks; secondary: one peak' },
  { group: 'Alkane', bond: 'C-H stretch', rangeMin: 2850, rangeMax: 2960, intensity: 'strong', description: 'sp3 C-H' },
  { group: 'Alkene', bond: 'C-H stretch', rangeMin: 3020, rangeMax: 3100, intensity: 'medium', description: 'sp2 C-H' },
  { group: 'Alkyne', bond: 'C-H stretch', rangeMin: 3300, rangeMax: 3320, intensity: 'strong', description: 'sp C-H, sharp' },
  { group: 'Aldehyde', bond: 'C-H stretch', rangeMin: 2700, rangeMax: 2850, intensity: 'medium', description: 'Two peaks (Fermi resonance)' },
  { group: 'Nitrile', bond: 'C≡N stretch', rangeMin: 2210, rangeMax: 2260, intensity: 'medium', description: 'Sharp, characteristic' },
  { group: 'Alkyne', bond: 'C≡C stretch', rangeMin: 2100, rangeMax: 2260, intensity: 'weak', description: 'May be absent if symmetric' },
  { group: 'Carbonyl', bond: 'C=O stretch', rangeMin: 1680, rangeMax: 1750, intensity: 'strong', description: 'Very characteristic, exact position varies' },
  { group: 'Ketone', bond: 'C=O stretch', rangeMin: 1705, rangeMax: 1725, intensity: 'strong', description: 'Conjugation lowers frequency' },
  { group: 'Aldehyde', bond: 'C=O stretch', rangeMin: 1720, rangeMax: 1740, intensity: 'strong', description: 'Higher than ketone' },
  { group: 'Ester', bond: 'C=O stretch', rangeMin: 1735, rangeMax: 1750, intensity: 'strong', description: 'Highest carbonyl frequency' },
  { group: 'Amide', bond: 'C=O stretch', rangeMin: 1630, rangeMax: 1690, intensity: 'strong', description: 'Amide I band' },
  { group: 'Carboxylic Acid', bond: 'C=O stretch', rangeMin: 1700, rangeMax: 1725, intensity: 'strong', description: 'Dimeric form' },
  { group: 'Alkene', bond: 'C=C stretch', rangeMin: 1620, rangeMax: 1680, intensity: 'variable', description: 'Weak if symmetric' },
  { group: 'Aromatic', bond: 'C=C stretch', rangeMin: 1450, rangeMax: 1600, intensity: 'variable', description: 'Ring stretching, multiple peaks' },
  { group: 'Nitro', bond: 'N=O stretch', rangeMin: 1515, rangeMax: 1560, intensity: 'strong', description: 'Asymmetric stretch' },
  { group: 'Ether', bond: 'C-O stretch', rangeMin: 1000, rangeMax: 1300, intensity: 'strong', description: 'Broad region' },
  { group: 'Alcohol', bond: 'C-O stretch', rangeMin: 1000, rangeMax: 1260, intensity: 'strong', description: 'Primary/secondary/tertiary differ' },
  { group: 'Aromatic', bond: 'C-H bend (OOP)', rangeMin: 675, rangeMax: 900, intensity: 'strong', description: 'Substitution pattern diagnostic' },
];

// -- Common compound spectra --------------------------------------------------

const WATER_IR: Spectrum = {
  type: 'ir',
  compound: 'H2O',
  peaks: [
    { position: 3400, intensity: 0.95, label: 'O-H stretch', assignment: 'Broad, hydrogen bonded' },
    { position: 1640, intensity: 0.55, label: 'H-O-H bend', assignment: 'Scissoring mode' },
    { position: 680, intensity: 0.30, label: 'Libration', assignment: 'Hindered rotation' },
  ],
  xLabel: 'Wavenumber (cm\u207B\u00B9)',
  yLabel: 'Transmittance (%)',
  xRange: [4000, 400],
  yRange: [0, 1],
};

const ETHANOL_IR: Spectrum = {
  type: 'ir',
  compound: 'C2H5OH',
  peaks: [
    { position: 3350, intensity: 0.90, label: 'O-H stretch', assignment: 'Broad, hydrogen bonded alcohol' },
    { position: 2975, intensity: 0.75, label: 'C-H stretch', assignment: 'sp3 asymmetric' },
    { position: 2930, intensity: 0.70, label: 'C-H stretch', assignment: 'sp3 symmetric' },
    { position: 2880, intensity: 0.55, label: 'C-H stretch', assignment: 'CH3 symmetric' },
    { position: 1460, intensity: 0.40, label: 'C-H bend', assignment: 'CH2/CH3 deformation' },
    { position: 1380, intensity: 0.35, label: 'C-H bend', assignment: 'CH3 symmetric bend' },
    { position: 1050, intensity: 0.85, label: 'C-O stretch', assignment: 'Primary alcohol' },
    { position: 880, intensity: 0.25, label: 'C-C stretch', assignment: 'Skeletal' },
  ],
  xLabel: 'Wavenumber (cm\u207B\u00B9)',
  yLabel: 'Transmittance (%)',
  xRange: [4000, 400],
  yRange: [0, 1],
};

const ACETONE_IR: Spectrum = {
  type: 'ir',
  compound: 'C3H6O',
  peaks: [
    { position: 2970, intensity: 0.60, label: 'C-H stretch', assignment: 'sp3 CH3' },
    { position: 1715, intensity: 0.95, label: 'C=O stretch', assignment: 'Ketone carbonyl — the strongest peak' },
    { position: 1430, intensity: 0.35, label: 'C-H bend', assignment: 'CH3 asymmetric deformation' },
    { position: 1365, intensity: 0.40, label: 'C-H bend', assignment: 'CH3 symmetric bend' },
    { position: 1220, intensity: 0.50, label: 'C-C stretch', assignment: 'C-CO-C asymmetric' },
  ],
  xLabel: 'Wavenumber (cm\u207B\u00B9)',
  yLabel: 'Transmittance (%)',
  xRange: [4000, 400],
  yRange: [0, 1],
};

const BENZENE_UV: Spectrum = {
  type: 'uv-vis',
  compound: 'C6H6',
  peaks: [
    { position: 184, intensity: 0.95, label: 'E1 band', assignment: '\u03C0 \u2192 \u03C0* (allowed, intense)' },
    { position: 204, intensity: 0.70, label: 'E2 band', assignment: '\u03C0 \u2192 \u03C0* (allowed)' },
    { position: 256, intensity: 0.15, label: 'B band', assignment: '\u03C0 \u2192 \u03C0* (forbidden, vibrational fine structure)' },
  ],
  xLabel: 'Wavelength (nm)',
  yLabel: 'Absorbance',
  xRange: [180, 400],
  yRange: [0, 1],
};

const CAFFEINE_MASS: Spectrum = {
  type: 'mass-spec',
  compound: 'C8H10N4O2',
  peaks: [
    { position: 194, intensity: 1.0, label: 'M+', assignment: 'Molecular ion [C8H10N4O2]+' },
    { position: 193, intensity: 0.15, label: 'M-1', assignment: 'Loss of H' },
    { position: 166, intensity: 0.45, label: 'M-28', assignment: 'Loss of CO (retro Diels-Alder)' },
    { position: 137, intensity: 0.65, label: 'M-57', assignment: 'Loss of C2H3NO (methylisocyanate + CO)' },
    { position: 109, intensity: 0.55, label: '', assignment: 'Further fragmentation of m/z 137' },
    { position: 82, intensity: 0.35, label: '', assignment: 'Methylimidazole cation' },
    { position: 67, intensity: 0.30, label: '', assignment: 'C3H3N2+' },
    { position: 55, intensity: 0.25, label: '', assignment: 'C3H3NO+' },
    { position: 42, intensity: 0.40, label: '', assignment: 'CH2=N-CH3+ (iminium)' },
  ],
  xLabel: 'm/z',
  yLabel: 'Relative Intensity',
  xRange: [0, 220],
  yRange: [0, 1],
};

// -- Spectrum lookup ----------------------------------------------------------

const SPECTRA_DB: Record<string, Spectrum[]> = {
  'H2O': [WATER_IR],
  'C2H5OH': [ETHANOL_IR],
  'C3H6O': [ACETONE_IR],
  'C6H6': [BENZENE_UV],
  'C8H10N4O2': [CAFFEINE_MASS],
};

export function getSpectra(compound: string): Spectrum[] {
  return SPECTRA_DB[compound] ?? [];
}

export function getSpectrum(compound: string, type: SpectrumType): Spectrum | undefined {
  return SPECTRA_DB[compound]?.find(s => s.type === type);
}

export function listAvailableSpectra(): { compound: string; types: SpectrumType[] }[] {
  return Object.entries(SPECTRA_DB).map(([compound, spectra]) => ({
    compound,
    types: spectra.map(s => s.type),
  }));
}

export function identifyIRPeaks(wavenumber: number, tolerance: number = 50): IRAbsorption[] {
  return IR_ABSORPTIONS.filter(a =>
    wavenumber >= a.rangeMin - tolerance && wavenumber <= a.rangeMax + tolerance
  );
}

// -- Wavelength to visible color (for UV-Vis) ---------------------------------

export function wavelengthToColor(nm: number): string {
  if (nm < 380) return '#7F00FF';
  if (nm < 440) { const t = (nm - 380) / 60; return `rgb(${Math.round(255 * (1 - t))}, 0, 255)`; }
  if (nm < 490) { const t = (nm - 440) / 50; return `rgb(0, ${Math.round(255 * t)}, 255)`; }
  if (nm < 510) { const t = (nm - 490) / 20; return `rgb(0, 255, ${Math.round(255 * (1 - t))})`; }
  if (nm < 580) { const t = (nm - 510) / 70; return `rgb(${Math.round(255 * t)}, 255, 0)`; }
  if (nm < 645) { const t = (nm - 580) / 65; return `rgb(255, ${Math.round(255 * (1 - t))}, 0)`; }
  if (nm < 780) return '#FF0000';
  return '#7F0000';
}

export function absorptionToObservedColor(absorbedNm: number): string {
  // Complementary color — what you see when a wavelength is absorbed
  const COMPLEMENTARY: [number, number, string][] = [
    [380, 430, '#FFFF00'],  // absorb violet → see yellow
    [430, 480, '#FF8C00'],  // absorb blue → see orange
    [480, 500, '#FF0000'],  // absorb blue-green → see red
    [500, 530, '#FF00FF'],  // absorb green → see purple
    [530, 560, '#8B00FF'],  // absorb yellow-green → see violet
    [560, 580, '#0000FF'],  // absorb yellow → see blue
    [580, 620, '#00BFFF'],  // absorb orange → see cyan
    [620, 780, '#00FF00'],  // absorb red → see green
  ];
  for (const [lo, hi, color] of COMPLEMENTARY) {
    if (absorbedNm >= lo && absorbedNm < hi) return color;
  }
  return '#FFFFFF';
}
