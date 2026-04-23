import { Box, Col } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

function ContextCliffSegment({ active, danger }: { active: boolean; danger: boolean }) {
  const color = danger ? CHAT_CARD.orange : '#7acff4';

  return (
    <Box
      style={{
        width: 10,
        height: 17,
        backgroundColor: active ? color : CHAT_CARD.panelDeep,
        borderWidth: 1,
        borderColor: active ? color : '#35405f',
        borderRadius: 2,
      }}
    />
  );
}

export function ContextCliffGutter({ fill = 0.84 }: { fill?: number }) {
  const slots = Array.from({ length: 25 }, (_, index) => index);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
  const activeCount = Math.round(slots.length * clamped);

  return (
    <Col
      style={{
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'transparent',
      }}
    >
      {slots.map((slot) => (
        <ContextCliffSegment key={slot} active={slot < activeCount} danger={slot >= 20 && slot < activeCount} />
      ))}
    </Col>
  );
}
