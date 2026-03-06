/**
 * Animation — full showcase of the ReactJIT animation system.
 *
 * Tabs: Springs | Transitions | Keyframes | Easings | Presets | Patterns
 *
 * Demonstrates both JS-driven animations (useSpring, useAnimation, presets)
 * and Lua-driven animations (style.transition, style.animation keyframes).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, CodeBlock,
  useAnimation, useSpring, useTransition, Easing,
  parallel, sequence, stagger, loop,
  usePulse, useCountUp, useTypewriter, useShake, useEntrance, useBounce, useRepeat,
  type EasingFunction,
} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const A = {
  accent: '#6d28d9',
  accentBright: '#8b5cf6',
  accentDim: 'rgba(109, 40, 217, 0.15)',
  selected: 'rgba(139, 92, 246, 0.22)',
  fire: '#ef4444',
  amber: '#f59e0b',
  emerald: '#10b981',
  cyan: '#06b6d4',
  pink: '#ec4899',
  blue: '#3b82f6',
};

// ── Tab definitions ──────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'springs', label: 'Springs', icon: 'zap' },
  { id: 'transitions', label: 'Transitions', icon: 'sliders' },
  { id: 'keyframes', label: 'Keyframes', icon: 'repeat' },
  { id: 'easings', label: 'Easings', icon: 'trending-up' },
  { id: 'presets', label: 'Presets', icon: 'package' },
  { id: 'patterns', label: 'Patterns', icon: 'layers' },
];

// ═══════════════════════════════════════════════════════════
// Tab: Springs
// ═══════════════════════════════════════════════════════════

function SpringsTab() {
  const c = useThemeColors();
  const [target, setTarget] = useState(0);
  const [springConfig, setSpringConfig] = useState({ stiffness: 180, damping: 12 });

  // Three springs with different configs
  const stiff = useSpring(target, { stiffness: 300, damping: 20 });
  const bouncy = useSpring(target, { stiffness: 120, damping: 8 });
  const sloppy = useSpring(target, { stiffness: 80, damping: 5 });
  const custom = useSpring(target, springConfig);

  const targets = [0, 100, 200, 50, 150];
  const [targetIdx, setTargetIdx] = useState(0);

  const nextTarget = useCallback(() => {
    const next = (targetIdx + 1) % targets.length;
    setTargetIdx(next);
    setTarget(targets[next]);
  }, [targetIdx]);

  // Spring-animated counter
  const [count, setCount] = useState(0);
  const springCount = useSpring(count, { stiffness: 200, damping: 15 });

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 20 }}>

        {/* Spring comparison */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Spring Physics Comparison'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Same target value, different spring configs. Click to animate.'}</Text>

          <Pressable onPress={nextTarget}>
            <Box style={{
              backgroundColor: A.accentDim, borderRadius: 8, padding: 12,
              borderWidth: 1, borderColor: A.accent,
              alignItems: 'center',
            }}>
              <Text style={{ color: A.accentBright, fontSize: 11 }}>{`Tap to animate (target: ${targets[targetIdx]})`}</Text>
            </Box>
          </Pressable>

          {[
            { label: 'Stiff (300/20)', value: stiff, color: A.fire },
            { label: 'Bouncy (120/8)', value: bouncy, color: A.amber },
            { label: 'Sloppy (80/5)', value: sloppy, color: A.emerald },
            { label: 'Custom', value: custom, color: A.cyan },
          ].map(s => (
            <Box key={s.label} style={{ gap: 2 }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: s.color, fontSize: 9, width: 100 }}>{s.label}</Text>
                <Text style={{ color: c.muted, fontSize: 9, width: 40 }}>{Math.round(s.value)}</Text>
              </Box>
              <Box style={{
                height: 24, backgroundColor: c.surface, borderRadius: 4, overflow: 'hidden',
              }}>
                <Box style={{
                  position: 'absolute', left: 0, top: 0,
                  width: Math.max(4, s.value), height: 24,
                  backgroundColor: s.color, borderRadius: 4,
                  opacity: 0.8,
                }} />
              </Box>
            </Box>
          ))}
        </Box>

        {/* Spring config tuner */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Custom Spring Tuner'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { label: 'Stiffness', key: 'stiffness' as const, min: 20, max: 500 },
              { label: 'Damping', key: 'damping' as const, min: 1, max: 40 },
            ].map(param => (
              <Box key={param.key} style={{ flexGrow: 1, gap: 4 }}>
                <Text style={{ color: c.muted, fontSize: 9 }}>
                  {`${param.label}: ${springConfig[param.key]}`}
                </Text>
                <Box style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable onPress={() => setSpringConfig(p => ({
                    ...p, [param.key]: Math.max(param.min, p[param.key] - 10),
                  }))}>
                    <Box style={{
                      width: 24, height: 24, borderRadius: 4,
                      backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ color: c.text, fontSize: 12 }}>{'\u2212'}</Text>
                    </Box>
                  </Pressable>
                  <Box style={{
                    flexGrow: 1, height: 24, backgroundColor: c.surface, borderRadius: 4,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Box style={{
                      width: `${((springConfig[param.key] - param.min) / (param.max - param.min)) * 100}%`,
                      height: 4, backgroundColor: A.cyan, borderRadius: 2,
                      position: 'absolute', left: 4, top: 10,
                    }} />
                  </Box>
                  <Pressable onPress={() => setSpringConfig(p => ({
                    ...p, [param.key]: Math.min(param.max, p[param.key] + 10),
                  }))}>
                    <Box style={{
                      width: 24, height: 24, borderRadius: 4,
                      backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ color: c.text, fontSize: 12 }}>{'+'}</Text>
                    </Box>
                  </Pressable>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bouncy counter */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Spring Counter'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Pressable onPress={() => setCount(n => n + 100)}>
              <Box style={{
                paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
                backgroundColor: A.emerald, borderRadius: 6,
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{'+100'}</Text>
              </Box>
            </Pressable>
            <Pressable onPress={() => setCount(n => n - 100)}>
              <Box style={{
                paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
                backgroundColor: A.fire, borderRadius: 6,
              }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{'\u2212100'}</Text>
              </Box>
            </Pressable>
            <Text style={{ color: c.text, fontSize: 32, fontWeight: 'bold' }}>
              {String(Math.round(springCount))}
            </Text>
          </Box>
        </Box>

        <CodeBlock language="tsx" fontSize={9} code={`// Spring to target automatically
const smoothValue = useSpring(target, {
  stiffness: 180,  // higher = snappier
  damping: 12,     // lower = bouncier
});

// useSpring re-renders each frame during animation.
// Value settles naturally — no duration to tune.`} />

      </Box>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Transitions (Lua-driven, zero React re-renders)
// ═══════════════════════════════════════════════════════════

function TransitionCard({ label, color, idx }: { label: string; color: string; idx: number }) {
  const c = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Box style={{
        width: 120, height: 80,
        backgroundColor: hovered ? color : c.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: hovered ? color : c.border,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
        transform: {
          scaleX: pressed ? 0.95 : hovered ? 1.05 : 1,
          scaleY: pressed ? 0.95 : hovered ? 1.05 : 1,
        },
        shadowColor: hovered ? color : 'rgba(0,0,0,0)',
        shadowBlur: hovered ? 16 : 0,
        shadowOffsetY: hovered ? 4 : 0,
        // Lua interpolates all these properties smoothly
        transition: {
          all: { duration: 250, easing: 'easeOut' },
        },
      }}>
        <Text style={{
          color: hovered ? '#fff' : c.text,
          fontSize: 11, fontWeight: 'bold',
          transition: { all: { duration: 250 } },
        }}>
          {label}
        </Text>
        <Text style={{
          color: hovered ? 'rgba(255,255,255,0.7)' : c.muted,
          fontSize: 8, marginTop: 4,
          transition: { all: { duration: 250 } },
        }}>
          {'hover me'}
        </Text>
      </Box>
    </Pressable>
  );
}

function TransitionsTab() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [progressValue, setProgressValue] = useState(20);
  const [colorIdx, setColorIdx] = useState(0);
  const colorCycle = [A.fire, A.amber, A.emerald, A.cyan, A.accentBright, A.pink];

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 20 }}>

        {/* Hover cards */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Hover Transitions'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Lua interpolates color, scale, shadow, opacity — zero JS re-renders during animation.'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Fire', color: A.fire },
              { label: 'Amber', color: A.amber },
              { label: 'Emerald', color: A.emerald },
              { label: 'Cyan', color: A.cyan },
              { label: 'Purple', color: A.accentBright },
              { label: 'Pink', color: A.pink },
            ].map((card, i) => (
              <TransitionCard key={card.label} label={card.label} color={card.color} idx={i} />
            ))}
          </Box>
        </Box>

        {/* Animated progress bar */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Transition Progress Bar'}</Text>
          <Box style={{
            height: 24, backgroundColor: c.surface, borderRadius: 12, overflow: 'hidden',
          }}>
            <Box style={{
              width: `${progressValue}%`, height: 24,
              backgroundColor: A.accentBright, borderRadius: 12,
              transition: { all: { duration: 600, easing: 'easeInOut' } },
            }} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            {[20, 45, 70, 100].map(v => (
              <Pressable key={v} onPress={() => setProgressValue(v)}>
                <Box style={{
                  paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                  backgroundColor: progressValue === v ? A.accentDim : c.surface,
                  borderRadius: 4, borderWidth: 1,
                  borderColor: progressValue === v ? A.accent : c.border,
                }}>
                  <Text style={{ color: progressValue === v ? A.accentBright : c.muted, fontSize: 10 }}>
                    {`${v}%`}
                  </Text>
                </Box>
              </Pressable>
            ))}
          </Box>
        </Box>

        {/* Color cycling */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Color Transitions'}</Text>
          <Pressable onPress={() => setColorIdx(i => (i + 1) % colorCycle.length)}>
            <Box style={{
              height: 60, borderRadius: 10,
              backgroundColor: colorCycle[colorIdx],
              justifyContent: 'center', alignItems: 'center',
              transition: { all: { duration: 500, easing: 'easeInOut' } },
            }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                {'Tap to cycle colors'}
              </Text>
            </Box>
          </Pressable>
        </Box>

        {/* Expand/collapse */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Layout Transition'}</Text>
          <Pressable onPress={() => setExpanded(e => !e)}>
            <Box style={{
              height: expanded ? 120 : 40,
              backgroundColor: c.bgElevated, borderRadius: 8,
              borderWidth: 1, borderColor: c.border,
              overflow: 'hidden',
              padding: 12, gap: 8,
              transition: { all: { duration: 300, easing: 'easeInOut' } },
            }}>
              <Text style={{ color: c.text, fontSize: 11 }}>
                {expanded ? '\u25B2 Collapse' : '\u25BC Expand'}
              </Text>
              {expanded && (
                <Text style={{ color: c.muted, fontSize: 10 }}>
                  {'The height transition is driven by Lua. Layout-affecting properties trigger relayout each frame during the transition, but visual-only properties (opacity, color, transform) skip relayout entirely.'}
                </Text>
              )}
            </Box>
          </Pressable>
        </Box>

        <CodeBlock language="tsx" fontSize={9} code={`// Lua-driven transitions — declare in style, Lua interpolates
<Box style={{
  backgroundColor: hovered ? '#8b5cf6' : '#1e1e2e',
  transform: { scaleX: pressed ? 0.95 : 1, scaleY: pressed ? 0.95 : 1 },
  shadowBlur: hovered ? 16 : 0,
  transition: { all: { duration: 250, easing: 'easeOut' } },
}} />`} />

      </Box>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Keyframes (Lua-driven looping animations)
// ═══════════════════════════════════════════════════════════

function KeyframesTab() {
  const c = useThemeColors();
  const [paused, setPaused] = useState(false);

  const demos: { label: string; desc: string; style: any; code: string }[] = [
    {
      label: 'Spin',
      desc: 'Continuous rotation',
      style: {
        width: 48, height: 48, borderRadius: 8,
        backgroundColor: A.accentBright, justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { transform: { rotate: 0 } },
            100: { transform: { rotate: 360 } },
          },
          duration: 2000, iterations: -1, easing: 'linear',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'animation: { keyframes: { 0: { transform: { rotate: 0 } }, 100: { transform: { rotate: 360 } } }, duration: 2000, iterations: -1 }',
    },
    {
      label: 'Pulse',
      desc: 'Scale breathing',
      style: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: A.fire, justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { transform: { scaleX: 1, scaleY: 1 }, opacity: 1 },
            50: { transform: { scaleX: 1.2, scaleY: 1.2 }, opacity: 0.7 },
            100: { transform: { scaleX: 1, scaleY: 1 }, opacity: 1 },
          },
          duration: 1500, iterations: -1, easing: 'easeInOut',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'keyframes: { 0: { scaleX: 1 }, 50: { scaleX: 1.2 }, 100: { scaleX: 1 } }',
    },
    {
      label: 'Bounce',
      desc: 'Vertical bounce',
      style: {
        width: 48, height: 48, borderRadius: 8,
        backgroundColor: A.emerald, justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { transform: { translateY: 0 } },
            50: { transform: { translateY: -20 } },
            100: { transform: { translateY: 0 } },
          },
          duration: 800, iterations: -1, easing: 'bounce',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'easing: "bounce", keyframes: { 0: { translateY: 0 }, 50: { translateY: -20 } }',
    },
    {
      label: 'Shake',
      desc: 'Horizontal jitter',
      style: {
        width: 48, height: 48, borderRadius: 8,
        backgroundColor: A.amber, justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { transform: { translateX: 0 } },
            25: { transform: { translateX: -6 } },
            50: { transform: { translateX: 6 } },
            75: { transform: { translateX: -3 } },
            100: { transform: { translateX: 0 } },
          },
          duration: 500, iterations: -1, direction: 'normal',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'keyframes: { 0: { translateX: 0 }, 25: { translateX: -6 }, 75: { translateX: -3 } }',
    },
    {
      label: 'Glow',
      desc: 'Shadow pulse',
      style: {
        width: 48, height: 48, borderRadius: 8,
        backgroundColor: A.cyan, justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { shadowBlur: 0, shadowColor: 'rgba(6,182,212,0)' },
            50: { shadowBlur: 20, shadowColor: 'rgba(6,182,212,0.6)' },
            100: { shadowBlur: 0, shadowColor: 'rgba(6,182,212,0)' },
          },
          duration: 2000, iterations: -1, easing: 'easeInOut',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'keyframes: { 0: { shadowBlur: 0 }, 50: { shadowBlur: 20, shadowColor: "cyan" } }',
    },
    {
      label: 'Alternate',
      desc: 'Ping-pong color',
      style: {
        width: 48, height: 48, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
        animation: {
          keyframes: {
            0: { backgroundColor: A.fire },
            100: { backgroundColor: A.cyan },
          },
          duration: 1200, iterations: -1, direction: 'alternate', easing: 'easeInOut',
          playState: paused ? 'paused' : 'running',
        },
      },
      code: 'direction: "alternate", keyframes: { 0: { bg: red }, 100: { bg: cyan } }',
    },
  ];

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 16 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Keyframe Animations'}</Text>
          <Pressable onPress={() => setPaused(p => !p)}>
            <Box style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              backgroundColor: paused ? A.fire : A.emerald, borderRadius: 4,
            }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>
                {paused ? 'PAUSED' : 'PLAYING'}
              </Text>
            </Box>
          </Pressable>
        </Box>
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Lua-driven keyframe animations. Zero bridge traffic. Supports iterations, direction, fillMode, easing, delay.'}
        </Text>

        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {demos.map(demo => (
            <Box key={demo.label} style={{
              width: 160, backgroundColor: c.bgElevated, borderRadius: 10,
              borderWidth: 1, borderColor: c.border, padding: 12, gap: 8,
              alignItems: 'center',
            }}>
              <Box style={demo.style}>
                <Text style={{ color: '#fff', fontSize: 16 }}>{'\u2726'}</Text>
              </Box>
              <Text style={{ color: c.text, fontSize: 11, fontWeight: 'bold' }}>{demo.label}</Text>
              <Text style={{ color: c.muted, fontSize: 9 }}>{demo.desc}</Text>
            </Box>
          ))}
        </Box>

        <CodeBlock language="tsx" fontSize={9} code={`// Lua-driven keyframe animation — zero JS overhead
<Box style={{
  animation: {
    keyframes: {
      0:   { transform: { rotate: 0 } },
      100: { transform: { rotate: 360 } },
    },
    duration: 2000,
    iterations: -1,     // infinite
    easing: 'linear',
    direction: 'normal', // or 'alternate', 'reverse'
    fillMode: 'forwards',
    playState: 'running', // or 'paused'
  },
}} />`} />

      </Box>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Easings
// ═══════════════════════════════════════════════════════════

function EasingDemo({ label, easing, color }: { label: string; easing: EasingFunction; color: string }) {
  const c = useThemeColors();
  const progress = useRepeat({ duration: 2000 });
  const eased = easing(progress);
  const barWidth = 200;

  return (
    <Box style={{ gap: 4 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 9, width: 80 }}>{label}</Text>
        <Box style={{
          width: barWidth, height: 16, backgroundColor: c.surface, borderRadius: 3,
          overflow: 'hidden',
        }}>
          <Box style={{
            position: 'absolute', left: 0, top: 0,
            width: Math.max(4, eased * barWidth), height: 16,
            backgroundColor: color, borderRadius: 3,
            opacity: 0.8,
          }} />
        </Box>
        <Text style={{ color: c.muted, fontSize: 8, width: 30 }}>{eased.toFixed(2)}</Text>
      </Box>
    </Box>
  );
}

function EasingsTab() {
  const c = useThemeColors();

  const easings: { label: string; fn: EasingFunction; color: string }[] = [
    { label: 'linear', fn: Easing.linear, color: c.muted },
    { label: 'easeIn', fn: Easing.easeIn, color: A.fire },
    { label: 'easeOut', fn: Easing.easeOut, color: A.amber },
    { label: 'easeInOut', fn: Easing.easeInOut, color: A.emerald },
    { label: 'bounce', fn: Easing.bounce, color: A.cyan },
    { label: 'elastic(1)', fn: Easing.elastic(1), color: A.pink },
    { label: 'elastic(2)', fn: Easing.elastic(2), color: A.accentBright },
    { label: 'bezier(.68,-.6,.32,1.6)', fn: Easing.bezier(0.68, -0.6, 0.32, 1.6), color: A.blue },
  ];

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 16 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Easing Functions'}</Text>
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Each bar shows a 0\u21921 animation with a different easing. All loop every 2 seconds.'}
        </Text>

        <Box style={{ gap: 8 }}>
          {easings.map(e => (
            <EasingDemo key={e.label} label={e.label} easing={e.fn} color={e.color} />
          ))}
        </Box>

        <CodeBlock language="tsx" fontSize={9} code={`// Built-in easings
Easing.linear
Easing.easeIn      // quadratic
Easing.easeOut     // quadratic
Easing.easeInOut   // quadratic blend
Easing.bounce      // bouncing ball
Easing.elastic(1)  // elastic with bounciness

// Custom cubic bezier
Easing.bezier(0.68, -0.6, 0.32, 1.6)

// Use in JS animations:
anim.timing({ toValue: 1, easing: Easing.bounce })

// Or Lua transitions:
transition: { all: { easing: 'bounce' } }

// Or Lua keyframes:
animation: { easing: 'elastic', ... }`} />

      </Box>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Presets (convenience hooks)
// ═══════════════════════════════════════════════════════════

function EntranceItem({ text, delay, color }: { text: string; delay: number; color: string }) {
  const c = useThemeColors();
  const { opacity, translateY } = useEntrance({ delay, duration: 500 });
  return (
    <Box style={{
      opacity,
      transform: { translateY },
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.bgElevated, borderRadius: 8,
      borderWidth: 1, borderColor: c.border,
      paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
    }}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: c.text, fontSize: 11 }}>{text}</Text>
    </Box>
  );
}

function PresetsTab() {
  const c = useThemeColors();

  // usePulse
  const pulse = usePulse({ min: 0.3, max: 1, duration: 2000 });

  // useCountUp
  const [countTarget, setCountTarget] = useState(0);
  const counted = useCountUp(countTarget, { duration: 1500 });

  // useTypewriter
  const typed = useTypewriter('ReactJIT animations bring your UI to life.', { speed: 60, delay: 300 });

  // useShake
  const { value: shakeX, shake } = useShake({ intensity: 10 });

  // useBounce
  const [bounceTarget, setBounceTarget] = useState(0);
  const bounced = useBounce(bounceTarget, { stiffness: 200, damping: 10 });

  // Staggered entrance
  const [showList, setShowList] = useState(true);
  const listItems = [
    { text: 'First item slides in', color: A.fire },
    { text: 'Second follows close behind', color: A.amber },
    { text: 'Third arrives fashionably', color: A.emerald },
    { text: 'Fourth brings up the rear', color: A.cyan },
    { text: 'Fifth wraps it up', color: A.accentBright },
  ];

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Animation Presets'}</Text>
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Higher-level hooks wrapping the core animation system. One-liners for common patterns.'}
        </Text>

        {/* usePulse */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'usePulse'}</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Box style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: A.fire, opacity: pulse,
            }} />
            <Box style={{
              width: 40, height: 40, borderRadius: 6,
              backgroundColor: A.cyan,
              transform: { scaleX: 0.5 + pulse * 0.5, scaleY: 0.5 + pulse * 0.5 },
            }} />
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {`opacity: ${pulse.toFixed(2)}`}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={'const pulse = usePulse({ min: 0.3, max: 1, duration: 2000 });'} />
        </Box>

        {/* useCountUp */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'useCountUp'}</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: A.emerald, fontSize: 28, fontWeight: 'bold' }}>
              {String(Math.round(counted))}
            </Text>
            {[1000, 5000, 9999].map(t => (
              <Pressable key={t} onPress={() => setCountTarget(t)}>
                <Box style={{
                  paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
                  backgroundColor: c.surface, borderRadius: 4,
                }}>
                  <Text style={{ color: c.text, fontSize: 10 }}>{String(t)}</Text>
                </Box>
              </Pressable>
            ))}
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={'const count = useCountUp(9999, { duration: 1500 });'} />
        </Box>

        {/* useTypewriter */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'useTypewriter'}</Text>
          <Box style={{
            backgroundColor: c.bgElevated, borderRadius: 8,
            borderWidth: 1, borderColor: c.border, padding: 12,
          }}>
            {/* rjit-ignore-next-line */}
            <Text style={{ color: c.text, fontSize: 12 }}>{typed}<Text style={{ color: A.accentBright, fontSize: 12 }}>{'|'}</Text></Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={`const text = useTypewriter('Hello world', { speed: 60 });`} />
        </Box>

        {/* useShake */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'useShake'}</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Box style={{ transform: { translateX: shakeX } }}>
              <Pressable onPress={shake}>
                <Box style={{
                  paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
                  backgroundColor: A.fire, borderRadius: 8,
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{'Shake me!'}</Text>
                </Box>
              </Pressable>
            </Box>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {`translateX: ${shakeX.toFixed(1)}`}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={`const { value, shake } = useShake({ intensity: 10 });
<Box style={{ transform: { translateX: value } }}>
  <Pressable onPress={shake}>...`} />
        </Box>

        {/* useBounce */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'useBounce'}</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Box style={{ height: 50, justifyContent: 'flex-end' }}>
              <Box style={{
                width: 30, height: Math.max(4, bounced),
                backgroundColor: A.cyan, borderRadius: 4,
              }} />
            </Box>
            {[20, 40, 60, 100].map(t => (
              <Pressable key={t} onPress={() => setBounceTarget(t)}>
                <Box style={{
                  paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
                  backgroundColor: c.surface, borderRadius: 4,
                }}>
                  <Text style={{ color: c.text, fontSize: 10 }}>{String(t)}</Text>
                </Box>
              </Pressable>
            ))}
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={'const height = useBounce(target, { stiffness: 200, damping: 10 });'} />
        </Box>

        {/* useEntrance */}
        <Box style={{ gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'useEntrance (staggered list)'}</Text>
          <Pressable onPress={() => { setShowList(false); setTimeout(() => setShowList(true), 50); }}>
            <Box style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              backgroundColor: c.surface, borderRadius: 4, alignSelf: 'flex-start',
            }}>
              <Text style={{ color: c.text, fontSize: 10 }}>{'Replay entrance'}</Text>
            </Box>
          </Pressable>
          {showList && (
            <Box style={{ gap: 6 }}>
              {listItems.map((item, i) => (
                <EntranceItem key={item.text} text={item.text} delay={i * 100} color={item.color} />
              ))}
            </Box>
          )}
          <CodeBlock language="tsx" fontSize={9} code={`const { opacity, translateY } = useEntrance({
  delay: index * 100, // stagger by 100ms per item
  duration: 500,
  direction: 'up',
});`} />
        </Box>

      </Box>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab: Patterns (real-world recipes)
// ═══════════════════════════════════════════════════════════

function AnimatedButton({ label, color }: { label: string; color: string }) {
  const c = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <Box style={{
        paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10,
        backgroundColor: pressed ? `${color}cc` : color,
        borderRadius: 8,
        transform: {
          scaleX: pressed ? 0.92 : hovered ? 1.04 : 1,
          scaleY: pressed ? 0.92 : hovered ? 1.04 : 1,
          translateY: pressed ? 1 : hovered ? -1 : 0,
        },
        shadowColor: color,
        shadowBlur: hovered ? 12 : 0,
        shadowOffsetY: pressed ? 0 : hovered ? 4 : 2,
        transition: { all: { duration: 150, easing: 'easeOut' } },
      }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

function ToggleSwitch() {
  const c = useThemeColors();
  const [on, setOn] = useState(false);

  return (
    <Pressable onPress={() => setOn(v => !v)}>
      <Box style={{
        width: 52, height: 28, borderRadius: 14,
        backgroundColor: on ? A.emerald : c.surface,
        borderWidth: 1, borderColor: on ? A.emerald : c.border,
        justifyContent: 'center',
        paddingLeft: 3, paddingRight: 3,
        transition: { all: { duration: 200, easing: 'easeInOut' } },
      }}>
        <Box style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: '#fff',
          transform: { translateX: on ? 23 : 0 },
          shadowColor: 'rgba(0,0,0,0.2)', shadowBlur: 4, shadowOffsetY: 1,
          transition: { all: { duration: 200, easing: 'easeOut' } },
        }} />
      </Box>
    </Pressable>
  );
}

function LoadingDots() {
  return (
    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <Box key={i} style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: A.accentBright,
          animation: {
            keyframes: {
              0: { opacity: 0.3, transform: { scaleX: 0.8, scaleY: 0.8 } },
              50: { opacity: 1, transform: { scaleX: 1.2, scaleY: 1.2 } },
              100: { opacity: 0.3, transform: { scaleX: 0.8, scaleY: 0.8 } },
            },
            duration: 1200,
            iterations: -1,
            easing: 'easeInOut',
            delay: i * 200,
          },
        }} />
      ))}
    </Box>
  );
}

