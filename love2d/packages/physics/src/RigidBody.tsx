import React from 'react';
import { Native } from '@reactjit/core';
import type { RigidBodyProps } from './types';

const ABS_STYLE = { position: 'absolute' as const, left: 0, top: 0 };

export function RigidBody({ children, type: bodyType, style, ...props }: RigidBodyProps) {
  return <Native type="RigidBody" bodyType={bodyType} style={style || ABS_STYLE} {...props}>{children}</Native>;
}
