import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { CHAT_CARD } from './tokens';
import { classifiers as S } from '@reactjit/core';

export function PathologyBadge({ label }: { label: string }) {
  return (
    <Box
      style={{
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#3a2a1e',
        borderWidth: 1,
        borderColor: CHAT_CARD.pink,
        borderRadius: 3,
      }}
    >
      <Text style={{ fontFamily: 'monospace', fontSize: 7, fontWeight: 'bold', color: CHAT_CARD.pink }}>{label}</Text>
    </Box>
  );
}

export function AchievementBadge({ label }: { label: string }) {
  return (
    <Box
      style={{
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        backgroundColor: '#3a2a1e',
        borderWidth: 1,
        borderColor: '#8a4a20',
        borderRadius: 3,
      }}
    >
      <S.InlineX2>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.orange }}>T</Text>
        <Text style={{ fontFamily: 'monospace', fontSize: 7, color: CHAT_CARD.orange }}>{label}</Text>
      </S.InlineX2>
    </Box>
  );
}

export function IdentityBlock({
  title,
  pathology,
  achievement,
  note,
}: {
  title: string;
  pathology: string;
  achievement: string;
  note: string;
}) {
  return (
    <Col style={{ flexGrow: 1, gap: 5 }}>
      <Row style={{ alignItems: 'center', gap: 7 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', color: CHAT_CARD.text }}>{title}</Text>
        <PathologyBadge label={pathology} />
        <AchievementBadge label={achievement} />
      </Row>
      <Text style={{ fontFamily: 'monospace', fontSize: 9, color: CHAT_CARD.muted }}>{note}</Text>
    </Col>
  );
}
