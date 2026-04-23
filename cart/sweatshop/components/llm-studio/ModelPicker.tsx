// =============================================================================
// ModelPicker — provider + model + temperature + max-tokens editor per column
// =============================================================================
// All writes route through updateColumnConfig() which persists the column
// lineup. Provider pill swaps the provider (and auto-picks a reasonable
// default model for that provider). Model pill-row lists a curated set per
// provider + a 'custom…' TextInput escape hatch for any id users want.
// =============================================================================

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { AIConfig, AIProviderType } from '../../lib/ai/types';
import { updateColumnConfig, removeColumn } from './hooks/useLlmStudioSession';

const PROVIDER_DEFAULT_MODEL: Record<AIProviderType, string> = {
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  custom:    '',
};

const MODELS_BY_PROVIDER: Record<AIProviderType, string[]> = {
  openai: [
    'gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1',
    'o1-mini',
  ],
  anthropic: [
    'claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-sonnet-4-6',
    'claude-opus-4-6', 'claude-opus-4-7',
  ],
  custom: [],
};

export interface ModelPickerProps {
  columnId: string;
  config: AIConfig;
}

const TEMPS = [0, 0.2, 0.4, 0.7, 1.0, 1.5];

export function ModelPicker(props: ModelPickerProps) {
  const { columnId, config } = props;
  const models = MODELS_BY_PROVIDER[config.provider] || [];

  function pickProvider(p: AIProviderType) {
    const nextModel = p === config.provider ? config.model : PROVIDER_DEFAULT_MODEL[p];
    updateColumnConfig(columnId, { provider: p, model: nextModel });
  }

  return (
    <Col style={{ gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {(['openai', 'anthropic', 'custom'] as AIProviderType[]).map((p) => {
          const active = config.provider === p;
          return (
            <Pressable key={p} onPress={() => pickProvider(p)} style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {p}
              </Text>
            </Pressable>
          );
        })}
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => removeColumn(columnId)} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
          borderRadius: TOKENS.radiusSm, borderWidth: 1,
          borderColor: COLORS.red, backgroundColor: COLORS.redDeep,
        }}>
          <Text fontSize={9} color={COLORS.red} style={{ fontWeight: 'bold' }}>× remove</Text>
        </Pressable>
      </Row>

      <Row style={{ alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {models.map((m) => {
          const active = m === config.model;
          return (
            <Pressable key={m} onPress={() => updateColumnConfig(columnId, { model: m })} style={{
              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
              borderRadius: TOKENS.radiusSm, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={active ? COLORS.blue : COLORS.text} style={{ fontFamily: 'monospace' }}>{m}</Text>
            </Pressable>
          );
        })}
      </Row>

      <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>custom</Text>
        <TextInput value={config.model}
          onChangeText={(v: string) => updateColumnConfig(columnId, { model: v })}
          placeholder={PROVIDER_DEFAULT_MODEL[config.provider] || 'custom model id'}
          style={{
            flexBasis: 160, flexShrink: 1, flexGrow: 1, minWidth: 140, height: 22,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
          }} />
      </Row>

      <Row style={{ alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>temp</Text>
        {TEMPS.map((t) => {
          const active = Math.abs((config.temperature ?? 0.7) - t) < 0.01;
          return (
            <Pressable key={t} onPress={() => updateColumnConfig(columnId, { temperature: t })} style={{
              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={active ? COLORS.blue : COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {t === 0 ? '0' : t.toFixed(1)}
              </Text>
            </Pressable>
          );
        })}
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>max</Text>
        <TextInput value={String(config.maxTokens ?? 1024)}
          onChangeText={(v: string) => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) updateColumnConfig(columnId, { maxTokens: n }); }}
          style={{
            width: 64, height: 22,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
          }} />
      </Row>
    </Col>
  );
}
