import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Expanding concentric circles that self-animate from center outward.
 *
 * @example
 * <Rings />
 * <Rings background />
 * <Rings speed={2} decay={0.04} />
 * <Rings beat={onBeat} amplitude={amp} />
 */
export function Rings(props: EffectProps) {
  return <Native type="Rings" {...props} />;
}
