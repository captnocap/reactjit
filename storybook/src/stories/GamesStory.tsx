import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';
import { GamePlatformerStory } from './GamePlatformerStory';
import { GameRogueliteStory } from './GameRogueliteStory';
import { GameTurnBasedStory } from './GameTurnBasedStory';
import { BlackholeStory } from './BlackholeStory';

type GameVariant = 'platformer' | 'roguelite' | 'turnbased' | 'blackhole';

const VARIANTS: Array<{
  id: GameVariant;
  label: string;
  description: string;
  component: React.ComponentType;
}> = [
  { id: 'platformer', label: 'Platformer', description: 'Side-scrolling movement, jumps, and collision pacing.', component: GamePlatformerStory },
  { id: 'roguelite', label: 'Roguelite', description: 'Dungeon run loop with stats, rooms, and progression.', component: GameRogueliteStory },
  { id: 'turnbased', label: 'Turn-Based RPG', description: 'Menu-driven combat cycle and state transitions.', component: GameTurnBasedStory },
  { id: 'blackhole', label: 'Blackhole', description: 'Before/after gameplay comparison scene.', component: BlackholeStory },
];

export function GamesStory() {
  const c = useThemeColors();
  const [active, setActive] = useState<GameVariant>('platformer');
  const current = VARIANTS.find((variant) => variant.id === active) || VARIANTS[0];
  const ActiveStory = current.component;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 12, gap: 10 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>Games</Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>Consolidated game demos and templates.</Text>
      </Box>

      <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VARIANTS.map((variant) => (
          <Pressable
            key={variant.id}
            onPress={() => setActive(variant.id)}
            style={(state) => ({
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active === variant.id ? c.primary : c.border,
              backgroundColor: active === variant.id ? c.surface : (state.hovered ? c.bgAlt : c.bgElevated),
            })}
          >
            <Text style={{ fontSize: 11, color: c.text, fontWeight: active === variant.id ? 'bold' : 'normal' }}>
              {variant.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ width: '100%', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgElevated, padding: 8 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>{current.description}</Text>
      </Box>

      <Box style={{ width: '100%', flexGrow: 1, minHeight: 0, borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: 'hidden', backgroundColor: c.bg }}>
        <ActiveStory />
      </Box>
    </Box>
  );
}
