/**
 * Animation system for reactjit — Lua-driven.
 *
 * All interpolation runs in Lua (lua/animate.lua). TypeScript provides:
 *   - Type definitions for transition/animation configs (free — no runtime cost)
 *   - Easing name constants (Lua resolves them)
 *   - useShake — imperative trigger, Lua runs the keyframe animation
 *   - useCountUp / useTypewriter — time-limited text helpers (setTimeout, not frame loop)
 *
 * NO per-frame JS callbacks. NO AnimatedValue. NO JS interpolation math.
 * React renders when targets change (once). Lua handles the rest.
 *
 * Usage: set style.transition or style.animation on your component.
 *   transition: { all: { type: 'spring', stiffness: 180, damping: 12 } }
 *   transition: { opacity: { duration: 300, easing: 'easeOut' } }
 *   animation: { keyframes: { 0: { opacity: 0 }, 100: { opacity: 1 } }, duration: 500 }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────

/** Easing name resolved by Lua's animate.lua */
export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'spring' | 'elastic';

/** Easing config — string name, bezier array, or elastic/bezier object */
export type EasingSpec =
  | EasingName
  | [number, number, number, number]
  | { type: 'bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'elastic'; bounciness?: number };

/** Timing-based transition config for a single property or "all" */
export interface TimingTransitionConfig {
  duration?: number;
  easing?: EasingSpec;
  delay?: number;
}

/** Spring-based transition config */
export interface SpringTransitionConfig {
  type: 'spring';
  stiffness?: number;
  damping?: number;
  mass?: number;
  restThreshold?: number;
  delay?: number;
}

/** Per-property or "all" wildcard transition config */
export type TransitionConfig = Record<string, TimingTransitionConfig | SpringTransitionConfig>;

/** Keyframe animation config (maps to Lua's animate.setupAnimation) */
export interface AnimationConfig {
  keyframes: Record<number, Record<string, any>>;
  duration?: number;
  easing?: EasingSpec;
  iterations?: number;
  direction?: 'normal' | 'alternate' | 'reverse' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'both';
  delay?: number;
  playState?: 'running' | 'paused';
  restart?: number;
}

// Backward-compat type exports (referenced by external code)
export type EasingFunction = (t: number) => number;
export interface Animation {
  start(callback?: (result: { finished: boolean }) => void): void;
  stop(): void;
}
export interface TimingConfig {
  toValue: number;
  duration?: number;
  easing?: EasingFunction;
  delay?: number;
}
export interface SpringConfig {
  toValue: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
  restThreshold?: number;
}
export interface InterpolationConfig {
  inputRange: number[];
  outputRange: number[] | string[];
  extrapolate?: 'clamp' | 'extend';
}

// ── Easing constants ─────────────────────────────────────
// String names that Lua resolves. Use in transition/animation configs.

export const Easing = {
  linear: 'linear' as const,
  easeIn: 'easeIn' as const,
  easeOut: 'easeOut' as const,
  easeInOut: 'easeInOut' as const,
  bounce: 'bounce' as const,
  spring: 'spring' as const,
  elastic: (bounciness?: number) => ({ type: 'elastic' as const, bounciness: bounciness ?? 1 }),
  bezier: (x1: number, y1: number, x2: number, y2: number) =>
    [x1, y1, x2, y2] as [number, number, number, number],
} as const;

// ── No-op frame loop ─────────────────────────────────────
// Lua drives all animations. This exists for NativeBridge compat.
export function tickAnimations(): void {}

// ── Deprecated stubs ─────────────────────────────────────
// These exist solely so external code that references the types doesn't crash
// at import time. They do nothing at runtime.

/** @deprecated Use style.transition / style.animation instead */
export class AnimatedValue {
  constructor(_v: number) {}
  getValue() { return 0; }
  setValue(_v: number) {}
  addListener(_cb: any) { return () => {}; }
  timing(_c: any): Animation { return { start() {}, stop() {} }; }
  spring(_c: any): Animation { return { start() {}, stop() {} }; }
  interpolate(_c: any) { return 0; }
  _updateValue(_v: number) {}
  _setActiveAnimation(_a: any) {}
  _stopActiveAnimation() {}
}

/** @deprecated Use style.transition / style.animation instead */
export function useAnimation(v: number): [AnimatedValue, number] {
  return [new AnimatedValue(v), v];
}

/** @deprecated Use style.transition with type:'spring' instead */
export function useSpring(target: number, _config?: any): number {
  return target;
}

/** @deprecated Use style.transition instead */
export function useTransition(value: number, _config?: any): number {
  return value;
}

/** @deprecated Use style.animation keyframes instead */
export function parallel(_a: Animation[]): Animation { return { start() {}, stop() {} }; }
/** @deprecated Use style.animation keyframes instead */
export function sequence(_a: Animation[]): Animation { return { start() {}, stop() {} }; }
/** @deprecated Use style.animation keyframes instead */
export function stagger(_d: number, _a: Animation[]): Animation { return { start() {}, stop() {} }; }
/** @deprecated Use style.animation keyframes instead */
export function loop(_a: Animation, _c?: any): Animation { return { start() {}, stop() {} }; }

// ── useShake ─────────────────────────────────────────────
// Imperative shake trigger. Returns a style object (spread into your element)
// and a shake() function. One render on trigger, Lua runs the animation.

export function useShake(config?: {
  intensity?: number;
  duration?: number;
}): { style: Record<string, any>; shake: () => void } {
  const intensity = config?.intensity ?? 8;
  const dur = config?.duration ?? 400;
  const [key, setKey] = useState(0);
  const shake = useCallback(() => setKey(k => k + 1), []);

  const style = key > 0 ? {
    animation: {
      keyframes: {
        0: { transform: { translateX: 0 } },
        16: { transform: { translateX: intensity } },
        33: { transform: { translateX: -intensity } },
        50: { transform: { translateX: intensity * 0.5 } },
        66: { transform: { translateX: -intensity * 0.5 } },
        100: { transform: { translateX: 0 } },
      },
      duration: dur,
      iterations: 1,
      fillMode: 'none' as const,
      restart: key,
    },
  } : {};

  return { style, shake };
}

// ── useCountUp ───────────────────────────────────────────
// Time-limited counter animation. Uses setTimeout (not the frame loop).
// Runs for `duration` ms then stops. Not an infinite re-render loop.

export function useCountUp(to: number, config?: {
  from?: number;
  duration?: number;
  delay?: number;
}): number {
  const from = config?.from ?? 0;
  const dur = config?.duration ?? 1000;
  const delay = config?.delay ?? 0;
  const [value, setValue] = useState(from);

  useEffect(() => {
    let start: number | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (start === null) start = Date.now();
      const elapsed = Date.now() - start - delay;
      if (elapsed < 0) { timer = setTimeout(tick, 16); return; }
      const t = Math.min(elapsed / dur, 1);
      const eased = t * (2 - t); // easeOut
      setValue(from + (to - from) * eased);
      if (t < 1) timer = setTimeout(tick, 16);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [to, from, dur, delay]);

  return value;
}

// ── useTypewriter ────────────────────────────────────────
// Character-by-character text reveal. Uses setTimeout (not frame loop).

export function useTypewriter(text: string, config?: {
  speed?: number;
  delay?: number;
}): string {
  const speed = config?.speed ?? 50;
  const delay = config?.delay ?? 0;
  const [charCount, setCharCount] = useState(0);
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    setCharCount(0);
    let idx = 0;
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      idx++;
      if (idx <= textRef.current.length) {
        setCharCount(idx);
        timeout = setTimeout(tick, speed);
      }
    };
    timeout = setTimeout(tick, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return text.slice(0, charCount);
}

// ── Entrance style helper ────────────────────────────────
// Returns a style object for one-shot fade+slide entrance. Not a hook.

export function entranceStyle(config?: {
  duration?: number;
  delay?: number;
  distance?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}): Record<string, any> {
  const dur = config?.duration ?? 400;
  const d = config?.delay ?? 0;
  const dist = config?.distance ?? 20;
  const dir = config?.direction ?? 'up';

  const fromTransform: Record<string, number> = {};
  if (dir === 'up') fromTransform.translateY = dist;
  else if (dir === 'down') fromTransform.translateY = -dist;
  else if (dir === 'left') fromTransform.translateX = -dist;
  else if (dir === 'right') fromTransform.translateX = dist;

  return {
    animation: {
      keyframes: {
        0: { opacity: 0, transform: fromTransform },
        100: { opacity: 1, transform: { translateX: 0, translateY: 0 } },
      },
      duration: dur,
      delay: d,
      iterations: 1,
      fillMode: 'forwards' as const,
      easing: 'easeOut',
    },
  };
}

// ── Pulse style helper ───────────────────────────────────
// Returns a style object for infinite pulse animation. Not a hook.

export function pulseStyle(prop: string, config?: {
  min?: number;
  max?: number;
  duration?: number;
  easing?: EasingSpec;
}): Record<string, any> {
  const mn = config?.min ?? 0.4;
  const mx = config?.max ?? 1;
  return {
    [prop]: mn,
    animation: {
      keyframes: {
        0: { [prop]: mn },
        50: { [prop]: mx },
        100: { [prop]: mn },
      },
      duration: config?.duration ?? 1500,
      iterations: -1,
      easing: config?.easing ?? 'easeInOut',
    },
  };
}

// ── Repeat style helper ──────────────────────────────────
// Returns a style object for infinite 0→1 loop. Not a hook.

export function repeatStyle(prop: string, config?: {
  duration?: number;
  easing?: EasingSpec;
}): Record<string, any> {
  return {
    animation: {
      keyframes: {
        0: { [prop]: 0 },
        100: { [prop]: 1 },
      },
      duration: config?.duration ?? 1000,
      iterations: -1,
      easing: config?.easing ?? 'linear',
    },
  };
}
