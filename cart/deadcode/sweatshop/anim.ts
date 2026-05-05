const { Box } = require('../../runtime/primitives');
import { useState, useEffect, useRef } from 'react';
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

export function useTransition(target: number, durationMs: number = 200): number {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const start = valueRef.current;
    if (durationMs <= 0 || start === target) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = clamp01(elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = start + (target - start) * eased;
      valueRef.current = next;
      setValue(next);
      if (t < 1) {
        timerRef.current = setTimeout(tick, 16);
      }
    };

    timerRef.current = setTimeout(tick, 16);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, durationMs]);

  return value;
}

export function useTween(target: number, durationMs: number = 200): number {
  return useTransition(target, durationMs);
}

export function usePulse(min: number = 0.4, max: number = 1, durationMs: number = 1500): number {
  const [value, setValue] = useState(min);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const tick = () => {
      const t = (Date.now() % durationMs) / durationMs;
      const sine = Math.sin(t * Math.PI * 2);
      const normalized = (sine + 1) / 2;
      setValue(min + (max - min) * normalized);
    };
    timerRef.current = setInterval(tick, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [min, max, durationMs]);

  return value;
}

export function useHover(): [any, boolean] {
  const [hovered, setHovered] = useState(false);
  const hoverPropsRef = useRef<any>(null);

  if (!hoverPropsRef.current) {
    hoverPropsRef.current = {
      onHoverEnter: () => setHovered(true),
      onHoverExit: () => setHovered(false),
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    };
  }

  return [hoverPropsRef.current, hovered];
}

export function useStagger<T>(items: T[], staggerMs: number = 50): number[] {
  const [opacities, setOpacities] = useState<number[]>(() => items.map(() => 0));

  useEffect(() => {
    const timeouts: any[] = [];
    items.forEach((_, i) => {
      timeouts.push(setTimeout(() => {
        setOpacities(prev => {
          const next = [...prev];
          next[i] = 1;
          return next;
        });
      }, i * staggerMs));
    });
    return () => timeouts.forEach(clearTimeout);
  }, [items.length, staggerMs]);

  return opacities;
}

function useAppear(delayMs: number, durationMs: number): number {
  const [armed, setArmed] = useState(delayMs <= 0 ? 1 : 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setArmed(1);
      return;
    }

    setArmed(0);
    const timer = setTimeout(() => setArmed(1), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return useTransition(armed, durationMs);
}

function mergeStyle(baseStyle: any, extraStyle: any): any {
  const merged: any = {
    ...(baseStyle || {}),
    ...(extraStyle || {}),
  };
  const baseTransform = (baseStyle && baseStyle.transform) || null;
  const extraTransform = (extraStyle && extraStyle.transform) || null;
  if (baseTransform || extraTransform) {
    merged.transform = {
      ...(baseTransform || {}),
      ...(extraTransform || {}),
    };
  }
  return merged;
}

export function FadeIn(props: { delay?: number; durationMs?: number; style?: any; children?: any }) {
  const opacity = useAppear(props.delay || 0, props.durationMs || 180);
  return React.createElement(Box, { style: mergeStyle(props.style, { opacity }) }, props.children);
}

export function SlideIn(props: { from?: 'left' | 'right' | 'top' | 'bottom'; delay?: number; durationMs?: number; distance?: number; style?: any; children?: any }) {
  const progress = useAppear(props.delay || 0, props.durationMs || 200);
  const distance = props.distance ?? 14;
  const from = props.from || 'bottom';
  const travel = (1 - progress) * distance;
  const transform = from === 'left'
    ? { translateX: -travel }
    : from === 'right'
      ? { translateX: travel }
      : from === 'top'
        ? { translateY: -travel }
        : { translateY: travel };

  return React.createElement(Box, { style: mergeStyle(props.style, { opacity: progress, transform }) }, props.children);
}

export function ScaleIn(props: { delay?: number; durationMs?: number; from?: number; style?: any; children?: any }) {
  const progress = useAppear(props.delay || 0, props.durationMs || 180);
  const from = props.from ?? 0.96;
  const scale = from + (1 - from) * progress;

  return React.createElement(Box, { style: mergeStyle(props.style, { opacity: progress, transform: { scaleX: scale, scaleY: scale } }) }, props.children);
}

export function PopoverIn(props: { delay?: number; durationMs?: number; distance?: number; style?: any; children?: any }) {
  return React.createElement(
    SlideIn,
    {
      from: 'top',
      delay: props.delay || 0,
      durationMs: props.durationMs || 160,
      distance: props.distance ?? 10,
      style: props.style,
    },
    props.children,
  );
}

export function usePageModeTransition(mode: string, durationMs: number = 220) {
  const modeRef = useRef(mode);
  const timerRef = useRef<any>(null);
  const [currentMode, setCurrentMode] = useState(mode);
  const [previousMode, setPreviousMode] = useState<string | null>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (mode === modeRef.current) return;

    const previous = modeRef.current;
    modeRef.current = mode;
    setPreviousMode(previous);
    setCurrentMode(mode);
    setProgress(0);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = clamp01(elapsed / durationMs);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        timerRef.current = setTimeout(tick, 16);
      } else {
        setPreviousMode(null);
      }
    };

    timerRef.current = setTimeout(tick, 16);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mode, durationMs]);

  return { currentMode, previousMode, progress };
}

export function PageModeTransition(props: {
  mode: string;
  durationMs?: number;
  style?: any;
  renderPage: (mode: string) => any;
}) {
  const { currentMode, previousMode, progress } = usePageModeTransition(props.mode, props.durationMs || 220);

  return React.createElement(
    Box,
    { style: mergeStyle(props.style, { position: 'relative' }) },
    previousMode
      ? React.createElement(
          Box,
          {
            key: 'page-prev-' + previousMode,
            style: {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: 1 - progress,
              pointerEvents: 'none',
            },
          },
          props.renderPage(previousMode),
        )
      : null,
    React.createElement(
      Box,
      {
        key: 'page-cur-' + currentMode,
        style: {
          // Mirror the parent's flex sizing (index.tsx:1817-1819 passes
          // flexGrow:1 + flexBasis:0 + minHeight:0). Without these, the
          // current-mode wrapper Box was a flex child with no grow rule
          // and collapsed to zero height — every surface rendered inside
          // disappeared even though its children carried their own
          // flexGrow. Preserve opacity animation exactly as before.
          opacity: progress,
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          flexBasis: 0,
          minHeight: 0,
          minWidth: 0,
        },
      },
      props.renderPage(currentMode),
    ),
  );
}
