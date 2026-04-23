// =============================================================================
// ResponseStream — live streamed output for one column
// =============================================================================
// Renders the column's conversation history plus the currently-streaming
// partial (if any). Stop button cancels the live handle; regenerate button
// resends the last user prompt through the same column. Error state surfaces
// provider / network failures verbatim.
// =============================================================================

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { LlmColumn } from './hooks/useLlmStudioSession';
import { patchColumn } from './hooks/useLlmStudioSession';
import { regenerateColumn } from './hooks/useFanOut';

export interface ResponseStreamProps {
  column: LlmColumn;
}

function roleTone(role: string): string {
  if (role === 'user')      return COLORS.blue;
  if (role === 'assistant') return COLORS.green;
  if (role === 'system')    return COLORS.textDim;
  if (role === 'tool')      return COLORS.purple;
  return COLORS.text;
}

function contentString(v: any): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((b) => (b && b.text) ? b.text : '').join('\n');
  return '';
}

export function ResponseStream(props: ResponseStreamProps) {
  const col = props.column;
  const stopThis = () => { if (col.handle) { try { col.handle.stop(); } catch {} } patchColumn(col.id, { streaming: false, streamedText: '', handle: null }); };
  const canRegen = !col.streaming && col.messages.some((m) => m.role === 'user');
  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 120, gap: 4 }}>
      <ScrollView style={{
        flexGrow: 1, flexBasis: 0, minHeight: 120,
        borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: col.streaming ? COLORS.blue : COLORS.border,
        backgroundColor: COLORS.panelBg,
      }}>
        <Col style={{ padding: 8, gap: 6 }}>
          {col.messages.length === 0 && !col.streaming && !col.error ? (
            <Text fontSize={10} color={COLORS.textDim}>
              No run yet. Type a prompt in the composer at the top and hit Fan-out.
            </Text>
          ) : null}
          {col.messages.map((m, i) => (
            <Col key={i} style={{ gap: 2 }}>
              <Text fontSize={9} color={roleTone(m.role)} style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 0.5 }}>
                {m.role.toUpperCase()}
              </Text>
              <Text fontSize={11} color={COLORS.text} style={{ fontFamily: 'monospace' }}>
                {contentString(m.content)}
              </Text>
            </Col>
          ))}
          {col.streaming ? (
            <Col style={{ gap: 2 }}>
              <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 0.5 }}>
                ASSISTANT · streaming
              </Text>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>
                {col.streamedText || '…'}
              </Text>
            </Col>
          ) : null}
          {col.error ? (
            <Box style={{
              padding: 6, borderRadius: TOKENS.radiusSm,
              borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep,
            }}>
              <Text fontSize={10} color={COLORS.red} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>error</Text>
              <Text fontSize={10} color={COLORS.text} style={{ fontFamily: 'monospace' }}>{col.error}</Text>
            </Box>
          ) : null}
        </Col>
      </ScrollView>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {col.streaming ? (
          <Pressable onPress={stopThis} style={btn(COLORS.red, COLORS.redDeep)}>
            <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>stop</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => regenerateColumn(col.id)} style={btn(canRegen ? COLORS.blue : COLORS.textDim, COLORS.panelAlt)}>
          <Text fontSize={10} color={canRegen ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>regenerate</Text>
        </Pressable>
        <Pressable onPress={() => patchColumn(col.id, { messages: [], streamedText: '', error: null })}
          style={btn(COLORS.textDim, COLORS.panelAlt)}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>clear history</Text>
        </Pressable>
      </Row>
    </Col>
  );
}

function btn(borderColor: string, bg: string) {
  return {
    paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
    borderRadius: TOKENS.radiusSm, borderWidth: 1,
    borderColor, backgroundColor: bg,
  };
}
