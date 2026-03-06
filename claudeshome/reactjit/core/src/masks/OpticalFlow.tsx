import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface OpticalFlowProps extends MaskProps {
  /** Trail persistence. 0-0.99. Default 0.92. */
  decay?: number;
  /** Motion trail displacement. Default 3. */
  displacement?: number;
  /** Color fringing on trails. Default true. */
  colorShift?: boolean;
}

/**
 * Motion trail / optical flow: accumulates previous frames with displacement and decay.
 *
 * @example
 * <Box>
 *   <AnimatedContent />
 *   <OpticalFlow mask decay={0.9} />
 * </Box>
 */
export function OpticalFlow(props: OpticalFlowProps) {
  return <Native type="OpticalFlow" {...props} />;
}
