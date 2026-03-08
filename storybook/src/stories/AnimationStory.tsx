/**
 * Animation — Full animation system built into @reactjit/core.
 *
 * JS-driven: useSpring, useAnimation, presets — React re-renders per frame.
 * Lua-driven: style.transition, style.animation (keyframes) — zero bridge traffic.
 * Stroke dashes: strokeDasharray + strokeDashoffset — native Lua path animation.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Text, Image, ScrollView, CodeBlock, Pressable,
  Easing, useShake,
  entranceStyle,
  classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  fire: '#ef4444',
  amber: '#f59e0b',
  emerald: '#10b981',
  cyan: '#06b6d4',
  pink: '#ec4899',
  blue: '#3b82f6',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  useAnimation, useSpring, Easing,
  parallel, sequence, stagger, loop,
  usePulse, useCountUp, useTypewriter,
  useShake, useEntrance, useBounce, useRepeat,
} from '@reactjit/core'`;

const SPRING_CODE = `const value = useSpring(target, {
  stiffness: 180,  // higher = snappier
  damping: 12,     // lower = bouncier
})
// Re-renders each frame during motion.
// Settles naturally — no duration needed.`;

const TRANSITION_CODE = `<Box style={{
  backgroundColor: hovered ? '#8b5cf6' : '#1e1e2e',
  transform: {
    scaleX: pressed ? 0.95 : 1,
    scaleY: pressed ? 0.95 : 1,
  },
  shadowBlur: hovered ? 16 : 0,
  // Lua interpolates — zero JS re-renders
  transition: { all: { duration: 250, easing: 'easeOut' } },
}} />`;

const KEYFRAME_CODE = `<Box style={{
  animation: {
    keyframes: {
      0:   { transform: { rotate: 0 } },
      100: { transform: { rotate: 360 } },
    },
    duration: 2000,
    iterations: -1,      // infinite loop
    easing: 'linear',
    direction: 'normal', // 'alternate' | 'reverse'
    fillMode: 'forwards',
    playState: 'running', // 'paused' to freeze
  },
}} />`;

const STROKE_CODE = `// Marching ants
<Box style={{
  borderWidth: 2, borderColor: '#8b5cf6',
  strokeDasharray: [8, 8],
  animation: {
    keyframes: {
      0: { strokeDashoffset: 0 },
      100: { strokeDashoffset: 16 },
    },
    duration: 600, iterations: -1, easing: 'linear',
  },
}} />

// Draw-on reveal
<Box style={{
  strokeDasharray: [perimeter, perimeter],
  strokeDashoffset: revealed ? 0 : perimeter,
  transition: {
    strokeDashoffset: { duration: 2000, easing: 'easeInOut' },
  },
}} />`;

const PRESET_CODE = `const pulse = usePulse({ min: 0.3, max: 1 })
const count = useCountUp(9999, { duration: 1500 })
const text = useTypewriter('Hello', { speed: 60 })
const { value, shake } = useShake({ intensity: 10 })
const { opacity, translateY } = useEntrance({ delay: 100 })
const height = useBounce(target, { stiffness: 200 })
const progress = useRepeat({ duration: 1000 })`;

const EASING_CODE = `// Built-in easings
Easing.linear      Easing.easeIn
Easing.easeOut     Easing.easeInOut
Easing.bounce      Easing.elastic(1)

// Custom cubic bezier
Easing.bezier(0.68, -0.6, 0.32, 1.6)

// In Lua transitions: easing: 'bounce'
// In Lua keyframes:   easing: 'elastic'
// In JS animations:   easing: Easing.bounce`;

const EFFECTS_CODE = `// Shimmer — diagonal light band sweep
<Box style={{ overflow: 'hidden', ... }}>
  <Box style={{
    position: 'absolute', width: '30%', height: '100%',
    backgroundGradient: {
      direction: 'diagonal', colors: [transp, white] },
    animation: { keyframes: {
      0: { transform: { translateX: -60 } },
      100: { transform: { translateX: 220 } },
    }, duration: 2000, iterations: -1 },
  }} />
</Box>

// Ripple — radial expand from click point
onClick={(e) => {
  setRipple({ x: e.x - layout.x, y: e.y - layout.y })
}}
// Expanding circle with spring-driven scale + fade

// Rubber band — exaggerated spring on press
const s = useSpring(pressed ? 1 : 0,
  { stiffness: 400, damping: 6 }) // very bouncy
scaleX: 1 - s * 0.15, scaleY: 1 + s * 0.08

// Confetti — particle burst on click
// 40 tiny squares with random velocity + gravity`;

const SHATTER_CODE = `// Shatter button into physics blocks
const SH = { W: 160, H: 40, BS: 20 } // 8\u00D72 grid
const prog = useSpring(active ? 1 : 0,
  { stiffness: 120, damping: 10 })  // bouncy!

// Each block has home + scatter positions
{blocks.map(b => {
  const t = clamp((prog - b.delay) / (1 - b.delay))
  const x = lerp(b.homeX, b.scatterX, t)
  const y = lerp(b.homeY, b.scatterY, t)
  return <Box style={{
    position: 'absolute', left: x, top: y,
    transform: { rotate: b.rot * t },
  }} />
})}

// Forward: crack \u2192 break \u2192 collapse (spring overshoot = bounce)
// Reverse: gather \u2192 snap (spring undershoot = lock)
// setTimeout(() => setActive(false), 1400)`;

const CARD_FLIP_CODE = `// Click-to-flip card (useSpring)
const prog = useSpring(flipped ? 1 : 0,
  { stiffness: 200, damping: 18 })
const scaleX = Math.abs(Math.cos(prog * Math.PI))
const showBack = prog > 0.5

<Box style={{
  transform: { scaleX },
  transition: { ... },  // optional Lua polish
}}>
  {showBack ? <Back /> : <Front />}
</Box>

// Hover-to-flip (same trick, hover state)
const hProg = useSpring(hovered ? 1 : 0, ...)
const hScale = Math.abs(Math.cos(hProg * Math.PI))`;

const PATTERN_CODE = `// Animated button: press + hover feedback
<Pressable onPressIn={...} onHoverIn={...}>
  <Box style={{
    transform: {
      scaleX: pressed ? 0.92 : hovered ? 1.04 : 1,
      scaleY: pressed ? 0.92 : hovered ? 1.04 : 1,
    },
    shadowBlur: hovered ? 12 : 0,
    transition: { all: { duration: 150 } },
  }} />
</Pressable>

// Staggered loading dots
{[0, 1, 2].map(i => (
  <Box style={{
    animation: {
      keyframes: {
        0: { opacity: 0.3 },
        50: { opacity: 1 },
        100: { opacity: 0.3 },
      },
      duration: 1200,
      iterations: -1,
      delay: i * 200,
    },
  }} />
))}`;

// ── Hoisted data arrays ─────────────────────────────────

const SPRING_PRESETS = [
  { label: 'Stiff (300/20)', stiffness: 300, damping: 20, color: C.fire },
  { label: 'Bouncy (180/4)', stiffness: 180, damping: 4, color: C.amber },
  { label: 'Sloppy (60/2)', stiffness: 60, damping: 2, color: C.emerald },
];

const EASING_LIST = [
  { label: 'linear', easing: 'linear' as const, color: '#888' },
  { label: 'easeIn', easing: 'easeIn' as const, color: C.fire },
  { label: 'easeOut', easing: 'easeOut' as const, color: C.amber },
  { label: 'easeInOut', easing: 'easeInOut' as const, color: C.emerald },
  { label: 'bounce', easing: 'bounce' as const, color: C.cyan },
  { label: 'elastic(1)', easing: Easing.elastic(1), color: C.pink },
  { label: 'elastic(2)', easing: Easing.elastic(2), color: C.accent },
  { label: 'bezier(.68,-.6,.32,1.6)', easing: Easing.bezier(0.68, -0.6, 0.32, 1.6), color: C.blue },
];

const FEATURE_CATALOG = [
  { label: 'useSpring', desc: 'Physics-based spring interpolation', color: C.fire },
  { label: 'useAnimation', desc: 'Timing/spring primitives + composition', color: C.amber },
  { label: 'style.transition', desc: 'CSS transitions in Lua — zero bridge', color: C.emerald },
  { label: 'style.animation', desc: 'CSS keyframes in Lua — infinite loops', color: C.cyan },
  { label: 'strokeDasharray', desc: 'SVG-style dash patterns on borders', color: C.pink },
  { label: 'strokeDashoffset', desc: 'Animated dash offset for reveals/spinners', color: C.blue },
  { label: 'usePulse', desc: 'Oscillating value (breathing, attention)', color: C.accent },
  { label: 'useCountUp', desc: 'Animated number counter', color: C.fire },
  { label: 'useTypewriter', desc: 'Character-by-character text reveal', color: C.amber },
  { label: 'useShake', desc: 'Triggered horizontal shake', color: C.emerald },
  { label: 'useEntrance', desc: 'One-shot fade + slide entrance', color: C.cyan },
  { label: 'useBounce', desc: 'Spring-based bounce to target', color: C.pink },
  { label: 'useRepeat', desc: 'Looping 0-1 progress value', color: C.blue },
  { label: 'Card Flip', desc: 'Spring-driven scaleX flip with content swap', color: C.accent },
  { label: 'Shatter', desc: 'Block decomposition with spring physics rebuild', color: C.fire },
  { label: 'Shimmer', desc: 'Diagonal light band sweep (slide-to-unlock)', color: C.cyan },
  { label: 'Ripple', desc: 'Material design radial expand from click point', color: C.blue },
  { label: 'Rubber Band', desc: 'Overshoot press + snap release (spring)', color: C.amber },
  { label: 'Confetti', desc: 'Particle burst with gravity on celebration', color: C.pink },
  { label: 'Skeleton', desc: 'Loading placeholder with shimmer pulse', color: C.emerald },
  { label: 'Tilt', desc: 'Parallax skew from hover entry point', color: C.cyan },
  { label: 'Easing.*', desc: 'linear, easeIn/Out, bounce, elastic, bezier', color: C.fire },
  { label: 'sequence/parallel', desc: 'Compose multiple animations', color: C.fire },
  { label: 'stagger/loop', desc: 'Delayed starts + infinite repeats', color: C.amber },
];

const SPRING_TARGETS = [0, 100, 200, 50, 150];

const ENTRANCE_ITEMS = [
  { text: 'First item slides in', color: C.fire },
  { text: 'Second follows close behind', color: C.amber },
  { text: 'Third arrives fashionably', color: C.emerald },
  { text: 'Fourth brings up the rear', color: C.cyan },
  { text: 'Fifth wraps it up', color: C.accent },
];

// ── Live Demo: Spring Physics ───────────────────────────

function SpringDemo() {
  const c = useThemeColors();
  const [targetIdx, setTargetIdx] = useState(0);
  const target = SPRING_TARGETS[targetIdx];

  const next = useCallback(() => {
    setTargetIdx(i => (i + 1) % SPRING_TARGETS.length);
  }, []);

  return (
    <>
      <S.StoryCap>{'Three springs race to the same target with different stiffness/damping. Lua-driven — one React render per tap.'}</S.StoryCap>

      <Pressable onPress={next}>
        <Box style={{
          backgroundColor: C.accentDim, borderRadius: 6, padding: 8,
          borderWidth: 1, borderColor: C.accent, alignItems: 'center',
        }}>
          <Text style={{ color: C.accent, fontSize: 10, fontWeight: 'bold' }}>{`Tap to animate \u2192 target: ${target}`}</Text>
        </Box>
      </Pressable>

      {SPRING_PRESETS.map((sp) => (
        <Box key={sp.label} style={{ gap: 2 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sp.color }} />
            <Text style={{ color: c.text, fontSize: 9, width: 90 }}>{sp.label}</Text>
          </Box>
          <Box style={{ height: 14, backgroundColor: c.bg, borderRadius: 3, overflow: 'hidden' }}>
            <Box style={{
              position: 'absolute', left: 0, top: 0,
              width: 200, height: 14,
              backgroundColor: sp.color, borderRadius: 3, opacity: 0.85,
              transform: { translateX: target - 200 },
              transition: { all: { type: 'spring', stiffness: sp.stiffness, damping: sp.damping } },
            }} />
          </Box>
        </Box>
      ))}
    </>
  );
}

// ── Live Demo: Spring Counter ───────────────────────────

function SpringCounterDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);

  return (
    <>
      <S.StoryCap>{'Spring transition on the bar width. React renders once per button press.'}</S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => setCount(n => n + 100)}>
          <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, backgroundColor: C.emerald, borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{'+100'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setCount(n => n - 100)}>
          <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, backgroundColor: C.fire, borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{'\u2212100'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setCount(0)}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, backgroundColor: c.surface, borderRadius: 4 }}>
            <S.StoryMuted>{'reset'}</S.StoryMuted>
          </Box>
        </Pressable>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: 'bold' }}>{String(count)}</Text>
      </Box>
      <Box style={{ height: 14, backgroundColor: c.bg, borderRadius: 3, overflow: 'hidden' }}>
        <Box style={{
          position: 'absolute', left: 0, top: 0,
          width: 200, height: 14,
          backgroundColor: C.emerald, borderRadius: 3, opacity: 0.85,
          transform: { translateX: Math.max(0, count) - 200 },
          transition: { all: { type: 'spring', stiffness: 200, damping: 15 } },
        }} />
      </Box>
    </>
  );
}

// ── Live Demo: Hover Cards (Lua transitions) ────────────

function HoverCard({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  return (
    <Pressable onPress={() => {}} onHoverIn={() => setH(true)} onHoverOut={() => setH(false)} onPressIn={() => setP(true)} onPressOut={() => setP(false)}>
      <Box style={{
        width: 90, height: 60, borderRadius: 8, borderWidth: 1,
        backgroundColor: h ? color : c.surface,
        borderColor: h ? color : c.border,
        justifyContent: 'center', alignItems: 'center',
        opacity: p ? 0.7 : 1,
        transform: { scaleX: p ? 0.93 : h ? 1.06 : 1, scaleY: p ? 0.93 : h ? 1.06 : 1 },
        shadowColor: h ? color : 'rgba(0,0,0,0)', shadowBlur: h ? 14 : 0, shadowOffsetY: h ? 3 : 0,
        transition: { all: { duration: 220, easing: 'easeOut' } },
      }}>
        <Text style={{ color: h ? '#fff' : c.text, fontSize: 10, fontWeight: 'bold', transition: { all: { duration: 220 } } }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

function TransitionDemo() {
  const c = useThemeColors();
  return (
    <>
      <S.StoryCap>{'Lua interpolates color, scale, shadow, opacity. Zero JS re-renders during animation.'}</S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <HoverCard label="Fire" color={C.fire} />
        <HoverCard label="Amber" color={C.amber} />
        <HoverCard label="Emerald" color={C.emerald} />
        <HoverCard label="Cyan" color={C.cyan} />
        <HoverCard label="Purple" color={C.accent} />
        <HoverCard label="Pink" color={C.pink} />
      </Box>
    </>
  );
}

// ── Live Demo: Keyframes ────────────────────────────────

function KeyframeDemo() {
  const c = useThemeColors();
  const [paused, setPaused] = useState(false);
  const ps = paused ? 'paused' : 'running';

  return (
    <>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <S.StoryCap>{'Lua-driven. Zero bridge traffic.'}</S.StoryCap>
        <Pressable onPress={() => setPaused(p => !p)}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, backgroundColor: paused ? C.fire : C.emerald, borderRadius: 3 }}>
            <Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{paused ? 'PAUSED' : 'PLAYING'}</Text>
          </Box>
        </Pressable>
      </Box>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {/* Spin */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 6, backgroundColor: C.accent,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { transform: { rotate: 0 } }, 100: { transform: { rotate: 360 } } }, duration: 2000, iterations: -1, easing: 'linear', playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Spin'}</S.StoryTiny>
        </Box>
        {/* Pulse */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: C.fire,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { transform: { scaleX: 1, scaleY: 1 }, opacity: 1 }, 50: { transform: { scaleX: 1.25, scaleY: 1.25 }, opacity: 0.6 }, 100: { transform: { scaleX: 1, scaleY: 1 }, opacity: 1 } }, duration: 1500, iterations: -1, easing: 'easeInOut', playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Pulse'}</S.StoryTiny>
        </Box>
        {/* Bounce */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 6, backgroundColor: C.emerald,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { transform: { translateY: 0 } }, 50: { transform: { translateY: -14 } }, 100: { transform: { translateY: 0 } } }, duration: 800, iterations: -1, easing: 'bounce', playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Bounce'}</S.StoryTiny>
        </Box>
        {/* Shake */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 6, backgroundColor: C.amber,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { transform: { translateX: 0 } }, 25: { transform: { translateX: -5 } }, 50: { transform: { translateX: 5 } }, 75: { transform: { translateX: -3 } }, 100: { transform: { translateX: 0 } } }, duration: 500, iterations: -1, playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Shake'}</S.StoryTiny>
        </Box>
        {/* Glow */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 6, backgroundColor: C.cyan,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { shadowBlur: 0, shadowColor: 'rgba(6,182,212,0)' }, 50: { shadowBlur: 16, shadowColor: 'rgba(6,182,212,0.6)' }, 100: { shadowBlur: 0, shadowColor: 'rgba(6,182,212,0)' } }, duration: 2000, iterations: -1, easing: 'easeInOut', playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Glow'}</S.StoryTiny>
        </Box>
        {/* Morph */}
        <Box style={{ alignItems: 'center', gap: 4 }}>
          <Box style={{
            width: 36, height: 36, borderRadius: 6,
            justifyContent: 'center', alignItems: 'center',
            animation: { keyframes: { 0: { backgroundColor: C.fire }, 100: { backgroundColor: C.cyan } }, duration: 1200, iterations: -1, direction: 'alternate', easing: 'easeInOut', playState: ps },
          }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{'\u2726'}</Text>
          </Box>
          <S.StoryTiny>{'Morph'}</S.StoryTiny>
        </Box>
      </Box>
    </>
  );
}

