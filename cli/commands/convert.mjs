/**
 * convert.mjs — HTML / React div-soup → ReactJIT converter
 *
 * Takes HTML or React JSX with divs, spans, Tailwind classes, inline styles,
 * and DOM event handlers, and outputs clean ReactJIT JSX using Box, Text,
 * Image, and ScrollView primitives.
 *
 * Usage:
 *   rjit convert <file.html|file.tsx|file.jsx>       # converts file, prints to stdout
 *   rjit convert <file> --output out.tsx              # writes to file
 *   rjit convert --stdin                              # reads from stdin
 *   echo '<div class="flex p-4">...' | rjit convert   # pipe mode
 *
 * What it handles:
 *   - HTML elements → ReactJIT primitives (div→Box, span/p/h1→Text, img→Image, etc.)
 *   - Tailwind utility classes → style props + shorthand props
 *   - Inline CSS styles → ReactJIT style objects
 *   - className strings → resolved styles (Tailwind subset)
 *   - React event handlers → ReactJIT event handlers (onClick stays, onMouseEnter→onPointerEnter, etc.)
 *   - Text content normalization (mixed children → template literals)
 *   - Removes unsupported HTML attributes (class, id, href on non-Link, etc.)
 *   - Adds required imports at the top
 */

import { readFileSync } from 'node:fs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ELEMENT_MAP = {
  // Containers → Box
  div: 'Box', section: 'Box', article: 'Box', main: 'Box', aside: 'Box',
  header: 'Box', footer: 'Box', nav: 'Box', form: 'Box', fieldset: 'Box',
  figure: 'Box', figcaption: 'Box', details: 'Box', summary: 'Box',
  dialog: 'Box', li: 'Box', ul: 'Box', ol: 'Box', dl: 'Box',
  dd: 'Box', dt: 'Box', table: 'Box', thead: 'Box', tbody: 'Box',
  tr: 'Box', td: 'Box', th: 'Box',

  // Text → Text
  span: 'Text', p: 'Text', label: 'Text',
  h1: 'Text', h2: 'Text', h3: 'Text', h4: 'Text', h5: 'Text', h6: 'Text',
  strong: 'Text', em: 'Text', b: 'Text', i: 'Text', u: 'Text',
  small: 'Text', code: 'Text', pre: 'Text', blockquote: 'Text',
  a: 'Text', time: 'Text', abbr: 'Text', cite: 'Text', mark: 'Text',
  sub: 'Text', sup: 'Text', del: 'Text', ins: 'Text', kbd: 'Text',
  samp: 'Text', var: 'Text',

  // Interactive → Pressable or Box with onClick
  button: 'Pressable',

  // Media → Image
  img: 'Image',
  svg: 'Box', // SVGs become empty boxes (user will need to replace with Image)
  video: 'Box', // placeholder — Video capability exists but different API
  audio: 'Box', // placeholder — Audio capability

  // Input → TextInput
  input: 'TextInput',
  textarea: 'TextInput',
  select: 'Box', // no direct equivalent, needs manual conversion

  // Scroll containers
  // detected by overflow classes, not by element type
};

// Heading → Text with fontSize
const HEADING_SIZES = {
  h1: 32, h2: 28, h3: 24, h4: 20, h5: 18, h6: 16,
};

// Elements that imply bold
const BOLD_ELEMENTS = new Set(['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th']);

// Elements that imply italic
const ITALIC_ELEMENTS = new Set(['em', 'i', 'cite', 'var']);

// Elements that imply underline
const UNDERLINE_ELEMENTS = new Set(['u', 'ins']);

// Elements that imply strikethrough
const STRIKETHROUGH_ELEMENTS = new Set(['del', 's', 'strike']);

