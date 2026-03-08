import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fitColumnWidthsToViewport } from '../src/layout.ts';

function sum(widths) {
  return widths.reduce((total, width) => total + width, 0);
}

describe('data spreadsheet layout fitting', () => {
  it('returns base widths when no usable viewport width is available', () => {
    const widths = fitColumnWidthsToViewport({
      widths: [120, 140, 160],
      viewportWidth: 0,
      rowHeaderWidth: 52,
      minWidth: 72,
      maxWidth: 420,
    });

    assert.deepEqual(widths, [120, 140, 160]);
  });

  it('scales widths down proportionally to fit the viewport', () => {
    const widths = fitColumnWidthsToViewport({
      widths: [200, 100, 100],
      viewportWidth: 352,
      rowHeaderWidth: 52,
      minWidth: 40,
      maxWidth: 420,
    });

    assert.equal(sum(widths), 300);
    assert.deepEqual(widths, [150, 75, 75]);
  });

  it('scales widths up to fill the available viewport width', () => {
    const widths = fitColumnWidthsToViewport({
      widths: [100, 100, 100],
      viewportWidth: 412,
      rowHeaderWidth: 52,
      minWidth: 40,
      maxWidth: 420,
    });

    assert.equal(sum(widths), 360);
    assert.deepEqual(widths, [120, 120, 120]);
  });

  it('respects minimum widths when the viewport is too narrow to fully fit', () => {
    const widths = fitColumnWidthsToViewport({
      widths: [200, 180, 160],
      viewportWidth: 202,
      rowHeaderWidth: 52,
      minWidth: 60,
      maxWidth: 420,
    });

    assert.deepEqual(widths, [60, 60, 60]);
  });

  it('respects maximum widths when the viewport is much larger than the base widths', () => {
    const widths = fitColumnWidthsToViewport({
      widths: [100, 120],
      viewportWidth: 1052,
      rowHeaderWidth: 52,
      minWidth: 40,
      maxWidth: 300,
    });

    assert.deepEqual(widths, [300, 300]);
  });
});
