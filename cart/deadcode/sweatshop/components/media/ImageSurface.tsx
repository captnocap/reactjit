
import { Box, Col, Pressable, Row, Text, Image } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MediaRange } from './MediaControls';
import type { MediaItem } from './useMediaStore';

const host: any = globalThis as any;

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';
type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function useMouseDrag(onTick: (mouseX: number, mouseY: number, started: boolean) => void) {
  const activeRef = useRef(false);
  const frameRef = useRef<any>(null);
  const startRef = useRef(true);

  const stopLoop = useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
    if (cancel) cancel(frameRef.current);
    else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const tick = useCallback(() => {
    if (!activeRef.current) {
      stopLoop();
      return;
    }
    if (typeof host.getMouseDown === 'function' && !host.getMouseDown()) {
      activeRef.current = false;
      stopLoop();
      return;
    }
    const mx = typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
    const my = typeof host.getMouseY === 'function' ? Number(host.getMouseY()) : 0;
    onTick(mx, my, startRef.current);
    startRef.current = false;
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [onTick, stopLoop]);

  const begin = useCallback(() => {
    activeRef.current = true;
    startRef.current = true;
    stopLoop();
    const mx = typeof host.getMouseX === 'function' ? Number(host.getMouseX()) : 0;
    const my = typeof host.getMouseY === 'function' ? Number(host.getMouseY()) : 0;
    onTick(mx, my, true);
    startRef.current = false;
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    frameRef.current = raf ? raf(tick) : setTimeout(tick, 16);
  }, [onTick, stopLoop, tick]);

  useEffect(() => () => {
    activeRef.current = false;
    stopLoop();
  }, [stopLoop]);

  return { begin };
}

function handleResize(handle: ResizeHandle, mouseX: number, mouseY: number, start: { x: number; y: number; w: number; h: number; ratio: number }, aspectLock: boolean) {
  const dx = mouseX - start.x;
  const dy = mouseY - start.y;
  let nextW = start.w;
  let nextH = start.h;
  if (handle === 'se') {
    nextW = start.w + dx;
    nextH = start.h + dy;
  } else if (handle === 'sw') {
    nextW = start.w - dx;
    nextH = start.h + dy;
  } else if (handle === 'ne') {
    nextW = start.w + dx;
    nextH = start.h - dy;
  } else if (handle === 'nw') {
    nextW = start.w - dx;
    nextH = start.h - dy;
  }
  nextW = clamp(nextW, 160, 1200);
  nextH = clamp(nextH, 120, 900);
  if (aspectLock) {
    const ratio = start.ratio || 1;
    if (Math.abs(dx) > Math.abs(dy)) nextH = clamp(nextW / ratio, 120, 900);
    else nextW = clamp(nextH * ratio, 160, 1200);
  }
  return { width: Math.round(nextW), height: Math.round(nextH) };
}

function cropBounds(crop: { x: number; y: number; w: number; h: number }) {
  const x = clamp(crop.x, 0, 1);
  const y = clamp(crop.y, 0, 1);
  const w = clamp(crop.w, 0.05, 1 - x);
  const h = clamp(crop.h, 0.05, 1 - y);
  return { x, y, w, h };
}

export function ImageSurface(props: { item: MediaItem; onUpdate: (patch: Partial<MediaItem>) => void }) {
  const item = props.item;
  const aspect = item.height > 0 ? item.width / item.height : 1;
  const resizeModeRef = useRef<ResizeHandle>('se');
  const resizeStartRef = useRef({ x: 0, y: 0, w: item.width, h: item.height, ratio: aspect });
  const cropModeRef = useRef<CropHandle>('move');
  const cropStartRef = useRef(cropBounds(item.crop));
  const cropMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    resizeStartRef.current = { x: 0, y: 0, w: item.width, h: item.height, ratio: aspect };
  }, [aspect, item.height, item.width]);

  useEffect(() => {
    cropStartRef.current = cropBounds(item.crop);
  }, [item.crop]);

  const resizeDrag = useMouseDrag((mouseX, mouseY, started) => {
    if (started) {
      resizeStartRef.current = { x: mouseX, y: mouseY, w: item.width, h: item.height, ratio: aspect };
      return;
    }
    const next = handleResize(resizeModeRef.current, mouseX, mouseY, resizeStartRef.current, item.aspectLock);
    if (next.width !== item.width || next.height !== item.height) {
      props.onUpdate(next);
    }
  });

  const cropDrag = useMouseDrag((mouseX, mouseY, started) => {
    if (started) {
      cropStartRef.current = cropBounds(item.crop);
      cropMouseRef.current = { x: mouseX, y: mouseY };
      return;
    }
    const base = cropStartRef.current;
    const dx = mouseX - cropMouseRef.current.x;
    const dy = mouseY - cropMouseRef.current.y;
    const minW = 0.05;
    const minH = 0.05;
    let next = { ...base };
    if (cropModeRef.current === 'move') {
      next.x = clamp(base.x + dx / item.width, 0, 1 - base.w);
      next.y = clamp(base.y + dy / item.height, 0, 1 - base.h);
    } else if (cropModeRef.current === 'se') {
      next.w = clamp(base.w + dx / item.width, minW, 1 - base.x);
      next.h = clamp(base.h + dy / item.height, minH, 1 - base.y);
    } else if (cropModeRef.current === 'sw') {
      next.x = clamp(base.x + dx / item.width, 0, 1 - minW);
      next.w = clamp(base.w - dx / item.width, minW, 1 - next.x);
      next.h = clamp(base.h + dy / item.height, minH, 1 - base.y);
    } else if (cropModeRef.current === 'ne') {
      next.y = clamp(base.y + dy / item.height, 0, 1 - minH);
      next.h = clamp(base.h - dy / item.height, minH, 1 - next.y);
      next.w = clamp(base.w + dx / item.width, minW, 1 - base.x);
    } else if (cropModeRef.current === 'nw') {
      next.x = clamp(base.x + dx / item.width, 0, 1 - minW);
      next.y = clamp(base.y + dy / item.height, 0, 1 - minH);
      next.w = clamp(base.w - dx / item.width, minW, 1 - next.x);
      next.h = clamp(base.h - dy / item.height, minH, 1 - next.y);
    }
    next = cropBounds(next);
    if (Math.abs(next.x - item.crop.x) > 0.001 || Math.abs(next.y - item.crop.y) > 0.001 || Math.abs(next.w - item.crop.w) > 0.001 || Math.abs(next.h - item.crop.h) > 0.001) {
      props.onUpdate({ crop: next });
    }
  });

  const rotationLabel = useMemo(() => `${Math.round(item.rotation)}°`, [item.rotation]);
  const crop = cropBounds(item.crop);
  const cropLeft = crop.x * item.width;
  const cropTop = crop.y * item.height;
  const cropWidth = crop.w * item.width;
  const cropHeight = crop.h * item.height;

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 10, padding: 12 }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.title}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{item.source}</Text>
        </Col>
        <Pressable
          onPress={() => props.onUpdate({ aspectLock: !item.aspectLock })}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: TOKENS.radiusMd,
            borderWidth: 1,
            borderColor: item.aspectLock ? COLORS.blue : COLORS.border,
            backgroundColor: item.aspectLock ? COLORS.blueDeep : COLORS.panelAlt,
          }}
        >
          <Text fontSize={10} color={item.aspectLock ? COLORS.blue : COLORS.text}>{item.aspectLock ? 'aspect lock' : 'free resize'}</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <MediaRange
          label="Rotation"
          value={item.rotation}
          min={-180}
          max={180}
          onChange={(next) => props.onUpdate({ rotation: Math.round(next) })}
          formatValue={() => rotationLabel}
        />
        <Text fontSize={10} color={COLORS.textDim}>{item.width + ' × ' + item.height}</Text>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
        <Box style={{ position: 'relative', width: item.width, height: item.height, borderRadius: TOKENS.radiusLg, overflow: 'hidden', boxShadow: item.shadow ? TOKENS.shadow3 : TOKENS.shadow0 }}>
          <Image
            source={item.source}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              transform: { rotate: item.rotation },
              borderRadius: TOKENS.radiusLg,
            }}
          />
          <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: COLORS.borderSoft }} />
          <Box
            style={{
              position: 'absolute',
              left: cropLeft,
              top: cropTop,
              width: cropWidth,
              height: cropHeight,
              borderWidth: 1,
              borderColor: COLORS.blue,
              backgroundColor: COLORS.panelHover,
              opacity: 0.18,
            }}
          >
            <Pressable onMouseDown={() => { cropModeRef.current = 'move'; cropDrag.begin(); }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
              const isLeft = corner.includes('w');
              const isTop = corner.includes('n');
              return (
                <Pressable
                  key={corner}
                  onMouseDown={() => { cropModeRef.current = corner; cropDrag.begin(); }}
                  style={{
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    left: isLeft ? -5 : cropWidth - 5,
                    top: isTop ? -5 : cropHeight - 5,
                    borderRadius: 5,
                    backgroundColor: COLORS.blue,
                    borderWidth: 1,
                    borderColor: COLORS.panelBg,
                  }}
                />
              );
            })}
          </Box>
          {(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => {
            const left = handle.includes('w') ? -6 : item.width - 6;
            const top = handle.includes('n') ? -6 : item.height - 6;
            return (
              <Pressable
                key={handle}
                onMouseDown={() => { resizeModeRef.current = handle; resizeDrag.begin(); }}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: COLORS.panelRaised,
                  borderWidth: 1,
                  borderColor: COLORS.blue,
                }}
              />
            );
          })}
        </Box>
      </Row>
    </Col>
  );
}
