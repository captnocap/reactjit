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

import React, { useState } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, TextEditor, CodeBlock,
  Table, Badge, BarChart, ProgressBar, Sparkline,
  HorizontalBarChart, StackedBarChart, LineChart, AreaChart,
  PieChart, RadarChart, useMount, classifiers as S} from '../../../packages/core/src';
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
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
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
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  padding: 10,
  alignItems: 'center' as const,
  overflow: 'hidden' as const,
};

function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <S.CenterW100 style={{ gap: 6 }}>
      <S.DimMicro style={{ fontWeight: 'bold', letterSpacing: 1 }}>{label}</S.DimMicro>
      <Box style={previewCardStyle}>
        {children}
      </Box>
    </S.CenterW100>
  );
}

function DataPreview() {
  const c = useThemeColors();
  const tableColumns: TableColumn<Employee>[] = [
    { key: 'name', title: 'Name' },
    { key: 'role', title: 'Role' },
    {
      key: 'status',
      title: 'Status',
      width: 56,
      render: (value: Employee['status']) => (
        <Badge
          label={value}
          variant={value === 'active' ? 'success' : value === 'away' ? 'warning' : 'error'}
        />
      ),
    },
    { key: 'score', title: 'Score', width: 42, align: 'right' },
  ];

  return (
    <S.CenterW100 style={{ gap: 14 }}>
      <PreviewSection label="BAR CHART">
        <BarChart data={DEMO_BAR_DATA} height={140} showValues interactive style={{ width: '100%' }} />
      </PreviewSection>

      <PreviewSection label="TABLE">
        <Table columns={tableColumns} data={DEMO_EMPLOYEES} rowKey="name" striped />
      </PreviewSection>

      <PreviewSection label="PIE / DONUT">
        <PieChart data={DEMO_PIE_DATA} size={140} innerRadius={35} interactive />
        <S.RowG6 style={{ width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
          {DEMO_PIE_DATA.map((s) => (
            <S.RowCenter key={s.label} style={{ gap: 3 }}>
              <Box style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: s.color }} />
              <S.StoryTiny>{s.label}</S.StoryTiny>
            </S.RowCenter>
          ))}
        </S.RowG6>
      </PreviewSection>

      <PreviewSection label="LINE CHART">
        <LineChart data={DEMO_LINE_DATA} height={140} showArea interactive color="#3b82f6" style={{ width: '100%' }} />
      </PreviewSection>

      <PreviewSection label="AREA CHART">
        <AreaChart data={DEMO_AREA_DATA} height={140} interactive color="#22c55e" showDots style={{ width: '100%' }} />
      </PreviewSection>

      <PreviewSection label="SPARKLINE">
        <Sparkline data={DEMO_SPARK_DATA} width={400} height={40} interactive color="#22c55e" />
      </PreviewSection>

      <PreviewSection label="HORIZONTAL BAR">
        <HorizontalBarChart data={DEMO_HBAR_DATA} width={400} showValues interactive />
      </PreviewSection>

      <PreviewSection label="STACKED BAR">
        <StackedBarChart labels={DEMO_STACKED_LABELS} series={DEMO_STACKED_SERIES} height={140} interactive style={{ width: '100%' }} />
      </PreviewSection>

      <PreviewSection label="RADAR">
        <RadarChart axes={DEMO_RADAR_AXES} data={DEMO_RADAR_DATA} size={140} interactive color="#8b5cf6" />
      </PreviewSection>

      <PreviewSection label="PROGRESS BAR">
        <S.StackG6W100>
          <ProgressBar value={0.28} showLabel label="Build Queue" />
          <ProgressBar value={0.63} showLabel label="Data Sync" color="#f59e0b" />
          <ProgressBar value={0.91} showLabel label="Deploy" color="#22c55e" />
        </S.StackG6W100>
      </PreviewSection>
    </S.CenterW100>
  );
}

