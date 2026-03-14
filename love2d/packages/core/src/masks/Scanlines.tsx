import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface ScanlinesProps extends MaskProps {
  /** Line spacing in pixels. Default 2. */
  spacing?: number;
  /** Optional line tint color (hex). Example: #ff2bd6 */
  tint?: string;
}

/**
 * Horizontal scanline overlay.
 *
 * @example
 * <Box>
 *   <Text fontSize={18}>Content behind scanlines</Text>
 *   <Scanlines mask />
 * </Box>
 */
export function Scanlines(props: ScanlinesProps) {
  return <Native type="Scanlines" {...props} />;
}
