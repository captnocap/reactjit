/**
 * tw() — Tailwind CSS class-to-Style parser for ReactJIT.
 *
 * Translates Tailwind utility class names into ReactJIT Style objects.
 * No Tailwind installation required — we ARE the browser.
 *
 * Usage:
 *   import { tw } from '@reactjit/core';
 *   <Box style={tw("p-4 flex-row gap-2 bg-blue-500 rounded-lg")} />
 *
 * Supports arbitrary values: p-[20], w-[300], bg-[#ff6600]
 * Unknown classes are silently ignored.
 */

import type { Style, Color } from './types';

// ── Spacing Scale (Tailwind default: n → px) ────────────────────────

const SPACING: Record<string, number> = {
  '0': 0, 'px': 1, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
  '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28, '8': 32,
  '9': 36, '10': 40, '11': 44, '12': 48, '14': 56, '16': 64, '20': 80,
  '24': 96, '28': 112, '32': 128, '36': 144, '40': 160, '44': 176,
  '48': 192, '52': 208, '56': 224, '60': 240, '64': 256, '72': 288,
  '80': 320, '96': 384,
};

function spacing(val: string): number | undefined {
  // Arbitrary value: [20]
  if (val.startsWith('[') && val.endsWith(']')) {
    const n = parseFloat(val.slice(1, -1));
    return isNaN(n) ? undefined : n;
  }
  return SPACING[val];
}

// ── Fractional / keyword sizing ──────────────────────────────────────

function widthValue(val: string): number | string | undefined {
  if (val === 'full') return '100%';
  if (val === 'screen') return '100%';
  if (val === 'auto') return undefined; // let engine decide
  if (val === 'min') return undefined;
  if (val === 'max') return undefined;
  if (val === 'fit') return undefined;
  // Fractions
  if (val === '1/2') return '50%';
  if (val === '1/3') return '33.333%';
  if (val === '2/3') return '66.667%';
  if (val === '1/4') return '25%';
  if (val === '2/4') return '50%';
  if (val === '3/4') return '75%';
  if (val === '1/5') return '20%';
  if (val === '2/5') return '40%';
  if (val === '3/5') return '60%';
  if (val === '4/5') return '80%';
  if (val === '1/6') return '16.667%';
  if (val === '5/6') return '83.333%';
  if (val === '1/12') return '8.333%';
  if (val === '2/12') return '16.667%';
  if (val === '3/12') return '25%';
  if (val === '4/12') return '33.333%';
  if (val === '5/12') return '41.667%';
  if (val === '6/12') return '50%';
  if (val === '7/12') return '58.333%';
  if (val === '8/12') return '66.667%';
  if (val === '9/12') return '75%';
  if (val === '10/12') return '83.333%';
  if (val === '11/12') return '91.667%';
  // Arbitrary value
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1);
    if (inner.endsWith('%') || inner.endsWith('vw') || inner.endsWith('vh')) return inner;
    const n = parseFloat(inner);
    return isNaN(n) ? undefined : n;
  }
  // Numeric spacing
  return spacing(val);
}

// ── Max-width named scale ────────────────────────────────────────────

const MAX_WIDTH: Record<string, number | string> = {
  '0': 0, 'none': 'none' as any, 'xs': 320, 'sm': 384, 'md': 448,
  'lg': 512, 'xl': 576, '2xl': 672, '3xl': 768, '4xl': 896,
  '5xl': 1024, '6xl': 1152, '7xl': 1280, 'full': '100%', 'screen': '100%',
};

// ── Font Size Scale ──────────────────────────────────────────────────

const FONT_SIZE: Record<string, number> = {
  'xs': 12, 'sm': 14, 'base': 16, 'lg': 18, 'xl': 20,
  '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60,
  '7xl': 72, '8xl': 96, '9xl': 128,
};

// ── Font Weight ──────────────────────────────────────────────────────

const FONT_WEIGHT: Record<string, 'normal' | 'bold' | number> = {
  'thin': 100, 'extralight': 200, 'light': 300, 'normal': 'normal',
  'medium': 500, 'semibold': 600, 'bold': 'bold',
  'extrabold': 800, 'black': 900,
};

// ── Border Radius Scale ──────────────────────────────────────────────

const RADIUS: Record<string, number> = {
  'none': 0, 'sm': 2, 'DEFAULT': 4, 'md': 6, 'lg': 8,
  'xl': 12, '2xl': 16, '3xl': 24, 'full': 9999,
};

function radiusValue(val: string | undefined): number | undefined {
  if (val === undefined) return RADIUS['DEFAULT'];
  if (val.startsWith('[') && val.endsWith(']')) {
    const n = parseFloat(val.slice(1, -1));
    return isNaN(n) ? undefined : n;
  }
  return RADIUS[val] ?? undefined;
}

// ── Shadow Presets ───────────────────────────────────────────────────

