import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Combustion fire simulation — black-body radiation particles.
 *
 * @example
 * <Combustion />
 * <Combustion background />
 * <Combustion reactive background />
 */
export function Combustion(props: EffectProps) {
  return <Native type="Combustion" {...props} />;
}
