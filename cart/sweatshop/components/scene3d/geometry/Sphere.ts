// =============================================================================
// geometry/Sphere — procedural sphere descriptor
// =============================================================================

import type { SphereGeometry } from '../types';

export interface SphereArgs {
  radius?: number;
  widthSegments?: number;   // longitude divisions
  heightSegments?: number;  // latitude divisions
}

export function makeSphereGeometry(args: SphereArgs = {}): SphereGeometry {
  return {
    kind: 'sphere',
    radius: args.radius ?? 1,
    widthSegments: Math.max(3, Math.round(args.widthSegments ?? 16)),
    heightSegments: Math.max(2, Math.round(args.heightSegments ?? 12)),
  };
}

/** Bounding-sphere radius is literally the radius. */
export function sphereBoundingRadius(g: SphereGeometry): number {
  return g.radius;
}
