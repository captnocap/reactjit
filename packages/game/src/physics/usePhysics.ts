import { useCallback } from 'react';
import type { EntityState } from '../types';

export interface PhysicsConfig {
  gravity?: number;
  friction?: number;
  maxVelocity?: { x?: number; y?: number };
}

export interface PhysicsResult {
  /** Apply physics to an entity for one frame */
  apply: (entity: EntityState, dt: number) => void;
  /** Apply gravity only */
  applyGravity: (entity: EntityState, dt: number) => void;
  /** Apply friction only */
  applyFriction: (entity: EntityState, dt: number) => void;
}

export function usePhysics(config: PhysicsConfig = {}): PhysicsResult {
  const { gravity = 0, friction = 0, maxVelocity } = config;

  const apply = useCallback((entity: EntityState, dt: number) => {
    // Apply gravity
    entity.vy += gravity * dt;

    // Apply friction
    if (friction > 0) {
      entity.vx *= Math.pow(1 - friction, dt * 60);
      entity.vy *= Math.pow(1 - friction, dt * 60);
    }

    // Clamp velocity
    if (maxVelocity) {
      if (maxVelocity.x !== undefined) {
        entity.vx = Math.max(-maxVelocity.x, Math.min(maxVelocity.x, entity.vx));
      }
      if (maxVelocity.y !== undefined) {
        entity.vy = Math.max(-maxVelocity.y, Math.min(maxVelocity.y, entity.vy));
      }
    }

    // Integrate position
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
  }, [gravity, friction, maxVelocity]);

  const applyGravity = useCallback((entity: EntityState, dt: number) => {
    entity.vy += gravity * dt;
    if (maxVelocity?.y !== undefined) {
      entity.vy = Math.min(maxVelocity.y, entity.vy);
    }
  }, [gravity, maxVelocity]);

  const applyFriction = useCallback((entity: EntityState, dt: number) => {
    if (friction > 0) {
      entity.vx *= Math.pow(1 - friction, dt * 60);
    }
  }, [friction]);

  return { apply, applyGravity, applyFriction };
}
