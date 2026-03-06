import React from 'react';
import { Native } from '../Native';
import type { MaskProps } from './types';

export interface DataMoshProps extends MaskProps {
  /** Block size for corruption artifacts. Default 32. */
  blockSize?: number;
  /** Corruption level. 0-1. Default 0.3. */
  corruption?: number;
}

/**
 * Datamoshing: corrupted video codec look with frozen blocks and drift.
 *
 * @example
 * <Box>
 *   <Video source="clip.mp4" />
 *   <DataMosh mask corruption={0.5} />
 * </Box>
 */
export function DataMosh(props: DataMoshProps) {
  return <Native type="DataMosh" {...props} />;
}
