
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

// Renders a live in-progress assistant stream with a blinking cursor.
// Caller feeds `text` as it accumulates; this component just decorates.
// When `done` flips true the cursor stops blinking.

export function StreamingMessage(props: { text: string; done?: boolean }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (props.done) { setOn(false); return; }
    const id = (globalThis as any).setInterval(() => setOn((v: boolean) => !v), 500);
    return () => (globalThis as any).clearInterval(id);
  }, [props.done]);

  return (
    <Row style={{ gap: TOKENS.spaceSm, alignItems: 'flex-start' }}>
      <Box style={{
        width: 22, height: 22, borderRadius: TOKENS.radiusPill,
        borderWidth: TOKENS.borderW, borderColor: COLORS.green,
        backgroundColor: COLORS.panelAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.green} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>A</Text>
      </Box>
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.green} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold', letterSpacing: 0.5 }}>
          ASSISTANT {props.done ? '' : '· streaming'}
        </Text>
        <Row style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Text fontSize={TOKENS.fontSm} color={COLORS.text} style={{ fontFamily: TOKENS.fontUI }}>{props.text}</Text>
          {props.done ? null : (
            <Text fontSize={TOKENS.fontSm} color={on ? COLORS.green : 'transparent'} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>▍</Text>
          )}
        </Row>
      </Col>
    </Row>
  );
}