function Spinner() {
  return (
    <Box style={{
      width: 32, height: 32, borderRadius: 16,
      borderWidth: 3, borderColor: 'rgba(139,92,246,0.2)',
      borderTopColor: A.accentBright,
      animation: {
        keyframes: {
          0: { transform: { rotate: 0 } },
          100: { transform: { rotate: 360 } },
        },
        duration: 800, iterations: -1, easing: 'linear',
      },
    }} />
  );
}

function PatternsTab() {
  const c = useThemeColors();
  const [notifications, setNotifications] = useState<number[]>([]);
  const nextId = useRef(0);

  const addNotification = () => {
    const id = nextId.current++;
    setNotifications(prev => [...prev, id]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== id));
    }, 3000);
  };

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <Box style={{ padding: 20, gap: 20 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Real-World Patterns'}</Text>
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Common UI animation patterns built with transitions and keyframes.'}
        </Text>

        {/* Animated buttons */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Animated Buttons'}</Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Hover: scale up + shadow. Press: scale down + shadow collapse.'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <AnimatedButton label="Primary" color={A.accentBright} />
            <AnimatedButton label="Danger" color={A.fire} />
            <AnimatedButton label="Success" color={A.emerald} />
            <AnimatedButton label="Info" color={A.cyan} />
          </Box>
        </Box>

        {/* Toggle switch */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Toggle Switch'}</Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Track color + thumb position transition via Lua.'}</Text>
          <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <ToggleSwitch />
            <ToggleSwitch />
            <ToggleSwitch />
          </Box>
        </Box>

        {/* Loading indicators */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Loading Indicators'}</Text>
          <Box style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
            <Box style={{ alignItems: 'center', gap: 6 }}>
              <Spinner />
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Spinner'}</Text>
            </Box>
            <Box style={{ alignItems: 'center', gap: 6 }}>
              <LoadingDots />
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Dots'}</Text>
            </Box>
            <Box style={{ alignItems: 'center', gap: 6 }}>
              <Box style={{
                width: 120, height: 12, borderRadius: 6,
                backgroundColor: c.surface, overflow: 'hidden',
              }}>
                <Box style={{
                  width: '30%', height: 12, borderRadius: 6,
                  backgroundColor: A.accentBright, opacity: 0.6,
                  animation: {
                    keyframes: {
                      0: { transform: { translateX: -40 } },
                      100: { transform: { translateX: 120 } },
                    },
                    duration: 1500, iterations: -1, easing: 'easeInOut',
                  },
                }} />
              </Box>
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Skeleton'}</Text>
            </Box>
          </Box>
        </Box>

        {/* Notification toasts */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Notification Toasts'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Pressable onPress={addNotification}>
              <Box style={{
                paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
                backgroundColor: A.accentBright, borderRadius: 6,
              }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{'Add Notification'}</Text>
              </Box>
            </Pressable>
            <Box style={{ flexGrow: 1, gap: 6 }}>
              {notifications.map((id, i) => (
                <NotificationToast key={id} index={i} />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Animated card */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{'Animated Cards'}</Text>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            {[
              { title: 'Revenue', value: '$12,420', color: A.emerald, icon: 'trending-up' },
              { title: 'Users', value: '1,847', color: A.blue, icon: 'users' },
              { title: 'Orders', value: '284', color: A.amber, icon: 'shopping-cart' },
            ].map(card => (
              <StatCard key={card.title} {...card} />
            ))}
          </Box>
        </Box>

        <CodeBlock language="tsx" fontSize={9} code={`// Animated button pattern
<Pressable onPressIn={() => setPressed(true)} onPressOut={...}>
  <Box style={{
    transform: {
      scaleX: pressed ? 0.92 : hovered ? 1.04 : 1,
      scaleY: pressed ? 0.92 : hovered ? 1.04 : 1,
    },
    shadowBlur: hovered ? 12 : 0,
    transition: { all: { duration: 150, easing: 'easeOut' } },
  }} />
</Pressable>

// Toggle switch pattern
<Box style={{
  backgroundColor: on ? '#10b981' : '#333',
  transition: { all: { duration: 200 } },
}}>
  <Box style={{
    transform: { translateX: on ? 23 : 0 },
    transition: { all: { duration: 200 } },
  }} />
</Box>

// Loading dots (staggered keyframe delay)
{[0, 1, 2].map(i => (
  <Box style={{
    animation: {
      keyframes: { 0: { opacity: 0.3 }, 50: { opacity: 1 }, 100: { opacity: 0.3 } },
      duration: 1200, iterations: -1, delay: i * 200,
    },
  }} />
))}`} />

      </Box>
    </ScrollView>
  );
}

function NotificationToast({ index }: { index: number }) {
  const c = useThemeColors();
  const { opacity, translateX } = useEntrance({ duration: 300, direction: 'right', distance: 30 });

  return (
    <Box style={{
      opacity,
      transform: { translateX },
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.bgElevated, borderRadius: 8,
      borderWidth: 1, borderColor: c.border,
      paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
    }}>
      <Box style={{
        width: 6, height: 6, borderRadius: 3, backgroundColor: A.emerald,
        animation: {
          keyframes: { 0: { opacity: 1 }, 50: { opacity: 0.3 }, 100: { opacity: 1 } },
          duration: 2000, iterations: -1,
        },
      }} />
      <Text style={{ color: c.text, fontSize: 10 }}>{'New notification arrived'}</Text>
    </Box>
  );
}

function StatCard({ title, value, color, icon }: { title: string; value: string; color: string; icon: string }) {
  const c = useThemeColors();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      <Box style={{
        flexGrow: 1, flexBasis: 0,
        backgroundColor: c.bgElevated, borderRadius: 10,
        borderWidth: 1, borderColor: hovered ? color : c.border,
        padding: 14, gap: 6,
        transform: { translateY: hovered ? -3 : 0 },
        shadowColor: hovered ? color : 'rgba(0,0,0,0)',
        shadowBlur: hovered ? 16 : 0,
        shadowOffsetY: hovered ? 6 : 0,
        transition: { all: { duration: 200, easing: 'easeOut' } },
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Image src={icon} style={{ width: 12, height: 12 }} tintColor={color} />
          <Text style={{ color: c.muted, fontSize: 9 }}>{title}</Text>
        </Box>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold' }}>{value}</Text>
      </Box>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Story
// ═══════════════════════════════════════════════════════════

export function AnimationStory() {
  const c = useThemeColors();
  const [activeTab, setActiveTab] = useState('springs');

  const tab = TABS.find(t => t.id === activeTab) || TABS[0];

  const TabContent = {
    springs: SpringsTab,
    transitions: TransitionsTab,
    keyframes: KeyframesTab,
    easings: EasingsTab,
    presets: PresetsTab,
    patterns: PatternsTab,
  }[activeTab] || SpringsTab;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* Header */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="activity" style={{ width: 18, height: 18 }} tintColor={A.accentBright} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Animation'}</Text>
        <Box style={{
          backgroundColor: A.accentDim, borderRadius: 4,
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
        }}>
          <Text style={{ color: A.accentBright, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Springs, transitions, keyframes, easings, presets'}
        </Text>
      </Box>

      {/* Tab bar */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 16, gap: 0,
      }}>
        {TABS.map(t => {
          const active = t.id === activeTab;
          return (
            <Pressable key={t.id} onPress={() => setActiveTab(t.id)}>
              <Box style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
                borderBottomWidth: 2,
                borderColor: active ? A.accentBright : 'rgba(0,0,0,0)',
                backgroundColor: active ? A.accentDim : 'rgba(0,0,0,0)',
                transition: { all: { duration: 150 } },
              }}>
                <Image src={t.icon} style={{ width: 12, height: 12 }} tintColor={active ? A.accentBright : c.muted} />
                <Text style={{
                  color: active ? A.accentBright : c.muted,
                  fontSize: 10, fontWeight: active ? 'bold' : 'normal',
                }}>{t.label}</Text>
              </Box>
            </Pressable>
          );
        })}
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, minHeight: 0 }}>
        <TabContent />
      </Box>

      {/* Footer */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="activity" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Animation'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {`${TABS.indexOf(tab) + 1} of ${TABS.length}`}
        </Text>
      </Box>

    </Box>
  );
}
