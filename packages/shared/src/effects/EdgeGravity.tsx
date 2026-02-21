import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Edge gravity — spring particles with light trails in the void.
 *
 * @example
 * <EdgeGravity />
 * <EdgeGravity background />
 * <EdgeGravity reactive background />
 */
export function EdgeGravity(props: EffectProps) {
  return <Native type="EdgeGravity" {...props} />;
}
