import React, { useState } from 'react';
import { Box, Pressable, ScrollView, Select, Switch, Text, TextInput } from '../../../../packages/core/src';
import { ActionChip, CREATIVE_COLORS, Divider, FrameButton, MeterBar, Panel, SectionEyebrow } from './shared';

type ModelDef = {
  id: string;
  name: string;
  provider: string;
  providerColor: string;
  context: string;
  latency: string;
  price: string;
  capabilities: string[];
  summary: string;
};

const MODELS: ModelDef[] = [
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    providerColor: CREATIVE_COLORS.accent,
    context: '200k',
    latency: 'fast',
    price: '$$',
    capabilities: ['reasoning', 'tools', 'vision', 'code'],
    summary: 'Balanced model for synthesis, code edits, and structured UI planning.',
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    providerColor: CREATIVE_COLORS.accent,
    context: '200k',
    latency: 'very fast',
    price: '$',
    capabilities: ['tools', 'vision'],
    summary: 'Cheap fast passes for routing, previews, and guardrail transforms.',
  },
  {
    id: 'gpt-4-1',
    name: 'GPT 4.1',
    provider: 'OpenAI',
    providerColor: CREATIVE_COLORS.green,
    context: '128k',
    latency: 'fast',
    price: '$$',
    capabilities: ['reasoning', 'tools', 'code', 'vision'],
    summary: 'Strong all-rounder for code reasoning, editing, and multimodal workflows.',
  },
  {
    id: 'gpt-4-1-mini',
    name: 'GPT 4.1 Mini',
    provider: 'OpenAI',
    providerColor: CREATIVE_COLORS.green,
    context: '128k',
    latency: 'very fast',
    price: '$',
    capabilities: ['tools', 'code'],
    summary: 'Lightweight assistant tier for repetitive UI and formatting work.',
  },
  {
    id: 'gemini-2-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    providerColor: CREATIVE_COLORS.blue,
    context: '1M',
    latency: 'medium',
    price: '$$',
    capabilities: ['vision', 'search', 'reasoning'],
    summary: 'Long context and multimodal analysis with strong recall across docs.',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    providerColor: CREATIVE_COLORS.violet,
    context: '64k',
    latency: 'slow',
    price: '$',
    capabilities: ['reasoning', 'code'],
    summary: 'Good for deliberate deep reasoning passes where speed matters less.',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
    providerColor: CREATIVE_COLORS.gold,
    context: '128k',
    latency: 'medium',
    price: '$$',
    capabilities: ['tools', 'code'],
    summary: 'Solid fallback for generation, transformations, and multilingual work.',
  },
];

const PROVIDER_OPTIONS = [
  { label: 'All providers', value: 'all' },
  { label: 'Anthropic', value: 'Anthropic' },
  { label: 'OpenAI', value: 'OpenAI' },
  { label: 'Google', value: 'Google' },
  { label: 'DeepSeek', value: 'DeepSeek' },
  { label: 'Mistral', value: 'Mistral' },
];

const SORT_OPTIONS = [
  { label: 'Sort by relevance', value: 'relevance' },
  { label: 'Sort by context', value: 'context' },
  { label: 'Sort by speed', value: 'speed' },
];

const CAPABILITIES = ['reasoning', 'tools', 'vision', 'search', 'code'];

function capabilityScore(capability: string) {
  switch (capability) {
    case 'reasoning':
      return 0.92;
    case 'tools':
      return 0.84;
    case 'vision':
      return 0.78;
    case 'search':
      return 0.66;
    case 'code':
      return 0.88;
    default:
      return 0.5;
  }
}

function contextSize(context: string) {
  if (context === '1M') {
    return 1000000;
  }

  return Number(context.replace('k', '000'));
}

function speedRank(latency: string) {
  switch (latency) {
    case 'very fast':
      return 0;
    case 'fast':
      return 1;
    case 'medium':
      return 2;
    default:
      return 3;
  }
}