// Elements that imply monospace
const MONO_ELEMENTS = new Set(['code', 'pre', 'kbd', 'samp']);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT HANDLER MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EVENT_MAP = {
  onClick: 'onClick',
  onDoubleClick: 'onClick', // no dblclick, map to click
  onMouseDown: 'onClick',
  onMouseUp: 'onRelease',
  onMouseEnter: 'onPointerEnter',
  onMouseLeave: 'onPointerLeave',
  onMouseOver: 'onPointerEnter',
  onMouseOut: 'onPointerLeave',
  onPointerDown: 'onClick',
  onPointerUp: 'onRelease',
  onPointerEnter: 'onPointerEnter',
  onPointerLeave: 'onPointerLeave',
  onKeyDown: 'onKeyDown',
  onKeyUp: 'onKeyUp',
  onKeyPress: 'onKeyDown', // deprecated in DOM, map to keydown
  onScroll: 'onWheel',
  onWheel: 'onWheel',
  onTouchStart: 'onTouchStart',
  onTouchEnd: 'onTouchEnd',
  onTouchMove: 'onTouchMove',
  onFocus: 'onFocus',
  onBlur: 'onBlur',
  onInput: 'onTextInput',
  onChange: 'onTextInput', // for text inputs
  onSubmit: null, // forms don't exist — drop or warn
  onDragStart: 'onDragStart',
  onDrag: 'onDrag',
  onDragEnd: 'onDragEnd',
  onDrop: 'onFileDrop',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSS PROPERTY MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Map a CSS property name to ReactJIT style property */
const CSS_PROP_MAP = {
  // Direct mappings
  'width': 'width',
  'height': 'height',
  'min-width': 'minWidth',
  'min-height': 'minHeight',
  'max-width': 'maxWidth',
  'max-height': 'maxHeight',
  'padding': 'padding',
  'padding-left': 'paddingLeft',
  'padding-right': 'paddingRight',
  'padding-top': 'paddingTop',
  'padding-bottom': 'paddingBottom',
  'margin': 'margin',
  'margin-left': 'marginLeft',
  'margin-right': 'marginRight',
  'margin-top': 'marginTop',
  'margin-bottom': 'marginBottom',
  'gap': 'gap',
  'row-gap': 'gap', // simplify — ReactJIT uses uniform gap
  'column-gap': 'gap',
  'flex-direction': 'flexDirection',
  'flex-wrap': 'flexWrap',
  'justify-content': 'justifyContent',
  'align-items': 'alignItems',
  'align-self': 'alignSelf',
  'flex-grow': 'flexGrow',
  'flex-shrink': 'flexShrink',
  'flex-basis': 'flexBasis',
  'flex': null, // handled specially
  'background-color': 'backgroundColor',
  'background': 'backgroundColor', // simplified — gradients need manual conversion
  'color': 'color',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-family': 'fontFamily',
  'font-style': null, // handled via italic detection
  'text-align': 'textAlign',
  'line-height': 'lineHeight',
  'letter-spacing': 'letterSpacing',
  'text-decoration': 'textDecorationLine',
  'text-decoration-line': 'textDecorationLine',
  'text-overflow': 'textOverflow',
  'border-radius': 'borderRadius',
  'border-top-left-radius': 'borderTopLeftRadius',
  'border-top-right-radius': 'borderTopRightRadius',
  'border-bottom-left-radius': 'borderBottomLeftRadius',
  'border-bottom-right-radius': 'borderBottomRightRadius',
  'border-width': 'borderWidth',
  'border-top-width': 'borderTopWidth',
  'border-right-width': 'borderRightWidth',
  'border-bottom-width': 'borderBottomWidth',
  'border-left-width': 'borderLeftWidth',
  'border-color': 'borderColor',
  'border-top-color': 'borderTopColor',
  'border-right-color': 'borderRightColor',
  'border-bottom-color': 'borderBottomColor',
  'border-left-color': 'borderLeftColor',
  'opacity': 'opacity',
  'overflow': 'overflow',
  'overflow-x': 'overflow',
  'overflow-y': 'overflow',
  'visibility': 'visibility',
  'z-index': 'zIndex',
  'position': 'position',
  'top': 'top',
  'right': 'right',
  'bottom': 'bottom',
  'left': 'left',
  'object-fit': 'objectFit',
  'display': 'display',
  'aspect-ratio': 'aspectRatio',
  'user-select': 'userSelect',
  // box-shadow handled specially
  // transform handled specially
  // transition handled specially
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAILWIND → STYLE MAPPING (the hard part)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Tailwind spacing scale (in pixels) — 1 unit = 4px
const TW_SPACING = {
  '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10,
  '3': 12, '3.5': 14, '4': 16, '5': 20, '6': 24, '7': 28,
  '8': 32, '9': 36, '10': 40, '11': 44, '12': 48, '14': 56,
  '16': 64, '20': 80, '24': 96, '28': 112, '32': 128, '36': 144,
  '40': 160, '44': 176, '48': 192, '52': 208, '56': 224, '60': 240,
  '64': 256, '72': 288, '80': 320, '96': 384,
  'px': 1,
};

// Tailwind font sizes → pixels
const TW_FONT_SIZE = {
  'xs': 12, 'sm': 14, 'base': 16, 'lg': 18, 'xl': 20,
  '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60,
  '7xl': 72, '8xl': 96, '9xl': 128,
};

// Tailwind font weights
const TW_FONT_WEIGHT = {
  'thin': 100, 'extralight': 200, 'light': 300, 'normal': 400,
  'medium': 500, 'semibold': 600, 'bold': 700, 'extrabold': 800, 'black': 900,
};

// Tailwind border radius → pixels
const TW_RADIUS = {
  'none': 0, 'sm': 2, '': 4, 'md': 6, 'lg': 8, 'xl': 12,
  '2xl': 16, '3xl': 24, 'full': 9999,
};

// Tailwind opacity scale
const TW_OPACITY = {
  '0': 0, '5': 0.05, '10': 0.1, '15': 0.15, '20': 0.2, '25': 0.25,
  '30': 0.3, '35': 0.35, '40': 0.4, '45': 0.45, '50': 0.5,
  '55': 0.55, '60': 0.6, '65': 0.65, '70': 0.7, '75': 0.75,
  '80': 0.8, '85': 0.85, '90': 0.9, '95': 0.95, '100': 1,
};

// Tailwind color palette → hex
const TW_COLORS = {
  'transparent': 'transparent',
  'current': 'currentColor',
  'black': '#000000',
  'white': '#ffffff',

  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0',
  'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-500': '#64748b',
  'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
  'slate-900': '#0f172a', 'slate-950': '#020617',

  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db', 'gray-400': '#9ca3af', 'gray-500': '#6b7280',
  'gray-600': '#4b5563', 'gray-700': '#374151', 'gray-800': '#1f2937',
  'gray-900': '#111827', 'gray-950': '#030712',

  'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7',
  'zinc-300': '#d4d4d8', 'zinc-400': '#a1a1aa', 'zinc-500': '#71717a',
  'zinc-600': '#52525b', 'zinc-700': '#3f3f46', 'zinc-800': '#27272a',
  'zinc-900': '#18181b', 'zinc-950': '#09090b',

  'neutral-50': '#fafafa', 'neutral-100': '#f5f5f5', 'neutral-200': '#e5e5e5',
  'neutral-300': '#d4d4d4', 'neutral-400': '#a3a3a3', 'neutral-500': '#737373',
  'neutral-600': '#525252', 'neutral-700': '#404040', 'neutral-800': '#262626',
  'neutral-900': '#171717', 'neutral-950': '#0a0a0a',

  'stone-50': '#fafaf9', 'stone-100': '#f5f5f4', 'stone-200': '#e7e5e4',
  'stone-300': '#d6d3d1', 'stone-400': '#a8a29e', 'stone-500': '#78716c',
  'stone-600': '#57534e', 'stone-700': '#44403c', 'stone-800': '#292524',
  'stone-900': '#1c1917', 'stone-950': '#0c0a09',

  'red-50': '#fef2f2', 'red-100': '#fee2e2', 'red-200': '#fecaca',
  'red-300': '#fca5a5', 'red-400': '#f87171', 'red-500': '#ef4444',
  'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b',
  'red-900': '#7f1d1d', 'red-950': '#450a0a',

  'orange-50': '#fff7ed', 'orange-100': '#ffedd5', 'orange-200': '#fed7aa',
  'orange-300': '#fdba74', 'orange-400': '#fb923c', 'orange-500': '#f97316',
  'orange-600': '#ea580c', 'orange-700': '#c2410c', 'orange-800': '#9a3412',
  'orange-900': '#7c2d12', 'orange-950': '#431407',

  'amber-50': '#fffbeb', 'amber-100': '#fef3c7', 'amber-200': '#fde68a',
  'amber-300': '#fcd34d', 'amber-400': '#fbbf24', 'amber-500': '#f59e0b',
  'amber-600': '#d97706', 'amber-700': '#b45309', 'amber-800': '#92400e',
  'amber-900': '#78350f', 'amber-950': '#451a03',

  'yellow-50': '#fefce8', 'yellow-100': '#fef9c3', 'yellow-200': '#fef08a',
  'yellow-300': '#fde047', 'yellow-400': '#facc15', 'yellow-500': '#eab308',
  'yellow-600': '#ca8a04', 'yellow-700': '#a16207', 'yellow-800': '#854d0e',
  'yellow-900': '#713f12', 'yellow-950': '#422006',

  'lime-50': '#f7fee7', 'lime-100': '#ecfccb', 'lime-200': '#d9f99d',
  'lime-300': '#bef264', 'lime-400': '#a3e635', 'lime-500': '#84cc16',
  'lime-600': '#65a30d', 'lime-700': '#4d7c0f', 'lime-800': '#3f6212',
  'lime-900': '#365314', 'lime-950': '#1a2e05',

  'green-50': '#f0fdf4', 'green-100': '#dcfce7', 'green-200': '#bbf7d0',
  'green-300': '#86efac', 'green-400': '#4ade80', 'green-500': '#22c55e',
  'green-600': '#16a34a', 'green-700': '#15803d', 'green-800': '#166534',
  'green-900': '#14532d', 'green-950': '#052e16',

  'emerald-50': '#ecfdf5', 'emerald-100': '#d1fae5', 'emerald-200': '#a7f3d0',
  'emerald-300': '#6ee7b7', 'emerald-400': '#34d399', 'emerald-500': '#10b981',
  'emerald-600': '#059669', 'emerald-700': '#047857', 'emerald-800': '#065f46',
  'emerald-900': '#064e3b', 'emerald-950': '#022c22',

  'teal-50': '#f0fdfa', 'teal-100': '#ccfbf1', 'teal-200': '#99f6e4',
  'teal-300': '#5eead4', 'teal-400': '#2dd4bf', 'teal-500': '#14b8a6',
  'teal-600': '#0d9488', 'teal-700': '#0f766e', 'teal-800': '#115e59',
  'teal-900': '#134e4a', 'teal-950': '#042f2e',

  'cyan-50': '#ecfeff', 'cyan-100': '#cffafe', 'cyan-200': '#a5f3fc',
  'cyan-300': '#67e8f9', 'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2', 'cyan-700': '#0e7490', 'cyan-800': '#155e75',
  'cyan-900': '#164e63', 'cyan-950': '#083344',

  'sky-50': '#f0f9ff', 'sky-100': '#e0f2fe', 'sky-200': '#bae6fd',
  'sky-300': '#7dd3fc', 'sky-400': '#38bdf8', 'sky-500': '#0ea5e9',
  'sky-600': '#0284c7', 'sky-700': '#0369a1', 'sky-800': '#075985',
  'sky-900': '#0c4a6e', 'sky-950': '#082f49',

  'blue-50': '#eff6ff', 'blue-100': '#dbeafe', 'blue-200': '#bfdbfe',
  'blue-300': '#93c5fd', 'blue-400': '#60a5fa', 'blue-500': '#3b82f6',
  'blue-600': '#2563eb', 'blue-700': '#1d4ed8', 'blue-800': '#1e40af',
  'blue-900': '#1e3a8a', 'blue-950': '#172554',

  'indigo-50': '#eef2ff', 'indigo-100': '#e0e7ff', 'indigo-200': '#c7d2fe',
  'indigo-300': '#a5b4fc', 'indigo-400': '#818cf8', 'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5', 'indigo-700': '#4338ca', 'indigo-800': '#3730a3',
  'indigo-900': '#312e81', 'indigo-950': '#1e1b4b',

  'violet-50': '#f5f3ff', 'violet-100': '#ede9fe', 'violet-200': '#ddd6fe',
  'violet-300': '#c4b5fd', 'violet-400': '#a78bfa', 'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed', 'violet-700': '#6d28d9', 'violet-800': '#5b21b6',
  'violet-900': '#4c1d95', 'violet-950': '#2e1065',

  'purple-50': '#faf5ff', 'purple-100': '#f3e8ff', 'purple-200': '#e9d5ff',
  'purple-300': '#d8b4fe', 'purple-400': '#c084fc', 'purple-500': '#a855f7',
  'purple-600': '#9333ea', 'purple-700': '#7e22ce', 'purple-800': '#6b21a8',
  'purple-900': '#581c87', 'purple-950': '#3b0764',

  'fuchsia-50': '#fdf4ff', 'fuchsia-100': '#fae8ff', 'fuchsia-200': '#f5d0fe',
  'fuchsia-300': '#f0abfc', 'fuchsia-400': '#e879f9', 'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3', 'fuchsia-700': '#a21caf', 'fuchsia-800': '#86198f',
  'fuchsia-900': '#701a75', 'fuchsia-950': '#4a044e',

  'pink-50': '#fdf2f8', 'pink-100': '#fce7f3', 'pink-200': '#fbcfe8',
  'pink-300': '#f9a8d4', 'pink-400': '#f472b6', 'pink-500': '#ec4899',
  'pink-600': '#db2777', 'pink-700': '#be185d', 'pink-800': '#9d174d',
  'pink-900': '#831843', 'pink-950': '#500724',

  'rose-50': '#fff1f2', 'rose-100': '#ffe4e6', 'rose-200': '#fecdd3',
  'rose-300': '#fda4af', 'rose-400': '#fb7185', 'rose-500': '#f43f5e',
  'rose-600': '#e11d48', 'rose-700': '#be123c', 'rose-800': '#9f1239',
  'rose-900': '#881337', 'rose-950': '#4c0519',
};

// Tailwind width/height fractional values
const TW_FRACTIONS = {
  '1/2': '50%', '1/3': '33.333%', '2/3': '66.667%',
  '1/4': '25%', '2/4': '50%', '3/4': '75%',
  '1/5': '20%', '2/5': '40%', '3/5': '60%', '4/5': '80%',
  '1/6': '16.667%', '2/6': '33.333%', '3/6': '50%', '4/6': '66.667%', '5/6': '83.333%',
  '1/12': '8.333%', '2/12': '16.667%', '3/12': '25%', '4/12': '33.333%',
  '5/12': '41.667%', '6/12': '50%', '7/12': '58.333%', '8/12': '66.667%',
  '9/12': '75%', '10/12': '83.333%', '11/12': '91.667%',
  'full': '100%', 'screen': '100%', 'svh': '100%', 'lvh': '100%', 'dvh': '100%',
  'min': 'min-content', 'max': 'max-content', 'fit': 'fit-content',
};

// Tailwind shadow presets → ReactJIT shadow props
const TW_SHADOWS = {
  'sm':   { shadowColor: 'rgba(0,0,0,0.05)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 2 },
  '':     { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetX: 0, shadowOffsetY: 1, shadowBlur: 3 },
  'md':   { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 },
  'lg':   { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetX: 0, shadowOffsetY: 10, shadowBlur: 15 },
  'xl':   { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetX: 0, shadowOffsetY: 20, shadowBlur: 25 },
  '2xl':  { shadowColor: 'rgba(0,0,0,0.25)', shadowOffsetX: 0, shadowOffsetY: 25, shadowBlur: 50 },
  'none': { shadowColor: 'transparent', shadowOffsetX: 0, shadowOffsetY: 0, shadowBlur: 0 },
  'inner': { shadowColor: 'rgba(0,0,0,0.06)', shadowOffsetX: 0, shadowOffsetY: 2, shadowBlur: 4 },
};

// Tailwind max-width values
const TW_MAX_WIDTH = {
  'none': 'none', 'xs': 320, 'sm': 384, 'md': 448, 'lg': 512,
  'xl': 576, '2xl': 672, '3xl': 768, '4xl': 896, '5xl': 1024,
  '6xl': 1152, '7xl': 1280, 'full': '100%', 'min': 'min-content',
  'max': 'max-content', 'fit': 'fit-content', 'prose': 640,
  'screen-sm': 640, 'screen-md': 768, 'screen-lg': 1024, 'screen-xl': 1280,
  'screen-2xl': 1536,
};


/**
 * Resolve a single Tailwind utility class to style properties.
 * Returns an object with { style: {}, shorthands: {}, warnings: [] }
 */
function resolveTailwindClass(cls) {
  const style = {};
  const shorthands = {};
  const warnings = [];

  // Strip responsive/state prefixes (sm:, md:, hover:, focus:, dark:, etc.)
  // We can't do responsive in ReactJIT, so we just use the base value and warn
  let baseCls = cls;
  const prefixMatch = cls.match(/^(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|dark|group-hover|first|last|odd|even|placeholder|before|after|motion-safe|motion-reduce):)+(.+)$/);
  if (prefixMatch) {
    baseCls = prefixMatch[1];
    if (/^(sm|md|lg|xl|2xl):/.test(cls)) {
      warnings.push(`/* TODO: responsive prefix "${cls}" — ReactJIT has no breakpoints, using base value */`);
    }
    if (/^(hover|focus|active):/.test(cls)) {
      warnings.push(`/* TODO: state prefix "${cls}" — use hoverStyle/activeStyle/focusStyle props instead */`);
    }
    if (/^dark:/.test(cls)) {
      warnings.push(`/* TODO: dark mode "${cls}" — use useThemeColors() instead */`);
    }
  }

  // ─── Negative prefix handling ─────────────────
  let negative = false;
  if (baseCls.startsWith('-')) {
    negative = true;
    baseCls = baseCls.slice(1);
  }

  const neg = (v) => negative ? -v : v;

  // ─── Display ──────────────────────────────────
  if (baseCls === 'hidden') { style.display = 'none'; return { style, shorthands, warnings }; }
  if (baseCls === 'block' || baseCls === 'inline-block' || baseCls === 'inline') {
    // ReactJIT is always flex — ignore
    warnings.push(`/* "${cls}" ignored — ReactJIT uses flex layout exclusively */`);
    return { style, shorthands, warnings };
  }

  // ─── Flex layout ──────────────────────────────
  if (baseCls === 'flex') { /* default in ReactJIT, no-op */ return { style, shorthands, warnings }; }
  if (baseCls === 'flex-row') { style.flexDirection = 'row'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-col') { style.flexDirection = 'column'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-row-reverse') { style.flexDirection = 'row'; warnings.push('/* TODO: flex-row-reverse — not supported, using row */'); return { style, shorthands, warnings }; }
  if (baseCls === 'flex-col-reverse') { style.flexDirection = 'column'; warnings.push('/* TODO: flex-col-reverse — not supported, using column */'); return { style, shorthands, warnings }; }
  if (baseCls === 'flex-wrap') { style.flexWrap = 'wrap'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-nowrap') { style.flexWrap = 'nowrap'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-1') { style.flexGrow = 1; style.flexShrink = 1; style.flexBasis = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-auto') { style.flexGrow = 1; style.flexShrink = 1; style.flexBasis = 'auto'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-initial') { style.flexGrow = 0; style.flexShrink = 1; style.flexBasis = 'auto'; return { style, shorthands, warnings }; }
  if (baseCls === 'flex-none') { style.flexGrow = 0; style.flexShrink = 0; style.flexBasis = 'auto'; return { style, shorthands, warnings }; }
  if (baseCls === 'grow') { style.flexGrow = 1; return { style, shorthands, warnings }; }
  if (baseCls === 'grow-0') { style.flexGrow = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'shrink') { style.flexShrink = 1; return { style, shorthands, warnings }; }
  if (baseCls === 'shrink-0') { style.flexShrink = 0; return { style, shorthands, warnings }; }

  // Flex basis
  const basisMatch = baseCls.match(/^basis-(.+)$/);
  if (basisMatch) {
    const val = basisMatch[1];
    if (TW_SPACING[val] !== undefined) { style.flexBasis = TW_SPACING[val]; }
    else if (TW_FRACTIONS[val]) { style.flexBasis = TW_FRACTIONS[val]; }
    else if (val === 'auto') { style.flexBasis = 'auto'; }
    return { style, shorthands, warnings };
  }

  // ─── Justify / Align ─────────────────────────
  if (baseCls === 'justify-start') { style.justifyContent = 'start'; return { style, shorthands, warnings }; }
  if (baseCls === 'justify-end') { style.justifyContent = 'end'; return { style, shorthands, warnings }; }
  if (baseCls === 'justify-center') { style.justifyContent = 'center'; return { style, shorthands, warnings }; }
  if (baseCls === 'justify-between') { style.justifyContent = 'space-between'; return { style, shorthands, warnings }; }
  if (baseCls === 'justify-around') { style.justifyContent = 'space-around'; return { style, shorthands, warnings }; }
  if (baseCls === 'justify-evenly') { style.justifyContent = 'space-evenly'; return { style, shorthands, warnings }; }

  if (baseCls === 'items-start') { style.alignItems = 'start'; return { style, shorthands, warnings }; }
  if (baseCls === 'items-end') { style.alignItems = 'end'; return { style, shorthands, warnings }; }
  if (baseCls === 'items-center') { style.alignItems = 'center'; return { style, shorthands, warnings }; }
  if (baseCls === 'items-stretch') { style.alignItems = 'stretch'; return { style, shorthands, warnings }; }
  if (baseCls === 'items-baseline') { style.alignItems = 'start'; warnings.push('/* TODO: items-baseline — no baseline alignment, using start */'); return { style, shorthands, warnings }; }

  if (baseCls === 'self-auto') { style.alignSelf = 'auto'; return { style, shorthands, warnings }; }
  if (baseCls === 'self-start') { style.alignSelf = 'start'; return { style, shorthands, warnings }; }
  if (baseCls === 'self-end') { style.alignSelf = 'end'; return { style, shorthands, warnings }; }
  if (baseCls === 'self-center') { style.alignSelf = 'center'; return { style, shorthands, warnings }; }
  if (baseCls === 'self-stretch') { style.alignSelf = 'stretch'; return { style, shorthands, warnings }; }

  // ─── Gap ──────────────────────────────────────
  const gapMatch = baseCls.match(/^gap(?:-(x|y))?-(.+)$/);
  if (gapMatch) {
    const val = TW_SPACING[gapMatch[2]];
    if (val !== undefined) {
      // ReactJIT has uniform gap only — use it for gap, gap-x, gap-y
      style.gap = val;
      if (gapMatch[1]) warnings.push(`/* gap-${gapMatch[1]} → uniform gap (ReactJIT doesn't have directional gap) */`);
    }
    return { style, shorthands, warnings };
  }

  // ─── Padding ──────────────────────────────────
  const padMatch = baseCls.match(/^(p|px|py|pt|pr|pb|pl|ps|pe)-(.+)$/);
  if (padMatch) {
    const [, dir, val] = padMatch;
    const px = TW_SPACING[val];
    if (px !== undefined) {
      const v = neg(px);
      if (dir === 'p') style.padding = v;
      else if (dir === 'px') { style.paddingLeft = v; style.paddingRight = v; }
      else if (dir === 'py') { style.paddingTop = v; style.paddingBottom = v; }
      else if (dir === 'pt') style.paddingTop = v;
      else if (dir === 'pr' || dir === 'pe') style.paddingRight = v;
      else if (dir === 'pb') style.paddingBottom = v;
      else if (dir === 'pl' || dir === 'ps') style.paddingLeft = v;
    }
    return { style, shorthands, warnings };
  }

  // ─── Margin ───────────────────────────────────
  if (baseCls === 'mx-auto' || baseCls === 'my-auto' || baseCls === 'm-auto') {
    warnings.push(`/* "${baseCls}" → use alignSelf: 'center' or justifyContent: 'center' on parent */`);
    return { style, shorthands, warnings };
  }
  const marMatch = baseCls.match(/^(m|mx|my|mt|mr|mb|ml|ms|me)-(.+)$/);
  if (marMatch) {
    const [, dir, val] = marMatch;
    const px = TW_SPACING[val];
    if (px !== undefined) {
      const v = neg(px);
      if (dir === 'm') style.margin = v;
      else if (dir === 'mx') { style.marginLeft = v; style.marginRight = v; }
      else if (dir === 'my') { style.marginTop = v; style.marginBottom = v; }
      else if (dir === 'mt') style.marginTop = v;
      else if (dir === 'mr' || dir === 'me') style.marginRight = v;
      else if (dir === 'mb') style.marginBottom = v;
      else if (dir === 'ml' || dir === 'ms') style.marginLeft = v;
    }
    return { style, shorthands, warnings };
  }

  // ─── Width / Height ───────────────────────────
  const sizeMatch = baseCls.match(/^(w|h|min-w|min-h|max-w|max-h)-(.+)$/);
  if (sizeMatch) {
    const [, prop, val] = sizeMatch;
    const propMap = { 'w': 'width', 'h': 'height', 'min-w': 'minWidth', 'min-h': 'minHeight', 'max-w': 'maxWidth', 'max-h': 'maxHeight' };
    const styleProp = propMap[prop];

    if (TW_SPACING[val] !== undefined) { style[styleProp] = TW_SPACING[val]; }
    else if (TW_FRACTIONS[val]) { style[styleProp] = TW_FRACTIONS[val]; }
    else if (val === 'auto') { /* auto is default */ }
    else if (val === 'full') { style[styleProp] = '100%'; }
    else if (val === 'screen') { style[styleProp] = '100%'; }
    else if (prop.startsWith('max-w') && TW_MAX_WIDTH[val]) { style[styleProp] = TW_MAX_WIDTH[val]; }
    else if (/^\d+$/.test(val)) { style[styleProp] = parseInt(val) * 4; } // arbitrary tw unit
    else if (/^\[.+\]$/.test(val)) {
      // Arbitrary value: w-[300px], h-[50%]
      style[styleProp] = parseArbitraryValue(val.slice(1, -1));
    }
    return { style, shorthands, warnings };
  }

  // ─── Font size ────────────────────────────────
  const textSizeMatch = baseCls.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/);
  if (textSizeMatch) {
    style.fontSize = TW_FONT_SIZE[textSizeMatch[1]];
    return { style, shorthands, warnings };
  }

  // ─── Font weight ──────────────────────────────
  const weightMatch = baseCls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);
  if (weightMatch) {
    style.fontWeight = TW_FONT_WEIGHT[weightMatch[1]];
    return { style, shorthands, warnings };
  }

  // ─── Text alignment ──────────────────────────
  if (baseCls === 'text-left') { style.textAlign = 'left'; return { style, shorthands, warnings }; }
  if (baseCls === 'text-center') { style.textAlign = 'center'; return { style, shorthands, warnings }; }
  if (baseCls === 'text-right') { style.textAlign = 'right'; return { style, shorthands, warnings }; }
  if (baseCls === 'text-justify') { style.textAlign = 'left'; warnings.push('/* text-justify → left (no justify in ReactJIT) */'); return { style, shorthands, warnings }; }

  // ─── Text decoration ──────────────────────────
  if (baseCls === 'underline') { style.textDecorationLine = 'underline'; return { style, shorthands, warnings }; }
  if (baseCls === 'line-through') { style.textDecorationLine = 'line-through'; return { style, shorthands, warnings }; }
  if (baseCls === 'no-underline') { style.textDecorationLine = 'none'; return { style, shorthands, warnings }; }

  // ─── Text transform (not supported) ───────────
  if (['uppercase', 'lowercase', 'capitalize', 'normal-case'].includes(baseCls)) {
    warnings.push(`/* "${baseCls}" — no text-transform in ReactJIT, transform the string in JS */`);
    return { style, shorthands, warnings };
  }

  // ─── Truncate / overflow text ─────────────────
  if (baseCls === 'truncate') {
    style.textOverflow = 'ellipsis';
    style.overflow = 'hidden';
    return { style, shorthands, warnings };
  }

  // ─── Line clamp ───────────────────────────────
  const clampMatch = baseCls.match(/^line-clamp-(\d+)$/);
  if (clampMatch) {
    style.numberOfLines = parseInt(clampMatch[1]);
    return { style, shorthands, warnings };
  }

  // ─── Line height (leading) ────────────────────
  const leadingMatch = baseCls.match(/^leading-(.+)$/);
  if (leadingMatch) {
    const val = leadingMatch[1];
    const map = { 'none': 16, 'tight': 20, 'snug': 22, 'normal': 24, 'relaxed': 26, 'loose': 32 };
    if (map[val]) { style.lineHeight = map[val]; }
    else if (TW_SPACING[val] !== undefined) { style.lineHeight = TW_SPACING[val]; }
    else if (/^\d+$/.test(val)) { style.lineHeight = parseInt(val) * 4; }
    return { style, shorthands, warnings };
  }

  // ─── Letter spacing (tracking) ────────────────
  const trackingMatch = baseCls.match(/^tracking-(.+)$/);
  if (trackingMatch) {
    const map = { 'tighter': -0.8, 'tight': -0.4, 'normal': 0, 'wide': 0.4, 'wider': 0.8, 'widest': 1.6 };
    if (map[trackingMatch[1]] !== undefined) { style.letterSpacing = map[trackingMatch[1]]; }
    return { style, shorthands, warnings };
  }

  // ─── Text color ───────────────────────────────
  const textColorMatch = baseCls.match(/^text-(.+)$/);
  if (textColorMatch && !textSizeMatch) {
    const color = resolveColor(textColorMatch[1]);
    if (color) { style.color = color; }
    else { warnings.push(`/* unknown text color: "${baseCls}" */`); }
    return { style, shorthands, warnings };
  }

  // ─── Background color ─────────────────────────
  const bgMatch = baseCls.match(/^bg-(.+)$/);
  if (bgMatch) {
    const val = bgMatch[1];
    // Check for gradient direction keywords
    if (['gradient-to-t', 'gradient-to-tr', 'gradient-to-r', 'gradient-to-br', 'gradient-to-b', 'gradient-to-bl', 'gradient-to-l', 'gradient-to-tl'].includes(val)) {
      warnings.push(`/* TODO: "${baseCls}" → use backgroundGradient: { direction, colors } */`);
      return { style, shorthands, warnings };
    }
    const color = resolveColor(val);
    if (color) { style.backgroundColor = color; }
    else { warnings.push(`/* unknown bg color: "${baseCls}" */`); }
    return { style, shorthands, warnings };
  }

  // ─── Border radius ────────────────────────────
  const roundedMatch = baseCls.match(/^rounded(?:-(tl|tr|bl|br|t|r|b|l|s|e|ss|se|es|ee))?(?:-(.+))?$/);
  if (roundedMatch) {
    const [, corner, size] = roundedMatch;
    const rad = TW_RADIUS[size || ''] ?? (TW_SPACING[size] !== undefined ? TW_SPACING[size] : undefined);
    if (rad !== undefined) {
      if (!corner) { style.borderRadius = rad; }
      else if (corner === 'tl') style.borderTopLeftRadius = rad;
      else if (corner === 'tr') style.borderTopRightRadius = rad;
      else if (corner === 'bl') style.borderBottomLeftRadius = rad;
      else if (corner === 'br') style.borderBottomRightRadius = rad;
      else if (corner === 't') { style.borderTopLeftRadius = rad; style.borderTopRightRadius = rad; }
      else if (corner === 'r') { style.borderTopRightRadius = rad; style.borderBottomRightRadius = rad; }
      else if (corner === 'b') { style.borderBottomLeftRadius = rad; style.borderBottomRightRadius = rad; }
      else if (corner === 'l') { style.borderTopLeftRadius = rad; style.borderBottomLeftRadius = rad; }
    }
    return { style, shorthands, warnings };
  }

  // ─── Border width ─────────────────────────────
  const borderWMatch = baseCls.match(/^border(?:-(t|r|b|l|x|y|s|e))?(?:-(\d+))?$/);
  if (borderWMatch) {
    const [, side, widthStr] = borderWMatch;
    const w = widthStr ? parseInt(widthStr) : 1;
    if (!side) { style.borderWidth = w; }
    else if (side === 't') style.borderTopWidth = w;
    else if (side === 'r' || side === 'e') style.borderRightWidth = w;
    else if (side === 'b') style.borderBottomWidth = w;
    else if (side === 'l' || side === 's') style.borderLeftWidth = w;
    else if (side === 'x') { style.borderLeftWidth = w; style.borderRightWidth = w; }
    else if (side === 'y') { style.borderTopWidth = w; style.borderBottomWidth = w; }
    return { style, shorthands, warnings };
  }

  // ─── Border color ─────────────────────────────
  const borderColorMatch = baseCls.match(/^border-((?:(?:t|r|b|l|x|y|s|e)-)?(?:.+))$/);
  if (borderColorMatch && !borderWMatch) {
    const color = resolveColor(borderColorMatch[1]);
    if (color) { style.borderColor = color; }
    return { style, shorthands, warnings };
  }

  // ─── Opacity ──────────────────────────────────
  const opacityMatch = baseCls.match(/^opacity-(.+)$/);
  if (opacityMatch) {
    const val = TW_OPACITY[opacityMatch[1]];
    if (val !== undefined) { style.opacity = val; }
    return { style, shorthands, warnings };
  }

  // ─── Overflow ─────────────────────────────────
  if (baseCls === 'overflow-hidden') { style.overflow = 'hidden'; return { style, shorthands, warnings }; }
  if (baseCls === 'overflow-scroll' || baseCls === 'overflow-auto') { style.overflow = 'scroll'; return { style, shorthands, warnings }; }
  if (baseCls === 'overflow-visible') { style.overflow = 'visible'; return { style, shorthands, warnings }; }
  if (baseCls.startsWith('overflow-x-') || baseCls.startsWith('overflow-y-')) {
    const val = baseCls.split('-').pop();
    style.overflow = val === 'auto' || val === 'scroll' ? 'scroll' : val;
    return { style, shorthands, warnings };
  }

  // ─── Position ─────────────────────────────────
  if (baseCls === 'relative') { style.position = 'relative'; return { style, shorthands, warnings }; }
  if (baseCls === 'absolute') { style.position = 'absolute'; return { style, shorthands, warnings }; }
  if (baseCls === 'fixed') { style.position = 'absolute'; warnings.push('/* fixed → absolute (no fixed positioning in ReactJIT) */'); return { style, shorthands, warnings }; }
  if (baseCls === 'sticky') { style.position = 'absolute'; warnings.push('/* sticky → absolute (no sticky positioning in ReactJIT) */'); return { style, shorthands, warnings }; }

  // ─── Inset (top/right/bottom/left) ────────────
  const insetMatch = baseCls.match(/^(inset|top|right|bottom|left)-(.+)$/);
  if (insetMatch) {
    const [, prop, val] = insetMatch;
    let px;
    if (TW_SPACING[val] !== undefined) px = neg(TW_SPACING[val]);
    else if (TW_FRACTIONS[val]) px = TW_FRACTIONS[val];
    else if (val === '0') px = 0;
    else if (/^\[.+\]$/.test(val)) px = parseArbitraryValue(val.slice(1, -1));

    if (px !== undefined) {
      if (prop === 'inset') { style.top = px; style.right = px; style.bottom = px; style.left = px; }
      else { style[prop] = px; }
    }
    return { style, shorthands, warnings };
  }
  // Zero-value inset shorthands
  if (baseCls === 'inset-0') { style.top = 0; style.right = 0; style.bottom = 0; style.left = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'top-0') { style.top = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'right-0') { style.right = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'bottom-0') { style.bottom = 0; return { style, shorthands, warnings }; }
  if (baseCls === 'left-0') { style.left = 0; return { style, shorthands, warnings }; }

  // ─── Z-index ──────────────────────────────────
  const zMatch = baseCls.match(/^z-(.+)$/);
  if (zMatch) {
    const val = zMatch[1];
    if (val === 'auto') { style.zIndex = 0; }
    else { style.zIndex = parseInt(val); }
    return { style, shorthands, warnings };
  }

  // ─── Shadow ───────────────────────────────────
  const shadowMatch = baseCls.match(/^shadow(?:-(.+))?$/);
  if (shadowMatch) {
    const val = shadowMatch[1] || '';
    const shadow = TW_SHADOWS[val];
    if (shadow) { Object.assign(style, shadow); }
    return { style, shorthands, warnings };
  }

  // ─── Object fit ───────────────────────────────
  const objectMatch = baseCls.match(/^object-(contain|cover|fill|none|scale-down)$/);
  if (objectMatch) {
    style.objectFit = objectMatch[1] === 'scale-down' ? 'contain' : objectMatch[1];
    return { style, shorthands, warnings };
  }

  // ─── Aspect ratio ─────────────────────────────
  if (baseCls === 'aspect-square') { style.aspectRatio = 1; return { style, shorthands, warnings }; }
  if (baseCls === 'aspect-video') { style.aspectRatio = 16/9; return { style, shorthands, warnings }; }
  if (baseCls === 'aspect-auto') { return { style, shorthands, warnings }; }

  // ─── Cursor (no-op in ReactJIT) ───────────────
  if (baseCls.startsWith('cursor-')) { return { style, shorthands, warnings }; }

  // ─── Pointer events (no-op) ───────────────────
  if (baseCls.startsWith('pointer-events-')) { return { style, shorthands, warnings }; }

  // ─── User select ──────────────────────────────
  if (baseCls === 'select-none') { style.userSelect = 'none'; return { style, shorthands, warnings }; }
  if (baseCls === 'select-text') { style.userSelect = 'text'; return { style, shorthands, warnings }; }
  if (baseCls === 'select-all' || baseCls === 'select-auto') { style.userSelect = 'auto'; return { style, shorthands, warnings }; }

  // ─── Whitespace / word break (limited support) ─
  if (baseCls.startsWith('whitespace-') || baseCls.startsWith('break-') || baseCls === 'hyphens-auto') {
    warnings.push(`/* "${baseCls}" — limited text wrapping control in ReactJIT */`);
    return { style, shorthands, warnings };
  }

  // ─── Transition / animation (warn about manual conversion) ─
  if (baseCls.startsWith('transition') || baseCls.startsWith('duration-') || baseCls.startsWith('ease-') || baseCls.startsWith('delay-') || baseCls.startsWith('animate-')) {
    warnings.push(`/* TODO: "${baseCls}" → use style.transition or style.animation object */`);
    return { style, shorthands, warnings };
  }

  // ─── Grid (not supported) ─────────────────────
  if (baseCls.startsWith('grid') || baseCls.startsWith('col-') || baseCls.startsWith('row-')) {
    warnings.push(`/* "${baseCls}" — no CSS grid in ReactJIT, use nested flex (Box direction="row" + wrap) */`);
    return { style, shorthands, warnings };
  }

  // ─── Arbitrary values [value] ─────────────────
  const arbitraryMatch = baseCls.match(/^\[(.+)\]$/);
  if (arbitraryMatch) {
    warnings.push(`/* arbitrary value "${baseCls}" — needs manual conversion */`);
    return { style, shorthands, warnings };
  }

  // ─── Ring (outline) ───────────────────────────
  const ringMatch = baseCls.match(/^ring(?:-(\d+))?$/);
  if (ringMatch) {
    style.outlineWidth = ringMatch[1] ? parseInt(ringMatch[1]) : 3;
    style.outlineColor = '#3b82f6'; // default ring color
    return { style, shorthands, warnings };
  }
  const ringColorMatch = baseCls.match(/^ring-(.+)$/);
  if (ringColorMatch && !ringMatch) {
    const color = resolveColor(ringColorMatch[1]);
    if (color) style.outlineColor = color;
    return { style, shorthands, warnings };
  }

  // ─── Space-x / Space-y → gap ──────────────────
  const spaceMatch = baseCls.match(/^space-(x|y)-(.+)$/);
  if (spaceMatch) {
    const val = TW_SPACING[spaceMatch[2]];
    if (val !== undefined) {
      style.gap = val;
      if (spaceMatch[1] === 'x') { style.flexDirection = 'row'; }
    }
    return { style, shorthands, warnings };
  }

  // ─── Place / content / items (less common) ────
  if (baseCls.startsWith('place-') || baseCls.startsWith('content-')) {
    warnings.push(`/* "${baseCls}" — use justifyContent + alignItems instead */`);
    return { style, shorthands, warnings };
  }

  // ─── Divide (space between children via borders) ─
  if (baseCls.startsWith('divide-')) {
    warnings.push(`/* "${baseCls}" → use gap + children with borderBottom instead */`);
    return { style, shorthands, warnings };
  }

  // ─── Background gradient stops ────────────────
  if (baseCls.startsWith('from-') || baseCls.startsWith('via-') || baseCls.startsWith('to-')) {
    warnings.push(`/* "${baseCls}" → use backgroundGradient: { direction, colors: [...] } */`);
    return { style, shorthands, warnings };
  }

  // ─── Filter / backdrop (not supported) ────────
  if (baseCls.startsWith('blur') || baseCls.startsWith('brightness') || baseCls.startsWith('contrast') ||
      baseCls.startsWith('grayscale') || baseCls.startsWith('hue-rotate') || baseCls.startsWith('invert') ||
      baseCls.startsWith('saturate') || baseCls.startsWith('sepia') || baseCls.startsWith('drop-shadow') ||
      baseCls.startsWith('backdrop-')) {
    warnings.push(`/* "${baseCls}" — CSS filters not supported in ReactJIT */`);
    return { style, shorthands, warnings };
  }

  // ─── Rotate/Scale/Translate/Skew ──────────────
  const rotateMatch = baseCls.match(/^rotate-(.+)$/);
  if (rotateMatch) {
    style.transform = style.transform || {};
    style.transform.rotate = neg(parseInt(rotateMatch[1]));
    return { style, shorthands, warnings };
  }
  const scaleMatch = baseCls.match(/^scale(?:-(x|y))?-(.+)$/);
  if (scaleMatch) {
    const factor = parseInt(scaleMatch[2]) / 100;
    style.transform = style.transform || {};
    if (!scaleMatch[1] || scaleMatch[1] === 'x') style.transform.scaleX = factor;
    if (!scaleMatch[1] || scaleMatch[1] === 'y') style.transform.scaleY = factor;
    return { style, shorthands, warnings };
  }
  const translateMatch = baseCls.match(/^translate-(x|y)-(.+)$/);
  if (translateMatch) {
    const val = TW_SPACING[translateMatch[2]] ?? (TW_FRACTIONS[translateMatch[2]] ? undefined : undefined);
    style.transform = style.transform || {};
    if (val !== undefined) {
      if (translateMatch[1] === 'x') style.transform.translateX = neg(val);
      else style.transform.translateY = neg(val);
    }
    return { style, shorthands, warnings };
  }
  const skewMatch = baseCls.match(/^skew-(x|y)-(.+)$/);
  if (skewMatch) {
    style.transform = style.transform || {};
    if (skewMatch[1] === 'x') style.transform.skewX = neg(parseInt(skewMatch[2]));
    else style.transform.skewY = neg(parseInt(skewMatch[2]));
    return { style, shorthands, warnings };
  }
  if (baseCls === 'origin-center') { style.transform = style.transform || {}; style.transform.originX = 0.5; style.transform.originY = 0.5; return { style, shorthands, warnings }; }

  // ─── Unrecognized ─────────────────────────────
  warnings.push(`/* unrecognized tw class: "${cls}" */`);
  return { style, shorthands, warnings };
}

