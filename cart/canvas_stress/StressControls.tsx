const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../runtime/primitives';

export type CountChoice = 100 | 1000 | 10000 | 100000;
export type StressPreset = 'grid' | 'spiral' | 'force-layout' | 'random-scatter' | 'concentric-rings';
export type StressShape = 'circles' | 'rects' | 'triangles' | 'mixed';

const COUNT_CHOICES: CountChoice[] = [100, 1000, 10000, 100000];
const PRESET_CHOICES: StressPreset[] = ['grid', 'spiral', 'force-layout', 'random-scatter', 'concentric-rings'];
const SHAPE_CHOICES: StressShape[] = ['circles', 'rects', 'triangles', 'mixed'];

function Chip(props: { label: string; active?: boolean; onPress: () => void }) {
  const active = props.active === true;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? '#6ed0ff' : '#243243',
        backgroundColor: active ? '#0d1f32' : '#0a1018',
      }}
    >
      <Text fontSize={10} color={active ? '#6ed0ff' : '#c8d1db'} style={{ fontWeight: 'bold' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function StressControls(props: {
  count: CountChoice;
  preset: StressPreset;
  shape: StressShape;
  animated: boolean;
  effects: boolean;
  onCountChange: (count: CountChoice) => void;
  onPresetChange: (preset: StressPreset) => void;
  onShapeChange: (shape: StressShape) => void;
  onAnimatedChange: (next: boolean) => void;
  onEffectsChange: (next: boolean) => void;
  onFuckIt: () => void;
}) {
  return (
    <Col style={{ gap: 10, padding: 14, borderBottomWidth: 1, borderColor: '#1f2937', backgroundColor: '#0b1118' }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={16} color="#f3f7fb" style={{ fontWeight: 'bold' }}>Canvas.Node Stress Test</Text>
          <Text fontSize={10} color="#8b98a6">A hard perf probe for large Canvas.Node trees.</Text>
        </Col>
        <Row style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={props.onFuckIt}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#ff7b72',
              backgroundColor: '#341316',
            }}
          >
            <Text fontSize={11} color="#ff7b72" style={{ fontWeight: 'bold' }}>FUCK IT</Text>
          </Pressable>
          <Chip label={props.animated ? 'animation on' : 'animation off'} active={props.animated} onPress={() => props.onAnimatedChange(!props.animated)} />
          <Chip label={props.effects ? 'effects on' : 'effects off'} active={props.effects} onPress={() => props.onEffectsChange(!props.effects)} />
        </Row>
      </Row>

      <Box style={{ gap: 8 }}>
        <Text fontSize={10} color="#8b98a6" style={{ fontWeight: 'bold' }}>Node count</Text>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {COUNT_CHOICES.map((choice) => (
            <Chip key={choice} label={choice === 1000 ? '1k' : choice === 10000 ? '10k' : choice === 100000 ? '100k' : String(choice)} active={props.count === choice} onPress={() => props.onCountChange(choice)} />
          ))}
        </Row>
      </Box>

      <Box style={{ gap: 8 }}>
        <Text fontSize={10} color="#8b98a6" style={{ fontWeight: 'bold' }}>Scene preset</Text>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {PRESET_CHOICES.map((choice) => (
            <Chip key={choice} label={choice} active={props.preset === choice} onPress={() => props.onPresetChange(choice)} />
          ))}
        </Row>
      </Box>

      <Box style={{ gap: 8 }}>
        <Text fontSize={10} color="#8b98a6" style={{ fontWeight: 'bold' }}>Shape picker</Text>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {SHAPE_CHOICES.map((choice) => (
            <Chip key={choice} label={choice} active={props.shape === choice} onPress={() => props.onShapeChange(choice)} />
          ))}
        </Row>
      </Box>
    </Col>
  );
}
