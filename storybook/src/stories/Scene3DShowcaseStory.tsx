import React, { useState } from 'react';
import { Box, Text, Pressable, classifiers as S} from '../../../packages/core/src';
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
    <S.StoryRoot style={{ padding: 12, gap: 10 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'normal' }}>
          3D Showcase
        </Text>
        <S.DimBody11>
          Consolidated: Scene + Planet + Framework Cube
        </S.DimBody11>
      </Box>

      <S.RowG8 style={{ width: '100%', flexWrap: 'wrap' }}>
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
      </S.RowG8>

      <S.Bordered style={{ width: '100%', borderRadius: 8, backgroundColor: c.bgElevated, padding: 8 }}>
        <S.SecondaryBody>{current.description}</S.SecondaryBody>
      </S.Bordered>

      <S.Bordered style={{ width: '100%', flexGrow: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', backgroundColor: c.bg }}>
        <ActiveStory />
      </S.Bordered>
    </S.StoryRoot>
  );
}

