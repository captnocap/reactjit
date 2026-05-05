// <Joint> — declarative constraint between two bodies. Registers in
// the world on mount, removes on unmount.
//
// kind='distance' — spring returning bodies to restLength
// kind='rope'     — max-length limiter (no pull force under the limit)
// kind='weld'     — hard coincidence of anchor points (glue)

import { useEffect } from 'react';
import { usePhysicsCtx } from './PhysicsContext';
import type { JointKind, Vec2 } from '../../lib/physics/core';

export interface JointProps {
  id: string;
  kind: JointKind;
  bodyA: string;
  bodyB: string;
  anchorA?: [number, number];     // local anchor offset, default [0, 0]
  anchorB?: [number, number];
  restLength?: number;            // distance
  maxLength?: number;             // rope
  stiffness?: number;             // 0..1, default 1
  damping?: number;               // 0..1, default 0
}

export function Joint(props: JointProps) {
  const { world } = usePhysicsCtx();
  useEffect(() => {
    const anchorA: Vec2 = { x: (props.anchorA || [0, 0])[0], y: (props.anchorA || [0, 0])[1] };
    const anchorB: Vec2 = { x: (props.anchorB || [0, 0])[0], y: (props.anchorB || [0, 0])[1] };
    world.addJoint({
      id: props.id,
      kind: props.kind,
      bodyA: props.bodyA,
      bodyB: props.bodyB,
      anchorA, anchorB,
      restLength: props.restLength,
      maxLength: props.maxLength,
      stiffness: props.stiffness,
      damping: props.damping,
    });
    return () => { world.removeJoint(props.id); };
  }, [world, props.id, props.kind, props.bodyA, props.bodyB,
      props.anchorA && props.anchorA[0], props.anchorA && props.anchorA[1],
      props.anchorB && props.anchorB[0], props.anchorB && props.anchorB[1],
      props.restLength, props.maxLength, props.stiffness, props.damping]);
  return null;
}
