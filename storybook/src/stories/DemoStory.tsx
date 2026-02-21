import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { SettingsDemoStory } from './SettingsDemo';
import { NeofetchDemoStory } from './NeofetchDemo';
import { WeatherDemoStory } from './WeatherDemo';
import { DataDashboardDemoStory } from './DataDashboardDemo';
import { AppShellDemoStory } from './AppShellDemo';
import { TradingViewBarsStory } from './TradingViewBarsStory';

type DemoId = 'settings' | 'neofetch' | 'weather' | 'dashboard' | 'appshell' | 'trading';

type DemoDef = {
  id: DemoId;
  name: string;
  description: string;
  category: string;
  component: React.ComponentType;
};

const CATEGORY_COLORS: Record<string, string> = {
  System: '#ef4444',
  Data: '#3b82f6',
  Navigation: '#06b6d4',
  Forms: '#8b5cf6',
  Finance: '#f59e0b',
  Utility: '#22c55e',
};

const DEMOS: DemoDef[] = [
  {
    id: 'settings',
    name: 'Settings',
    description: 'Preferences and toggles',
    category: 'Forms',
    component: SettingsDemoStory,
  },
  {
    id: 'neofetch',
    name: 'Neofetch',
    description: 'System summary dashboard',
    category: 'System',
    component: NeofetchDemoStory,
  },
  {
    id: 'weather',
    name: 'Weather',
    description: 'Forecast and metrics',
    category: 'Utility',
    component: WeatherDemoStory,
  },
  {
    id: 'dashboard',
    name: 'Data Dashboard',
    description: 'KPI and chart layout',
    category: 'Data',
    component: DataDashboardDemoStory,
  },
  {
    id: 'appshell',
    name: 'App Shell',
    description: 'Navigation shell patterns',
    category: 'Navigation',
    component: AppShellDemoStory,
  },
  {
    id: 'trading',
    name: 'TradingView',
    description: '2D and 3D chart modes',
    category: 'Finance',
    component: TradingViewBarsStory,
  },
];

const PREVIEW_SCALE = 0.25;
const CARD_WIDTH = 200;
const PREVIEW_HEIGHT = 120;
const INNER_WIDTH = CARD_WIDTH / PREVIEW_SCALE;
const INNER_HEIGHT = PREVIEW_HEIGHT / PREVIEW_SCALE;

class PreviewBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function DemoCard({ demo, onSelect }: { demo: DemoDef; onSelect: (id: DemoId) => void }) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[demo.category] || c.textDim;
  const Comp = demo.component;

  return (
    <Pressable
      onPress={() => onSelect(demo.id)}
      style={(state) => ({
        width: CARD_WIDTH,
        backgroundColor: state.hovered ? c.bgAlt : c.bg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: state.hovered ? color : c.border,
        overflow: 'hidden',
      })}
    >
      <Box
        style={{
          width: CARD_WIDTH,
          height: PREVIEW_HEIGHT,
          overflow: 'hidden',
          backgroundColor: c.bgElevated,
        }}
      >
        <PreviewBoundary>
          <Box
            style={{
              width: INNER_WIDTH,
              height: INNER_HEIGHT,
              transform: { scaleX: PREVIEW_SCALE, scaleY: PREVIEW_SCALE, originX: 0, originY: 0 },
            }}
          >
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
          <Text style={{ color, fontSize: 9, fontWeight: 'bold' }}>{demo.category.toUpperCase()}</Text>
        </Box>

        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
          {demo.name}
        </Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {demo.description}
        </Text>
      </Box>
    </Pressable>
  );
}

export function DemoStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<DemoId | null>(null);
  const current = selected ? DEMOS.find((demo) => demo.id === selected) : null;

  if (!current) {
    return (
      <Box style={{ width: '100%', height: '100%', padding: 24, gap: 20, overflow: 'scroll' }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
            Choose a demo
          </Text>
          <Text style={{ color: c.textDim, fontSize: 12 }}>
            Pick a demo from the same style of menu used by the playground templates
          </Text>
        </Box>

        <Box
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-around',
            width: '100%',
          }}
        >
          {DEMOS.map((demo) => (
            <DemoCard key={demo.id} demo={demo} onSelect={setSelected} />
          ))}
        </Box>
      </Box>
    );
  }

  const SelectedComponent = current.component;
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
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Demos</Text>
          </Pressable>
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{current.name}</Text>
          <Text style={{ color: categoryColor, fontSize: 10, fontWeight: 'bold' }}>{current.category.toUpperCase()}</Text>
        </Box>
        <Text style={{ color: c.textDim, fontSize: 10 }}>{current.description}</Text>
      </Box>

      <Box style={{ width: '100%', flexGrow: 1, padding: 12 }}>
        <Box
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.bg,
            overflow: 'scroll',
          }}
        >
          <SelectedComponent />
        </Box>
      </Box>
    </Box>
  );
}
