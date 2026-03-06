import { getElement } from './elements';
import { parseFormula, molarMass } from './utils';
import type { Molecule, Bond, MolecularGeometry } from './types';

// -- Common compounds library -------------------------------------------------

interface CompoundDef {
  formula: string;
  name: string;
  iupac?: string;
  geometry?: MolecularGeometry;
  polarity?: 'polar' | 'nonpolar';
  bonds?: Bond[];
}

const COMPOUNDS: CompoundDef[] = [
  { formula: 'H2O', name: 'Water', iupac: 'Dihydrogen monoxide', geometry: 'bent', polarity: 'polar', bonds: [{ from: 8, to: 1, type: 'single', order: 1 }, { from: 8, to: 1, type: 'single', order: 1 }] },
  { formula: 'CO2', name: 'Carbon Dioxide', iupac: 'Carbon dioxide', geometry: 'linear', polarity: 'nonpolar', bonds: [{ from: 6, to: 8, type: 'double', order: 2 }, { from: 6, to: 8, type: 'double', order: 2 }] },
  { formula: 'NaCl', name: 'Sodium Chloride', iupac: 'Sodium chloride', bonds: [{ from: 11, to: 17, type: 'ionic', order: 1 }] },
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
  { formula: 'CO', name: 'Carbon Monoxide', iupac: 'Carbon monoxide', geometry: 'linear', polarity: 'polar', bonds: [{ from: 6, to: 8, type: 'triple', order: 3 }] },
  { formula: 'NO2', name: 'Nitrogen Dioxide', iupac: 'Nitrogen dioxide', geometry: 'bent', polarity: 'polar' },
  { formula: 'SO2', name: 'Sulfur Dioxide', iupac: 'Sulfur dioxide', geometry: 'bent', polarity: 'polar' },
  { formula: 'PCl5', name: 'Phosphorus Pentachloride', iupac: 'Phosphorus pentachloride', geometry: 'trigonal-bipyramidal', polarity: 'nonpolar' },
  { formula: 'SF6', name: 'Sulfur Hexafluoride', iupac: 'Sulfur hexafluoride', geometry: 'octahedral', polarity: 'nonpolar' },
  { formula: 'BF3', name: 'Boron Trifluoride', iupac: 'Boron trifluoride', geometry: 'trigonal-planar', polarity: 'nonpolar' },
  { formula: 'CCl4', name: 'Carbon Tetrachloride', iupac: 'Tetrachloromethane', geometry: 'tetrahedral', polarity: 'nonpolar' },
  { formula: 'N2', name: 'Nitrogen', geometry: 'linear', polarity: 'nonpolar', bonds: [{ from: 7, to: 7, type: 'triple', order: 3 }] },
  { formula: 'O2', name: 'Oxygen', geometry: 'linear', polarity: 'nonpolar', bonds: [{ from: 8, to: 8, type: 'double', order: 2 }] },
  { formula: 'H2', name: 'Hydrogen', geometry: 'linear', polarity: 'nonpolar', bonds: [{ from: 1, to: 1, type: 'single', order: 1 }] },
  { formula: 'Cl2', name: 'Chlorine', geometry: 'linear', polarity: 'nonpolar', bonds: [{ from: 17, to: 17, type: 'single', order: 1 }] },
  { formula: 'Fe2O3', name: 'Iron(III) Oxide', iupac: 'Iron(III) oxide' },
  { formula: 'CaCO3', name: 'Calcium Carbonate', iupac: 'Calcium carbonate' },
  { formula: 'KMnO4', name: 'Potassium Permanganate', iupac: 'Potassium permanganate' },
  { formula: 'C6H6', name: 'Benzene', iupac: 'Benzene', polarity: 'nonpolar' },
  { formula: 'C3H8', name: 'Propane', iupac: 'Propane', polarity: 'nonpolar' },
  { formula: 'C2H2', name: 'Acetylene', iupac: 'Ethyne', geometry: 'linear', polarity: 'nonpolar' },
  { formula: 'C2H4', name: 'Ethylene', iupac: 'Ethene', polarity: 'nonpolar' },
];

const compoundsByFormula = new Map<string, CompoundDef>();
const compoundsByName = new Map<string, CompoundDef>();
for (const c of COMPOUNDS) {
  compoundsByFormula.set(c.formula, c);
  compoundsByName.set(c.name.toLowerCase(), c);
}

export function buildMolecule(formulaOrName: string): Molecule {
  const known = compoundsByFormula.get(formulaOrName) ?? compoundsByName.get(formulaOrName.toLowerCase());
  const formula = known?.formula ?? formulaOrName;
  const atoms = parseFormula(formula);

  return {
    formula,
    name: known?.name,
    atoms,
    bonds: known?.bonds ?? [],
    molarMass: molarMass(formula),
    geometry: known?.geometry,
    polarity: known?.polarity,
    iupac: known?.iupac,
  };
}

export function lookupCompound(query: string): CompoundDef | undefined {
  return compoundsByFormula.get(query) ?? compoundsByName.get(query.toLowerCase());
}

export function searchCompounds(query: string): CompoundDef[] {
  const q = query.toLowerCase();
  return COMPOUNDS.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.formula.toLowerCase().includes(q) ||
    (c.iupac && c.iupac.toLowerCase().includes(q))
  );
}

export function listCompounds(): CompoundDef[] {
  return [...COMPOUNDS];
}

export { COMPOUNDS };
