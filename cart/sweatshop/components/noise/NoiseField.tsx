// =============================================================================
// NoiseField — paints a grid of Canvas.Node cells sampled from the active algo
// =============================================================================
// Real data, not a demo texture: every cell colour is the live noise value at
// that (gx, gy), recomputed from the current seed and parameters. The grid
// density is user-controllable; at 64×48 we paint 3072 cells per mount. useMemo
// pins the field to (algorithm, seed, scale, resolution, octaves, metric) so
// tweaking controls re-renders only when something actually changed.
// =============================================================================

import { Box, Canvas } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { PerlinNoise } from '../../lib/noise/perlin';
import { SimplexNoise } from '../../lib/noise/simplex';
import { WorleyNoise, type DistMetric } from '../../lib/noise/worley';
import { fbm2, ridge2, turbulence2 } from '../../lib/noise/fbm';

export type NoiseAlgo =
  | 'perlin' | 'simplex' | 'worley-f1' | 'worley-edges'
  | 'fbm-perlin' | 'fbm-simplex' | 'ridge-perlin' | 'turbulence-simplex';

export interface NoiseFieldProps {
  algo: NoiseAlgo;
  seed: number;
  scale: number;         // world units per pixel — lower = more zoomed in
  cols: number;          // grid density horizontally
  rows: number;          // grid density vertically
  octaves: number;       // for fbm/ridge/turbulence variants
  metric: DistMetric;    // for worley
  paletteHot: string;    // hex — high-value cell tint
  paletteCold: string;   // hex — low-value cell tint
  showGrid: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const v = parseInt(s.length === 3
    ? s.split('').map((c) => c + c).join('')
    : s.slice(0, 6),
  16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + hex(r) + hex(g) + hex(b);
}
function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function NoiseField(props: NoiseFieldProps) {
  const { algo, seed, scale, cols, rows, octaves, metric, paletteHot, paletteCold, showGrid } = props;
  const perlin = useMemo(() => new PerlinNoise(seed), [seed]);
  const simplex = useMemo(() => new SimplexNoise(seed), [seed]);
  const worley = useMemo(() => new WorleyNoise(seed, metric), [seed, metric]);

  const sample = (x: number, y: number): number => {
    const wx = x * scale;
    const wy = y * scale;
    switch (algo) {
      case 'perlin':                return perlin.noise2(wx, wy);
      case 'simplex':               return simplex.noise2(wx, wy);
      case 'worley-f1':             return 1 - worley.noise2(wx, wy).f1;
      case 'worley-edges':          return worley.edges(wx, wy) * 2 - 1;
      case 'fbm-perlin':            return fbm2((a, b) => perlin.noise2(a, b), wx, wy, { octaves });
      case 'fbm-simplex':           return fbm2((a, b) => simplex.noise2(a, b), wx, wy, { octaves });
      case 'ridge-perlin':          return ridge2((a, b) => perlin.noise2(a, b), wx, wy, { octaves }) * 2 - 1;
      case 'turbulence-simplex':    return turbulence2((a, b) => simplex.noise2(a, b), wx, wy, { octaves }) * 2 - 1;
    }
  };

  const cells = useMemo(() => {
    const out: Array<{ key: string; gx: number; gy: number; gw: number; gh: number; fill: string }> = [];
    const cw = 1 / cols;
    const ch = 1 / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // Clamp & squash [-1,1] to [0,1] for colour lerp.
        const v = Math.max(-1, Math.min(1, sample(i, j)));
        const t = (v + 1) * 0.5;
        out.push({
          key: i + ',' + j,
          gx: i * cw,
          gy: j * ch,
          gw: cw,
          gh: ch,
          fill: lerpHex(paletteCold, paletteHot, t),
        });
      }
    }
    return out;
  }, [algo, seed, scale, cols, rows, octaves, metric, paletteHot, paletteCold]);

  return (
    <Box style={{
      flexGrow: 1, flexBasis: 0, position: 'relative',
      borderRadius: TOKENS.radiusSm, overflow: 'hidden',
      backgroundColor: paletteCold,
      borderWidth: 1, borderColor: COLORS.border,
    }}>
      <Canvas style={{ width: '100%', height: '100%' }}>
        {cells.map((c) => (
          <Canvas.Node key={c.key} gx={c.gx} gy={c.gy} gw={c.gw} gh={c.gh}
            fill={c.fill}
            stroke={showGrid ? COLORS.border : undefined}
            strokeWidth={showGrid ? 1 : 0} />
        ))}
      </Canvas>
    </Box>
  );
}