/** Resolve a Tailwind color name to hex */
function resolveColor(name) {
  if (TW_COLORS[name]) return TW_COLORS[name];
  // Try with opacity modifier: red-500/50
  const opMatch = name.match(/^(.+?)\/(\d+)$/);
  if (opMatch) {
    const base = TW_COLORS[opMatch[1]];
    if (base) {
      const opacity = parseInt(opMatch[2]) / 100;
      return hexToRgba(base, opacity);
    }
  }
  // Arbitrary color
  if (name.startsWith('[') && name.endsWith(']')) {
    return name.slice(1, -1);
  }
  return null;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseArbitraryValue(val) {
  // e.g. "300px" → 300, "50%" → "50%", "2rem" → 32
  if (val.endsWith('px')) return parseInt(val);
  if (val.endsWith('%')) return val;
  if (val.endsWith('rem')) return parseFloat(val) * 16;
  if (val.endsWith('em')) return parseFloat(val) * 16;
  if (val.endsWith('vh') || val.endsWith('vw')) return '100%'; // approximate
  if (/^\d+$/.test(val)) return parseInt(val);
  return val;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INLINE CSS PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Parse CSS inline style string → ReactJIT style object */
function parseInlineStyle(cssStr) {
  const style = {};
  const warnings = [];

  if (!cssStr) return { style, warnings };

  const declarations = cssStr.split(';').map(s => s.trim()).filter(Boolean);

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = decl.slice(0, colonIdx).trim();
    let value = decl.slice(colonIdx + 1).trim();

    // Handle box-shadow specially
    if (prop === 'box-shadow') {
      const shadow = parseBoxShadow(value);
      Object.assign(style, shadow);
      continue;
    }

    // Handle transform specially
    if (prop === 'transform') {
      const t = parseCssTransform(value);
      if (Object.keys(t).length) style.transform = t;
      continue;
    }

    // Handle flex shorthand
    if (prop === 'flex') {
      const parts = value.split(/\s+/);
      if (parts.length >= 1) style.flexGrow = parseFloat(parts[0]) || 0;
      if (parts.length >= 2) style.flexShrink = parseFloat(parts[1]) || 0;
      if (parts.length >= 3) style.flexBasis = parseStyleValue(parts[2]);
      continue;
    }

    // Handle border shorthand
    if (prop === 'border') {
      const bParts = value.match(/(\d+)px\s+\w+\s+(.+)/);
      if (bParts) {
        style.borderWidth = parseInt(bParts[1]);
        style.borderColor = bParts[2];
      }
      continue;
    }

    // Handle transition
    if (prop === 'transition') {
      warnings.push(`/* TODO: transition: "${value}" → use style.transition object */`);
      continue;
    }

    // Handle animation
    if (prop === 'animation') {
      warnings.push(`/* TODO: animation: "${value}" → use style.animation object */`);
      continue;
    }

    const rjitProp = CSS_PROP_MAP[prop];
    if (rjitProp) {
      style[rjitProp] = parseStyleValue(value, rjitProp);
    } else {
      warnings.push(`/* unsupported CSS: "${prop}: ${value}" */`);
    }
  }

  return { style, warnings };
}

/** Parse a CSS value to a JS value */
function parseStyleValue(value, prop) {
  value = value.trim();

  // Numbers
  if (/^-?\d+(\.\d+)?px$/.test(value)) return parseFloat(value);
  if (/^-?\d+(\.\d+)?$/.test(value)) return parseFloat(value);
  if (/^-?\d+(\.\d+)?%$/.test(value)) return value;
  if (/^-?\d+(\.\d+)?rem$/.test(value)) return parseFloat(value) * 16;
  if (/^-?\d+(\.\d+)?em$/.test(value)) return parseFloat(value) * 16;
  if (/^-?\d+(\.\d+)?vh$/.test(value)) return '100%'; // approximate

  // Font weight
  if (prop === 'fontWeight') {
    if (/^\d+$/.test(value)) return parseInt(value);
    return value;
  }

  // Justify content / align items: strip flex- prefix
  if (prop === 'justifyContent' || prop === 'alignItems' || prop === 'alignSelf') {
    return value.replace(/^flex-/, '');
  }

  // Line height: if unitless multiply, treat as pixel value
  if (prop === 'lineHeight') {
    const num = parseFloat(value);
    if (!isNaN(num) && !value.includes('px')) {
      return Math.round(num * 16); // approximate em-based
    }
    return num || value;
  }

  // Colors
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) return value;

  return value;
}

