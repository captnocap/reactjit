import { Box, Col } from '@reactjit/runtime/primitives';
import { CHAT_CARD } from './tokens';

function ContextCliffSegment({ active, danger }: { active: boolean; danger: boolean }) {
  const color = danger ? CHAT_CARD.orange : 'theme:tool';

  return (
    <Box
      style={{
        width: 10,
        height: 17,
        backgroundColor: active ? color : CHAT_CARD.panelDeep,
        borderWidth: 1,
        borderColor: active ? color : 'theme:inkGhost',
        borderRadius: 2,
      }}
    />
  );
}

export function ContextCliffGutter({ fill = 0.84, slots = 18 }: { fill?: number; slots?: number }) {
  const segments = Array.from({ length: Math.max(1, slots | 0) }, (_, index) => index);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
  const activeCount = Math.round(segments.length * clamped);

  return (
    <Col
      style={{
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'theme:transparent',
      }}
    >
      {segments.map((slot) => (
        <ContextCliffSegment key={slot} active={slot < activeCount} danger={slot >= 20 && slot < activeCount} />
      ))}
    </Col>
  );
}
