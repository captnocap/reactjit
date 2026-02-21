import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Agent-based mycelium growth network with branching paths and synapse connections.
 *
 * @example
 * <Mycelium />
 * <Mycelium background />
 * <Mycelium reactive background />
 */
export function Mycelium(props: EffectProps) {
  return <Native type="Mycelium" {...props} />;
}
