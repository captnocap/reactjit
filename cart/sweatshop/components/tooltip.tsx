const React: any = require('react');
const { useEffect, useRef, useState } = React;

import { Box, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { useHover, useTransition } from '../anim';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

function sideStyle(side: TooltipSide) {
  if (side === 'bottom') {
    return { top: '100%', left: 0, marginTop: 6 };
  }
  if (side === 'left') {
    return { right: '100%', top: 0, marginRight: 6 };
  }
  if (side === 'right') {
    return { left: '100%', top: 0, marginLeft: 6 };
  }
  return { bottom: '100%', left: 0, marginBottom: 6 };
}

export function Tooltip(props: {
  label: string;
  side?: TooltipSide;
  delayMs?: number;
  children: any;
}) {
  const side = props.side || 'top';
  const delayMs = props.delayMs ?? 500;
  const [hoverHandlers, hovered] = useHover();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<any>(null);
  const opacity = useTransition(visible ? 1 : 0, 120);

  useEffect(() => {
    if (!hovered) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delayMs, hovered]);

  return (
    <Box
      {...hoverHandlers}
      style={{
        position: 'relative',
        display: 'flex',
        alignSelf: 'flex-start',
        overflow: 'visible',
      }}
    >
      {props.children}
      {opacity > 0.01 ? (
        <Box
          style={{
            position: 'absolute',
            zIndex: 5000,
            pointerEvents: 'none',
            opacity,
            ...sideStyle(side),
          }}
        >
          <Box
            style={{
              paddingLeft: 7,
              paddingRight: 7,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelRaised,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {props.label}
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
