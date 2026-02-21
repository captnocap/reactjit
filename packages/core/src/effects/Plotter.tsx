import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Pen plotter — single continuous wandering line that never lifts.
 *
 * @example
 * <Plotter />
 * <Plotter background />
 * <Plotter reactive background />
 */
export function Plotter(props: EffectProps) {
  return <Native type="Plotter" {...props} />;
}