// ── Live Demo: Stroke Dashes ────────────────────────────

function StrokeDemo() {
  const c = useThemeColors();
  const [revealed, setRevealed] = useState(false);
  const perim = 600;

  return (
    <>
      <S.StoryCap>{'SVG-style strokeDasharray + strokeDashoffset. Native Lua path rendering.'}</S.StoryCap>

      {/* Marching ants */}
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Box style={{
          width: 90, height: 56, borderRadius: 8, borderWidth: 2, borderColor: C.accent,
          strokeDasharray: [8, 8], justifyContent: 'center', alignItems: 'center',
          animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: 16 } }, duration: 600, iterations: -1, easing: 'linear' },
        }}>
          <S.StoryTiny>{'selected'}</S.StoryTiny>
        </Box>
        <Box style={{
          width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.emerald,
          strokeDasharray: [6, 10], justifyContent: 'center', alignItems: 'center',
          animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: 16 } }, duration: 800, iterations: -1, easing: 'linear' },
        }}>
          <S.StoryTiny>{'orbit'}</S.StoryTiny>
        </Box>
        <Box style={{
          width: 56, height: 56, borderRadius: 10, borderWidth: 3, borderColor: C.amber,
          strokeDasharray: [4, 12], backgroundColor: 'rgba(245,158,11,0.06)',
          justifyContent: 'center', alignItems: 'center',
          animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: 16 } }, duration: 300, iterations: -1, easing: 'linear' },
        }}>
          <Text style={{ color: C.amber, fontSize: 8, fontWeight: 'bold' }}>{'LIVE'}</Text>
        </Box>
      </Box>

      {/* Spinners */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Box style={{
          width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: C.accent,
          strokeDasharray: [35, 100],
          animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: -135 } }, duration: 1200, iterations: -1, easing: 'linear' },
        }} />
        <Box style={{ width: 36, height: 36 }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0, width: 36, height: 36,
            borderRadius: 18, borderWidth: 2, borderColor: C.fire,
            strokeDasharray: [25, 88],
            animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: -113 } }, duration: 1000, iterations: -1, easing: 'linear' },
          }} />
          <Box style={{
            position: 'absolute', left: 6, top: 6, width: 24, height: 24,
            borderRadius: 12, borderWidth: 2, borderColor: C.amber,
            strokeDasharray: [16, 60],
            animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: 76 } }, duration: 1400, iterations: -1, easing: 'linear' },
          }} />
        </Box>
        <S.StoryTiny>{'spinners'}</S.StoryTiny>
      </Box>

      {/* Draw-on reveal */}
      <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Box style={{
          width: 140, height: 70, borderRadius: 10, borderWidth: 3, borderColor: C.cyan,
          strokeDasharray: [perim, perim], strokeDashoffset: revealed ? 0 : perim,
          justifyContent: 'center', alignItems: 'center',
          transition: { strokeDashoffset: { duration: 2000, easing: 'easeInOut' } },
        }}>
          <Text style={{ color: C.cyan, fontSize: 12, fontWeight: 'bold', opacity: revealed ? 1 : 0.15, transition: { all: { duration: 1500 } } }}>{'Revealed'}</Text>
        </Box>
        <Pressable onPress={() => setRevealed(v => !v)}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, backgroundColor: revealed ? C.fire : C.emerald, borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{revealed ? 'Reset' : 'Draw On'}</Text>
          </Box>
        </Pressable>
      </Box>
    </>
  );
}

