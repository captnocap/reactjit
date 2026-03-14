import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Classic screensaver-style 3D pipes on a grid.
 *
 * @example
 * <Pipes />
 * <Pipes background />
 * <Pipes reactive background />
 */
export function Pipes(props: EffectProps) {
  return <Native type="Pipes" {...props} />;
}