function parseBoxShadow(value) {
  // Parse "2px 4px 8px rgba(0,0,0,0.3)" etc.
  const match = value.match(/(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px(?:\s+(-?\d+)px)?\s+(.+)/);
  if (match) {
    return {
      shadowOffsetX: parseInt(match[1]),
      shadowOffsetY: parseInt(match[2]),
      shadowBlur: parseInt(match[3]),
      shadowColor: match[5].trim(),
    };
  }
  return {};
}

function parseCssTransform(value) {
  const t = {};
  const fns = value.match(/\w+\([^)]+\)/g) || [];
  for (const fn of fns) {
    const [name, args] = fn.split('(');
    const val = parseFloat(args);
    if (name === 'translateX') t.translateX = val;
    else if (name === 'translateY') t.translateY = val;
    else if (name === 'rotate') t.rotate = val;
    else if (name === 'scaleX') t.scaleX = val;
    else if (name === 'scaleY') t.scaleY = val;
    else if (name === 'scale') { t.scaleX = val; t.scaleY = val; }
    else if (name === 'skewX') t.skewX = val;
    else if (name === 'skewY') t.skewY = val;
  }
  return t;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JSX TRANSFORMER (the main event)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Replace `>` inside attribute-value `={...}` expressions with a sentinel.
 * Only targets `>` after `=\s*{` (attribute context), NOT JSX child expressions
 * like `{features.map(...)}` which contain legitimate JSX elements.
 */
function protectAttrExpressions(str, sentinel) {
  let result = '';
  let i = 0;
  while (i < str.length) {
    // Look for = followed by {
    if (str[i] === '=' && i + 1 < str.length) {
      result += str[i]; i++;
      // Skip whitespace after =
      while (i < str.length && /\s/.test(str[i])) { result += str[i]; i++; }
      if (i < str.length && str[i] === '{') {
        // Found ={  — now protect > inside this balanced block
        result += str[i]; i++; // emit opening {
        let depth = 1;
        while (i < str.length && depth > 0) {
          const ch = str[i];
          if (ch === '{') { depth++; result += ch; }
          else if (ch === '}') { depth--; result += ch; }
          else if (ch === '>' && depth > 0) { result += sentinel; }
          else { result += ch; }
          i++;
        }
        continue;
      }
    }
    result += str[i]; i++;
  }
  return result;
}

/**
 * Core conversion: takes a JSX/HTML string and returns converted ReactJIT JSX.
 * This is a regex/state-machine approach — not a full parser — but handles
 * the common cases well enough to save 90% of manual work.
 */
export function convertToReactJIT(input) {
  const warnings = [];
  const usedComponents = new Set();
  let output = input;

  // ── Phase 0: Protect > inside attribute ={…} expressions ─
  // The tag regex chokes on > inside JSX attribute values (e.g. onClick={() => a > b}).
  // Only targets ={...} blocks, not JSX child expressions like {items.map(...)}.
  const SENTINEL = '\x00GT\x00';
  output = protectAttrExpressions(output, SENTINEL);

  // ── Phase 1: Normalize HTML attributes to JSX ─────────
  // class → className (if not already)
  output = output.replace(/\bclass=/g, 'className=');
  // for → htmlFor
  output = output.replace(/\bfor=/g, 'htmlFor=');

  // ── Phase 2: Convert self-closing elements ────────────
  // <img ... > → <img ... />  <br> → <br />  <hr> → <hr />  <input ...> → <input ... />
  output = output.replace(/<(img|br|hr|input|meta|link|source|embed|col|area|base|param|track|wbr)(\s[^>]*)?\s*\/?>/gi, '<$1$2 />');

  // ── Phase 3: Process each JSX element ─────────────────

  // Match opening tags with all their attributes
  output = output.replace(/<(\w+)((?:\s+[^>]*?)?)(\s*\/?)>/g, (match, tag, attrs, selfClose) => {
    const lowerTag = tag.toLowerCase();

    // Skip already-converted ReactJIT components (uppercase first char, known components)
    if (/^[A-Z]/.test(tag) && ['Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput', 'Modal', 'Row', 'Col'].includes(tag)) {
      return match;
    }

    // Determine target component
    let component = ELEMENT_MAP[lowerTag];
    if (!component) {
      // Unknown element — check if it's a custom component (uppercase)
      if (/^[A-Z]/.test(tag)) return match; // leave custom components alone
      component = 'Box'; // default fallback
      warnings.push(`/* unknown element <${tag}> → Box */`);
    }

    usedComponents.add(component);

    // Parse attributes
    const { props, style, convertWarnings } = convertAttributes(attrs, lowerTag, component);
    warnings.push(...convertWarnings);

    // Add semantic styles based on element type
    if (HEADING_SIZES[lowerTag] && !style.fontSize) {
      style.fontSize = HEADING_SIZES[lowerTag];
    }
    if (BOLD_ELEMENTS.has(lowerTag) && !style.fontWeight) {
      style.fontWeight = 'bold';
    }
    if (ITALIC_ELEMENTS.has(lowerTag) && !style.fontStyle) {
      // No fontStyle prop, use italic shorthand on Text
      if (component === 'Text') props.push('italic');
    }
    if (UNDERLINE_ELEMENTS.has(lowerTag) && !style.textDecorationLine) {
      style.textDecorationLine = 'underline';
    }
    if (STRIKETHROUGH_ELEMENTS.has(lowerTag) && !style.textDecorationLine) {
      style.textDecorationLine = 'line-through';
    }
    if (MONO_ELEMENTS.has(lowerTag) && !style.fontFamily) {
      style.fontFamily = 'Courier New';
    }

    // For <ul>/<ol>, add gap for list spacing
    if ((lowerTag === 'ul' || lowerTag === 'ol') && !style.gap) {
      style.gap = 4;
    }

    // For <li>, add row direction if there's a bullet
    if (lowerTag === 'li' && !style.flexDirection) {
      // We'll handle bullet points in text conversion later
    }

    // Build the output tag
    let result = `<${component}`;

    // Add non-style props
    for (const prop of props) {
      result += ` ${prop}`;
    }

    // Add style if non-empty
    if (Object.keys(style).length > 0) {
      result += ` ${styleToJSX(style)}`;
    }

    result += selfClose ? ' />' : '>';
    return result;
  });

  // ── Phase 4: Convert closing tags ─────────────────────
  output = output.replace(/<\/(\w+)>/g, (match, tag) => {
    const lowerTag = tag.toLowerCase();

    // Skip already-ReactJIT components
    if (/^[A-Z]/.test(tag) && ['Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput', 'Modal', 'Row', 'Col'].includes(tag)) {
      return match;
    }

    const component = ELEMENT_MAP[lowerTag];
    if (!component) {
      if (/^[A-Z]/.test(tag)) return match;
      return `</Box>`;
    }
    return `</${component}>`;
  });

  // ── Phase 4.5: Restore > sentinels ─────────────────────
  output = output.replaceAll(SENTINEL, '>');

  // ── Phase 5: Remove void element leftovers ────────────
  // <br /> → {'\n'} inside Text, or nothing inside Box
  output = output.replace(/<br\s*\/?>/gi, "{'\\n'}");
  output = output.replace(/<hr\s*\/?>/gi, '<Box style={{ width: "100%", height: 1, backgroundColor: "#e5e7eb" }} />');

  // ── Phase 6: Build import statement ───────────────────
  const imports = [...usedComponents].sort();
  // Always need at least Box
  if (!imports.includes('Box')) imports.unshift('Box');
  const importLine = `import { ${imports.join(', ')} } from '@reactjit/core';`;

  // ── Phase 7: Collect all warnings ─────────────────────
  const warningBlock = warnings.length > 0
    ? '\n// ⚠️  Conversion warnings:\n' + [...new Set(warnings)].map(w => `// ${w}`).join('\n') + '\n'
    : '';

  return {
    code: output,
    imports: importLine,
    warnings: [...new Set(warnings)],
    warningBlock,
    usedComponents: imports,
  };
}


/**
 * Convert HTML/React attributes to ReactJIT props + style.
 */
function convertAttributes(attrsStr, htmlTag, component) {
  const props = [];
  const style = {};
  const warnings = [];

  if (!attrsStr || !attrsStr.trim()) return { props, style, convertWarnings: warnings };

  // Parse attributes from the string
  const attrs = parseAttributeString(attrsStr);

  for (const [name, value] of attrs) {
    // ─── className / class → Tailwind resolution ───
    if (name === 'className' || name === 'class') {
      const classes = (value || '').split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        const result = resolveTailwindClass(cls);
        mergeStyles(style, result.style);
        for (const [k, v] of Object.entries(result.shorthands || {})) {
          props.push(v === true ? k : `${k}={${JSON.stringify(v)}}`);
        }
        warnings.push(...result.warnings);
      }
      continue;
    }

    // ─── style (already a JSX object or CSS string) ─
    if (name === 'style') {
      if (value && typeof value === 'string') {
        const v = value.trim();
        // If it looks like an object literal, keep as JSX style object
        if (v.startsWith('{') || v.startsWith('({') || v.startsWith('[')) {
          props.push(`style={${v}}`);
          warnings.push('/* existing JSX style object — verify properties are ReactJIT-compatible */');
        } else if (v.includes(':')) {
          // CSS string
          const { style: parsed, warnings: w } = parseInlineStyle(v);
          mergeStyles(style, parsed);
          warnings.push(...w);
        } else {
          warnings.push(`/* style attribute could not be parsed — check manually: "${v}" */`);
        }
      }
      continue;
    }

    // ─── Event handlers ─────────────────────────────
    if (name.startsWith('on')) {
      const mapped = EVENT_MAP[name];
      if (mapped === null) {
        warnings.push(`/* ${name} dropped — no equivalent in ReactJIT */`);
      } else if (mapped) {
        props.push(`${mapped}={${value || '() => {}'}}`);
      } else {
        // Unknown event — pass through and warn
        props.push(`${name}={${value || '() => {}'}}`);
        warnings.push(`/* unknown event "${name}" — may not work */`);
      }
      continue;
    }

    // ─── src (for images) ───────────────────────────
    if (name === 'src') {
      if (component === 'Image') {
        props.push(`src=${formatValue(value)}`);
      } else {
        warnings.push(`/* src="${value}" on non-Image element — needs manual conversion */`);
      }
      continue;
    }

    // ─── alt (drop — no alt text in canvas renderer) ─
    if (name === 'alt') continue;

    // ─── href (on anchor tags) ──────────────────────
    if (name === 'href') {
      warnings.push(`/* href="${value}" — use <Link to="${value}"> from @reactjit/router, or onClick handler */`);
      continue;
    }

    // ─── id (drop — no DOM IDs) ─────────────────────
    if (name === 'id') continue;

    // ─── key (keep — React needs this) ──────────────
    if (name === 'key') {
      const v = (value ?? '').trim();
      if (!v) continue;
      // If it looks like a JS identifier/expression, keep braces; otherwise quote it
      if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(v) || v.startsWith('(') || v.includes('=>')) {
        props.push(`key={${v}}`);
      } else if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"')) || v.startsWith('`')) {
        props.push(`key={${v}}`);
      } else {
        props.push(`key="${v.replace(/"/g, '\\"')}"`);
      }
      continue;
    }

    // ─── ref (keep) ─────────────────────────────────
    if (name === 'ref') {
      props.push(`ref={${value}}`);
      continue;
    }

    // ─── data-* (drop) ─────────────────────────────
    if (name.startsWith('data-')) continue;

    // ─── aria-* (drop) ─────────────────────────────
    if (name.startsWith('aria-')) continue;

    // ─── role (drop) ───────────────────────────────
    if (name === 'role') continue;

    // ─── tabIndex → focusable ──────────────────────
    if (name === 'tabIndex' || name === 'tabindex') {
      if (value !== '-1') props.push('focusable');
      continue;
    }

    // ─── placeholder (for TextInput) ────────────────
    if (name === 'placeholder') {
      if (component === 'TextInput') {
        props.push(`placeholder=${formatValue(value)}`);
      }
      continue;
    }

    // ─── value (for TextInput) ──────────────────────
    if (name === 'value') {
      if (component === 'TextInput') {
        props.push(`value={${value}}`);
      }
      continue;
    }

    // ─── disabled → opacity styling ─────────────────
    if (name === 'disabled') {
      style.opacity = 0.5;
      warnings.push('/* disabled → opacity: 0.5 (no native disabled state) */');
      continue;
    }

    // ─── type (for inputs) ──────────────────────────
    if (name === 'type') {
      if (component === 'TextInput') {
        if (value === 'password') props.push('secureTextEntry');
        // other types don't have direct mapping
      }
      continue;
    }

    // ─── Boolean HTML attributes (checked, required, autofocus, etc.) ─
    if (['checked', 'required', 'autofocus', 'autoFocus', 'readOnly', 'readonly',
         'multiple', 'selected', 'open', 'hidden'].includes(name)) {
      if (name === 'hidden') { style.display = 'none'; }
      // Most of these don't exist in ReactJIT
      continue;
    }

    // ─── htmlFor (label) ────────────────────────────
    if (name === 'htmlFor') continue;

    // ─── title (drop — no tooltips) ─────────────────
    if (name === 'title') continue;

    // ─── target, rel (link attributes — drop) ───────
    if (['target', 'rel', 'download', 'method', 'action', 'enctype', 'novalidate'].includes(name)) continue;

    // ─── name, accept, pattern, min, max, step ──────
    if (['name', 'accept', 'pattern', 'min', 'max', 'step', 'minlength', 'maxlength', 'size', 'rows', 'cols', 'wrap'].includes(name)) {
      if (component === 'TextInput') {
        warnings.push(`/* input attribute "${name}" — no direct equivalent, needs JS logic */`);
      }
      continue;
    }

    // ─── width/height as attributes (img, etc.) ─────
    if (name === 'width') { style.width = parseInt(value) || value; continue; }
    if (name === 'height') { style.height = parseInt(value) || value; continue; }

    // ─── loading (lazy/eager — drop) ────────────────
    if (name === 'loading') continue;

    // ─── Anything else — warn and drop ──────────────
    warnings.push(`/* dropped attribute: ${name}="${value}" */`);
  }

  return { props, style, convertWarnings: warnings };
}


