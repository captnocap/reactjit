import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface CRTProps extends MaskProps {
  /** Barrel distortion curvature. 0-1. Default 0.3. */
  curvature?: number;
  /** Scanline darkness. 0-1. Default 0.25. */
  scanlineIntensity?: number;
  /** RGB channel offset in pixels. Default 1.5. */
  rgbShift?: number;
  /** Vignette darkness at edges. 0-1. Default 0.4. */
  vignette?: number;
  /** Flicker amount. 0-1. Default 0.03. */
  flicker?: number;
}

/**
 * CRT monitor post-processing: scanlines, vignette, RGB phosphor shift, flicker.
 *
 * @example
 * <Box>
 *   <Spirograph background />
 *   <Text fontSize={18}>Retro display</Text>
 *   <CRT mask />
 * </Box>
 */
export function CRT(props: CRTProps) {
  return <Native type="CRT" {...props} />;
}
