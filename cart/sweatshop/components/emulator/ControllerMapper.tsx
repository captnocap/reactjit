
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ControllerBindings } from '../../lib/emulator/hooks/useController';

const BUTTON_LABELS: Record<keyof ControllerBindings, string> = {
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  a: 'A',
  b: 'B',
  start: 'Start',
  select: 'Select',
};

export function ControllerMapper(props: {
  bindings: ControllerBindings;
  onChange: (next: Partial<ControllerBindings>) => void;
  onReset: () => void;
}) {
  const [capturing, setCapturing] = useState<keyof ControllerBindings | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      props.onChange({ [capturing]: e.key });
      setCapturing(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturing, props.onChange]);

  return (
    <Box style={{ padding: 10, gap: 6, backgroundColor: COLORS.panelRaised, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>Controller Bindings</Text>
        <Pressable onPress={props.onReset} style={{ padding: 6, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.textDim}>Reset</Text>
        </Pressable>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {(Object.keys(BUTTON_LABELS) as Array<keyof ControllerBindings>).map((key) => (
          <Pressable
            key={key}
            onPress={() => setCapturing(key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: capturing === key ? COLORS.blueDeep : COLORS.panelAlt,
              borderWidth: 1,
              borderColor: capturing === key ? COLORS.blue : COLORS.border,
            }}
          >
            <Text fontSize={9} color={COLORS.textMuted}>{BUTTON_LABELS[key]}</Text>
            <Text fontSize={10} color={capturing === key ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
              {capturing === key ? 'Press key...' : props.bindings[key]}
            </Text>
          </Pressable>
        ))}
      </Row>
    </Box>
  );
}
