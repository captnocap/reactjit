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
