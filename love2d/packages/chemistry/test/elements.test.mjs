import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ELEMENTS, getElement } from '../src/elements.ts';

describe('chemistry periodic table dataset', () => {
  it('contains the full ordered set of 118 elements', () => {
    assert.equal(ELEMENTS.length, 118);
    assert.equal(ELEMENTS[0].number, 1);
    assert.equal(ELEMENTS[0].symbol, 'H');
    assert.equal(ELEMENTS[ELEMENTS.length - 1].number, 118);
    assert.equal(ELEMENTS[ELEMENTS.length - 1].symbol, 'Og');

    for (let i = 0; i < ELEMENTS.length; i += 1) {
      assert.equal(ELEMENTS[i].number, i + 1);
    }
  });

  it('keeps symbols, names, and atomic numbers unique', () => {
    const symbols = new Set(ELEMENTS.map((e) => e.symbol));
    const names = new Set(ELEMENTS.map((e) => e.name.toLowerCase()));
    const numbers = new Set(ELEMENTS.map((e) => e.number));

    assert.equal(symbols.size, ELEMENTS.length);
    assert.equal(names.size, ELEMENTS.length);
    assert.equal(numbers.size, ELEMENTS.length);
  });

  it('stores consistent structural fields for each element', () => {
    for (const element of ELEMENTS) {
      assert.ok(element.mass > 0);
      assert.ok(element.group >= 1 && element.group <= 18);
      assert.ok(element.period >= 1 && element.period <= 7);
      assert.match(element.cpkColor, /^#[0-9A-F]{6}$/);
      assert.equal(element.shells.reduce((sum, count) => sum + count, 0), element.number);
    }
  });
});

describe('chemistry element lookup semantics', () => {
  it('finds elements by atomic number, symbol, and case-insensitive name', () => {
    const oxygenByNumber = getElement(8);
    const oxygenBySymbol = getElement('O');
    const oxygenByWhitespace = getElement(' o ');
    const oxygenByName = getElement('oxygen');
    const oxygenByTitle = getElement('Oxygen');

    assert.deepEqual(oxygenByNumber, oxygenBySymbol);
    assert.deepEqual(oxygenByNumber, oxygenByWhitespace);
    assert.deepEqual(oxygenByNumber, oxygenByName);
    assert.deepEqual(oxygenByNumber, oxygenByTitle);
    assert.equal(oxygenByNumber?.name, 'Oxygen');
  });

  it('returns undefined for unknown elements', () => {
    assert.equal(getElement(999), undefined);
    assert.equal(getElement('Xx'), undefined);
    assert.equal(getElement('Unobtainium'), undefined);
  });

  it('preserves known real-world reference facts for representative elements', () => {
    const iron = getElement('Fe');
    const mercury = getElement('Mercury');
    const neon = getElement(10);

    assert.equal(iron?.category, 'transition-metal');
    assert.equal(iron?.group, 8);
    assert.equal(mercury?.phase, 'liquid');
    assert.equal(neon?.category, 'noble-gas');
    assert.equal(neon?.period, 2);
  });
});
