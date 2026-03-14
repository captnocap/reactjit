import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Voronoi diagram with spring-physics seed points and beat explosions.
 *
 * @example
 * <Voronoi />
 * <Voronoi background />
 * <Voronoi reactive background />
 */
export function Voronoi(props: EffectProps) {
  return <Native type="Voronoi" {...props} />;
}
