
import { Box, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

interface GitGraphLaneProps {
  graph: string;
  color?: string;
}

export function GitGraphLane(props: GitGraphLaneProps) {
  const color = props.color || COLORS.blue;
  const chars = (props.graph || '').split('');

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 0, paddingRight: 4 }}>
      {chars.map((ch, i) => {
        const tone = ch === '*' ? COLORS.textBright : color;
        return (
          <Text key={i} fontSize={10} color={tone} style={{ fontFamily: 'monospace', lineHeight: 14 }}>
            {ch === ' ' ? '\u00A0' : ch}
          </Text>
        );
      })}
    </Box>
  );
}
