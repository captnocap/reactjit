import { useCallback } from 'react';
import type { EntityState, AABB } from '../types';
import type { EntityPool } from '../entity/useEntityPool';

export interface ProjectileConfig {
  speed?: number;
  lifetime?: number;
  gravity?: number;
}

export interface ProjectileResult {
  /** Fire a projectile from origin toward a direction */
  fire: (origin: { x: number; y: number }, direction: { x: number; y: number }, props?: Partial<EntityState>) => EntityState;
  /** Fire a projectile toward a target position */
  fireAt: (origin: { x: number; y: number }, target: { x: number; y: number }, props?: Partial<EntityState>) => EntityState;
  /** Update all projectiles — move, check lifetime, check collisions */
  update: (dt: number, solids?: AABB[], onHit?: (projectile: EntityState, hit: AABB) => void) => void;
}

export function useProjectile(pool: EntityPool, config: ProjectileConfig = {}): ProjectileResult {
  const { speed = 200, lifetime = 3, gravity = 0 } = config;

  const fire = useCallback((
    origin: { x: number; y: number },
    direction: { x: number; y: number },
    props?: Partial<EntityState>,
  ): EntityState => {
    // Normalize direction
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const nx = len > 0 ? direction.x / len : 1;
    const ny = len > 0 ? direction.y / len : 0;

    return pool.spawn({
      x: origin.x,
      y: origin.y,
      vx: nx * speed,
      vy: ny * speed,
      width: 4,
      height: 4,
      _lifetime: lifetime,
      _age: 0,
      type: 'projectile',
      ...props,
    });
  }, [pool, speed, lifetime]);

  const fireAt = useCallback((
    origin: { x: number; y: number },
    target: { x: number; y: number },
    props?: Partial<EntityState>,
  ): EntityState => {
    return fire(origin, { x: target.x - origin.x, y: target.y - origin.y }, props);
  }, [fire]);

  const update = useCallback((
    dt: number,
    solids?: AABB[],
    onHit?: (projectile: EntityState, hit: AABB) => void,
  ) => {
    pool.updateAll((p, dt) => {
      if (p.type !== 'projectile') return;

      // Apply gravity
      p.vy += gravity * dt;

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Age and despawn
      p._age = (p._age || 0) + dt;
      if (p._age >= (p._lifetime || lifetime)) {
        pool.despawn(p);
        return;
      }

      // Collision with solids
      if (solids) {
        for (const s of solids) {
          if (p.x < s.x + s.width && p.x + p.width > s.x &&
              p.y < s.y + s.height && p.y + p.height > s.y) {
            onHit?.(p, s);
            pool.despawn(p);
            return;
          }
        }
      }
    }, dt);
  }, [pool, gravity, lifetime]);

  return { fire, fireAt, update };
}
