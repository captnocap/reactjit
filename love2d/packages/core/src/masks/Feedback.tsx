import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface FeedbackLoopProps extends MaskProps {
  /** Zoom factor per frame. Default 1.02. */
  zoom?: number;
  /** Rotation per frame in radians. Default 0.005. */
  rotation?: number;
  /** Frame persistence. 0-0.99. Default 0.94. */
  decay?: number;
  /** Cycle hue on feedback trail. Default true. */
  hueShift?: boolean;
}

/**
 * Video feedback loop: recursive self-sampling creates tunnel and spiral effects.
 *
 * @example
 * <Box>
 *   <Text fontSize={24}>Infinite</Text>
 *   <Feedback mask zoom={1.03} rotation={0.01} />
 * </Box>
 */
export function FeedbackLoop(props: FeedbackLoopProps) {
  return <Native type="FeedbackLoop" {...props} />;
}
