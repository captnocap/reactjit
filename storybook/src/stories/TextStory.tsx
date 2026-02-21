import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';
import { TextStylesStory } from './TextStyles';
import { TextEffectsStory } from './TextEffectsStory';

type TextMode = 'styles' | 'effects';

const MODES: Array<{ id: TextMode; label: string; component: React.ComponentType }> = [
  { id: 'styles', label: 'Styles', component: TextStylesStory },
  { id: 'effects', label: 'Effects', component: TextEffectsStory },
];

export function TextStory() {
  const c = useThemeColors();
  const [active, setActive] = useState<TextMode>('styles');
  const current = MODES.find((m) => m.id === active) || MODES[0];
  const ActiveStory = current.component;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 12, gap: 10 }}>
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map((mode) => (
          <Pressable
            key={mode.id}
            onPress={() => setActive(mode.id)}
            style={(state) => ({
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active === mode.id ? c.primary : c.border,
              backgroundColor: active === mode.id ? c.surface : (state.hovered ? c.bgAlt : c.bgElevated),
            })}
          >
            <Text style={{ fontSize: 11, color: c.text, fontWeight: active === mode.id ? 'bold' : 'normal' }}>
              {mode.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ width: '100%', flexGrow: 1, minHeight: 0 }}>
        <ActiveStory />
      </Box>
    </Box>
  );
}
