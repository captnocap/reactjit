const React: any = require('react');
const { useCallback } = React;

import { Box, Col, Graph, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface KnobProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  accent?: string;
  taper?: 'linear' | 'log';
  size?: number;
  onChange: (v: number) => void;
}

// Step-knob: – / reset / + controls plus a Graph.Path arc that fills with
// the current value. Pointer drag would be nicer but primitive support for
// onPointerMove isn't available; step controls keep it usable everywhere.
export function Knob(props: KnobProps) {
  const { label, value, onChange } = props;
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const unit = props.unit ?? '';
  const size = props.size ?? 56;
  const accent = props.accent ?? (COLORS.blue || '#79c0ff');
  const taper = props.taper ?? 'linear';

  const frac = toFrac(value, min, max, taper);
  const clamped = Math.max(0, Math.min(1, frac));
  const step = (max - min) / 40;

  const nudge = useCallback((dir: number) => {
    onChange(Math.max(min, Math.min(max, value + dir * step)));
  }, [onChange, value, min, max, step]);

  const reset = useCallback(() => onChange((min + max) / 2), [onChange, min, max]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  // arc from -135deg to +135deg (270° total)
  const a0 = -135 * Math.PI / 180;
  const a1 = (-135 + 270 * clamped) * Math.PI / 180;
  const x1 = cx + r * Math.cos(a0);
  const y1 = cy + r * Math.sin(a0);
  const x2 = cx + r * Math.cos(a1);
  const y2 = cy + r * Math.sin(a1);
  const large = clamped > 0.5 ? 1 : 0;
  const pointerX = cx + r * 0.8 * Math.cos(a1);
  const pointerY = cy + r * 0.8 * Math.sin(a1);
  const arcD = 'M ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1);

  return (
    <Col style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Pressable onPress={reset} onLongPress={reset}>
        <Box style={{ width: size, height: size }}>
          <Graph style={{ width: size, height: size }}>
            <Graph.Path d={'M ' + (cx + r * Math.cos(a0)).toFixed(1) + ' ' + (cy + r * Math.sin(a0)).toFixed(1) + ' A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r * Math.cos(135 * Math.PI / 180)).toFixed(1) + ' ' + (cy + r * Math.sin(135 * Math.PI / 180)).toFixed(1)}
              stroke={COLORS.border || '#1f2630'} strokeWidth={3} fill="none" />
            <Graph.Path d={arcD} stroke={accent} strokeWidth={3} fill="none" />
            <Graph.Path d={'M ' + cx + ' ' + cy + ' L ' + pointerX.toFixed(1) + ' ' + pointerY.toFixed(1)} stroke={COLORS.textBright} strokeWidth={2} fill="none" />
          </Graph>
        </Box>
      </Pressable>
      <Row style={{ gap: 2 }}>
        <Pressable onPress={() => nudge(-1)} style={miniBtn()}><Text style={miniTxt()}>−</Text></Pressable>
        <Pressable onPress={reset}           style={miniBtn()}><Text style={miniTxt()}>·</Text></Pressable>
        <Pressable onPress={() => nudge(1)}  style={miniBtn()}><Text style={miniTxt()}>+</Text></Pressable>
      </Row>
      <Text style={{ color: accent, fontSize: 9, fontWeight: 700 }}>
        {value.toFixed(Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2)}{unit}
      </Text>
    </Col>
  );
}

function toFrac(value: number, min: number, max: number, taper: 'linear' | 'log'): number {
  if (taper === 'log' && min > 0) {
    const lMin = Math.log(min); const lMax = Math.log(max);
    const lV = Math.log(Math.max(min, value));
    return (lV - lMin) / (lMax - lMin);
  }
  return (value - min) / Math.max(1e-9, max - min);
}

function miniBtn(): any {
  return {
    width: 18, height: 16, borderRadius: 3,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
    alignItems: 'center', justifyContent: 'center',
  };
}
function miniTxt(): any {
  return { color: COLORS.textDim, fontSize: 10, fontWeight: 700 };
}