// ── Live Demo: Easing Curves ────────────────────────────

function EasingBar({ label, easing, color }: { label: string; easing: any; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: c.muted, fontSize: 8, width: 80 }}>{label}</Text>
      <Box style={{ width: 140, height: 10, backgroundColor: c.bg, borderRadius: 3, overflow: 'hidden' }}>
        <Box style={{
          position: 'absolute', left: 0, top: 0,
          width: 140, height: 10, backgroundColor: color, borderRadius: 3, opacity: 0.85,
          animation: {
            keyframes: { 0: { transform: { translateX: -140 } }, 100: { transform: { translateX: 0 } } },
            duration: 2000, iterations: -1, direction: 'alternate', easing,
          },
        }} />
      </Box>
    </Box>
  );
}

function EasingDemo() {
  const c = useThemeColors();
  return (
    <>
      <S.StoryCap>{'Each bar shows 0\u21921 with a different easing. All loop every 2 seconds.'}</S.StoryCap>
      <Box style={{ gap: 4 }}>
        {EASING_LIST.map(e => <EasingBar key={e.label} label={e.label} easing={e.easing} color={e.color} />)}
      </Box>
    </>
  );
}

// ── Live Demo: Presets ──────────────────────────────────

function PresetDemo() {
  const c = useThemeColors();
  const { style: shakeStyle, shake } = useShake({ intensity: 10 });

  return (
    <>
      {/* Lua pulse — style.animation, zero re-renders */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={{
          width: 28, height: 28, borderRadius: 14, backgroundColor: C.fire,
          animation: { keyframes: { 0: { opacity: 0.3 }, 50: { opacity: 1 }, 100: { opacity: 0.3 } }, duration: 2000, iterations: -1, easing: 'easeInOut' },
        }} />
        <Box style={{
          width: 28, height: 28, borderRadius: 4, backgroundColor: C.cyan,
          animation: { keyframes: { 0: { transform: { scaleX: 0.5, scaleY: 0.5 } }, 50: { transform: { scaleX: 1, scaleY: 1 } }, 100: { transform: { scaleX: 0.5, scaleY: 0.5 } } }, duration: 2000, iterations: -1, easing: 'easeInOut' },
        }} />
        <S.StoryCap>{'Lua pulse (style.animation)'}</S.StoryCap>
      </Box>

      {/* useShake — keyframe animation, renders only on trigger */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={{ ...shakeStyle }}>
          <Pressable onPress={shake}>
            <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, backgroundColor: C.fire, borderRadius: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{'Shake me!'}</Text>
            </Box>
          </Pressable>
        </Box>
        <S.StoryTiny>{'useShake (keyframe animation)'}</S.StoryTiny>
      </Box>
    </>
  );
}

// ── Live Demo: Entrance Animation ───────────────────────

function EntranceItem({ text, delay, color }: { text: string; delay: number; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      ...entranceStyle({ delay, duration: 500 }),
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.bgElevated, borderRadius: 4, borderWidth: 1, borderColor: c.border,
      paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
    }}>
      <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <S.StoryBreadcrumbActive>{text}</S.StoryBreadcrumbActive>
    </Box>
  );
}

