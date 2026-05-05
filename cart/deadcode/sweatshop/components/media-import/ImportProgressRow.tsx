
import { Box, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { MediaImportItem } from './useMediaImport';

function statusTone(status: MediaImportItem['status']): string {
  if (status === 'ready') return COLORS.green;
  if (status === 'failed') return COLORS.red;
  if (status === 'loading') return COLORS.blue;
  return COLORS.textDim;
}

export function ImportProgressRow(props: { item: MediaImportItem }) {
  const item = props.item;
  const fill = item.status === 'ready' ? 1 : item.status === 'loading' ? 0.55 : item.status === 'failed' ? 1 : 0.18;
  return (
    <Box style={{ gap: 5, padding: 8, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>{item.name}</Text>
        <Text fontSize={9} color={statusTone(item.status)} style={{ fontWeight: 'bold' }}>{item.status}</Text>
      </Row>
      <Box style={{ height: 4, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.borderSoft, overflow: 'hidden' }}>
        <Box style={{ width: `${Math.round(fill * 100)}%`, height: 4, backgroundColor: statusTone(item.status) }} />
      </Box>
    </Box>
  );
}
