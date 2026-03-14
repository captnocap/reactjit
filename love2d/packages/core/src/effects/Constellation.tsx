import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Twinkling star field with connection graph between nearby stars.
 *
 * @example
 * <Constellation />
 * <Constellation background />
 * <Constellation reactive background />
 */
export function Constellation(props: EffectProps) {
  return <Native type="Constellation" {...props} />;
}
