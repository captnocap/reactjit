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
