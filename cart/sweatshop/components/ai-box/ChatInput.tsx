import { Box, TextArea, Text, Row, Pressable } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

const ENTER_KEY = 13;
const UP_KEY = 38;
const ESC_KEY = 27;

function readKey(payload: any): string {
  if (typeof payload?.key === 'string') return payload.key.toLowerCase();
  const code = Number(payload?.keyCode ?? payload?.which ?? 0);
  if (code === ENTER_KEY) return 'enter';
  if (code === UP_KEY) return 'arrowup';
  if (code === ESC_KEY) return 'escape';
  return '';
}

function rowsForValue(value: string): number {
  return Math.max(3, Math.min(10, value.split('\n').length));
}

export function ChatInput(props: {
  onSend: (text: string) => void | Promise<void>;
  onClearDraft?: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const rows = rowsForValue(value);

  useEffect(() => {
    historyIndexRef.current = null;
  }, []);

  const pushHistory = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = [...historyRef.current.filter((entry) => entry !== trimmed), trimmed];
    historyRef.current = next.slice(-40);
    historyIndexRef.current = null;
  };

  const recallPrevious = () => {
    const history = historyRef.current;
    if (history.length === 0) return;
    const nextIndex = historyIndexRef.current == null ? history.length - 1 : Math.max(0, historyIndexRef.current - 1);
    historyIndexRef.current = nextIndex;
    setValue(history[nextIndex] || '');
  };

  const clearDraft = () => {
    setValue('');
    historyIndexRef.current = null;
    props.onClearDraft?.();
  };

  const submit = async () => {
    const text = value.trim();
    if (!text || props.disabled) return;
    pushHistory(text);
    setValue('');
    await props.onSend(text);
  };

  const handleKeyDown = (payload: any) => {
    const key = readKey(payload);
    const meta = !!payload?.metaKey || !!payload?.ctrlKey || (Number(payload?.mods ?? 0) & 8) !== 0;
    const selectionStart = payload?.selectionStart ?? payload?.nativeEvent?.selectionStart ?? payload?.currentTarget?.selectionStart;

    if (key === 'escape') {
      clearDraft();
      payload?.preventDefault?.();
      return;
    }

    if (key === 'arrowup' && (value.trim().length === 0 || selectionStart === 0)) {
      recallPrevious();
      payload?.preventDefault?.();
      return;
    }

    if (key === 'enter' && meta) {
      submit();
      payload?.preventDefault?.();
    }
  };

  return (
    <Box style={{ gap: 6, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>CHAT</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={clearDraft} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>clear</Text>
        </Pressable>
      </Row>
      <TextArea
        value={value}
        onChange={(text: string) => {
          setValue(text);
          historyIndexRef.current = null;
        }}
        onKeyDown={handleKeyDown}
        multiline={true}
        placeholder={props.placeholder || 'Ask a question. Cmd+Enter sends, Esc clears, Up recalls the last prompt.'}
        style={{
          minHeight: Math.max(72, rows * 22 + 12),
          maxHeight: 220,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelBg,
          color: COLORS.textBright,
          fontFamily: TOKENS.fontUI,
          fontSize: TOKENS.fontSm,
          textAlignVertical: 'top' as any,
        }}
      />
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={9} color={COLORS.textDim}>Cmd+Enter to send. Esc clears. Up recalls history.</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{value.length} chars</Text>
      </Row>
    </Box>
  );
}
