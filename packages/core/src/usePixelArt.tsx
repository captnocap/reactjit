/**
 * usePixelArt — convert Unicode art / symbol names into Box-based geometry.
 *
 * Love2D's default font doesn't include Unicode symbols (▶ ⏸ ● ✓ etc.).
 * This hook renders them as colored <Box> grids that work on every target.
 *
 * Usage:
 *   // Built-in symbol
 *   const play = usePixelArt('play', { size: 4, color: '#fff' });
 *
 *   // Custom string art (any non-space character = filled pixel)
 *   const heart = usePixelArt([
 *     '  ███   ███  ',
 *     ' █████ █████ ',
 *     '█████████████',
 *   ], { size: 12, colors: ['#ff6b9d', '#ff5277', '#e94560'] });
 *
 *   return <Box>{play}</Box>;
 */

import React, { useMemo } from 'react';
import { Box } from './primitives';
import type { Style } from './types';

/* ── Built-in symbol bitmaps ──────────────────────────────────
 * Convention: any non-space character = filled pixel.
 * Designed at small scale — size prop controls pixel dimensions.
 */
const SYMBOLS: Record<string, string[]> = {
  play: [
    '█   ',
    '██  ',
    '███ ',
    '████',
    '███ ',
    '██  ',
    '█   ',
  ],
  pause: [
    '██ ██',
    '██ ██',
    '██ ██',
    '██ ██',
    '██ ██',
    '██ ██',
    '██ ██',
  ],
  stop: [
    '██████',
    '██████',
    '██████',
    '██████',
    '██████',
    '██████',
  ],
  'skip-next': [
    '█    █',
    '██   █',
    '███  █',
    '████ █',
    '███  █',
    '██   █',
    '█    █',
  ],
  'skip-prev': [
    '█    █',
    '█   ██',
    '█  ███',
    '█ ████',
    '█  ███',
    '█   ██',
    '█    █',
  ],
  check: [
    '      █',
    '     ██',
    '    ██ ',
    '█  ██  ',
    '████   ',
    ' ██    ',
  ],
  close: [
    '█   █',
    ' █ █ ',
    '  █  ',
    ' █ █ ',
    '█   █',
  ],
  'arrow-up': [
    '  █  ',
    ' ███ ',
    '█████',
    '  █  ',
    '  █  ',
    '  █  ',
  ],
  'arrow-down': [
    '  █  ',
    '  █  ',
    '  █  ',
    '█████',
    ' ███ ',
    '  █  ',
  ],
  'arrow-left': [
    '  █   ',
    ' █    ',
    '██████',
    ' █    ',
    '  █   ',
  ],
  'arrow-right': [
    '   █  ',
    '    █ ',
    '██████',
    '    █ ',
    '   █  ',
  ],
  circle: [
    ' ███ ',
    '█████',
    '█████',
    '█████',
    ' ███ ',
  ],
  'circle-outline': [
    ' ███ ',
    '█   █',
    '█   █',
    '█   █',
    ' ███ ',
  ],
  dot: [
    '██',
    '██',
  ],
  plus: [
    '  █  ',
    '  █  ',
    '█████',
    '  █  ',
    '  █  ',
  ],
  minus: [
    '     ',
    '     ',
    '█████',
    '     ',
    '     ',
  ],
  heart: [
    ' █ █ ',
    '█████',
    '█████',
    ' ███ ',
    '  █  ',
  ],
  star: [
    '  █  ',
    ' ███ ',
    '█████',
    ' ███ ',
    '█ █ █',
  ],
  volume: [
    '  █  ',
    ' ██ █',
    '███ █',
    ' ██ █',
    '  █  ',
  ],
  mute: [
    '  █  █',
    ' ██ █ ',
    '████  ',
    ' ██ █ ',
    '  █  █',
  ],
  'chevron-right': [
    '█  ',
    ' █ ',
    '  █',
    ' █ ',
    '█  ',
  ],
  'chevron-left': [
    '  █',
    ' █ ',
    '█  ',
    ' █ ',
    '  █',
  ],
  menu: [
    '█████',
    '     ',
    '█████',
    '     ',
    '█████',
  ],
};

export interface PixelArtOptions {
  /** Pixel size in logical units (default: 4) */
  size?: number;
  /** Single fill color for all pixels */
  color?: string;
  /** Per-row fill colors (overrides color). Falls back to color for rows beyond array length. */
  colors?: string[];
  /** Gap between pixels in logical units (default: 0) */
  gap?: number;
}

export interface PixelArtProps extends PixelArtOptions {
  /** Built-in symbol name OR array of string art lines */
  art: string | string[];
  /** Container style overrides */
  style?: Style;
}

/**
 * Parse art input into a boolean grid.
 * Any non-space character = filled pixel.
 */
function parseGrid(art: string | string[]): boolean[][] {
  const lines = typeof art === 'string'
    ? (SYMBOLS[art] ?? art.split('\n'))
    : art;
  return lines.map(line => [...line].map(ch => ch !== ' '));
}

/**
 * Hook: convert symbol name or string art into a memoized React element.
 */
export function usePixelArt(
  art: string | string[],
  options: PixelArtOptions = {},
): React.ReactElement {
  const { size = 4, color = '#ffffff', colors, gap = 0 } = options;

  return useMemo(() => {
    const grid = parseGrid(art);
    return renderGrid(grid, size, color, colors, gap);
  }, [art, size, color, colors, gap]);
}

/**
 * Component: declarative pixel art rendering.
 *
 * <PixelArt art="play" size={4} color="#fff" />
 * <PixelArt art={heartLines} size={12} colors={heartColors} />
 */
export function PixelArt({ art, size, color, colors, gap, style }: PixelArtProps) {
  const element = usePixelArt(art, { size, color, colors, gap });
  if (style) {
    return <Box style={style}>{element}</Box>;
  }
  return element;
}

/** Get the list of available built-in symbol names. */
export function getPixelArtSymbols(): string[] {
  return Object.keys(SYMBOLS);
}

/* ── Internal renderer ────────────────────────────────────────── */

function renderGrid(
  grid: boolean[][],
  size: number,
  color: string,
  colors: string[] | undefined,
  gap: number,
): React.ReactElement {
  return (
    <Box style={{ flexDirection: 'column', gap }}>
      {grid.map((row, r) => (
        <Box key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((filled, c) => (
            <Box key={c} style={{
              width: size,
              height: size,
              backgroundColor: filled
                ? (colors && colors[r] !== undefined ? colors[r] : color)
                : 'transparent',
            }} />
          ))}
        </Box>
      ))}
    </Box>
  );
}
