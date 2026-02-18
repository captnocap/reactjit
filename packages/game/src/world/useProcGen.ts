import { useCallback, useMemo } from 'react';
import type { AABB, BSPDungeonConfig, BSPDungeonResult, CellularAutomataConfig } from '../types';

/** BSP dungeon generation */
function generateBSPDungeon(config: BSPDungeonConfig): BSPDungeonResult {
  const {
    width, height,
    minRoomSize = 5, maxRoomSize = 12,
    corridorWidth = 2,
  } = config;

  // Initialize all walls
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array(width).fill(2); // 2 = wall
  }

  const rooms: AABB[] = [];
  const corridors: AABB[] = [];

  // BSP tree node
  interface BSPNode {
    x: number; y: number; w: number; h: number;
    left?: BSPNode; right?: BSPNode;
    room?: AABB;
  }

  function splitNode(node: BSPNode, depth: number): void {
    if (depth <= 0 || node.w < minRoomSize * 2 + 3 && node.h < minRoomSize * 2 + 3) {
      // Create room in this leaf
      const rw = minRoomSize + Math.floor(Math.random() * (Math.min(maxRoomSize, node.w - 2) - minRoomSize + 1));
      const rh = minRoomSize + Math.floor(Math.random() * (Math.min(maxRoomSize, node.h - 2) - minRoomSize + 1));
      const rx = node.x + 1 + Math.floor(Math.random() * (node.w - rw - 2));
      const ry = node.y + 1 + Math.floor(Math.random() * (node.h - rh - 2));
      node.room = { x: rx, y: ry, width: rw, height: rh };
      rooms.push(node.room);

      // Carve room into tiles
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            tiles[y][x] = 1; // 1 = floor
          }
        }
      }
      return;
    }

    // Split horizontally or vertically
    const splitH = node.w > node.h ? false : node.h > node.w ? true : Math.random() > 0.5;

    if (splitH && node.h >= minRoomSize * 2 + 3) {
      const split = Math.floor(node.h * (0.35 + Math.random() * 0.3));
      node.left = { x: node.x, y: node.y, w: node.w, h: split };
      node.right = { x: node.x, y: node.y + split, w: node.w, h: node.h - split };
    } else if (!splitH && node.w >= minRoomSize * 2 + 3) {
      const split = Math.floor(node.w * (0.35 + Math.random() * 0.3));
      node.left = { x: node.x, y: node.y, w: split, h: node.h };
      node.right = { x: node.x + split, y: node.y, w: node.w - split, h: node.h };
    } else {
      // Can't split further, make a room
      splitNode(node, 0);
      return;
    }

    splitNode(node.left, depth - 1);
    splitNode(node.right, depth - 1);

    // Connect the two halves with a corridor
    const roomA = getRoom(node.left);
    const roomB = getRoom(node.right);
    if (roomA && roomB) {
      connectRooms(roomA, roomB);
    }
  }

  function getRoom(node: BSPNode): AABB | null {
    if (node.room) return node.room;
    if (node.left) return getRoom(node.left);
    if (node.right) return getRoom(node.right);
    return null;
  }

  function connectRooms(a: AABB, b: AABB) {
    const ax = Math.floor(a.x + a.width / 2);
    const ay = Math.floor(a.y + a.height / 2);
    const bx = Math.floor(b.x + b.width / 2);
    const by = Math.floor(b.y + b.height / 2);

    // L-shaped corridor
    const hw = Math.max(1, Math.floor(corridorWidth / 2));

    if (Math.random() > 0.5) {
      // Horizontal then vertical
      carveCorridor(ax, ay, bx, ay, hw);
      carveCorridor(bx, ay, bx, by, hw);
    } else {
      // Vertical then horizontal
      carveCorridor(ax, ay, ax, by, hw);
      carveCorridor(ax, by, bx, by, hw);
    }
  }

  function carveCorridor(x1: number, y1: number, x2: number, y2: number, hw: number) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    for (let y = minY - hw; y <= maxY + hw; y++) {
      for (let x = minX - hw; x <= maxX + hw; x++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          tiles[y][x] = 1;
        }
      }
    }

    corridors.push({
      x: minX - hw,
      y: minY - hw,
      width: maxX - minX + hw * 2 + 1,
      height: maxY - minY + hw * 2 + 1,
    });
  }

  const root: BSPNode = { x: 0, y: 0, w: width, h: height };
  const maxDepth = Math.floor(Math.log2(Math.min(width, height) / minRoomSize));
  splitNode(root, maxDepth);

  return { rooms, corridors, tiles };
}

