// useCollision({ a?, b? }, handler) — subscribe to collision events
// from the world. Filter by body id on either side; omit both to hear
// every collision. Fires on contact ENTER only (exit events are on
// the MVP TODO list — resolver tracks active contacts but doesn't yet
// surface ExitEvents to listeners).

import { useEffect } from 'react';
import { usePhysicsCtx } from './PhysicsContext';
import type { CollisionEvent } from '../../lib/physics/core';

export interface CollisionFilter {
  a?: string; // match bodyA OR bodyB (unordered)
  b?: string;
}

export function useCollision(filter: CollisionFilter, handler: (e: CollisionEvent) => void) {
  const { world } = usePhysicsCtx();
  useEffect(() => {
    return world.onCollision((evt) => {
      if (!matches(evt, filter)) return;
      handler(evt);
    });
    // handler + filter identity are the caller's responsibility; using
    // raw refs here would hide typical useCallback discipline.
  }, [world, filter.a, filter.b, handler]);
}

function matches(evt: CollisionEvent, f: CollisionFilter): boolean {
  if (!f.a && !f.b) return true;
  const ids = [evt.bodyA, evt.bodyB];
  if (f.a && !ids.includes(f.a)) return false;
  if (f.b && !ids.includes(f.b)) return false;
  return true;
}
