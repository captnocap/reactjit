import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface LumaMeshProps extends MaskProps {
  /** Grid cell size in pixels. Default 16. */
  gridSize?: number;
  /** Max vertex displacement in pixels. Default 30. */
  displacement?: number;
  /** Line width. Default 1. */
  lineWidth?: number;
  /** Use source colors for lines. Default true. */
  colored?: boolean;
}

/**
 * Wireframe mesh displaced by brightness — luminance-driven terrain visualization.
 *
 * @example
 * <Box>
 *   <Image source="photo.jpg" />
 *   <LumaMesh mask gridSize={12} />
 * </Box>
 */
export function LumaMesh(props: LumaMeshProps) {
  return <Native type="LumaMesh" {...props} />;
}
