import { useState, useRef, useCallback } from 'react';
import type { EntityState } from '../types';

let nextEntityId = 1;

export function useEntity<T extends Record<string, any> = {}>(
  initial: Partial<EntityState> & T,
): EntityState & T & {
  update: (fn: (entity: EntityState & T, dt: number) => void, dt: number) => void;
  set: (patch: Partial<EntityState & T>) => void;
} {
  const [, forceRender] = useState(0);
  const entityRef = useRef<EntityState & T>(null as any);

  if (entityRef.current === null) {
    entityRef.current = {
      id: nextEntityId++,
      x: 0, y: 0, vx: 0, vy: 0,
      width: 16, height: 16,
      alive: true,
      ...initial,
    } as EntityState & T;
  }

  const update = useCallback((fn: (entity: EntityState & T, dt: number) => void, dt: number) => {
    fn(entityRef.current, dt);
    forceRender(n => n + 1);
  }, []);

  const set = useCallback((patch: Partial<EntityState & T>) => {
    Object.assign(entityRef.current, patch);
    forceRender(n => n + 1);
  }, []);

  return {
    ...entityRef.current,
    update,
    set,
    // Expose the mutable ref for direct reads in game loops
    get state() { return entityRef.current; },
  } as any;
}
