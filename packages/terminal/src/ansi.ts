/**
 * ANSI rendering engine for the terminal target.
 *
 * Converts DrawCommand[] to terminal output using a cell buffer.
 * Supports 24-bit truecolor, diff-based updates to minimize flicker,
 * and alternate screen buffer management.
 */

import type { DrawCommand } from '@reactjit/grid';

// ── Types ────────────────────────────────────────────────

export interface Cell {
  char: string;
  fg: string;   // CSS hex color
  bg: string;   // CSS hex color
}

// ── ANSI escape codes ────────────────────────────────────

const ESC = '\x1b[';

export const ANSI = {
  cursorHome: `${ESC}H`,
  cursorTo: (row: number, col: number) => `${ESC}${row};${col}H`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
  clearScreen: `${ESC}2J`,
  resetColors: `${ESC}0m`,
  altScreenEnter: `${ESC}?1049h`,
  altScreenLeave: `${ESC}?1049l`,
  fg24: (r: number, g: number, b: number) => `${ESC}38;2;${r};${g};${b}m`,
  bg24: (r: number, g: number, b: number) => `${ESC}48;2;${r};${g};${b}m`,
};

// ── Color utilities ──────────────────────────────────────

const colorCache = new Map<string, [number, number, number]>();

/** Parse a CSS hex color (#RGB or #RRGGBB) to [r, g, b]. */
export function parseHexToRGB(hex: string): [number, number, number] {
  const cached = colorCache.get(hex);
  if (cached) return cached;

  const h = hex.replace('#', '');
  let rgb: [number, number, number];

  if (h.length === 3) {
    rgb = [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  } else if (h.length === 6) {
    rgb = [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  } else {
    rgb = [0, 0, 0];
  }

  colorCache.set(hex, rgb);
  return rgb;
}

// ── Screen buffer ────────────────────────────────────────

const DEFAULT_FG = '#FFFFFF';
const DEFAULT_BG = '#000000';

function makeCell(char = ' ', fg = DEFAULT_FG, bg = DEFAULT_BG): Cell {
  return { char, fg, bg };
}

/** Create a blank screen buffer. */
export function createScreenBuffer(w: number, h: number): Cell[][] {
  const buffer: Cell[][] = [];
  for (let row = 0; row < h; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < w; col++) {
      line.push(makeCell());
    }
    buffer.push(line);
  }
  return buffer;
}

/** Clear a buffer to default cells. */
export function clearBuffer(buffer: Cell[][]): void {
  for (const row of buffer) {
    for (let i = 0; i < row.length; i++) {
      row[i].char = ' ';
      row[i].fg = DEFAULT_FG;
      row[i].bg = DEFAULT_BG;
    }
  }
}

/** Apply DrawCommands to a cell buffer. Coordinates are 0-based. */
export function applyCommands(buffer: Cell[][], commands: DrawCommand[]): void {
  const h = buffer.length;
  const w = h > 0 ? buffer[0].length : 0;

  for (const cmd of commands) {
    const x = cmd.x;
    const y = cmd.y;
    const cw = cmd.w;
    const ch = cmd.h;

    // Apply background fill
    if (cmd.bg && !cmd.text) {
      const bg = String(cmd.bg);
      for (let row = y; row < y + ch && row < h; row++) {
        if (row < 0) continue;
        for (let col = x; col < x + cw && col < w; col++) {
          if (col < 0) continue;
          buffer[row][col].bg = bg;
        }
      }
    }

    // Apply text
    if (cmd.text) {
      const row = y;
      if (row >= 0 && row < h) {
        const fg = cmd.fg ? String(cmd.fg) : DEFAULT_FG;
        const bg = cmd.bg ? String(cmd.bg) : undefined;
        const text = cmd.text;

        for (let i = 0; i < text.length && x + i < w; i++) {
          const col = x + i;
          if (col < 0) continue;
          buffer[row][col].char = text[i];
          buffer[row][col].fg = fg;
          if (bg) buffer[row][col].bg = bg;
        }
      }
    }
  }
}

// ── Rendering ────────────────────────────────────────────

/** Render the full buffer as an ANSI string. */
export function renderFull(buffer: Cell[][]): string {
  let out = ANSI.cursorHome;
  let lastFg = '';
  let lastBg = '';

  for (let row = 0; row < buffer.length; row++) {
    out += ANSI.cursorTo(row + 1, 1); // 1-based terminal coords
    lastFg = '';
    lastBg = '';

    for (let col = 0; col < buffer[row].length; col++) {
      const cell = buffer[row][col];

      if (cell.fg !== lastFg) {
        const [r, g, b] = parseHexToRGB(cell.fg);
        out += ANSI.fg24(r, g, b);
        lastFg = cell.fg;
      }
      if (cell.bg !== lastBg) {
        const [r, g, b] = parseHexToRGB(cell.bg);
        out += ANSI.bg24(r, g, b);
        lastBg = cell.bg;
      }

      out += cell.char;
    }
  }

  out += ANSI.resetColors;
  return out;
}

/** Render only cells that differ between prev and next. */
export function renderDiff(prev: Cell[][], next: Cell[][]): string {
  let out = '';
  let lastFg = '';
  let lastBg = '';
  let lastRow = -1;
  let lastCol = -1;

  for (let row = 0; row < next.length; row++) {
    for (let col = 0; col < next[row].length; col++) {
      const pc = prev[row]?.[col];
      const nc = next[row][col];

      if (pc && pc.char === nc.char && pc.fg === nc.fg && pc.bg === nc.bg) {
        continue;
      }

      // Need to position cursor if not sequential
      if (row !== lastRow || col !== lastCol + 1) {
        out += ANSI.cursorTo(row + 1, col + 1);
      }

      if (nc.fg !== lastFg) {
        const [r, g, b] = parseHexToRGB(nc.fg);
        out += ANSI.fg24(r, g, b);
        lastFg = nc.fg;
      }
      if (nc.bg !== lastBg) {
        const [r, g, b] = parseHexToRGB(nc.bg);
        out += ANSI.bg24(r, g, b);
        lastBg = nc.bg;
      }

      out += nc.char;
      lastRow = row;
      lastCol = col;
    }
  }

  if (out) out += ANSI.resetColors;
  return out;
}

/** Deep-copy a screen buffer. */
export function cloneBuffer(buffer: Cell[][]): Cell[][] {
  return buffer.map(row => row.map(cell => ({ ...cell })));
}
