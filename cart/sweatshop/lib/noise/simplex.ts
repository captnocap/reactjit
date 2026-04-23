// =============================================================================
// Simplex noise — 2D variant of Stefan Gustavson's implementation
// =============================================================================
// Lower directional artifacts than Perlin, cheaper in 3D+, output is in
// roughly [-1, 1]. Seeded deterministically off Mulberry32, same pattern
// as the Perlin file. Given the same seed, noise2(x,y) returns the same
// float bit-for-bit across runs.
// =============================================================================

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

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

function buildPerm(seed: number): Uint8Array {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  const rand = mulberry32(seed);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  return perm;
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

export class SimplexNoise {
  private perm: Uint8Array;

  constructor(seed: number = 0) {
    this.perm = buildPerm(seed);
  }

  reseed(seed: number) {
    this.perm = buildPerm(seed);
  }

  noise2(xin: number, yin: number): number {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[(ii + this.perm[jj]) & 255] % 8;
    const gi1 = this.perm[(ii + i1 + this.perm[(jj + j1) & 255]) & 255] % 8;
    const gi2 = this.perm[(ii + 1 + this.perm[(jj + 1) & 255]) & 255] % 8;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const g = GRAD2[gi0];
      n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const g = GRAD2[gi1];
      n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const g = GRAD2[gi2];
      n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    // 70 is Gustavson's normalisation factor to hit ≈[-1, 1].
    return 70.0 * (n0 + n1 + n2);
  }
}
