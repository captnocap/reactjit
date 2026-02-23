import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface DitherProps extends MaskProps {
  /** Color quantization levels. Default 4. */
  levels?: number;
  /** Pixel scale (dither cell size). Default 2. */
  scale?: number;
}

/**
 * Ordered Bayer-matrix dithering for a retro pixel-art aesthetic.
 *
 * @example
 * <Box>
 *   <Text fontSize={24}>Dithered content</Text>
 *   <Dither mask scale={3} />
 * </Box>
 */
export function Dither(props: DitherProps) {
  return <Native type="Dither" {...props} />;
}
