/**
 * Events Story — useEventBus / useEvent / useEventState demo.
 *
 * Shows in-memory pub/sub between React components and how it
 * pairs with useIFTTT for keyboard-driven event buses.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useEventBus, useEvent, useEventState, useEmit, useEventChannel } from '../../../packages/core/src/useEvents';
import type { EventBus } from '../../../packages/core/src/useEvents';
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

// ── Demo: Basic bus ───────────────────────────────────────

function BasicBusDemo() {
  const c = useThemeColors();
  const bus = useEventBus();

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"const bus = useEventBus();\nbus.emit('ping', { ts: Date.now() });\nuseEvent(bus, 'ping', (data) => log(data));"}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Sender bus={bus} channel="greet" label="Say Hello" payload="Hello!" color={C.blue} />
        <Sender bus={bus} channel="greet" label="Say Bye" payload="Goodbye!" color={C.peach} />
        <Sender bus={bus} channel="reset" label="Reset" payload={null} color={C.red} />
      </Box>

      <Receiver bus={bus} />
    </Box>
  );
}

function Sender({ bus, channel, label, payload, color }: {
  bus: EventBus; channel: string; label: string; payload: any; color: string;
}) {
  const emit = useEmit(bus, channel);
  return (
    <Pressable onPress={() => emit(payload)}>
      <Box style={{ backgroundColor: color, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
        <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

function Receiver({ bus }: { bus: EventBus }) {
  const c = useThemeColors();
  const [log, setLog] = useState<string[]>([]);

  useEvent(bus, 'greet', (msg) => {
    setLog(prev => [...prev.slice(-5), `[greet] ${msg}`]);
  });

  useEvent(bus, 'reset', () => setLog([]));

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 10, gap: 4, minHeight: 40 }}>
      <Text style={{ fontSize: 10, color: c.textDim }}>{'Listener log:'}</Text>
      {log.length === 0 ? (
        <Text style={{ fontSize: 10, color: c.textDim }}>{'(empty — click a button above)'}</Text>
      ) : log.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: C.teal }}>{line}</Text>
      ))}
    </Box>
  );
}

// ── Demo: useEventState (stateful) ────────────────────────

function StatefulDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const lastItem = useEventState<{ name: string; price: number }>(bus, 'cart:add');

  const items = [
    { name: 'Coffee', price: 4.50 },
    { name: 'Sandwich', price: 8.00 },
    { name: 'Cookie', price: 2.25 },
  ];

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"const lastItem = useEventState(bus, 'cart:add');\n// re-renders with the latest payload"}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        {items.map(item => (
          <Pressable key={item.name} onPress={() => bus.emit('cart:add', item)}>
            <Box style={{ backgroundColor: C.green, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{`Add ${item.name}`}</Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 10 }}>
        <Text style={{ fontSize: 12, color: c.text }}>
          {lastItem ? `Last added: ${lastItem.name} — $${lastItem.price.toFixed(2)}` : 'No items added yet'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Demo: Wildcard listener ───────────────────────────────

function WildcardDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [log, setLog] = useState<string[]>([]);

  // Wildcard catches everything
  useEvent(bus, '*', (payload, channel) => {
    setLog(prev => [...prev.slice(-6), `${channel}: ${JSON.stringify(payload)}`]);
  });

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"useEvent(bus, '*', (payload, channel) => log(channel, payload))"}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => bus.emit('user:login', { name: 'Alice' })}>
          <Box style={{ backgroundColor: C.blue, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Login'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => bus.emit('user:logout')}>
          <Box style={{ backgroundColor: C.peach, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Logout'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => bus.emit('data:sync', { rows: 42 })}>
          <Box style={{ backgroundColor: C.teal, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Sync'}</Text>
          </Box>
        </Pressable>
      </Box>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 10, gap: 2, minHeight: 40 }}>
        {log.length === 0 ? (
          <Text style={{ fontSize: 10, color: c.textDim }}>{'Wildcard listener — catches all channels'}</Text>
        ) : log.map((line, i) => (
          <Text key={i} style={{ fontSize: 10, color: C.yellow }}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}

// ── Demo: IFTTT + Events combo ────────────────────────────

function IFTTTComboDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [actions, setActions] = useState<string[]>([]);

  // Keyboard → bus events
  useIFTTT('key:j', () => bus.emit('player:jump'));
  useIFTTT('key:d', () => bus.emit('player:dash'));
  useIFTTT('key:r', () => bus.emit('game:reset'));

  // Bus events → state
  useEvent(bus, 'player:jump', () => {
    setActions(prev => [...prev.slice(-5), 'JUMP!']);
  });
  useEvent(bus, 'player:dash', () => {
    setActions(prev => [...prev.slice(-5), 'DASH!']);
  });
  useEvent(bus, 'game:reset', () => setActions([]));

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"useIFTTT('key:j', () => bus.emit('player:jump'));\nuseEvent(bus, 'player:jump', () => log('JUMP!'));"}
        </Text>
      </Box>

      <Text style={{ fontSize: 10, color: c.textDim }}>{'Press J (jump), D (dash), R (reset)'}</Text>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 10, gap: 2, minHeight: 40 }}>
        {actions.length === 0 ? (
          <Text style={{ fontSize: 10, color: c.textDim }}>{'Waiting for input...'}</Text>
        ) : (
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {actions.map((a, i) => (
              <Box key={i} style={{
                backgroundColor: a === 'JUMP!' ? C.green : C.blue,
                borderRadius: 4, padding: 4, paddingLeft: 8, paddingRight: 8,
              }}>
                <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{a}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Demo: Multi-channel listener ──────────────────────────

function MultiChannelDemo() {
  const c = useThemeColors();
  const bus = useEventBus();
  const [total, setTotal] = useState(0);

  // Listen to multiple channels at once
  useEvent(bus, ['deposit', 'withdrawal'], (amount: number, channel) => {
    setTotal(prev => channel === 'deposit' ? prev + amount : prev - amount);
  });

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"useEvent(bus, ['deposit', 'withdrawal'], (amount, channel) => ...)"}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => bus.emit('deposit', 10)}>
          <Box style={{ backgroundColor: C.green, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'+$10'}</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => bus.emit('withdrawal', 5)}>
          <Box style={{ backgroundColor: C.red, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'-$5'}</Text>
          </Box>
        </Pressable>
        <Text style={{ fontSize: 16, color: total >= 0 ? C.green : C.red }}>
          {`$${total}`}
        </Text>
      </Box>
    </Box>
  );
}

// ── Main story ────────────────────────────────────────────

export function EventsStory() {
  return (
    <StoryPage title="useEvents" subtitle="In-memory event bus for React-to-React communication">
      <StorySection title="Basic Bus" description="Create a bus, emit events, listen with useEvent">
        <BasicBusDemo />
      </StorySection>

      <StorySection title="Stateful Listener" description="useEventState tracks the latest payload">
        <StatefulDemo />
      </StorySection>

      <StorySection title="Wildcard" description="Listen to all channels with '*'">
        <WildcardDemo />
      </StorySection>

      <StorySection title="Multi-Channel" description="Listen to multiple channels at once">
        <MultiChannelDemo />
      </StorySection>

      <StorySection title="IFTTT Combo" description="Keyboard triggers → bus events → UI reactions">
        <IFTTTComboDemo />
      </StorySection>
    </StoryPage>
  );
}
