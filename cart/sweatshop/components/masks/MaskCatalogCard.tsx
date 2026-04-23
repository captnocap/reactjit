import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { getMaskDef } from './maskCatalog';
import { MaskChip } from './MaskChip';
import type { MaskStackItem } from './maskCatalog';

export function MaskCatalogCard(props: { maskId: MaskStackItem['maskId']; selected: boolean; onAdd: () => void }) {
  const def = getMaskDef(props.maskId);
  return (
    <Pressable onPress={props.onAdd}>
      <Box style={{ gap: 6, padding: 10, minHeight: 92, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: props.selected ? COLORS.blue : COLORS.borderSoft, backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelRaised }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{def.label}</Text>
          <MaskChip label="+" active={true} />
        </Row>
        <Text fontSize={9} color={COLORS.textDim}>{def.desc}</Text>
      </Box>
    </Pressable>
  );
}
