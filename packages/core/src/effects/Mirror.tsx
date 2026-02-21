import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

export interface MirrorProps extends EffectProps {
  /** Number of mirror segments. Default 8. */
  segments?: number;
}

/**
 * Kaleidoscope effect — flow field particles reflected N times around center.
 *
 * @example
 * <Mirror />
 * <Mirror background />
 * <Mirror segments={12} speed={0.8} />
 * <Mirror bass={bass} high={high} beat={onBeat} />
 */
export function Mirror(props: MirrorProps) {
  return <Native type="Mirror" {...props} />;
}
