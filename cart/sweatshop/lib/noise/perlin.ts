// =============================================================================
// Perlin noise — classic "improved" Perlin (Ken Perlin, 2002)
// =============================================================================
// Deterministic per seed. Returns values in [-1, 1] (fractional-precision —
// the canonical [-sqrt(n/4), sqrt(n/4)] band is close enough to [-1,1] in
// 2D/3D for our cart-side preview use that we don't bother rescaling).
//
// Real tool, real data: a seed-driven pseudo-random permutation table →
// deterministic gradient lookups → deterministic output for any (x,y,z).
// No Math.random() at paint time. Given the same seed, two runs produce
// the exact same noise field.
// =============================================================================

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad3(hash: number, x: number, y: number, z: number): number {
  // 12 edge-midpoints of a cube, selected by the low 4 bits of hash.
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// Mulberry32 — deterministic 32-bit hash → float generator, seeded by a
// single integer. Used to build the permutation table per seed.
function mulberry32(seed: number) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class PerlinNoise {
  private perm: Uint8Array;

  constructor(seed: number = 0) {
    this.perm = buildPermutation(seed);
  }

  reseed(seed: number) {
    this.perm = buildPermutation(seed);
  }

  noise2(x: number, y: number): number {
    return this.noise3(x, y, 0);
  }

  noise3(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const p = this.perm;
    const A  = p[X] + Y;
    const AA = p[A & 255] + Z;
    const AB = p[(A + 1) & 255] + Z;
    const B  = p[(X + 1) & 255] + Y;
    const BA = p[B & 255] + Z;
    const BB = p[(B + 1) & 255] + Z;
    return lerp(
      lerp(
        lerp(grad3(p[AA & 255],      xf,     yf,     zf    ), grad3(p[BA & 255],      xf - 1, yf,     zf    ), u),
        lerp(grad3(p[AB & 255],      xf,     yf - 1, zf    ), grad3(p[BB & 255],      xf - 1, yf - 1, zf    ), u),
        v,
      ),
      lerp(
        lerp(grad3(p[(AA + 1) & 255], xf,    yf,     zf - 1), grad3(p[(BA + 1) & 255], xf - 1, yf,     zf - 1), u),
        lerp(grad3(p[(AB + 1) & 255], xf,    yf - 1, zf - 1), grad3(p[(BB + 1) & 255], xf - 1, yf - 1, zf - 1), u),
        v,
      ),
      w,
    );
  }
}

function buildPermutation(seed: number): Uint8Array {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  const rand = mulberry32(seed);
  // Fisher-Yates shuffle seeded by Mulberry32 — deterministic.
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  return perm;
}
