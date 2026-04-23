import { Row, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

export function TelemetryStat({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'muted' | 'hot' | 'plain' }) {
  const valueColor = tone === 'hot' ? CHAT_CARD.pink : tone === 'plain' ? CHAT_CARD.text : CHAT_CARD.orange;

  return (
    <Row style={{ gap: 3 }}>
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.muted }}>{`${label}:`}</Text>
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: valueColor }}>{value}</Text>
    </Row>
  );
}

export function TelemetryStats({ state, time }: { state: string; time: string }) {
  return (
    <Row style={{ gap: 9, alignItems: 'center' }}>
      <TelemetryStat label="status" value={state} />
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>|</Text>
      <TelemetryStat label="tps" value="0.0" tone="hot" />
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.faint }}>|</Text>
      <TelemetryStat label="time" value={time} tone="plain" />
    </Row>
  );
}
