import React, { useState } from 'react';
import { Box, Pressable, ScrollView, Slider, Switch, Text, TextInput } from '../../../../packages/core/src';
import { ActionChip, CREATIVE_COLORS, Divider, FrameButton, MeterBar, Panel, SectionEyebrow } from './shared';

type WidgetId =
  | 'memory-map'
  | 'payload-view'
  | 'feature-toggles'
  | 'recent-files'
  | 'quick-responses'
  | 'mini-shell'
  | 'prompt-bank';

const SLOT_IDS = ['F1', 'F2', 'F3', 'G1', 'G2', 'G3'];

const WIDGET_LIBRARY: { id: WidgetId; name: string; desc: string; color: string }[] = [
  { id: 'memory-map', name: 'Memory Map', desc: 'Focus different stored contexts', color: CREATIVE_COLORS.violet },
  { id: 'payload-view', name: 'Payload View', desc: 'Tune token density and packing', color: CREATIVE_COLORS.accent },
  { id: 'feature-toggles', name: 'Feature Toggles', desc: 'Flip runtime capabilities on or off', color: CREATIVE_COLORS.green },
  { id: 'recent-files', name: 'Recent Files', desc: 'Select and attach recent working files', color: CREATIVE_COLORS.blue },
  { id: 'quick-responses', name: 'Quick Responses', desc: 'Inject response starters into draft mode', color: CREATIVE_COLORS.gold },
  { id: 'mini-shell', name: 'Mini Shell', desc: 'Run a tiny command palette terminal', color: CREATIVE_COLORS.cyan },
  { id: 'prompt-bank', name: 'Prompt Bank', desc: 'Swap between prompt presets', color: CREATIVE_COLORS.rose },
];

const SHELL_OUTPUTS: Record<string, string> = {
  'git status': 'storybook/src/stories/creative-concepts has local changes',
  'make build-storybook-native': 'native bundle ready in 1.8s',
  'reactjit lint': 'lint clean for current story files',
};

function WidgetShell({
  title,
  active,
  onSelect,
  children,
}: {
  title: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onSelect}>
      <Box
        style={{
          flexGrow: 1,
          flexBasis: 0,
          minHeight: 182,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: active ? CREATIVE_COLORS.accent : CREATIVE_COLORS.stroke,
          backgroundColor: active ? CREATIVE_COLORS.accentSoft : 'rgba(255,255,255,0.02)',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 10,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: CREATIVE_COLORS.stroke,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: active ? CREATIVE_COLORS.accent : CREATIVE_COLORS.textDim, fontSize: 9, fontWeight: 'bold' }}>{title}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{active ? 'picker active' : 'select'}</Text>
        </Box>
        <Box style={{ flexGrow: 1, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>{children}</Box>
      </Box>
    </Pressable>
  );
}

function LibraryItem({
  name,
  desc,
  color,
  onPress,
}: {
  name: string;
  desc: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Box
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: CREATIVE_COLORS.stroke,
          backgroundColor: 'rgba(255,255,255,0.02)',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 4,
        }}
      >
        <SectionEyebrow label={name} color={color} />
        <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{desc}</Text>
      </Box>
    </Pressable>
  );
}

