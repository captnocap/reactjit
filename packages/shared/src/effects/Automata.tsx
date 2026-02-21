import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Cellular automata — Game of Life with self-modulating rules.
 *
 * @example
 * <Automata />
 * <Automata background />
 * <Automata reactive background />
 */
export function Automata(props: EffectProps) {
  return <Native type="Automata" {...props} />;
}
