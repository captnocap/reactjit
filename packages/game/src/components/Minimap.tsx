import React from 'react';
import { Box } from '@reactjit/core';
import type { TilemapState } from '../world/useTilemap';
import type { EntityState } from '../types';
import type { FogOfWarState } from '../world/useFogOfWar';

export interface MinimapProps {
  tilemap: TilemapState;
  width?: number;
  height?: number;
  /** Entities to show as dots */
  entities?: { entity: EntityState; color: string }[];
  /** Player position for centering */
  player?: EntityState;
  fog?: FogOfWarState;
}

export function Minimap({
  tilemap,
  width = 120,
  height = 90,
  entities = [],
  player,
  fog,
}: MinimapProps) {
  const scaleX = width / (tilemap.width * tilemap.tileSize);
  const scaleY = height / (tilemap.height * tilemap.tileSize);
  const scale = Math.min(scaleX, scaleY);
  const pixelPerTile = tilemap.tileSize * scale;

  const tiles: React.ReactNode[] = [];
  for (let gy = 0; gy < tilemap.height; gy++) {
    for (let gx = 0; gx < tilemap.width; gx++) {
      if (fog) {
        const vis = fog.getVisibility(gx, gy);
        if (vis === 'hidden') continue;
      }

      let color: string | null = null;
      for (const layerName of tilemap.layerNames) {
        const tileId = tilemap.getTile(layerName, gx, gy);
        const tt = tilemap.tileTypes[tileId];
        if (tt?.color) color = tt.color;
      }

      if (color) {
        tiles.push(
          React.createElement(Box, {
            key: `${gx},${gy}`,
            style: {
              position: 'absolute',
              left: gx * pixelPerTile,
              top: gy * pixelPerTile,
              width: Math.ceil(pixelPerTile),
              height: Math.ceil(pixelPerTile),
              backgroundColor: color,
            },
          }),
        );
      }
    }
  }

  // Entity dots
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < entities.length; i++) {
    const { entity, color } = entities[i];
    if (!entity.alive) continue;
    dots.push(
      React.createElement(Box, {
        key: `e-${entity.id}`,
        style: {
          position: 'absolute',
          left: entity.x * scale - 1.5,
          top: entity.y * scale - 1.5,
          width: 3,
          height: 3,
          backgroundColor: color,
          borderRadius: 1.5,
        },
      }),
    );
  }

  // Player dot (larger)
  if (player) {
    dots.push(
      React.createElement(Box, {
        key: 'player',
        style: {
          position: 'absolute',
          left: player.x * scale - 2,
          top: player.y * scale - 2,
          width: 4,
          height: 4,
          backgroundColor: '#22c55e',
          borderRadius: 2,
        },
      }),
    );
  }

  return React.createElement(
    Box,
    {
      style: {
        width,
        height,
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
      },
    },
    ...tiles,
    ...dots,
  );
}
