import React, { useState } from 'react';
import {
  Box,
  CodeBlock,
  ScrollView,
  Select,
  Slider,
  Switch,
  Text,
  TextInput,
  useClipboard,
} from '../../../../packages/core/src';
import {
  ActionChip,
  CREATIVE_COLORS,
  Divider,
  FrameButton,
  MeterBar,
  Panel,
  SectionEyebrow,
} from './shared';

const CONCEPTS = [
  {
    id: 'oni',
    label: 'Neon Oni',
    summary:
      'Fuse ceremonial silhouette with modern combat optics. Keep the face severe, but make every glow line feel manufactured instead of magical.',
    visualNotes: [
      'Mask shell uses matte carbon panels with razor-thin orange seams.',
      'Horn channels pulse in sync with voice activity and gesture cues.',
      'Sleeve tattoos become active routing traces across the forearm rig.',
      'Rain reflections should read as a second light source, not background noise.',
    ],
    reasoning: [
      'Start from silhouette so the read survives low light and small thumbnails.',
      'Use one warm accent family to keep the tech overlays disciplined.',
      'Reserve dense detail for the faceplate and forearms where the eye lands first.',
    ],
    code: `function NeonOniMask() {
  return (
    <Box style={{ position: 'relative' }}>
      <Box style={{ width: 220, height: 280, borderRadius: 18 }} />
      <Box style={{ position: 'absolute', top: 32, left: 40, right: 40, height: 2 }} />
    </Box>
  );
}`,
    aspect: '1024x1024',
    latencyMs: 1840,
    tokenIn: 2440,
    tokenOut: 1130,
    cost: '$0.018',
  },
  {
    id: 'garden',
    label: 'Signal Garden',
    summary:
      'Treat the environment like a calm control room made of plants and antennas. Build contrast through soft cyan telemetry and warm growth light.',
    visualNotes: [
      'Raised beds should map to UI columns with clean architectural rhythm.',
      'Leaves catch the blue light while stems hold the warmer rim light.',
      'Use suspended monitors as trellis surfaces for charts and prompts.',
      'Make the irrigation lines visible so the system feels engineered.',
    ],
    reasoning: [
      'Lead with atmosphere before density so the scene stays breathable.',
      'Anchor the composition in a strong floor grid and two bright focal towers.',
      'Let tech surfaces stay minimal while organic shapes carry the motion.',
    ],
    code: `const beds = rows.map((row, index) => (
  <HydroColumn
    key={row.id}
    glow={index % 2 === 0 ? '#22d3ee' : '#fbbf24'}
    density={row.coverage}
  />
));`,
    aspect: '1792x1024',
    latencyMs: 2210,
    tokenIn: 3100,
    tokenOut: 1450,
    cost: '$0.024',
  },
  {
    id: 'drift',
    label: 'Drift Shrine',
    summary:
      'Build a ritual pit stop for autonomous racers. The shrine should feel sacred without losing the grit of a service bay.',
    visualNotes: [
      'Frames and banners hang above a stripped-down drift chassis.',
      'Incense haze becomes the ambient diffusion layer for headlights.',
      'Brush strokes on the wall act like motion vectors behind the car.',
      'Ground markers echo tire arcs to imply previous runs and speed.',
    ],
    reasoning: [
      'Pair one ceremonial vertical with one aggressive horizontal machine form.',
      'Use repetition in the flags and floor marks to suggest velocity.',
      'Keep the palette tight so the orange bodywork owns the scene.',
    ],
    code: `function DriftShrineStage() {
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <ShrineGate />
      <RaceShell accent="#f97316" />
    </Box>
  );
}`,
    aspect: '1536x1024',
    latencyMs: 1975,
    tokenIn: 2680,
    tokenOut: 980,
    cost: '$0.016',
  },
];

