
import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import type { LogEntry } from './useLogStream';

const LEVEL_TONE: Record<string, string> = {
  debug: COLORS.textDim,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_BG: Record<string, string> = {
  debug: COLORS.grayChip,
  info: COLORS.blueDeep,
  warn: COLORS.yellowDeep,
  error: COLORS.redDeep,
};

function formatTime(ts: number, fmt: 'iso' | 'time' | 'relative'): string {
  const d = new Date(ts);
  if (fmt === 'iso') return d.toISOString().slice(11, 23);
  if (fmt === 'time') return d.toLocaleTimeString();
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export interface LogRowProps {
  entry: LogEntry;
  selected: boolean;
  onPress: () => void;
  timestampFormat: 'iso' | 'time' | 'relative';
  colorPerCategory: boolean;
  categoryColors: Record<string, string>;
}

export function LogRow(props: LogRowProps) {
  const { entry, selected, onPress, timestampFormat, colorPerCategory, categoryColors } = props;
  const levelColor = LEVEL_TONE[entry.level] || COLORS.textDim;
  const catColor = colorPerCategory && categoryColors[entry.category] ? categoryColors[entry.category] : COLORS.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 6,
        backgroundColor: selected ? COLORS.panelHover : 'transparent',
      }}
    >
      <Text fontSize={9} color={COLORS.textDim} style={{ minWidth: 70 }}>
        {formatTime(entry.timestamp, timestampFormat)}
      </Text>

      <Box
        style={{
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
          backgroundColor: LEVEL_BG[entry.level] || COLORS.grayChip,
          minWidth: 36,
          alignItems: 'center',
        }}
      >
        <Text fontSize={9} color={levelColor} style={{ fontWeight: 'bold' }}>
          {entry.level.toUpperCase()}
        </Text>
      </Box>

      <Box
        style={{
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
          backgroundColor: COLORS.grayChip,
        }}
      >
        <Text fontSize={9} color={catColor}>
          {entry.category}
        </Text>
      </Box>

      <Text fontSize={10} color={COLORS.text} numberOfLines={1} style={{ flexGrow: 1, flexBasis: 0 }}>
        {entry.message}
      </Text>
    </Pressable>
  );
}
