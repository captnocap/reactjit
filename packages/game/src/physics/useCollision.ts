import { useRef, useCallback } from 'react';
import type { EntityState, AABB, CollisionHit } from '../types';

export interface CollisionConfig {
  layers?: Record<string, string[]>;
}

export interface CollisionResult {
  /** Check collisions between entities and/or static rects */
  check: (entities: EntityState[], statics?: AABB[]) => CollisionHit[];
  /** Check if a single entity overlaps any static rect */
  overlapsAny: (entity: EntityState, statics: AABB[]) => boolean;
  /** Resolve AABB collision — push entity out of overlap */
  resolve: (entity: EntityState, statics: AABB[]) => void;
}

/** Test if two AABBs overlap */
function aabbOverlap(a: AABB, b: AABB): { overlapX: number; overlapY: number } | null {
  const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
  const dy = (a.y + a.height / 2) - (b.y + b.height / 2);
  const ox = (a.width / 2 + b.width / 2) - Math.abs(dx);
  const oy = (a.height / 2 + b.height / 2) - Math.abs(dy);

  if (ox <= 0 || oy <= 0) return null;
  return {
    overlapX: dx > 0 ? ox : -ox,
    overlapY: dy > 0 ? oy : -oy,
  };
}

export function useCollision(config: CollisionConfig = {}): CollisionResult {
  const { layers } = config;

  const shouldCollide = useCallback((a: EntityState, b: EntityState) => {
    if (!layers) return true;
    const aLayer = a.layer as string | undefined;
    const bLayer = b.layer as string | undefined;
    if (!aLayer || !bLayer) return true;
    const allowed = layers[aLayer];
    return allowed ? allowed.includes(bLayer) : false;
  }, [layers]);

  const check = useCallback((entities: EntityState[], statics?: AABB[]): CollisionHit[] => {
    const hits: CollisionHit[] = [];

    // Entity vs entity
    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (!a.alive) continue;

      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (!b.alive) continue;
        if (!shouldCollide(a, b)) continue;

        const overlap = aabbOverlap(
          { x: a.x, y: a.y, width: a.width, height: a.height },
          { x: b.x, y: b.y, width: b.width, height: b.height },
        );
        if (overlap) {
          const normal = Math.abs(overlap.overlapX) < Math.abs(overlap.overlapY)
            ? { x: overlap.overlapX > 0 ? 1 : -1, y: 0 }
            : { x: 0, y: overlap.overlapY > 0 ? 1 : -1 };
          hits.push({ a, b, ...overlap, normal });
        }
      }

      // Entity vs statics
      if (statics) {
        for (const rect of statics) {
          const overlap = aabbOverlap(
            { x: a.x, y: a.y, width: a.width, height: a.height },
            rect,
          );
          if (overlap) {
            const normal = Math.abs(overlap.overlapX) < Math.abs(overlap.overlapY)
              ? { x: overlap.overlapX > 0 ? 1 : -1, y: 0 }
              : { x: 0, y: overlap.overlapY > 0 ? 1 : -1 };
            hits.push({
              a,
              b: { type: 'tile' as const, x: rect.x, y: rect.y, tileId: 0 },
              ...overlap,
              normal,
            });
          }
        }
      }
    }

    return hits;
  }, [shouldCollide]);

  const overlapsAny = useCallback((entity: EntityState, statics: AABB[]): boolean => {
    for (const rect of statics) {
      if (aabbOverlap(
        { x: entity.x, y: entity.y, width: entity.width, height: entity.height },
        rect,
      )) return true;
    }
    return false;
  }, []);

  const resolve = useCallback((entity: EntityState, statics: AABB[]) => {
    for (const rect of statics) {
      const overlap = aabbOverlap(
        { x: entity.x, y: entity.y, width: entity.width, height: entity.height },
        rect,
      );
      if (overlap) {
        if (Math.abs(overlap.overlapX) < Math.abs(overlap.overlapY)) {
          entity.x -= overlap.overlapX;
          entity.vx = 0;
        } else {
          entity.y -= overlap.overlapY;
          entity.vy = 0;
        }
      }
    }
  }, []);

  return { check, overlapsAny, resolve };
}
