import React from 'react';
import { Native } from '@reactjit/core';
import type { PhysicsWorldProps } from './types';

export function PhysicsWorld({ children, ...props }: PhysicsWorldProps) {
  return <Native type="PhysicsWorld" {...props}>{children}</Native>;
}
