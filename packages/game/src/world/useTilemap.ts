import { useRef, useCallback, useState } from 'react';
import type { TilemapConfig, TileType, AABB } from '../types';

export interface TilemapState {
  width: number;
  height: number;
  tileSize: number;
  tileTypes: Record<number, TileType>;
  /** Get tile ID at grid position in a layer */
  getTile: (layer: string, gx: number, gy: number) => number;
  /** Set tile ID at grid position in a layer */
  setTile: (layer: string, gx: number, gy: number, tileId: number) => void;
  /** Check if a grid position is solid (any layer) */
  isSolid: (gx: number, gy: number) => boolean;
  /** Get all solid rectangles as AABBs (for collision) */
  solids: AABB[];
  /** Convert pixel coords to grid coords */
  worldToGrid: (px: number, py: number) => { gx: number; gy: number };
  /** Convert grid coords to pixel coords (top-left of tile) */
  gridToWorld: (gx: number, gy: number) => { px: number; py: number };
  /** Load a 2D array into a layer */
  loadLayer: (layer: string, tiles: number[][]) => void;
  /** Get a layer's 2D array */
  getLayer: (layer: string) => number[][] | undefined;
  /** All layer names */
  layerNames: string[];
}

function createEmptyGrid(width: number, height: number): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Array(width).fill(0);
  }
  return grid;
}

export function useTilemap(config: TilemapConfig): TilemapState {
  const { width, height, tileSize, layers: initialLayers, tileTypes: initialTileTypes } = config;

  const [, forceRender] = useState(0);
  const layersRef = useRef<Record<string, number[][]>>({});
  const tileTypesRef = useRef<Record<number, TileType>>(initialTileTypes ?? {
    0: { name: 'empty', solid: false, color: null },
    1: { name: 'floor', solid: false, color: '#2a2a3a' },
    2: { name: 'wall', solid: true, color: '#5a5a7a' },
  });

  // Initialize layers
  if (Object.keys(layersRef.current).length === 0) {
    if (initialLayers) {
      layersRef.current = { ...initialLayers };
    } else {
      layersRef.current = { ground: createEmptyGrid(width, height) };
    }
  }

  const getTile = useCallback((layer: string, gx: number, gy: number): number => {
    const l = layersRef.current[layer];
    if (!l || gy < 0 || gy >= height || gx < 0 || gx >= width) return 0;
    return l[gy][gx];
  }, [width, height]);

  const setTile = useCallback((layer: string, gx: number, gy: number, tileId: number) => {
    const l = layersRef.current[layer];
    if (!l || gy < 0 || gy >= height || gx < 0 || gx >= width) return;
    l[gy][gx] = tileId;
    forceRender(n => n + 1);
  }, [width, height]);

  const isSolid = useCallback((gx: number, gy: number): boolean => {
    if (gx < 0 || gx >= width || gy < 0 || gy >= height) return true; // Out of bounds = solid
    for (const layer of Object.values(layersRef.current)) {
      const tileId = layer[gy]?.[gx] ?? 0;
      const tt = tileTypesRef.current[tileId];
      if (tt?.solid) return true;
    }
    return false;
  }, [width, height]);

  // Compute solid AABBs
  const computeSolids = useCallback((): AABB[] => {
    const rects: AABB[] = [];
    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        if (isSolid(gx, gy)) {
          rects.push({
            x: gx * tileSize,
            y: gy * tileSize,
            width: tileSize,
            height: tileSize,
          });
        }
      }
    }
    return rects;
  }, [width, height, tileSize, isSolid]);

  const worldToGrid = useCallback((px: number, py: number) => ({
    gx: Math.floor(px / tileSize),
    gy: Math.floor(py / tileSize),
  }), [tileSize]);

  const gridToWorld = useCallback((gx: number, gy: number) => ({
    px: gx * tileSize,
    py: gy * tileSize,
  }), [tileSize]);

  const loadLayer = useCallback((layer: string, tiles: number[][]) => {
    layersRef.current[layer] = tiles;
    forceRender(n => n + 1);
  }, []);

  const getLayer = useCallback((layer: string) => {
    return layersRef.current[layer];
  }, []);

  return {
    width,
    height,
    tileSize,
    tileTypes: tileTypesRef.current,
    getTile,
    setTile,
    isSolid,
    solids: computeSolids(),
    worldToGrid,
    gridToWorld,
    loadLayer,
    getLayer,
    layerNames: Object.keys(layersRef.current),
  };
}
