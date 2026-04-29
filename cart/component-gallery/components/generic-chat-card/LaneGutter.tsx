import { Box, Col, Text } from '@reactjit/runtime/primitives';
import { CHAT_CARD } from './tokens';

export type LaneToken = {
  label: string;
  active?: boolean;
  tone?: 'warm' | 'amber' | 'cool' | 'cyan' | 'soft' | 'danger';
};

const TONE_BORDER = {
  warm: '#e8501c',
  amber: '#d26a2a',
  cool: '#5a8bd6',
  cyan: '#5a8bd6',
  soft: CHAT_CARD.violet,
  danger: '#e14a2a',
};

function LaneTokenCell({ token }: { token: LaneToken }) {
  const tone = token.tone ?? 'soft';
  const color = TONE_BORDER[tone];

  return (
    <Box
      style={{
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: token.active ? color : CHAT_CARD.panelDeep,
        borderWidth: 1,
        borderColor: color,
        borderRadius: 3,
      }}
    >
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: token.active ? '#0e0b09' : CHAT_CARD.muted }}>{token.label}</Text>
    </Box>
  );
}

export function LaneGutter({ tokens }: { tokens: LaneToken[] }) {
  return (
    <Col
      style={{
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'transparent',
      }}
    >
      {tokens.map((token, index) => (
        <LaneTokenCell key={`${token.label}-${index}`} token={token} />
      ))}
    </Col>
  );
}
