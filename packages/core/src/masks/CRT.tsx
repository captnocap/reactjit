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
  /** Hue shift (degrees) for shader grading. Default 0. */
  shaderHue?: number;
  /** Saturation multiplier for shader grading. Default 1.06. */
  shaderSaturation?: number;
  /** Value multiplier for shader grading. Default 1.0. */
  shaderValue?: number;
  /** Contrast multiplier for shader grading. Default 1.08. */
  shaderContrast?: number;
  /** Posterize levels (0 disables). Default 0. */
  shaderPosterize?: number;
  /** Film grain strength. 0-1. Default derived from scanline intensity. */
  shaderGrain?: number;
  /** Vignette strength. 0-1. Default derived from vignette prop. */
  shaderVignette?: number;
  /** Optional tint color for grading. Example: #a6e3a1. */
  shaderTint?: string;
  /** Tint mix amount. 0-1. Default 0.14. */
  shaderTintMix?: number;
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
