import React, { useMemo } from 'react';
import {
  Box, Text, ScrollView, ProgressBar,
  useSystemMonitor,
} from '@reactjit/core';
import { C } from '../theme';

// ── Static style constants (never recreated) ─────────────────────────────
const S = {
  root:       { flexGrow: 1, flexDirection: 'column' } as const,
  header:     { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1 } as const,
  scroll:     { flexGrow: 1 } as const,
  content:    { padding: 12, gap: 14 } as const,
  section:    { gap: 4 } as const,
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as const,
  procMeta:   { flexDirection: 'row', gap: 12 } as const,
};

// ── Unicode block heatmap ─────────────────────────────────────────────────
// 8 levels: ▁▂▃▄▅▆▇█ — one character per core, one Text element total
const BLOCKS = '\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';
function toBlock(pct: number): string {
  return BLOCKS[Math.min(7, Math.floor(pct / 100 * 8))];
}

// ── Color helpers ─────────────────────────────────────────────────────────
function cpuColor(pct: number): string {
  return pct > 80 ? C.deny : pct > 50 ? C.warning : C.approve;
}
function memColor(pct: number): string {
  return pct > 0.85 ? C.deny : pct > 0.7 ? C.warning : C.accent;
}

// ── Sub-components (all memoized) ─────────────────────────────────────────

interface CpuData {
  total: number;
  loadAvg: number[];
  cores?: Array<{ id: number; usage: number }>;
}

const CpuSection = React.memo(function CpuSection({ cpu }: { cpu: CpuData }) {
  const color = cpuColor(cpu.total);
  const heatmap = useMemo(
    () => (cpu.cores ?? []).map(c => toBlock(c.usage)).join(''),
    [cpu.cores],
  );
  const load = useMemo(
    () => `load: ${cpu.loadAvg.map(v => v.toFixed(2)).join('  ')}`,
    [cpu.loadAvg],
  );

  return (
    <Box style={S.section}>
      <Box style={S.row}>
        <Text style={{ fontSize: 10, color: C.textDim }}>{'CPU'}</Text>
        <Text style={{ fontSize: 10, color }}>{`${cpu.total.toFixed(0)}%`}</Text>
      </Box>
      <ProgressBar value={cpu.total / 100} height={4} color={color} trackColor={C.border} />
      <Text style={{ fontSize: 9, color: C.textMuted }}>{load}</Text>
      {heatmap.length > 0 && (
        <Text style={{ fontSize: 8, color, letterSpacing: 1 }}>{heatmap}</Text>
      )}
    </Box>
  );
});

interface MemData {
  used: number;
  total: number;
  swap?: { used: number; total: number };
}

const MemorySection = React.memo(function MemorySection({ mem }: { mem: MemData }) {
  const pct = mem.total > 0 ? mem.used / mem.total : 0;
  const color = memColor(pct);
  const label = `${mem.used.toFixed(1)} / ${mem.total.toFixed(1)} GiB`;

  return (
    <Box style={S.section}>
      <Box style={S.row}>
        <Text style={{ fontSize: 10, color: C.textDim }}>{'MEMORY'}</Text>
        <Text style={{ fontSize: 10, color }}>{label}</Text>
      </Box>
      <ProgressBar value={pct} height={4} color={color} trackColor={C.border} />
      {mem.swap && mem.swap.total > 0 && (
        <Text style={{ fontSize: 9, color: C.textMuted }}>
          {`swap: ${mem.swap.used.toFixed(1)} / ${mem.swap.total.toFixed(1)} GiB`}
        </Text>
      )}
    </Box>
  );
});

interface GpuData {
  utilization?: number;
  name?: string;
  memUsed?: number;
  memTotal?: number;
  memUnit?: string;
}

const GpuSection = React.memo(function GpuSection({ gpu }: { gpu: GpuData }) {
  const util = gpu.utilization ?? 0;
  return (
    <Box style={S.section}>
      <Box style={S.row}>
        <Text style={{ fontSize: 10, color: C.textDim }}>{'GPU'}</Text>
        <Text style={{ fontSize: 10, color: C.text }}>{`${util.toFixed(0)}%`}</Text>
      </Box>
      <ProgressBar value={util / 100} height={4} color={C.accent} trackColor={C.border} />
      {gpu.name && (
        <Text style={{ fontSize: 9, color: C.textMuted }}>{gpu.name}</Text>
      )}
      {gpu.memUsed != null && gpu.memTotal != null && (
        <Text style={{ fontSize: 9, color: C.textMuted }}>
          {`vram: ${gpu.memUsed}${gpu.memUnit} / ${gpu.memTotal}${gpu.memUnit}`}
        </Text>
      )}
    </Box>
  );
});

interface Process {
  pid: number;
  command: string;
  cpu: number;
  mem: number;
}

const ProcessList = React.memo(function ProcessList({ procs }: { procs: Process[] }) {
  if (procs.length === 0) return null;
  return (
    <Box style={S.section}>
      <Text style={{ fontSize: 10, color: C.textDim }}>{'TOP PROCESSES'}</Text>
      {procs.map((p, i) => (
        <Box key={`${p.pid}-${i}`} style={S.row}>
          <Text style={{ fontSize: 9, color: C.text, flexGrow: 1 }}>
            {p.command.length > 24 ? p.command.slice(0, 24) + '\u2026' : p.command}
          </Text>
          <Box style={S.procMeta}>
            <Text style={{ fontSize: 9, color: p.cpu > 50 ? C.warning : C.textDim }}>
              {`${p.cpu.toFixed(0)}%`}
            </Text>
            <Text style={{ fontSize: 9, color: C.textDim }}>
              {`${p.mem.toFixed(0)}%`}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
});

// ── Main component ────────────────────────────────────────────────────────

export const SystemPanel = React.memo(function SystemPanel() {
  const sys = useSystemMonitor({ interval: 5000 });

  const cpuData = useMemo<CpuData>(() => ({
    total:   sys.cpu?.total   ?? 0,
    loadAvg: sys.cpu?.loadAvg ?? [0, 0, 0],
    cores:   sys.cpu?.cores,
  }), [sys.cpu?.total, sys.cpu?.loadAvg, sys.cpu?.cores]);

  const memData = useMemo<MemData | null>(() => sys.memory
    ? { used: sys.memory.used, total: sys.memory.total, swap: sys.memory.swap }
    : null,
  [sys.memory?.used, sys.memory?.total, sys.memory?.swap]);

  const gpu = sys.gpu?.[0] ?? null;

  const procs = useMemo<Process[]>(
    () => (sys.processes ?? []).slice(0, 5),
    [sys.processes],
  );

  return (
    <Box style={S.root}>
      <Box style={{ ...S.header, borderColor: C.border }}>
        <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'SYSTEM'}</Text>
      </Box>

      <ScrollView style={S.scroll}>
        <Box style={S.content}>
          <CpuSection cpu={cpuData} />
          {memData && <MemorySection mem={memData} />}
          {gpu    && <GpuSection    gpu={gpu} />}
          <ProcessList procs={procs} />
        </Box>
      </ScrollView>
    </Box>
  );
});
