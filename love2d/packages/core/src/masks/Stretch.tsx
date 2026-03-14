import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface StretchProps extends MaskProps {
  /** Stretch amount. 0-1. Default 0.5. */
  amount?: number;
  /** Height of each displacement strip. Default 2. */
  stripHeight?: number;
  /** Stretch vertically instead of horizontally. Default false. */
  vertical?: boolean;
}

/**
 * Pixel stretch / smear: noise-driven displacement of horizontal or vertical strips.
 *
 * @example
 * <Box>
 *   <Image source="photo.jpg" />
 *   <Stretch mask amount={0.6} />
 * </Box>
 */
export function Stretch(props: StretchProps) {
  return <Native type="Stretch" {...props} />;
}
