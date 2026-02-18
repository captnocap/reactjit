import { useState, useRef, useCallback } from 'react';
import type { EntityState } from '../types';

let poolEntityId = 100000;

export interface EntityPoolConfig {
  poolSize?: number;
}

export interface EntityPool {
  /** All currently alive entities */
  all: EntityState[];
  /** Spawn a new entity with given properties */
  spawn: (props: Partial<EntityState>) => EntityState;
  /** Despawn an entity (mark dead, return to pool) */
  despawn: (entity: EntityState) => void;
  /** Update all alive entities */
  updateAll: (fn: (entity: EntityState, dt: number) => void, dt: number) => void;
  /** Query entities near a point */
  query: (opts: { near: { x: number; y: number }; radius: number }) => EntityState[];
  /** Map over alive entities for rendering */
  map: <R>(fn: (entity: EntityState, index: number) => R) => R[];
  /** Count of alive entities */
  count: number;
  /** Clear all entities */
  clear: () => void;
}

export function useEntityPool(config: EntityPoolConfig = {}): EntityPool {
  const { poolSize = 100 } = config;
  const [, forceRender] = useState(0);
  const poolRef = useRef<EntityState[]>([]);
  const aliveRef = useRef<EntityState[]>([]);

  // Pre-allocate pool
  if (poolRef.current.length === 0) {
    for (let i = 0; i < poolSize; i++) {
      poolRef.current.push({
        id: poolEntityId++,
        x: 0, y: 0, vx: 0, vy: 0,
        width: 16, height: 16,
        alive: false,
      });
    }
  }

  const spawn = useCallback((props: Partial<EntityState>): EntityState => {
    // Find a dead entity in the pool to reuse
    let entity = poolRef.current.find(e => !e.alive);

    if (!entity) {
      // Pool exhausted, create a new one
      entity = {
        id: poolEntityId++,
        x: 0, y: 0, vx: 0, vy: 0,
        width: 16, height: 16,
        alive: false,
      };
      poolRef.current.push(entity);
    }

    // Reset and apply props
    entity.x = 0; entity.y = 0;
    entity.vx = 0; entity.vy = 0;
    entity.width = 16; entity.height = 16;
    Object.assign(entity, props);
    entity.alive = true;

    aliveRef.current = poolRef.current.filter(e => e.alive);
    forceRender(n => n + 1);
    return entity;
  }, []);

  const despawn = useCallback((entity: EntityState) => {
    entity.alive = false;
    aliveRef.current = poolRef.current.filter(e => e.alive);
    forceRender(n => n + 1);
  }, []);

  const updateAll = useCallback((fn: (entity: EntityState, dt: number) => void, dt: number) => {
    for (const entity of aliveRef.current) {
      if (entity.alive) fn(entity, dt);
    }
    // Refresh alive list in case entities were despawned during update
    aliveRef.current = poolRef.current.filter(e => e.alive);
    forceRender(n => n + 1);
  }, []);

  const query = useCallback((opts: { near: { x: number; y: number }; radius: number }) => {
    const { near, radius } = opts;
    const r2 = radius * radius;
    return aliveRef.current.filter(e => {
      const dx = e.x - near.x;
      const dy = e.y - near.y;
      return dx * dx + dy * dy <= r2;
    });
  }, []);

  const map = useCallback(<R,>(fn: (entity: EntityState, index: number) => R): R[] => {
    return aliveRef.current.map(fn);
  }, []);

  const clear = useCallback(() => {
    for (const e of poolRef.current) e.alive = false;
    aliveRef.current = [];
    forceRender(n => n + 1);
  }, []);

  return {
    all: aliveRef.current,
    spawn,
    despawn,
    updateAll,
    query,
    map,
    count: aliveRef.current.length,
    clear,
  };
}
