const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Image, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useNanoDiffusion } from '../../hooks/useNanoDiffusion';
import { installHint } from '../../lib/image-gen/nano';

function MaskChip(props: { label: string; active?: boolean; onPress?: () => void }) {
  const active = !!props.active;
  return (
    <Pressable onPress={props.onPress}>
      <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}>
        <Text fontSize={10} color={active ? COLORS.blue : COLORS.textDim}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

function Banner(props: { children: any }) {
  return (
    <Box style={{ padding: TOKENS.padNormal, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
      <Text fontSize={TOKENS.fontSm} color={COLORS.yellow}>{props.children}</Text>
    </Box>
  );
}

const MODELS = ['sd-1.5', 'sd-xl', 'sd-3', 'flux-schnell'];
const DEVICES = ['cpu', 'cuda'];

export function NanoBackendPanel() {
  const nano = useNanoDiffusion();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('sd-1.5');
  const [device, setDevice] = useState<'cpu' | 'cuda'>('cpu');
  const [steps, setSteps] = useState(20);
  const [samples, setSamples] = useState(1);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);

  useEffect(() => {
    nano.probe();
  }, []);

  const canGenerate = nano.installed !== false && prompt.trim().length > 0 && nano.state.kind !== 'generating';

  return (
    <Col style={{ gap: TOKENS.spaceMd, padding: TOKENS.padNormal, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', gap: TOKENS.spaceSm }}>
        <Text fontSize={TOKENS.fontSm} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Nano Diffusion (local)</Text>
        <MaskChip label={nano.installed === true ? 'ready' : nano.installed === false ? 'missing' : 'checking'} active={nano.installed === true} />
      </Row>

      {nano.installed === false && (
        <Banner>{installHint()}</Banner>
      )}

      <TextInput
        style={{ fontSize: TOKENS.fontSm, color: COLORS.text, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusMd, padding: TOKENS.padTight }}
        value={prompt}
        onChange={setPrompt}
        placeholder="Enter prompt..."
      />

      <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Model</Text>
        {MODELS.map((m) => (
          <MaskChip key={m} label={m} active={model === m} onPress={() => setModel(m)} />
        ))}
      </Row>

      <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Device</Text>
        {DEVICES.map((d) => (
          <MaskChip key={d} label={d} active={device === d} onPress={() => setDevice(d as 'cpu' | 'cuda')} />
        ))}
      </Row>

      <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Steps</Text>
        <Pressable onPress={() => setSteps((s) => Math.max(1, s - 1))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>−</Text>
          </Box>
        </Pressable>
        <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono, width: 30, textAlign: 'center' }}>{steps}</Text>
        <Pressable onPress={() => setSteps((s) => Math.min(100, s + 1))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>+</Text>
          </Box>
        </Pressable>

        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Samples</Text>
        <Pressable onPress={() => setSamples((s) => Math.max(1, s - 1))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>−</Text>
          </Box>
        </Pressable>
        <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono, width: 30, textAlign: 'center' }}>{samples}</Text>
        <Pressable onPress={() => setSamples((s) => Math.min(8, s + 1))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>+</Text>
          </Box>
        </Pressable>
      </Row>

      <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Size</Text>
        <Pressable onPress={() => setWidth((w) => Math.max(256, w - 64))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>−</Text>
          </Box>
        </Pressable>
        <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono, width: 40, textAlign: 'center' }}>{width}</Text>
        <Pressable onPress={() => setWidth((w) => Math.min(1024, w + 64))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>+</Text>
          </Box>
        </Pressable>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>×</Text>
        <Pressable onPress={() => setHeight((h) => Math.max(256, h - 64))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>−</Text>
          </Box>
        </Pressable>
        <Text fontSize={TOKENS.fontXs} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono, width: 40, textAlign: 'center' }}>{height}</Text>
        <Pressable onPress={() => setHeight((h) => Math.min(1024, h + 64))}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.text}>+</Text>
          </Box>
        </Pressable>
      </Row>

      <Pressable
        onClick={() => {
          if (!canGenerate) return;
          nano.generate({ prompt, model, device, steps, samples, width, height });
        }}
        disabled={!canGenerate}
      >
        <Box style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: TOKENS.radiusMd,
          backgroundColor: canGenerate ? COLORS.blueDeep : COLORS.panelAlt,
          borderWidth: 1,
          borderColor: canGenerate ? COLORS.blue : COLORS.border,
          alignItems: 'center',
        }}>
          <Text fontSize={TOKENS.fontSm} color={canGenerate ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {nano.state.kind === 'generating' ? 'Generating...' : 'Generate'}
          </Text>
        </Box>
      </Pressable>

      {nano.state.kind === 'error' && (
        <Banner>{nano.state.message}</Banner>
      )}

      {nano.state.kind === 'done' && nano.state.pngPath && (
        <Box style={{ gap: TOKENS.spaceSm }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>Result</Text>
          <Box style={{ width: 256, height: 256, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
            <Image source={nano.state.pngPath} style={{ width: '100%', height: '100%' }} />
          </Box>
          <Pressable onClick={nano.reset}>
            <MaskChip label="clear" />
          </Pressable>
        </Box>
      )}
    </Col>
  );
}
