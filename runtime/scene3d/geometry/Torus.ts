// =============================================================================
// geometry/Torus — procedural torus descriptor
// =============================================================================

import type { TorusGeometry } from '../types';

export interface TorusArgs {
  /** distance from centre of the torus to the centre of the tube */
  radius?: number;
  /** radius of the tube itself */
  tube?: number;
  radialSegments?: number;
  tubularSegments?: number;
}

export function makeTorusGeometry(args: TorusArgs = {}): TorusGeometry {
  return {
    kind: 'torus',
    radius: args.radius ?? 1,
    tube: args.tube ?? 0.3,
    radialSegments: Math.max(3, Math.round(args.radialSegments ?? 8)),
    tubularSegments: Math.max(3, Math.round(args.tubularSegments ?? 24)),
  };
}

/** Outer bounding radius: centre-to-outermost-point = radius + tube. */
export function torusBoundingRadius(g: TorusGeometry): number {
  return g.radius + g.tube;
}