function ModelRow({
  model,
  active,
  pinned,
  onSelect,
  onPin,
}: {
  model: ModelDef;
  active: boolean;
  pinned: boolean;
  onSelect: () => void;
  onPin: () => void;
}) {
  return (
    <Box
      style={{
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? model.providerColor : CREATIVE_COLORS.stroke,
        backgroundColor: active ? `${model.providerColor}16` : 'rgba(255,255,255,0.02)',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 8,
      }}
    >
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={onSelect} style={{ flexGrow: 1 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Box
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: `${model.providerColor}18`,
                borderWidth: 1,
                borderColor: `${model.providerColor}88`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: model.providerColor, fontSize: 11, fontWeight: 'bold' }}>
                {model.provider.slice(0, 2).toUpperCase()}
              </Text>
            </Box>
            <Box style={{ flexGrow: 1, gap: 2 }}>
              <Text style={{ color: CREATIVE_COLORS.text, fontSize: 12, fontWeight: active ? 'bold' : 'normal' }}>{model.name}</Text>
              <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>
                {`${model.provider}  |  ${model.context}  |  ${model.latency}`}
              </Text>
            </Box>
          </Box>
        </Pressable>
        <Pressable onPress={onPin}>
          <Box
            style={{
              borderWidth: 1,
              borderColor: pinned ? model.providerColor : CREATIVE_COLORS.strokeStrong,
              borderRadius: 999,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              backgroundColor: pinned ? `${model.providerColor}16` : 'transparent',
            }}
          >
            <Text style={{ color: pinned ? model.providerColor : CREATIVE_COLORS.textDim, fontSize: 9, fontWeight: 'bold' }}>
              {pinned ? 'PINNED' : 'PIN'}
            </Text>
          </Box>
        </Pressable>
      </Box>

      <Pressable onPress={onSelect}>
        <Box style={{ gap: 8 }}>
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {model.capabilities.map((capability) => (
              <ActionChip key={capability} label={capability} active={true} color={model.providerColor} />
            ))}
          </Box>

          <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{model.summary}</Text>
        </Box>
      </Pressable>
    </Box>
  );
}

