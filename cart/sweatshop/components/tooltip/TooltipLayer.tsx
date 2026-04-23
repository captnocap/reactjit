const React: any = require('react');
const { createContext, useCallback, useEffect, useMemo, useState } = React;

import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useTransition } from '../../anim';
import { renderMarkdownInline } from '../markdown/inlineRenderer';
import { ShortcutChip } from './ShortcutChip';
import { useAutoFlip, type TooltipRect, type TooltipViewport } from './useAutoFlip';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

type TooltipState = {
  id: number;
  label: string;
  markdown?: boolean;
  shortcut?: string;
  side: TooltipSide;
  anchor: TooltipRect;
};

type TooltipContextValue = {
  show: (payload: Omit<TooltipState, 'id'>) => number;
  hide: (id: number) => void;
};

export const TooltipContext = createContext<TooltipContextValue | null>(null);

function getViewport(): TooltipViewport {
  const host: any = globalThis as any;
  const width = typeof host?.innerWidth === 'number' ? host.innerWidth : typeof host?.__viewportWidth === 'number' ? host.__viewportWidth : 0;
  const height = typeof host?.innerHeight === 'number' ? host.innerHeight : typeof host?.__viewportHeight === 'number' ? host.__viewportHeight : 0;
  return { width, height };
}

function estimateSize(label: string, shortcut?: string) {
  const textWidth = Math.min(320, Math.max(120, 20 + label.length * 6));
  const chordWidth = shortcut ? Math.min(120, 16 + shortcut.length * 7) : 0;
  const width = Math.max(textWidth + chordWidth, shortcut ? 180 : textWidth);
  const labelLines = Math.max(1, Math.ceil(label.length / 32));
  const height = 14 + (labelLines - 1) * 10 + 10;
  return { width, height };
}

function TooltipOverlay(props: { active: TooltipState | null; viewport: TooltipViewport }) {
  const visible = !!props.active;
  const opacity = useTransition(visible ? 1 : 0, 120);
  const active = props.active;
  const size = active ? estimateSize(active.label, active.shortcut) : { width: 0, height: 0 };
  const placement = useAutoFlip({ anchor: active ? active.anchor : null, side: active?.side, size, viewport: props.viewport });

  if (!active || opacity <= 0.01) return null;

  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 10000, pointerEvents: 'none', overflow: 'visible' }}>
      <Box style={{
        position: 'absolute',
        left: placement.left,
        top: placement.top,
        maxWidth: placement.maxWidth,
        opacity,
      }}>
        <Box style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 5,
          paddingBottom: 5,
          borderRadius: TOKENS.radiusSm,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelRaised,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}>
          <Row style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            {active.markdown ? (
              <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
                {renderMarkdownInline(active.label, { fontSize: 9, color: COLORS.textBright, keyPrefix: 'tooltip-md' })}
              </Box>
            ) : (
              <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold', flexShrink: 1 }}>
                {active.label}
              </Text>
            )}
            {active.shortcut ? <ShortcutChip chord={active.shortcut} /> : null}
          </Row>
        </Box>
      </Box>
    </Box>
  );
}

export function TooltipLayer(props: { children: any }) {
  const [viewport, setViewport] = useState<TooltipViewport>(getViewport());
  const [active, setActive] = useState<TooltipState | null>(null);
  const nextIdRef = React.useRef(1);

  useEffect(() => {
    const host: any = globalThis as any;
    const target = typeof host?.addEventListener === 'function' ? host : (typeof window !== 'undefined' ? window : null);
    if (!target || typeof target.addEventListener !== 'function') return;
    const update = () => setViewport(getViewport());
    update();
    target.addEventListener('resize', update);
    return () => target.removeEventListener('resize', update);
  }, []);

  const show = useCallback((payload: Omit<TooltipState, 'id'>) => {
    const id = nextIdRef.current++;
    setActive({ ...payload, id });
    return id;
  }, []);

  const hide = useCallback((id: number) => {
    setActive((current) => (current && current.id === id ? null : current));
  }, []);

  const value = useMemo(() => ({ show, hide }), [hide, show]);

  return (
    <TooltipContext.Provider value={value}>
      <Box style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
        {props.children}
        <TooltipOverlay active={active} viewport={viewport} />
      </Box>
    </TooltipContext.Provider>
  );
}
