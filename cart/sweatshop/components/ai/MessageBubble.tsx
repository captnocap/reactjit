
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { Message } from '../../lib/ai/types';

function roleTone(role: string): string {
  if (role === 'user')      return COLORS.blue;
  if (role === 'assistant') return COLORS.green;
  if (role === 'system')    return COLORS.purple;
  if (role === 'tool')      return COLORS.yellow;
  return COLORS.text;
}

function roleAvatar(role: string): string {
  if (role === 'user')      return 'U';
  if (role === 'assistant') return 'A';
  if (role === 'system')    return 'S';
  if (role === 'tool')      return 'T';
  return '?';
}

function renderContent(content: Message['content']): string {
  if (typeof content === 'string') return content;
  let out = '';
  for (const b of content) {
    if (b.type === 'text') out += b.text || '';
    else if (b.type === 'image_url') out += '[image: ' + (b.image_url?.url || '') + ']';
  }
  return out;
}

// Small markdown fence detector — we don't ship a full renderer, but
// fenced blocks get the mono font for legibility. Anything else goes
// through as plain text.
function splitByFence(text: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = [];
  const lines = text.split('\n');
  let buf: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (buf.length) parts.push({ code: inFence, text: buf.join('\n') });
      buf = [];
      inFence = !inFence;
      continue;
    }
    buf.push(line);
  }
  if (buf.length) parts.push({ code: inFence, text: buf.join('\n') });
  return parts;
}

export function MessageBubble(props: { message: Message }) {
  const { message } = props;
  const tone = roleTone(message.role);
  const text = renderContent(message.content);
  const parts = splitByFence(text);
  const hasToolCalls = !!(message.toolCalls && message.toolCalls.length);

  return (
    <Row style={{ gap: TOKENS.spaceSm, alignItems: 'flex-start' }}>
      <Box style={{
        width: 22, height: 22,
        borderRadius: TOKENS.radiusPill,
        borderWidth: TOKENS.borderW,
        borderColor: tone,
        backgroundColor: COLORS.panelAlt,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text fontSize={TOKENS.fontXs} color={tone} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{roleAvatar(message.role)}</Text>
      </Box>
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={TOKENS.fontXs} color={tone} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold', letterSpacing: 0.5 }}>{message.role.toUpperCase()}</Text>
          {hasToolCalls ? (
            <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
              <Text fontSize={9} color={COLORS.yellow} style={{ fontFamily: TOKENS.fontMono }}>tool×{message.toolCalls!.length}</Text>
            </Box>
          ) : null}
        </Row>
        {parts.map((p, i) => (
          <Box key={i} style={p.code ? {
            padding: TOKENS.padNormal, borderRadius: TOKENS.radiusSm,
            borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg,
          } : {}}>
            <Text fontSize={TOKENS.fontSm} color={COLORS.text} style={{ fontFamily: p.code ? TOKENS.fontMono : TOKENS.fontUI }}>{p.text}</Text>
          </Box>
        ))}
      </Col>
    </Row>
  );
}