const MODEL_OPTIONS = [
  { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet' },
  { label: 'GPT 4.1', value: 'gpt-4-1' },
  { label: 'Gemini 2.0 Pro', value: 'gemini-2-pro' },
];

const OUTPUT_MODES = ['Visual', 'Narrative', 'Shotlist'];

function InsightCard({
  title,
  value,
  note,
  color,
}: {
  title: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <Box
      style={{
        flexGrow: 1,
        flexBasis: 0,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: CREATIVE_COLORS.stroke,
        borderRadius: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 4,
      }}
    >
      <SectionEyebrow label={title} color={color} />
      <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{note}</Text>
    </Box>
  );
}

function VisualPreview({ accent, label }: { accent: string; label: string }) {
  return (
    <Box
      style={{
        width: '100%',
        height: 170,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${accent}88`,
        backgroundColor: '#091222',
        overflow: 'hidden',
        justifyContent: 'flex-end',
      }}
    >
      <Box style={{ position: 'absolute', top: 24, left: 18, width: 110, height: 110, borderRadius: 55, backgroundColor: `${accent}15` }} />
      <Box style={{ position: 'absolute', top: 18, right: 16, width: 140, height: 2, backgroundColor: `${accent}88` }} />
      <Box style={{ position: 'absolute', top: 42, right: 28, width: 110, height: 2, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <Box style={{ position: 'absolute', bottom: 48, left: 32, width: 88, height: 88, borderRadius: 18, borderWidth: 2, borderColor: accent }} />
      <Box style={{ position: 'absolute', bottom: 40, right: 36, width: 132, height: 100, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
      <Box
        style={{
          borderTopWidth: 1,
          borderTopColor: CREATIVE_COLORS.stroke,
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: 'rgba(7,17,31,0.86)',
          gap: 2,
        }}
      >
        <SectionEyebrow label="Rendered frame" color={accent} />
        <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{label}</Text>
      </Box>
    </Box>
  );
}

export function ResponseCardPreview() {
  const { copy, copied } = useClipboard();
  const [conceptId, setConceptId] = useState(CONCEPTS[0].id);
  const [prompt, setPrompt] = useState(CONCEPTS[0].summary);
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [detail, setDetail] = useState(0.72);
  const [streamProgress, setStreamProgress] = useState(0.82);
  const [outputMode, setOutputMode] = useState(OUTPUT_MODES[0]);
  const [revision, setRevision] = useState(3);
  const [saved, setSaved] = useState(false);

  const concept = CONCEPTS.find((item) => item.id === conceptId) || CONCEPTS[0];
  const accent =
    concept.id === 'oni'
      ? CREATIVE_COLORS.accent
      : concept.id === 'garden'
        ? CREATIVE_COLORS.cyan
        : CREATIVE_COLORS.gold;
  const visibleNotes = Math.max(2, Math.min(concept.visualNotes.length, Math.round(detail * concept.visualNotes.length)));
  const status = streamProgress >= 0.96 ? 'Ready' : streamProgress >= 0.65 ? 'Streaming' : 'Drafting';
  const promptTokens = Math.round(concept.tokenIn * (0.72 + detail * 0.48));
  const completionTokens = Math.round(concept.tokenOut * (0.7 + detail * 0.5));
  const totalLatency = concept.latencyMs + Math.round(detail * 520);

  function handleSelectConcept(nextId: string) {
    const nextConcept = CONCEPTS.find((item) => item.id === nextId);
    if (!nextConcept) {
      return;
    }

    setConceptId(nextId);
    setPrompt(nextConcept.summary);
    setSaved(false);
  }

  function handleRetry() {
    setRevision((current) => current + 1);
    setStreamProgress((current) => (current > 0.88 ? 0.48 : Math.min(1, current + 0.18)));
    setSaved(false);
  }

  function handleCopy() {
    copy(`${prompt}\n\n${concept.visualNotes.slice(0, visibleNotes).join('\n')}`);
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
        <Panel
          accentColor={`${accent}55`}
          style={{
            flexGrow: 1.55,
            backgroundColor: '#08111f',
          }}
        >
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 14 }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Box
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: accent,
                    backgroundColor: `${accent}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: accent, fontSize: 16, fontWeight: 'bold' }}>{'AI'}</Text>
                </Box>
                <Box style={{ flexGrow: 1, gap: 2 }}>
                  <Text style={{ color: CREATIVE_COLORS.text, fontSize: 18, fontWeight: 'bold' }}>{concept.label}</Text>
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 10 }}>
                    {`${model}  |  revision ${revision}  |  ${status.toLowerCase()}`}
                  </Text>
                </Box>
                <Box
                  style={{
                    borderWidth: 1,
                    borderColor: streamProgress >= 0.96 ? CREATIVE_COLORS.green : accent,
                    backgroundColor: streamProgress >= 0.96 ? CREATIVE_COLORS.greenSoft : `${accent}14`,
                    borderRadius: 999,
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: 5,
                    paddingBottom: 5,
                  }}
                >
                  <Text
                    style={{
                      color: streamProgress >= 0.96 ? CREATIVE_COLORS.green : accent,
                      fontSize: 9,
                      fontWeight: 'bold',
                    }}
                  >
                    {status.toUpperCase()}
                  </Text>
                </Box>
              </Box>

              <Divider />

              <Box style={{ gap: 8 }}>
                <SectionEyebrow label="Prompt" color={accent} />
                <TextInput
                  live
                  value={prompt}
                  onChangeText={setPrompt}
                  placeholder="Describe the scene direction..."
                  style={{
                    width: '100%',
                    minHeight: 54,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderWidth: 1,
                    borderColor: CREATIVE_COLORS.stroke,
                    borderRadius: 10,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 12,
                    paddingBottom: 12,
                  }}
                  textStyle={{ color: CREATIVE_COLORS.text, fontSize: 11 }}
                />
              </Box>

              <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {CONCEPTS.map((item) => (
                  <ActionChip
                    key={item.id}
                    label={item.label}
                    active={item.id === concept.id}
                    onPress={() => handleSelectConcept(item.id)}
                    color={item.id === 'oni' ? CREATIVE_COLORS.accent : item.id === 'garden' ? CREATIVE_COLORS.cyan : CREATIVE_COLORS.gold}
                  />
                ))}
              </Box>

              <VisualPreview accent={accent} label={`${concept.label}  |  ${concept.aspect}`} />

              {reasoningOpen ? (
                <Panel accentColor={`${accent}44`} style={{ backgroundColor: `${accent}0d` }}>
                  <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
                    <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <SectionEyebrow label="Reasoning trace" color={accent} />
                      <Box style={{ flexGrow: 1 }} />
                      <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${Math.round(detail * 100)}% detail`}</Text>
                    </Box>
                    {concept.reasoning.map((line) => (
                      <Text key={line} style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>
                        {line}
                      </Text>
                    ))}
                  </Box>
                </Panel>
              ) : null}

              <Box style={{ gap: 8 }}>
                <SectionEyebrow label={`${outputMode} output`} color={accent} />
                <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 12 }}>{prompt}</Text>
                <Box style={{ gap: 6 }}>
                  {concept.visualNotes.slice(0, visibleNotes).map((note) => (
                    <Box key={note} style={{ flexDirection: 'row', gap: 8 }}>
                      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginTop: 5 }} />
                      <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 11 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>
              </Box>

              <Panel style={{ backgroundColor: '#0b1424' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, gap: 8 }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <SectionEyebrow label="Component fragment" color={CREATIVE_COLORS.blue} />
                    <Box style={{ flexGrow: 1 }} />
                    <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{'tsx'}</Text>
                  </Box>
                  <CodeBlock language="tsx" fontSize={10} code={concept.code} />
                </Box>
              </Panel>

              <Box style={{ flexDirection: 'row', gap: 8 }}>
                <InsightCard title="Prompt tokens" value={String(promptTokens)} note="Context with art direction" color={CREATIVE_COLORS.green} />
                <InsightCard title="Completion" value={String(completionTokens)} note="Response and code bundle" color={accent} />
                <InsightCard title="Latency" value={`${totalLatency}ms`} note={concept.cost} color={CREATIVE_COLORS.blue} />
              </Box>

              <Box style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <SectionEyebrow label="Streaming progress" color={accent} />
                  <Box style={{ flexGrow: 1 }} />
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{`${Math.round(streamProgress * 100)}%`}</Text>
                </Box>
                <MeterBar value={streamProgress} color={accent} height={8} />
              </Box>
            </Box>
          </ScrollView>
        </Panel>

        <Panel
          style={{
            width: 310,
            backgroundColor: CREATIVE_COLORS.panelRaised,
          }}
        >
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, gap: 14 }}>
              <Box style={{ gap: 8 }}>
                <SectionEyebrow label="Session controls" color={CREATIVE_COLORS.accent} />
                <Select value={model} onValueChange={setModel} options={MODEL_OPTIONS} color={CREATIVE_COLORS.accent} />
              </Box>

              <Box style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Reasoning panel'}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Switch value={reasoningOpen} onValueChange={setReasoningOpen} width={42} height={24} />
                </Box>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Saved to library'}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Switch value={saved} onValueChange={setSaved} width={42} height={24} />
                </Box>
              </Box>

              <Box style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Detail depth'}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{detail.toFixed(2)}</Text>
                </Box>
                <Slider
                  style={{ width: 280 }}
                  value={detail}
                  onValueChange={setDetail}
                  minimumValue={0.25}
                  maximumValue={1}
                  step={0.01}
                  activeTrackColor={accent}
                />
              </Box>

              <Box style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>{'Streaming completion'}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{streamProgress.toFixed(2)}</Text>
                </Box>
                <Slider
                  style={{ width: 280 }}
                  value={streamProgress}
                  onValueChange={setStreamProgress}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.01}
                  activeTrackColor={CREATIVE_COLORS.green}
                />
              </Box>

              <Box style={{ gap: 8 }}>
                <SectionEyebrow label="Output mode" color={CREATIVE_COLORS.blue} />
                <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {OUTPUT_MODES.map((mode) => (
                    <ActionChip
                      key={mode}
                      label={mode}
                      active={mode === outputMode}
                      onPress={() => setOutputMode(mode)}
                      color={mode === 'Visual' ? accent : mode === 'Narrative' ? CREATIVE_COLORS.blue : CREATIVE_COLORS.green}
                    />
                  ))}
                </Box>
              </Box>

              <Divider />

              <Box style={{ gap: 8 }}>
                <FrameButton label={copied ? 'Copied' : 'Copy payload'} onPress={handleCopy} tone="soft" />
                <FrameButton label="Retry render" onPress={handleRetry} tone="accent" />
                <FrameButton label={saved ? 'Saved to collection' : 'Save concept'} onPress={() => setSaved((current) => !current)} />
              </Box>

              <Panel style={{ backgroundColor: '#0b1424' }}>
                <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, gap: 8 }}>
                  <SectionEyebrow label="What changed" color={accent} />
                  <Text style={{ color: CREATIVE_COLORS.textSoft, fontSize: 10 }}>
                    {'The preview is now live: prompt editing, model swapping, reasoning toggling, output mode switching, copy actions, and stream control all feed the card state.'}
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
