import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';

export type BasicWorkerMessage = {
  author: 'worker' | 'user';
  text: string;
};

export type BasicWorkerCardProps = {
  workerId?: string;
  status?: 'idle' | 'working' | 'stuck';
  messages?: BasicWorkerMessage[];
};

const COLORS = {
  bg: '#14100d',
  border: '#4a4238',
  text: '#f2e8dc',
  muted: '#5a8bd6',
  worker: '#d26a2a',
  user: '#6ac3d6',
  dot: { idle: '#5a8bd6', working: '#6aa390', stuck: '#d26a2a' },
};

const DEFAULT_MESSAGES: BasicWorkerMessage[] = [
  { author: 'user', text: 'Run the next step.' },
  { author: 'worker', text: 'Acknowledged. Working on it.' },
  { author: 'worker', text: 'Step complete.' },
];

export function BasicWorkerCard({
  workerId = 'worker-01',
  status = 'working',
  messages = DEFAULT_MESSAGES,
}: BasicWorkerCardProps) {
  return (
    <Col
      style={{
        width: 280,
        backgroundColor: COLORS.bg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 4,
      }}
    >
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}
      >
        <S.SectionLabel>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.dot[status] }} />
          <Text style={{ fontFamily: 'monospace', fontSize: 9, color: COLORS.text }}>{workerId}</Text>
        </S.SectionLabel>
        <Text style={{ fontFamily: 'monospace', fontSize: 8, color: COLORS.muted }}>{status}</Text>
      </Row>

      <Col style={{ padding: 10, gap: 8 }}>
        {messages.map((msg, i) => (
          <S.StackX1 key={i}>
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: 7,
                fontWeight: 'bold',
                color: msg.author === 'worker' ? COLORS.worker : COLORS.user,
              }}
            >
              {msg.author === 'worker' ? 'WORKER' : 'YOU'}
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 10, color: COLORS.text }}>{msg.text}</Text>
          </S.StackX1>
        ))}
      </Col>
    </Col>
  );
}
