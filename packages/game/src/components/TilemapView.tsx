import React from 'react';
import { Box } from '@ilovereact/core';
import type { TilemapState } from '../world/useTilemap';
import type { FogOfWarState } from '../world/useFogOfWar';

export interface TilemapViewProps {
  tilemap: TilemapState;
  camera?: { x: number; y: number };
  fog?: FogOfWarState;
  /** Viewport size in pixels — only render tiles within view */
  viewport?: { width: number; height: number };
}

export function TilemapView({ tilemap, camera, fog, viewport }: TilemapViewProps) {
  const { width, height, tileSize, tileTypes } = tilemap;
  const cx = camera?.x ?? 0;
  const cy = camera?.y ?? 0;

  // Compute visible range
  let startGx = 0, endGx = width - 1, startGy = 0, endGy = height - 1;
  if (viewport) {
    startGx = Math.max(0, Math.floor((cx - viewport.width / 2) / tileSize) - 1);
    endGx = Math.min(width - 1, Math.ceil((cx + viewport.width / 2) / tileSize) + 1);
    startGy = Math.max(0, Math.floor((cy - viewport.height / 2) / tileSize) - 1);
    endGy = Math.min(height - 1, Math.ceil((cy + viewport.height / 2) / tileSize) + 1);
  }

  const rows: React.ReactNode[] = [];
  for (let gy = startGy; gy <= endGy; gy++) {
    const tiles: React.ReactNode[] = [];
    for (let gx = startGx; gx <= endGx; gx++) {
      // Get highest non-empty tile across layers
      let color: string | null = null;
      for (const layerName of tilemap.layerNames) {
        const tileId = tilemap.getTile(layerName, gx, gy);
        const tt = tileTypes[tileId];
        if (tt?.color) color = tt.color;
      }

      // Apply fog of war
      let opacity = 1;
      if (fog) {
        const vis = fog.getVisibility(gx, gy);
        if (vis === 'hidden') opacity = 0;
        else if (vis === 'revealed') opacity = 0.4;
      }

      if (color && opacity > 0) {
        tiles.push(
          React.createElement(Box, {
            key: `${gx},${gy}`,
            style: {
              position: 'absolute',
              left: gx * tileSize,
              top: gy * tileSize,
              width: tileSize,
              height: tileSize,
              backgroundColor: color,
              opacity,
            },
          }),
        );
      }
    }
    rows.push(...tiles);
  }

  return React.createElement(
    Box,
    {
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: width * tileSize,
        height: height * tileSize,
      },
    },
    ...rows,
  );
}
