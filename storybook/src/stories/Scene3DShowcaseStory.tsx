import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene3DBasicStory } from './Scene3DBasic';
import { Scene3DPlanetStory } from './Scene3DPlanet';
import { Scene3DFrameworkCubeStory } from './Scene3DFrameworkCube';

type Scene3DVariant = 'scene' | 'planet' | 'framework';

const VARIANTS: Array<{
  id: Scene3DVariant;
  label: string;
  description: string;
  component: React.ComponentType;
}> = [
  {
    id: 'scene',
    label: '3D Scene',
    description: 'Core primitives: rotating meshes, edges, and a simple camera.',
    component: Scene3DBasicStory,
  },
  {
    id: 'planet',
    label: 'Planet',
    description: 'Orbit controls, lighting sliders, atmosphere, and moon orbit.',
    component: Scene3DPlanetStory,
  },
  {
    id: 'framework',
    label: 'Framework Cube',
    description: '2D UI rendered into a texture and mapped onto a rotating cube.',
    component: Scene3DFrameworkCubeStory,
  },
];

export function Scene3DShowcaseStory() {
  const c = useThemeColors();
  const [active, setActive] = useState<Scene3DVariant>('scene');
  const current = VARIANTS.find((variant) => variant.id === active) || VARIANTS[0];
  const ActiveStory = current.component;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 12, gap: 10 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
          3D Showcase
        </Text>
        <Text style={{ fontSize: 11, color: c.textDim }}>
          Consolidated: Scene + Planet + Framework Cube
        </Text>
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

      <Box
        style={{
          width: '100%',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.bgElevated,
          padding: 8,
        }}
      >
        <Text style={{ fontSize: 10, color: c.textSecondary }}>{current.description}</Text>
      </Box>

      <Box
        style={{
          width: '100%',
          flexGrow: 1,
          minHeight: 0,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          backgroundColor: c.bg,
        }}
      >
        <ActiveStory />
      </Box>
    </Box>
  );
}

