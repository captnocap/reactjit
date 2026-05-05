// =============================================================================
// StickView — 2D axis dot inside a ring + numeric readout
// =============================================================================
// Renders a circular track with a dot positioned at (x, y) in [-1, 1]^2.
// The dot position is the real axis value, not a demo. When both axes are
// zero (idle or unbound host) the dot sits dead-centre.
// =============================================================================

import { Box, Canvas, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export interface StickViewProps {
  label: string;
  /** -1..1 */
  x: number;
  /** -1..1 — note: SDL Y is down=positive; pass the raw axis. */
  y: number;
  /** tone for the dot and trail. Defaults to accent blue. */
  tone?: string;
}

export function StickView(props: StickViewProps) {
  const tone = props.tone ?? COLORS.blue;
  const x = clamp(props.x ?? 0, -1, 1);
  const y = clamp(props.y ?? 0, -1, 1);

  // Normalise to canvas [0,1] — (-1,-1) is top-left, (+1,+1) bottom-right.
  const cx = (x + 1) * 0.5;
  const cy = (y + 1) * 0.5;
  const dot = 0.08;

  return (
    <Col style={{ gap: 3, alignItems: 'center' }}>
      <Box style={{
        width: 64, height: 64,
        borderRadius: 32, borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.panelBg, overflow: 'hidden',
      }}>
        <Canvas style={{ width: '100%', height: '100%' }}>
          {/* crosshair lines */}
          <Canvas.Node gx={0} gy={0.495} gw={1} gh={0.01} fill={COLORS.borderSoft} />
          <Canvas.Node gx={0.495} gy={0} gw={0.01} gh={1} fill={COLORS.borderSoft} />
          {/* the actual stick dot */}
          <Canvas.Node
            gx={cx - dot / 2} gy={cy - dot / 2}
            gw={dot} gh={dot}
            fill={tone} />
        </Canvas>
      </Box>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
        {props.label}
      </Text>
      <Row style={{ gap: 6 }}>
        <Text fontSize={8} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          x{signed(x)}
        </Text>
        <Text fontSize={8} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          y{signed(y)}
        </Text>
      </Row>
    </Col>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function signed(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(2);
}