function EntranceDemo() {
  const c = useThemeColors();
  const [showList, setShowList] = useState(true);

  return (
    <>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <S.StoryCap>{'useEntrance: staggered fade + slide'}</S.StoryCap>
        <Pressable onPress={() => { setShowList(false); setTimeout(() => setShowList(true), 50); }}>
          <S.StoryChip>
            <Text style={{ color: c.text, fontSize: 8 }}>{'replay'}</Text>
          </S.StoryChip>
        </Pressable>
      </Box>
      {showList && (
        <Box style={{ gap: 4 }}>
          {ENTRANCE_ITEMS.map((item, i) => (
            <EntranceItem key={item.text} text={item.text} delay={i * 100} color={item.color} />
          ))}
        </Box>
      )}
    </>
  );
}

// ── Live Demo: Patterns ─────────────────────────────────

function AnimBtn({ label, color }: { label: string; color: string }) {
  const [p, setP] = useState(false);
  const [h, setH] = useState(false);
  return (
    <Pressable onPress={() => {}} onPressIn={() => setP(true)} onPressOut={() => setP(false)} onHoverIn={() => setH(true)} onHoverOut={() => setH(false)}>
      <Box style={{
        paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7,
        backgroundColor: p ? `${color}cc` : color, borderRadius: 6,
        transform: { scaleX: p ? 0.92 : h ? 1.04 : 1, scaleY: p ? 0.92 : h ? 1.04 : 1, translateY: p ? 1 : h ? -1 : 0 },
        shadowColor: color, shadowBlur: h ? 10 : 0, shadowOffsetY: p ? 0 : h ? 3 : 1,
        transition: { all: { duration: 120, easing: 'easeOut' } },
      }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

function Toggle() {
  const c = useThemeColors();
  const [on, setOn] = useState(false);
  return (
    <Pressable onPress={() => setOn(v => !v)}>
      <Box style={{
        width: 44, height: 24, borderRadius: 12, backgroundColor: on ? C.emerald : c.surface,
        borderWidth: 1, borderColor: on ? C.emerald : c.border,
        justifyContent: 'center', paddingLeft: 3, paddingRight: 3,
        transition: { all: { duration: 200, easing: 'easeInOut' } },
      }}>
        <Box style={{
          width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
          transform: { translateX: on ? 20 : 0 },
          shadowColor: 'rgba(0,0,0,0.2)', shadowBlur: 2, shadowOffsetY: 1,
          transition: { all: { duration: 200, easing: 'easeOut' } },
        }} />
      </Box>
    </Pressable>
  );
}

function PatternDemo() {
  const c = useThemeColors();

  return (
    <>
      {/* Buttons */}
      <S.StoryCap>{'Hover + press feedback with transitions.'}</S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <AnimBtn label="Primary" color={C.accent} />
        <AnimBtn label="Danger" color={C.fire} />
        <AnimBtn label="Success" color={C.emerald} />
      </Box>

      {/* Toggles */}
      <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Toggle /><Toggle /><Toggle />
        <S.StoryTiny>{'toggle switches'}</S.StoryTiny>
      </Box>

      {/* Loading dots */}
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <Box key={i} style={{
              width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent,
              animation: { keyframes: { 0: { opacity: 0.3, transform: { scaleX: 0.8, scaleY: 0.8 } }, 50: { opacity: 1, transform: { scaleX: 1.2, scaleY: 1.2 } }, 100: { opacity: 0.3, transform: { scaleX: 0.8, scaleY: 0.8 } } }, duration: 1200, iterations: -1, easing: 'easeInOut', delay: i * 200 },
            }} />
          ))}
        </Box>
        <S.StoryTiny>{'staggered loading dots'}</S.StoryTiny>
      </Box>

      {/* Skeleton shimmer */}
      <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Box style={{ width: 100, height: 8, borderRadius: 4, backgroundColor: c.surface, overflow: 'hidden' }}>
          <Box style={{
            width: '30%', height: 8, borderRadius: 4, backgroundColor: C.accent, opacity: 0.4,
            animation: { keyframes: { 0: { transform: { translateX: -35 } }, 100: { transform: { translateX: 100 } } }, duration: 1500, iterations: -1, easing: 'easeInOut' },
          }} />
        </Box>
        <S.StoryTiny>{'skeleton shimmer'}</S.StoryTiny>
      </Box>
    </>
  );
}

