import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Perlin noise flow field particle system with organic trails.
 *
 * @example
 * <FlowParticles />
 * <FlowParticles background />
 * <FlowParticles speed={1.5} decay={0.02} />
 * <FlowParticles bass={bass} high={high} beat={onBeat} />
 */
export function FlowParticles(props: EffectProps) {
  return <Native type="FlowParticles" {...props} />;
}