// ── Component ────────────────────────────────────────────

export function DataStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = (src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  };

  useMount(() => {
    if (code) processCode(code);
  });

  const handleCodeChange = (src: string) => {
    setCode(src);
    processCode(src);
  };

  const mid = Math.ceil(PROPS.length / 2);
  const col1 = PROPS.slice(0, mid);
  const col2 = PROPS.slice(mid);

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.PrimaryIcon20 src="bar-chart-2" />

        <S.StoryTitle>
          {'Data'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'BarChart'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'data'}</Text>
          <S.StoryMuted>{'='}</S.StoryMuted>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{data}'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'interactive'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'/>'}</Text>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'Numbers pretending to be shapes'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <S.RowGrow>
        {playground ? (
          <>
            <S.Half>
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
            </S.Half>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <S.StackG10W100 style={{ padding: 14 }}>
                <DataPreview />
              </S.StackG10W100>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <S.StackG10W100 style={{ padding: 14 }}>

                {/* ── Overview ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </S.StoryTiny>
                <S.StoryBody>
                  {'Data visualization primitives: charts, tables, progress bars, sparklines, and badges. All chart components delegate to the native Chart2D element on the Lua side for GPU-accelerated rendering. Interactive mode enables hover tooltips and element highlighting.'}
                </S.StoryBody>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'USAGE'}
                </S.StoryTiny>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Behavior ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </S.StoryTiny>
                <Box style={{ gap: 4, width: '100%' }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <S.RowG6 key={i} style={{ alignItems: 'flex-start', width: '100%' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 2 }} tintColor={c.muted} />
                      <S.StoryBody style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>{note}</S.StoryBody>
                    </S.RowG6>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Components ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'COMPONENTS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {COMPONENTS.map(([name, desc, icon]) => (
                    <S.RowCenterG5 key={name} style={{ flexWrap: 'nowrap' }}>
                      <S.StorySectionIcon src={icon} style={{ flexShrink: 0 }} tintColor={SYN.component} />
                      <Text style={{ color: SYN.component, fontSize: 9, fontWeight: 'bold' }} numberOfLines={1}>{name}</Text>
                      <S.StoryCap numberOfLines={1}>{desc}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Props ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'PROPS'}
                </S.StoryTiny>
                <S.RowG8>
                  <S.Half style={{ gap: 3 }}>
                    {col1.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'nowrap' }}>
                        <Image src={icon} style={{ width: 10, height: 10, flexShrink: 0 }} tintColor={SYN.prop} />
                        <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }} numberOfLines={1}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }} numberOfLines={1}>{type}</Text>
                      </Box>
                    ))}
                  </S.Half>
                  <S.Half style={{ gap: 3 }}>
                    {col2.map(([prop, type, icon]) => (
                      <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'nowrap' }}>
                        <Image src={icon} style={{ width: 10, height: 10, flexShrink: 0 }} tintColor={SYN.prop} />
                        <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }} numberOfLines={1}>{prop}</Text>
                        <Text style={{ color: c.muted, fontSize: 9 }} numberOfLines={1}>{type}</Text>
                      </Box>
                    ))}
                  </S.Half>
                </S.RowG8>

                <HorizontalDivider />

                {/* ── Callbacks ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'CALLBACKS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <S.RowCenterG5 key={name} style={{ flexWrap: 'nowrap' }}>
                      <S.StorySectionIcon src={icon} style={{ flexShrink: 0 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }} numberOfLines={1}>{name}</Text>
                      <S.StoryCap numberOfLines={1}>{sig}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

              </S.StackG10W100>
            </ScrollView>
          </>
        )}
      </S.RowGrow>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Core'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="bar-chart-2" />
        <S.StoryBreadcrumbActive>{'Data'}</S.StoryBreadcrumbActive>

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
          <S.StorySectionIcon src={playground ? 'book-open' : 'play'} tintColor={playground ? 'white' : c.text} />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
