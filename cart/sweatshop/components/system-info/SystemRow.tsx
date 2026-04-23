import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function SystemRow(props: { label: string; value: string; muted?: boolean }) {
  return (
    <Row style={{ gap: 10, alignItems: 'flex-start', paddingTop: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ width: 88, fontWeight: 'bold' }}>{props.label}</Text>
      <Box style={{ flexGrow: 1, flexBasis: 0 }}>
        <Text fontSize={10} color={props.muted ? COLORS.textDim : COLORS.textBright} style={{ fontFamily: TOKENS.fontMono }}>{props.value || 'unknown'}</Text>
      </Box>
    </Row>
  );
}

export default SystemRow;
