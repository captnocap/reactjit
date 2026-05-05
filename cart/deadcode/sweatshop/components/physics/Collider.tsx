// <Collider> — declarative shape for the nearest enclosing <RigidBody>.
// Renders nothing; registers a ShapeSpec with the parent body via
// RigidBodyCtx. Supports circle and rectangle.

import { useContext, useEffect } from 'react';
import { RigidBodyCtx } from './RigidBody';
import type { ShapeKind, ShapeSpec } from '../../lib/physics/core';

export interface ColliderProps {
  shape: ShapeKind;
  radius?: number;
  width?: number;
  height?: number;
  density?: number;
  friction?: number;
  restitution?: number;
  isSensor?: boolean;
}

export function Collider(props: ColliderProps) {
  const parent: any = useContext(RigidBodyCtx);
  useEffect(() => {
    if (!parent || typeof parent.registerShape !== 'function') return;
    const spec: ShapeSpec = {
      kind: props.shape,
      radius: props.radius,
      width: props.width,
      height: props.height,
      density: props.density,
      friction: props.friction,
      restitution: props.restitution,
      isSensor: props.isSensor,
    };
    parent.registerShape(spec);
  }, [parent, props.shape, props.radius, props.width, props.height,
      props.density, props.friction, props.restitution, props.isSensor]);
  return null;
}
