import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Gravitational orbits — particles orbit invisible attractors.
 *
 * @example
 * <Orbits />
 * <Orbits background />
 * <Orbits reactive background />
 */
export function Orbits(props: EffectProps) {
  return <Native type="Orbits" {...props} />;
}
