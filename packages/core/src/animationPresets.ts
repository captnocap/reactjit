/**
 * Animation presets — higher-level hooks wrapping the core animation system.
 *
 * These reduce common animation patterns to one-liners. For anything custom,
 * use the lower-level useAnimation/useSpring/useTransition hooks directly.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAnimation,
  Easing,
  loop,
  sequence,
  type EasingFunction,
} from './animation';

// ── usePulse ─────────────────────────────────────────────
// Oscillates a value between min and max. Great for breathing effects,
// attention indicators, loading states.

export function usePulse(config?: {
  min?: number;
  max?: number;
  duration?: number;
  easing?: EasingFunction;
}): number {
  const mn = config?.min ?? 0.4;
  const mx = config?.max ?? 1;
  const dur = config?.duration ?? 1500;
  const ease = config?.easing ?? Easing.easeInOut;
  const [anim, value] = useAnimation(mn);

  useEffect(() => {
    const up = anim.timing({ toValue: mx, duration: dur / 2, easing: ease });
    const down = anim.timing({ toValue: mn, duration: dur / 2, easing: ease });
    const looped = loop(sequence([up, down]));
    looped.start();
    return () => looped.stop();
  }, [mn, mx, dur, anim]);

  return value;
}

// ── useCountUp ───────────────────────────────────────────
// Animates from `from` to `to` once. Returns the current interpolated value.
// Good for statistics, dashboard numbers, score displays.

export function useCountUp(to: number, config?: {
  from?: number;
  duration?: number;
  easing?: EasingFunction;
  delay?: number;
}): number {
  const from = config?.from ?? 0;
  const dur = config?.duration ?? 1000;
  const ease = config?.easing ?? Easing.easeOut;
  const delay = config?.delay ?? 0;
  const [anim, value] = useAnimation(from);

  useEffect(() => {
    const a = anim.timing({ toValue: to, duration: dur, easing: ease, delay });
    a.start();
    return () => a.stop();
  }, [to, from, dur, delay, anim]);

  return value;
}

// ── useTypewriter ────────────────────────────────────────
// Reveals text one character at a time. Returns the visible substring.

export function useTypewriter(text: string, config?: {
  speed?: number;  // ms per character (default 50)
  delay?: number;  // ms before starting (default 0)
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

// ── useShake ─────────────────────────────────────────────
// Returns a translateX value and a shake() trigger function.
// Call shake() to play a horizontal shake animation.

export function useShake(config?: {
  intensity?: number;  // max pixel displacement (default 8)
  duration?: number;   // ms (default 400)
}): { value: number; shake: () => void } {
  const intensity = config?.intensity ?? 8;
  const dur = config?.duration ?? 400;
  const [anim, value] = useAnimation(0);

  const shake = useCallback(() => {
    // Rapid sequence: right, left, right, left, center
    const step = dur / 6;
    const r = anim.timing({ toValue: intensity, duration: step, easing: Easing.easeOut });
    const l = anim.timing({ toValue: -intensity, duration: step, easing: Easing.easeInOut });
    const r2 = anim.timing({ toValue: intensity * 0.5, duration: step, easing: Easing.easeInOut });
    const l2 = anim.timing({ toValue: -intensity * 0.5, duration: step, easing: Easing.easeInOut });
    const settle = anim.timing({ toValue: 0, duration: step * 2, easing: Easing.easeOut });
    sequence([r, l, r2, l2, settle]).start();
  }, [anim, intensity, dur]);

  return { value, shake };
}

// ── useEntrance ──────────────────────────────────────────
// One-shot fade+slide entrance animation. Returns opacity and translateY.
// Use delay for staggered list entrances.

export function useEntrance(config?: {
  duration?: number;
  delay?: number;
  distance?: number;   // slide distance in px (default 20)
  direction?: 'up' | 'down' | 'left' | 'right';
}): { opacity: number; translateX: number; translateY: number } {
  const dur = config?.duration ?? 400;
  const delay = config?.delay ?? 0;
  const dist = config?.distance ?? 20;
  const dir = config?.direction ?? 'up';

  const [opacityAnim, opacity] = useAnimation(0);
  const [slideAnim, slide] = useAnimation(dist);

  useEffect(() => {
    const fadeIn = opacityAnim.timing({ toValue: 1, duration: dur, easing: Easing.easeOut, delay });
    const slideIn = slideAnim.timing({ toValue: 0, duration: dur, easing: Easing.easeOut, delay });
    fadeIn.start();
    slideIn.start();
    return () => {
      fadeIn.stop();
      slideIn.stop();
    };
  }, [dur, delay, opacityAnim, slideAnim]);

  const tx = (dir === 'left' ? -slide : dir === 'right' ? slide : 0);
  const ty = (dir === 'up' ? slide : dir === 'down' ? -slide : 0);

  return { opacity, translateX: tx, translateY: ty };
}

// ── useBounce ────────────────────────────────────────────
// Spring-based bounce. Returns a value that overshoots then settles.

export function useBounce(target: number, config?: {
  stiffness?: number;
  damping?: number;
}): number {
  const [anim, value] = useAnimation(0);
  const stiffness = config?.stiffness ?? 180;
  const damping = config?.damping ?? 12;

  useEffect(() => {
    const spring = anim.spring({ toValue: target, stiffness, damping });
    spring.start();
    return () => spring.stop();
  }, [target, stiffness, damping, anim]);

  return value;
}

// ── useRepeat ────────────────────────────────────────────
// Repeats a timing animation N times (or infinitely).
// Returns the animated value normalized 0→1 each iteration.

export function useRepeat(config?: {
  duration?: number;
  iterations?: number;   // -1 = infinite
  easing?: EasingFunction;
}): number {
  const dur = config?.duration ?? 1000;
  const iters = config?.iterations ?? -1;
  const ease = config?.easing ?? Easing.linear;
  const [anim, value] = useAnimation(0);

  useEffect(() => {
    const toOne = anim.timing({ toValue: 1, duration: dur, easing: ease });
    const toZero = anim.timing({ toValue: 0, duration: 0 }); // instant reset
    const looped = loop(sequence([toOne, toZero]), { iterations: iters > 0 ? iters : undefined });
    looped.start();
    return () => looped.stop();
  }, [dur, iters, anim]);

  return value;
}
