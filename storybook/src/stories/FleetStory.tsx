/**
 * Fleet Story — Multi-agent Claude Code panel.
 *
 * Spawns N Claude sessions in an accordion layout. Each agent gets
 * its own canvas, prompt input, and inline permission UI.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, Fleet } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

const PRESETS = [
  {
    label: 'Solo',
    agents: [
      { id: 'main', model: 'sonnet' as const, label: 'Main' },
    ],
  },
  {
    label: 'Pair',
    agents: [
      { id: 'lead', model: 'sonnet' as const, label: 'Lead' },
      { id: 'worker', model: 'haiku' as const, label: 'Worker' },
    ],
  },
  {
    label: 'Squad',
    agents: [
      { id: 'architect', model: 'opus' as const, label: 'Architect' },
      { id: 'builder', model: 'sonnet' as const, label: 'Builder' },
      { id: 'reviewer', model: 'haiku' as const, label: 'Reviewer' },
    ],
  },
];

export function FleetStory() {
  const c = useThemeColors();
  const [preset, setPreset] = useState(1);
  const current = PRESETS[preset];

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'column', backgroundColor: c.bg }}>
      {/* Preset picker */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderBottomWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ fontSize: 11, color: c.muted, fontWeight: 'normal' }}>{'FLEET'}</Text>
        {PRESETS.map((p, i) => (
          <Pressable
            key={p.label}
            onPress={() => setPreset(i)}
            style={{
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: preset === i ? c.primary : c.border,
              backgroundColor: preset === i ? c.primary + '22' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 10, color: preset === i ? c.primary : c.muted }}>
              {`${p.label} (${p.agents.length})`}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Fleet */}
      <Fleet
        workingDir="/home/siah/creative/reactjit/storybook"
        agents={current.agents}
        defaultExpanded={[current.agents[0].id]}
        style={{ flexGrow: 1 }}
      />
    </Box>
  );
}
