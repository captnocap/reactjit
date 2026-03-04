/**
 * IFTTT Story — useIFTTT hook demo.
 *
 * Shows how to wire triggers to actions as one-liners.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, useLoveState } from '../../../packages/core/src';
import { useIFTTT } from '../../../packages/core/src/useIFTTT';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const C = {
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
};

// ── Demo: Key → State toggle ──────────────────────────────

function KeyToggleDemo() {
  const c = useThemeColors();
  const [paused, setPaused] = useLoveState('paused', false);

  // One-liner: space bar toggles paused state
  useIFTTT('key:space', () => setPaused(!paused));

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"useIFTTT('key:space', () => setPaused(!paused))"}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{
          width: 12, height: 12, borderRadius: 6,
          backgroundColor: paused ? C.red : C.green,
        }} />
        <Text style={{ fontSize: 14, color: c.text }}>
          {paused ? 'Paused' : 'Running'}
        </Text>
      </Box>
      <Text style={{ fontSize: 10, color: c.textDim }}>{'Press Space to toggle'}</Text>
    </Box>
  );
}

// ── Demo: Key combos → state set ──────────────────────────

function ToolSwitcherDemo() {
  const c = useThemeColors();
  const [tool, setTool] = useState('brush');

  useIFTTT('key:1', () => setTool('brush'));
  useIFTTT('key:2', () => setTool('eraser'));
  useIFTTT('key:3', () => setTool('fill'));
  useIFTTT('key:4', () => setTool('eyedropper'));

  const tools = [
    { key: '1', name: 'brush', color: C.blue },
    { key: '2', name: 'eraser', color: C.red },
    { key: '3', name: 'fill', color: C.green },
    { key: '4', name: 'eyedropper', color: C.yellow },
  ];

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"useIFTTT('key:1', () => setTool('brush'))"}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {tools.map(t => (
          <Box key={t.key} style={{
            backgroundColor: tool === t.name ? t.color : c.surface2,
            borderRadius: 6, padding: 8, paddingLeft: 12, paddingRight: 12,
          }}>
            <Text style={{
              fontSize: 11,
              color: tool === t.name ? '#1e1e2e' : c.textDim,
            }}>
              {`[${t.key}] ${t.name}`}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Demo: Reactive condition → action ─────────────────────

function ThresholdDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);
  const [alert, setAlert] = useState('');

  // Fires when count crosses 10 (false→true edge)
  useIFTTT(() => count >= 10, () => setAlert('Threshold reached!'));

  // Reset alert when count drops back
  useIFTTT(() => count < 10, () => setAlert(''));

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"useIFTTT(() => count >= 10, () => setAlert('Threshold reached!'))"}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 24, color: c.text }}>{String(count)}</Text>
        <Pressable onPress={() => setCount(c2 => c2 + 1)}>
          <Box style={{ backgroundColor: C.blue, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'+1'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setCount(0)}>
          <Box style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: c.text }}>{'Reset'}</Text>
          </Box>
        </Pressable>
      </Box>
      {alert ? (
        <Box style={{ backgroundColor: C.peach, borderRadius: 4, padding: 6 }}>
          <Text style={{ fontSize: 12, color: '#1e1e2e' }}>{alert}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

// ── Demo: Fire count + manual fire ────────────────────────

function FireCountDemo() {
  const c = useThemeColors();

  const { fired, fire } = useIFTTT('key:f', 'log:F key pressed!');

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"const { fired, fire } = useIFTTT('key:f', 'log:F key pressed!')"}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: c.text }}>
          {`Fired: ${fired} times`}
        </Text>
        <Pressable onPress={() => fire()}>
          <Box style={{ backgroundColor: C.mauve, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Manual Fire'}</Text>
          </Box>
        </Pressable>
      </Box>
      <Text style={{ fontSize: 10, color: c.textDim }}>{'Press F or click the button'}</Text>
    </Box>
  );
}

// ── Demo: Timer → counter ─────────────────────────────────

function TimerCounterDemo() {
  const c = useThemeColors();
  const [ticks, setTicks] = useState(0);

  useIFTTT('timer:every:2000', () => setTicks(t => t + 1));

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"useIFTTT('timer:every:2000', () => setTicks(t => t + 1))"}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 20, color: C.teal }}>{String(ticks)}</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>{'ticks (every 2s)'}</Text>
      </Box>
    </Box>
  );
}

// ── Demo: Clipboard hotkey ────────────────────────────────

function ClipboardDemo() {
  const c = useThemeColors();
  const [copied, setCopied] = useState(false);

  useIFTTT('key:ctrl+c', () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.textDim }}>
        {"useIFTTT('key:ctrl+c', () => { ... })"}
      </Text>
      <Text style={{ fontSize: 12, color: copied ? C.green : c.textDim }}>
        {copied ? 'Ctrl+C detected!' : 'Press Ctrl+C'}
      </Text>
    </Box>
  );
}

// ── Main story ────────────────────────────────────────────

export function IFTTTStory() {
  return (
    <StoryPage title="useIFTTT" subtitle="If This Then That — one-liner event wiring">
      <StorySection title="Key Toggle" description="Space bar toggles a boolean state">
        <KeyToggleDemo />
      </StorySection>

      <StorySection title="Tool Switcher" description="Number keys switch tools — four rules, four one-liners">
        <ToolSwitcherDemo />
      </StorySection>

      <StorySection title="Reactive Threshold" description="Function trigger fires on false-to-true edge">
        <ThresholdDemo />
      </StorySection>

      <StorySection title="Fire Counter" description="Track how many times a rule has fired, or fire manually">
        <FireCountDemo />
      </StorySection>

      <StorySection title="Timer" description="Lua-ticked timer as a trigger">
        <TimerCounterDemo />
      </StorySection>

      <StorySection title="Key Combo" description="Modifier key combinations">
        <ClipboardDemo />
      </StorySection>
    </StoryPage>
  );
}
