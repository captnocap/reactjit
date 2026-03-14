import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface HardGlitchProps extends MaskProps {
  /** Chaos level. 0-1. Default 0.5. */
  chaos?: number;
  /** Block displacement size. Default 40. */
  blockSize?: number;
  /** RGB channel split distance. Default 6. */
  rgbSplit?: number;
}

/**
 * Aggressive digital glitch: block displacement, RGB splits, random fills, corruption.
 *
 * @example
 * <Box>
 *   <Text fontSize={20}>CORRUPTED</Text>
 *   <HardGlitch mask chaos={0.7} />
 * </Box>
 */
export function HardGlitch(props: HardGlitchProps) {
  return <Native type="HardGlitch" {...props} />;
}
