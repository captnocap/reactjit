import React from 'react';
import type { NativeProps } from './types';

export function Native({ type, ...props }: NativeProps) {
  return React.createElement(type, props);
}
