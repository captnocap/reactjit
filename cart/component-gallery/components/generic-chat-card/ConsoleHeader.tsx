import { Col, Row } from '../../../../runtime/primitives';
import { IdentityBlock } from './IdentityBadges';
import { StatusPulse } from './StatusPulse';
import { TrustThermometerAvatar } from './TrustAvatar';
import { CHAT_CARD, type ConsoleMode } from './tokens';

export type ConsoleHeaderProps = {
  title: string;
  pathology: string;
  achievement: string;
  trust: string;
  note: string;
  mode: ConsoleMode;
};

export function ConsoleHeader({ title, pathology, achievement, trust, note, mode }: ConsoleHeaderProps) {
  return (
    <Col
      style={{
        gap: 0,
        backgroundColor: CHAT_CARD.panel,
        borderWidth: 1,
        borderColor: '#604938',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10 }}>
        <Row style={{ alignItems: 'center', gap: 9 }}>
          <TrustThermometerAvatar value={trust} />
          <IdentityBlock title={title} pathology={pathology} achievement={achievement} note={note} />
        </Row>
        <StatusPulse mode={mode} />
      </Row>
    </Col>
  );
}
