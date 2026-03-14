/**
 * Capabilities — Declarative native capabilities, event bus, and IFTTT wiring.
 *
 * Three systems, one philosophy: declare intent in React, let Lua execute.
 * - Capabilities: <Audio>, <Timer>, <Native> — one-liner native features
 * - Events: useEventBus / useEvent / useEventState — in-memory pub/sub
 * - IFTTT: useIFTTT — trigger→action one-liners (keys, timers, state, combos)
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Slider, Pressable, Timer, useCapabilities, useLoveState, classifiers as S} from '../../../packages/core/src';
import { useEventBus, useEvent, useEventState, useEmit } from '../../../packages/core/src/useEvents';
import type { EventBus } from '../../../packages/core/src/useEvents';
import { useIFTTT } from '../../../packages/core/src/useIFTTT';
import { useThemeColors } from '../../../packages/theme/src';
import {Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { Timer, Audio, Notification, useCapabilities }
  from '@reactjit/core'
import { useEventBus, useEvent, useEventState }
  from '@reactjit/core/useEvents'
import { useIFTTT } from '@reactjit/core/useIFTTT'`;

const TIMER_CODE = `<Timer
  interval={1000}
  running={true}
  onTick={() => setCount(c => c + 1)}
/>`;

const AUDIO_CODE = `<Audio src="beat.mp3" playing loop volume={0.8} />`;

const DISCOVERY_CODE = `const { capabilities, loading } = useCapabilities()
// capabilities.Audio.schema.src → { type: "string", ... }
// capabilities.Timer.events → ["onTick"]`;

const BUS_CODE = `const bus = useEventBus()
bus.emit('cart:add', { name: 'Coffee', price: 4.50 })

useEvent(bus, 'cart:add', (item) => addToCart(item))
useEvent(bus, '*', (payload, ch) => log(ch, payload))
useEvent(bus, ['deposit', 'withdrawal'], handleMoney)

const last = useEventState(bus, 'cart:add') // re-renders`;

const IFTTT_CODE = `// String triggers → string or function actions
useIFTTT('key:space', () => setPaused(!paused))
useIFTTT('key:ctrl+s', 'notification:Saved!')
useIFTTT('timer:every:5000', 'rpc:heartbeat')

// Reactive edge detection (fires on false→true)
useIFTTT(() => score > 100, () => celebrate())

// Return value: fire count + manual trigger
const { fired, fire } = useIFTTT('key:f', doThing)`;

const COMBO_CODE = `// Keyboard → bus → UI (all three systems composed)
useIFTTT('key:j', () => bus.emit('player:jump'))
useEvent(bus, 'player:jump', () => animate('jump'))`;

const ONELINER_CODE = `<Audio src="beat.mp3" playing />
<Audio src="ambient.ogg" playing loop volume={0.3} />
<Timer interval={1000} onTick={() => tick()} />
<Timer interval={5000} repeat={false} onTick={boom} />
<Notification title="Done" body="Build complete" />
<Native type="MyThing" power={11} onReady={go} />`;

const STATEFUL_CODE = `const bus = useEventBus()

// useEventState tracks the latest payload
const lastItem = useEventState<CartItem>(bus, 'cart:add')
// lastItem re-renders on every 'cart:add' emission

bus.emit('cart:add', { name: 'Coffee', price: 4.50 })
// lastItem === { name: 'Coffee', price: 4.50 }`;

const WILDCARD_CODE = `// Wildcard: listen to every channel
useEvent(bus, '*', (payload, channel) => {
  console.log(channel, payload)
})

// Multi-channel: one handler, many events
useEvent(bus, ['deposit', 'withdrawal'],
  (amount, channel) => {
    if (channel === 'deposit') add(amount)
    else subtract(amount)
  }
)`;

const TOOL_SWITCH_CODE = `// Stack rules — each is independent
useIFTTT('key:1', () => setTool('brush'))
useIFTTT('key:2', () => setTool('eraser'))
useIFTTT('key:3', () => setTool('fill'))
useIFTTT('key:4', () => setTool('eyedropper'))`;

const THRESHOLD_CODE = `// Function trigger: fires on false → true edge
useIFTTT(() => count >= 10, () => {
  setAlert('Threshold reached!')
})

// Re-arms when condition goes back to false
useIFTTT(() => count < 10, () => setAlert(''))`;

const FIRE_COUNT_CODE = `// Return value gives fire count + manual trigger
const { fired, fire } = useIFTTT('key:f', action)
// fired: number of times rule fired
// fire(): invoke the action manually

// Timer triggers run on Lua intervals
useIFTTT('timer:every:2000', () => tick())
useIFTTT('timer:once:5000', () => boom())`;

// ── Hoisted data arrays ─────────────────────────────────

const TRIGGER_DSL = [
  { trigger: "'key:space'", desc: 'Space key pressed', color: C.blue },
  { trigger: "'key:ctrl+s'", desc: 'Modifier combo', color: C.blue },
  { trigger: "'key:up:space'", desc: 'Key released', color: C.blue },
  { trigger: "'timer:every:5000'", desc: 'Every 5s (Lua timer)', color: C.teal },
  { trigger: "'timer:once:2000'", desc: 'One-shot 2s delay', color: C.teal },
  { trigger: "'click'", desc: 'Any mouse click', color: C.peach },
  { trigger: "'gamepad:a'", desc: 'Gamepad button', color: C.yellow },
  { trigger: "'midi:note:60'", desc: 'MIDI note on', color: C.mauve },
  { trigger: "'filedrop'", desc: 'File dropped on window', color: C.peach },
  { trigger: "'mount'", desc: 'Component mount (once)', color: C.green },
  { trigger: "'state:paused:true'", desc: 'Lua state match', color: C.green },
  { trigger: '() => score > 100', desc: 'Reactive edge (false→true)', color: C.red },
];

const ACTION_DSL = [
  { action: "'state:set:tool:brush'", desc: 'Set Lua state', color: C.green },
  { action: "'state:toggle:paused'", desc: 'Toggle boolean', color: C.green },
  { action: "'notification:Saved!'", desc: 'Push notification', color: C.yellow },
  { action: "'clipboard:Hello'", desc: 'Copy to clipboard', color: C.peach },
  { action: "'send:player:jump'", desc: 'Fire bridge event', color: C.blue },
  { action: "'rpc:save_data'", desc: 'Call Lua RPC', color: C.mauve },
  { action: "'log:Debug msg'", desc: 'console.log', color: C.teal },
  { action: '(event) => handle(event)', desc: 'Callback with payload', color: C.red },
];

const TOOLS = [
  { key: '1', name: 'brush', color: C.blue },
  { key: '2', name: 'eraser', color: C.red },
  { key: '3', name: 'fill', color: C.green },
  { key: '4', name: 'eyedropper', color: C.yellow },
];

const CART_ITEMS = [
  { name: 'Coffee', price: 4.50 },
  { name: 'Sandwich', price: 8.00 },
  { name: 'Cookie', price: 2.25 },
];


// ── Live Demo: Timer ─────────────────────────────────────

function TimerDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(true);
  const [interval, setInterval_] = useState(1000);

  return (
    <S.StackG8W100>
      <S.StoryCap>
        {`<Timer interval={${interval}} running={${running}} onTick={...} />`}
      </S.StoryCap>

      <Timer interval={interval} running={running} onTick={() => setCount(prev => prev + 1)} />

      <S.RowCenterG12 style={{ justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, color: c.text, fontWeight: 'normal' }}>{String(count)}</Text>
        <S.StoryMuted>{'ticks'}</S.StoryMuted>
      </S.RowCenterG12>

      <S.RowG8 style={{ justifyContent: 'center' }}>
        <Pressable onPress={() => setRunning(!running)}>
          <Box style={{ backgroundColor: running ? C.red : C.green, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{running ? 'Pause' : 'Resume'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setCount(0)}>
          <Box style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <S.StoryBody>{'Reset'}</S.StoryBody>
          </Box>
        </Pressable>
      </S.RowG8>

      <Box style={{ gap: 4 }}>
        <S.StoryCap>{`Interval: ${interval}ms`}</S.StoryCap>
        <Slider
          value={interval}
          minimumValue={100}
          maximumValue={3000}
          step={100}
          onValueChange={(v: number) => setInterval_(v)}
          activeTrackColor={C.accent}
        />
      </Box>
    </S.StackG8W100>
  );
}

// ── Live Demo: AI Discovery ──────────────────────────────

function DiscoveryDemo() {
  const c = useThemeColors();
  const { capabilities, loading } = useCapabilities();

  const entries = capabilities ? Object.entries(capabilities) : [];

  return (
    <S.StackG4W100>
      {loading && <S.StoryMuted>{'Loading schemas...'}</S.StoryMuted>}

      {entries.map(([name, cap]) => {
        const propCount = Object.keys(cap.schema).length;
        const evtCount = cap.events ? cap.events.length : 0;
        return (
          <S.RowCenterG6 key={name}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: cap.visual ? C.green : C.blue, flexShrink: 0 }} />
            <S.StoryBreadcrumbActive style={{ flexShrink: 0 }}>{`<${name}>`}</S.StoryBreadcrumbActive>
            <Text style={{ fontSize: 8, color: cap.visual ? C.green : C.blue, flexShrink: 0 }}>
              {cap.visual ? 'visual' : 'effect'}
            </Text>
            <S.StoryTiny style={{ flexShrink: 0 }}>
              {evtCount > 0 ? `${propCount}p ${evtCount}ev` : `${propCount}p`}
            </S.StoryTiny>
          </S.RowCenterG6>
        );
      })}

      {!loading && !capabilities && (
        <Text style={{ fontSize: 10, color: C.red }}>{'Not available (bridge not connected?)'}</Text>
      )}
    </S.StackG4W100>
  );
}

// ── Live Demo: Event Bus ─────────────────────────────────

function BusSender({ bus, channel, label, payload, color }: {
  bus: EventBus; channel: string; label: string; payload: any; color: string;
}) {
  const emit = useEmit(bus, channel);
  return (
    <Pressable onPress={() => emit(payload)}>
      <Box style={{ backgroundColor: color, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
        <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

function BasicBusDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [log, setLog] = useState<string[]>([]);

  useEvent(bus, 'greet', (msg: string) => {
    setLog(prev => [...prev.slice(-5), `[greet] ${msg}`]);
  });
  useEvent(bus, 'reset', () => setLog([]));

  return (
    <S.StackG8W100>
      <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <BusSender bus={bus} channel="greet" label="Say Hello" payload="Hello!" color={C.blue} />
        <BusSender bus={bus} channel="greet" label="Say Bye" payload="Goodbye!" color={C.peach} />
        <BusSender bus={bus} channel="reset" label="Reset" payload={null} color={C.red} />
      </S.RowG8>
      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 3, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
        {log.length === 0 ? (
          <S.StoryCap>{'(click a button above)'}</S.StoryCap>
        ) : log.map((line, i) => (
          <Text key={i} style={{ fontSize: 9, color: C.teal }}>{line}</Text>
        ))}
      </Box>
    </S.StackG8W100>
  );
}

// ── Live Demo: Stateful + Wildcard + Multi-Channel ───────

function StatefulBusDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const lastItem = useEventState<{ name: string; price: number }>(bus, 'cart:add');

  return (
    <S.StackG8W100>
      <S.StoryCap>{"useEventState(bus, 'cart:add') — re-renders with latest payload"}</S.StoryCap>
      <S.RowG8 style={{ justifyContent: 'center' }}>
        {CART_ITEMS.map(item => (
          <Pressable key={item.name} onPress={() => bus.emit('cart:add', item)}>
            <Box style={{ backgroundColor: C.green, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{`+ ${item.name}`}</Text>
            </Box>
          </Pressable>
        ))}
      </S.RowG8>
      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
        <S.StoryBody>
          {lastItem ? `Last: ${lastItem.name} — $${lastItem.price.toFixed(2)}` : 'No items yet'}
        </S.StoryBody>
      </Box>
    </S.StackG8W100>
  );
}

function WildcardDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [log, setLog] = useState<string[]>([]);

  useEvent(bus, '*', (payload: any, channel: string) => {
    setLog(prev => [...prev.slice(-5), `${channel}: ${JSON.stringify(payload)}`]);
  });

  return (
    <S.StackG8W100>
      <S.StoryCap>{"useEvent(bus, '*', ...) — wildcard catches all channels"}</S.StoryCap>
      <S.RowG8 style={{ justifyContent: 'center' }}>
        <Pressable onPress={() => bus.emit('user:login', { name: 'Alice' })}>
          <Box style={{ backgroundColor: C.blue, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'Login'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => bus.emit('data:sync', { rows: 42 })}>
          <Box style={{ backgroundColor: C.teal, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'Sync'}</Text>
          </Box>
        </Pressable>
      </S.RowG8>
      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 2, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
        {log.length === 0 ? (
          <S.StoryCap>{'Waiting...'}</S.StoryCap>
        ) : log.map((line, i) => (
          <Text key={i} style={{ fontSize: 9, color: C.yellow }}>{line}</Text>
        ))}
      </Box>
    </S.StackG8W100>
  );
}

function MultiChannelDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [total, setTotal] = useState(0);

  useEvent(bus, ['deposit', 'withdrawal'], (amount: number, channel: string) => {
    setTotal(prev => channel === 'deposit' ? prev + amount : prev - amount);
  });

  return (
    <S.StackG8W100>
      <S.StoryCap>{"useEvent(bus, ['deposit', 'withdrawal'], ...)"}</S.StoryCap>
      <S.RowCenterG8 style={{ justifyContent: 'center' }}>
        <Pressable onPress={() => bus.emit('deposit', 10)}>
          <Box style={{ backgroundColor: C.green, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'+$10'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => bus.emit('withdrawal', 5)}>
          <Box style={{ backgroundColor: C.red, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'-$5'}</Text>
          </Box>
        </Pressable>
        <Text style={{ fontSize: 14, color: total >= 0 ? C.green : C.red }}>{`$${total}`}</Text>
      </S.RowCenterG8>
    </S.StackG8W100>
  );
}

// ── Live Demo: IFTTT Key Toggle ──────────────────────────

function KeyToggleDemo() {
  const c = useThemeColors();
  const [paused, setPaused] = useLoveState('paused', false);

  useIFTTT('key:space', () => setPaused(!paused));

  return (
    <S.StackG8W100>
      <S.StoryCap>{"useIFTTT('key:space', () => setPaused(!paused))"}</S.StoryCap>
      <S.RowCenterG8 style={{ justifyContent: 'center' }}>
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: paused ? C.red : C.green }} />
        <Text style={{ fontSize: 12, color: c.text }}>{paused ? 'Paused' : 'Running'}</Text>
      </S.RowCenterG8>
      <S.StoryCap>{'Press Space to toggle'}</S.StoryCap>
    </S.StackG8W100>
  );
}

// ── Live Demo: IFTTT Tool Switcher ───────────────────────

function ToolSwitcherDemo() {
  const c = useThemeColors();
  const [tool, setTool] = useState('brush');

  useIFTTT('key:1', () => setTool('brush'));
  useIFTTT('key:2', () => setTool('eraser'));
  useIFTTT('key:3', () => setTool('fill'));
  useIFTTT('key:4', () => setTool('eyedropper'));

  return (
    <S.StackG8W100>
      <S.StoryCap>{"4 rules, 4 one-liners"}</S.StoryCap>
      <S.RowG6 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {TOOLS.map(t => (
          <Box key={t.key} style={{
            backgroundColor: tool === t.name ? t.color : c.surface2,
            borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10,
          }}>
            <Text style={{ fontSize: 10, color: tool === t.name ? '#1e1e2e' : c.muted }}>
              {`[${t.key}] ${t.name}`}
            </Text>
          </Box>
        ))}
      </S.RowG6>
    </S.StackG8W100>
  );
}

// ── Live Demo: IFTTT Threshold ───────────────────────────

function ThresholdDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);
  const [alert, setAlert] = useState('');

  useIFTTT(() => count >= 10, () => setAlert('Threshold reached!'));
  useIFTTT(() => count < 10, () => setAlert(''));

  return (
    <S.StackG8W100>
      <S.StoryCap>{"useIFTTT(() => count >= 10, ...) — fires on false→true edge"}</S.StoryCap>
      <S.RowCenterG8 style={{ justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: c.text }}>{String(count)}</Text>
        <Pressable onPress={() => setCount(n => n + 1)}>
          <Box style={{ backgroundColor: C.blue, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'+1'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => setCount(0)}>
          <Box style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
            <S.StoryBody>{'Reset'}</S.StoryBody>
          </Box>
        </Pressable>
      </S.RowCenterG8>
      {alert ? (
        <Box style={{ backgroundColor: C.peach, borderRadius: 4, padding: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{alert}</Text>
        </Box>
      ) : null}
    </S.StackG8W100>
  );
}

// ── Live Demo: Fire Counter + Timer Trigger ──────────────

function FireCountDemo() {
  const c = useThemeColors();
  const { fired, fire } = useIFTTT('key:f', 'log:F key pressed!');
  const [ticks, setTicks] = useState(0);

  useIFTTT('timer:every:2000', () => setTicks(t => t + 1));

  return (
    <S.StackG8W100>
      <Box style={{ gap: 4 }}>
        <S.StoryCap>{"const { fired, fire } = useIFTTT('key:f', 'log:F key pressed!')"}</S.StoryCap>
        <S.RowCenterG8 style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: c.text }}>{`Fired: ${fired}×`}</Text>
          <Pressable onPress={() => fire()}>
            <Box style={{ backgroundColor: C.mauve, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'Manual Fire'}</Text>
            </Box>
          </Pressable>
          <S.StoryCap>{'(or press F)'}</S.StoryCap>
        </S.RowCenterG8>
      </Box>
      <Box style={{ gap: 4 }}>
        <S.StoryCap>{"useIFTTT('timer:every:2000', () => setTicks(t => t + 1))"}</S.StoryCap>
        <S.RowCenterG8 style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, color: C.teal }}>{String(ticks)}</Text>
          <S.StoryCap>{'ticks (every 2s)'}</S.StoryCap>
        </S.RowCenterG8>
      </Box>
    </S.StackG8W100>
  );
}

// ── Live Demo: IFTTT + Events Combo ──────────────────────

function IFTTTEventsCombo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [actions, setActions] = useState<string[]>([]);

  useIFTTT('key:j', () => bus.emit('player:jump'));
  useIFTTT('key:d', () => bus.emit('player:dash'));
  useIFTTT('key:r', () => bus.emit('game:reset'));

  useEvent(bus, 'player:jump', () => setActions(prev => [...prev.slice(-5), 'JUMP!']));
  useEvent(bus, 'player:dash', () => setActions(prev => [...prev.slice(-5), 'DASH!']));
  useEvent(bus, 'game:reset', () => setActions([]));

  return (
    <S.StackG8W100>
      <S.StoryCap>{'Press J (jump), D (dash), R (reset)'}</S.StoryCap>
      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 2, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
        {actions.length === 0 ? (
          <S.StoryCap>{'Waiting for input...'}</S.StoryCap>
        ) : (
          <S.RowG6 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {actions.map((a, i) => (
              <Box key={i} style={{
                backgroundColor: a === 'JUMP!' ? C.green : C.blue,
                borderRadius: 4, padding: 4, paddingLeft: 8, paddingRight: 8,
              }}>
                <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{a}</Text>
              </Box>
            ))}
          </S.RowG6>
        )}
      </Box>
    </S.StackG8W100>
  );
}

// ── DSL Reference Tables ─────────────────────────────────

function TriggerTable() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {TRIGGER_DSL.map(t => (
        <S.RowCenterG8 key={t.trigger}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.color }} />
          <S.StoryBreadcrumbActive style={{ width: 140 }}>{t.trigger}</S.StoryBreadcrumbActive>
          <S.StoryCap>{t.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

function ActionTable() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {ACTION_DSL.map(a => (
        <S.RowCenterG8 key={a.action}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color }} />
          <S.StoryBreadcrumbActive style={{ width: 160 }}>{a.action}</S.StoryBreadcrumbActive>
          <S.StoryCap>{a.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── CapabilitiesStory ────────────────────────────────────

export function CapabilitiesStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="zap" tintColor={C.accent} />
        <S.StoryTitle>
          {'Capabilities'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Native features + events + trigger-action wiring'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'Declare intent in React. Let Lua execute.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Three systems, one philosophy. Capabilities register native features as one-liner components. An event bus wires React-to-React pub/sub. IFTTT maps any trigger to any action in a single line. All three compose together.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Everything lives in @reactjit/core. Capabilities, events, and IFTTT are all part of the core package — no extra dependencies.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Band>

        <Divider />

        {/* ── Band 2: demo | text — TIMER CAPABILITY ── */}
        <Band>
          <Half>
            <TimerDemo />
          </Half>
          <Half>
            <SectionLabel icon="timer" accentColor={C.accent}>{'TIMER CAPABILITY'}</SectionLabel>
            <S.StoryBody>
              {'A capability is a native feature registered in Lua and consumed as a React component. Timer is the simplest — React sets interval and running; Lua owns the clock and pushes onTick events back.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The pattern: React declares props → Lua capability module executes → events flow back as callbacks. No bridge-specific code needed.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={TIMER_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo table — AI DISCOVERY ── */}
        <Band>
          <Half>
            <SectionLabel icon="search" accentColor={C.accent}>{'AI DISCOVERY'}</SectionLabel>
            <S.StoryBody>
              {'An AI calls useCapabilities() once to discover every registered capability. Each returns its prop schema, event list, and whether it renders visually.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The AI generates valid one-liner JSX from the schema alone — no docs needed. Schema is the contract: typed, bounded, defaulted props + named event callbacks.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={DISCOVERY_CODE} style={{ width: '100%' }} />
            <S.StoryCap>
              {'Visual capabilities render into the layout tree. Effect capabilities (audio, timers, agents) are invisible — they skip paint and layout entirely.'}
            </S.StoryCap>
          </Half>
          <Half>
            <S.StoryCap style={{ marginBottom: 4 }}>{'Live — all registered capabilities:'}</S.StoryCap>
            <DiscoveryDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: capabilities philosophy ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'React is a layout declaration engine. Capabilities are how Lua-side features (audio, timers, GPIO, 3D, agents) surface as one-liner components. Schema is the contract — the rest is Lua.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 4: text | demo — EVENT BUS ── */}
        <Band>
          <Half>
            <SectionLabel icon="radio" accentColor={C.accent}>{'EVENT BUS'}</SectionLabel>
            <S.StoryBody>
              {'useEventBus creates an in-memory pub/sub channel. useEvent subscribes. useEmit creates a typed emitter. No prop drilling, no shared state.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={BUS_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <BasicBusDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: demo | text + code — STATEFUL LISTENER ── */}
        <Band>
          <Half>
            <StatefulBusDemo />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'STATEFUL LISTENER'}</SectionLabel>
            <S.StoryBody>
              {'useEventState re-renders your component with the latest payload every time that channel fires. No manual state management — it tracks the most recent event for you.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={STATEFUL_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: text + code | demo — WILDCARD ── */}
        <Band>
          <Half>
            <SectionLabel icon="search" accentColor={C.accent}>{'WILDCARD & MULTI-CHANNEL'}</SectionLabel>
            <S.StoryBody>
              {'Listen to all channels with \'*\' for logging or debugging. Or pass an array of channel names to handle multiple events with one handler.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={WILDCARD_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <WildcardDemo />
            <MultiChannelDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: IFTTT intro ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'useIFTTT: If This Then That. Wire any trigger (key, timer, state, gamepad, MIDI) to any action (state change, notification, RPC, callback) in a single line. String DSL for simple cases, functions for complex logic.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 7: demo | text — KEY TOGGLE ── */}
        <Band>
          <Half>
            <KeyToggleDemo />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'IFTTT — KEY TOGGLE'}</SectionLabel>
            <S.StoryBody>
              {'The simplest IFTTT rule: one key, one state change. Space bar toggles a boolean. No event listeners, no cleanup — useIFTTT handles the full lifecycle.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={IFTTT_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 8: text + code | demo — TOOL SWITCHER ── */}
        <Band>
          <Half>
            <SectionLabel icon="sliders" accentColor={C.accent}>{'IFTTT — MULTI-RULE'}</SectionLabel>
            <S.StoryBody>
              {'Stack rules to build keybinding systems. Four rules, four one-liners — number keys switch the active tool. Each useIFTTT is independent and composable.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={TOOL_SWITCH_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <ToolSwitcherDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 9: demo | text + code — THRESHOLD ── */}
        <Band>
          <Half>
            <ThresholdDemo />
          </Half>
          <Half>
            <SectionLabel icon="gauge" accentColor={C.accent}>{'IFTTT — REACTIVE EDGE'}</SectionLabel>
            <S.StoryBody>
              {'Pass a function instead of a string. It fires on the false→true transition — edge detection, not polling. Tap +1 past 10 to see it fire. Reset drops below and re-arms.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={THRESHOLD_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 10: text + code | demo — FIRE COUNT + TIMER ── */}
        <Band>
          <Half>
            <SectionLabel icon="hash" accentColor={C.accent}>{'IFTTT — COUNTERS & TIMERS'}</SectionLabel>
            <S.StoryBody>
              {'useIFTTT returns { fired, fire }. fired tracks how many times the rule has triggered. fire() lets you invoke the action manually. Timer triggers tick on Lua-managed intervals — no setInterval needed.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={FIRE_COUNT_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <FireCountDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 11: demo | text — IFTTT + EVENTS COMBO ── */}
        <Band>
          <Half>
            <IFTTTEventsCombo />
          </Half>
          <Half>
            <SectionLabel icon="git-merge" accentColor={C.accent}>{'IFTTT + EVENTS — COMPOSED'}</SectionLabel>
            <S.StoryBody>
              {'All three systems compose. IFTTT wires keyboard triggers to bus events. The event bus distributes them. Components react. This is the full pipeline: input → intent → distribution → UI.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={COMBO_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 12: text | table — TRIGGER DSL ── */}
        <Band>
          <Half>
            <SectionLabel icon="list" accentColor={C.accent}>{'TRIGGER DSL'}</SectionLabel>
            <S.StoryBody>
              {'String triggers are parsed into DSL tokens. Keys support modifiers (ctrl, shift, alt, meta). Timers are Lua-managed. State triggers match with type coercion. Function triggers edge-detect.'}
            </S.StoryBody>
          </Half>
          <Half>
            <TriggerTable />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 13: table | text — ACTION DSL ── */}
        <Band>
          <Half>
            <ActionTable />
          </Half>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'ACTION DSL'}</SectionLabel>
            <S.StoryBody>
              {'String actions execute without callbacks. Set state, toggle booleans, push notifications, copy to clipboard, fire bridge events, call RPCs. Or pass a function for full control.'}
            </S.StoryBody>
          </Half>
        </Band>

        <Divider />

        {/* ── Band 14: text | code — ONE-LINERS ── */}
        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.accent}>{'ONE-LINERS'}</SectionLabel>
            <S.StoryBody>
              {'The target user is someone who knows their domain but not bridges or RPCs. Everything is a one-liner. Audio, timers, notifications, custom capabilities — if it takes more than one line, wrap it until it doesn\'t.'}
            </S.StoryBody>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={ONELINER_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Band>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="zap" />
        <S.StoryBreadcrumbActive>{'Capabilities'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
