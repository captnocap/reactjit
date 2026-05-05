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
const WAVE_TEXT  = 'GRADIENT WAVE * animated tokens';
const SCRAMBLE_TEXT = 'DECRYPTING PAYLOAD…';

function Tile(props: { title: string; subtitle: string; children: any }) {
  return (
    <Col
      style={{
        width: TILE_W,
        height: TILE_H,
        padding: 14,
        backgroundColor: 'theme:bg',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'theme:bg2',
        gap: 8,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 12, color: 'theme:atch', fontFamily: 'monospace' }}>{props.title}</Text>
        <Text style={{ fontSize: 10, color: 'theme:inkDimmer' }}>{props.subtitle}</Text>
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
    <Text style={{ fontSize: 15, color: 'theme:ink', fontFamily: 'monospace' }}>
      {r.text}
    </Text>
  );
}

function StreamingDemo() {
  const text = useStreamingText(STREAM_TEXT, { wordsPerSec: 5, jitter: 0.6, loop: true, loopHoldMs: 2000 });
  return (
    <Text style={{ fontSize: 14, color: 'theme:inkDim', lineHeight: 18 }}>
      {text}
    </Text>
  );
}

function GradientWaveDemo() {
  const chars = useGradientWave(WAVE_TEXT, {
    speed: 2.4,
    spread: 0.22,
    tokens: ['theme:blue', 'theme:tool', 'theme:lilac', 'theme:atch'],
  });
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
    <Text style={{ fontSize: 16, color: 'theme:tool', fontFamily: 'monospace', letterSpacing: 1 }}>
      {s}
    </Text>
  );
}

export type AnimatedTextProps = {};

export function AnimatedText(_props: AnimatedTextProps) {
  return (
    <Col style={{ gap: 16, padding: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'theme:ink' }}>Animated Text</Text>
      <Text style={{ fontSize: 12, color: 'theme:inkDimmer' }}>
        Four hooks from useAnimatedText — typewriter, streaming, gradient wave, scramble
      </Text>
      <Row style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'center', maxWidth: TILE_W * 2 + 40 }}>
        <Tile title="useTypewriter" subtitle="22 cps · loop">
          <TypewriterDemo />
        </Tile>
        <Tile title="useStreamingText" subtitle="5 wps · jitter 0.6">
          <StreamingDemo />
        </Tile>
        <Tile title="useGradientWave" subtitle="theme token wave">
          <GradientWaveDemo />
        </Tile>
        <Tile title="useScramble" subtitle="1.6s settle">
          <ScrambleDemo />
        </Tile>
      </Row>
    </Col>
  );
}