export function WidgetGridPreview() {
  const [selectedSlot, setSelectedSlot] = useState<string | null>('F1');
  const [slots, setSlots] = useState<Record<string, WidgetId>>({
    F1: 'memory-map',
    F2: 'payload-view',
    F3: 'feature-toggles',
    G1: 'recent-files',
    G2: 'quick-responses',
    G3: 'mini-shell',
  });
  const [memoryFocus, setMemoryFocus] = useState('layout');
  const [payloadDensity, setPayloadDensity] = useState(0.62);
  const [features, setFeatures] = useState({
    reasoning: true,
    search: false,
    images: true,
  });
  const [activeFile, setActiveFile] = useState('CreativeConceptsStory.tsx');
  const [draftReply, setDraftReply] = useState('Punch up the component layout and preserve the motion language.');
  const [shellCommand, setShellCommand] = useState('git status');
  const [shellOutput, setShellOutput] = useState(SHELL_OUTPUTS['git status']);
  const [promptPreset, setPromptPreset] = useState('brand');

  const selectedWidget = selectedSlot ? slots[selectedSlot] : null;

  function assignWidget(widgetId: WidgetId) {
    if (!selectedSlot) {
      return;
    }

    setSlots((current) => ({ ...current, [selectedSlot]: widgetId }));
  }

  function renderWidget(widgetId: WidgetId) {
    switch (widgetId) {
      case 'memory-map':
        return (
          <Box style={{ gap: 8 }}>
            <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Stored context packs'}</Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {['layout', 'renderer', 'theme', 'build'].map((item) => (
                <ActionChip
                  key={item}
                  label={item}
                  active={memoryFocus === item}
                  onPress={() => setMemoryFocus(item)}
                  color={CREATIVE_COLORS.violet}
                />
              ))}
            </Box>
            <MeterBar value={memoryFocus === 'layout' ? 0.92 : memoryFocus === 'renderer' ? 0.78 : 0.6} color={CREATIVE_COLORS.violet} />
          </Box>
        );
      case 'payload-view':
        return (
          <Box style={{ gap: 8 }}>
            <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{`Density ${payloadDensity.toFixed(2)}`}</Text>
            <Slider
              style={{ width: 210 }}
              value={payloadDensity}
              onValueChange={setPayloadDensity}
              minimumValue={0.1}
              maximumValue={1}
              step={0.01}
              activeTrackColor={CREATIVE_COLORS.accent}
            />
            <Box style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
              {Array.from({ length: 18 }).map((_, index) => (
                <Box
                  key={index}
                  style={{
                    width: 16,
                    height: 10 + ((index % 4) * 4),
                    borderRadius: 3,
                    backgroundColor: index / 18 < payloadDensity ? CREATIVE_COLORS.accent : 'rgba(255,255,255,0.06)',
                  }}
                />
              ))}
            </Box>
          </Box>
        );
      case 'feature-toggles':
        return (
          <Box style={{ gap: 10 }}>
            {[
              { key: 'reasoning', label: 'Reasoning' },
              { key: 'search', label: 'Search' },
              { key: 'images', label: 'Images' },
            ].map((item) => (
              <Box key={item.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{item.label}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Switch
                  value={features[item.key as keyof typeof features]}
                  onValueChange={(value) =>
                    setFeatures((current) => ({ ...current, [item.key]: value }))
                  }
                  width={42}
                  height={24}
                />
              </Box>
            ))}
          </Box>
        );
      case 'recent-files':
        return (
          <Box style={{ gap: 6 }}>
            {['CreativeConceptsStory.tsx', 'ResponseCardPreview.tsx', 'ModelSelectorPreview.tsx'].map((file) => (
              <Pressable key={file} onPress={() => setActiveFile(file)}>
                <Box
                  style={{
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: activeFile === file ? CREATIVE_COLORS.blue : CREATIVE_COLORS.stroke,
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 8,
                    paddingBottom: 8,
                    backgroundColor: activeFile === file ? CREATIVE_COLORS.blueSoft : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{file}</Text>
                </Box>
              </Pressable>
            ))}
          </Box>
        );
      case 'quick-responses':
        return (
          <Box style={{ gap: 8 }}>
            <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{draftReply}</Text>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {['Tighten layout', 'Boost contrast', 'Explain tradeoff', 'Ship variant'].map((reply) => (
                <ActionChip
                  key={reply}
                  label={reply}
                  active={draftReply === reply}
                  onPress={() => setDraftReply(reply)}
                  color={CREATIVE_COLORS.gold}
                />
              ))}
            </Box>
          </Box>
        );
      case 'mini-shell':
        return (
          <Box style={{ gap: 8 }}>
            <TextInput
              live
              value={shellCommand}
              onChangeText={setShellCommand}
              placeholder="Enter command"
              style={{
                width: '100%',
                minHeight: 38,
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderWidth: 1,
                borderColor: CREATIVE_COLORS.stroke,
                borderRadius: 8,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
              }}
              textStyle={{ color: CREATIVE_COLORS.text, fontSize: 10 }}
            />
            <FrameButton
              label="Run"
              tone="accent"
              onPress={() => setShellOutput(SHELL_OUTPUTS[shellCommand] || 'command not mapped in demo')}
            />
            <Text style={{ color: CREATIVE_COLORS.green, fontSize: 10 }}>{shellOutput}</Text>
          </Box>
        );
      case 'prompt-bank':
        return (
          <Box style={{ gap: 8 }}>
            <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {['brand', 'debug', 'vision'].map((preset) => (
                <ActionChip
                  key={preset}
                  label={preset}
                  active={promptPreset === preset}
                  onPress={() => setPromptPreset(preset)}
                  color={CREATIVE_COLORS.rose}
                />
              ))}
            </Box>
            <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>
              {promptPreset === 'brand'
                ? 'Preserve the visual language while making the layout feel more editorial.'
                : promptPreset === 'debug'
                  ? 'Find state edges, interaction gaps, and styling regressions before polishing.'
                  : 'Turn the draft into a multimodal prompt with compositional notes and lighting.'}
            </Text>
          </Box>
        );
      default:
        return null;
    }
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
        <Panel style={{ flexGrow: 1.4 }}>
          <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 12 }}>
            <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Box style={{ gap: 4 }}>
                <SectionEyebrow label="Widget workshop" color={CREATIVE_COLORS.accent} />
                <Text style={{ color: CREATIVE_COLORS.text, fontSize: 20, fontWeight: 'bold' }}>{'Swap modules without breaking their stateful controls'}</Text>
              </Box>
              <Box style={{ flexGrow: 1 }} />
              <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 10 }}>{selectedSlot ? `selected ${selectedSlot}` : 'select a slot'}</Text>
            </Box>

            <Box style={{ gap: 10 }}>
              <Box style={{ flexDirection: 'row', gap: 10 }}>
                {SLOT_IDS.slice(0, 3).map((slotId) => (
                  <WidgetShell key={slotId} title={slotId} active={selectedSlot === slotId} onSelect={() => setSelectedSlot(slotId)}>
                    {renderWidget(slots[slotId])}
                  </WidgetShell>
                ))}
              </Box>
              <Box style={{ flexDirection: 'row', gap: 10 }}>
                {SLOT_IDS.slice(3).map((slotId) => (
                  <WidgetShell key={slotId} title={slotId} active={selectedSlot === slotId} onSelect={() => setSelectedSlot(slotId)}>
                    {renderWidget(slots[slotId])}
                  </WidgetShell>
                ))}
              </Box>
            </Box>
          </Box>
        </Panel>

        <Panel style={{ width: 330, backgroundColor: CREATIVE_COLORS.panelRaised }}>
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 14 }}>
              <Box style={{ gap: 4 }}>
                <SectionEyebrow label="Widget picker" color={CREATIVE_COLORS.accent} />
                <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>
                  {selectedSlot ? `Assign to ${selectedSlot}` : 'Select a slot'}
                </Text>
                <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 10 }}>
                  {selectedWidget ? `Current widget: ${selectedWidget}` : 'No slot is active.'}
                </Text>
              </Box>

              <Divider />

              {WIDGET_LIBRARY.map((widget) => (
                <LibraryItem
                  key={widget.id}
                  name={widget.name}
                  desc={widget.desc}
                  color={widget.color}
                  onPress={() => assignWidget(widget.id)}
                />
              ))}

              <Panel style={{ backgroundColor: '#0b1424' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
                  <SectionEyebrow label="Live status" color={CREATIVE_COLORS.green} />
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{`Active file: ${activeFile}`}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{`Draft reply: ${draftReply}`}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{`Shell: ${shellOutput}`}</Text>
                  <MeterBar value={payloadDensity} color={CREATIVE_COLORS.accent} />
                </Box>
              </Panel>
            </Box>
          </ScrollView>
        </Panel>
      </Box>
    </Box>
  );
}
