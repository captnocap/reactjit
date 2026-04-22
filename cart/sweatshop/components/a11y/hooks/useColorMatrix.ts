// =============================================================================
// useColorMatrix — color-blindness matrices + per-hex transformer
// =============================================================================
// Canonical Brettel/Viénot LMS-projection matrices for the common dichromacies
// plus achromatopsia (full colour loss) and a simple monochrome desaturate.
// applyColorMatrix() takes a hex string + a 3x3 matrix and returns a new hex
// with the transform applied. Used by useA11yState to re-derive the whole
// theme palette so every COLORS.x read in the app picks up the simulation.
// =============================================================================

export type ColorBlindMode =
  | 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  | 'achromatopsia' | 'monochrome';

/** 3x3 in row-major order: [r→r, r→g, r→b, g→r, g→g, g→b, b→r, b→g, b→b]. */
export type ColorMatrix = [
  number, number, number,
  number, number, number,
  number, number, number,
];

// Source: Martin Krzywinski / Machado 2009 simulation matrices normalised
// to the sRGB channel order. Applied in linear RGB for accuracy; we do the
// sRGB linearise / relinearise hop inside applyColorMatrix.
export const COLOR_MATRICES: Record<ColorBlindMode, ColorMatrix> = {
  off: [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ],
  protanopia: [
    0.567, 0.433, 0.000,
    0.558, 0.442, 0.000,
    0.000, 0.242, 0.758,
  ],
  deuteranopia: [
    0.625, 0.375, 0.000,
    0.700, 0.300, 0.000,
    0.000, 0.300, 0.700,
  ],
  tritanopia: [
    0.950, 0.050, 0.000,
    0.000, 0.433, 0.567,
    0.000, 0.475, 0.525,
  ],
  achromatopsia: [
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114,
    0.299, 0.587, 0.114,
  ],
  monochrome: [
    0.333, 0.333, 0.333,
    0.333, 0.333, 0.333,
    0.333, 0.333, 0.333,
  ],
};

function hexToRgb01(hex: string): [number, number, number] | null {
  if (!hex || hex[0] !== '#') return null;
  const s = hex.slice(1);
  const full = s.length === 3
    ? s.split('').map((c) => c + c).join('')
    : s.slice(0, 6);
  if (full.length !== 6) return null;
  const n = parseInt(full, 16);
  if (!isFinite(n)) return null;
  return [ ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255 ];
}

function rgb01ToHex(r: number, g: number, b: number): string {
  const c = (v: number) => {
    const n = Math.max(0, Math.min(255, Math.round(v * 255)));
    return n.toString(16).padStart(2, '0');
  };
  return '#' + c(r) + c(g) + c(b);
}

function srgbToLinear(c: number): number { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c: number): number { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

/** Apply a 3x3 matrix to a hex colour in linear-RGB space. Returns a new
 *  hex; leaves non-hex inputs (transparent, rgba(), etc.) unchanged. */
export function applyColorMatrix(hex: string, m: ColorMatrix): string {
  const rgb = hexToRgb01(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map(srgbToLinear) as [number, number, number];
  const nr = m[0] * r + m[1] * g + m[2] * b;
  const ng = m[3] * r + m[4] * g + m[5] * b;
  const nb = m[6] * r + m[7] * g + m[8] * b;
  return rgb01ToHex(linearToSrgb(nr), linearToSrgb(ng), linearToSrgb(nb));
}

/** Boost contrast: push every colour channel away from the midpoint. amount
 *  is 0..1 (0 = no change, 1 = everything snaps to black or white). */
export function boostContrast(hex: string, amount: number): string {
  const rgb = hexToRgb01(hex);
  if (!rgb) return hex;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const a = clamp(amount);
  const push = (c: number) => clamp((c - 0.5) * (1 + a * 2) + 0.5);
  return rgb01ToHex(push(rgb[0]), push(rgb[1]), push(rgb[2]));
}
