import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
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
  { id: 'overflow', name: 'Overflow Stress', description: 'Dense scrolling regions and nested layout pressure.', category: 'Layout', component: OverflowStressStory },
  { id: 'trading', name: 'Trading Perf Lab', description: 'High-frequency charting and order-book rendering stress.', category: 'Performance', component: TradingPerfLabStory },
  { id: 'galaxy', name: '3D Cube Galaxy', description: '3D framework scene load with interactive updates.', category: 'Graphics', component: Scene3DFrameworkGalaxyStory },
  { id: 'llms', name: 'llms.txt Reader', description: 'Large text/content parsing and render throughput.', category: 'I/O', component: LlmsTxtReader },
];

const PREVIEW_SCALE = 0.25;
const CARD_WIDTH = 220;
const PREVIEW_HEIGHT = 120;
const INNER_WIDTH = CARD_WIDTH / PREVIEW_SCALE;
const INNER_HEIGHT = PREVIEW_HEIGHT / PREVIEW_SCALE;

class PreviewBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function StressCard({ item, onSelect }: { item: StressDef; onSelect: (id: StressVariant) => void }) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[item.category] || c.textDim;
  const Comp = item.component;

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
      <Box style={{ width: CARD_WIDTH, height: PREVIEW_HEIGHT, overflow: 'hidden', backgroundColor: c.bgElevated }}>
        <PreviewBoundary>
          <Box style={{ width: INNER_WIDTH, height: INNER_HEIGHT, transform: { scaleX: PREVIEW_SCALE, scaleY: PREVIEW_SCALE, originX: 0, originY: 0 } }}>
            <Comp />
          </Box>
        </PreviewBoundary>
      </Box>
      <Box style={{ padding: 12, gap: 6 }}>
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
        <Text style={{ color: c.textDim, fontSize: 10 }}>{item.description}</Text>
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
      <Box style={{ width: '100%', height: '100%', padding: 24, gap: 20, overflow: 'scroll' }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: 'normal' }}>Choose a stress test</Text>
          <Text style={{ color: c.textDim, fontSize: 12 }}>Pick a scenario to run heavy load and rendering checks.</Text>
        </Box>
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-around', width: '100%' }}>
          {STRESS_TESTS.map((item) => (
            <StressCard key={item.id} item={item} onSelect={setSelected} />
          ))}
        </Box>
      </Box>
    );
  }

  const ActiveStory = current.component;
  const categoryColor = CATEGORY_COLORS[current.category] || c.textDim;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <Box
        style={{
          height: 36,
          width: '100%',
          paddingLeft: 12,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.bgAlt,
          borderBottomWidth: 1,
          borderColor: c.border,
        }}
      >
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Stress Tests</Text>
          </Pressable>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>{current.name}</Text>
          <Text style={{ color: categoryColor, fontSize: 10, fontWeight: 'normal' }}>{current.category.toUpperCase()}</Text>
        </Box>
        <Text style={{ color: c.textDim, fontSize: 10 }}>{current.description}</Text>
      </Box>
      <Box style={{ width: '100%', flexGrow: 1, padding: 12 }}>
        <Box style={{ width: '100%', height: '100%', borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, overflow: 'scroll' }}>
          <ActiveStory />
        </Box>
      </Box>
    </Box>
  );
}
