/**
 * NOCLIP — Walk Through Your Machine
 *
 * First-person navigable 3D maze whose walls pulse with live system telemetry.
 * Toggle no-clip to phase through geometry. CRT/VHS post-processing.
 * WASD + arrow keys for continuous movement. N=noclip, C=crt, V=vhs.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Box, Text, Badge, Pressable, ProgressBar, Sparkline,
  useHotkey, useLoveEvent, useSystemMonitor, useLuaInterval,
} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';
import { Scanlines } from '../../../packages/core/src/masks/Scanlines';
import { VHS } from '../../../packages/core/src/masks/VHS';

// ── Types ────────────────────────────────────────────

type Cell = { n: boolean; s: boolean; e: boolean; w: boolean };
type Vec3 = [number, number, number];

// ── Maze Generation (recursive backtracker) ──────────

function generateMaze(rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = { n: true, s: true, e: true, w: true };
    }
  }

  const visited = new Set<string>();
  const stack: [number, number][] = [];
  const key = (r: number, c: number) => `${r},${c}`;

  visited.add(key(0, 0));
  stack.push([0, 0]);

  const dirs: { dr: number; dc: number; from: keyof Cell; to: keyof Cell }[] = [
    { dr: -1, dc: 0, from: 'n', to: 's' },
    { dr: 1, dc: 0, from: 's', to: 'n' },
    { dr: 0, dc: 1, from: 'e', to: 'w' },
    { dr: 0, dc: -1, from: 'w', to: 'e' },
  ];

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const neighbors = dirs
      .map((d) => ({ ...d, nr: cr + d.dr, nc: cc + d.dc }))
      .filter((d) => d.nr >= 0 && d.nr < rows && d.nc >= 0 && d.nc < cols && !visited.has(key(d.nr, d.nc)));

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[cr][cc][pick.from] = false;
    grid[pick.nr][pick.nc][pick.to] = false;
    visited.add(key(pick.nr, pick.nc));
    stack.push([pick.nr, pick.nc]);
  }

  return grid;
}

// ── Wall mesh list from maze grid ────────────────────

type WallDef = { pos: Vec3; scale: Vec3; special: boolean; seed: number };

function mazeToWalls(grid: Cell[][], cellSize: number): WallDef[] {
  const walls: WallDef[] = [];
  const rows = grid.length;
  const cols = grid[0].length;
  const wallH = 1.2;
  const wallT = 0.08;
  let seedCounter = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * cellSize;
      const cy = r * cellSize;

      if (grid[r][c].n) {
        walls.push({
          pos: [cx + cellSize / 2, cy, wallH / 2],
          scale: [cellSize + wallT, wallT, wallH],
          special: seedCounter % 7 === 0,
          seed: seedCounter++,
        });
      }
      if (grid[r][c].w) {
        walls.push({
          pos: [cx, cy + cellSize / 2, wallH / 2],
          scale: [wallT, cellSize + wallT, wallH],
          special: seedCounter % 11 === 0,
          seed: seedCounter++,
        });
      }
    }
  }

  // South boundary
  for (let c = 0; c < cols; c++) {
    walls.push({
      pos: [c * cellSize + cellSize / 2, rows * cellSize, wallH / 2],
      scale: [cellSize + wallT, wallT, wallH],
      special: false,
      seed: seedCounter++,
    });
  }
  // East boundary
  for (let r = 0; r < rows; r++) {
    walls.push({
      pos: [cols * cellSize, r * cellSize + cellSize / 2, wallH / 2],
      scale: [wallT, cellSize + wallT, wallH],
      special: false,
      seed: seedCounter++,
    });
  }

  return walls;
}

// ── Collision detection ──────────────────────────────

function canMove(
  grid: Cell[][],
  cellSize: number,
  ox: number,
  oy: number,
  nx: number,
  ny: number,
): boolean {
  const rows = grid.length;
  const cols = grid[0].length;
  const margin = 0.15;

  if (nx - margin < 0 || ny - margin < 0) return false;
  if (nx + margin > cols * cellSize || ny + margin > rows * cellSize) return false;

  const cr = Math.floor(oy / cellSize);
  const cc = Math.floor(ox / cellSize);
  const nr = Math.floor(ny / cellSize);
  const nc = Math.floor(nx / cellSize);

  if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) return false;
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false;

  if (nr < cr && grid[cr][cc].n) return false;
  if (nr > cr && grid[cr][cc].s) return false;
  if (nc > cc && grid[cr][cc].e) return false;
  if (nc < cc && grid[cr][cc].w) return false;

  return true;
}

// ── CPU load → color ─────────────────────────────────

function loadColor(pct: number): string {
  const t = Math.min(1, Math.max(0, pct / 100));
  const r = Math.round(26 + t * (139 - 26));
  const g = Math.round(58 + t * (26 - 58));
  const b = Math.round(92 + t * (26 - 92));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Constants ────────────────────────────────────────

const MAZE_ROWS = 8;
const MAZE_COLS = 8;
const CELL_SIZE = 2.0;
const MOVE_SPEED = 0.06;
const TURN_SPEED = 0.04;
const CAM_HEIGHT = 0.55;
const HISTORY_LEN = 30;

// ── Main Story ───────────────────────────────────────

export function NoclipMazeStory() {
  const c = useThemeColors();
  const sys = useSystemMonitor(1000, { processLimit: 5 });

  // Maze state — generate once
  const maze = useMemo(() => generateMaze(MAZE_ROWS, MAZE_COLS), []);
  const walls = useMemo(() => mazeToWalls(maze, CELL_SIZE), [maze]);

  // Player state stored in ref for the game loop, mirrored to state for rendering
  const playerRef = useRef({ x: CELL_SIZE * 0.5, y: CELL_SIZE * 0.5, facing: Math.PI / 2 });
  const [playerState, setPlayerState] = useState({ x: CELL_SIZE * 0.5, y: CELL_SIZE * 0.5, facing: Math.PI / 2 });

  // Toggles
  const [noclip, setNoclip] = useState(false);
  const [showCrt, setShowCrt] = useState(true);
  const [showVhs, setShowVhs] = useState(false);
  const noclipRef = useRef(false);
  noclipRef.current = noclip;

  // Held keys — tracked via raw keydown/keyup bridge events
  const heldKeys = useRef(new Set<string>());

  useLoveEvent('keydown', useCallback((e: any) => {
    const k = (e.key ?? '').toLowerCase();
    heldKeys.current.add(k);
  }, []));

  useLoveEvent('keyup', useCallback((e: any) => {
    const k = (e.key ?? '').toLowerCase();
    heldKeys.current.delete(k);
  }, []));

  // Toggle hotkeys (press-once)
  useHotkey('n', () => setNoclip((v) => !v));
  useHotkey('c', () => setShowCrt((v) => !v));
  useHotkey('v', () => setShowVhs((v) => !v));

  // CPU history for sparkline
  const cpuHistory = useRef<number[]>([]);
  useEffect(() => {
    if (sys.cpu.total !== undefined) {
      cpuHistory.current = [...cpuHistory.current.slice(-(HISTORY_LEN - 1)), sys.cpu.total];
    }
  }, [sys.cpu.total]);

  // Game loop — reads held keys, updates position, syncs to state
  useLuaInterval(16, () => {
    const keys = heldKeys.current;
    const p = playerRef.current;

    // Turning (g3d: positive angle = counterclockwise in XY plane)
    if (keys.has('arrowleft') || keys.has('left')) p.facing -= TURN_SPEED;
    if (keys.has('arrowright') || keys.has('right')) p.facing += TURN_SPEED;

    // Movement
    const cosF = Math.cos(p.facing);
    const sinF = Math.sin(p.facing);
    let nx = p.x;
    let ny = p.y;

    if (keys.has('w')) { nx += cosF * MOVE_SPEED; ny += sinF * MOVE_SPEED; }
    if (keys.has('s')) { nx -= cosF * MOVE_SPEED; ny -= sinF * MOVE_SPEED; }
    if (keys.has('a')) { nx += sinF * MOVE_SPEED; ny -= cosF * MOVE_SPEED; }
    if (keys.has('d')) { nx -= sinF * MOVE_SPEED; ny += cosF * MOVE_SPEED; }

    // Collision (skip if noclip)
    if (nx !== p.x || ny !== p.y) {
      if (noclipRef.current || canMove(maze, CELL_SIZE, p.x, p.y, nx, ny)) {
        p.x = nx;
        p.y = ny;
      }
    }

    // Sync to React state for rendering
    setPlayerState({ x: p.x, y: p.y, facing: p.facing });
  });

  // Camera derived from player state
  const { x: px, y: py, facing } = playerState;
  const camPos: Vec3 = [px, py, CAM_HEIGHT];
  const lookAt: Vec3 = [px + Math.cos(facing) * 2, py + Math.sin(facing) * 2, CAM_HEIGHT];

  // Wall color from CPU load
  const cpuLoad = sys.cpu.total ?? 0;
  const baseWallColor = loadColor(cpuLoad);
  const floorSize = MAZE_ROWS * CELL_SIZE;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a0f' }}>
      {/* Top HUD bar */}
      <Box
        style={{
          flexDirection: 'row',
          padding: 8,
          paddingLeft: 12,
          paddingRight: 12,
          gap: 12,
          alignItems: 'center',
          backgroundColor: '#0d0d14',
          borderBottomWidth: 1,
          borderColor: '#1a1a2e',
        }}
      >
        <Text style={{ fontSize: 11, color: '#666', fontWeight: 'normal' }}>NOCLIP</Text>
        <Badge label={noclip ? 'ON' : 'OFF'} variant={noclip ? 'success' : 'error'} />
        <Box style={{ width: 1, height: 14, backgroundColor: '#1a1a2e' }} />
        <Text style={{ fontSize: 10, color: '#555' }}>
          {`POS: [${px.toFixed(1)}, ${py.toFixed(1)}]`}
        </Text>
        <Box style={{ width: 1, height: 14, backgroundColor: '#1a1a2e' }} />
        <Text style={{ fontSize: 10, color: '#555' }}>
          {`FACING: ${((facing * 180 / Math.PI) % 360).toFixed(0)}\u00B0`}
        </Text>
        <Box style={{ width: 1, height: 14, backgroundColor: '#1a1a2e' }} />
        <Pressable
          onPress={() => setShowCrt((v) => !v)}
          style={{
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
            backgroundColor: showCrt ? '#183025' : '#131622',
            borderWidth: 1,
            borderColor: showCrt ? '#3b8f6b' : '#2b3040',
          }}
        >
          <Text style={{ fontSize: 9, color: showCrt ? '#9ff0cc' : '#7f8696', fontWeight: 'normal' }}>SCAN</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowVhs((v) => !v)}
          style={{
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
            backgroundColor: showVhs ? '#34271a' : '#131622',
            borderWidth: 1,
            borderColor: showVhs ? '#a57741' : '#2b3040',
          }}
        >
          <Text style={{ fontSize: 9, color: showVhs ? '#ffd9ab' : '#7f8696', fontWeight: 'normal' }}>VHS</Text>
        </Pressable>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ fontSize: 9, color: '#444' }}>
          WASD=move  Arrows=turn  N=noclip  C=scanlines  V=vhs
        </Text>
      </Box>

      {/* Main content row */}
      <Box style={{ flexDirection: 'row', flexGrow: 1 }}>
        {/* 3D Scene */}
        <Box style={{ flexGrow: 1 }}>
          {/* Keep post-processing isolated to the scene layer so UI overlays stay crisp. */}
          <Box style={{ width: '100%', height: '100%' }}>
            <Scene style={{ width: '100%', height: '100%' }} backgroundColor="#050811" stars>
              <Camera position={camPos} lookAt={lookAt} fov={1.1} near={0.05} far={80} />
              <AmbientLight color="#0e1528" intensity={0.25} />
              <DirectionalLight direction={[-0.4, 0.6, -0.5]} color="#c8d8ff" intensity={0.9} />

              {/* Floor */}
              <Mesh
                geometry="plane"
                color="#0a0e18"
                position={[floorSize / 2, floorSize / 2, 0]}
                scale={[floorSize * 1.2, floorSize * 1.2, 1]}
                edgeColor="#141e30"
                edgeWidth={0.005}
                specular={4}
              />

              {/* Walls */}
              {walls.map((w, i) => (
                <Mesh
                  key={i}
                  geometry="box"
                  color={w.special ? '#1a2844' : baseWallColor}
                  texture={w.special ? 'framework-canvas' : undefined}
                  seed={w.special ? w.seed : undefined}
                  position={w.pos}
                  scale={w.scale}
                  edgeColor="#0c1220"
                  edgeWidth={0.025}
                  specular={w.special ? 48 : 16}
                  opacity={noclip ? 0.55 : 1}
                />
              ))}
            </Scene>

            {/* Post-processing overlays (apply to scene box only). */}
            {showCrt && <Scanlines mask intensity={0.9} spacing={2} tint="#ff2bd6" />}
            {showVhs && <VHS mask intensity={0.9} tracking={0.15} noise={0.1} colorBleed={1} tint="#ff2bd6" />}
          </Box>

          {/* Minimap overlay (bottom-left of scene) */}
          <Box
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              padding: 4,
              backgroundColor: 'rgba(5,8,17,0.85)',
              borderRadius: 6,
              borderWidth: 1,
              borderColor: '#1a1a2e',
            }}
          >
            <Minimap maze={maze} px={px} py={py} cellSize={CELL_SIZE} />
          </Box>
        </Box>

        {/* Right panel — System Monitor */}
        <Box
          style={{
            width: 200,
            padding: 10,
            gap: 8,
            backgroundColor: '#0d0d14',
            borderLeftWidth: 1,
            borderColor: '#1a1a2e',
          }}
        >
          <Text style={{ fontSize: 11, color: c.text, fontWeight: 'normal' }}>SYSTEM</Text>

          {/* CPU cores */}
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>CPU CORES</Text>
            {sys.cpu.cores.slice(0, 8).map((core, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, color: '#555', width: 14 }}>{`${i}`}</Text>
                <Box style={{ flexGrow: 1 }}>
                  <ProgressBar value={(core.usage ?? 0) / 100} color={loadColor(core.usage ?? 0)} height={6} />
                </Box>
              </Box>
            ))}
          </Box>

          {/* Memory */}
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>MEMORY</Text>
            <ProgressBar
              value={sys.memory.total > 0 ? sys.memory.used / sys.memory.total : 0}
              color="#4cc2ff"
              height={8}
              showLabel
            />
            <Text style={{ fontSize: 8, color: '#555' }}>
              {`${sys.memory.used.toFixed(1)} / ${sys.memory.total.toFixed(1)} ${sys.memory.unit}`}
            </Text>
          </Box>

          {/* CPU sparkline */}
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>CPU TREND</Text>
            <Sparkline
              data={cpuHistory.current.length > 1 ? cpuHistory.current : [0, 0]}
              width={175}
              height={28}
              color="#c099ff"
            />
          </Box>

          {/* Top processes */}
          <Box style={{ gap: 3 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>TOP PROCESSES</Text>
            {sys.processes.slice(0, 5).map((p, i) => (
              <Box key={i} style={{ flexDirection: 'row', gap: 4 }}>
                <Text style={{ fontSize: 8, color: '#888', flexGrow: 1 }}>
                  {(p.command ?? '').split('/').pop()?.slice(0, 18) ?? '?'}
                </Text>
                <Text style={{ fontSize: 8, color: loadColor(p.cpu ?? 0) }}>
                  {`${(p.cpu ?? 0).toFixed(0)}%`}
                </Text>
              </Box>
            ))}
          </Box>

          {/* Toggle indicators */}
          <Box style={{ flexGrow: 1 }} />
          <Box style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label="SCAN" variant={showCrt ? 'success' : 'default'} />
            <Badge label="VHS" variant={showVhs ? 'warning' : 'default'} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Minimap Component ────────────────────────────────

function Minimap(props: { maze: Cell[][]; px: number; py: number; cellSize: number }) {
  const { maze, px, py, cellSize } = props;
  const rows = maze.length;
  const cols = maze[0].length;
  const cs = 8;

  const playerR = Math.min(rows - 1, Math.max(0, Math.floor(py / cellSize)));
  const playerC = Math.min(cols - 1, Math.max(0, Math.floor(px / cellSize)));

  return (
    <Box style={{ width: cols * cs + 2, height: rows * cs + 2 }}>
      {maze.map((row, r) => (
        <Box key={r} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => {
            const isPlayer = r === playerR && ci === playerC;
            return (
              <Box
                key={ci}
                style={{
                  width: cs,
                  height: cs,
                  backgroundColor: isPlayer ? '#4cc2ff' : '#0e1528',
                  borderTopWidth: cell.n ? 1 : 0,
                  borderLeftWidth: cell.w ? 1 : 0,
                  borderRightWidth: ci === cols - 1 && cell.e ? 1 : 0,
                  borderBottomWidth: r === rows - 1 && cell.s ? 1 : 0,
                  borderColor: '#2a3a5c',
                }}
              />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
