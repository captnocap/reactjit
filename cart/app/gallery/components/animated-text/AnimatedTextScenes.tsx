import { useState, useEffect, useMemo } from 'react';
import { Box, Col, Row, Text, Pressable } from '@reactjit/runtime/primitives';
import {
  useTypewriter,
  useStreamingText,
  useGradientWave,
  useScramble,
} from './useAnimatedText';

const PANEL_W = 520;

function Panel(props: { title: string; children: any; height?: number }) {
  return (
    <Col
      style={{
        width: PANEL_W,
        height: props.height ?? 240,
        backgroundColor: '#0e0b09',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1a1511',
        overflow: 'hidden',
      }}
    >
      <Row
        style={{
          padding: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#1a1511',
          backgroundColor: '#13100d',
        }}
      >
        <Text style={{ fontSize: 11, color: '#d48aa7', fontFamily: 'monospace' }}>{props.title}</Text>
      </Row>
      <Col style={{ flexGrow: 1, padding: 14 }}>{props.children}</Col>
    </Col>
  );
}

const TERMINAL_LINES = [
  '$ reactjit ship sweatshop',
  'esbuild → bundle.js (412 KB)',
  'zig build-exe sweatshop -OReleaseFast',
  'packaging .so deps → zig-out/bin/sweatshop',
  '✓ ready in 2.4s',
];

function TerminalLine(props: { line: string; delay: number; cursor: boolean }) {
  const r = useTypewriter(props.line, {
    cps: 40,
    startDelayMs: props.delay,
    cursor: props.cursor ? '▌' : '',
  });
  const isPrompt = props.line.startsWith('$');
  return (
    <Text
      style={{
        fontSize: 12,
        color: isPrompt ? '#7ad4a7' : '#cdbfae',
        fontFamily: 'monospace',
        lineHeight: 18,
      }}
    >
      {r.text || ' '}
    </Text>
  );
}

export function TerminalScene() {
  const [runId, setRunId] = useState(0);
  const offsets = useMemo(() => {
    let acc = 0;
    return TERMINAL_LINES.map((line) => {
      const start = acc;
      acc += (line.length / 40) * 1000 + 250;
      return start;
    });
  }, []);
  const total = offsets[offsets.length - 1] + (TERMINAL_LINES[TERMINAL_LINES.length - 1].length / 40) * 1000;

  useEffect(() => {
    const id = setTimeout(() => setRunId((v) => v + 1), total + 1800);
    return () => clearTimeout(id);
  }, [runId, total]);

  return (
    <Panel title="terminal · useTypewriter">
      <Col key={runId} style={{ gap: 2 }}>
        {TERMINAL_LINES.map((line, i) => (
          <TerminalLine key={i} line={line} delay={offsets[i]} cursor={i === TERMINAL_LINES.length - 1} />
        ))}
      </Col>
    </Panel>
  );
}

const REPLIES = [
  'A reconciler is the part of React that walks your component tree and produces the minimum set of mutations needed to update the host. In ReactJIT, those mutations stream out of the JS runtime as CREATE / APPEND / UPDATE / REMOVE commands, and the Zig framework consumes them to drive layout, paint, hit-testing, and input.',
  'Sure — JSX is just sugar for React.createElement(...). esbuild lowers it before the JS runtime ever sees the bundle, so the evaluator never has to know about JSX, hooks, or components. It just executes ECMAScript and lets React do the rest.',
  'Tailwind classes go through runtime/tw.ts, which parses the className at the moment a primitive is created and turns it into the same style object you would have written by hand. Full utility coverage, no build-time CSS.',
];

export function ChatScene() {
  const [turn, setTurn] = useState(0);
  const reply = REPLIES[turn % REPLIES.length];
  const text = useStreamingText(reply, { wordsPerSec: 8, jitter: 0.5 });

  useEffect(() => {
    const total = (reply.split(/\s+/).length / 8) * 1000;
    const id = setTimeout(() => setTurn((v) => v + 1), total + 1800);
    return () => clearTimeout(id);
  }, [turn, reply]);

  const showCursor = text.length < reply.length;

  return (
    <Panel title="chat · useStreamingText" height={280}>
      <Col style={{ gap: 10 }}>
        <Row style={{ alignItems: 'flex-start', gap: 8 }}>
          <Box
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#d48aa7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 10, color: '#0e0b09', fontWeight: 'bold' }}>R</Text>
          </Box>
          <Col style={{ flexGrow: 1 }}>
            <Text style={{ fontSize: 10, color: '#7a6e5d', marginBottom: 4 }}>reactjit · just now</Text>
            <Text style={{ fontSize: 13, color: '#f2e8dc', lineHeight: 19 }}>
              {text}{showCursor ? '▌' : ''}
            </Text>
          </Col>
        </Row>
      </Col>
    </Panel>
  );
}

