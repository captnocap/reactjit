// <RigidBody> — declarative physics body. Creates a Body in the world
// on mount, removes it on unmount. The body's shape comes from either
// the `shape` prop or a nested <Collider>. Visual children read the
// body's live position via a sibling <PhysicsMotion> wrapper.
//
// The body is addressed by `id` (required). Stable across re-renders.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePhysicsCtx } from './PhysicsContext';
import type { BodyType, ShapeSpec, Vec2 } from '../../lib/physics/core';

export const RigidBodyCtx: any = React.createContext(null);

export interface RigidBodyProps {
  id: string;
  type?: BodyType;                 // default 'dynamic'
  x: number;
  y: number;
  angle?: number;
  velocity?: [number, number];
  mass?: number;
  bullet?: boolean;                // reserved for CCD TODO(physics-ffi)
  fixedRotation?: boolean;
  gravityScale?: number;
  shape?: ShapeSpec;               // inline, or provide a <Collider> child
  children?: any;
}

export function RigidBody(props: RigidBodyProps) {
  const { world } = usePhysicsCtx();
  const shapeFromChildrenRef = useRef<ShapeSpec | null>(null);
  const [shapeReady, setShapeReady] = useState<boolean>(!!props.shape);

  // A shape registrar passed to nested <Collider>. Flips shapeReady once
  // the first <Collider> mounts so we create the body with real geometry.
  const register = useMemo(() => (spec: ShapeSpec) => {
    shapeFromChildrenRef.current = spec;
    setShapeReady(true);
  }, []);

  useEffect(() => {
    const shape = props.shape || shapeFromChildrenRef.current;
    if (!shape) return;
    world.addBody({
      id: props.id,
      type: props.type || 'dynamic',
      position: { x: props.x, y: props.y },
      angle: props.angle,
      velocity: props.velocity ? { x: props.velocity[0], y: props.velocity[1] } : undefined,
      mass: props.mass,
      fixedRotation: props.fixedRotation,
      gravityScale: props.gravityScale,
      shape,
    });
    return () => { world.removeBody(props.id); };
  }, [world, props.id, shapeReady, props.type]);

  const ctxValue = useMemo(() => ({ bodyId: props.id, registerShape: register }), [props.id, register]);
  return React.createElement(RigidBodyCtx.Provider, { value: ctxValue }, props.children);
}

// Helper: read the live position of a body at render time. Subscribes
// to the world's per-frame version counter so components re-render
// when the body moves.
export function useBodyState(id: string): { position: Vec2; angle: number; velocity: Vec2 } | null {
  const { world, subscribe } = usePhysicsCtx();
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), [subscribe]);
  const b = world.bodies.get(id);
  if (!b) return null;
  return { position: b.position, angle: b.angle, velocity: b.velocity };
}

// <PhysicsMotion id="x">{(state) => ...}</PhysicsMotion> — render-prop
// convenience for binding a visual to a body. Keeps the body-positioning
// concern out of RigidBody itself, which only owns the physics life-cycle.
export function PhysicsMotion({ id, children }: { id: string; children: (s: { position: Vec2; angle: number }) => any }) {
  const s = useBodyState(id);
  if (!s) return null;
  return children({ position: s.position, angle: s.angle });
}
