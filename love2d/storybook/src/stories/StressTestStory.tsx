import React, { useState } from 'react';
import { Box, Text, Pressable, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { OverflowStressStory } from './OverflowStress';
import { TradingPerfLabStory } from './TradingPerfLabStory';
import { Scene3DFrameworkGalaxyStory } from './Scene3DFrameworkGalaxy';
import { LlmsTxtReader } from './LlmsTxtReader';

type StressVariant = 'overflow' | 'trading' | 'galaxy' | 'llms';

type StressDef = {
  id: StressVariant;
  name: string;
  description: string;
  category: string;
  component: React.ComponentType;
};

const CATEGORY_COLORS: Record<string, string> = {
  Layout: '#06b6d4',
  Performance: '#ef4444',
  Graphics: '#8b5cf6',
  'I/O': '#f59e0b',
};

const STRESS_TESTS: StressDef[] = [
  { id: 'overflow', name: 'Overflow Stress', description: 'Reachability probes with mixed-axis overflow and nested clipping.', category: 'Layout', component: OverflowStressStory },
  { id: 'trading', name: 'Trading Perf Lab', description: 'High-frequency charting and order-book rendering stress.', category: 'Performance', component: TradingPerfLabStory },
  { id: 'galaxy', name: '3D Cube Galaxy', description: '3D framework scene load with interactive updates.', category: 'Graphics', component: Scene3DFrameworkGalaxyStory },
  { id: 'llms', name: 'llms.txt Reader', description: 'Large text/content parsing and render throughput.', category: 'I/O', component: LlmsTxtReader },
];

const CARD_WIDTH = 220;
const PREVIEW_HEIGHT = 120;

const PREVIEW_ICONS: Record<string, string> = {
  Layout: '◫',
  Performance: '⚡',
  Graphics: '◆',
  'I/O': '▤',
};

function StressCard({ item, onSelect }: { item: StressDef; onSelect: (id: StressVariant) => void }) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[item.category] || c.textDim;
  const icon = PREVIEW_ICONS[item.category] || '●';

  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      style={(state) => ({
        width: CARD_WIDTH,
        backgroundColor: state.hovered ? c.bgAlt : c.bg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: state.hovered ? color : c.border,
        overflow: 'hidden',
      })}
    >
      <Box style={{ width: CARD_WIDTH, height: PREVIEW_HEIGHT, backgroundColor: c.bgElevated, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 32, color }}>{icon}</Text>
        <Text style={{ fontSize: 10, color: c.textDim }}>{item.category}</Text>
      </Box>
      <Box style={{ padding: 12, gap: 6 }}>
        {/* rjit-ignore-next-line */}
        <Box
          style={{
            backgroundColor: `${color}20`,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 4,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color, fontSize: 9, fontWeight: 'normal' }}>{item.category.toUpperCase()}</Text>
        </Box>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'normal' }}>{item.name}</Text>
        <S.StoryMuted>{item.description}</S.StoryMuted>
      </Box>
    </Pressable>
  );
}

export function StressTestStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<StressVariant | null>(null);
  const current = selected ? STRESS_TESTS.find((item) => item.id === selected) : null;

  if (!current) {
    return (
      <S.FullSize style={{ padding: 24, gap: 20, overflow: 'scroll' }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: 'normal' }}>Choose a stress test</Text>
          <Text style={{ color: c.textDim, fontSize: 12 }}>Pick a scenario to run heavy load and rendering checks.</Text>
        </Box>
        <S.RowWrap style={{ gap: 16, justifyContent: 'space-around', width: '100%' }}>
          {STRESS_TESTS.map((item) => (
            <StressCard key={item.id} item={item} onSelect={setSelected} />
          ))}
        </S.RowWrap>
      </S.FullSize>
    );
  }

  const ActiveStory = current.component;
  const categoryColor = CATEGORY_COLORS[current.category] || c.textDim;

  return (
    <S.StoryRoot>
      <S.RowCenterBorder style={{ height: 36, width: '100%', paddingLeft: 12, paddingRight: 12, justifyContent: 'space-between', backgroundColor: c.bgAlt, borderBottomWidth: 1 }}>
        <S.RowCenterG8>
          <Pressable
            onPress={() => setSelected(null)}
            style={(state) => ({
              backgroundColor: state.hovered ? c.surfaceHover : c.border,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            })}
          >
            <S.SecondaryBody>Stress Tests</S.SecondaryBody>
          </Pressable>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>{current.name}</Text>
          <Text style={{ color: categoryColor, fontSize: 10, fontWeight: 'normal' }}>{current.category.toUpperCase()}</Text>
        </S.RowCenterG8>
        <S.StoryMuted>{current.description}</S.StoryMuted>
      </S.RowCenterBorder>
      <Box style={{ width: '100%', flexGrow: 1, padding: 12 }}>
        <S.StoryRoot style={{ borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: 'scroll' }}>
          <ActiveStory />
        </S.StoryRoot>
      </Box>
    </S.StoryRoot>
  );
}
