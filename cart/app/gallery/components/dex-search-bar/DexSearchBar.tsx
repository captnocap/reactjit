import { Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { Search, Slash } from '@reactjit/runtime/icons/icons';
import { Icon } from '@reactjit/runtime/icons/Icon';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexSearchBarProps = {
  value?: string;
  placeholder?: string;
  count?: string;
  onChange?: (value: string) => void;
};

export function DexSearchBar({
  value = '',
  placeholder = 'filter keys / values',
  count = '',
  onChange,
}: DexSearchBarProps) {
  return (
    <Row
      style={{
        height: 30,
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        borderBottomWidth: 1,
        borderColor: DEX_COLORS.rule,
        backgroundColor: DEX_COLORS.bg,
      }}
    >
      <Icon icon={Search} size={13} color={DEX_COLORS.accent} strokeWidth={2.1} />
      <TextInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          height: 22,
          backgroundColor: DEX_COLORS.bg1,
          borderWidth: 1,
          borderColor: DEX_COLORS.rule,
          color: DEX_COLORS.ink,
          fontSize: 11,
          lineHeight: 14,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 1,
          paddingBottom: 3,
        }}
      />
      <Text style={{ minWidth: 54, textAlign: 'right', color: DEX_COLORS.inkDimmer, fontSize: 10 }}>{count}</Text>
      <Icon icon={Slash} size={10} color={DEX_COLORS.inkDimmer} strokeWidth={2.2} />
    </Row>
  );
}
