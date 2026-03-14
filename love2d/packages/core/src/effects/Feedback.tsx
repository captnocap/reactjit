import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Ping-pong canvas feedback with zoom/rotation creating infinite echo spirals.
 *
 * @example
 * <Feedback />
 * <Feedback background />
 * <Feedback reactive background />
 */
export function Feedback(props: EffectProps) {
  return <Native type="Feedback" {...props} />;
}
