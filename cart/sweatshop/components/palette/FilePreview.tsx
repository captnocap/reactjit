import { Box, Text } from '../../../runtime/primitives';
import { COLORS } from '../../theme';

interface Props {
  path: string;
  lines: string[];
}

export function FilePreview({ path, lines }: Props) {
  return (
    <Box
      style={{
        borderTopWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.panelBg,
        padding: 10,
        maxHeight: 120,
      }}
    >
      <Text style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 4 }}>
        Preview: {path}
      </Text>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={{
            fontSize: 10,
            color: COLORS.textMuted,
            fontFamily: 'monospace',
          }}
        >
          {String(i + 1).padStart(3, ' ')}  {line.slice(0, 80)}
        </Text>
      ))}
    </Box>
  );
}
