const { useCallback, useEffect, useRef, useState } = require('react');

const host: any = globalThis as any;

function readMouseY(): number {
  try {
    const fn = host.getMouseY;
    if (typeof fn !== 'function') return 0;
    const value = Number(fn());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function readMouseDown(): boolean {
  try {
    const fn = host.getMouseDown;
    if (typeof fn !== 'function') return false;
    return !!fn();
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function writeDockHeight(value: number): void {
  try {
    const fn = host.__setTerminalDockHeight;
    if (typeof fn === 'function') fn(value);
  } catch {}
}

export function useTerminalDockDrag(opts: { minHeight: number; maxHeight: number }) {
  const { minHeight, maxHeight } = opts;
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const latestHeightRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (frameRef.current != null) {
      const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
      if (cancel) cancel(frameRef.current);
      else clearTimeout(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    stopLoop();
    setDragging(false);
  }, [stopLoop]);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    if (!readMouseDown()) {
      finish();
      return;
    }

    const next = clamp(startHeightRef.current + (startYRef.current - readMouseY()), minHeight, maxHeight);
    if (next !== latestHeightRef.current) {
      latestHeightRef.current = next;
      writeDockHeight(next);
    }

    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    if (raf) {
      frameRef.current = raf(tick);
    } else {
      frameRef.current = setTimeout(tick, 16);
    }
  }, [finish, maxHeight, minHeight]);

  const begin = useCallback((startHeight: number) => {
    const initialHeight = clamp(startHeight, minHeight, maxHeight);
    startYRef.current = readMouseY();
    startHeightRef.current = initialHeight;
    latestHeightRef.current = initialHeight;
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    if (raf) {
      frameRef.current = raf(tick);
    } else {
      frameRef.current = setTimeout(tick, 16);
    }
  }, [maxHeight, minHeight, stopLoop, tick]);

  useEffect(() => () => {
    activeRef.current = false;
    stopLoop();
  }, [stopLoop]);

  return { begin, dragging, finish };
}
