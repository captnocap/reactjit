import React from 'react';
import { Box, Text, Table, BarChart, ProgressBar, Sparkline, Divider, Badge } from '../../../../packages/shared/src';
import type { TableColumn } from '../../../../packages/shared/src';

/* ── Data ─────────────────────────────────────────────────── */

const MONTHLY_REVENUE = [
  { label: 'Jul', value: 32 },
  { label: 'Aug', value: 41 },
  { label: 'Sep', value: 38 },
  { label: 'Oct', value: 52 },
  { label: 'Nov', value: 48 },
  { label: 'Dec', value: 61 },
  { label: 'Jan', value: 57 },
];

const SPARK_REVENUE = [28, 32, 30, 41, 38, 45, 52, 48, 55, 61, 57, 63];
const SPARK_USERS   = [120, 135, 142, 128, 155, 168, 172, 180, 195, 210, 225, 247];
const SPARK_ERRORS  = [12, 8, 15, 6, 4, 9, 3, 7, 2, 5, 3, 1];
const SPARK_LATENCY = [180, 165, 172, 155, 148, 162, 145, 138, 142, 135, 128, 142];

interface Product {
  name: string;
  category: string;
  sales: number;
  revenue: string;
  status: string;
}

const PRODUCTS: Product[] = [
  { name: 'Widget Pro', category: 'Hardware', sales: 1247, revenue: '$48.2k', status: 'active' },
  { name: 'DataSync', category: 'SaaS', sales: 892, revenue: '$35.6k', status: 'active' },
  { name: 'CloudStore', category: 'Storage', sales: 634, revenue: '$28.1k', status: 'active' },
  { name: 'NetGuard', category: 'Security', sales: 456, revenue: '$22.8k', status: 'beta' },
  { name: 'FormBuilder', category: 'SaaS', sales: 321, revenue: '$12.8k', status: 'active' },
  { name: 'OldTool', category: 'Legacy', sales: 89, revenue: '$3.5k', status: 'deprecated' },
];

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'beta') return 'info' as const;
  return 'warning' as const;
};

const PRODUCT_COLUMNS: TableColumn<Product>[] = [
  { key: 'name', title: 'Product', width: 100 },
  { key: 'category', title: 'Category', width: 80 },
  { key: 'sales', title: 'Sales', width: 60, align: 'right' },
  { key: 'revenue', title: 'Revenue', width: 70, align: 'right' },
  {
    key: 'status',
    title: 'Status',
    width: 80,
    render: (value: string) => <Badge label={value} variant={statusVariant(value)} />,
  },
];

/* ── Colors ────────────────────────────────────────────────── */

const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';
const BRIGHT = '#e2e8f0';
const DIM = '#64748b';

/* ── Dashboard ─────────────────────────────────────────────── */

export function DataDashboardDemoStory() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 16, gap: 12 }}>

      {/* Header */}
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 18, fontWeight: 'bold' }}>Dashboard</Text>
        <Text style={{ color: DIM, fontSize: 10 }}>Last updated: just now</Text>
      </Box>

      <Divider color={BORDER} />

      {/* KPI Row */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        {[
          { label: 'Revenue', value: '$63.1k', data: SPARK_REVENUE, color: '#22c55e', change: '+8.2%' },
          { label: 'Users', value: '1,247', data: SPARK_USERS, color: '#3b82f6', change: '+12.1%' },
          { label: 'Errors', value: '1', data: SPARK_ERRORS, color: '#ef4444', change: '-72%' },
          { label: 'Latency', value: '142ms', data: SPARK_LATENCY, color: '#f59e0b', change: '-5.3%' },
        ].map((kpi) => (
          <Box key={kpi.label} style={{
            flexGrow: 1,
            backgroundColor: CARD,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 10,
            gap: 6,
          }}>
            <Text style={{ color: DIM, fontSize: 10 }}>{kpi.label}</Text>
            <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box style={{ gap: 2, width: 70, height: 30 }}>
                <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'bold' }}>{kpi.value}</Text>
                <Text style={{ color: kpi.color, fontSize: 10, fontWeight: 'bold' }}>{kpi.change}</Text>
              </Box>
              <Sparkline data={kpi.data} width={60} height={20} color={kpi.color} />
            </Box>
          </Box>
        ))}
      </Box>

      {/* Middle Row: Chart + Metrics */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 12, flexGrow: 1 }}>

        {/* Bar Chart */}
        <Box style={{
          flexGrow: 1,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 8,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Monthly Revenue ($k)</Text>
          <BarChart
            data={MONTHLY_REVENUE}
            height={90}
            barWidth={24}
            gap={10}
            showValues
            color="#3b82f6"
          />
        </Box>

        {/* Progress Metrics */}
        <Box style={{
          width: 180,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Targets</Text>
          {[
            { label: 'Revenue Goal', value: 0.78, color: '#22c55e' },
            { label: 'User Growth', value: 0.62, color: '#3b82f6' },
            { label: 'Uptime SLA', value: 0.995, color: '#06b6d4' },
            { label: 'NPS Score', value: 0.84, color: '#8b5cf6' },
            { label: 'Bug Backlog', value: 0.35, color: '#f59e0b' },
          ].map((metric) => (
            <Box key={metric.label} style={{ gap: 3 }}>
              <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ color: DIM, fontSize: 10 }}>{metric.label}</Text>
                <Text style={{ color: BRIGHT, fontSize: 10, fontWeight: 'bold' }}>
                  {`${Math.round(metric.value * 100)}%`}
                </Text>
              </Box>
              <ProgressBar value={metric.value} color={metric.color} height={6} />
            </Box>
          ))}
        </Box>

      </Box>

      {/* Bottom: Table */}
      <Box style={{
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 8,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Top Products</Text>
        <Table columns={PRODUCT_COLUMNS} data={PRODUCTS} rowKey="name" striped />
      </Box>

    </Box>
  );
}