/**
 * Parse an HTML/JSX attribute string into [name, value] pairs.
 * Handles: name="value", name={expr}, name='value', name (boolean)
 */
function parseAttributeString(str) {
  const attrs = [];
  str = str.trim();
  if (!str) return attrs;

  let i = 0;
  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    // Read attribute name
    let name = '';
    while (i < str.length && str[i] !== '=' && !/\s/.test(str[i]) && str[i] !== '>' && str[i] !== '/') {
      name += str[i];
      i++;
    }

    if (!name) { i++; continue; }

    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;

    // Check for =
    if (i < str.length && str[i] === '=') {
      i++; // skip =
      while (i < str.length && /\s/.test(str[i])) i++;

      if (i >= str.length) {
        attrs.push([name, '']);
        break;
      }

      let value = '';
      if (str[i] === '"') {
        // Double-quoted
        i++;
        while (i < str.length && str[i] !== '"') {
          value += str[i];
          i++;
        }
        if (i < str.length) i++; // skip closing "
      } else if (str[i] === "'") {
        // Single-quoted
        i++;
        while (i < str.length && str[i] !== "'") {
          value += str[i];
          i++;
        }
        if (i < str.length) i++; // skip closing '
      } else if (str[i] === '{') {
        // JSX expression: capture inner content WITHOUT outer braces
        i++; // skip opening {
        let depth = 1;
        let expr = '';

        while (i < str.length && depth > 0) {
          const ch = str[i];
          if (ch === '{') {
            depth++;
            expr += ch;
            i++;
            continue;
          }
          if (ch === '}') {
            depth--;
            if (depth === 0) { i++; break; }
            expr += ch;
            i++;
            continue;
          }
          expr += ch;
          i++;
        }

        value = expr.trim();
      } else {
        // Unquoted
        while (i < str.length && !/\s/.test(str[i]) && str[i] !== '>' && str[i] !== '/') {
          value += str[i];
          i++;
        }
      }

      attrs.push([name, value]);
    } else {
      // Boolean attribute
      attrs.push([name, 'true']);
    }
  }

  return attrs;
}


