import { register } from './registry';
import type { RGB, HSL, HSV } from './types';

// ── CSS named colors (subset of most common) ───────────

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', gold: '#ffd700',
  navy: '#000080', teal: '#008080', olive: '#808000', maroon: '#800000',
  lime: '#00ff00', aqua: '#00ffff', fuchsia: '#ff00ff',
  coral: '#ff7f50', salmon: '#fa8072', tomato: '#ff6347',
  chocolate: '#d2691e', tan: '#d2b48c', wheat: '#f5deb3',
  ivory: '#fffff0', beige: '#f5f5dc', linen: '#faf0e6',
  lavender: '#e6e6fa', plum: '#dda0dd', orchid: '#da70d6',
  turquoise: '#40e0d0', skyblue: '#87ceeb', steelblue: '#4682b4',
  indigo: '#4b0082', violet: '#ee82ee', crimson: '#dc143c',
  khaki: '#f0e68c', sienna: '#a0522d', peru: '#cd853f',
};

const HEX_TO_NAME = new Map<string, string>();
for (const [name, hex] of Object.entries(NAMED_COLORS)) {
  HEX_TO_NAME.set(hex, name);
}

// ── Conversion functions ────────────────────────────────

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb(hsl: HSL): RGB {
  const { h, s, l } = hsl;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, v };
}

export function hsvToRgb(hsv: HSV): RGB {
  const { h, s, v } = hsv;
  const i = Math.floor((h / 360) * 6);
  const f = (h / 360) * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function hexToHsl(hex: string): HSL { return rgbToHsl(hexToRgb(hex)); }
export function hslToHex(hsl: HSL): string { return rgbToHex(hslToRgb(hsl)); }
export function hexToHsv(hex: string): HSV { return rgbToHsv(hexToRgb(hex)); }
export function hsvToHex(hsv: HSV): string { return rgbToHex(hsvToRgb(hsv)); }

export function namedToHex(name: string): string {
  const hex = NAMED_COLORS[name.toLowerCase()];
  if (!hex) throw new Error(`Unknown color name: "${name}"`);
  return hex;
}

export function hexToNamed(hex: string): string {
  const normalized = hex.toLowerCase();
  const name = HEX_TO_NAME.get(normalized);
  if (!name) throw new Error(`No named color for: "${hex}"`);
  return name;
}

// ── Registry registration ───────────────────────────────

register('hex', 'rgb', hexToRgb, 'color');
register('rgb', 'hex', rgbToHex, 'color');
register('rgb', 'hsl', rgbToHsl, 'color');
register('hsl', 'rgb', hslToRgb, 'color');
register('rgb', 'hsv', rgbToHsv, 'color');
register('hsv', 'rgb', hsvToRgb, 'color');
register('hex', 'hsl', hexToHsl, 'color');
register('hsl', 'hex', hslToHex, 'color');
register('hex', 'hsv', hexToHsv, 'color');
register('hsv', 'hex', hsvToHex, 'color');
register('named', 'hex', namedToHex, 'color');
register('hex', 'named', hexToNamed, 'color');
