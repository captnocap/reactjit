import { Row, Text } from '@reactjit/runtime/primitives';
import {
  DEFAULT_GENERIC_CARD_ROWS,
  GENERIC_CARD,
  GenericCardRow,
  genericCardToneColor,
} from './genericCardShared';
import { classifiers as S } from '@reactjit/core';

export type GenericCardDataRowProps = {
  row?: GenericCardRow;
  index?: number;
};

export function GenericCardDataRow({
  row = DEFAULT_GENERIC_CARD_ROWS[0],
  index = 0,
}: GenericCardDataRowProps) {
  const tone = row.tone ?? 'soft';

  return (
    <S.InlineX5Between>
      <Row style={{ alignItems: 'center', gap: 7 }}>
        <Text style={{ width: 20, fontFamily: 'monospace', fontSize: 9, color: GENERIC_CARD.rowIndexText }}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text style={{ width: 122, fontFamily: 'monospace', fontSize: 10, color: GENERIC_CARD.rowLabelText }}>{row.label}</Text>
      </Row>
      <Text style={{ width: 58, fontFamily: 'monospace', fontSize: 10, color: genericCardToneColor(tone) }}>{row.value}</Text>
    </S.InlineX5Between>
  );
}
