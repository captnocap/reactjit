const React: any = require('react');
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { findModelById } from '../../providers';

export function ContextMeter(props: { messages: any[]; modelId: string }) {
  const messages = Array.isArray(props.messages) ? props.messages : [];
  const model = findModelById(props.modelId);
  const limit = model?.contextWindow || 200000;
  const textLength = messages.reduce((sum: number, m: any) => sum + (typeof m.text === 'string' ? m.text.length : 0), 0);
  const tokens = Math.ceil(textLength / 4);
  const pct = Math.min(100, Math.round((tokens / limit) * 100));
  const color = pct > 80 ? COLORS.red : pct > 50 ? COLORS.yellow : COLORS.green;
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: color, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={7} color={color} style={{ fontWeight: 'bold' }}>{pct}%</Text>
      </Box>
      {!messages.length || messages.length < 2 ? null : (
        <Text fontSize={9} color={COLORS.textDim}>{tokens.toLocaleString()} / {limit.toLocaleString()}</Text>
      )}
    </Row>
  );
}
