import type { Vec2, Vec3, BBox2, BBox3 } from './types';

export const BBox2 = {
  create(minX: number, minY: number, maxX: number, maxY: number): BBox2 {
    return { min: [minX, minY], max: [maxX, maxY] };
  },

  fromPoints(points: Vec2[]): BBox2 {
    if (points.length === 0) return { min: [0, 0], max: [0, 0] };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    return { min: [minX, minY], max: [maxX, maxY] };
  },

  width(b: BBox2): number { return b.max[0] - b.min[0]; },
  height(b: BBox2): number { return b.max[1] - b.min[1]; },
  center(b: BBox2): Vec2 { return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2]; },

  containsPoint(b: BBox2, p: Vec2): boolean {
    return p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1];
  },

  containsBBox(outer: BBox2, inner: BBox2): boolean {
    return inner.min[0] >= outer.min[0] && inner.max[0] <= outer.max[0]
      && inner.min[1] >= outer.min[1] && inner.max[1] <= outer.max[1];
  },

  intersects(a: BBox2, b: BBox2): boolean {
    return a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
      && a.min[1] <= b.max[1] && a.max[1] >= b.min[1];
  },

  intersection(a: BBox2, b: BBox2): BBox2 | null {
    const minX = Math.max(a.min[0], b.min[0]);
    const minY = Math.max(a.min[1], b.min[1]);
    const maxX = Math.min(a.max[0], b.max[0]);
    const maxY = Math.min(a.max[1], b.max[1]);
    if (minX > maxX || minY > maxY) return null;
    return { min: [minX, minY], max: [maxX, maxY] };
  },

  union(a: BBox2, b: BBox2): BBox2 {
    return {
      min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1])],
      max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1])],
    };
  },

  expand(b: BBox2, amount: number): BBox2 {
    return {
      min: [b.min[0] - amount, b.min[1] - amount],
      max: [b.max[0] + amount, b.max[1] + amount],
    };
  },
};

export const BBox3 = {
  create(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): BBox3 {
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  },

  fromPoints(points: Vec3[]): BBox3 {
    if (points.length === 0) return { min: [0, 0, 0], max: [0, 0, 0] };
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] > maxZ) maxZ = p[2];
    }
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  },

  containsPoint(b: BBox3, p: Vec3): boolean {
    return p[0] >= b.min[0] && p[0] <= b.max[0]
      && p[1] >= b.min[1] && p[1] <= b.max[1]
      && p[2] >= b.min[2] && p[2] <= b.max[2];
  },

  intersects(a: BBox3, b: BBox3): boolean {
    return a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
      && a.min[1] <= b.max[1] && a.max[1] >= b.min[1]
      && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
  },

  union(a: BBox3, b: BBox3): BBox3 {
    return {
      min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
      max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
    };
  },

  expand(b: BBox3, amount: number): BBox3 {
    return {
      min: [b.min[0] - amount, b.min[1] - amount, b.min[2] - amount],
      max: [b.max[0] + amount, b.max[1] + amount, b.max[2] + amount],
    };
  },
};

/** Point-to-line-segment distance (2D) */
export function distancePointToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const px = point[0] - a[0], py = point[1] - a[1];
    return Math.sqrt(px * px + py * py);
  }
  let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a[0] + t * dx, projY = a[1] + t * dy;
  const px = point[0] - projX, py = point[1] - projY;
  return Math.sqrt(px * px + py * py);
}

/** Point-to-rect distance (2D, returns 0 if inside) */
export function distancePointToRect(point: Vec2, rect: BBox2): number {
  const cx = Math.max(rect.min[0], Math.min(rect.max[0], point[0]));
  const cy = Math.max(rect.min[1], Math.min(rect.max[1], point[1]));
  const dx = point[0] - cx, dy = point[1] - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Test if a circle contains a point */
export function circleContainsPoint(center: Vec2, radius: number, point: Vec2): boolean {
  const dx = point[0] - center[0], dy = point[1] - center[1];
  return dx * dx + dy * dy <= radius * radius;
}

/** Test if a circle intersects a rect */
export function circleIntersectsRect(center: Vec2, radius: number, rect: BBox2): boolean {
  return distancePointToRect(center, rect) <= radius;
}

/** Line-line intersection (2D, returns intersection point or null) */
export function lineIntersection(
  a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2
): Vec2 | null {
  const d1x = a2[0] - a1[0], d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0], d2y = b2[1] - b1[1];
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return null;
  const dx = b1[0] - a1[0], dy = b1[1] - a1[1];
  const t = (dx * d2y - dy * d2x) / cross;
  const u = (dx * d1y - dy * d1x) / cross;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [a1[0] + t * d1x, a1[1] + t * d1y];
}
