// =============================================================================
// geometry/Plane — procedural plane descriptor
// =============================================================================

import type { PlaneGeometry } from '../types';

export interface PlaneArgs {
  width?: number;
  height?: number;
  /** uniform size shortcut */
  size?: number;
}

export function makePlaneGeometry(args: PlaneArgs = {}): PlaneGeometry {
  const s = args.size;
  return {
    kind: 'plane',
    width:  typeof s === 'number' ? s : (args.width  ?? 1),
    height: typeof s === 'number' ? s : (args.height ?? 1),
  };
}

/** Planes are flat; bounding radius is half the 2D diagonal. */
export function planeBoundingRadius(g: PlaneGeometry): number {
  return 0.5 * Math.sqrt(g.width * g.width + g.height * g.height);
}
