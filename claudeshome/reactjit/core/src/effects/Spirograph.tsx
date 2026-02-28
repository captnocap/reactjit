import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

export interface SpirographProps extends EffectProps {
  /** Chaos factor — higher = more erratic curve changes. 0-1. Default 0.3. */
  chaos?: number;
}

/**
 * Parametric spirograph curves that self-animate with smooth color evolution.
 *
 * @example
 * // Standalone — fills its layout box
 * <Spirograph />
 *
 * // As a card background
 * <Card>
 *   <Spirograph background />
 *   <Text fontSize={18}>Hello</Text>
 * </Card>
 *
 * // With custom parameters
 * <Spirograph speed={1.5} decay={0.02} chaos={0.6} />
 *
 * // Externally driven (e.g. by audio)
 * <Spirograph bass={bass} mid={mid} high={high} beat={onBeat} />
 */
export function Spirograph(props: SpirographProps) {
  return <Native type="Spirograph" {...props} />;
}
