const React: any = require('react');
const { useCallback, useEffect, useMemo, useRef, useState } = React;

import { Box, ScrollView } from '../../../runtime/primitives';
import { COLORS } from '../theme';

const host: any = globalThis as any;
const getMouseX = typeof host.getMouseX === 'function' ? host.getMouseX : null;
const getMouseY = typeof host.getMouseY === 'function' ? host.getMouseY : null;
const getMouseDown = typeof host.getMouseDown === 'function' ? host.getMouseDown : null;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function numeric(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && value.trim() !== '100%') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function useFadeOpacity() {
  const [opacity, setOpacity] = useState(0);
  const fadeTimerRef = useRef<any>(null);
  const fadeFrameRef = useRef<any>(null);
  const fadeStartRef = useRef(0);

  const stopFade = useCallback(() => {
    if (fadeTimerRef.current != null) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (fadeFrameRef.current != null) {
      const cancel = typeof host.cancelAnimationFrame === 'function' ? host.cancelAnimationFrame.bind(host) : null;
      if (cancel) cancel(fadeFrameRef.current);
      else clearTimeout(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    stopFade();
    setOpacity(1);
    fadeTimerRef.current = setTimeout(() => {
      fadeStartRef.current = Date.now();
      const step = () => {
        const elapsed = Date.now() - fadeStartRef.current;
        const next = 1 - clamp(elapsed / 260, 0, 1);
        setOpacity(next);
        if (next > 0) {
          const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
          if (raf) fadeFrameRef.current = raf(step);
          else fadeFrameRef.current = setTimeout(step, 16);
        } else {
          fadeFrameRef.current = null;
        }
      };
      step();
    }, 650);
  }, [stopFade]);

  useEffect(() => () => stopFade(), [stopFade]);

  return { opacity, show };
}

function useDragScroll(opts: {
  enabled: boolean;
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  maxScrollY: number;
  onScroll: (scrollX: number, scrollY: number) => void;
}) {
  const { enabled, scrollX, scrollY, maxScrollX, maxScrollY, onScroll } = opts;
  const activeRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<any>(null);
  const startMouseXRef = useRef(0);
  const startMouseYRef = useRef(0);
  const startScrollXRef = useRef(0);
  const startScrollYRef = useRef(0);
  const currentScrollXRef = useRef(0);
  const currentScrollYRef = useRef(0);

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
    setDragging(false);
    stopLoop();
  }, [stopLoop]);

  const tick = useCallback(() => {
    if (!activeRef.current) return;
    const down = typeof getMouseDown === 'function' ? !!getMouseDown() : false;
    if (!down) {
      finish();
      return;
    }

    const mx = typeof getMouseX === 'function' ? Number(getMouseX()) : startMouseXRef.current;
    const my = typeof getMouseY === 'function' ? Number(getMouseY()) : startMouseYRef.current;
    const nextX = clamp(startScrollXRef.current - (mx - startMouseXRef.current), 0, maxScrollX);
    const nextY = clamp(startScrollYRef.current - (my - startMouseYRef.current), 0, maxScrollY);
    if (nextX !== currentScrollXRef.current || nextY !== currentScrollYRef.current) {
      currentScrollXRef.current = nextX;
      currentScrollYRef.current = nextY;
      onScroll(nextX, nextY);
    }

    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    if (raf) {
      frameRef.current = raf(tick);
    } else {
      frameRef.current = setTimeout(tick, 16);
    }
  }, [finish, maxScrollX, maxScrollY, onScroll, scrollX, scrollY]);

  const begin = useCallback(() => {
    if (!enabled) return;
    if (activeRef.current) return;
    activeRef.current = true;
    setDragging(true);
    startMouseXRef.current = typeof getMouseX === 'function' ? Number(getMouseX()) : 0;
    startMouseYRef.current = typeof getMouseY === 'function' ? Number(getMouseY()) : 0;
    startScrollXRef.current = scrollX;
    startScrollYRef.current = scrollY;
    currentScrollXRef.current = scrollX;
    currentScrollYRef.current = scrollY;
    stopLoop();
    const raf = typeof host.requestAnimationFrame === 'function' ? host.requestAnimationFrame.bind(host) : null;
    if (raf) {
      frameRef.current = raf(tick);
    } else {
      frameRef.current = setTimeout(tick, 16);
    }
  }, [enabled, scrollX, scrollY, stopLoop, tick]);

  useEffect(() => () => {
    activeRef.current = false;
    setDragging(false);
    stopLoop();
  }, [stopLoop]);

  return { begin, finish, dragging };
}

