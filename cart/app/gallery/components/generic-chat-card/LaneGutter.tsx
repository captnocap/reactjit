import { Box, Col, Text } from '@reactjit/runtime/primitives';
import { CHAT_CARD } from './tokens';

export type LaneToken = {
  label: string;
  active?: boolean;
  tone?: 'warm' | 'amber' | 'cool' | 'cyan' | 'soft' | 'danger';
};

const TONE_BORDER = {
  warm: 'theme:accentHot',
  amber: 'theme:accent',
  cool: 'theme:blue',
  cyan: 'theme:blue',
  soft: CHAT_CARD.violet,
  danger: 'theme:flag',
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
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: token.active ? 'theme:bg' : CHAT_CARD.muted }}>{token.label}</Text>
    </Box>
  );
}

export function LaneGutter({ tokens }: { tokens: LaneToken[] }) {
  return (
    <Col
      style={{
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'theme:transparent',
      }}
    >
      {tokens.map((token, index) => (
        <LaneTokenCell key={`${token.label}-${index}`} token={token} />
      ))}
    </Col>
  );
}
