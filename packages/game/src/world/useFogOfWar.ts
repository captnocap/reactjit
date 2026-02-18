import { useRef, useCallback, useState } from 'react';
import type { Visibility } from '../types';

export interface FogOfWarConfig {
  width: number;
  height: number;
}

export interface FogOfWarState {
  /** Get visibility at grid position */
  getVisibility: (gx: number, gy: number) => Visibility;
  /** Reveal an area (mark as 'revealed' permanently, 'visible' for current frame) */
  updateVisibility: (viewerGx: number, viewerGy: number, viewRadius: number) => void;
  /** Reveal a specific tile permanently */
  reveal: (gx: number, gy: number) => void;
  /** Reset all tiles to hidden */
  reset: () => void;
  /** Get the raw visibility grid */
  grid: Visibility[][];
}

export function useFogOfWar(config: FogOfWarConfig): FogOfWarState {
  const { width, height } = config;
  const [, forceRender] = useState(0);

  const gridRef = useRef<Visibility[][]>([]);

  // Initialize grid
  if (gridRef.current.length === 0) {
    for (let y = 0; y < height; y++) {
      gridRef.current[y] = new Array(width).fill('hidden');
    }
  }

  const getVisibility = useCallback((gx: number, gy: number): Visibility => {
    if (gx < 0 || gx >= width || gy < 0 || gy >= height) return 'hidden';
    return gridRef.current[gy][gx];
  }, [width, height]);

  const updateVisibility = useCallback((viewerGx: number, viewerGy: number, viewRadius: number) => {
    const g = gridRef.current;

    // First, downgrade all 'visible' to 'revealed'
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (g[y][x] === 'visible') g[y][x] = 'revealed';
      }
    }

    // Then mark tiles within view radius as 'visible'
    const r2 = viewRadius * viewRadius;
    const minX = Math.max(0, Math.floor(viewerGx - viewRadius));
    const maxX = Math.min(width - 1, Math.ceil(viewerGx + viewRadius));
    const minY = Math.max(0, Math.floor(viewerGy - viewRadius));
    const maxY = Math.min(height - 1, Math.ceil(viewerGy + viewRadius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - viewerGx;
        const dy = y - viewerGy;
        if (dx * dx + dy * dy <= r2) {
          g[y][x] = 'visible';
        }
      }
    }

    forceRender(n => n + 1);
  }, [width, height]);

  const reveal = useCallback((gx: number, gy: number) => {
    if (gx < 0 || gx >= width || gy < 0 || gy >= height) return;
    if (gridRef.current[gy][gx] === 'hidden') {
      gridRef.current[gy][gx] = 'revealed';
      forceRender(n => n + 1);
    }
  }, [width, height]);

  const reset = useCallback(() => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        gridRef.current[y][x] = 'hidden';
      }
    }
    forceRender(n => n + 1);
  }, [width, height]);

  return {
    getVisibility,
    updateVisibility,
    reveal,
    reset,
    grid: gridRef.current,
  };
}
