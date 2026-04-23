// =============================================================================
// Worley (cellular) noise — F1 distance to nearest seed point
// =============================================================================
// Per query (x, y), look at the 3x3 grid cells around it, hash-place one seed
// point inside each cell, return the distance to the nearest one (F1) and,
// optionally, the second-nearest (F2). F2-F1 yields the "cracked-tile" pattern
// Worley noise is famous for.
//
// Deterministic: the hash is seed-seeded so a given (seed, x, y) always
// produces the same point placements. No setInterval, no Math.random — safe
// to call a thousand times per frame.
// =============================================================================

export type DistMetric = 'euclid' | 'manhattan' | 'chebyshev';

export interface WorleyResult { f1: number; f2: number }

function hash2(seed: number, ix: number, iy: number): number {
  // Fast 2D integer hash. Mulberry-ish mixing; returns a uint32 we fold to
  // [0, 1) for each of x-offset and y-offset inside a cell.
  let h = (seed ^ 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ ix, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ iy, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function cellPoint(seed: number, ix: number, iy: number): [number, number] {
  const a = hash2(seed,        ix, iy);
  const b = hash2(seed ^ 1013, ix, iy);
  return [(a >>> 0) / 4294967296, (b >>> 0) / 4294967296];
}

function dist(dx: number, dy: number, metric: DistMetric): number {
  if (metric === 'manhattan') return Math.abs(dx) + Math.abs(dy);
  if (metric === 'chebyshev') return Math.max(Math.abs(dx), Math.abs(dy));
  return Math.sqrt(dx * dx + dy * dy);
}

export class WorleyNoise {
  seed: number;
  metric: DistMetric;

  constructor(seed: number = 0, metric: DistMetric = 'euclid') {
    this.seed = seed | 0;
    this.metric = metric;
  }

  reseed(seed: number) { this.seed = seed | 0; }
  setMetric(metric: DistMetric) { this.metric = metric; }

  noise2(x: number, y: number): WorleyResult {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let f1 = Infinity;
    let f2 = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const [px, py] = cellPoint(this.seed, cx, cy);
        const sx = cx + px;
        const sy = cy + py;
        const d = dist(x - sx, y - sy, this.metric);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
    return { f1, f2 };
  }

  /** Convenience: 1 - F1 clamped to [0, 1]. Bright near seed points, dark
   *  between them. Good "glowing pebbles" look. */
  intensity(x: number, y: number): number {
    const { f1 } = this.noise2(x, y);
    return Math.max(0, Math.min(1, 1 - f1));
  }

  /** F2 - F1: the classic Voronoi-edge pattern. High on cell boundaries,
   *  zero near cell centres. */
  edges(x: number, y: number): number {
    const { f1, f2 } = this.noise2(x, y);
    return f2 - f1;
  }
}
