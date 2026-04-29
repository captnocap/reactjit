
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ToolCall } from '../../lib/ai/types';

// Expandable card for a single tool invocation. Click to reveal args +
// result. Kept visually distinct from MessageBubble so tool rounds
// don't read as chat noise.

function pretty(json: string): string {
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
}

export function ToolCallCard(props: {
  call: ToolCall;
  result?: string;
  error?: string;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = props.error ? COLORS.red : props.pending ? COLORS.yellow : COLORS.green;

  return (
    <Box style={{
      borderRadius: TOKENS.radiusSm,
      borderWidth: TOKENS.borderW,
      borderColor: tone,
      backgroundColor: COLORS.panelRaised,
      padding: TOKENS.padNormal,
      gap: TOKENS.spaceXs,
    }}>
      <Pressable onPress={() => setOpen(!open)}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Text fontSize={TOKENS.fontXs} color={tone} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>
            {open ? '▾' : '▸'} TOOL
          </Text>
          <Text fontSize={TOKENS.fontSm} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, flexGrow: 1, flexBasis: 0 }}>
            {props.call.name}
          </Text>
          <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
            {props.pending ? 'pending' : props.error ? 'error' : 'ok'}
          </Text>
        </Row>
      </Pressable>
      {open ? (
        <Col style={{ gap: TOKENS.spaceXs }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>ARGS</Text>
          <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg }}>
            <Box style={{ padding: TOKENS.padNormal }}>
              <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>{pretty(props.call.arguments || '{}')}</Text>
            </Box>
          </ScrollView>
          {props.result || props.error ? (
            <Col style={{ gap: 2 }}>
              <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>RESULT</Text>
              <ScrollView style={{ maxHeight: 180, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg }}>
                <Box style={{ padding: TOKENS.padNormal }}>
                  <Text fontSize={TOKENS.fontXs} color={props.error ? COLORS.red : COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>
                    {props.error || props.result}
                  </Text>
                </Box>
              </ScrollView>
            </Col>
          ) : null}
        </Col>
      ) : null}
    </Box>
  );
}
