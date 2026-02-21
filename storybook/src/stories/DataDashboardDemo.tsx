import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Table, BarChart, ProgressBar, Sparkline, Divider, Badge, ScrollView } from '../../../packages/core/src';
import type { TableColumn } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

/* ── Helpers ──────────────────────────────────────────────── */

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function drift(base: number, range: number) {
  return Math.max(0, base + (Math.random() - 0.4) * range);
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/* ── Data seed ────────────────────────────────────────────── */

function generateRevenue() {
  return [
    { label: 'Jul', value: rand(28, 40) },
    { label: 'Aug', value: rand(35, 48) },
    { label: 'Sep', value: rand(32, 50) },
    { label: 'Oct', value: rand(45, 60) },
    { label: 'Nov', value: rand(40, 55) },
    { label: 'Dec', value: rand(50, 68) },
    { label: 'Jan', value: rand(48, 65) },
  ];
}

function generateSpark(base: number[], variance: number): number[] {
  return base.map(v => Math.max(1, Math.round(v + (Math.random() - 0.5) * variance)));
}

const SPARK_BASE_REVENUE = [28, 32, 30, 41, 38, 45, 52, 48, 55, 61, 57, 63];
const SPARK_BASE_USERS   = [120, 135, 142, 128, 155, 168, 172, 180, 195, 210, 225, 247];
const SPARK_BASE_ERRORS  = [12, 8, 15, 6, 4, 9, 3, 7, 2, 5, 3, 1];
const SPARK_BASE_LATENCY = [180, 165, 172, 155, 148, 162, 145, 138, 142, 135, 128, 142];

interface Product {
  name: string;
  category: string;
  sales: number;
  revenue: string;
  status: string;
}

function generateProducts(): Product[] {
  const baseSales = [1247, 892, 634, 456, 321, 89];
  return [
    { name: 'Widget Pro', category: 'Hardware', sales: baseSales[0] + rand(-50, 80), revenue: `$${(48.2 + (Math.random() - 0.3) * 4).toFixed(1)}k`, status: 'active' },
    { name: 'DataSync', category: 'SaaS', sales: baseSales[1] + rand(-30, 60), revenue: `$${(35.6 + (Math.random() - 0.3) * 3).toFixed(1)}k`, status: 'active' },
    { name: 'CloudStore', category: 'Storage', sales: baseSales[2] + rand(-20, 50), revenue: `$${(28.1 + (Math.random() - 0.3) * 2.5).toFixed(1)}k`, status: 'active' },
    { name: 'NetGuard', category: 'Security', sales: baseSales[3] + rand(-15, 40), revenue: `$${(22.8 + (Math.random() - 0.3) * 2).toFixed(1)}k`, status: 'beta' },
    { name: 'FormBuilder', category: 'SaaS', sales: baseSales[4] + rand(-10, 30), revenue: `$${(12.8 + (Math.random() - 0.3) * 1.5).toFixed(1)}k`, status: 'active' },
    { name: 'OldTool', category: 'Legacy', sales: baseSales[5] + rand(-5, 15), revenue: `$${(3.5 + (Math.random() - 0.3) * 0.8).toFixed(1)}k`, status: 'deprecated' },
  ];
}

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'beta') return 'info' as const;
  return 'warning' as const;
};

const PRODUCT_COLUMNS: TableColumn<Product>[] = [
  { key: 'name', title: 'Product' },
  { key: 'category', title: 'Category' },
  { key: 'sales', title: 'Sales', width: 60, align: 'right' },
  { key: 'revenue', title: 'Revenue', width: 70, align: 'right' },
  {
    key: 'status',
    title: 'Status',
    width: 80,
    render: (value: string) => <Badge label={value} variant={statusVariant(value)} />,
  },
];

/* ── Dashboard ─────────────────────────────────────────────── */

