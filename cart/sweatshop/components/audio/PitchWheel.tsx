
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface PitchWheelProps {
  label?: string;
  value: number;       // -1..1
  onChange: (v: number) => void;
  centerSnap?: boolean;
  accent?: string;
  height?: number;
  unit?: string;       // "st" semitones, etc.
}

// Vertical wheel that snaps back to center when released when centerSnap is on
// (classic pitch-bend behavior). Without pointer-drag, we provide fine-grain
// step controls and a center snap button.
export function PitchWheel(props: PitchWheelProps) {
  const { value, onChange } = props;
  const h = props.height ?? 120;
  const accent = props.accent ?? (COLORS.purple || '#d2a8ff');
  const snap = props.centerSnap ?? true;

  const fill = (value + 1) / 2; // 0..1
  const step = 0.05;

  const nudge = useCallback((d: number) => {
    onChange(Math.max(-1, Math.min(1, value + d * step)));
  }, [onChange, value, step]);

  const center = useCallback(() => onChange(0), [onChange]);

  return (
    <Col style={{ alignItems: 'center', gap: 3 }}>
      {props.label ? (
        <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{props.label.toUpperCase()}</Text>
      ) : null}
      <Box style={{
        width: 28, height: h,
        backgroundColor: COLORS.panelAlt || '#05090f',
        borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        position: 'relative', overflow: 'hidden',
      }}>
        <Box style={{ position: 'absolute', left: 0, right: 0, top: h / 2 - 0.5, height: 1, backgroundColor: COLORS.border || '#1f2630', opacity: 0.8 }} />
        <Pressable onPress={() => nudge(1)}  style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h / 2 }}><Box style={{ width: '100%', height: '100%' }} /></Pressable>
        <Pressable onPress={() => nudge(-1)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h / 2 }}><Box style={{ width: '100%', height: '100%' }} /></Pressable>
        <Box style={{
          position: 'absolute', left: -4, right: -4,
          top: h * (1 - fill) - 3,
          height: 6, borderRadius: 2,
          backgroundColor: accent,
        }} />
      </Box>
      <Row style={{ gap: 2 }}>
        <Pressable onPress={() => nudge(-1)} style={miniBtn()}><Text style={miniTxt()}>↓</Text></Pressable>
        <Pressable onPress={center}          style={{ ...miniBtn(), borderColor: snap ? accent : (COLORS.border || '#1f2630') }}>
          <Text style={{ ...miniTxt(), color: snap ? accent : COLORS.textDim }}>0</Text>
        </Pressable>
        <Pressable onPress={() => nudge(1)}  style={miniBtn()}><Text style={miniTxt()}>↑</Text></Pressable>
      </Row>
      <Text style={{ color: accent, fontSize: 10, fontWeight: 700 }}>
        {(value >= 0 ? '+' : '') + value.toFixed(2)}{props.unit || ''}
      </Text>
    </Col>
  );
}

function miniBtn(): any {
  return {
    width: 20, height: 16, borderRadius: 3,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
    alignItems: 'center', justifyContent: 'center',
  };
}
function miniTxt(): any {
  return { color: COLORS.textDim, fontSize: 9, fontWeight: 700 };
}
