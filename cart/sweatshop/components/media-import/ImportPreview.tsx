const React: any = require('react');

import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ImportCard } from './ImportCard';
import type { MediaImportItem } from './useMediaImport';

const WIDTHS: Record<number, number> = { 1: 999, 2: 320, 3: 240, 4: 190, 5: 160, 6: 140 };

export function ImportPreview(props: { items: MediaImportItem[]; thumbSize: number; density: number; onRemove: (id: string) => void }) {
  const cardWidth = WIDTHS[props.density] || 190;
  return (
    <Col style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Preview batch</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.items.length + ' items'}</Text>
      </Row>
      <Row style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {props.items.length === 0 ? (
          <Box style={{ width: '100%', padding: 14, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textDim}>Dropped files will appear here before you confirm the batch.</Text>
          </Box>
        ) : props.items.map((item) => (
          <Box key={item.id} style={{ width: cardWidth, flexGrow: 1, flexBasis: cardWidth, minWidth: Math.max(140, props.thumbSize + 48) }}>
            <ImportCard item={item} thumbSize={props.thumbSize} onRemove={() => props.onRemove(item.id)} />
          </Box>
        ))}
      </Row>
    </Col>
  );
}
