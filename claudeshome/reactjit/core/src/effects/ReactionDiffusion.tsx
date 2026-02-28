import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

/**
 * Reaction-diffusion — Gray-Scott evolving organic patterns.
 *
 * @example
 * <ReactionDiffusion />
 * <ReactionDiffusion background />
 * <ReactionDiffusion reactive background />
 */
export function ReactionDiffusion(props: EffectProps) {
  return <Native type="ReactionDiffusion" {...props} />;
}
