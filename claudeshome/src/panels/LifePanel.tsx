/**
 * LifePanel — Conway's Game of Life simulation.
 *
 * Renders a grid as a single Text element using Unicode block characters.
 * Click cells to toggle, press play to watch patterns evolve.
 * Includes classic pattern presets (glider, pulsar, gosper gun).
 */
import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const COLS = 40;
const ROWS = 24;
const ALIVE = '\u2588'; // █
const DEAD  = '\u00B7'; // ·

type Grid = boolean[][];

function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(false));
}

function randomGrid(): Grid {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.random() < 0.3)
  );
}

function countNeighbors(grid: Grid, r: number, c: number): number {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = (r + dr + ROWS) % ROWS;
      const nc = (c + dc + COLS) % COLS;
      if (grid[nr][nc]) count++;
    }
  }
  return count;
}

function step(grid: Grid): Grid {
  return grid.map((row, r) =>
    row.map((alive, c) => {
      const n = countNeighbors(grid, r, c);
      return alive ? (n === 2 || n === 3) : (n === 3);
    })
  );
}

function gridToString(grid: Grid): string {
  return grid.map(row =>
    row.map(cell => cell ? ALIVE : DEAD).join('')
  ).join('\n');
}

function countAlive(grid: Grid): number {
  return grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

// ── Classic patterns ─────────────────────────────────────────────────

function placePattern(grid: Grid, pattern: [number, number][], offsetR: number, offsetC: number): Grid {
  const next = grid.map(row => [...row]);
  for (const [r, c] of pattern) {
    const pr = (offsetR + r) % ROWS;
    const pc = (offsetC + c) % COLS;
    next[pr][pc] = true;
  }
  return next;
}

const GLIDER: [number, number][] = [[0,1],[1,2],[2,0],[2,1],[2,2]];

const PULSAR: [number, number][] = [
  [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
  [2,0],[2,5],[2,7],[2,12],
  [3,0],[3,5],[3,7],[3,12],
  [4,0],[4,5],[4,7],[4,12],
  [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
  [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
  [8,0],[8,5],[8,7],[8,12],
  [9,0],[9,5],[9,7],[9,12],
  [10,0],[10,5],[10,7],[10,12],
  [12,2],[12,3],[12,4],[12,8],[12,9],[12,10],
];

const LWSS: [number, number][] = [[0,1],[0,4],[1,0],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3]];

const RPENTOMINO: [number, number][] = [[0,1],[0,2],[1,0],[1,1],[2,1]];

interface Preset {
  label: string;
  pattern: [number, number][];
  offsetR: number;
  offsetC: number;
}

const PRESETS: Preset[] = [
  { label: 'Glider',     pattern: GLIDER,    offsetR: 2,  offsetC: 2 },
  { label: 'Pulsar',     pattern: PULSAR,    offsetR: 5,  offsetC: 13 },
  { label: 'LWSS',       pattern: LWSS,      offsetR: 10, offsetC: 5 },
  { label: 'R-pentomino', pattern: RPENTOMINO, offsetR: 10, offsetC: 18 },
];

// ── Component ────────────────────────────────────────────────────────

export function LifePanel() {
  const [grid, setGrid] = useState<Grid>(randomGrid);
  const [running, setRunning] = useState(false);
  const [gen, setGen] = useState(0);
  const [speed, setSpeed] = useState(150);

  // Staggered: life sim at 150ms (unique, animation-class)
  useLuaInterval(running ? speed : null, () => {
    setGrid(prev => step(prev));
    setGen(g => g + 1);
  });

  const toggleCell = useCallback((r: number, c: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = !next[r][c];
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    setGrid(emptyGrid());
    setGen(0);
    setRunning(false);
  }, []);

  const handleRandom = useCallback(() => {
    setGrid(randomGrid());
    setGen(0);
  }, []);

  const handlePreset = useCallback((preset: Preset) => {
    const base = emptyGrid();
    setGrid(placePattern(base, preset.pattern, preset.offsetR, preset.offsetC));
    setGen(0);
    setRunning(false);
  }, []);

  const alive = countAlive(grid);
  const display = gridToString(grid);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 6,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'LIFE'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>{`gen ${gen}`}</Text>
          <Text style={{ fontSize: 8, color: alive > 0 ? C.approve : C.textMuted }}>{`${alive} alive`}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={() => setRunning(r => !r)} style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1,
            borderColor: running ? C.deny + '66' : C.approve + '66',
            backgroundColor: running ? C.deny + '11' : C.approve + '11',
          }}>
            <Text style={{ fontSize: 8, color: running ? C.deny : C.approve }}>
              {running ? 'pause' : 'play'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setGrid(prev => step(prev)); setGen(g => g + 1); }} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: C.textDim }}>{'step'}</Text>
          </Pressable>
          <Pressable onPress={handleRandom} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: C.textDim }}>{'random'}</Text>
          </Pressable>
          <Pressable onPress={handleClear} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: C.textDim }}>{'clear'}</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Speed + presets */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4,
        borderBottomWidth: 1, borderColor: C.border + '55', flexShrink: 0,
      }}>
        <Text style={{ fontSize: 8, color: C.textMuted }}>{'speed:'}</Text>
        {[300, 150, 75, 30].map(s => (
          <Pressable key={s} onPress={() => setSpeed(s)} style={{
            paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
            borderRadius: 2, backgroundColor: speed === s ? C.accentDim + '33' : 'transparent',
          }}>
            <Text style={{ fontSize: 7, color: speed === s ? C.accent : C.textDim }}>
              {s === 300 ? 'slow' : s === 150 ? 'med' : s === 75 ? 'fast' : 'turbo'}
            </Text>
          </Pressable>
        ))}
        <Text style={{ fontSize: 8, color: C.textMuted, marginLeft: 8 }}>{'presets:'}</Text>
        {PRESETS.map(p => (
          <Pressable key={p.label} onPress={() => handlePreset(p)} style={{
            paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
            borderRadius: 2, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 7, color: C.textDim }}>{p.label}</Text>
          </Pressable>
        ))}
      </Box>

      {/* Grid display */}
      <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 4 }}>
        <Text style={{
          fontSize: 7,
          lineHeight: 8,
          color: C.approve,
          letterSpacing: 0.5,
          fontFamily: 'monospace',
        }}>
          {display}
        </Text>
      </Box>
    </Box>
  );
}
