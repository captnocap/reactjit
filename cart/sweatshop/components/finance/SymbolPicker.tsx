import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface SymbolPickerProps {
  tracked: string[];              // coingecko ids
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear?: () => void;
  recent?: string[];              // suggested ids (from coin_market response)
}

// Tracked-symbol picker. User types a coingecko id, sees their tracked list,
// and can add/remove. `recent` is populated from the current markets response
// so adding 'ethereum' offers visual confirmation it's a known id.
export function SymbolPicker(props: SymbolPickerProps) {
  const { tracked, selected, onSelect, onAdd, onRemove, onClear, recent } = props;
  const [draft, setDraft] = useState('');
  const tone = COLORS.blue || '#79c0ff';

  const submit = () => {
    const id = draft.trim().toLowerCase();
    if (!id) return;
    if (!tracked.includes(id)) onAdd(id);
    onSelect(id);
    setDraft('');
  };

  return (
    <Col style={{
      gap: 6, padding: 8,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SYMBOLS</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{tracked.length} tracked</Text>
        {onClear && tracked.length > 0 ? (
          <Pressable onPress={onClear}>
            <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700 }}>clear</Text>
          </Pressable>
        ) : null}
      </Row>

      <Row style={{ gap: 6, alignItems: 'center' }}>
        <Box style={{
          flexGrow: 1,
          backgroundColor: COLORS.panelAlt || '#05090f',
          borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
          paddingHorizontal: 8, paddingVertical: 4,
        }}>
          <TextInput
            value={draft}
            placeholder="bitcoin, ethereum, solana..."
            onChangeText={(t: string) => setDraft(t)}
            onSubmit={submit}
            style={{ fontSize: 11, color: COLORS.textBright }}
          />
        </Box>
        <Pressable onPress={submit} style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4,
          backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone,
        }}>
          <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>+ ADD</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 4, flexWrap: 'wrap' }}>
        {tracked.length === 0 ? (
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
            no symbols — type a coingecko id (e.g. 'bitcoin') and hit + ADD
          </Text>
        ) : null}
        {tracked.map((id) => {
          const active = id === selected;
          return (
            <Row key={id} style={{
              paddingLeft: 8, paddingRight: 4, paddingVertical: 2, borderRadius: 999,
              backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
              borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
              alignItems: 'center', gap: 4,
            }}>
              <Pressable onPress={() => onSelect(id)}>
                <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textBright, fontSize: 10, fontWeight: 700 }}>{id}</Text>
              </Pressable>
              <Pressable onPress={() => onRemove(id)} style={{ paddingHorizontal: 4 }}>
                <Text style={{ color: active ? (COLORS.appBg || '#05090f') : (COLORS.red || '#ff6b6b'), fontSize: 10, fontWeight: 700 }}>×</Text>
              </Pressable>
            </Row>
          );
        })}
      </Row>

      {recent && recent.length > 0 ? (
        <Row style={{ gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>suggested:</Text>
          {recent.slice(0, 8).map((id) => (
            <Pressable key={id} onPress={() => { if (!tracked.includes(id)) onAdd(id); onSelect(id); }} style={{
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
              backgroundColor: COLORS.panelAlt || '#05090f',
              borderWidth: 1, borderColor: COLORS.border || '#1f2630',
            }}>
              <Text style={{ color: COLORS.textDim, fontSize: 9 }}>+ {id}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}
    </Col>
  );
}
