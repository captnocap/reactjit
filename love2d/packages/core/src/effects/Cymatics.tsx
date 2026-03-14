import React from 'react';
import { Native } from '../Native';
import type { EffectProps } from './types';

export interface CymaticsProps extends EffectProps {
  /** Chladni mode N coefficient. Default auto-cycles. */
  n?: number;
  /** Chladni mode M coefficient. Default auto-cycles. */
  m?: number;
}

/**
 * Chladni plate standing wave simulation — particles settle onto nodal lines.
 *
 * @example
 * <Cymatics />
 * <Cymatics background />
 * <Cymatics n={3} m={5} />
 * <Cymatics amplitude={amp} beat={onBeat} />
 */
export function Cymatics(props: CymaticsProps) {
  return <Native type="Cymatics" {...props} />;
}