/** Cellular automata cave generation */
function generateCellularAutomata(config: CellularAutomataConfig): number[][] {
  const {
    width, height,
    fillChance = 0.45,
    iterations = 5,
    birthLimit = 4,
    deathLimit = 3,
  } = config;

  // Initialize random grid
  let grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      // Border is always wall
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        grid[y][x] = 2;
      } else {
        grid[y][x] = Math.random() < fillChance ? 2 : 1;
      }
    }
  }

  // Run automata iterations
  for (let i = 0; i < iterations; i++) {
    const newGrid: number[][] = [];
    for (let y = 0; y < height; y++) {
      newGrid[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          newGrid[y][x] = 2;
          continue;
        }

        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || grid[ny][nx] === 2) {
              neighbors++;
            }
          }
        }

        if (grid[y][x] === 2) {
          newGrid[y][x] = neighbors >= deathLimit ? 2 : 1;
        } else {
          newGrid[y][x] = neighbors >= birthLimit ? 2 : 1;
        }
      }
    }
    grid = newGrid;
  }

  return grid;
}

/** Simple 2D Perlin-like noise using value noise with smoothstep interpolation */
function generateNoise(width: number, height: number, scale: number): number[][] {
  // Generate random lattice
  const gridSize = Math.max(2, Math.ceil(Math.max(width, height) * scale) + 2);
  const lattice: number[][] = [];
  for (let y = 0; y < gridSize; y++) {
    lattice[y] = [];
    for (let x = 0; x < gridSize; x++) {
      lattice[y][x] = Math.random();
    }
  }

  function smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  function sample(px: number, py: number): number {
    const sx = px * scale;
    const sy = py * scale;
    const x0 = Math.floor(sx);
    const y0 = Math.floor(sy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = smoothstep(sx - x0);
    const fy = smoothstep(sy - y0);

    const gx0 = Math.min(x0, gridSize - 1);
    const gx1 = Math.min(x1, gridSize - 1);
    const gy0 = Math.min(y0, gridSize - 1);
    const gy1 = Math.min(y1, gridSize - 1);

    const top = lattice[gy0][gx0] * (1 - fx) + lattice[gy0][gx1] * fx;
    const bottom = lattice[gy1][gx0] * (1 - fx) + lattice[gy1][gx1] * fx;
    return top * (1 - fy) + bottom * fy;
  }

  const result: number[][] = [];
  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      result[y][x] = sample(x, y);
    }
  }
  return result;
}

export interface ProcGenResult {
  /** Generate a BSP dungeon */
  bspDungeon: (config: BSPDungeonConfig) => BSPDungeonResult;
  /** Generate a cave using cellular automata */
  cellularAutomata: (config: CellularAutomataConfig) => number[][];
  /** Generate a 2D noise field (0-1 values) */
  noise: (width: number, height: number, scale: number) => number[][];
}

export function useProcGen(): ProcGenResult {
  const bspDungeon = useCallback((config: BSPDungeonConfig) => {
    return generateBSPDungeon(config);
  }, []);

  const cellularAutomata = useCallback((config: CellularAutomataConfig) => {
    return generateCellularAutomata(config);
  }, []);

  const noise = useCallback((w: number, h: number, scale: number) => {
    return generateNoise(w, h, scale);
  }, []);

  return { bspDungeon, cellularAutomata, noise };
}