interface ShadowPreset { shadowColor: Color; shadowOffsetX: number; shadowOffsetY: number; shadowBlur: number; }
const SHADOW: Record<string, ShadowPreset> = {
  'sm':      { shadowColor: 'rgba(0,0,0,0.05)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 },
  'DEFAULT': { shadowColor: 'rgba(0,0,0,0.1)',  shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 3 },
  'md':      { shadowColor: 'rgba(0,0,0,0.1)',  shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 },
  'lg':      { shadowColor: 'rgba(0,0,0,0.1)',  shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 },
  'xl':      { shadowColor: 'rgba(0,0,0,0.1)',  shadowOffsetX: 0, shadowOffsetY: 20, shadowBlur: 25 },
  '2xl':     { shadowColor: 'rgba(0,0,0,0.25)', shadowOffsetX: 0, shadowOffsetY: 25, shadowBlur: 50 },
  'none':    { shadowColor: 'transparent', shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0 },
};

// ── Letter Spacing ───────────────────────────────────────────────────

const TRACKING: Record<string, number> = {
  'tighter': -0.8, 'tight': -0.4, 'normal': 0,
  'wide': 0.4, 'wider': 0.8, 'widest': 1.6,
};

// ── Leading (lineHeight) ─────────────────────────────────────────────

const LEADING: Record<string, number> = {
  '3': 12, '4': 16, '5': 20, '6': 24, '7': 28, '8': 32, '9': 36, '10': 40,
  'none': 1, 'tight': 1.25, 'snug': 1.375, 'normal': 1.5, 'relaxed': 1.625, 'loose': 2,
};

// ── Color Palette (Tailwind 3) ───────────────────────────────────────

const COLORS: Record<string, Record<string, string>> = {
  slate:   { '50':'#f8fafc','100':'#f1f5f9','200':'#e2e8f0','300':'#cbd5e1','400':'#94a3b8','500':'#64748b','600':'#475569','700':'#334155','800':'#1e293b','900':'#0f172a','950':'#020617' },
  gray:    { '50':'#f9fafb','100':'#f3f4f6','200':'#e5e7eb','300':'#d1d5db','400':'#9ca3af','500':'#6b7280','600':'#4b5563','700':'#374151','800':'#1f2937','900':'#111827','950':'#030712' },
  zinc:    { '50':'#fafafa','100':'#f4f4f5','200':'#e4e4e7','300':'#d4d4d8','400':'#a1a1aa','500':'#71717a','600':'#52525b','700':'#3f3f46','800':'#27272a','900':'#18181b','950':'#09090b' },
  neutral: { '50':'#fafafa','100':'#f5f5f5','200':'#e5e5e5','300':'#d4d4d4','400':'#a3a3a3','500':'#737373','600':'#525252','700':'#404040','800':'#262626','900':'#171717','950':'#0a0a0a' },
  stone:   { '50':'#fafaf9','100':'#f5f5f4','200':'#e7e5e4','300':'#d6d3d1','400':'#a8a29e','500':'#78716c','600':'#57534e','700':'#44403c','800':'#292524','900':'#1c1917','950':'#0c0a09' },
  red:     { '50':'#fef2f2','100':'#fee2e2','200':'#fecaca','300':'#fca5a5','400':'#f87171','500':'#ef4444','600':'#dc2626','700':'#b91c1c','800':'#991b1b','900':'#7f1d1d','950':'#450a0a' },
  orange:  { '50':'#fff7ed','100':'#ffedd5','200':'#fed7aa','300':'#fdba74','400':'#fb923c','500':'#f97316','600':'#ea580c','700':'#c2410c','800':'#9a3412','900':'#7c2d12','950':'#431407' },
  amber:   { '50':'#fffbeb','100':'#fef3c7','200':'#fde68a','300':'#fcd34d','400':'#fbbf24','500':'#f59e0b','600':'#d97706','700':'#b45309','800':'#92400e','900':'#78350f','950':'#451a03' },
  yellow:  { '50':'#fefce8','100':'#fef9c3','200':'#fef08a','300':'#fde047','400':'#facc15','500':'#eab308','600':'#ca8a04','700':'#a16207','800':'#854d0e','900':'#713f12','950':'#422006' },
  lime:    { '50':'#f7fee7','100':'#ecfccb','200':'#d9f99d','300':'#bef264','400':'#a3e635','500':'#84cc16','600':'#65a30d','700':'#4d7c0f','800':'#3f6212','900':'#365314','950':'#1a2e05' },
  green:   { '50':'#f0fdf4','100':'#dcfce7','200':'#bbf7d0','300':'#86efac','400':'#4ade80','500':'#22c55e','600':'#16a34a','700':'#15803d','800':'#166534','900':'#14532d','950':'#052e16' },
  emerald: { '50':'#ecfdf5','100':'#d1fae5','200':'#a7f3d0','300':'#6ee7b7','400':'#34d399','500':'#10b981','600':'#059669','700':'#047857','800':'#065f46','900':'#064e3b','950':'#022c22' },
  teal:    { '50':'#f0fdfa','100':'#ccfbf1','200':'#99f6e4','300':'#5eead4','400':'#2dd4bf','500':'#14b8a6','600':'#0d9488','700':'#0f766e','800':'#115e59','900':'#134e4a','950':'#042f2e' },
  cyan:    { '50':'#ecfeff','100':'#cffafe','200':'#a5f3fc','300':'#67e8f9','400':'#22d3ee','500':'#06b6d4','600':'#0891b2','700':'#0e7490','800':'#155e75','900':'#164e63','950':'#083344' },
  sky:     { '50':'#f0f9ff','100':'#e0f2fe','200':'#bae6fd','300':'#7dd3fc','400':'#38bdf8','500':'#0ea5e9','600':'#0284c7','700':'#0369a1','800':'#075985','900':'#0c4a6e','950':'#082f49' },
  blue:    { '50':'#eff6ff','100':'#dbeafe','200':'#bfdbfe','300':'#93c5fd','400':'#60a5fa','500':'#3b82f6','600':'#2563eb','700':'#1d4ed8','800':'#1e40af','900':'#1e3a8a','950':'#172554' },
  indigo:  { '50':'#eef2ff','100':'#e0e7ff','200':'#c7d2fe','300':'#a5b4fc','400':'#818cf8','500':'#6366f1','600':'#4f46e5','700':'#4338ca','800':'#3730a3','900':'#312e81','950':'#1e1b4b' },
  violet:  { '50':'#f5f3ff','100':'#ede9fe','200':'#ddd6fe','300':'#c4b5fd','400':'#a78bfa','500':'#8b5cf6','600':'#7c3aed','700':'#6d28d9','800':'#5b21b6','900':'#4c1d95','950':'#2e1065' },
  purple:  { '50':'#faf5ff','100':'#f3e8ff','200':'#e9d5ff','300':'#d8b4fe','400':'#c084fc','500':'#a855f7','600':'#9333ea','700':'#7e22ce','800':'#6b21a8','900':'#581c87','950':'#3b0764' },
  fuchsia: { '50':'#fdf4ff','100':'#fae8ff','200':'#f5d0fe','300':'#f0abfc','400':'#e879f9','500':'#d946ef','600':'#c026d3','700':'#a21caf','800':'#86198f','900':'#701a75','950':'#4a044e' },
  pink:    { '50':'#fdf2f8','100':'#fce7f3','200':'#fbcfe8','300':'#f9a8d4','400':'#f472b6','500':'#ec4899','600':'#db2777','700':'#be185d','800':'#9d174d','900':'#831843','950':'#500724' },
  rose:    { '50':'#fff1f2','100':'#ffe4e6','200':'#fecdd3','300':'#fda4af','400':'#fb7185','500':'#f43f5e','600':'#e11d48','700':'#be123c','800':'#9f1239','900':'#881337','950':'#4c0519' },
};

/** Resolve a Tailwind color reference like "blue-500", "white", "black", "[#ff6600]" */
function resolveColor(val: string): string | undefined {
  if (val === 'transparent') return 'transparent';
  if (val === 'black') return '#000000';
  if (val === 'white') return '#ffffff';
  if (val === 'inherit' || val === 'current') return 'inherit';
  // Arbitrary: [#ff6600] or [rgb(1,2,3)]
  if (val.startsWith('[') && val.endsWith(']')) return val.slice(1, -1);
  // color-shade: "blue-500"
  const dash = val.lastIndexOf('-');
  if (dash === -1) return undefined;
  const family = val.slice(0, dash);
  const shade = val.slice(dash + 1);
  return COLORS[family]?.[shade];
}

// ── Per-class parser ─────────────────────────────────────────────────

// Gradient state accumulated across tokens in a single tw() call.
interface GradientState {
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  from?: string;
  to?: string;
}

// Transition state accumulated across tokens.
interface TransitionState {
  active?: boolean;
  duration?: number;
  easing?: string;
  delay?: number;
}

function parseClass(cls: string, grad: GradientState, trans: TransitionState): Partial<Style> | undefined {
  // ── Pseudo-variant stripping ──
  // hover:bg-gray-800 → silently ignored (ReactJIT handles hover via onHoverIn/onHoverOut)
  // group-hover:*, focus:*, disabled:*, last:*, first:*, active:*, etc.
  if (cls.includes(':')) return {};

  // ── Static keywords ──

  if (cls === 'flex') return {};
  if (cls === 'block') return {};
  if (cls === 'inline-block') return {};
  if (cls === 'inline') return {};
  if (cls === 'inline-flex') return { flexDirection: 'row' };
  if (cls === 'grid') return { flexDirection: 'row', flexWrap: 'wrap' };
  if (cls === 'hidden') return { display: 'none' };
  if (cls === 'visible') return { visibility: 'visible' };
  if (cls === 'invisible') return { visibility: 'hidden' };
  if (cls === 'relative') return { position: 'relative' };
  if (cls === 'absolute') return { position: 'absolute' };
  if (cls === 'sticky') return { position: 'relative' };
  if (cls === 'fixed') return { position: 'absolute' };
  if (cls === 'truncate') return { textOverflow: 'ellipsis', overflow: 'hidden' };
  if (cls === 'underline') return { textDecorationLine: 'underline' };
  if (cls === 'line-through') return { textDecorationLine: 'line-through' };
  if (cls === 'no-underline') return { textDecorationLine: 'none' };
  if (cls === 'italic') return {}; // noted: not rendered in Lua yet
  if (cls === 'not-italic') return {};
  if (cls === 'uppercase') return {};
  if (cls === 'lowercase') return {};
  if (cls === 'capitalize') return {};
  if (cls === 'normal-case') return {};
  if (cls === 'break-words') return {};
  if (cls === 'break-all') return {};
  if (cls === 'whitespace-nowrap') return {};
  if (cls === 'whitespace-pre') return {};
  if (cls === 'grow') return { flexGrow: 1 };
  if (cls === 'grow-0') return { flexGrow: 0 };
  if (cls === 'shrink') return { flexShrink: 1 };
  if (cls === 'shrink-0') return { flexShrink: 0 };
  if (cls === 'group') return {};
  if (cls === 'cursor-pointer') return {};
  if (cls === 'cursor-default') return {};
  if (cls === 'cursor-not-allowed') return {};
  if (cls === 'select-none') return {};
  if (cls === 'select-text') return {};
  if (cls === 'resize-none') return {};
  if (cls === 'outline-none') return { outlineWidth: 0 };
  if (cls === 'outline-0') return { outlineWidth: 0 };
  if (cls === 'backdrop-blur') return {};
  if (cls === 'backdrop-blur-sm') return {};
  if (cls === 'backdrop-blur-md') return {};
  if (cls === 'backdrop-blur-lg') return {};
  if (cls === 'backdrop-blur-xl') return {};
  if (cls === 'backdrop-blur-2xl') return {};
  if (cls === 'backdrop-blur-3xl') return {};

  // ── Flex shorthands ──

  if (cls === 'flex-row') return { flexDirection: 'row' };
  if (cls === 'flex-col') return { flexDirection: 'column' };
  if (cls === 'flex-row-reverse') return { flexDirection: 'row' };
  if (cls === 'flex-col-reverse') return { flexDirection: 'column' };
  if (cls === 'flex-wrap') return { flexWrap: 'wrap' };
  if (cls === 'flex-wrap-reverse') return { flexWrap: 'wrap' };
  if (cls === 'flex-nowrap') return { flexWrap: 'nowrap' };
  if (cls === 'flex-1') return { flexGrow: 1, flexShrink: 1, flexBasis: 0 };
  if (cls === 'flex-auto') return { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' };
  if (cls === 'flex-initial') return { flexGrow: 0, flexShrink: 1, flexBasis: 'auto' };
  if (cls === 'flex-none') return { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' };
  if (cls === 'flex-shrink') return { flexShrink: 1 };
  if (cls === 'flex-shrink-0') return { flexShrink: 0 };
  if (cls === 'flex-grow') return { flexGrow: 1 };
  if (cls === 'flex-grow-0') return { flexGrow: 0 };

  // ── Overflow ──

  if (cls === 'overflow-hidden') return { overflow: 'hidden' };
  if (cls === 'overflow-visible') return { overflow: 'visible' };
  if (cls === 'overflow-scroll') return { overflow: 'scroll' };
  if (cls === 'overflow-auto') return { overflow: 'scroll' };
  if (cls === 'overflow-x-auto') return { overflow: 'scroll' };
  if (cls === 'overflow-y-auto') return { overflow: 'scroll' };
  if (cls === 'overflow-x-hidden') return { overflow: 'hidden' };
  if (cls === 'overflow-y-hidden') return { overflow: 'hidden' };
  if (cls === 'overflow-x-scroll') return { overflow: 'scroll' };
  if (cls === 'overflow-y-scroll') return { overflow: 'scroll' };

  // ── Align / Justify / Self ──

  if (cls === 'items-start') return { alignItems: 'start' };
  if (cls === 'items-center') return { alignItems: 'center' };
  if (cls === 'items-end') return { alignItems: 'end' };
  if (cls === 'items-stretch') return { alignItems: 'stretch' };
  if (cls === 'justify-start') return { justifyContent: 'start' };
  if (cls === 'justify-center') return { justifyContent: 'center' };
  if (cls === 'justify-end') return { justifyContent: 'end' };
  if (cls === 'justify-between') return { justifyContent: 'space-between' };
  if (cls === 'justify-around') return { justifyContent: 'space-around' };
  if (cls === 'justify-evenly') return { justifyContent: 'space-evenly' };
  if (cls === 'self-auto') return { alignSelf: 'auto' };
  if (cls === 'self-start') return { alignSelf: 'start' };
  if (cls === 'self-center') return { alignSelf: 'center' };
  if (cls === 'self-end') return { alignSelf: 'end' };
  if (cls === 'self-stretch') return { alignSelf: 'stretch' };

  // ── Text alignment ──

  if (cls === 'text-left') return { textAlign: 'left' };
  if (cls === 'text-center') return { textAlign: 'center' };
  if (cls === 'text-right') return { textAlign: 'right' };

  // ── Transition keywords ──

  if (cls === 'transition' || cls === 'transition-all') { trans.active = true; return undefined; }
  if (cls === 'transition-colors') { trans.active = true; return undefined; }
  if (cls === 'transition-opacity') { trans.active = true; return undefined; }
  if (cls === 'transition-transform') { trans.active = true; return undefined; }
  if (cls === 'transition-none') { trans.active = false; return undefined; }

  // ── Border (bare keyword) ──

  if (cls === 'border') return { borderWidth: 1 };
  if (cls === 'border-0') return { borderWidth: 0 };
  if (cls === 'border-t') return { borderTopWidth: 1 };
  if (cls === 'border-r') return { borderRightWidth: 1 };
  if (cls === 'border-b') return { borderBottomWidth: 1 };
  if (cls === 'border-l') return { borderLeftWidth: 1 };

  // ── Rounded (bare keyword) ──

  if (cls === 'rounded') return { borderRadius: RADIUS['DEFAULT'] };
  if (cls === 'rounded-none') return { borderRadius: 0 };
  if (cls === 'rounded-full') return { borderRadius: 9999 };

  // ── Shadow (bare keyword) ──

  if (cls === 'shadow') return { ...SHADOW['DEFAULT'] };

  // ── Transform origin ──

  if (cls === 'origin-center') return { transform: { originX: 0.5, originY: 0.5 } };
  if (cls === 'origin-top') return { transform: { originX: 0.5, originY: 0 } };
  if (cls === 'origin-bottom') return { transform: { originX: 0.5, originY: 1 } };
  if (cls === 'origin-left') return { transform: { originX: 0, originY: 0.5 } };
  if (cls === 'origin-right') return { transform: { originX: 1, originY: 0.5 } };
  if (cls === 'origin-top-left') return { transform: { originX: 0, originY: 0 } };
  if (cls === 'origin-top-right') return { transform: { originX: 1, originY: 0 } };
  if (cls === 'origin-bottom-left') return { transform: { originX: 0, originY: 1 } };
  if (cls === 'origin-bottom-right') return { transform: { originX: 1, originY: 1 } };

  // ── Prefix-based parsing ──

  // Negative value handling
  let negative = false;
  let token = cls;
  if (token.startsWith('-') && token.length > 1 && token[1] !== '-') {
    negative = true;
    token = token.slice(1);
  }
  const neg = (n: number | undefined) => n !== undefined ? (negative ? -n : n) : undefined;

  // ── Padding ──

  if (token.startsWith('p-'))  { const v = spacing(token.slice(2));  return v !== undefined ? { padding: v } : undefined; }
  if (token.startsWith('px-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingLeft: v, paddingRight: v } : undefined; }
  if (token.startsWith('py-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingTop: v, paddingBottom: v } : undefined; }
  if (token.startsWith('pt-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingTop: v } : undefined; }
  if (token.startsWith('pr-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingRight: v } : undefined; }
  if (token.startsWith('pb-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingBottom: v } : undefined; }
  if (token.startsWith('pl-')) { const v = spacing(token.slice(3));  return v !== undefined ? { paddingLeft: v } : undefined; }

  // ── Margin ──

  if (token.startsWith('m-'))  { const val = token.slice(2); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { margin: v } : undefined; }
  if (token.startsWith('mx-')) { const val = token.slice(3); if (val === 'auto') return { alignSelf: 'center' }; const v = neg(spacing(val)); return v !== undefined ? { marginLeft: v, marginRight: v } : undefined; }
  if (token.startsWith('my-')) { const val = token.slice(3); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { marginTop: v, marginBottom: v } : undefined; }
  if (token.startsWith('mt-')) { const val = token.slice(3); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { marginTop: v } : undefined; }
  if (token.startsWith('mr-')) { const val = token.slice(3); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { marginRight: v } : undefined; }
  if (token.startsWith('mb-')) { const val = token.slice(3); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { marginBottom: v } : undefined; }
  if (token.startsWith('ml-')) { const val = token.slice(3); if (val === 'auto') return {}; const v = neg(spacing(val)); return v !== undefined ? { marginLeft: v } : undefined; }

  // ── Gap ──

  if (token.startsWith('gap-')) { const v = spacing(token.slice(4)); return v !== undefined ? { gap: v } : undefined; }
  if (token.startsWith('gap-x-')) { const v = spacing(token.slice(6)); return v !== undefined ? { gap: v } : undefined; }
  if (token.startsWith('gap-y-')) { const v = spacing(token.slice(6)); return v !== undefined ? { gap: v } : undefined; }

  // ── Space between (approximate as gap) ──

  if (token.startsWith('space-y-')) { const v = spacing(token.slice(8)); return v !== undefined ? { gap: v } : undefined; }
  if (token.startsWith('space-x-')) { const v = spacing(token.slice(8)); return v !== undefined ? { gap: v } : undefined; }

  // ── Width ──

  if (token.startsWith('w-')) { const v = widthValue(token.slice(2)); return v !== undefined ? { width: v } : undefined; }
  if (token.startsWith('h-')) { const v = widthValue(token.slice(2)); return v !== undefined ? { height: v } : undefined; }
  if (token.startsWith('size-')) {
    const v = widthValue(token.slice(5));
    return v !== undefined ? { width: v, height: v } : undefined;
  }
  if (token.startsWith('min-w-')) { const v = widthValue(token.slice(6)); return v !== undefined ? { minWidth: v } : undefined; }
  if (token.startsWith('min-h-')) { const v = widthValue(token.slice(6)); return v !== undefined ? { minHeight: v } : undefined; }
  if (token.startsWith('max-w-')) {
    const val = token.slice(6);
    const named = MAX_WIDTH[val];
    if (named !== undefined) return { maxWidth: named };
    const v = widthValue(val);
    return v !== undefined ? { maxWidth: v } : undefined;
  }
  if (token.startsWith('max-h-')) { const v = widthValue(token.slice(6)); return v !== undefined ? { maxHeight: v } : undefined; }

  // ── Flex basis ──

  if (token.startsWith('basis-')) {
    const val = token.slice(6);
    if (val === 'auto') return { flexBasis: 'auto' };
    const v = widthValue(val);
    return v !== undefined ? { flexBasis: v } : undefined;
  }

  // ── Grid (approximate as flex-row + wrap) ──

  if (token.startsWith('grid-cols-')) {
    const val = token.slice(10);
    const n = parseInt(val, 10);
    if (!isNaN(n)) return { flexDirection: 'row', flexWrap: 'wrap' };
    return {};
  }
  if (token.startsWith('col-span-')) return {};
  if (token.startsWith('row-span-')) return {};

  // ── bg-opacity (approximate) ──

  if (token.startsWith('bg-opacity-')) {
    const val = token.slice(11);
    const n = parseInt(val, 10);
    return !isNaN(n) ? { opacity: n / 100 } : undefined;
  }

  // ── Placeholder (no-op, TextInput handles separately) ──

  if (token.startsWith('placeholder-')) return {};

  // ── Animate (no-op for now) ──

  if (token.startsWith('animate-')) return {};

  // ── Line clamp (no-op) ──

  if (token.startsWith('line-clamp-')) return {};

  // ── Z-index ──

  if (token.startsWith('z-')) {
    const val = token.slice(2);
    if (val === 'auto') return { zIndex: 0 };
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseInt(val.slice(1, -1), 10);
      return isNaN(n) ? undefined : { zIndex: n };
    }
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : { zIndex: n };
  }

  // ── Opacity ──

  if (token.startsWith('opacity-')) {
    const val = token.slice(8);
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseFloat(val.slice(1, -1));
      return isNaN(n) ? undefined : { opacity: n };
    }
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : { opacity: n / 100 };
  }

  // ── Aspect ratio ──

  if (token.startsWith('aspect-')) {
    const val = token.slice(7);
    if (val === 'square') return { aspectRatio: 1 };
    if (val === 'video') return { aspectRatio: 16 / 9 };
    if (val === 'auto') return {};
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1);
      const parts = inner.split('/');
      if (parts.length === 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        return (!isNaN(a) && !isNaN(b) && b !== 0) ? { aspectRatio: a / b } : undefined;
      }
      const n = parseFloat(inner);
      return isNaN(n) ? undefined : { aspectRatio: n };
    }
    return undefined;
  }

  // ── Inset / Positioning ──

  if (token.startsWith('inset-')) {
    const v = neg(spacing(token.slice(6)));
    return v !== undefined ? { top: v, right: v, bottom: v, left: v } : undefined;
  }
  if (token.startsWith('inset-x-')) {
    const v = neg(spacing(token.slice(8)));
    return v !== undefined ? { left: v, right: v } : undefined;
  }
  if (token.startsWith('inset-y-')) {
    const v = neg(spacing(token.slice(8)));
    return v !== undefined ? { top: v, bottom: v } : undefined;
  }
  if (token.startsWith('top-')) { const v = neg(spacing(token.slice(4))); return v !== undefined ? { top: v } : undefined; }
  if (token.startsWith('right-')) { const v = neg(spacing(token.slice(6))); return v !== undefined ? { right: v } : undefined; }
  if (token.startsWith('bottom-')) { const v = neg(spacing(token.slice(7))); return v !== undefined ? { bottom: v } : undefined; }
  if (token.startsWith('left-')) { const v = neg(spacing(token.slice(5))); return v !== undefined ? { left: v } : undefined; }

  // ── Rounded (prefixed) ──

  if (token.startsWith('rounded-')) {
    const rest = token.slice(8);
    // Per-corner: rounded-tl-lg, rounded-t-md
    if (rest.startsWith('tl-')) { const v = radiusValue(rest.slice(3)); return v !== undefined ? { borderTopLeftRadius: v } : undefined; }
    if (rest.startsWith('tr-')) { const v = radiusValue(rest.slice(3)); return v !== undefined ? { borderTopRightRadius: v } : undefined; }
    if (rest.startsWith('bl-')) { const v = radiusValue(rest.slice(3)); return v !== undefined ? { borderBottomLeftRadius: v } : undefined; }
    if (rest.startsWith('br-')) { const v = radiusValue(rest.slice(3)); return v !== undefined ? { borderBottomRightRadius: v } : undefined; }
    if (rest.startsWith('t-')) { const v = radiusValue(rest.slice(2)); return v !== undefined ? { borderTopLeftRadius: v, borderTopRightRadius: v } : undefined; }
    if (rest.startsWith('b-')) { const v = radiusValue(rest.slice(2)); return v !== undefined ? { borderBottomLeftRadius: v, borderBottomRightRadius: v } : undefined; }
    if (rest.startsWith('l-')) { const v = radiusValue(rest.slice(2)); return v !== undefined ? { borderTopLeftRadius: v, borderBottomLeftRadius: v } : undefined; }
    if (rest.startsWith('r-')) { const v = radiusValue(rest.slice(2)); return v !== undefined ? { borderTopRightRadius: v, borderBottomRightRadius: v } : undefined; }
    // General: rounded-lg, rounded-[12]
    const v = radiusValue(rest);
    return v !== undefined ? { borderRadius: v } : undefined;
  }

  // ── Border (prefixed) ──

  if (token.startsWith('border-')) {
    const rest = token.slice(7);
    // Per-side width: border-t-2, border-r-4
    if (rest.startsWith('t-')) { const n = parseInt(rest.slice(2), 10); return !isNaN(n) ? { borderTopWidth: n } : undefined; }
    if (rest.startsWith('r-')) { const n = parseInt(rest.slice(2), 10); return !isNaN(n) ? { borderRightWidth: n } : undefined; }
    if (rest.startsWith('b-')) { const n = parseInt(rest.slice(2), 10); return !isNaN(n) ? { borderBottomWidth: n } : undefined; }
    if (rest.startsWith('l-')) { const n = parseInt(rest.slice(2), 10); return !isNaN(n) ? { borderLeftWidth: n } : undefined; }
    // Width: border-2, border-4, border-8
    const width = parseInt(rest, 10);
    if (!isNaN(width)) return { borderWidth: width };
    // Color: border-red-500, border-[#ff0000]
    const c = resolveColor(rest);
    if (c) return { borderColor: c };
    return undefined;
  }

  // ── Shadow (prefixed) ──

  if (token.startsWith('shadow-')) {
    const rest = token.slice(7);
    // Named preset
    const preset = SHADOW[rest];
    if (preset) return { ...preset };
    // Shadow color: shadow-red-500
    const c = resolveColor(rest);
    if (c) return { shadowColor: c };
    return undefined;
  }

  // ── Background ──

  if (token.startsWith('bg-')) {
    const rest = token.slice(3);
    // Gradient direction
    if (rest === 'gradient-to-r') { grad.direction = 'horizontal'; return undefined; }
    if (rest === 'gradient-to-l') { grad.direction = 'horizontal'; return undefined; }
    if (rest === 'gradient-to-b') { grad.direction = 'vertical'; return undefined; }
    if (rest === 'gradient-to-t') { grad.direction = 'vertical'; return undefined; }
    if (rest === 'gradient-to-br' || rest === 'gradient-to-tl') { grad.direction = 'diagonal'; return undefined; }
    if (rest === 'gradient-to-bl' || rest === 'gradient-to-tr') { grad.direction = 'diagonal'; return undefined; }
    // Solid color
    const c = resolveColor(rest);
    if (c) return { backgroundColor: c };
    return undefined;
  }

  // ── Gradient stops ──

  if (token.startsWith('from-')) {
    const c = resolveColor(token.slice(5));
    if (c) { grad.from = c; return undefined; }
    return undefined;
  }
  if (token.startsWith('to-')) {
    const c = resolveColor(token.slice(3));
    if (c) { grad.to = c; return undefined; }
    return undefined;
  }

  // ── Text (color / size / font-weight) ──

  if (token.startsWith('text-')) {
    const rest = token.slice(5);
    // Font size
    const fs = FONT_SIZE[rest];
    if (fs !== undefined) return { fontSize: fs };
    // Arbitrary font size
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const n = parseFloat(rest.slice(1, -1));
      return !isNaN(n) ? { fontSize: n } : undefined;
    }
    // Color
    const c = resolveColor(rest);
    if (c) return { color: c };
    return undefined;
  }

  // ── Font weight ──

  if (token.startsWith('font-')) {
    const rest = token.slice(5);
    const fw = FONT_WEIGHT[rest];
    if (fw !== undefined) return { fontWeight: fw };
    return undefined;
  }

  // ── Leading (lineHeight) ──

  if (token.startsWith('leading-')) {
    const val = token.slice(8);
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseFloat(val.slice(1, -1));
      return !isNaN(n) ? { lineHeight: n } : undefined;
    }
    const v = LEADING[val];
    return v !== undefined ? { lineHeight: v } : undefined;
  }

  // ── Tracking (letterSpacing) ──

  if (token.startsWith('tracking-')) {
    const val = token.slice(9);
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseFloat(val.slice(1, -1));
      return !isNaN(n) ? { letterSpacing: n } : undefined;
    }
    const v = TRACKING[val];
    return v !== undefined ? { letterSpacing: v } : undefined;
  }

  // ── Duration ──

  if (token.startsWith('duration-')) {
    const val = token.slice(9);
    const n = parseInt(val, 10);
    if (!isNaN(n)) { trans.duration = n; trans.active = trans.active ?? true; }
    return undefined;
  }

  // ── Easing ──

  if (token.startsWith('ease-')) {
    const val = token.slice(5);
    const map: Record<string, string> = {
      'linear': 'linear', 'in': 'easeIn', 'out': 'easeOut', 'in-out': 'easeInOut',
    };
    if (map[val]) { trans.easing = map[val]; trans.active = trans.active ?? true; }
    return undefined;
  }

  // ── Delay ──

  if (token.startsWith('delay-')) {
    const val = token.slice(6);
    const n = parseInt(val, 10);
    if (!isNaN(n)) { trans.delay = n; trans.active = trans.active ?? true; }
    return undefined;
  }

  // ── Transforms ──

  if (token.startsWith('translate-x-')) {
    const v = neg(spacing(token.slice(12)));
    return v !== undefined ? { transform: { translateX: v } } : undefined;
  }
  if (token.startsWith('translate-y-')) {
    const v = neg(spacing(token.slice(12)));
    return v !== undefined ? { transform: { translateY: v } } : undefined;
  }
  if (token.startsWith('rotate-')) {
    const val = token.slice(7);
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseFloat(val.slice(1, -1));
      return !isNaN(n) ? { transform: { rotate: negative ? -n : n } } : undefined;
    }
    const n = parseFloat(val);
    return !isNaN(n) ? { transform: { rotate: negative ? -n : n } } : undefined;
  }
  if (token.startsWith('scale-')) {
    const val = token.slice(6);
    // scale-x-* and scale-y-*
    if (val.startsWith('x-')) {
      const n = parseFloat(val.slice(2));
      return !isNaN(n) ? { transform: { scaleX: n / 100 } } : undefined;
    }
    if (val.startsWith('y-')) {
      const n = parseFloat(val.slice(2));
      return !isNaN(n) ? { transform: { scaleY: n / 100 } } : undefined;
    }
    if (val.startsWith('[') && val.endsWith(']')) {
      const n = parseFloat(val.slice(1, -1));
      return !isNaN(n) ? { transform: { scaleX: n, scaleY: n } } : undefined;
    }
    const n = parseFloat(val);
    return !isNaN(n) ? { transform: { scaleX: n / 100, scaleY: n / 100 } } : undefined;
  }

  // ── Outline (ring approximation) ──

  if (token.startsWith('ring-')) {
    const rest = token.slice(5);
    const n = parseInt(rest, 10);
    if (!isNaN(n)) return { outlineWidth: n, outlineColor: '#3b82f6', outlineOffset: 2 };
    const c = resolveColor(rest);
    if (c) return { outlineColor: c };
    return undefined;
  }
  if (cls === 'ring') return { outlineWidth: 3, outlineColor: '#3b82f6', outlineOffset: 2 };
  if (cls === 'ring-0') return { outlineWidth: 0 };

  return undefined; // Unknown class — silently ignored
}

// ── Merge helper for transform objects ───────────────────────────────

function mergeTransform(
  existing: Style['transform'],
  incoming: Style['transform'],
): Style['transform'] {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return { ...existing, ...incoming };
}

// ── Cache ────────────────────────────────────────────────────────────

const cache = new Map<string, Style>();
const CACHE_MAX = 1000;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Parse Tailwind utility classes into a ReactJIT Style object.
 *
 * @example
 * tw("p-4 flex-row gap-2 bg-blue-500 rounded-lg")
 * // → { padding: 16, flexDirection: 'row', gap: 8, backgroundColor: '#3b82f6', borderRadius: 8 }
 */
export function tw(classes: string): Style {
  if (!classes) return {};

  const cached = cache.get(classes);
  if (cached) return cached;

  const tokens = classes.trim().split(/\s+/);
  const result: Style = {};
  const grad: GradientState = {};
  const trans: TransitionState = {};

  for (const token of tokens) {
    const partial = parseClass(token, grad, trans);
    if (partial) {
      // Special handling: merge transform objects instead of replacing
      if (partial.transform) {
        result.transform = mergeTransform(result.transform, partial.transform);
        // Copy non-transform properties
        for (const key of Object.keys(partial) as (keyof Style)[]) {
          if (key !== 'transform') (result as any)[key] = (partial as any)[key];
        }
      } else {
        Object.assign(result, partial);
      }
    }
  }

  // Emit accumulated gradient
  if (grad.direction && (grad.from || grad.to)) {
    result.backgroundGradient = {
      direction: grad.direction,
      colors: [
        (grad.from ?? 'transparent') as Color,
        (grad.to ?? 'transparent') as Color,
      ],
    };
  }

  // Emit accumulated transition
  if (trans.active) {
    result.transition = {
      all: {
        duration: trans.duration ?? 150,
        easing: trans.easing ?? 'easeInOut',
        ...(trans.delay !== undefined && { delay: trans.delay }),
      },
    };
  }

  // Cache with eviction
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(classes, result);

  return result;
}
