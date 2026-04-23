import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { AIProviderType } from '../../lib/ai/types';
import { useAPIKeys } from '../../lib/ai/keys';

const DEFAULT_MODELS: Record<AIProviderType, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-7'],
  custom: [],
};

function defaultModel(provider: AIProviderType, models: string[]): string {
  return models[0] || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini');
}

export function ProviderChip(props: {
  provider: AIProviderType;
  model: string;
  onProviderChange: (provider: AIProviderType) => void;
  onModelChange: (model: string) => void;
}) {
  const { keys } = useAPIKeys();
  const [open, setOpen] = useState(false);

  const keyForProvider = keys.find((entry) => entry.provider === props.provider);
  const models = keyForProvider?.models && keyForProvider.models.length ? keyForProvider.models : DEFAULT_MODELS[props.provider];

  useEffect(() => {
    const handler = (event: any) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  return (
    <Box style={{ position: 'relative', alignItems: 'flex-end' }}>
      <Pressable onPress={() => setOpen((value) => !value)}>
        <Box style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 2 }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono, textAlign: 'right' }}>{props.provider}</Text>
          <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold', textAlign: 'right' }}>{props.model || '(model)'}</Text>
        </Box>
      </Pressable>
      {open ? (
        <Col style={{ position: 'absolute', top: 42, right: 0, width: 240, gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, zIndex: 50 }}>
          <Col style={{ gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>PROVIDER</Text>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {(['openai', 'anthropic', 'custom'] as AIProviderType[]).map((provider) => (
                <Pressable key={provider} onPress={() => {
                  const nextModels = (keys.find((entry) => entry.provider === provider)?.models || DEFAULT_MODELS[provider]);
                  props.onProviderChange(provider);
                  props.onModelChange(defaultModel(provider, nextModels));
                  setOpen(false);
                }}>
                  <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: provider === props.provider ? COLORS.blue : COLORS.border, backgroundColor: provider === props.provider ? COLORS.blueDeep : COLORS.panelAlt }}>
                    <Text fontSize={9} color={provider === props.provider ? COLORS.blue : COLORS.textDim} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{provider}</Text>
                  </Box>
                </Pressable>
              ))}
            </Row>
          </Col>
          <Col style={{ gap: 4 }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>MODEL</Text>
            <ScrollView style={{ maxHeight: 180, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
              <Col style={{ padding: 6, gap: 4 }}>
                {models.length === 0 ? (
                  <Text fontSize={9} color={COLORS.textDim}>No stored models for this provider.</Text>
                ) : models.map((model) => (
                  <Pressable key={model} onPress={() => { props.onModelChange(model); setOpen(false); }}>
                    <Box style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: TOKENS.radiusSm, backgroundColor: model === props.model ? COLORS.panelAlt : 'transparent' }}>
                      <Text fontSize={9} color={model === props.model ? COLORS.green : COLORS.textBright} style={{ fontFamily: TOKENS.fontMono }}>{model}</Text>
                    </Box>
                  </Pressable>
                ))}
              </Col>
            </ScrollView>
          </Col>
        </Col>
      ) : null}
    </Box>
  );
}
