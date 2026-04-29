
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { AIProviderType } from '../../lib/ai/types';
import { useAPIKeys } from '../../lib/ai/keys';

// Compact provider + model selector. Reads available providers/models
// from stored API key records; caller supplies current selection +
// change handlers.

const DEFAULT_MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  custom:    [],
};

export function ProviderPicker(props: {
  provider: AIProviderType;
  model: string;
  onProvider: (p: AIProviderType) => void;
  onModel: (m: string) => void;
}) {
  const { keys } = useAPIKeys();
  const [open, setOpen] = useState<'provider' | 'model' | null>(null);

  const providers: AIProviderType[] = ['openai', 'anthropic', 'custom'];
  const keyForCurrent = keys.find((k) => k.provider === props.provider);
  const models = (keyForCurrent?.models && keyForCurrent.models.length ? keyForCurrent.models : DEFAULT_MODELS[props.provider] || []);

  const pill = (label: string, tone: string, onPress: () => void) => (
    <Pressable onPress={onPress}>
      <Box style={{
        paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.panelAlt,
      }}>
        <Text fontSize={TOKENS.fontXs} color={tone} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{label}</Text>
      </Box>
    </Pressable>
  );

  return (
    <Col style={{ gap: 4 }}>
      <Row style={{ gap: 6, alignItems: 'center' }}>
        {pill(props.provider, COLORS.blue, () => setOpen(open === 'provider' ? null : 'provider'))}
        {pill(props.model || '(model)', COLORS.green, () => setOpen(open === 'model' ? null : 'model'))}
        {keyForCurrent ? null : (
          <Text fontSize={9} color={COLORS.yellow} style={{ fontFamily: TOKENS.fontMono }}>no key — set one in Settings</Text>
        )}
      </Row>
      {open === 'provider' ? (
        <Box style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg, padding: 4 }}>
          {providers.map((p) => (
            <Pressable key={p} onPress={() => { props.onProvider(p); setOpen(null); }}>
              <Box style={{ padding: 4, borderRadius: TOKENS.radiusXs, backgroundColor: p === props.provider ? COLORS.panelAlt : 'transparent' }}>
                <Text fontSize={TOKENS.fontXs} color={p === props.provider ? COLORS.blue : COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>{p}</Text>
              </Box>
            </Pressable>
          ))}
        </Box>
      ) : null}
      {open === 'model' ? (
        <ScrollView style={{ maxHeight: 140, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
          <Col style={{ padding: 4, gap: 2 }}>
            {models.length === 0 ? (
              <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ padding: 4 }}>No models configured. Set one in Settings → AI keys.</Text>
            ) : models.map((m) => (
              <Pressable key={m} onPress={() => { props.onModel(m); setOpen(null); }}>
                <Box style={{ padding: 4, borderRadius: TOKENS.radiusXs, backgroundColor: m === props.model ? COLORS.panelAlt : 'transparent' }}>
                  <Text fontSize={TOKENS.fontXs} color={m === props.model ? COLORS.green : COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>{m}</Text>
                </Box>
              </Pressable>
            ))}
          </Col>
        </ScrollView>
      ) : null}
    </Col>
  );
}
