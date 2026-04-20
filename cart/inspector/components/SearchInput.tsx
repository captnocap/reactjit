import { TextInput } from '../../../runtime/primitives';
import { COLORS } from '../constants';

export default function SearchInput({
  value,
  onChange,
  placeholder,
  width = 300,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}) {
  return (
    <TextInput
      value={value}
      placeholder={placeholder || 'Filter…'}
      style={{
        height: 28,
        backgroundColor: COLORS.bgPanel,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingLeft: 8,
        paddingRight: 8,
        fontSize: 11,
        width,
      }}
      onChangeText={onChange}
    />
  );
}
