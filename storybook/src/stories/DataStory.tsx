import React, { useMemo } from 'react';
import {
  Box,
  Text,
  Table,
  Badge,
  BarChart,
  ProgressBar,
  Sparkline,
  HorizontalBarChart,
  StackedBarChart,
  LineChart,
  AreaChart,
  PieChart,
  RadarChart,
} from '../../../packages/shared/src';
import type { TableColumn } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

type DataView =
  | 'table'
  | 'bar'
  | 'progress'
  | 'sparkline'
  | 'horizontal'
  | 'stacked'
  | 'line'
  | 'area'
  | 'pie'
  | 'radar';

interface Employee {
  name: string;
  role: string;
  status: 'active' | 'away' | 'offline';
  score: number;
}

const EMPLOYEES: Employee[] = [
  { name: 'Alice Chen', role: 'Engineer', status: 'active', score: 94 },
  { name: 'Bob Park', role: 'Designer', status: 'active', score: 87 },
  { name: 'Carol Wu', role: 'PM', status: 'away', score: 76 },
  { name: 'Dan Kim', role: 'Engineer', status: 'active', score: 91 },
  { name: 'Eva Lopez', role: 'Data', status: 'offline', score: 82 },
];

const BAR_DATA = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 56 },
  { label: 'Mar', value: 38 },
  { label: 'Apr', value: 71 },
  { label: 'May', value: 64 },
  { label: 'Jun', value: 83 },
];

const SPARK_DATA = [4, 7, 3, 8, 5, 9, 2, 6, 8, 3, 7, 5, 9, 4, 6, 8, 3, 7, 5, 10];

const HBAR_DATA = [
  { label: 'JavaScript', value: 65, color: '#f7df1e' },
  { label: 'Python', value: 58, color: '#3776ab' },
  { label: 'TypeScript', value: 45, color: '#3178c6' },
  { label: 'Rust', value: 32, color: '#dea584' },
  { label: 'Go', value: 28, color: '#00add8' },
];

const STACKED_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const STACKED_SERIES = [
  { label: 'Product', color: '#3b82f6', data: [30, 45, 52, 60] },
  { label: 'Services', color: '#22c55e', data: [20, 25, 30, 28] },
  { label: 'Support', color: '#f59e0b', data: [10, 12, 8, 15] },
];

const LINE_DATA = [
  { x: 'Jan', value: 42 },
  { x: 'Feb', value: 58 },
  { x: 'Mar', value: 35 },
  { x: 'Apr', value: 72 },
  { x: 'May', value: 65 },
  { x: 'Jun', value: 83 },
  { x: 'Jul', value: 78 },
];

const AREA_DATA = [
  { x: 'Jan', value: 12 },
  { x: 'Feb', value: 19 },
  { x: 'Mar', value: 15 },
  { x: 'Apr', value: 25 },
  { x: 'May', value: 22 },
  { x: 'Jun', value: 30 },
  { x: 'Jul', value: 28 },
];

const PIE_DATA = [
  { label: 'Chrome', value: 65, color: '#4285f4' },
  { label: 'Safari', value: 18, color: '#a3aaae' },
  { label: 'Firefox', value: 8, color: '#ff7139' },
  { label: 'Edge', value: 5, color: '#0078d7' },
  { label: 'Other', value: 4, color: '#6b7280' },
];

const RADAR_AXES = [
  { label: 'Speed', max: 100 },
  { label: 'Power', max: 100 },
  { label: 'Defense', max: 100 },
  { label: 'Accuracy', max: 100 },
  { label: 'Stamina', max: 100 },
];

const RADAR_DATA = [85, 70, 60, 90, 75];

const VIEW_OPTIONS: Array<{ id: DataView; label: string; subtitle: string }> = [
  { id: 'table', label: 'Table', subtitle: 'Rows + custom cells' },
  { id: 'bar', label: 'Bar Chart', subtitle: 'Category comparison' },
  { id: 'progress', label: 'Progress', subtitle: 'Status bars' },
  { id: 'sparkline', label: 'Sparkline', subtitle: 'Mini trend lines' },
  { id: 'horizontal', label: 'Horizontal Bar', subtitle: 'Ranked values' },
  { id: 'stacked', label: 'Stacked Bar', subtitle: 'Composed totals' },
  { id: 'line', label: 'Line Chart', subtitle: 'Continuous trend' },
  { id: 'area', label: 'Area Chart', subtitle: 'Filled trend' },
  { id: 'pie', label: 'Pie / Donut', subtitle: 'Share breakdown' },
  { id: 'radar', label: 'Radar', subtitle: 'Axis profile' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Text style={{ color: c.text, fontSize: 12 }}>{title}</Text>
  );
}

