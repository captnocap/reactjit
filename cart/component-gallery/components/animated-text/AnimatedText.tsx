import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import {
  useTypewriter,
  useStreamingText,
  useGradientWave,
  useScramble,
} from './useAnimatedText';

const TILE_W = 360;
const TILE_H = 150;

const TYPE_TEXT = 'Hello, world. This is a typewriter.';
const STREAM_TEXT = 'Streaming tokens arrive word by word, the way an LLM responds in real time.';
const WAVE_TEXT  = 'GRADIENT WAVE ✦ animated hue';
const SCRAMBLE_TEXT = 'DECRYPTING PAYLOAD…';

function Tile(props: { title: string; subtitle: string; children: any }) {
  return (
    <Col
      style={{
        width: TILE_W,
        height: TILE_H,
        padding: 14,
        backgroundColor: '#0e0b09',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1a1511',
        gap: 8,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 12, color: '#d48aa7', fontFamily: 'monospace' }}>{props.title}</Text>
        <Text style={{ fontSize: 10, color: '#7a6e5d' }}>{props.subtitle}</Text>
      </Row>
      <Box style={{ flexGrow: 1, justifyContent: 'center' }}>
        {props.children}
      </Box>
    </Col>
  );
}

function TypewriterDemo() {
  const r = useTypewriter(TYPE_TEXT, { cps: 22, loop: true, loopHoldMs: 1600, cursor: '▌' });
  return (
    <Text style={{ fontSize: 15, color: '#f2e8dc', fontFamily: 'monospace' }}>
      {r.text}
    </Text>
  );
}

function StreamingDemo() {
  const text = useStreamingText(STREAM_TEXT, { wordsPerSec: 5, jitter: 0.6, loop: true, loopHoldMs: 2000 });
  return (
    <Text style={{ fontSize: 14, color: '#cdbfae', lineHeight: 18 }}>
      {text}
    </Text>
  );
}

function GradientWaveDemo() {
  const chars = useGradientWave(WAVE_TEXT, { speed: 2.4, spread: 0.22, hueStart: 200, hueEnd: 340 });
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      {chars.map((c) => (
        <Text
          key={c.index}
          style={{ fontSize: 18, fontWeight: 'bold', color: c.color, fontFamily: 'monospace' }}
        >
          {c.ch === ' ' ? ' ' : c.ch}
        </Text>
      ))}
    </Row>
  );
}

function ScrambleDemo() {
  const s = useScramble(SCRAMBLE_TEXT, { durationMs: 1600, loop: true, loopHoldMs: 1800, scrambleChance: 0.85 });
  return (
    <Text style={{ fontSize: 16, color: '#7ad4a7', fontFamily: 'monospace', letterSpacing: 1 }}>
      {s}
    </Text>
  );
}

export type AnimatedTextProps = {};

export function AnimatedText(_props: AnimatedTextProps) {
  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f2e8dc' }}>Animated Text</Text>
      <Text style={{ fontSize: 12, color: '#7a6e5d' }}>
        Four hooks from useAnimatedText — typewriter, streaming, gradient wave, scramble
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: TILE_W * 2 + 40 }}>
        <Tile title="useTypewriter" subtitle="22 cps · loop">
          <TypewriterDemo />
        </Tile>
        <Tile title="useStreamingText" subtitle="5 wps · jitter 0.6">
          <StreamingDemo />
        </Tile>
        <Tile title="useGradientWave" subtitle="hue 200→340">
          <GradientWaveDemo />
        </Tile>
        <Tile title="useScramble" subtitle="1.6s settle">
          <ScrambleDemo />
        </Tile>
      </Row>
    </Col>
  );
}
