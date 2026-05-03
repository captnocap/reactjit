import { Text } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexValueType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';

export type DexTypeBadgeProps = {
  type?: DexValueType;
};

const TYPE_COLOR: Record<DexValueType, string> = {
  string: DEX_COLORS.ok,
  number: DEX_COLORS.blue,
  boolean: DEX_COLORS.lilac,
  array: DEX_COLORS.warn,
  object: DEX_COLORS.accent,
  null: DEX_COLORS.inkDimmer,
};

export function DexTypeBadge({ type = 'string' }: DexTypeBadgeProps) {
  return (
    <Text
      style={{
        color: TYPE_COLOR[type],
        borderWidth: 1,
        borderColor: TYPE_COLOR[type],
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 1,
        paddingBottom: 1,
        fontSize: 8,
        textTransform: 'uppercase',
      }}
    >
      {type}
    </Text>
  );
}