function DataViewBody({ view }: { view: DataView }) {
  const c = useThemeColors();
  const tableColumns: TableColumn<Employee>[] = useMemo(() => [
    { key: 'name', title: 'Name', width: 110 },
    { key: 'role', title: 'Role', width: 90 },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: (value: Employee['status']) => (
        <Badge
          label={value}
          variant={value === 'active' ? 'success' : value === 'away' ? 'warning' : 'error'}
        />
      ),
    },
    { key: 'score', title: 'Score', width: 60, align: 'right' },
  ], []);

  if (view === 'table') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <Table
          columns={tableColumns}
          data={EMPLOYEES}
          rowKey="name"
          striped
          style={{ alignSelf: 'center' }}
        />
      </Box>
    );
  }

  if (view === 'bar') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <BarChart data={BAR_DATA} height={170} showValues interactive />
      </Box>
    );
  }

  if (view === 'progress') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <Box style={{ width: '100%', maxWidth: 420, gap: 8, alignItems: 'center' }}>
          <ProgressBar value={0.28} showLabel label="Build Queue" style={{ width: 320 }} />
          <ProgressBar value={0.63} showLabel label="Data Sync" color={c.warning} style={{ width: 320 }} />
          <ProgressBar value={0.91} showLabel label="Deploy" color={c.success} style={{ width: 320 }} />
        </Box>
      </Box>
    );
  }

  if (view === 'sparkline') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <Box style={{ gap: 10, alignItems: 'center' }}>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>Revenue trend</Text>
            <Sparkline data={SPARK_DATA} width={360} height={52} interactive color="#22c55e" />
          </Box>
          <Box style={{ gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>Latency trend</Text>
            <Sparkline data={SPARK_DATA.map((v) => 14 - (v / 2))} width={360} height={52} interactive color="#ef4444" />
          </Box>
        </Box>
      </Box>
    );
  }

  if (view === 'horizontal') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <HorizontalBarChart data={HBAR_DATA} showValues interactive />
      </Box>
    );
  }

  if (view === 'stacked') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <StackedBarChart labels={STACKED_LABELS} series={STACKED_SERIES} interactive />
      </Box>
    );
  }

  if (view === 'line') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <LineChart data={LINE_DATA} showArea interactive color="#3b82f6" />
      </Box>
    );
  }

  if (view === 'area') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <AreaChart data={AREA_DATA} interactive color="#22c55e" showDots />
      </Box>
    );
  }

  if (view === 'pie') {
    return (
      <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
        <Box style={{ gap: 10, alignItems: 'center' }}>
          <PieChart data={PIE_DATA} size={190} innerRadius={44} interactive />
          <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
            {PIE_DATA.map((slice) => (
              <Box key={slice.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Box style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: slice.color }} />
                <Text style={{ color: c.textSecondary, fontSize: 10 }}>{slice.label}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', maxWidth: 620, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, alignItems: 'center' }}>
      <RadarChart axes={RADAR_AXES} data={RADAR_DATA} size={180} interactive color="#8b5cf6" />
    </Box>
  );
}

export function DataStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, alignItems: 'center', overflow: 'scroll' }}>
      <Box style={{ width: '100%', maxWidth: 860, gap: 14, alignItems: 'center' }}>
        <Section title="1. Data Primitives">
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            One page with all chart/table primitives in section order.
          </Text>
        </Section>

        {VIEW_OPTIONS.map((opt, idx) => (
          <Section key={opt.id} title={`${idx + 2}. ${opt.label}`}>
            <Box style={{
              width: '100%',
              backgroundColor: c.bgElevated,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 12,
              gap: 10,
              alignItems: 'center',
            }}>
              <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>{opt.subtitle}</Text>
            <DataViewBody view={opt.id} />
            </Box>
          </Section>
        ))}
      </Box>
    </Box>
  );
}
