const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { MediaImportItem } from './useMediaImport';
import { humanMediaSize } from './useMediaImport';

export function ImportConfirmFooter(props: {
  items: MediaImportItem[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const count = props.items.filter((item) => item.status === 'ready').length;
  const totalSize = props.items.reduce((sum, item) => sum + (item.status === 'ready' ? item.size : 0), 0);
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      <Text fontSize={10} color={COLORS.textDim}>{count + ' ready • ' + humanMediaSize(totalSize)}</Text>
      <Row style={{ gap: 8 }}>
        <Pressable onPress={props.onCancel} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={props.onConfirm} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Import batch</Text>
        </Pressable>
      </Row>
    </Row>
  );
}
