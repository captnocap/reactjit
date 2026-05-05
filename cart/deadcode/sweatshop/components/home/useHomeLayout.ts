
import { useCallback, useState } from 'react';

export type TileType =
  | 'recent'
  | 'scratch'
  | 'launch'
  | 'theme'
  | 'shader'
  | 'clock'
  | 'weatherless'
  | 'stats';

export interface HomeTileDef {
  id: string;
  type: TileType;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Default layout: tiles placed in a 3-column grid centered around (0,0)
// so they are visible with the default camera at (0,0) on a 1280x800 viewport.
// gx/gy are CENTER coordinates in the Canvas graph space.
const DEFAULT_TILES: HomeTileDef[] = [
  { id: 't-clock', type: 'clock', x: -300, y: -250, w: 220, h: 140 },
  { id: 't-theme', type: 'theme', x: 0, y: -250, w: 180, h: 140 },
  { id: 't-recent', type: 'recent', x: 300, y: -250, w: 280, h: 240 },
  { id: 't-stats', type: 'stats', x: -300, y: -80, w: 220, h: 140 },
  { id: 't-launch', type: 'launch', x: 0, y: -80, w: 180, h: 200 },
  { id: 't-shader', type: 'shader', x: -300, y: 90, w: 300, h: 200 },
  { id: 't-weatherless', type: 'weatherless', x: 0, y: 90, w: 200, h: 140 },
  { id: 't-scratch', type: 'scratch', x: 300, y: 90, w: 280, h: 240 },
];

const STORAGE_KEY = 'sweatshop_home_layout_v1';

function clampLayout(tiles: HomeTileDef[]): HomeTileDef[] {
  // Defensive: keep tiles within a reasonable viewport so they don't wander
  // off-screen due to corrupted localstore or coordinate-system mismatches.
  const MAX_XY = 1200;
  return tiles.map((t) => ({
    ...t,
    x: Math.max(-MAX_XY, Math.min(MAX_XY, t.x)),
    y: Math.max(-MAX_XY, Math.min(MAX_XY, t.y)),
    w: Math.max(80, Math.min(800, t.w)),
    h: Math.max(60, Math.min(600, t.h)),
  }));
}

function normalizeVisibleLayout(tiles: HomeTileDef[]): HomeTileDef[] {
  const clamped = clampLayout(tiles);
  const minX = Math.min(...clamped.map((t) => t.x));
  const minY = Math.min(...clamped.map((t) => t.y));
  if (minX >= 0 && minY >= 0) return clamped;
  const dx = minX < 0 ? 80 - minX : 0;
  const dy = minY < 0 ? 80 - minY : 0;
  return clamped.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
}

function loadLayout(): HomeTileDef[] {
  try {
    const raw = (globalThis as any).__localstore_get?.(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeVisibleLayout(parsed);
        }
      }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_TILES));
}

function saveLayout(tiles: HomeTileDef[]) {
  try {
    (globalThis as any).__localstore_set?.(STORAGE_KEY, JSON.stringify(tiles));
  } catch {}
}

export function useHomeLayout() {
  const [tiles, setTiles] = useState<HomeTileDef[]>(loadLayout);

  const updateTile = useCallback((id: string, patch: Partial<HomeTileDef>) => {
    setTiles((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      saveLayout(next);
      return next;
    });
  }, []);

  const removeTile = useCallback((id: string) => {
    setTiles((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveLayout(next);
      return next;
    });
  }, []);

  const addTile = useCallback((type: TileType) => {
    setTiles((prev) => {
      const id = 't-' + type + '-' + Math.random().toString(36).slice(2, 7);
      // Find a free spot by simple grid scan around the origin
      const cols = 3;
      const baseW = 200;
      const baseH = 160;
      const gap = 20;
      let x = 80;
      let y = 80;
      let placed = false;
      for (let row = 0; row < 6 && !placed; row++) {
        for (let col = 0; col < cols && !placed; col++) {
          const cx = 80 + col * (baseW + gap);
          const cy = 80 + row * (baseH + gap);
          const overlap = prev.some((t) => !(cx + baseW < t.x - t.w / 2 || cx > t.x + t.w / 2 || cy + baseH < t.y - t.h / 2 || cy > t.y + t.h / 2));
          if (!overlap) {
            x = cx + baseW / 2;
            y = cy + baseH / 2;
            placed = true;
          }
        }
      }
      const next = [...prev, { id, type, x, y, w: baseW, h: baseH }];
      saveLayout(next);
      return next;
    });
  }, []);

  const resetLayout = useCallback(() => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_TILES));
    setTiles(fresh);
    saveLayout(fresh);
  }, []);

  return { tiles, updateTile, removeTile, addTile, resetLayout };
}
