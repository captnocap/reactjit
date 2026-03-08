import type { LoveEvent } from '@reactjit/core';
import { columnIndexToLabel, parseCellAddress } from './address.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildCellAddress(col: number, row: number): string {
  return `${columnIndexToLabel(col)}${row + 1}`;
}

export function normalizeSpreadsheetKey(event: Pick<LoveEvent, 'key' | 'scancode'>): string {
  const raw = event.key ?? event.scancode ?? '';
  const key = raw.toLowerCase();
  if (key === 'return') return 'enter';
  if (key === 'esc') return 'escape';
  if (key === 'arrowleft') return 'left';
  if (key === 'arrowright') return 'right';
  if (key === 'arrowup') return 'up';
  if (key === 'arrowdown') return 'down';
  return key;
}

export interface SpreadsheetNavigationOptions {
  selectedAddress: string;
  rows: number;
  cols: number;
  key: string;
  shift?: boolean;
}

export function getNavigatedAddress({
  selectedAddress,
  rows,
  cols,
  key,
  shift = false,
}: SpreadsheetNavigationOptions): string | null {
  const selected = parseCellAddress(selectedAddress) ?? { col: 0, row: 0 };
  const maxCol = Math.max(0, cols - 1);
  const maxRow = Math.max(0, rows - 1);
  let { col, row } = selected;

  switch (key) {
    case 'left':
      col = clamp(col - 1, 0, maxCol);
      break;
    case 'right':
      col = clamp(col + 1, 0, maxCol);
      break;
    case 'up':
      row = clamp(row - 1, 0, maxRow);
      break;
    case 'down':
      row = clamp(row + 1, 0, maxRow);
      break;
    case 'enter':
      row = clamp(row + (shift ? -1 : 1), 0, maxRow);
      break;
    case 'tab':
      if (shift) {
        if (col > 0) col -= 1;
        else if (row > 0) {
          row -= 1;
          col = maxCol;
        }
      } else if (col < maxCol) col += 1;
      else if (row < maxRow) {
        row += 1;
        col = 0;
      }
      break;
    default:
      return null;
  }

  return buildCellAddress(col, row);
}
