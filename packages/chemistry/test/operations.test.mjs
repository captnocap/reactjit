import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ELEMENTS } from '../src/elements.ts';
import { COMPOUNDS } from '../src/molecules.ts';
import { ENTHALPIES } from '../src/reactions.ts';

const elementsBySymbol = new Map(ELEMENTS.map((element) => [element.symbol, element]));
const compoundsByFormula = new Map(COMPOUNDS.map((compound) => [compound.formula, compound]));

function parseFormula(formula) {
  const atoms = [];
  const seen = new Map();
  const tokenPattern = /([A-Z][a-z]?)(\d*)/g;

  for (const match of formula.matchAll(tokenPattern)) {
    const symbol = match[1];
    const count = match[2] ? Number(match[2]) : 1;
    const existing = seen.get(symbol);

    if (existing) {
      existing.count += count;
      continue;
    }

    const atom = { symbol, count };
    seen.set(symbol, atom);
    atoms.push(atom);
  }

  return atoms;
}

function molarMass(formula) {
  const total = parseFormula(formula).reduce((sum, atom) => {
    const element = elementsBySymbol.get(atom.symbol);
    assert.ok(element, `missing element data for ${atom.symbol}`);
    return sum + element.mass * atom.count;
  }, 0);

  return Number(total.toFixed(3));
}

function massComposition(formula) {
  const totalMass = molarMass(formula);
  const composition = {};

  for (const atom of parseFormula(formula)) {
    const element = elementsBySymbol.get(atom.symbol);
    assert.ok(element, `missing element data for ${atom.symbol}`);
    composition[atom.symbol] = Number(((element.mass * atom.count / totalMass) * 100).toFixed(2));
  }

  return composition;
}

describe('chemistry reference compounds reflect established molecular facts', () => {
  it('stores representative geometries and polarities for canonical molecules', () => {
    assert.deepEqual(
      compoundsByFormula.get('H2O'),
      {
        formula: 'H2O',
        name: 'Water',
        iupac: 'Dihydrogen monoxide',
        geometry: 'bent',
        polarity: 'polar',
      },
    );
    assert.equal(compoundsByFormula.get('CO2')?.geometry, 'linear');
    assert.equal(compoundsByFormula.get('CO2')?.polarity, 'nonpolar');
    assert.equal(compoundsByFormula.get('NH3')?.geometry, 'trigonal-pyramidal');
    assert.equal(compoundsByFormula.get('NH3')?.polarity, 'polar');
    assert.equal(compoundsByFormula.get('SF6')?.geometry, 'octahedral');
    assert.equal(compoundsByFormula.get('SF6')?.polarity, 'nonpolar');
  });

  it('derives accepted molar masses for benchmark compounds from the periodic table', () => {
    assert.equal(molarMass('H2O'), 18.015);
    assert.equal(molarMass('CO2'), 44.009);
    assert.equal(molarMass('NaCl'), 58.44);
    assert.equal(molarMass('C6H12O6'), 180.156);
  });

  it('preserves realistic percent-composition baselines for common compounds', () => {
    assert.deepEqual(massComposition('H2O'), { H: 11.19, O: 88.81 });
    assert.deepEqual(massComposition('CO2'), { C: 27.29, O: 72.71 });
    assert.deepEqual(massComposition('NH3'), { N: 82.24, H: 17.76 });
  });
});

describe('chemistry reference tables preserve real-world thermochemistry and reagent metadata', () => {
  it('keeps representative reaction enthalpies consistent with known signs and magnitudes', () => {
    assert.equal(ENTHALPIES['2H2 + O2 -> 2H2O'], -571.6);
    assert.equal(ENTHALPIES['CH4 + 2O2 -> CO2 + 2H2O'], -890.4);
    assert.equal(ENTHALPIES['C6H12O6 + 6O2 -> 6CO2 + 6H2O'], -2803);
    assert.equal(ENTHALPIES['CaCO3 -> CaO + CO2'], 178.1);
    assert.equal(ENTHALPIES['2H2O -> 2H2 + O2'], 571.6);
  });
});
