const React: any = require('react');
import { Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';

export function AttachmentRail(props: {
  attachments: any[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!props.attachments || props.attachments.length === 0) return null;
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {props.attachments.map((attachment: any) => (
        <Row key={attachment.id} style={{ alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.blue}>{attachment.name}</Text>
          <HoverPressable onPress={() => props.onRemove(attachment.id)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={COLORS.textDim}>X</Text>
          </HoverPressable>
        </Row>
      ))}
      <HoverPressable onPress={props.onClear} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
        <Text fontSize={10} color={COLORS.red}>Clear</Text>
      </HoverPressable>
    </Row>
  );
}
