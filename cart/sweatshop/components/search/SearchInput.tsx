import { Box, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { SearchMode } from './useSearchEngine';

export interface SearchInputProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  caseSensitive: boolean;
  onToggleCase: () => void;
  running?: boolean;
  onCancel?: () => void;
  hitCount?: number;
  placeholder?: string;
}

export function SearchInput(props: SearchInputProps) {
  const { query, onQueryChange, onSubmit, mode, onModeChange, caseSensitive, onToggleCase, running, onCancel, hitCount, placeholder } = props;
  const tone = COLORS.blue || '#79c0ff';

  return (
    <Row style={{
      alignItems: 'center', gap: 6,
      padding: 8,
      backgroundColor: COLORS.panelRaised || '#0b1018',
      borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
    }}>
      <Text style={{ color: tone, fontSize: 14, fontWeight: 700 }}>⌕</Text>
      <Box style={{
        flexGrow: 1, flexBasis: 0,
        backgroundColor: COLORS.panelBg || '#05090f',
        borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        paddingHorizontal: 8, paddingVertical: 4,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <TextInput
          value={query}
          placeholder={placeholder || 'Search...'}
          onChangeText={(t: string) => onQueryChange(t)}
          onSubmit={onSubmit}
          style={{ flexGrow: 1, flexBasis: 0, fontSize: 12, color: COLORS.textBright }}
        />
        {typeof hitCount === 'number' ? (
          <Text style={{ color: COLORS.textDim, fontSize: 10, fontWeight: 700 }}>
            {hitCount === 0 ? '—' : hitCount} hits
          </Text>
        ) : null}
      </Box>

      <ModeChip label="Aa" active={caseSensitive} tone={tone} onPress={onToggleCase} title="case sensitive" />
      <ModeChip label=".*" active={mode === 'regex'} tone={tone} onPress={() => onModeChange(mode === 'regex' ? 'literal' : 'regex')} title="regex" />
      <ModeChip label="⟦w⟧" active={mode === 'word'} tone={tone} onPress={() => onModeChange(mode === 'word' ? 'literal' : 'word')} title="whole word" />

      {running ? (
        <Pressable onPress={onCancel} style={btnStyle(COLORS.redDeep || '#3a1616', COLORS.red || '#ff6b6b')}>
          <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CANCEL</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onSubmit} style={btnStyle(COLORS.blueDeep || '#173048', tone)}>
          <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>SEARCH</Text>
        </Pressable>
      )}
    </Row>
  );
}

function ModeChip({ label, active, tone, onPress }: { label: string; active: boolean; tone: string; onPress: () => void; title?: string }) {
  return (
    <Pressable onPress={onPress} style={{
      width: 28, height: 24, borderRadius: 4,
      backgroundColor: active ? tone : (COLORS.panelBg || '#05090f'),
      borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 10, fontWeight: 700 }}>{label}</Text>
    </Pressable>
  );
}

function btnStyle(bg: string, border: string): any {
  return { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: bg, borderWidth: 1, borderColor: border };
}