// ── Live Demo: Card Flip ────────────────────────────────

const FLIP_CARD_FACES = [
  { front: 'Ace', back: 'Spade', color: C.accent },
  { front: 'King', back: 'Heart', color: C.fire },
  { front: 'Queen', back: 'Diamond', color: C.amber },
];

function ClickFlipCard({ front, back, color }: { front: string; back: string; color: string }) {
  const c = useThemeColors();
  const [showBack, setShowBack] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const handleFlip = useCallback(() => {
    setFlipKey(k => k + 1);
    setTimeout(() => setShowBack(s => !s), 200);
  }, []);

  return (
    <Pressable onPress={handleFlip}>
      <Box style={{
        width: 90, height: 120, borderRadius: 10, borderWidth: 2,
        borderColor: color, backgroundColor: showBack ? color : c.bgElevated,
        justifyContent: 'center', alignItems: 'center', gap: 4,
        shadowColor: color, shadowBlur: 10, shadowOffsetY: 3,
        ...(flipKey > 0 ? {
          animation: {
            keyframes: {
              0: { transform: { scaleX: 1 } },
              50: { transform: { scaleX: 0.02 } },
              100: { transform: { scaleX: 1 } },
            },
            duration: 400, iterations: 1, fillMode: 'forwards',
            restart: flipKey,
          },
        } : {}),
      }}>
        <Text style={{ color: showBack ? '#fff' : c.text, fontSize: 22, fontWeight: 'bold' }}>
          {showBack ? back : front}
        </Text>
        <Text style={{ color: showBack ? 'rgba(255,255,255,0.6)' : c.muted, fontSize: 8 }}>
          {showBack ? 'back' : 'front'}
        </Text>
      </Box>
    </Pressable>
  );
}

function HoverFlipCard({ front, back, color }: { front: string; back: string; color: string }) {
  const c = useThemeColors();
  const [showBack, setShowBack] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const handleHoverIn = useCallback(() => {
    setFlipKey(k => k + 1);
    setTimeout(() => setShowBack(true), 200);
  }, []);

  const handleHoverOut = useCallback(() => {
    setFlipKey(k => k + 1);
    setTimeout(() => setShowBack(false), 200);
  }, []);

  return (
    <Pressable onPress={() => {}} onHoverIn={handleHoverIn} onHoverOut={handleHoverOut}>
      <Box style={{
        width: 90, height: 120, borderRadius: 10, borderWidth: 2,
        borderColor: color, backgroundColor: showBack ? color : c.bgElevated,
        justifyContent: 'center', alignItems: 'center', gap: 4,
        shadowColor: color, shadowBlur: 10, shadowOffsetY: 3,
        ...(flipKey > 0 ? {
          animation: {
            keyframes: {
              0: { transform: { scaleX: 1 } },
              50: { transform: { scaleX: 0.02 } },
              100: { transform: { scaleX: 1 } },
            },
            duration: 400, iterations: 1, fillMode: 'forwards',
            restart: flipKey,
          },
        } : {}),
      }}>
        <Text style={{ color: showBack ? '#fff' : c.text, fontSize: 22, fontWeight: 'bold' }}>
          {showBack ? back : front}
        </Text>
        <Text style={{ color: showBack ? 'rgba(255,255,255,0.6)' : c.muted, fontSize: 8 }}>
          {showBack ? 'back' : 'front'}
        </Text>
      </Box>
    </Pressable>
  );
}

