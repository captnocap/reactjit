import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Triangular mesh with spring physics and propagating color waves.
 *
 * @example
 * <StainedGlass />
 * <StainedGlass background />
 * <StainedGlass reactive background />
 */
export function StainedGlass(props: EffectProps) {
  return <Native type="StainedGlass" {...props} />;
}
