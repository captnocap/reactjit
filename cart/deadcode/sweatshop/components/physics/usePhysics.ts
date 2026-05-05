// usePhysics — access the enclosing <PhysicsWorld>. Returns the world
// handle plus imperative helpers for code paths that don't want to
// express themselves declaratively (spawn N bodies on a click, clear,
// etc). For continuous forces and collision events, prefer the
// dedicated useForce / useCollision hooks.

import { useMemo } from 'react';
import { usePhysicsCtx } from './PhysicsContext';
import type { BodyInit, Joint, Vec2 } from '../../lib/physics/core';

export function usePhysics() {
  const { world } = usePhysicsCtx();
  return useMemo(() => ({
    world,
    get bodies() { return world.bodies; },
    get joints() { return world.joints; },
    addBody: (init: BodyInit) => world.addBody(init),
    removeBody: (id: string) => world.removeBody(id),
    addJoint: (j: Joint) => world.addJoint(j),
    removeJoint: (id: string) => world.removeJoint(id),
    applyForce: (id: string, f: Vec2) => world.applyForce(id, f),
    applyImpulse: (id: string, j: Vec2) => world.applyImpulse(id, j),
    applyTorque: (id: string, t: number) => world.applyTorque(id, t),
    setGravity: (g: Vec2) => { world.gravity.x = g.x; world.gravity.y = g.y; },
    getGravity: () => ({ x: world.gravity.x, y: world.gravity.y }),
  }), [world]);
}
