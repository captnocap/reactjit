import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp01 } from './controlsSpecimenTheme';

const host: any = globalThis as any;

type RangeValue = {
  low: number;
  high: number;
};

function cancelFrame(frameId: any): void {
  if (frameId == null) return;
  const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
  if (cancel) cancel(frameId);
  else clearTimeout(frameId);
}

function scheduleFrame(fn: () => void): any {
  const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
  return raf ? raf(fn) : setTimeout(fn, 16);
}

function readMouseX(): number {
  return typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
}

function readMouseY(): number {
  return typeof host.getMouseY === 'function' ? Number(host.getMouseY()) : 0;
}

function isMouseDown(): boolean {
  return typeof host.getMouseDown === 'function' ? !!host.getMouseDown() : false;
}

function clampPercent(value: number): number {
  return Math.round(clamp01(value / 100) * 100);
}

function clampIndex(value: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(value)));
}

function normalizeRange(low: number, high: number): RangeValue {
  const nextLow = clampPercent(low);
  const nextHigh = clampPercent(high);
  return nextLow <= nextHigh ? { low: nextLow, high: nextHigh } : { low: nextHigh, high: nextLow };
}

export function useControllableNumberState({
  value,
  defaultValue,
  min = 0,
  max = 100,
  onChange,
}: {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (next: number) => void;
}) {
  const clamp = useCallback((next: number) => Math.max(min, Math.min(max, Math.round(next))), [max, min]);
  const controlled = typeof value === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => clamp(defaultValue ?? value ?? min));
  const resolved = controlled ? clamp(value as number) : internal;

  const setValue = useCallback(
    (next: number) => {
      const resolvedNext = clamp(next);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [clamp, controlled, onChange]
  );

  return [resolved, setValue] as const;
}

export function useControllableIndexState({
  value,
  defaultValue,
  count,
  onChange,
}: {
  value?: number;
  defaultValue?: number;
  count: number;
  onChange?: (next: number) => void;
}) {
  const controlled = typeof value === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => clampIndex(defaultValue ?? value ?? 0, count));
  const resolved = controlled ? clampIndex(value as number, count) : clampIndex(internal, count);

  const setIndex = useCallback(
    (next: number) => {
      const resolvedNext = clampIndex(next, count);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [controlled, count, onChange]
  );

  return [resolved, setIndex] as const;
}

export function useControllableRangeState({
  low,
  high,
  defaultLow,
  defaultHigh,
  onChange,
}: {
  low?: number;
  high?: number;
  defaultLow?: number;
  defaultHigh?: number;
  onChange?: (next: RangeValue) => void;
}) {
  const controlled = typeof low === 'number' && typeof high === 'number' && typeof onChange === 'function';
  const [internal, setInternal] = useState(() => normalizeRange(defaultLow ?? low ?? 25, defaultHigh ?? high ?? 75));
  const resolved = controlled ? normalizeRange(low as number, high as number) : internal;

  const setRange = useCallback(
    (next: RangeValue) => {
      const resolvedNext = normalizeRange(next.low, next.high);
      if (!controlled) setInternal(resolvedNext);
      if (typeof onChange === 'function') onChange(resolvedNext);
    },
    [controlled, onChange]
  );

  return [resolved, setRange] as const;
}

export function useHorizontalPercentDrag(value: number, onChange: (next: number) => void, trackWidth: number) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startMouseRef = useRef(0);
  const startValueRef = useRef(value);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    if (trackWidth <= 0) return;
    const delta = ((readMouseX() - startMouseRef.current) / trackWidth) * 100;
    onChange(clampPercent(startValueRef.current + delta));
  }, [onChange, trackWidth]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    if (trackWidth <= 0) return;
    startMouseRef.current = readMouseX();
    startValueRef.current = value;
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [stopLoop, tick, trackWidth, value]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  return {
    dragging,
    ratio: clamp01(value / 100),
    begin,
  };
}

