import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface FishEyeProps extends MaskProps {
  /** Distortion strength. -1 to 2. Default 0.4. */
  strength?: number;
  /** Animate distortion over time. Default false. */
  animated?: boolean;
}

/**
 * Fisheye / barrel distortion via GLSL shader.
 *
 * @example
 * <Box>
 *   <Text fontSize={20}>Distorted</Text>
 *   <FishEye mask strength={0.6} />
 * </Box>
 */
export function FishEye(props: FishEyeProps) {
  return <Native type="FishEye" {...props} />;
}
