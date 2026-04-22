const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Graph, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface WorkerStatRow {
  id: string;
  name: string;
  accent: string;
  linesChanged: number;
  commits: number;
  uptimeSec: number;
  tasksCompleted: number;
  sparkline: number[]; // last N samples — tool-calls or similar activity
}

export interface WorkerStatsProps {
  rows: WorkerStatRow[];
  max?: number;
}

function fmtUptime(secs: number): string {
  if (secs < 60) return secs + 's';
  const m = Math.floor(secs / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? h + 'h' : h + 'h ' + rem + 'm';
}

function sparkPath(samples: number[], width: number, height: number): string {
  if (samples.length === 0) return '';
  let max = 0;
  for (const s of samples) if (s > max) max = s;
  if (max <= 0) max = 1;
  const step = samples.length === 1 ? width : width / (samples.length - 1);
  const parts: string[] = [];
  samples.forEach((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 2) - 1;
    parts.push((i === 0 ? 'M ' : 'L ') + x.toFixed(1) + ' ' + y.toFixed(1));
  });
  return parts.join(' ');
}

export function WorkerStats({ rows, max }: WorkerStatsProps) {
  const tone = COLORS.blue || '#2d62ff';
  const capped = typeof max === 'number' ? rows.slice(0, max) : rows;
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    lines: acc.lines + r.linesChanged,
    commits: acc.commits + r.commits,
    tasks: acc.tasks + r.tasksCompleted,
  }), { lines: 0, commits: 0, tasks: 0 }), [rows]);

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8, padding: 10, gap: 6,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 4, height: 12, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>WORKER STATS</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
          {totals.commits} commits · {totals.lines} Δlines · {totals.tasks} tasks
        </Text>
      </Row>

      <ScrollView style={{ maxHeight: 220 }}>
        <Col style={{ gap: 4 }}>
          {capped.map((r) => (
            <Row key={r.id} style={{
              alignItems: 'center', gap: 8,
              padding: 8, borderRadius: 6,
              backgroundColor: COLORS.panelAlt || '#05090f',
              borderWidth: 1, borderColor: COLORS.border || '#1f2630',
            }}>
              <Box style={{ width: 6, height: 26, backgroundColor: r.accent, borderRadius: 2 }} />
              <Col style={{ width: 80 }}>
                <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>{r.name}</Text>
                <Text style={{ color: COLORS.textDim, fontSize: 9 }}>up {fmtUptime(r.uptimeSec)}</Text>
              </Col>
              <Stat label="Δ" value={r.linesChanged} tone={COLORS.green || '#7ee787'} />
              <Stat label="⏎" value={r.commits} tone={COLORS.purple || '#d2a8ff'} />
              <Stat label="✓" value={r.tasksCompleted} tone={COLORS.yellow || '#f2e05a'} />
              <Box style={{ width: 72, height: 28 }}>
                <Graph style={{ width: '100%', height: '100%' }}>
                  <Graph.Path d={sparkPath(r.sparkline, 72, 28)} stroke={r.accent} strokeWidth={1.5} fill="none" />
                </Graph>
              </Box>
            </Row>
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Col style={{ alignItems: 'center', width: 44 }}>
      <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: COLORS.textBright, fontSize: 13, fontWeight: 700 }}>{value}</Text>
    </Col>
  );
}
