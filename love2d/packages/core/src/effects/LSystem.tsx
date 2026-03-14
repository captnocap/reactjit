import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * L-system fractal trees — branching growth from roots.
 *
 * @example
 * <LSystem />
 * <LSystem background />
 * <LSystem reactive background />
 */
export function LSystem(props: EffectProps) {
  return <Native type="LSystem" {...props} />;
}
