import { Box, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../../theme';

interface Props {
  query: string;
  onChange: (v: string) => void;
  onKeyDown: (payload: any) => void;
  placeholder: string;
  open: boolean;
}

export function PaletteInput({ query, onChange, onKeyDown, placeholder, open }: Props) {
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (open && inputRef.current?.focus) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: COLORS.border }}>
      <TextInput
        ref={inputRef}
        value={query}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          fontSize: 14,
          color: COLORS.textBright,
          backgroundColor: COLORS.panelBg,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      />
    </Box>
  );
}
