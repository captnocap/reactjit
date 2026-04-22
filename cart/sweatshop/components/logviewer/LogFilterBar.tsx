
import { Box, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { LogLevel } from './useLogStream';

const LEVEL_TONE: Record<LogLevel, string> = {
  debug: COLORS.textDim,
  info: COLORS.blue,
  warn: COLORS.yellow,
  error: COLORS.red,
};

const LEVEL_BG: Record<LogLevel, string> = {
  debug: COLORS.grayChip,
  info: COLORS.blueDeep,
  warn: COLORS.yellowDeep,
  error: COLORS.redDeep,
};

export interface LogFilterBarProps {
  activeLevels: Set<LogLevel>;
  toggleLevel: (level: LogLevel) => void;
  categories: string[];
  activeCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  search: string;
  onSearch: (q: string) => void;
  onTimeRange: (range: '5m' | '1h' | 'all') => void;
}

export function LogFilterBar(props: LogFilterBarProps) {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  return (
    <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
      {/* Level chips */}
      <Row style={{ gap: 4 }}>
        {levels.map((level) => {
          const active = props.activeLevels.has(level);
          return (
            <Pressable
              key={level}
              onPress={() => props.toggleLevel(level)}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 3,
                paddingBottom: 3,
                borderRadius: 4,
                backgroundColor: active ? LEVEL_BG[level] : COLORS.grayChip,
                borderWidth: 1,
                borderColor: active ? LEVEL_TONE[level] : COLORS.border,
              }}
            >
              <Text fontSize={9} color={active ? LEVEL_TONE[level] : COLORS.textDim} style={{ fontWeight: 'bold' }}>
                {level.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      {/* Category chips */}
      {props.categories.length > 0 && (
        <Row style={{ gap: 4 }}>
          {props.categories.map((cat) => {
            const active = props.activeCategories.has(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => props.toggleCategory(cat)}
                style={{
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 2,
                  paddingBottom: 2,
                  borderRadius: 4,
                  backgroundColor: active ? COLORS.panelHover : COLORS.grayChip,
                  borderWidth: 1,
                  borderColor: active ? COLORS.blue : COLORS.border,
                }}
              >
                <Text fontSize={9} color={active ? COLORS.blue : COLORS.textDim}>{cat}</Text>
              </Pressable>
            );
          })}
        </Row>
      )}

      {/* Search */}
      <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 120 }}>
        <TextInput
          value={props.search}
          onChangeText={props.onSearch}
          placeholder="Filter logs..."
          style={{
            height: 26,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 6,
            paddingLeft: 8,
            fontSize: 10,
            color: COLORS.text,
            backgroundColor: COLORS.panelBg,
          }}
        />
      </Box>

      {/* Time range quick picks */}
      <Row style={{ gap: 4 }}>
        {(['5m', '1h', 'all'] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => props.onTimeRange(r)}
            style={{
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
              backgroundColor: COLORS.grayChip,
            }}
          >
            <Text fontSize={9} color={COLORS.textDim}>{r}</Text>
          </Pressable>
        ))}
      </Row>
    </Row>
  );
}
