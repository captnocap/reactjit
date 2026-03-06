import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface VHSProps extends MaskProps {
  /** Tracking distortion amount. 0-1. Default 0.3. */
  tracking?: number;
  /** Static noise amount. 0-1. Default 0.2. */
  noise?: number;
  /** Horizontal color bleed in pixels. Default 2. */
  colorBleed?: number;
  /** Optional additive tint color (hex). Example: #ff2bd6 */
  tint?: string;
  /** Hue shift (degrees) for shader grading. Default -6. */
  shaderHue?: number;
  /** Saturation multiplier for shader grading. Default 0.92. */
  shaderSaturation?: number;
  /** Value multiplier for shader grading. Default 0.98. */
  shaderValue?: number;
  /** Contrast multiplier for shader grading. Default 1.08. */
  shaderContrast?: number;
  /** Posterize levels (0 disables). Default 0. */
  shaderPosterize?: number;
  /** Film grain strength. 0-1. Default derived from noise. */
  shaderGrain?: number;
  /** Vignette strength. 0-1. Default derived from tracking. */
  shaderVignette?: number;
  /** Optional grading tint color (hex). Defaults to theme warning. */
  shaderTint?: string;
  /** Tint mix amount. 0-1. Default derived from tracking. */
  shaderTintMix?: number;
}

/**
 * VHS tape playback artifacts: tracking lines, color bleed, noise, head switching.
 *
 * @example
 * <Box>
 *   <Image src="photo.jpg" style={{ width: '100%', height: '100%' }} />
 *   <VHS mask tracking={0.5} />
 * </Box>
 */
export function VHS(props: VHSProps) {
  return <Native type="VHS" {...props} />;
}