export function DataDashboardDemoStory() {
  const c = useThemeColors();
  const BG = c.bg;
  const CARD = c.bgElevated;
  const BORDER = c.border;
  const BRIGHT = c.text;
  const DIM = c.textSecondary;
  const [tick, setTick] = useState(0);
  const [revenue, setRevenue] = useState(generateRevenue);
  const [products, setProducts] = useState(generateProducts);

  // KPI values that drift
  const [kpis, setKpis] = useState({
    revenue: 63100,
    users: 1247,
    errors: 1,
    latency: 142,
    revChange: 8.2,
    userChange: 12.1,
    errChange: -72,
    latChange: -5.3,
  });

  // Sparkline data
  const [sparks, setSparks] = useState({
    revenue: SPARK_BASE_REVENUE,
    users: SPARK_BASE_USERS,
    errors: SPARK_BASE_ERRORS,
    latency: SPARK_BASE_LATENCY,
  });

  // Targets that drift
  const [targets, setTargets] = useState([
    { label: 'Revenue Goal', value: 0.78, color: '#22c55e' },
    { label: 'User Growth', value: 0.62, color: '#3b82f6' },
    { label: 'Uptime SLA', value: 0.995, color: '#06b6d4' },
    { label: 'NPS Score', value: 0.84, color: '#8b5cf6' },
    { label: 'Bug Backlog', value: 0.35, color: '#f59e0b' },
  ]);

  // Update every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);

      setRevenue(generateRevenue());
      setProducts(generateProducts());

      setKpis(prev => ({
        revenue: Math.round(drift(prev.revenue, 3000)),
        users: Math.round(drift(prev.users, 80)),
        errors: Math.max(0, Math.round(drift(prev.errors, 2))),
        latency: Math.max(50, Math.round(drift(prev.latency, 20))),
        revChange: +(drift(prev.revChange, 3)).toFixed(1),
        userChange: +(drift(prev.userChange, 2)).toFixed(1),
        errChange: Math.min(0, +(drift(prev.errChange, 15)).toFixed(1)),
        latChange: Math.min(0, +(drift(prev.latChange, 3)).toFixed(1)),
      }));

      setSparks({
        revenue: generateSpark(SPARK_BASE_REVENUE, 10),
        users: generateSpark(SPARK_BASE_USERS, 30),
        errors: generateSpark(SPARK_BASE_ERRORS, 5),
        latency: generateSpark(SPARK_BASE_LATENCY, 25),
      });

      setTargets(prev => prev.map(t => ({
        ...t,
        value: Math.max(0.05, Math.min(1, t.value + (Math.random() - 0.45) * 0.08)),
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const kpiCards = [
    { label: 'Revenue', raw: kpis.revenue, prefix: '$', data: sparks.revenue, color: '#22c55e', change: kpis.revChange },
    { label: 'Users', raw: kpis.users, prefix: '', data: sparks.users, color: '#3b82f6', change: kpis.userChange },
    { label: 'Errors', raw: kpis.errors, prefix: '', data: sparks.errors, color: '#ef4444', change: kpis.errChange },
    { label: 'Latency', raw: kpis.latency, prefix: '', suffix: 'ms', data: sparks.latency, color: '#f59e0b', change: kpis.latChange },
  ];

  const secondsAgo = tick * 3;
  const timeLabel = secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`;

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: BG }}>
    <Box style={{ padding: 16, gap: 12 }}>

      {/* Header */}
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 18, fontWeight: 'bold' }}>Dashboard</Text>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
          <Text style={{ color: DIM, fontSize: 10 }}>Live</Text>
          <Text style={{ color: c.textDim, fontSize: 10 }}>{`(${timeLabel})`}</Text>
        </Box>
      </Box>

      <Divider color={BORDER} />

      {/* KPI Row */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        {kpiCards.map((kpi) => (
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
              <Box style={{ gap: 2, width: 80, height: 30 }}>
                <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'bold' }}>
                  {`${kpi.prefix}${formatNum(kpi.raw)}${kpi.suffix || ''}`}
                </Text>
                <Text style={{ color: kpi.change >= 0 ? kpi.color : kpi.color, fontSize: 10, fontWeight: 'bold' }}>
                  {`${kpi.change >= 0 ? '+' : ''}${kpi.change}%`}
                </Text>
              </Box>
              <Sparkline data={kpi.data} width={60} height={20} color={kpi.color} />
            </Box>
          </Box>
        ))}
      </Box>

      {/* Chart + Targets row */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
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
            data={revenue}
            height={120}
            showValues
            color="#3b82f6"
          />
        </Box>

        <Box style={{
          width: 200,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Targets</Text>
          {targets.map((metric) => (
            <Box key={metric.label} style={{ gap: 3 }}>
              <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ color: DIM, fontSize: 10 }}>{metric.label}</Text>
                <Text style={{ color: BRIGHT, fontSize: 10, fontWeight: 'bold' }}>
                  {`${Math.round(metric.value * 100)}%`}
                </Text>
              </Box>
              <ProgressBar value={metric.value} color={metric.color} height={6} animated />
            </Box>
          ))}
        </Box>
      </Box>

      {/* Table */}
      <Box style={{
        width: '100%',
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 8,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>Top Products</Text>
        <Table columns={PRODUCT_COLUMNS} data={products} rowKey="name" striped />
      </Box>

    </Box>
    </ScrollView>
  );
}
