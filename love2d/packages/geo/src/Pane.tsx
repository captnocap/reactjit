import React from 'react';
import type { PaneProps } from './types';

export function Pane({ name, zIndex, children }: PaneProps) {
  return React.createElement('MapPane', { name, zIndex }, children);
}
