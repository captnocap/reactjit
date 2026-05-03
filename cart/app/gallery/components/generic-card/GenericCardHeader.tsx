import { Row, Text } from '@reactjit/runtime/primitives';
import {
  DEFAULT_GENERIC_CARD_EYEBROW,
  DEFAULT_GENERIC_CARD_SCORE,
  GENERIC_CARD,
} from './genericCardShared';

export type GenericCardHeaderProps = {
  eyebrow?: string;
  score?: string;
};

export function GenericCardHeader({
  eyebrow = DEFAULT_GENERIC_CARD_EYEBROW,
  score = DEFAULT_GENERIC_CARD_SCORE,
}: GenericCardHeaderProps) {
  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          fontWeight: 'bold',
          color: GENERIC_CARD.eyebrowText,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: GENERIC_CARD.scoreText,
        }}
      >
        {score}
      </Text>
    </Row>
  );
}