export function ModelSelectorPreview() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedId, setSelectedId] = useState(MODELS[0].id);
  const [pinnedIds, setPinnedIds] = useState<string[]>([MODELS[0].id, MODELS[2].id]);
  const [capFilters, setCapFilters] = useState<string[]>(['reasoning', 'tools']);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  const filteredModels = MODELS.filter((model) => {
    const matchesProvider = provider === 'all' || model.provider === provider;
    const matchesPinned = !pinnedOnly || pinnedIds.includes(model.id);
    const matchesQuery =
      query.trim().length === 0 ||
      model.name.toLowerCase().includes(query.toLowerCase()) ||
      model.summary.toLowerCase().includes(query.toLowerCase());
    const matchesCapabilities =
      capFilters.length === 0 || capFilters.every((cap) => model.capabilities.includes(cap));

    return matchesProvider && matchesPinned && matchesQuery && matchesCapabilities;
  }).sort((left, right) => {
    if (sortBy === 'context') {
      return contextSize(right.context) - contextSize(left.context);
    }

    if (sortBy === 'speed') {
      return speedRank(left.latency) - speedRank(right.latency);
    }

    const leftPinnedScore = pinnedIds.includes(left.id) ? 2 : 0;
    const rightPinnedScore = pinnedIds.includes(right.id) ? 2 : 0;
    const leftCapabilityScore = left.capabilities.reduce((sum, cap) => sum + capabilityScore(cap), 0);
    const rightCapabilityScore = right.capabilities.reduce((sum, cap) => sum + capabilityScore(cap), 0);
    return rightPinnedScore + rightCapabilityScore - (leftPinnedScore + leftCapabilityScore);
  });

  const selectedModel = filteredModels.find((model) => model.id === selectedId) || MODELS.find((model) => model.id === selectedId) || MODELS[0];
  const groupedProviders = PROVIDER_OPTIONS.slice(1)
    .map((option) => ({
      provider: option.value,
      models: filteredModels.filter((model) => model.provider === option.value),
    }))
    .filter((group) => group.models.length > 0);

  function toggleCapability(capability: string) {
    setCapFilters((current) =>
      current.includes(capability) ? current.filter((item) => item !== capability) : [...current, capability]
    );
  }

  function togglePin(id: string) {
    setPinnedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <Box
      style={{
        flexGrow: 1,
        backgroundColor: CREATIVE_COLORS.ink,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 20,
        paddingBottom: 20,
      }}
    >
      <Box style={{ flexDirection: 'row', gap: 16, flexGrow: 1 }}>
        <Panel style={{ flexGrow: 1.35 }}>
          <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
            <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Box style={{ gap: 3 }}>
                <SectionEyebrow label="Model matrix" color={CREATIVE_COLORS.accent} />
                <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{'Search, filter, pin, and compare'}</Text>
              </Box>
              <Box style={{ flexGrow: 1 }} />
              <Box
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: CREATIVE_COLORS.strokeStrong,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                }}
              >
                <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${filteredModels.length} results`}</Text>
              </Box>
            </Box>

            <TextInput
              live
              value={query}
              onChangeText={setQuery}
              placeholder="Search models, use cases, and notes..."
              style={{
                width: '100%',
                minHeight: 40,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: CREATIVE_COLORS.stroke,
                borderRadius: 10,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 10,
                paddingBottom: 10,
              }}
              textStyle={{ color: CREATIVE_COLORS.text, fontSize: 11 }}
            />

            <Box style={{ flexDirection: 'row', gap: 10 }}>
              <Box style={{ flexGrow: 1, gap: 6 }}>
                <SectionEyebrow label="Provider" color={CREATIVE_COLORS.blue} />
                <Select value={provider} onValueChange={setProvider} options={PROVIDER_OPTIONS} color={CREATIVE_COLORS.blue} />
              </Box>
              <Box style={{ flexGrow: 1, gap: 6 }}>
                <SectionEyebrow label="Sort" color={CREATIVE_COLORS.green} />
                <Select value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} color={CREATIVE_COLORS.green} />
              </Box>
            </Box>

            <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Pinned only'}</Text>
              <Box style={{ flexGrow: 1 }} />
              <Switch value={pinnedOnly} onValueChange={setPinnedOnly} width={44} height={24} />
            </Box>

            <Box style={{ gap: 8 }}>
              <SectionEyebrow label="Capabilities" color={CREATIVE_COLORS.violet} />
              <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {CAPABILITIES.map((capability) => (
                  <ActionChip
                    key={capability}
                    label={capability}
                    active={capFilters.includes(capability)}
                    onPress={() => toggleCapability(capability)}
                    color={capability === 'reasoning' ? CREATIVE_COLORS.accent : capability === 'code' ? CREATIVE_COLORS.blue : CREATIVE_COLORS.green}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          <Divider />

          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 14 }}>
              {filteredModels.length === 0 ? (
                <Panel style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 8 }}>
                    <SectionEyebrow label="No matches" color={CREATIVE_COLORS.rose} />
                    <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 11 }}>
                      {'Your current provider, capability, and pin filters eliminate every model.'}
                    </Text>
                    <FrameButton
                      label="Clear filters"
                      onPress={() => {
                        setQuery('');
                        setProvider('all');
                        setCapFilters([]);
                        setPinnedOnly(false);
                      }}
                      tone="accent"
                    />
                  </Box>
                </Panel>
              ) : null}

              {groupedProviders.map((group) => (
                <Box key={group.provider} style={{ gap: 8 }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SectionEyebrow
                      label={group.provider}
                      color={group.models[0] ? group.models[0].providerColor : CREATIVE_COLORS.textDim}
                    />
                    <Box style={{ flexGrow: 1 }} />
                    <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${group.models.length} models`}</Text>
                  </Box>
                  {group.models.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      active={selectedId === model.id}
                      pinned={pinnedIds.includes(model.id)}
                      onSelect={() => setSelectedId(model.id)}
                      onPin={() => togglePin(model.id)}
                    />
                  ))}
                </Box>
              ))}
            </Box>
          </ScrollView>
        </Panel>

        <Panel style={{ width: 318, backgroundColor: CREATIVE_COLORS.panelRaised }}>
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 14 }}>
              <Box style={{ gap: 4 }}>
                <SectionEyebrow label="Selected model" color={selectedModel.providerColor} />
                <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{selectedModel.name}</Text>
                <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 10 }}>
                  {`${selectedModel.provider}  |  ${selectedModel.context} context  |  ${selectedModel.price}`}
                </Text>
              </Box>

              <Panel accentColor={`${selectedModel.providerColor}44`} style={{ backgroundColor: `${selectedModel.providerColor}10` }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{selectedModel.summary}</Text>
                  <Box style={{ gap: 8 }}>
                    {selectedModel.capabilities.map((capability) => (
                      <Box key={capability} style={{ gap: 4 }}>
                        <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{capability}</Text>
                          <Box style={{ flexGrow: 1 }} />
                          <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${Math.round(capabilityScore(capability) * 100)}%`}</Text>
                        </Box>
                        <MeterBar value={capabilityScore(capability)} color={selectedModel.providerColor} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Panel>

              <Box style={{ gap: 8 }}>
                <SectionEyebrow label="Preset launch paths" color={CREATIVE_COLORS.green} />
                <FrameButton label="Route to chat composer" tone="accent" />
                <FrameButton label="Use for code mode" tone="soft" />
                <FrameButton label="Pin to fast access" onPress={() => togglePin(selectedModel.id)} />
              </Box>

              <Panel style={{ backgroundColor: '#0b1424' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
                  <SectionEyebrow label="Selection state" color={CREATIVE_COLORS.blue} />
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>
                    {`Pinned models: ${pinnedIds.length}. Active capability filters: ${capFilters.length === 0 ? 'none' : capFilters.join(', ')}.`}
                  </Text>
                </Box>
              </Panel>
            </Box>
          </ScrollView>
        </Panel>
      </Box>
    </Box>
  );
}
