import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface AsciiProps extends MaskProps {
  /** Character cell size in pixels. Default 8. */
  cellSize?: number;
  /** Overlay opacity. 0-1. Default 0.6. */
  opacity?: number;
  /** Use source colors vs monochrome. Default true. */
  colored?: boolean;
}

/**
 * ASCII art conversion: maps brightness to characters for a terminal aesthetic.
 *
 * @example
 * <Box>
 *   <Constellation background />
 *   <Ascii mask cellSize={6} />
 * </Box>
 */
export function Ascii(props: AsciiProps) {
  return <Native type="Ascii" {...props} />;
}