function CardFlipDemo() {
  const c = useThemeColors();

  return (
    <>
      {/* Click to flip */}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>{'Click to flip'}</Text>
      <S.StoryCap>{'Tap a card. Spring physics drives scaleX through cos(\u03C0) for a smooth 3D illusion. Tap again to flip back.'}</S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {FLIP_CARD_FACES.map(f => (
          <ClickFlipCard key={f.front} front={f.front} back={f.back} color={f.color} />
        ))}
      </Box>

      {/* Hover to flip */}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold', marginTop: 8 }}>{'Hover to flip'}</Text>
      <S.StoryCap>{'No click needed. Hover in to flip, hover out to reverse.'}</S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {FLIP_CARD_FACES.map(f => (
          <HoverFlipCard key={f.front} front={f.front} back={f.back} color={f.color} />
        ))}
      </Box>
    </>
  );
}

// ── Live Demo: Shatter Button ───────────────────────────

function srand(s: number) {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
}

const SH_W = 160;
const SH_H = 40;
const SH_BS = 20;
const SH_COLS = SH_W / SH_BS;
const SH_ROWS = SH_H / SH_BS;

interface SBlock {
  hx: number; hy: number;
  sx: number; sy: number;
  sr: number;
  d: number;
}

const SBLOCKS: SBlock[] = (() => {
  const out: SBlock[] = [];
  for (let r = 0; r < SH_ROWS; r++) {
    for (let c = 0; c < SH_COLS; c++) {
      const i = r * SH_COLS + c;
      const hx = c * SH_BS;
      const hy = r * SH_BS;
      const dx = (hx + SH_BS / 2 - SH_W / 2) / (SH_W / 2);
      out.push({
        hx, hy,
        sx: hx + dx * (40 + srand(i * 3 + 1) * 60),
        sy: hy + 30 + srand(i * 3 + 2) * 70,
        sr: (srand(i * 3 + 3) - 0.5) * 400,
        d: 0.02 + srand(i * 7) * 0.13,
      });
    }
  }
  return out;
})();

function ShatterButton({ label, baseColor, hueBase }: { label: string; baseColor: string; hueBase: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setActive(false), 1400);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: SH_W, height: SH_H + 110 }}>
        <Pressable onPress={() => { if (!active) setActive(true); }}>
          <Box style={{ width: SH_W, height: SH_H }}>
            {!active && (
              <Box style={{
                width: SH_W, height: SH_H, backgroundColor: baseColor,
                borderRadius: 8, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{label}</Text>
              </Box>
            )}
            {active && SBLOCKS.map((b, i) => (
              <Box key={i} style={{
                position: 'absolute', left: b.hx, top: b.hy,
                width: SH_BS - 1, height: SH_BS - 1,
                backgroundColor: `hsl(${hueBase + (i / SBLOCKS.length) * 30}, 70%, 55%)`,
                borderRadius: 1,
                animation: {
                  keyframes: {
                    0: { transform: { translateX: 0, translateY: 0, rotate: 0 }, opacity: 1 },
                    50: { transform: { translateX: b.sx - b.hx, translateY: b.sy - b.hy, rotate: b.sr }, opacity: 0.8 },
                    100: { transform: { translateX: 0, translateY: 0, rotate: 0 }, opacity: 1 },
                  },
                  duration: 1200, delay: b.d * 400,
                  easing: 'bounce', iterations: 1, fillMode: 'forwards',
                },
              }} />
            ))}
          </Box>
        </Pressable>
      </Box>
      <S.StoryTiny>{active ? 'rebuilding...' : 'click me'}</S.StoryTiny>
    </Box>
  );
}

function ShatterDemo() {
  const c = useThemeColors();
  return (
    <>
      <S.StoryCap>
        {'16 blocks per button. Spring overshoot = bounce on collapse, snap on rebuild. Per-block stagger delay creates crack propagation.'}
      </S.StoryCap>
      <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <ShatterButton label="Shatter Me" baseColor={C.accent} hueBase={258} />
        <ShatterButton label="Break Apart" baseColor={C.fire} hueBase={0} />
        <ShatterButton label="Explode" baseColor={C.emerald} hueBase={150} />
      </Box>
    </>
  );
}

// ── Live Demo: Premium Effects ──────────────────────────

// -- Shimmer --

function ShimmerBox({ width, height, color, label }: { width: number; height: number; color: string; label: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{
        width, height, borderRadius: 8, backgroundColor: color,
        overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
      }}>
        <Box style={{
          position: 'absolute', left: 0, top: 0,
          width: width * 0.35, height: height * 2,
          backgroundGradient: { direction: 'diagonal', colors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.25)'] },
          animation: { keyframes: { 0: { transform: { translateX: -width * 0.5 } }, 100: { transform: { translateX: width * 1.3 } } }, duration: 2200, iterations: -1, easing: 'easeInOut' },
        }} />
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
      </Box>
      <Text style={{ color: c.muted, fontSize: 7 }}>{'shimmer'}</Text>
    </Box>
  );
}

// -- Ripple --

interface RippleState { x: number; y: number; id: number }

