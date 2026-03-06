import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface WatercolorProps extends MaskProps {
  /** Edge bleeding amount. 0-1. Default 0.5. */
  bleed?: number;
  /** Paper texture intensity. 0-1. Default 0.3. */
  paper?: number;
  /** Wet-on-wet diffusion. 0-1. Default 0.4. */
  wetness?: number;
  /** Hue shift (degrees) for shader grading. Default 8. */
  shaderHue?: number;
  /** Saturation multiplier for shader grading. Default 0.9. */
  shaderSaturation?: number;
  /** Value multiplier for shader grading. Default 1.03. */
  shaderValue?: number;
  /** Contrast multiplier for shader grading. Default 0.94. */
  shaderContrast?: number;
  /** Posterize levels (0 disables). Default 0. */
  shaderPosterize?: number;
  /** Film grain strength. 0-1. Default derived from paper texture. */
  shaderGrain?: number;
  /** Vignette strength. 0-1. Default 0.08. */
  shaderVignette?: number;
  /** Optional grading tint color (hex). Defaults to theme accent. */
  shaderTint?: string;
  /** Tint mix amount. 0-1. Default derived from bleed. */
  shaderTintMix?: number;
}

/**
 * Watercolor / painterly wash: soft edge bleeding, paper texture, color diffusion.
 *
 * @example
 * <Box>
 *   <Image source="landscape.jpg" />
 *   <Watercolor mask bleed={0.6} paper={0.4} />
 * </Box>
 */
export function Watercolor(props: WatercolorProps) {
  return <Native type="Watercolor" {...props} />;
}