export function ScrollFrame(props: {
  style?: any;
  scrollStyle?: any;
  scrollX?: number;
  scrollY?: number;
  contentHeight?: number;
  contentWidth?: number;
  viewportHeight?: number;
  viewportWidth?: number;
  horizontal?: boolean;
  dragToScroll?: boolean;
  onScroll?: (payload: any) => void;
  children?: any;
  onMouseDown?: any;
  onMiddleClick?: any;
}) {
  const viewportHeight = props.viewportHeight ?? numeric(props.style?.height) ?? numeric(props.style?.maxHeight) ?? numeric(props.scrollStyle?.height) ?? 320;
  const viewportWidth = props.viewportWidth ?? numeric(props.style?.width) ?? numeric(props.style?.maxWidth) ?? numeric(props.scrollStyle?.width) ?? 480;
  const contentHeight = props.contentHeight ?? viewportHeight;
  const contentWidth = props.contentWidth ?? viewportWidth;

  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const maxScrollX = Math.max(0, contentWidth - viewportWidth);
  const showVertical = maxScrollY > 0;
  const showHorizontal = !!props.horizontal && maxScrollX > 0;

  useEffect(() => {
    setScrollX((value) => clamp(value, 0, maxScrollX));
    setScrollY((value) => clamp(value, 0, maxScrollY));
  }, [maxScrollX, maxScrollY]);

  useEffect(() => {
    if (typeof props.scrollX === 'number' && Number.isFinite(props.scrollX)) {
      setScrollX(clamp(props.scrollX, 0, maxScrollX));
    }
  }, [maxScrollX, props.scrollX]);

  useEffect(() => {
    if (typeof props.scrollY === 'number' && Number.isFinite(props.scrollY)) {
      setScrollY(clamp(props.scrollY, 0, maxScrollY));
    }
  }, [maxScrollY, props.scrollY]);

  const onScroll = useCallback((payload: any) => {
    const nextX = clamp(typeof payload?.scrollX === 'number' ? payload.scrollX : 0, 0, maxScrollX);
    const nextY = clamp(typeof payload?.scrollY === 'number' ? payload.scrollY : 0, 0, maxScrollY);
    setScrollX(nextX);
    setScrollY(nextY);
    if (typeof props.onScroll === 'function') {
      props.onScroll({ ...payload, scrollX: nextX, scrollY: nextY });
    }
  }, [maxScrollX, maxScrollY, props]);

  const drag = useDragScroll({
    enabled: !!props.dragToScroll,
    scrollX,
    scrollY,
    maxScrollX,
    maxScrollY,
    onScroll: (nextX, nextY) => {
      setScrollX(nextX);
      setScrollY(nextY);
      if (typeof props.onScroll === 'function') {
        props.onScroll({ scrollX: nextX, scrollY: nextY, targetId: 0, deltaX: 0, deltaY: 0, drag: true });
      }
    },
  });

  const { opacity, show } = useFadeOpacity();

  const verticalThumb = useMemo(() => {
    if (!showVertical) return null;
    const trackHeight = Math.max(16, viewportHeight - 6);
    const thumbHeight = Math.max(18, Math.min(trackHeight, trackHeight * (viewportHeight / Math.max(contentHeight, 1))));
    const travel = Math.max(0, trackHeight - thumbHeight);
    const offset = maxScrollY > 0 ? travel * (scrollY / maxScrollY) : 0;
    return { trackHeight, thumbHeight, offset };
  }, [contentHeight, maxScrollY, scrollY, showVertical, viewportHeight]);

  const horizontalThumb = useMemo(() => {
    if (!showHorizontal) return null;
    const trackWidth = Math.max(16, viewportWidth - 6);
    const thumbWidth = Math.max(18, Math.min(trackWidth, trackWidth * (viewportWidth / Math.max(contentWidth, 1))));
    const travel = Math.max(0, trackWidth - thumbWidth);
    const offset = maxScrollX > 0 ? travel * (scrollX / maxScrollX) : 0;
    return { trackWidth, thumbWidth, offset };
  }, [contentWidth, maxScrollX, scrollX, showHorizontal, viewportWidth]);

  const handleStart = useCallback((kind: 'mouse' | 'middle') => {
    if (kind === 'mouse' && !props.dragToScroll) return;
    if (kind === 'middle' && !props.dragToScroll) return;
    drag.begin();
    show();
  }, [drag, props.dragToScroll, show]);

  return (
    <Box style={{ position: 'relative', overflow: 'hidden', ...props.style }}>
      <ScrollView
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, ...props.scrollStyle }}
        scrollX={scrollX}
        scrollY={scrollY}
        onScroll={onScroll}
        onMouseDown={() => handleStart('mouse')}
        onMiddleClick={() => handleStart('middle')}
      >
        {props.children}
      </ScrollView>

      {showVertical && verticalThumb ? (
        <Box
          style={{
            position: 'absolute',
            right: 2,
            top: 3,
            width: 6,
            height: viewportHeight - 6,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            opacity: opacity,
          }}
        >
          <Box
            style={{
              marginTop: verticalThumb.offset,
              width: 4,
              height: verticalThumb.thumbHeight,
              marginLeft: 1,
              borderRadius: 999,
              backgroundColor: COLORS.textMuted,
            }}
          />
        </Box>
      ) : null}

      {showHorizontal && horizontalThumb ? (
        <Box
          style={{
            position: 'absolute',
            left: 3,
            right: 3,
            bottom: 2,
            height: 6,
            alignItems: 'flex-start',
            opacity: opacity,
          }}
        >
          <Box
            style={{
              marginLeft: horizontalThumb.offset,
              width: horizontalThumb.thumbWidth,
              height: 4,
              marginTop: 1,
              borderRadius: 999,
              backgroundColor: COLORS.textMuted,
            }}
          />
        </Box>
      ) : null}
    </Box>
  );
}
