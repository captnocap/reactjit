import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Radial sector slices building a tree-ring mandala pattern over time.
 *
 * @example
 * <Mandala />
 * <Mandala background />
 * <Mandala speed={0.8} decay={0.005} />
 * <Mandala beat={onBeat} amplitude={amp} />
 */
export function Mandala(props: EffectProps) {
  return <Native type="Mandala" {...props} />;
}
