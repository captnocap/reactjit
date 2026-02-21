import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Parallax mountain terrain — scrolling landscape with 24 depth layers.
 *
 * @example
 * <Terrain />
 * <Terrain background />
 * <Terrain reactive background />
 */
export function Terrain(props: EffectProps) {
  return <Native type="Terrain" {...props} />;
}
