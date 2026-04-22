import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../../theme';

interface Props {
  command: string;
  output: string;
  onClear: () => void;
}

export function ShellOutput({ command, output, onClear }: Props) {
  return (
    <Box
      style={{
        borderTopWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.panelBg,
        padding: 10,
        maxHeight: 140,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 9, color: COLORS.textDim }}>
          Output: {command}
        </Text>
        <Pressable onPress={onClear}>
          <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Clear</Text>
        </Pressable>
      </Row>
      {output.split('\n').slice(0, 12).map((line, i) => (
        <Text
          key={i}
          style={{
            fontSize: 10,
            color: COLORS.textMuted,
            fontFamily: 'monospace',
          }}
        >
          {line.slice(0, 90)}
        </Text>
      ))}
    </Box>
  );
}
