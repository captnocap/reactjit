import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface SoftGlitchProps extends MaskProps {
  /** Drift amount. 0-1. Default 0.4. */
  drift?: number;
  /** Color fringe distance. Default 1. */
  fringe?: number;
  /** Scanline band height. Default 20. */
  bandHeight?: number;
}

/**
 * Subtle digital glitch: gentle horizontal drift, color fringing, micro-stutter.
 *
 * @example
 * <Box>
 *   <Text fontSize={16}>Signal interference</Text>
 *   <SoftGlitch mask drift={0.3} />
 * </Box>
 */
export function SoftGlitch(props: SoftGlitchProps) {
  return <Native type="SoftGlitch" {...props} />;
}
