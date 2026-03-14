// Computation moved to lua/capabilities/chemistry.lua (LuaJIT).
// This file retains the COMPOUNDS data table as a TS reference.
export type { Molecule, Bond, MolecularGeometry } from './types';

export interface CompoundDef {
  formula: string;
  name: string;
  iupac?: string;
  geometry?: string;
  polarity?: 'polar' | 'nonpolar';
}

export const COMPOUNDS: CompoundDef[] = [
  { formula: 'H2O', name: 'Water', iupac: 'Dihydrogen monoxide', geometry: 'bent', polarity: 'polar' },
  { formula: 'CO2', name: 'Carbon Dioxide', iupac: 'Carbon dioxide', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'NaCl', name: 'Sodium Chloride', iupac: 'Sodium chloride' },
  { formula: 'CH4', name: 'Methane', iupac: 'Methane', geometry: 'tetrahedral', polarity: 'nonpolar' },
  { formula: 'NH3', name: 'Ammonia', iupac: 'Ammonia', geometry: 'trigonal-pyramidal', polarity: 'polar' },
  { formula: 'HCl', name: 'Hydrochloric Acid', iupac: 'Hydrogen chloride', geometry: 'linear', polarity: 'polar' },
  { formula: 'H2SO4', name: 'Sulfuric Acid', iupac: 'Sulfuric acid', polarity: 'polar' },
  { formula: 'HNO3', name: 'Nitric Acid', iupac: 'Nitric acid', polarity: 'polar' },
  { formula: 'NaOH', name: 'Sodium Hydroxide', iupac: 'Sodium hydroxide' },
  { formula: 'C6H12O6', name: 'Glucose', iupac: 'D-Glucose', polarity: 'polar' },
  { formula: 'C2H5OH', name: 'Ethanol', iupac: 'Ethanol', polarity: 'polar' },
  { formula: 'C8H10N4O2', name: 'Caffeine', iupac: '1,3,7-Trimethylxanthine' },
  { formula: 'C9H8O4', name: 'Aspirin', iupac: 'Acetylsalicylic acid' },
  { formula: 'C6H8O7', name: 'Citric Acid', iupac: 'Citric acid', polarity: 'polar' },
  { formula: 'C2H4O2', name: 'Acetic Acid', iupac: 'Acetic acid', polarity: 'polar' },
  { formula: 'H2O2', name: 'Hydrogen Peroxide', iupac: 'Hydrogen peroxide', polarity: 'polar' },
  { formula: 'O3', name: 'Ozone', iupac: 'Ozone', geometry: 'bent', polarity: 'polar' },
  { formula: 'C12H22O11', name: 'Sucrose', iupac: 'Sucrose', polarity: 'polar' },
  { formula: 'CO', name: 'Carbon Monoxide', iupac: 'Carbon monoxide', geometry: 'linear', polarity: 'polar' },
  { formula: 'NO2', name: 'Nitrogen Dioxide', iupac: 'Nitrogen dioxide', geometry: 'bent', polarity: 'polar' },
  { formula: 'SO2', name: 'Sulfur Dioxide', iupac: 'Sulfur dioxide', geometry: 'bent', polarity: 'polar' },
  { formula: 'PCl5', name: 'Phosphorus Pentachloride', iupac: 'Phosphorus pentachloride', geometry: 'trigonal-bipyramidal', polarity: 'nonpolar' },
  { formula: 'SF6', name: 'Sulfur Hexafluoride', iupac: 'Sulfur hexafluoride', geometry: 'octahedral', polarity: 'nonpolar' },
  { formula: 'BF3', name: 'Boron Trifluoride', iupac: 'Boron trifluoride', geometry: 'trigonal-planar', polarity: 'nonpolar' },
  { formula: 'CCl4', name: 'Carbon Tetrachloride', iupac: 'Tetrachloromethane', geometry: 'tetrahedral', polarity: 'nonpolar' },
  { formula: 'N2', name: 'Nitrogen', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'O2', name: 'Oxygen', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'H2', name: 'Hydrogen', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'Cl2', name: 'Chlorine', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'Fe2O3', name: 'Iron(III) Oxide', iupac: 'Iron(III) oxide' },
  { formula: 'CaCO3', name: 'Calcium Carbonate', iupac: 'Calcium carbonate' },
  { formula: 'KMnO4', name: 'Potassium Permanganate', iupac: 'Potassium permanganate' },
  { formula: 'C6H6', name: 'Benzene', iupac: 'Benzene', polarity: 'nonpolar' },
  { formula: 'C3H8', name: 'Propane', iupac: 'Propane', polarity: 'nonpolar' },
  { formula: 'C2H2', name: 'Acetylene', iupac: 'Ethyne', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'C2H4', name: 'Ethylene', iupac: 'Ethene', polarity: 'nonpolar' },
];
