
import { Box, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function TokenizationSegment(props: any) {
  if (props.compactBand) return null;
  const indexStats = props.indexStats || { totalFiles: 0, totalTokens: 0 };
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}
      tooltip={`Tokens: ${indexStats.totalTokens.toLocaleString()}`}
    >
      <Box style={{ width: 36, height: 3, backgroundColor: COLORS.grayChip, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ width: `${Math.min(1, indexStats.totalTokens / 100000) * 100}%`, height: 3, backgroundColor: COLORS.purple }} />
      </Box>
      <Text fontSize={9} color={COLORS.purple}>
        {indexStats.totalTokens > 0 ? `${Math.round(indexStats.totalTokens / 1000)}k` : '0'}
      </Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'tokenization',
  label: 'Tokenization',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 35,
  component: TokenizationSegment,
});
