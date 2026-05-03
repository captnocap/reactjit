import { Col, Text } from '@reactjit/runtime/primitives';
import {
  DEFAULT_GENERIC_CARD_SUBTITLE,
  DEFAULT_GENERIC_CARD_TITLE,
  GENERIC_CARD,
} from './genericCardShared';

export type GenericCardTitleBlockProps = {
  title?: string;
  subtitle?: string;
};

export function GenericCardTitleBlock({
  title = DEFAULT_GENERIC_CARD_TITLE,
  subtitle = DEFAULT_GENERIC_CARD_SUBTITLE,
}: GenericCardTitleBlockProps) {
  return (
    <Col style={{ gap: 3 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: GENERIC_CARD.bodyText }}>{title}</Text>
      <Text style={{ fontSize: 11, color: GENERIC_CARD.mutedText }}>{subtitle}</Text>
    </Col>
  );
}
