import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';
import { DexTypeBadge, type DexValueType } from '../dex-type-badge/DexTypeBadge';

export type DexTreeRowProps = {
  depth?: number;
  label?: string;
  value?: string;
  type?: DexValueType;
  open?: boolean;
  selected?: boolean;
  edited?: boolean;
  container?: boolean;
  onPress?: () => void;
};

export function DexTreeRow({
  depth = 0,
  label = 'confidence',
  value = '0.82',
  type = 'number',
  open = false,
  selected = false,
  edited = false,
  container = false,
  onPress,
}: DexTreeRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingLeft: 8,
        paddingRight: 8,
        backgroundColor: selected ? 'theme:bg1' : 'theme:transparent',
        borderLeftWidth: selected ? 2 : 0,
        borderColor: DEX_COLORS.accent,
      }}
    >
      <Text style={{ width: 12, color: container ? DEX_COLORS.accent : DEX_COLORS.ghost, fontSize: 10 }}>
        {container ? (open ? '▾' : '▸') : '·'}
      </Text>
      <Row style={{ width: depth * 14, height: 1 }}>
        {Array.from({ length: depth }).map((_, index) => (
          <Box key={index} style={{ width: 14, borderLeftWidth: 1, borderColor: DEX_COLORS.rule }} />
        ))}
      </Row>
      <Text style={{ minWidth: 90, color: DEX_COLORS.ink, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: DEX_COLORS.ghost, fontSize: 11 }}>:</Text>
      <Text style={{ flex: 1, color: edited ? DEX_COLORS.accent : DEX_COLORS.inkDim, fontSize: 11 }}>
        {value}
      </Text>
      <DexTypeBadge type={type} />
    </Pressable>
  );
}
