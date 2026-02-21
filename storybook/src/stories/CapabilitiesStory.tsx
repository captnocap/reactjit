/**
 * Capabilities Story — Declarative native capabilities demo.
 *
 * Shows how <Audio>, <Timer>, and the generic <Native> component
 * let anyone (human or AI) control native features with one-liners.
 */

import React, { useState } from 'react';
import { Box, Text, Slider, Pressable, Timer, useCapabilities } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

function LectureCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>{title}</Text>
      <Box style={{ gap: 6 }}>
        {children}
      </Box>
    </Box>
  );
}

function TimerDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(true);
  const [interval, setInterval_] = useState(1000);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>
        {'Timer'}
      </Text>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          {'<Timer interval={' + interval + '} running={' + running + '} onTick={...} />'}
        </Text>

        <Timer
          interval={interval}
          running={running}
          onTick={() => setCount(prev => prev + 1)}
        />

        <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 24, color: c.text, fontWeight: 'bold' }}>
            {String(count)}
          </Text>
          <Text style={{ fontSize: 11, color: c.textDim }}>{'ticks'}</Text>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setRunning(!running)}>
            <Box style={{ backgroundColor: running ? c.error : c.success, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 11, color: '#ffffff' }}>
                {running ? 'Pause' : 'Resume'}
              </Text>
            </Box>
          </Pressable>

          <Pressable onPress={() => setCount(0)}>
            <Box style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 11, color: c.text }}>{'Reset'}</Text>
            </Box>
          </Pressable>
        </Box>

        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>
            {'Interval: ' + interval + 'ms'}
          </Text>
          <Slider
            value={interval}
            minimumValue={100}
            maximumValue={3000}
            step={100}
            onValueChange={(v: number) => setInterval_(v)}
            activeTrackColor={c.primary}
          />
        </Box>
      </Box>
    </Box>
  );
}

function CapabilityDiscovery() {
  const c = useThemeColors();
  const { capabilities, loading } = useCapabilities();

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>
        {'AI Discovery — useCapabilities()'}
      </Text>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          {'An AI calls useCapabilities() once to discover what it can control.'}
        </Text>

        {loading && (
          <Text style={{ fontSize: 11, color: c.textDim }}>{'Loading...'}</Text>
        )}

        {capabilities && Object.entries(capabilities).map(([name, cap]) => (
          <Box key={name} style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 8, gap: 4 }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>
                {'<' + name + '>'}
              </Text>
              <Text style={{ fontSize: 9, color: cap.visual ? c.success : c.primary }}>
                {cap.visual ? 'visual' : 'effect'}
              </Text>
            </Box>

            {/* Schema */}
            <Box style={{ gap: 2, paddingLeft: 8 }}>
              {Object.entries(cap.schema).map(([prop, def]) => (
                <Text key={prop} style={{ fontSize: 10, color: c.textDim }}>
                  {prop + ': ' + def.type + (def.desc ? ' — ' + def.desc : '')}
                </Text>
              ))}
            </Box>

            {/* Events */}
            {cap.events.length > 0 && (
              <Text style={{ fontSize: 10, color: c.accent, paddingLeft: 8 }}>
                {'Events: ' + cap.events.join(', ')}
              </Text>
            )}
          </Box>
        ))}

        {!loading && !capabilities && (
          <Text style={{ fontSize: 11, color: c.error }}>
            {'Capabilities not available (bridge not connected?)'}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function OneLinerShowcase() {
  const c = useThemeColors();

  const examples = [
    { label: 'Play audio', code: '<Audio src="beat.mp3" playing />' },
    { label: 'Loop with volume', code: '<Audio src="ambient.ogg" playing loop volume={0.3} />' },
    { label: 'Timer', code: '<Timer interval={1000} onTick={() => tick()} />' },
    { label: 'One-shot timer', code: '<Timer interval={5000} repeat={false} onTick={() => boom()} />' },
    { label: 'AI volume control', code: '<Audio src="track.mp3" playing volume={aiDecidedVolume} />' },
    { label: 'Custom capability', code: '<Native type="MyThing" power={11} onReady={go} />' },
  ];

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>
        {'One-Liners'}
      </Text>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 6 }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          {'Everything is a one-liner. No bridge knowledge needed.'}
        </Text>

        {examples.map((ex, i) => (
          <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: c.textDim, width: 100 }}>{ex.label}</Text>
            <Box style={{ backgroundColor: c.surface2, borderRadius: 4, padding: 4, paddingLeft: 8, paddingRight: 8 }}>
              <Text style={{ fontSize: 10, color: c.accent }}>{ex.code}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function CapabilitiesStory() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, alignItems: 'center', overflow: 'scroll' }}>
      <Box style={{ width: '100%', maxWidth: 920, gap: 12 }}>
        <Text style={{ fontSize: 16, color: c.text, fontWeight: 'bold' }}>
          {'Declarative Native Capabilities'}
        </Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          {'One component per capability. React sets intent; Lua owns execution and runtime lifecycle.'}
        </Text>

        <LectureCard title="Lecture: Mental Model">
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'1) React declares targets and props. It does not drive per-frame effects.'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'2) Lua capability modules own polling, ticking, and native API interop.'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'3) Events flow back as declarative callbacks (onTick, onReady, onStatus).'}
          </Text>
        </LectureCard>

        <LectureCard title="Lecture: AI Workflow">
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'Step A: call useCapabilities() once and inspect schema + events.'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'Step B: render one-liner components with valid props from discovered schema.'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>
            {'Step C: react to emitted events and adjust props; no bridge-specific code needed.'}
          </Text>
        </LectureCard>

        <Box style={{ flexDirection: 'row', gap: 16, width: '100%', alignItems: 'flex-start' }}>
          <Box style={{ flexGrow: 1, gap: 16 }}>
            <TimerDemo />
            <OneLinerShowcase />
          </Box>
          <Box style={{ flexGrow: 1, gap: 16 }}>
            <CapabilityDiscovery />
            <LectureCard title="Lecture: Capability Contract">
              <Text style={{ fontSize: 10, color: c.textSecondary }}>
                {'Schema is the contract. Keep props typed, bounded, and defaulted.'}
              </Text>
              <Text style={{ fontSize: 10, color: c.textSecondary }}>
                {'Effects should be idempotent per frame and emit minimal, meaningful events.'}
              </Text>
              <Text style={{ fontSize: 10, color: c.textSecondary }}>
                {'Treat capability state as runtime-owned: React mutates intent, Lua reconciles execution.'}
              </Text>
            </LectureCard>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
