import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Topographic contour map rendered via marching squares on a height field.
 *
 * @example
 * <Contours />
 * <Contours background />
 * <Contours reactive background />
 */
export function Contours(props: EffectProps) {
  return <Native type="Contours" {...props} />;
}
