import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getNavigatedAddress, normalizeSpreadsheetKey } from '../src/interaction.ts';

describe('data spreadsheet keyboard interaction', () => {
  it('normalizes native key names used by the spreadsheet handlers', () => {
    assert.equal(normalizeSpreadsheetKey({ key: 'ArrowLeft' }), 'left');
    assert.equal(normalizeSpreadsheetKey({ key: 'return' }), 'enter');
    assert.equal(normalizeSpreadsheetKey({ scancode: 'esc' }), 'escape');
  });

  it('moves with arrow keys and clamps to sheet edges', () => {
    assert.equal(getNavigatedAddress({ selectedAddress: 'B2', rows: 4, cols: 4, key: 'left' }), 'A2');
    assert.equal(getNavigatedAddress({ selectedAddress: 'A1', rows: 4, cols: 4, key: 'left' }), 'A1');
    assert.equal(getNavigatedAddress({ selectedAddress: 'D4', rows: 4, cols: 4, key: 'down' }), 'D4');
  });

  it('advances tab across columns and wraps rows', () => {
    assert.equal(getNavigatedAddress({ selectedAddress: 'A1', rows: 3, cols: 3, key: 'tab' }), 'B1');
    assert.equal(getNavigatedAddress({ selectedAddress: 'C1', rows: 3, cols: 3, key: 'tab' }), 'A2');
    assert.equal(getNavigatedAddress({ selectedAddress: 'C3', rows: 3, cols: 3, key: 'tab' }), 'C3');
  });

  it('reverses tab with shift and wraps to the previous row', () => {
    assert.equal(getNavigatedAddress({ selectedAddress: 'B2', rows: 3, cols: 3, key: 'tab', shift: true }), 'A2');
    assert.equal(getNavigatedAddress({ selectedAddress: 'A2', rows: 3, cols: 3, key: 'tab', shift: true }), 'C1');
    assert.equal(getNavigatedAddress({ selectedAddress: 'A1', rows: 3, cols: 3, key: 'tab', shift: true }), 'A1');
  });

  it('moves vertically on enter and shift+enter', () => {
    assert.equal(getNavigatedAddress({ selectedAddress: 'B2', rows: 4, cols: 4, key: 'enter' }), 'B3');
    assert.equal(getNavigatedAddress({ selectedAddress: 'B2', rows: 4, cols: 4, key: 'enter', shift: true }), 'B1');
    assert.equal(getNavigatedAddress({ selectedAddress: 'B1', rows: 4, cols: 4, key: 'enter', shift: true }), 'B1');
  });

  it('returns null for non-navigation keys', () => {
    assert.equal(getNavigatedAddress({ selectedAddress: 'A1', rows: 4, cols: 4, key: 'f2' }), null);
  });
});
