// =============================================================================
// geometry/Box — procedural box descriptor + bounding sphere for projection
// =============================================================================
// The cart-side mockup renderer doesn't tessellate; it just needs a way to
// turn user props into the normalised BoxGeometry shape from ../types, plus
// a bounding-sphere radius for depth-based perspective sizing.
// =============================================================================

import type { BoxGeometry } from '../types';

export interface BoxArgs {
  width?: number;
  height?: number;
  depth?: number;
  /** uniform-size shortcut (wins over explicit width/height/depth if set) */
  size?: number;
}

export function makeBoxGeometry(args: BoxArgs = {}): BoxGeometry {
  const s = args.size;
  return {
    kind: 'box',
    width:  typeof s === 'number' ? s : (args.width  ?? 1),
    height: typeof s === 'number' ? s : (args.height ?? 1),
    depth:  typeof s === 'number' ? s : (args.depth  ?? 1),
  };
}

/** Bounding-sphere radius — half the diagonal. Used for depth-sorting + the
 *  mockup's 2D circle size. */
export function boxBoundingRadius(g: BoxGeometry): number {
  return 0.5 * Math.sqrt(g.width * g.width + g.height * g.height + g.depth * g.depth);
}
