import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildAddressMatrix,
  columnIndexToLabel,
  normalizeCellAddress,
  parseCellAddress,
} from '../src/address.ts';

describe('data address helper semantics', () => {
  it('normalizes spreadsheet addresses to trimmed uppercase keys', () => {
    assert.equal(normalizeCellAddress(' a10 '), 'A10');
    assert.equal(normalizeCellAddress('\tbB32\n'), 'BB32');
    assert.equal(normalizeCellAddress(' $c 15 '), 'C15');
  });

  it('converts zero-based column indices to spreadsheet labels', () => {
    assert.equal(columnIndexToLabel(0), 'A');
    assert.equal(columnIndexToLabel(25), 'Z');
    assert.equal(columnIndexToLabel(26), 'AA');
    assert.equal(columnIndexToLabel(27), 'AB');
    assert.equal(columnIndexToLabel(701), 'ZZ');
    assert.equal(columnIndexToLabel(702), 'AAA');
  });

  it('parses valid cell addresses into zero-based coordinates', () => {
    assert.deepEqual(parseCellAddress('A1'), { col: 0, row: 0 });
    assert.deepEqual(parseCellAddress(' c12 '), { col: 2, row: 11 });
    assert.deepEqual(parseCellAddress('$c$12'), { col: 2, row: 11 });
    assert.deepEqual(parseCellAddress('AA10'), { col: 26, row: 9 });
    assert.deepEqual(parseCellAddress('ZZ999'), { col: 701, row: 998 });
  });

  it('rejects invalid cell addresses', () => {
    assert.equal(parseCellAddress(''), null);
    assert.equal(parseCellAddress('A0'), null);
    assert.equal(parseCellAddress('1A'), null);
    assert.equal(parseCellAddress('A-1'), null);
  });

  it('builds a row-major address matrix for a requested grid', () => {
    assert.deepEqual(buildAddressMatrix(0, 4), []);
    assert.deepEqual(buildAddressMatrix(2, 3), ['A1', 'B1', 'C1', 'A2', 'B2', 'C2']);
  });
});
