import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tw } from '../src/tw.ts';

// Canonical round-trip pairs only. We intentionally exclude lossy aliases
// like gap-x/space-x, bg-opacity/opacity, mx-auto/self-center, and ring-0/outline-0.
const CASES = [
  { name: 'padding all', tailwind: 'p-4', style: { padding: 16 } },
  { name: 'padding x', tailwind: 'px-6', style: { paddingLeft: 24, paddingRight: 24 } },
  { name: 'padding y', tailwind: 'py-2', style: { paddingTop: 8, paddingBottom: 8 } },
  { name: 'margin all', tailwind: 'm-4', style: { margin: 16 } },
  { name: 'negative margin top', tailwind: '-mt-2', style: { marginTop: -8 } },
  { name: 'gap', tailwind: 'gap-3', style: { gap: 12 } },
  { name: 'width full', tailwind: 'w-full', style: { width: '100%' } },
  { name: 'height scale', tailwind: 'h-10', style: { height: 40 } },
  { name: 'square size', tailwind: 'size-4', style: { width: 16, height: 16 } },
  { name: 'min width', tailwind: 'min-w-8', style: { minWidth: 32 } },
  { name: 'max width named scale', tailwind: 'max-w-xl', style: { maxWidth: 576 } },
  { name: 'flex basis fraction', tailwind: 'basis-1/2', style: { flexBasis: '50%' } },
  { name: 'aspect arbitrary', tailwind: 'aspect-[4/3]', style: { aspectRatio: 4 / 3 } },
  { name: 'display hidden', tailwind: 'hidden', style: { display: 'none' } },
  { name: 'overflow hidden', tailwind: 'overflow-hidden', style: { overflow: 'hidden' } },
  { name: 'absolute positioning', tailwind: 'absolute', style: { position: 'absolute' } },
  { name: 'inset x', tailwind: 'inset-x-4', style: { left: 16, right: 16 } },
  { name: 'negative top offset', tailwind: '-top-2', style: { top: -8 } },
  { name: 'flex row', tailwind: 'flex-row', style: { flexDirection: 'row' } },
  { name: 'flex wrap', tailwind: 'flex-wrap', style: { flexWrap: 'wrap' } },
  { name: 'flex 1 shorthand', tailwind: 'flex-1', style: { flexGrow: 1, flexShrink: 1, flexBasis: 0 } },
  { name: 'justify between', tailwind: 'justify-between', style: { justifyContent: 'space-between' } },
  { name: 'items center', tailwind: 'items-center', style: { alignItems: 'center' } },
  { name: 'self stretch', tailwind: 'self-stretch', style: { alignSelf: 'stretch' } },
  { name: 'background palette color', tailwind: 'bg-blue-500', style: { backgroundColor: '#3b82f6' } },
  { name: 'background arbitrary color', tailwind: 'bg-[#ff6600]', style: { backgroundColor: '#ff6600' } },
  { name: 'border width', tailwind: 'border-2', style: { borderWidth: 2 } },
  { name: 'border color', tailwind: 'border-red-500', style: { borderColor: '#ef4444' } },
  { name: 'rounded radius', tailwind: 'rounded-lg', style: { borderRadius: 8 } },
  {
    name: 'rounded top corners',
    tailwind: 'rounded-t-lg',
    style: { borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  },
  {
    name: 'shadow preset',
    tailwind: 'shadow-md',
    style: { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetX: 0, shadowOffsetY: 4, shadowBlur: 6 },
  },
  { name: 'text color', tailwind: 'text-gray-400', style: { color: '#9ca3af' } },
  { name: 'font size scale', tailwind: 'text-xl', style: { fontSize: 20 } },
  { name: 'font size arbitrary', tailwind: 'text-[22]', style: { fontSize: 22 } },
  { name: 'font weight', tailwind: 'font-bold', style: { fontWeight: 'bold' } },
  { name: 'text align', tailwind: 'text-center', style: { textAlign: 'center' } },
  { name: 'text decoration', tailwind: 'line-through', style: { textDecorationLine: 'line-through' } },
  { name: 'line height arbitrary', tailwind: 'leading-[18]', style: { lineHeight: 18 } },
  { name: 'letter spacing arbitrary', tailwind: 'tracking-[1.25]', style: { letterSpacing: 1.25 } },
  { name: 'opacity scale', tailwind: 'opacity-75', style: { opacity: 0.75 } },
  { name: 'opacity arbitrary', tailwind: 'opacity-[0.33]', style: { opacity: 0.33 } },
  { name: 'z index arbitrary', tailwind: 'z-[7]', style: { zIndex: 7 } },
  {
    name: 'gradient',
    tailwind: 'bg-gradient-to-r from-blue-500 to-purple-500',
    style: {
      backgroundGradient: {
        direction: 'horizontal',
        colors: ['#3b82f6', '#a855f7'],
      },
    },
  },
  {
    name: 'transition bundle',
    tailwind: 'transition duration-300 ease-out delay-75',
    style: {
      transition: {
        all: {
          duration: 300,
          easing: 'easeOut',
          delay: 75,
        },
      },
    },
  },
  { name: 'translate x', tailwind: 'translate-x-4', style: { transform: { translateX: 16 } } },
  { name: 'negative translate y', tailwind: '-translate-y-2', style: { transform: { translateY: -8 } } },
  { name: 'rotate arbitrary', tailwind: 'rotate-[22.5]', style: { transform: { rotate: 22.5 } } },
  { name: 'scale arbitrary', tailwind: 'scale-[1.1]', style: { transform: { scaleX: 1.1, scaleY: 1.1 } } },
  { name: 'transform origin', tailwind: 'origin-top-left', style: { transform: { originX: 0, originY: 0 } } },
  {
    name: 'outline ring',
    tailwind: 'ring-2',
    style: { outlineWidth: 2, outlineColor: '#3b82f6', outlineOffset: 2 },
  },
  {
    name: 'truncate bundle',
    tailwind: 'truncate',
    style: { textOverflow: 'ellipsis', overflow: 'hidden' },
  },
  {
    name: 'composite layout bundle',
    tailwind: 'p-4 flex-row items-center gap-2 bg-blue-500 rounded-lg',
    style: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#3b82f6',
      borderRadius: 8,
    },
  },
  {
    name: 'composite transform bundle',
    tailwind: 'translate-x-4 -translate-y-2 rotate-45 scale-125',
    style: {
      transform: {
        translateX: 16,
        translateY: -8,
        rotate: 45,
        scaleX: 1.25,
        scaleY: 1.25,
      },
    },
  },
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

const STYLE_TO_TAILWIND = new Map(
  CASES.map(({ style, tailwind }) => [stableStringify(style), tailwind]),
);

function styleToCanonicalTailwind(style) {
  const key = stableStringify(style);
  const match = STYLE_TO_TAILWIND.get(key);
  assert.ok(match, `No canonical Tailwind mapping registered for ${key}`);
  return match;
}

describe('tw() canonical round-trips', () => {
  it('keeps the canonical table one-to-one', () => {
    assert.equal(STYLE_TO_TAILWIND.size, CASES.length, 'duplicate canonical styles in CASES');

    const seenTailwind = new Set();
    for (const { tailwind } of CASES) {
      assert.equal(seenTailwind.has(tailwind), false, `duplicate canonical classes in CASES: ${tailwind}`);
      seenTailwind.add(tailwind);
    }
  });

  for (const { name, tailwind, style } of CASES) {
    it(`${name} round-trips tailwind <-> style 1:1`, () => {
      const parsed = tw(tailwind);
      assert.deepEqual(parsed, style);
      assert.equal(styleToCanonicalTailwind(parsed), tailwind);

      const serialized = styleToCanonicalTailwind(style);
      assert.equal(serialized, tailwind);
      assert.deepEqual(tw(serialized), style);
    });
  }
});
