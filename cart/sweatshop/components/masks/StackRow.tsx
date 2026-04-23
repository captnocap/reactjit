import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { getMaskDef } from './maskCatalog';
import { MaskChip } from './MaskChip';
import type { MaskStackItem } from './maskCatalog';

export function StackRow(props: {
  item: MaskStackItem;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const def = getMaskDef(props.item.maskId);
  return (
    <Pressable onPress={props.onSelect} style={{ padding: 10, gap: 8, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: props.selected ? COLORS.blue : COLORS.border, backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{def.label}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{def.desc}</Text>
        </Col>
        <MaskChip label={props.item.enabled ? 'on' : 'off'} active={props.item.enabled} onPress={props.onToggle} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <MaskChip label="up" onPress={props.onMoveUp} />
        <MaskChip label="down" onPress={props.onMoveDown} />
        <MaskChip label="remove" muted={true} onPress={props.onRemove} />
      </Row>
    </Pressable>
  );
}
