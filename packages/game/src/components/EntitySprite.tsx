import React from 'react';
import { Box } from '@ilovereact/core';
import type { EntityState } from '../types';

export interface EntitySpriteProps {
  entity: EntityState;
  color?: string;
  children?: React.ReactNode;
}

export function EntitySprite({ entity, color = '#ff6644', children }: EntitySpriteProps) {
  if (!entity.alive) return null;

  return React.createElement(
    Box,
    {
      style: {
        position: 'absolute',
        left: entity.x,
        top: entity.y,
        width: entity.width,
        height: entity.height,
        backgroundColor: color,
      },
    },
    children,
  );
}