export function useVerticalPercentDrag(value: number, onChange: (next: number) => void, trackHeight: number) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startMouseRef = useRef(0);
  const startValueRef = useRef(value);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    if (trackHeight <= 0) return;
    const delta = ((startMouseRef.current - readMouseY()) / trackHeight) * 100;
    onChange(clampPercent(startValueRef.current + delta));
  }, [onChange, trackHeight]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback(() => {
    if (trackHeight <= 0) return;
    startMouseRef.current = readMouseY();
    startValueRef.current = value;
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [stopLoop, tick, trackHeight, value]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  return {
    dragging,
    ratio: clamp01(value / 100),
    begin,
  };
}

export function useHorizontalRangeDrag(range: RangeValue, onChange: (next: RangeValue) => void, trackWidth: number) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const thumbRef = useRef<'low' | 'high'>('low');
  const frameRef = useRef<any>(null);
  const startMouseRef = useRef(0);
  const startRangeRef = useRef(range);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    if (trackWidth <= 0) return;
    const start = startRangeRef.current;
    const delta = ((readMouseX() - startMouseRef.current) / trackWidth) * 100;
    if (thumbRef.current === 'low') {
      const next = clampPercent(start.low + delta);
      onChange({ low: Math.min(next, start.high), high: start.high });
    } else {
      const next = clampPercent(start.high + delta);
      onChange({ low: start.low, high: Math.max(next, start.low) });
    }
  }, [onChange, trackWidth]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback((thumb: 'low' | 'high') => {
    if (trackWidth <= 0) return;
    thumbRef.current = thumb;
    startMouseRef.current = readMouseX();
    startRangeRef.current = range;
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [range, stopLoop, tick, trackWidth]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  return {
    dragging,
    begin,
  };
}

export function useHorizontalIndexDrag(value: number, onChange: (next: number) => void, count: number, trackWidth: number) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startMouseRef = useRef(0);
  const startValueRef = useRef(value);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    if (trackWidth <= 0 || count <= 1) return;
    const stepPx = trackWidth / (count - 1);
    const delta = Math.round((readMouseX() - startMouseRef.current) / stepPx);
    onChange(clampIndex(startValueRef.current + delta, count));
  }, [count, onChange, trackWidth]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback((nextStart?: number) => {
    if (trackWidth <= 0 || count <= 1) return;
    const resolvedStart = clampIndex(typeof nextStart === 'number' ? nextStart : value, count);
    startMouseRef.current = readMouseX();
    startValueRef.current = resolvedStart;
    onChange(resolvedStart);
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [count, onChange, stopLoop, tick, trackWidth, value]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  return { dragging, begin };
}

export function useVerticalIndexDrag(value: number, onChange: (next: number) => void, count: number, trackHeight: number) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startMouseRef = useRef(0);
  const startValueRef = useRef(value);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    cancelFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const setFromMouse = useCallback(() => {
    if (trackHeight <= 0 || count <= 1) return;
    const stepPx = trackHeight / (count - 1);
    const delta = Math.round((startMouseRef.current - readMouseY()) / stepPx);
    onChange(clampIndex(startValueRef.current + delta, count));
  }, [count, onChange, trackHeight]);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (!isMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    setFromMouse();
    frameRef.current = scheduleFrame(tick);
  }, [setFromMouse, stopLoop]);

  const begin = useCallback((nextStart?: number) => {
    if (trackHeight <= 0 || count <= 1) return;
    const resolvedStart = clampIndex(typeof nextStart === 'number' ? nextStart : value, count);
    startMouseRef.current = readMouseY();
    startValueRef.current = resolvedStart;
    onChange(resolvedStart);
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    frameRef.current = scheduleFrame(tick);
  }, [count, onChange, stopLoop, tick, trackHeight, value]);

  useEffect(
    () => () => {
      activeRef.current = false;
      stopLoop();
    },
    [stopLoop]
  );

  return { dragging, begin };
}
