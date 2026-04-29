
import { Pressable } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

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

interface SplitDividerProps {
  direction: 'horizontal' | 'vertical';
  thickness: number;
  onResize: (deltaWeight: number) => void;
}

export function SplitDivider(props: SplitDividerProps) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (frameRef.current != null) {
      const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
      if (cancel) cancel(frameRef.current);
      else clearTimeout(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    if (!readMouseDown()) {
      activeRef.current = false;
      setDragging(false);
      stopLoop();
      return;
    }
    const dx = readMouseX() - startXRef.current;
    const dy = readMouseY() - startYRef.current;
    const delta = props.direction === 'horizontal' ? dx : dy;
    props.onResize(delta * 0.01);
    startXRef.current = readMouseX();
    startYRef.current = readMouseY();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [props.direction, props.onResize, stopLoop]);

  const begin = useCallback(() => {
    startXRef.current = readMouseX();
    startYRef.current = readMouseY();
    activeRef.current = true;
    setDragging(true);
    stopLoop();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [stopLoop, tick]);

  useEffect(() => () => {
    activeRef.current = false;
    stopLoop();
  }, [stopLoop]);

  return (
    <Pressable
      onMouseDown={begin}
      style={{
        [props.direction === 'horizontal' ? 'width' : 'height']: props.thickness,
        [props.direction === 'horizontal' ? 'height' : 'width']: '100%',
        backgroundColor: dragging ? COLORS.blue : COLORS.border,
      }}
    />
  );
}
