import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

export interface SunburstProps extends EffectProps {
  /** Base hue (0-1). Default 0.042 (Claude coral). Overridden by `mode`. */
  hue?: number;
  /** Base saturation (0-1). Default 0.64. Overridden by `mode`. */
  saturation?: number;
  /** Base lightness (0-1). Default 0.59. Overridden by `mode`. */
  lightness?: number;
  /** Animation intensity (0-1). 0 = nearly still, 1 = fully energized. */
  activity?: number;
  /** Color preset: 'idle' | 'thinking' | 'streaming' | 'permission' | 'active'. */
  mode?: string;
  /** Clear to transparent instead of dark bg (lets backdrop effects show through). */
  transparent?: boolean;
}

/**
 * Organic radial sunburst with independently breathing rays.
 * Inspired by the Claude logo — 12 irregularly-spaced chisel-tipped
 * rays that pulse with staggered phase offsets.
 *
 * Supports activity-driven animation for use as Claude's "brain":
 * pass `activity` (0-1) and `mode` to drive intensity and color
 * based on Claude's semantic state.
 *
 * @example
 * <Sunburst />
 * <Sunburst background />
 * <Sunburst activity={0.8} mode="thinking" transparent />
 * <Sunburst reactive />
 */
export function Sunburst(props: SunburstProps) {
  return <Native type="Sunburst" {...props} />;
}