function RippleButton({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  const layoutRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const idRef = useRef(0);

  const handleLayout = useCallback((e: any) => {
    layoutRef.current = { x: e.x, y: e.y, w: e.width, h: e.height };
  }, []);

  const handleClick = useCallback((e: any) => {
    const lx = (e.x || 0) - layoutRef.current.x;
    const ly = (e.y || 0) - layoutRef.current.y;
    const id = ++idRef.current;
    setRipples(prev => [...prev, { x: lx, y: ly, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);
  }, []);

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Box
        onLayout={handleLayout}
        onClick={handleClick}
        style={{
          width: 120, height: 44, borderRadius: 8, backgroundColor: color,
          overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
        {ripples.map(r => (
          <RippleCircle key={r.id} x={r.x} y={r.y} />
        ))}
      </Box>
      <Text style={{ color: c.muted, fontSize: 7 }}>{'ripple'}</Text>
    </Box>
  );
}

function RippleCircle({ x, y }: { x: number; y: number }) {
  return (
    <Box style={{
      position: 'absolute',
      left: x - 60, top: y - 60,
      width: 120, height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.35)',
      animation: {
        keyframes: {
          0: { transform: { scaleX: 0.01, scaleY: 0.01 }, opacity: 1 },
          100: { transform: { scaleX: 1, scaleY: 1 }, opacity: 0 },
        },
        duration: 600, iterations: 1, fillMode: 'forwards', easing: 'easeOut',
      },
    }} />
  );
}

// -- Rubber Band --

function RubberBandButton({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  const [pressed, setP] = useState(false);

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPressIn={() => setP(true)} onPressOut={() => setP(false)} onPress={() => {}}>
        <Box style={{
          width: 120, height: 44, borderRadius: 8, backgroundColor: color,
          justifyContent: 'center', alignItems: 'center',
          transform: { scaleX: pressed ? 0.85 : 1, scaleY: pressed ? 1.08 : 1 },
          shadowColor: color, shadowBlur: pressed ? 0 : 8, shadowOffsetY: pressed ? 0 : 3,
          transition: { all: { type: 'spring', stiffness: 400, damping: 6 } },
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      </Pressable>
      <Text style={{ color: c.muted, fontSize: 7 }}>{'rubber band'}</Text>
    </Box>
  );
}

// -- Confetti Burst --

const CONFETTI_COLORS = [C.fire, C.amber, C.emerald, C.cyan, C.pink, C.accent, C.blue, '#fff'];

interface Particle { x: number; y: number; vx: number; vy: number; rot: number; size: number; color: string }

function makeConfetti(): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2 + srand(i * 13) * 0.5;
    const speed = 30 + srand(i * 17) * 80;
    out.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      rot: (srand(i * 23) - 0.5) * 720,
      size: 3 + srand(i * 31) * 5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }
  return out;
}

const CONFETTI_PARTICLES = makeConfetti();

function ConfettiButton() {
  const c = useThemeColors();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setActive(false), 1800);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 140, height: 120 }}>
        <Pressable onPress={() => { if (!active) setActive(true); }}>
          <Box style={{
            width: 140, height: 44, borderRadius: 8,
            backgroundColor: active ? `${C.accent}88` : C.accent,
            justifyContent: 'center', alignItems: 'center',
            transform: { scaleX: active ? 0.95 : 1, scaleY: active ? 0.95 : 1 },
            transition: { all: { duration: 150 } },
          }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
              {active ? 'Celebrating!' : 'Confetti'}
            </Text>
          </Box>
        </Pressable>
        {active && CONFETTI_PARTICLES.map((p, i) => {
          const gravity = 60;
          return (
            <Box key={i} style={{
              position: 'absolute',
              left: 70 - p.size / 2, top: 22 - p.size / 2,
              width: p.size, height: p.size,
              borderRadius: srand(i * 41) > 0.5 ? p.size / 2 : 1,
              backgroundColor: p.color,
              animation: {
                keyframes: {
                  0: { opacity: 1, transform: { translateX: 0, translateY: 0, rotate: 0 } },
                  50: { opacity: 0.8, transform: { translateX: p.vx * 0.5, translateY: p.vy * 0.5 + gravity * 0.25, rotate: p.rot * 0.5 } },
                  100: { opacity: 0, transform: { translateX: p.vx, translateY: p.vy + gravity, rotate: p.rot } },
                },
                duration: 1200, iterations: 1, easing: 'easeOut', fillMode: 'forwards',
              },
            }} />
          );
        })}
      </Box>
      <Text style={{ color: c.muted, fontSize: 7 }}>{'confetti'}</Text>
    </Box>
  );
}

// -- Skeleton Pulse --

function SkeletonDemo() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {/* Avatar skeleton */}
        <Box style={{
          width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, overflow: 'hidden',
        }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0, width: 20, height: 40,
            backgroundGradient: { direction: 'diagonal', colors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'] },
            animation: { keyframes: { 0: { transform: { translateX: -20 } }, 100: { transform: { translateX: 40 } } }, duration: 1800, iterations: -1, easing: 'easeInOut' },
          }} />
        </Box>
        <Box style={{ gap: 4, flexGrow: 1 }}>
          {/* Name skeleton */}
          <Box style={{
            width: 80, height: 8, borderRadius: 4, backgroundColor: c.surface, overflow: 'hidden',
          }}>
            <Box style={{
              position: 'absolute', left: 0, top: 0, width: 30, height: 10,
              backgroundGradient: { direction: 'diagonal', colors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'] },
              animation: { keyframes: { 0: { transform: { translateX: -30 } }, 100: { transform: { translateX: 90 } } }, duration: 1800, iterations: -1, easing: 'easeInOut', delay: 100 },
            }} />
          </Box>
          {/* Subtitle skeleton */}
          <Box style={{
            width: 120, height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: 'hidden',
          }}>
            <Box style={{
              position: 'absolute', left: 0, top: 0, width: 40, height: 8,
              backgroundGradient: { direction: 'diagonal', colors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'] },
              animation: { keyframes: { 0: { transform: { translateX: -40 } }, 100: { transform: { translateX: 130 } } }, duration: 1800, iterations: -1, easing: 'easeInOut', delay: 200 },
            }} />
          </Box>
        </Box>
      </Box>
      {/* Content lines */}
      {[100, 140, 110].map((w, i) => (
        <Box key={i} style={{
          width: w, height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: 'hidden',
        }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0, width: w * 0.3, height: 8,
            backgroundGradient: { direction: 'diagonal', colors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'] },
            animation: { keyframes: { 0: { transform: { translateX: -w * 0.4 } }, 100: { transform: { translateX: w * 1.1 } } }, duration: 1800, iterations: -1, easing: 'easeInOut', delay: 300 + i * 100 },
          }} />
        </Box>
      ))}
    </Box>
  );
}

// -- Tilt Card --

