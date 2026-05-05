// =============================================================================
// fBm — fractal Brownian motion over any noise2 function
// =============================================================================
// Layers octaves of a base noise, each doubled in frequency and halved in
// amplitude (by default — lacunarity + persistence tune those). Returns an
// approximately [-1, 1] value normalised by the total amplitude sum so the
// output range doesn't swell with octave count.
// =============================================================================

export interface FbmOptions {
  octaves?: number;         // 1..8 typical
  lacunarity?: number;      // frequency multiplier per octave (2 = classic)
  persistence?: number;     // amplitude multiplier per octave (0.5 = classic)
}

export function fbm2(
  noise2: (x: number, y: number) => number,
  x: number,
  y: number,
  opts: FbmOptions = {},
): number {
  const octaves     = Math.max(1, Math.min(8, opts.octaves ?? 4));
  const lacunarity  = opts.lacunarity  ?? 2;
  const persistence = opts.persistence ?? 0.5;

  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let ampSum = 0;

  for (let i = 0; i < octaves; i++) {
    sum    += noise2(x * frequency, y * frequency) * amplitude;
    ampSum += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return ampSum > 0 ? sum / ampSum : 0;
}

/** Ridge noise: 1 - |fbm| — turns noise into a mountain-range shape. */
export function ridge2(
  noise2: (x: number, y: number) => number,
  x: number,
  y: number,
  opts: FbmOptions = {},
): number {
  return 1 - Math.abs(fbm2(noise2, x, y, opts));
}

/** Turbulence: sum of abs(noise) per octave. Returns ≈[0, 1]. */
export function turbulence2(
  noise2: (x: number, y: number) => number,
  x: number,
  y: number,
  opts: FbmOptions = {},
): number {
  const octaves     = Math.max(1, Math.min(8, opts.octaves ?? 4));
  const lacunarity  = opts.lacunarity  ?? 2;
  const persistence = opts.persistence ?? 0.5;

  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let ampSum = 0;
  for (let i = 0; i < octaves; i++) {
    sum    += Math.abs(noise2(x * frequency, y * frequency)) * amplitude;
    ampSum += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return ampSum > 0 ? sum / ampSum : 0;
}
