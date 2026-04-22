
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface FaderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  unit?: string;
  accent?: string;
  height?: number;
  onChange: (v: number) => void;
}

// Discrete-step fader: tap the track above/below the handle to step up/down.
// Long form (pointer drag) needs onPointerMove which isn't in the primitive
// set — a stepper layout is still usable and matches cart/cockpit styling.
export function Fader(props: FaderProps) {
  const { label, value, onChange } = props;
  const min = props.min ?? 0;
  const max = props.max ?? 1;
  const unit = props.unit ?? '';
  const accent = props.accent ?? (COLORS.blue || '#79c0ff');
  const h = props.height ?? 120;
  const frac = (value - min) / Math.max(1e-9, (max - min));
  const clamped = Math.max(0, Math.min(1, frac));
  const step = (max - min) / 40;

  const nudge = useCallback((dir: number) => {
    onChange(Math.max(min, Math.min(max, value + dir * step)));
  }, [onChange, value, min, max, step]);

  const setFromFrac = useCallback((f: number) => {
    onChange(min + Math.max(0, Math.min(1, f)) * (max - min));
  }, [onChange, min, max]);

  return (
    <Col style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Box style={{
        width: 22, height: h,
        backgroundColor: COLORS.panelAlt || '#05090f',
        borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        position: 'relative', overflow: 'hidden',
      }}>
        <Pressable onPress={() => nudge(1)} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h * (1 - clamped) }}>
          <Box style={{ width: '100%', height: '100%' }} />
        </Pressable>
        <Box style={{
          position: 'absolute', left: 2, right: 2, bottom: 0, height: h * clamped,
          backgroundColor: accent, borderRadius: 2, opacity: 0.85,
        }} />
        <Pressable onPress={() => nudge(-1)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * clamped }}>
          <Box style={{ width: '100%', height: '100%' }} />
        </Pressable>
        <Box style={{
          position: 'absolute', left: -4, right: -4,
          top: h * (1 - clamped) - 3,
          height: 6, borderRadius: 2,
          backgroundColor: COLORS.textBright, opacity: 0.9,
        }} />
      </Box>
      <Row style={{ gap: 2 }}>
        <Pressable onPress={() => setFromFrac(0)}   style={miniBtn()}><Text style={miniTxt()}>0</Text></Pressable>
        <Pressable onPress={() => setFromFrac(0.5)} style={miniBtn()}><Text style={miniTxt()}>½</Text></Pressable>
        <Pressable onPress={() => setFromFrac(1)}   style={miniBtn()}><Text style={miniTxt()}>1</Text></Pressable>
      </Row>
      <Text style={{ color: accent, fontSize: 10, fontWeight: 700 }}>
        {value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)}{unit}
      </Text>
    </Col>
  );
}

function miniBtn(): any {
  return {
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
  };
}
function miniTxt(): any {
  return { color: COLORS.textDim, fontSize: 8, fontWeight: 700 };
}
