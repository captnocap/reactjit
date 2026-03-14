import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface TileProps extends MaskProps {
  /** Number of columns. Default 3. */
  columns?: number;
  /** Number of rows. Default 3. */
  rows?: number;
  /** Mirror alternating tiles. Default false. */
  mirror?: boolean;
  /** Gap between tiles in pixels. Default 0. */
  gap?: number;
  /** Subtle scale pulse animation. Default false. */
  animated?: boolean;
}

/**
 * Tiling / kaleidoscope: repeats source content in a grid, optionally mirrored.
 *
 * @example
 * <Box>
 *   <Text fontSize={24}>Repeat</Text>
 *   <Tile mask columns={4} rows={3} mirror />
 * </Box>
 */
export function Tile(props: TileProps) {
  return <Native type="Tile" {...props} />;
}
