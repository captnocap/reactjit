import { useCallback } from 'react';
import type { Vec2, PathfindingConfig } from '../types';
import type { TilemapState } from './useTilemap';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

function heuristic(
  ax: number, ay: number, bx: number, by: number,
  type: 'manhattan' | 'euclidean' | 'octile',
): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  switch (type) {
    case 'euclidean': return Math.sqrt(dx * dx + dy * dy);
    case 'octile': return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    default: return dx + dy; // manhattan
  }
}

export interface PathfindingResult {
  /** Find a path between two world positions. Returns grid coordinates or null if no path. */
  findPath: (from: Vec2, to: Vec2) => Vec2[] | null;
  /** Find path between grid coordinates directly */
  findPathGrid: (fromGx: number, fromGy: number, toGx: number, toGy: number) => Vec2[] | null;
}

export function usePathfinding(tilemap: TilemapState, config: PathfindingConfig = {}): PathfindingResult {
  const { allowDiagonal = false, heuristic: heuristicType = 'manhattan', maxSearchNodes = 1000 } = config;

  const findPathGrid = useCallback((
    fromGx: number, fromGy: number, toGx: number, toGy: number,
  ): Vec2[] | null => {
    // A* implementation
    const key = (x: number, y: number) => `${x},${y}`;

    const open: PathNode[] = [{
      x: fromGx, y: fromGy, g: 0,
      h: heuristic(fromGx, fromGy, toGx, toGy, heuristicType),
      f: heuristic(fromGx, fromGy, toGx, toGy, heuristicType),
      parent: null,
    }];

    const closed = new Set<string>();
    const gScores = new Map<string, number>();
    gScores.set(key(fromGx, fromGy), 0);

    let searched = 0;

    const dirs = allowDiagonal
      ? [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
      : [[-1,0],[1,0],[0,-1],[0,1]];

    while (open.length > 0 && searched < maxSearchNodes) {
      searched++;

      // Find lowest f in open list
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i;
      }
      const current = open.splice(bestIdx, 1)[0];
      const ck = key(current.x, current.y);

      if (current.x === toGx && current.y === toGy) {
        // Reconstruct path
        const path: Vec2[] = [];
        let node: PathNode | null = current;
        while (node) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }

      closed.add(ck);

      for (const [dx, dy] of dirs) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nk = key(nx, ny);

        if (closed.has(nk)) continue;
        if (nx < 0 || nx >= tilemap.width || ny < 0 || ny >= tilemap.height) continue;
        if (tilemap.isSolid(nx, ny)) continue;

        // Diagonal: don't cut corners
        if (dx !== 0 && dy !== 0) {
          if (tilemap.isSolid(current.x + dx, current.y) ||
              tilemap.isSolid(current.x, current.y + dy)) continue;
        }

        const moveCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
        const tentativeG = current.g + moveCost;
        const existingG = gScores.get(nk);

        if (existingG !== undefined && tentativeG >= existingG) continue;

        gScores.set(nk, tentativeG);
        const h = heuristic(nx, ny, toGx, toGy, heuristicType);
        open.push({
          x: nx, y: ny, g: tentativeG, h, f: tentativeG + h, parent: current,
        });
      }
    }

    return null; // No path found
  }, [tilemap, allowDiagonal, heuristicType, maxSearchNodes]);

  const findPath = useCallback((from: Vec2, to: Vec2): Vec2[] | null => {
    const fg = tilemap.worldToGrid(from.x, from.y);
    const tg = tilemap.worldToGrid(to.x, to.y);
    return findPathGrid(fg.gx, fg.gy, tg.gx, tg.gy);
  }, [tilemap, findPathGrid]);

  return { findPath, findPathGrid };
}
