import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Pixel sorting effect — vertical brightness-sorted columns triggered by intensity.
 *
 * @example
 * <PixelSort />
 * <PixelSort background />
 * <PixelSort reactive background />
 */
export function PixelSort(props: EffectProps) {
  return <Native type="PixelSort" {...props} />;
}
