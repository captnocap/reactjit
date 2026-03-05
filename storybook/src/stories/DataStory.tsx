/**
 * Data — Component documentation page (Layout1).
 *
 * Charts, tables, progress bars, and data visualization primitives.
 * Static hoist ALL code strings and style objects outside the component.
 *
 * ─── NON-NEGOTIABLE: NO WRAPPER COMPONENT ──────────────────────────────
 * Every value is a static hoisted constant. No ComponentDoc. No loader.
 * ────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, TextEditor, CodeBlock,
  Table, Badge, BarChart, ProgressBar, Sparkline,
  HorizontalBarChart, StackedBarChart, LineChart, AreaChart,
  PieChart, RadarChart,
} from '../../../packages/core/src';
import type { TableColumn } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors for the header snippet pill ───────────

const SYN = {
  tag: '#f38ba8',       // pink — JSX brackets, callback icons
  component: '#89b4fa', // blue — component names
  prop: '#cba6f7',      // mauve — prop names and icons
  value: '#f9e2af',     // yellow — style property names and icons
};

// ── Helpers ──────────────────────────────────────────────

function styleTooltip(style: Record<string, any>): { content: string; layout: string; type: string } | undefined {
  const STRUCTURAL = new Set([
    'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap',
    'alignItems', 'alignSelf', 'justifyContent', 'overflow',
    'position', 'zIndex', 'display',
  ]);
  const entries = Object.entries(style).filter(([k, v]) => !STRUCTURAL.has(k) && v !== undefined);
  if (entries.length === 0) return undefined;
  const content = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { content, layout: 'table', type: 'cursor' };
}

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── Static data (hoisted — never recreated) ──────────────

const USAGE_CODE = `<BarChart data={data} height={170} showValues interactive />
<Table columns={columns} data={rows} rowKey="id" striped />
<PieChart data={slices} size={180} innerRadius={40} interactive />
<LineChart data={points} showArea interactive color="#3b82f6" />
<Sparkline data={values} width={200} height={40} interactive />`;

const STARTER_CODE = `<Box style={{ gap: 12, padding: 16 }}>
  <BarChart
    data={[
      { label: 'Jan', value: 42 },
      { label: 'Feb', value: 56 },
      { label: 'Mar', value: 38 },
      { label: 'Apr', value: 71 },
    ]}
    height={140}
    showValues
    interactive
  />
  <ProgressBar value={0.72} showLabel label="Sync" />
</Box>`;

// ── Component catalog ────────────────────────────────────

const COMPONENTS: [string, string, string][] = [
  ['Table', 'Rows + columns with custom cell renderers', 'table'],
  ['BarChart', 'Vertical bars for category comparison', 'bar-chart-2'],
  ['HorizontalBarChart', 'Horizontal ranked bars', 'bar-chart-horizontal'],
  ['StackedBarChart', 'Stacked segments per category', 'layers'],
  ['LineChart', 'Continuous line trend with optional area fill', 'trending-up'],
  ['AreaChart', 'Filled area trend (LineChart preset)', 'mountain'],
  ['Sparkline', 'Compact inline mini trend line', 'activity'],
  ['PieChart', 'Proportional slices / donut ring', 'pie-chart'],
  ['RadarChart', 'Multi-axis polygon profile', 'radar'],
  ['ProgressBar', 'Determinate status bar with label', 'loader'],
  ['Badge', 'Status pill with semantic variants', 'tag'],
];

// Props — [name, type, icon]  (common across data components)
const PROPS: [string, string, string][] = [
  ['data', 'T[]', 'database'],
  ['columns', 'TableColumn<T>[]', 'columns'],
  ['height', 'number', 'ruler'],
  ['width', 'number', 'ruler'],
  ['size', 'number', 'maximize'],
  ['color', 'Color', 'palette'],
  ['style', 'Style', 'layout'],
  ['interactive', 'boolean', 'mouse-pointer'],
  ['showValues', 'boolean', 'hash'],
  ['showLabels', 'boolean', 'tag'],
  ['showDots', 'boolean', 'circle'],
  ['showArea', 'boolean', 'mountain'],
  ['innerRadius', 'number', 'circle'],
  ['barWidth', 'number', 'ruler'],
  ['gap', 'number', 'move'],
  ['striped', 'boolean', 'rows'],
];

// Callbacks — [name, signature, icon]
const CALLBACKS: [string, string, string][] = [
  ['onBarHover', '(idx, bar) => void', 'pointer'],
  ['onBarPress', '(idx, bar) => void', 'mouse-pointer-click'],
  ['onPointHover', '(idx, point) => void', 'pointer'],
  ['onPointPress', '(idx, point) => void', 'mouse-pointer-click'],
];

const BEHAVIOR_NOTES = [
  'All charts delegate to native Chart2D element on the Lua side.',
  'Interactive mode enables hover tooltips and dimming of non-hovered elements.',
  'AreaChart is a LineChart preset with showArea=true, areaOpacity=0.4.',
  'Badge has 5 semantic variants: default, success, warning, error, info.',
  'Table supports custom cell renderers via column.render callback.',
  'PieChart becomes a donut when innerRadius > 0.',
];

// ── Preview demo data (hoisted) ──────────────────────────

const DEMO_BAR_DATA = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 56 },
  { label: 'Mar', value: 38 },
  { label: 'Apr', value: 71 },
  { label: 'May', value: 64 },
  { label: 'Jun', value: 83 },
];

const DEMO_SPARK_DATA = [4, 7, 3, 8, 5, 9, 2, 6, 8, 3, 7, 5, 9, 4, 6, 8, 3, 7, 5, 10];

const DEMO_HBAR_DATA = [
  { label: 'JavaScript', value: 65, color: '#f7df1e' },
  { label: 'Python', value: 58, color: '#3776ab' },
  { label: 'TypeScript', value: 45, color: '#3178c6' },
  { label: 'Rust', value: 32, color: '#dea584' },
  { label: 'Go', value: 28, color: '#00add8' },
];

const DEMO_STACKED_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const DEMO_STACKED_SERIES = [
  { label: 'Product', color: '#3b82f6', data: [30, 45, 52, 60] },
  { label: 'Services', color: '#22c55e', data: [20, 25, 30, 28] },
  { label: 'Support', color: '#f59e0b', data: [10, 12, 8, 15] },
];

const DEMO_LINE_DATA = [
  { x: 'Jan', value: 42 },
  { x: 'Feb', value: 58 },
  { x: 'Mar', value: 35 },
  { x: 'Apr', value: 72 },
  { x: 'May', value: 65 },
  { x: 'Jun', value: 83 },
  { x: 'Jul', value: 78 },
];

const DEMO_AREA_DATA = [
  { x: 'Jan', value: 12 },
  { x: 'Feb', value: 19 },
  { x: 'Mar', value: 15 },
  { x: 'Apr', value: 25 },
  { x: 'May', value: 22 },
  { x: 'Jun', value: 30 },
  { x: 'Jul', value: 28 },
];

const DEMO_PIE_DATA = [
  { label: 'Chrome', value: 65, color: '#4285f4' },
  { label: 'Safari', value: 18, color: '#a3aaae' },
  { label: 'Firefox', value: 8, color: '#ff7139' },
  { label: 'Edge', value: 5, color: '#0078d7' },
  { label: 'Other', value: 4, color: '#6b7280' },
];

const DEMO_RADAR_AXES = [
  { label: 'Speed', max: 100 },
  { label: 'Power', max: 100 },
  { label: 'Defense', max: 100 },
  { label: 'Accuracy', max: 100 },
  { label: 'Stamina', max: 100 },
];

const DEMO_RADAR_DATA = [85, 70, 60, 90, 75];

interface Employee {
  name: string;
  role: string;
  status: 'active' | 'away' | 'offline';
  score: number;
}

const DEMO_EMPLOYEES: Employee[] = [
  { name: 'Alice Chen', role: 'Engineer', status: 'active', score: 94 },
  { name: 'Bob Park', role: 'Designer', status: 'active', score: 87 },
  { name: 'Carol Wu', role: 'PM', status: 'away', score: 76 },
  { name: 'Dan Kim', role: 'Engineer', status: 'active', score: 91 },
  { name: 'Eva Lopez', role: 'Data', status: 'offline', score: 82 },
];

// ── Preview sub-components (hoisted styles) ──────────────

const previewCardStyle = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  padding: 10,
  alignItems: 'center' as const,
};

function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
      <Text style={{ color: c.muted, fontSize: 7, fontWeight: 'bold', letterSpacing: 1 }}>{label}</Text>
      <Box style={previewCardStyle}>
        {children}
      </Box>
    </Box>
  );
}

function DataPreview() {
  const c = useThemeColors();
  const tableColumns: TableColumn<Employee>[] = useMemo(() => [
    { key: 'name', title: 'Name', width: 90 },
    { key: 'role', title: 'Role', width: 70 },
    {
      key: 'status',
      title: 'Status',
      width: 70,
      render: (value: Employee['status']) => (
        <Badge
          label={value}
          variant={value === 'active' ? 'success' : value === 'away' ? 'warning' : 'error'}
        />
      ),
    },
    { key: 'score', title: 'Score', width: 50, align: 'right' },
  ], []);

  return (
    <Box style={{ gap: 14, alignItems: 'center', width: '100%' }}>
      <PreviewSection label="BAR CHART">
        <BarChart data={DEMO_BAR_DATA} width={380} height={140} showValues interactive />
      </PreviewSection>

      <PreviewSection label="TABLE">
        <Table columns={tableColumns} data={DEMO_EMPLOYEES} rowKey="name" striped />
      </PreviewSection>

      <PreviewSection label="PIE / DONUT">
        <PieChart data={DEMO_PIE_DATA} size={140} innerRadius={35} interactive />
        <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>
          {DEMO_PIE_DATA.map((s) => (
            <Box key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Box style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: s.color }} />
              <Text style={{ color: c.muted, fontSize: 8 }}>{s.label}</Text>
            </Box>
          ))}
        </Box>
      </PreviewSection>

      <PreviewSection label="LINE CHART">
        <LineChart data={DEMO_LINE_DATA} width={380} height={140} showArea interactive color="#3b82f6" />
      </PreviewSection>

      <PreviewSection label="AREA CHART">
        <AreaChart data={DEMO_AREA_DATA} width={380} height={140} interactive color="#22c55e" showDots />
      </PreviewSection>

      <PreviewSection label="SPARKLINE">
        <Sparkline data={DEMO_SPARK_DATA} width={260} height={40} interactive color="#22c55e" />
      </PreviewSection>

      <PreviewSection label="HORIZONTAL BAR">
        <HorizontalBarChart data={DEMO_HBAR_DATA} width={380} showValues interactive />
      </PreviewSection>

      <PreviewSection label="STACKED BAR">
        <StackedBarChart labels={DEMO_STACKED_LABELS} series={DEMO_STACKED_SERIES} height={140} interactive />
      </PreviewSection>

      <PreviewSection label="RADAR">
        <RadarChart axes={DEMO_RADAR_AXES} data={DEMO_RADAR_DATA} size={140} interactive color="#8b5cf6" />
      </PreviewSection>

      <PreviewSection label="PROGRESS BAR">
        <Box style={{ width: '100%', maxWidth: 300, gap: 6 }}>
          <ProgressBar value={0.28} showLabel label="Build Queue" />
          <ProgressBar value={0.63} showLabel label="Data Sync" color="#f59e0b" />
          <ProgressBar value={0.91} showLabel label="Deploy" color="#22c55e" />
        </Box>
      </PreviewSection>
    </Box>
  );
}

// ── Component ────────────────────────────────────────────

export function DataStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) {
      processCode(code);
    }
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);

  const mid = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, mid);
  const col2 = PROPS.slice(mid);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="bar-chart-2" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Data'}
        </Text>

        <Box style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'BarChart'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'data'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{data}'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'interactive'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Charts, tables, and visualization.'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </Box>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>
                <DataPreview />
              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* ── Overview ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Data visualization primitives: charts, tables, progress bars, sparklines, and badges. All chart components delegate to the native Chart2D element on the Lua side for GPU-accelerated rendering. Interactive mode enables hover tooltips and element highlighting.'}
                </Text>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Behavior ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Components ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'COMPONENTS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {COMPONENTS.map(([name, desc, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.component} />
                      <Text style={{ color: SYN.component, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{desc}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Props ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'PROPS'}
                </Text>
                <Box style={{ flexDirection: 'row', gap: 8 }}>
                  <Box style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
                    {col1.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                        <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                        <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                      </Box>
                    ))}
                  </Box>
                  <Box style={{ flexGrow: 1, flexBasis: 0, gap: 3 }}>
                    {col2.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                        <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                        <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <HorizontalDivider />

                {/* ── Callbacks ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="bar-chart-2" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Data'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
          <Image
            src={playground ? 'book-open' : 'play'}
            style={{ width: 10, height: 10 }}
            tintColor={playground ? 'white' : c.text}
          />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
