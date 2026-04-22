
import type { ScrollSyncState } from './useScrollSync';

type Axis = 'x' | 'y' | 'both';

type DragScrollOptions = {
  axis?: Axis;
  inertia?: boolean;
  grabCursor?: boolean;
  enabled?: boolean;
  surfaceKey: string;
  sync?: ScrollSyncState;
};

const host: any = globalThis as any;

function readMouseX(): number {
  try {
    const fn = host.getMouseX;
    if (typeof fn !== 'function') return 0;
    const value = Number(fn());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

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

function readStoreBoolean(key: string, fallback: boolean): boolean {
  try {
    const fn = host.__store_get;
    if (typeof fn !== 'function') return fallback;
    const raw = fn(key);
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'boolean') return raw;
    const text = String(raw).trim().toLowerCase();
    if (text === '0' || text === 'false' || text === 'off' || text === 'no') return false;
    if (text === '1' || text === 'true' || text === 'on' || text === 'yes') return true;
    return fallback;
  } catch {
    return fallback;
  }
}

function axisAllowsX(axis: Axis): boolean {
  return axis === 'x' || axis === 'both';
}

function axisAllowsY(axis: Axis): boolean {
  return axis === 'y' || axis === 'both';
}

function clampNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function useDragToScroll(scrollRef: any, options: DragScrollOptions) {
  const axis = options.axis || 'y';
  const inertia = !!options.inertia;
  const grabCursor = options.grabCursor !== false;
  const sync = options.sync || null;
  const [enabled, setEnabled] = useState(() => options.enabled ?? readStoreBoolean(options.surfaceKey, true));
  const [localScrollX, setLocalScrollX] = useState(0);
  const [localScrollY, setLocalScrollY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const inertiaRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startMouseXRef = useRef(0);
  const startMouseYRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const lastMouseYRef = useRef(0);
  const lastTickMsRef = useRef(0);
  const velocityXRef = useRef(0);
  const velocityYRef = useRef(0);
  const startScrollXRef = useRef(0);
  const startScrollYRef = useRef(0);

  const getScrollX = useCallback(() => {
    return sync ? sync.scrollX : localScrollX;
  }, [localScrollX, sync]);

  const getScrollY = useCallback(() => {
    return sync ? sync.scrollY : localScrollY;
  }, [localScrollY, sync]);

  const setScroll = useCallback((nextX: number, nextY: number) => {
    const x = axisAllowsX(axis) ? clampNumber(nextX) : getScrollX();
    const y = axisAllowsY(axis) ? clampNumber(nextY) : getScrollY();
    if (sync) {
      sync.setScroll(x, y);
    } else {
      if (x !== localScrollX) setLocalScrollX(x);
      if (y !== localScrollY) setLocalScrollY(y);
    }
  }, [axis, getScrollX, getScrollY, localScrollX, localScrollY, sync]);

  const stopFrame = useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
    if (cancel) cancel(frameRef.current);
    else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const scheduleFrame = useCallback((tick: () => void) => {
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    if (raf) frameRef.current = raf(tick);
    else frameRef.current = setTimeout(tick, 16);
  }, []);

  const finish = useCallback(() => {
    activeRef.current = false;
    setDragging(false);
    if (!inertia) {
      inertiaRef.current = false;
      stopFrame();
    }
  }, [inertia, stopFrame]);

  const tick = useCallback(() => {
    if (!enabled) {
      finish();
      return;
    }

    const nowMs = Date.now();
    if (activeRef.current) {
      if (!readMouseDown()) {
        activeRef.current = false;
        setDragging(false);
        inertiaRef.current = inertia && (Math.abs(velocityXRef.current) > 0.05 || Math.abs(velocityYRef.current) > 0.05);
        if (!inertiaRef.current) {
          stopFrame();
          return;
        }
      } else {
        const mouseX = readMouseX();
        const mouseY = readMouseY();
        const deltaX = mouseX - startMouseXRef.current;
        const deltaY = mouseY - startMouseYRef.current;
        const nextX = axisAllowsX(axis) ? startScrollXRef.current - deltaX : getScrollX();
        const nextY = axisAllowsY(axis) ? startScrollYRef.current - deltaY : getScrollY();
        const dt = Math.max(1, nowMs - lastTickMsRef.current);
        velocityXRef.current = axisAllowsX(axis) ? (mouseX - lastMouseXRef.current) / dt : 0;
        velocityYRef.current = axisAllowsY(axis) ? (mouseY - lastMouseYRef.current) / dt : 0;
        lastMouseXRef.current = mouseX;
        lastMouseYRef.current = mouseY;
        lastTickMsRef.current = nowMs;
        setScroll(nextX, nextY);
      }
    } else if (inertiaRef.current) {
      const nextX = axisAllowsX(axis) ? getScrollX() - velocityXRef.current * 16 : getScrollX();
      const nextY = axisAllowsY(axis) ? getScrollY() - velocityYRef.current * 16 : getScrollY();
      setScroll(nextX, nextY);
      velocityXRef.current *= 0.92;
      velocityYRef.current *= 0.92;
      if (Math.abs(velocityXRef.current) < 0.01 && Math.abs(velocityYRef.current) < 0.01) {
        inertiaRef.current = false;
        stopFrame();
        return;
      }
    } else {
      stopFrame();
      return;
    }

    scheduleFrame(tick);
  }, [axis, enabled, finish, getScrollX, getScrollY, inertia, scheduleFrame, setScroll, stopFrame]);

  const begin = useCallback(() => {
    if (!enabled) return;
    activeRef.current = true;
    inertiaRef.current = false;
    setDragging(true);
    startMouseXRef.current = readMouseX();
    startMouseYRef.current = readMouseY();
    lastMouseXRef.current = startMouseXRef.current;
    lastMouseYRef.current = startMouseYRef.current;
    lastTickMsRef.current = Date.now();
    startScrollXRef.current = getScrollX();
    startScrollYRef.current = getScrollY();
    stopFrame();
    scheduleFrame(tick);
  }, [enabled, getScrollX, getScrollY, scheduleFrame, stopFrame, tick]);

  const onMouseDown = useCallback(() => {
    begin();
  }, [begin]);

  const onMouseUp = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setDragging(false);
    inertiaRef.current = inertia && (Math.abs(velocityXRef.current) > 0.05 || Math.abs(velocityYRef.current) > 0.05);
    if (!inertiaRef.current) stopFrame();
    else scheduleFrame(tick);
  }, [inertia, scheduleFrame, stopFrame, tick]);

  const onScroll = useCallback((payload: any) => {
    const nextX = typeof payload?.scrollX === 'number' ? payload.scrollX : getScrollX();
    const nextY = typeof payload?.scrollY === 'number' ? payload.scrollY : getScrollY();
    setScroll(nextX, nextY);
  }, [getScrollX, getScrollY, setScroll]);

  useEffect(() => {
    const refresh = () => setEnabled(options.enabled ?? readStoreBoolean(options.surfaceKey, true));
    refresh();
    const id = setInterval(refresh, 750);
    return () => clearInterval(id);
  }, [options.enabled, options.surfaceKey]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      inertiaRef.current = false;
      stopFrame();
    };
  }, [stopFrame]);

  const cursor = useMemo(() => {
    if (!grabCursor) return undefined;
    if (!enabled) return undefined;
    return dragging ? 'grabbing' : 'grab';
  }, [dragging, enabled, grabCursor]);

  return {
    enabled,
    dragging,
    cursor,
    onMouseDown,
    onMouseUp,
    onScroll,
    scrollX: getScrollX(),
    scrollY: getScrollY(),
    setScroll,
    ref: scrollRef,
  };
}