/** Merge style objects, with transform merging */
function mergeStyles(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'transform' && target.transform) {
      Object.assign(target.transform, value);
    } else {
      target[key] = value;
    }
  }
}

/** Convert a style object to a formatted string for JSX style={...} attribute.
 *  Returns the full `style={...}` expression to avoid double-brace bugs. */
function styleToJSX(style) {
  const entries = Object.entries(style);
  if (entries.length === 0) return 'style={{}}';

  const parts = [];
  for (const [key, value] of entries) {
    if (typeof value === 'object' && value !== null) {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'string') {
      parts.push(`${key}: '${value}'`);
    } else {
      parts.push(`${key}: ${value}`);
    }
  }

  if (parts.length <= 3) {
    return `style={{ ${parts.join(', ')} }}`;
  }
  return `style={{\n    ${parts.join(',\n    ')}\n  }}`;
}

/** Format a value for JSX prop output */
function formatValue(val) {
  if (!val) return '""';
  // If it looks like a JS expression (arrow fn, template literal, function call), wrap in braces
  if (val.startsWith('(') || val.includes('=>') || val.startsWith('`') || val.includes('(')) {
    return `{${val}}`;
  }
  // Everything else is a plain string — quote it
  return `"${val}"`;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function runConvert(args) {
  let input;
  let inputFile = null;

  // Parse args
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const stdinMode = args.includes('--stdin');
  const helpMode = args.includes('--help') || args.includes('-h');
  const quietMode = args.includes('--quiet') || args.includes('-q');

  if (helpMode) {
    console.log(`
  rjit convert — Convert HTML/React div-soup to ReactJIT components

  Usage:
    rjit convert <file.html|.tsx|.jsx>     Read file and print converted output
    rjit convert <file> --output out.tsx   Write converted output to file
    rjit convert --stdin                   Read from stdin
    cat file.html | rjit convert           Pipe mode (auto-detects stdin)

  What it converts:
    • HTML elements → Box, Text, Image, Pressable, TextInput
    • Tailwind utility classes → style props (full v3 palette + spacing + layout)
    • Inline CSS styles → ReactJIT style objects
    • React DOM events → ReactJIT events (onMouseEnter → onPointerEnter, etc.)
    • Heading tags → Text with appropriate fontSize + bold
    • Semantic elements (nav, header, section) → Box
    • <br> → {'\\n'}, <hr> → Box with 1px height

  Warnings are added as comments for things that need manual attention:
    • Responsive prefixes (sm:, md:) — no breakpoints in ReactJIT
    • CSS Grid classes — use nested flex instead
    • CSS filters (blur, brightness) — not supported
    • Gradients — need manual backgroundGradient object
    • Transitions/animations — need manual style.transition/animation object
`);
    return;
  }

  // Get input
  const fileArg = args.find(a => !a.startsWith('-') && a !== outputFile);
  if (fileArg) {
    try {
      input = readFileSync(fileArg, 'utf-8');
      inputFile = fileArg;
    } catch (err) {
      console.error(`Error reading file: ${fileArg}`);
      console.error(err.message);
      process.exit(1);
    }
  } else if (stdinMode || !process.stdin.isTTY) {
    // Read from stdin
    const chunks = [];
    const fd = require('fs').openSync('/dev/stdin', 'r');
    const buf = Buffer.alloc(65536);
    let bytesRead;
    while ((bytesRead = require('fs').readSync(fd, buf, 0, buf.length)) > 0) {
      chunks.push(buf.subarray(0, bytesRead).toString());
    }
    require('fs').closeSync(fd);
    input = chunks.join('');
  } else {
    console.error('No input file specified. Use --help for usage.');
    process.exit(1);
  }

  if (!input || !input.trim()) {
    console.error('Empty input.');
    process.exit(1);
  }

  // Convert
  const result = convertToReactJIT(input);

  // Output
  const fullOutput = [
    result.imports,
    result.warningBlock,
    result.code,
  ].filter(Boolean).join('\n');

  if (outputFile) {
    const { writeFileSync: wf } = require('node:fs');
    wf(outputFile, fullOutput, 'utf-8');
    if (!quietMode) {
      console.log(`✓ Converted → ${outputFile}`);
      console.log(`  Components used: ${result.usedComponents.join(', ')}`);
      if (result.warnings.length) {
        console.log(`  ${result.warnings.length} warning(s) — check output for // TODO comments`);
      }
    }
  } else {
    process.stdout.write(fullOutput);
    if (!quietMode && process.stderr.isTTY) {
      console.error(`\n--- ${result.usedComponents.length} components: ${result.usedComponents.join(', ')} | ${result.warnings.length} warning(s) ---`);
    }
  }
}
