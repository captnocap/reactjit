import React from 'react';
import { Native } from '@reactjit/core';
import type { ColliderProps } from './types';

export function Collider(props: ColliderProps) {
  return <Native type="Collider" {...props} />;
}
