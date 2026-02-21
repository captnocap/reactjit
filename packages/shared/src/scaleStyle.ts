/**
 * Scale numeric style values by a viewport-proportional factor.
 *
 * Used by ScaleProvider to make hardcoded pixel values responsive:
 * at 800x600 scale=1 (everything as authored), at 1600x1200 scale=2
 * (everything proportionally bigger).
 *
 * Only numeric dimensional values are scaled. String values ('100%'),
 * ratios (opacity, flexGrow), indices (zIndex), and colors are untouched.
 */

import type { Style } from './types';

// Properties where numeric values represent pixel dimensions and should scale.
const SCALE_NUMERIC: Set<string> = new Set([
  // Sizing
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'flexBasis',
  // Spacing
  'gap', 'padding', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom',
  // Typography
  'fontSize', 'lineHeight', 'letterSpacing',
  // Borders
  'borderRadius', 'borderWidth',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  // Shadow
  'shadowOffsetX', 'shadowOffsetY', 'shadowBlur',
  // Text shadow
  'textShadowOffsetX', 'textShadowOffsetY',
  // Outline
  'outlineWidth', 'outlineOffset',
  // Position (only when numeric, not percentage strings)
  'top', 'right', 'bottom', 'left',
]);

// Transform properties that represent pixel offsets (should scale).
const SCALE_TRANSFORM: Set<string> = new Set([
  'translateX', 'translateY',
]);

export function scaleStyle(style: Style | undefined, scale: number): Style | undefined {
  if (!style || scale === 1) return style;

  const out: any = {};

  for (const key of Object.keys(style)) {
    const val = (style as any)[key];

    if (key === 'transform' && val && typeof val === 'object') {
      // Handle transform object: scale translate, leave rotate/scale/skew/origin alone
      const t: any = {};
      for (const tk of Object.keys(val)) {
        t[tk] = SCALE_TRANSFORM.has(tk) && typeof val[tk] === 'number'
          ? Math.round(val[tk] * scale)
          : val[tk];
      }
      out[key] = t;
    } else if (key === 'animation' && val && typeof val === 'object' && val.keyframes) {
      // Scale keyframe values recursively
      const kf: any = {};
      for (const pct of Object.keys(val.keyframes)) {
        kf[pct] = scaleStyle(val.keyframes[pct], scale);
      }
      out[key] = { ...val, keyframes: kf };
    } else if (SCALE_NUMERIC.has(key) && typeof val === 'number') {
      out[key] = Math.round(val * scale);
    } else {
      out[key] = val;
    }
  }

  return out as Style;
}