function TiltCard({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const layoutRef = useRef({ x: 0, y: 0, w: 100, h: 60 });

  const handleLayout = useCallback((e: any) => {
    layoutRef.current = { x: e.x, y: e.y, w: e.width, h: e.height };
  }, []);

  const handleEnter = useCallback((e: any) => {
    const l = layoutRef.current;
    const rx = ((e.x || 0) - l.x) / l.w - 0.5;
    const ry = ((e.y || 0) - l.y) / l.h - 0.5;
    setHoverPos({ x: rx, y: ry });
  }, []);

  const handleLeave = useCallback(() => {
    setHoverPos(null);
  }, []);

  const skX = hoverPos ? hoverPos.y * -8 : 0;
  const skY = hoverPos ? hoverPos.x * 8 : 0;
  const hovered = hoverPos !== null;

  return (
    <Box style={{ alignItems: 'center', gap: 4 }}>
      <Box
        onLayout={handleLayout}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        style={{
          width: 100, height: 60, borderRadius: 8, backgroundColor: color,
          justifyContent: 'center', alignItems: 'center',
          transform: { skewX: skX, skewY: skY },
          shadowColor: color, shadowBlur: hovered ? 16 : 4, shadowOffsetY: hovered ? 6 : 2,
          transition: { all: { type: 'spring', stiffness: 200, damping: 14 } },
        }}
      >
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
      </Box>
      <Text style={{ color: c.muted, fontSize: 7 }}>{'tilt'}</Text>
    </Box>
  );
}

// -- Effects Demo --

function EffectsDemo() {
  const c = useThemeColors();
  return (
    <>
      {/* Row 1: Shimmer + Skeleton */}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>{'Shimmer + Skeleton'}</Text>
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ShimmerBox width={100} height={44} color={C.accent} label="Premium" />
        <ShimmerBox width={100} height={44} color={C.fire} label="Upgrade" />
        <SkeletonDemo />
      </Box>

      {/* Row 2: Ripple + Rubber Band */}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold', marginTop: 8 }}>{'Ripple + Rubber Band'}</Text>
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <RippleButton label="Tap for ripple" color={C.blue} />
        <RippleButton label="Material ink" color={C.emerald} />
        <RubberBandButton label="Press me" color={C.amber} />
      </Box>

      {/* Row 3: Confetti + Tilt */}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold', marginTop: 8 }}>{'Confetti + Tilt'}</Text>
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ConfettiButton />
        <Box style={{ gap: 8 }}>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <TiltCard label="Hover" color={C.cyan} />
            <TiltCard label="Tilt" color={C.pink} />
          </Box>
          <S.StoryTiny>{'skewX/skewY from entry point'}</S.StoryTiny>
        </Box>
      </Box>
    </>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureList() {
  const c = useThemeColors();
  return (
    <>
      {FEATURE_CATALOG.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 9, color: c.text, fontWeight: 'bold', width: 120 }}>{f.label}</Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </Box>
      ))}
    </>
  );
}

// ── AnimationStory ──────────────────────────────────────

export function AnimationStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Box style={{
          animation: { keyframes: { 0: { transform: { rotate: 0 } }, 100: { transform: { rotate: 360 } } }, duration: 8000, iterations: -1, easing: 'linear' },
        }}>
          <Image src="activity" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        </Box>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Animation'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
          borderWidth: 1,
          borderColor: C.accent,
          strokeDasharray: [5, 5],
          animation: { keyframes: { 0: { strokeDashoffset: 0 }, 100: { strokeDashoffset: 10 } }, duration: 1200, iterations: -1, easing: 'linear' },
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'springs \u00B7 transitions \u00B7 keyframes \u00B7 effects'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Make everything feel alive.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Two animation engines: JS-driven springs and timing for React state, Lua-driven transitions and keyframes for zero-bridge visual polish. Plus SVG-style stroke dash animations, 8 easing curves, 7 preset hooks, and composable sequence/parallel/stagger/loop combinators.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Everything lives in @reactjit/core. No extra packages needed.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — SPRINGS (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={SPRING_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.fire}>{'SPRINGS'}</SectionLabel>
            <SpringDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | code — SPRING COUNTER ── */}
        <Band>
          <Half>
            <SectionLabel icon="hash" accentColor={C.emerald}>{'SPRING COUNTER'}</SectionLabel>
            <SpringCounterDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={SPRING_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — TRANSITIONS (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={TRANSITION_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="sliders" accentColor={C.accent}>{'LUA TRANSITIONS'}</SectionLabel>
            <TransitionDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Lua transitions and keyframes run entirely in the Lua run loop. React never re-renders during these animations. Visual-only properties (opacity, color, transform, shadow, strokeDash*) skip relayout for maximum performance.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── demo | code — KEYFRAMES ── */}
        <Band>
          <Half>
            <SectionLabel icon="repeat" accentColor={C.cyan}>{'KEYFRAMES'}</SectionLabel>
            <KeyframeDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={KEYFRAME_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — STROKES (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={STROKE_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="pen-tool" accentColor={C.pink}>{'STROKE DASHES'}</SectionLabel>
            <StrokeDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | code — EASINGS ── */}
        <Band>
          <Half>
            <SectionLabel icon="trending-up" accentColor={C.amber}>{'EASING CURVES'}</SectionLabel>
            <EasingDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={EASING_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — PRESETS (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={PRESET_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="package" accentColor={C.accent}>{'PRESET HOOKS'}</SectionLabel>
            <PresetDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | code — ENTRANCE ── */}
        <Band>
          <Half>
            <SectionLabel icon="log-in" accentColor={C.emerald}>{'ENTRANCE ANIMATION'}</SectionLabel>
            <EntranceDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={PRESET_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — PATTERNS (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={PATTERN_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.blue}>{'REAL-WORLD PATTERNS'}</SectionLabel>
            <PatternDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | code — CARD FLIP ── */}
        <Band>
          <Half>
            <SectionLabel icon="refresh-cw" accentColor={C.accent}>{'CARD FLIP'}</SectionLabel>
            <CardFlipDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={CARD_FLIP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── code | demo — SHATTER BUTTON (zigzag) ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={SHATTER_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="zap-off" accentColor={C.fire}>{'SHATTER BUTTON'}</SectionLabel>
            <ShatterDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── demo | code — PREMIUM EFFECTS ── */}
        <Band>
          <Half>
            <SectionLabel icon="star" accentColor={C.cyan}>{'PREMIUM EFFECTS'}</SectionLabel>
            <EffectsDemo />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={EFFECTS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Feature Catalog ── */}
        <Band>
          <Half>
            <SectionLabel icon="list" accentColor={C.accent}>{'FEATURE CATALOG'}</SectionLabel>
            <Text style={{ color: c.muted, fontSize: 9 }}>{'Everything the animation system provides at a glance.'}</Text>
          </Half>
          <Half>
            <FeatureList />
          </Half>
        </Band>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="activity" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Animation'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Box style={{
          width: 5, height: 5, borderRadius: 3, backgroundColor: C.emerald,
          animation: { keyframes: { 0: { opacity: 1 }, 50: { opacity: 0.3 }, 100: { opacity: 1 } }, duration: 2000, iterations: -1 },
        }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </S.StoryRoot>
  );
}
