// <Collider> — declarative shape for the nearest enclosing <RigidBody>.
// Renders nothing; its sole job is to register a ShapeSpec with the
// parent body via RigidBodyCtx.
//
// MVP supports circle + rectangle at the solver level. polygon / edge /
// chain accept their props and store them on the spec so the FFI swap
// gets the data it needs later — but the pure-TS resolver currently
// treats them as AABBs of their bounding envelope.

const React: any = require('react');
const { useContext, useEffect } = React;

import { RigidBodyCtx } from './RigidBody';
import type { ShapeKind, ShapeSpec } from '../../lib/physics/core';

export interface ColliderProps {
  shape: ShapeKind;
  radius?: number;
  width?: number;
  height?: number;
  points?: number[];
  loop?: boolean;
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
      width: props.width || envelopeWidth(props),
      height: props.height || envelopeHeight(props),
      points: props.points,
      loop: props.loop,
      density: props.density,
      friction: props.friction,
      restitution: props.restitution,
      isSensor: props.isSensor,
    };
    parent.registerShape(spec);
  }, [parent, props.shape, props.radius, props.width, props.height, props.points, props.loop,
      props.density, props.friction, props.restitution, props.isSensor]);
  return null;
}

function envelopeWidth(p: ColliderProps): number | undefined {
  if (!p.points || p.points.length < 2) return undefined;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < p.points.length; i += 2) {
    const v = p.points[i]; if (v < min) min = v; if (v > max) max = v;
  }
  return max - min;
}

function envelopeHeight(p: ColliderProps): number | undefined {
  if (!p.points || p.points.length < 2) return undefined;
  let min = Infinity, max = -Infinity;
  for (let i = 1; i < p.points.length; i += 2) {
    const v = p.points[i]; if (v < min) min = v; if (v > max) max = v;
  }
  return max - min;
}
