import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface ScanlinesProps extends MaskProps {
  /** Line spacing in pixels. Default 2. */
  spacing?: number;
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