export function HeroScene() {
  const title = 'reactjit';
  const subtitle = 'a reconciler-driven UI framework';
  const titleChars = useGradientWave(title, {
    speed: 1.4,
    spread: 0.45,
    hueStart: 290,
    hueEnd: 30,
    saturation: 90,
    lightness: 68,
  });
  const subChars = useGradientWave(subtitle, {
    speed: 0.7,
    spread: 0.12,
    hueStart: 200,
    hueEnd: 280,
    saturation: 40,
    lightness: 55,
  });

  return (
    <Panel title="hero · useGradientWave" height={220}>
      <Col style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <Row>
          {titleChars.map((c) => (
            <Text
              key={c.index}
              style={{ fontSize: 52, fontWeight: 'bold', color: c.color, fontFamily: 'monospace', letterSpacing: -2 }}
            >
              {c.ch}
            </Text>
          ))}
        </Row>
        <Row>
          {subChars.map((c) => (
            <Text
              key={c.index}
              style={{ fontSize: 14, color: c.color, fontFamily: 'monospace', letterSpacing: 1 }}
            >
              {c.ch === ' ' ? ' ' : c.ch}
            </Text>
          ))}
        </Row>
      </Col>
    </Panel>
  );
}

const SECRETS = [
  { label: 'TARGET', value: 'sweatshop.cart' },
  { label: 'SHA256', value: 'a31fc0bd8e74592d' },
  { label: 'AUTH',   value: 'TRJK@cyberfear' },
  { label: 'STATUS', value: 'AUTHORIZED' },
];

function SecretRow(props: { label: string; value: string; delay: number; key2: number }) {
  const v = useScramble(props.value, { durationMs: 1100, scrambleChance: 0.95 });
  return (
    <Row style={{ gap: 14, alignItems: 'baseline' }}>
      <Text style={{ fontSize: 10, color: '#7a6e5d', fontFamily: 'monospace', width: 70 }}>{props.label}</Text>
      <Text style={{ fontSize: 14, color: '#7ad4a7', fontFamily: 'monospace', letterSpacing: 1 }}>{v}</Text>
    </Row>
  );
}

export function DecoderScene() {
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setRunId((v) => v + 1), 3200);
    return () => clearTimeout(id);
  }, [runId]);

  return (
    <Panel title="decoder · useScramble" height={220}>
      <Col key={runId} style={{ gap: 8 }}>
        <Text style={{ fontSize: 11, color: '#7a6e5d', marginBottom: 6 }}>◉ decrypting payload</Text>
        {SECRETS.map((s, i) => (
          <SecretRow key={i} key2={runId} label={s.label} value={s.value} delay={i * 150} />
        ))}
      </Col>
    </Panel>
  );
}

const BOOT_LINES = [
  { kind: 'scramble', text: 'BOOTING REACTJIT v0.4' },
  { kind: 'type',     text: '$ initialize runtime' },
  { kind: 'type',     text: '$ load bundle' },
  { kind: 'stream',   text: 'V8 isolate ready, 412 KB bundle evaluated, reconciler attached, 47 primitives registered, GPU surface online.' },
];

function BootScrambleLine(props: { text: string }) {
  const v = useScramble(props.text, { durationMs: 900, scrambleChance: 0.9 });
  return (
    <Text style={{ fontSize: 13, color: '#d48aa7', fontFamily: 'monospace', letterSpacing: 1.5, marginBottom: 4 }}>
      {v}
    </Text>
  );
}
function BootTypeLine(props: { text: string; final: boolean }) {
  const r = useTypewriter(props.text, { cps: 50, cursor: props.final ? '▌' : '' });
  return (
    <Text style={{ fontSize: 12, color: '#7ad4a7', fontFamily: 'monospace', lineHeight: 18 }}>
      {r.text}
    </Text>
  );
}
function BootStreamLine(props: { text: string }) {
  const t = useStreamingText(props.text, { wordsPerSec: 10, jitter: 0.4 });
  return (
    <Text style={{ fontSize: 12, color: '#cdbfae', fontFamily: 'monospace', lineHeight: 18 }}>
      {t}
    </Text>
  );
}
function BootLine(props: { line: { kind: string; text: string }; visible: boolean; final: boolean }) {
  if (!props.visible) return null;
  if (props.line.kind === 'scramble') return <BootScrambleLine text={props.line.text} />;
  if (props.line.kind === 'type') return <BootTypeLine text={props.line.text} final={props.final} />;
  return <BootStreamLine text={props.line.text} />;
}

export function BootScene() {
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);

  const stepDurations = [1100, 700, 700, 3200];

  useEffect(() => {
    if (step >= BOOT_LINES.length) {
      const id = setTimeout(() => { setStep(0); setRunId((v) => v + 1); }, 1800);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), stepDurations[step]);
    return () => clearTimeout(id);
  }, [step, runId]);

  return (
    <Panel title="boot sequence · all four hooks" height={240}>
      <Col key={runId} style={{ gap: 4 }}>
        {BOOT_LINES.map((line, i) => (
          <BootLine
            key={i}
            line={line}
            visible={i < step}
            final={i === step - 1 && step < BOOT_LINES.length}
          />
        ))}
      </Col>
    </Panel>
  );
}
