import React, { useState } from 'react';
import {
  Box, Text, Divider, Spacer, Pressable, ScrollView,
  useSystemInfo, useSystemMonitor, usePorts,
  formatUptime, formatMemory, formatRate, formatTotalBytes,
  useWindowDimensions,
} from '../../../packages/core/src';
import type { CoreInfo, ProcessInfo, NetworkInterface, DiskDevice, GpuInfo, PortInfo } from '../../../packages/core/src';

/* ── heart pixel grid (13 wide x 10 tall) ──────────────────── */

const HEART_LINES = [
  '  ███   ███  ',
  ' █████ █████ ',
  '█████████████',
  '█████████████',
  ' ███████████ ',
  '  █████████  ',
  '   ███████   ',
  '    █████    ',
  '     ███     ',
  '      █      ',
];

const HEART_GRID = HEART_LINES.map(line =>
  [...line].map(ch => ch !== ' ')
);

const HEART_COLORS = [
  '#ff6b9d', '#ff5277', '#e94560', '#e94560',
  '#d63447', '#c62828', '#b71c1c', '#9a0007',
  '#7f0000', '#5d0000',
];

const HEART_PX = 8;
const HEART_COLS = 13;
const HEART_ROWS = 10;

/* ── theme ────────────────────────────────────────────────── */

const BG      = '#0e0e18';
const CARD_BG = '#12121f';
const ACCENT  = '#e94560';
const GREEN   = '#4ade80';
const YELLOW  = '#facc15';
const BLUE    = '#60a5fa';
const CYAN    = '#22d3ee';
const PURPLE  = '#a78bfa';
const BRIGHT  = '#e0e0f0';
const MID     = '#8888aa';
const DIM     = '#444466';
const BORDER  = '#1a1a2e';

const PALETTE = [
  '#e94560', '#ff6b6b', '#533483', '#845ec2',
  '#0f3460', '#4b8bbe', '#16213e', '#1a1a2e',
];

/* ── tiny helpers ────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: ACCENT, fontSize: 11, fontWeight: '700' }}>{title}</Text>
      {children}
    </Box>
  );
}

function Bar({ value, max, width, color, height }: { value: number; max: number; width: number; color: string; height?: number }) {
  const h = height || 6;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <Box style={{ width, height: h, backgroundColor: '#1e1e30', borderRadius: 2 }}>
      <Box style={{ width: Math.round(width * pct), height: h, backgroundColor: color, borderRadius: 2 }} />
    </Box>
  );
}

function Label({ text, color }: { text: string; color?: string }) {
  return <Text style={{ fontSize: 10, color: color || MID }}>{text}</Text>;
}

function Val({ text, color }: { text: string; color?: string }) {
  return <Text style={{ fontSize: 10, color: color || BRIGHT }}>{text}</Text>;
}

/* ── CPU bars ────────────────────────────────────────────────── */

function CpuPanel({ cores, total, loadAvg }: { cores: CoreInfo[]; total: number; loadAvg: [number, number, number] }) {
  const chipBarW = 30;
  return (
    <Section title="CPU">
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        <Label text={`${total.toFixed(0)}%`} color={total > 80 ? ACCENT : total > 50 ? YELLOW : GREEN} />
        <Label text={`load ${loadAvg[0].toFixed(2)} ${loadAvg[1].toFixed(2)} ${loadAvg[2].toFixed(2)}`} />
      </Box>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%', justifyContent: 'center' }}>
        {cores.map((c) => (
          <Box key={c.id} style={{
            width: 58,
            backgroundColor: '#1a1a2a',
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 4,
            paddingBottom: 4,
            gap: 3,
          }}>
            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <Label text={`c${c.id}`} />
              <Box style={{ width: 26 }}>
                <Label text={`${c.usage.toFixed(0)}%`} color={BRIGHT} />
              </Box>
            </Box>
            <Box style={{ alignItems: 'center', width: '100%' }}>
              <Bar value={c.usage} max={100} width={chipBarW} color={c.usage > 80 ? ACCENT : c.usage > 50 ? YELLOW : GREEN} height={4} />
            </Box>
          </Box>
        ))}
      </Box>
    </Section>
  );
}

/* ── Memory panel ────────────────────────────────────────────── */

const STAT_LABEL_W = 34;
const STAT_BAR_W   = 160;

function MemoryPanel({ mem }: { mem: { total: number; used: number; buffers: number; cached: number; swap: { total: number; used: number }; unit: string } }) {
  const pctUsed = mem.total > 0 ? (mem.used / mem.total * 100) : 0;
  const pctSwap = mem.swap.total > 0 ? (mem.swap.used / mem.swap.total * 100) : 0;
  return (
    <Section title="MEMORY">
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: STAT_LABEL_W }}><Label text="RAM" /></Box>
        <Bar value={mem.used} max={mem.total} width={STAT_BAR_W} color={pctUsed > 80 ? ACCENT : pctUsed > 60 ? YELLOW : BLUE} height={8} />
        <Val text={`${mem.used.toFixed(1)}/${mem.total.toFixed(1)} ${mem.unit}`} />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: STAT_LABEL_W }}><Label text="SWP" /></Box>
        <Bar value={mem.swap.used} max={mem.swap.total || 1} width={STAT_BAR_W} color={pctSwap > 50 ? ACCENT : PURPLE} height={8} />
        <Val text={`${mem.swap.used.toFixed(1)}/${mem.swap.total.toFixed(1)} ${mem.unit}`} />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Label text={`buf ${mem.buffers.toFixed(2)}`} />
        <Label text={`cache ${mem.cached.toFixed(2)}`} />
      </Box>
    </Section>
  );
}

/* ── Process table ───────────────────────────────────────────── */

function ProcessTable({ procs }: { procs: ProcessInfo[] }) {
  const top = procs.slice(0, 12);
  return (
    <Section title="PROCESSES">
      <Box style={{ flexDirection: 'row', gap: 0 }}>
        <Box style={{ width: 44 }}><Label text="PID" color={DIM} /></Box>
        <Box style={{ width: 50 }}><Label text="CPU%" color={DIM} /></Box>
        <Box style={{ width: 50 }}><Label text="MEM%" color={DIM} /></Box>
        <Box style={{ width: 200 }}><Label text="COMMAND" color={DIM} /></Box>
      </Box>
      {top.map((p, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 0 }}>
          <Box style={{ width: 44 }}><Val text={`${p.pid}`} color={MID} /></Box>
          <Box style={{ width: 50 }}><Val text={p.cpu.toFixed(1)} color={p.cpu > 50 ? ACCENT : p.cpu > 10 ? YELLOW : BRIGHT} /></Box>
          <Box style={{ width: 50 }}><Val text={p.mem.toFixed(1)} color={p.mem > 20 ? ACCENT : BRIGHT} /></Box>
          <Box style={{ width: 200 }}><Val text={p.command.slice(0, 35)} color={MID} /></Box>
        </Box>
      ))}
    </Section>
  );
}

/* ── GPU panel ───────────────────────────────────────────────── */

function GpuPanel({ gpus }: { gpus: GpuInfo[] }) {
  return (
    <Section title="GPU">
      {gpus.map((g, i) => (
        <Box key={i} style={{ gap: 4 }}>
          <Label text={g.name} color={BRIGHT} />
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: STAT_LABEL_W }}><Label text="util" /></Box>
            <Bar value={g.utilization} max={100} width={STAT_BAR_W} color={g.utilization > 80 ? ACCENT : GREEN} height={8} />
            <Val text={`${g.utilization}%`} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: STAT_LABEL_W }}><Label text="vram" /></Box>
            <Bar value={g.memUsed} max={g.memTotal} width={STAT_BAR_W} color={PURPLE} height={8} />
            <Val text={`${g.memUsed}/${g.memTotal} ${g.memUnit}`} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Label text={`${g.temperature}C`} color={g.temperature > 80 ? ACCENT : BRIGHT} />
            {g.power > 0 && <Label text={`${g.power.toFixed(0)}W`} />}
          </Box>
        </Box>
      ))}
    </Section>
  );
}

/* ── Network panel ───────────────────────────────────────────── */

function NetworkPanel({ interfaces }: { interfaces: NetworkInterface[] }) {
  return (
    <Section title="NETWORK">
      {interfaces.map((iface) => (
        <Box key={iface.name} style={{ flexDirection: 'row', gap: 0 }}>
          <Box style={{ width: 68 }}><Label text={iface.name} color={CYAN} /></Box>
          <Box style={{ width: 90 }}><Label text={`rx ${formatRate(iface.rxRate)}`} color={GREEN} /></Box>
          <Box style={{ width: 90 }}><Label text={`tx ${formatRate(iface.txRate)}`} color={YELLOW} /></Box>
          <Box style={{ width: 76 }}><Label text={formatTotalBytes(iface.rxBytes)} /></Box>
        </Box>
      ))}
    </Section>
  );
}

/* ── Disk panel ──────────────────────────────────────────────── */

function DiskPanel({ devices }: { devices: DiskDevice[] }) {
  return (
    <Section title="DISK">
      {devices.map((dev) => (
        <Box key={dev.name} style={{ flexDirection: 'row', gap: 0 }}>
          <Box style={{ width: 68 }}><Label text={dev.name} color={PURPLE} /></Box>
          <Box style={{ width: 128 }}><Label text={`R ${formatRate(dev.readRate)}`} color={GREEN} /></Box>
          <Box style={{ width: 128 }}><Label text={`W ${formatRate(dev.writeRate)}`} color={YELLOW} /></Box>
        </Box>
      ))}
    </Section>
  );
}

/* ── Ports panel ─────────────────────────────────────────────── */

function PortsPanel({ ports, onKill }: { ports: PortInfo[]; onKill: (pid: number) => void }) {
  return (
    <Section title="LISTENING PORTS">
      <Box style={{ flexDirection: 'row', gap: 0 }}>
        <Box style={{ width: 50 }}><Label text="PORT" color={DIM} /></Box>
        <Box style={{ width: 40 }}><Label text="PROTO" color={DIM} /></Box>
        <Box style={{ width: 50 }}><Label text="PID" color={DIM} /></Box>
        <Box style={{ width: 100 }}><Label text="PROCESS" color={DIM} /></Box>
        <Box style={{ width: 40 }}><Label text="" color={DIM} /></Box>
      </Box>
      {ports.map((p, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 0, alignItems: 'center' }}>
          <Box style={{ width: 50 }}><Val text={`${p.port}`} color={CYAN} /></Box>
          <Box style={{ width: 40 }}><Val text={p.protocol} color={MID} /></Box>
          <Box style={{ width: 50 }}><Val text={`${p.pid || '-'}`} color={MID} /></Box>
          <Box style={{ width: 100 }}><Val text={p.process || '-'} color={MID} /></Box>
          {p.pid > 0 && (
            <Box style={{ width: 40 }}>
              <Pressable onPress={() => onKill(p.pid)}>
                <Box style={{ backgroundColor: '#3a1525', borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
                  <Text style={{ fontSize: 8, color: ACCENT }}>KILL</Text>
                </Box>
              </Pressable>
            </Box>
          )}
        </Box>
      ))}
    </Section>
  );
}

/* ── Task summary ────────────────────────────────────────────── */

function TaskSummary({ tasks }: { tasks: { total: number; running: number; sleeping: number; stopped: number; zombie: number } }) {
  return (
    <Box style={{ flexDirection: 'row', gap: 10 }}>
      <Label text={`${tasks.total} tasks`} color={BRIGHT} />
      <Label text={`${tasks.running} run`} color={GREEN} />
      <Label text={`${tasks.sleeping} slp`} color={MID} />
      {tasks.stopped > 0 && <Label text={`${tasks.stopped} stp`} color={YELLOW} />}
      {tasks.zombie > 0 && <Label text={`${tasks.zombie} zmb`} color={ACCENT} />}
    </Box>
  );
}

/* ── Main ────────────────────────────────────────────────────── */

export function NeofetchDemoStory() {
  const { width: vpW, height: vpH } = useWindowDimensions();
  const info = useSystemInfo(5000);
  const sys = useSystemMonitor(1000);
  const ports = usePorts(3000);
  const [tab, setTab] = useState<'overview' | 'processes' | 'ports'>('overview');

  const title = info.loading ? '...' : `${info.user}@${info.hostname}`;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 12, gap: 10 }}>
      {/* Header row: heart + identity + tabs */}
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        {/* Mini heart */}
        <Box style={{ width: HEART_COLS * HEART_PX, height: HEART_ROWS * HEART_PX }}>
          {HEART_GRID.map((row, r) => (
            <Box key={r} style={{ flexDirection: 'row' }}>
              {row.map((filled, c) => (
                <Box key={c} style={{ width: HEART_PX, height: HEART_PX, backgroundColor: filled ? HEART_COLORS[r] : 'transparent' }} />
              ))}
            </Box>
          ))}
        </Box>

        {/* Identity + system summary */}
        <Box style={{ gap: 3 }}>
          <Text style={{ color: ACCENT, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text={info.os || '...'} color={BRIGHT} />
            <Label text={info.kernel || ''} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text={info.cpu || '...'} color={MID} />
            <Label text={info.arch || ''} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Label text={info.loading ? '...' : formatUptime(info.uptime)} color={GREEN} />
            <Label text={info.shell || ''} />
            <Label text={info.loading ? '' : formatMemory(info.memory)} />
          </Box>
        </Box>
      </Box>

      <Divider color={BORDER} />

      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', gap: 2, width: '100%' }}>
        {(['overview', 'processes', 'ports'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)}>
            <Box style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              backgroundColor: tab === t ? '#1e1e30' : 'transparent',
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, color: tab === t ? ACCENT : MID, fontWeight: tab === t ? '700' : '400' }}>
                {t.toUpperCase()}
              </Text>
            </Box>
          </Pressable>
        ))}
        {/* Palette */}
        <Spacer size={8} />
        <Box style={{ flexDirection: 'row', gap: 1 }}>
          {PALETTE.map((color, i) => (
            <Box key={i} style={{ width: 14, height: 10, backgroundColor: color, borderRadius: 1 }} />
          ))}
        </Box>
      </Box>

      {/* Tab content */}
      <ScrollView style={{ width: '100%', height: Math.max(0, vpH - 180) }}>
        {tab === 'overview' && (
          <Box style={{ gap: 14, width: '100%' }}>
            {!sys.loading && <TaskSummary tasks={sys.tasks} />}

            {/* Single row: CPU | GPU+Memory | Network+Disk */}
            <Box style={{ flexDirection: 'row', gap: 16, width: '100%', justifyContent: 'space-around', alignItems: 'flex-start' }}>
              {/* CPU with wrapping cores */}
              <Box style={{
                width: 280,
                backgroundColor: CARD_BG, borderRadius: 8, padding: 10,
                borderWidth: 1, borderColor: BORDER,
              }}>
                {!sys.loading && <CpuPanel cores={sys.cpu.cores} total={sys.cpu.total} loadAvg={sys.cpu.loadAvg as [number, number, number]} />}
              </Box>

              {/* GPU + Memory stacked */}
              <Box style={{
                flex: 1,
                minWidth: 240,
                backgroundColor: CARD_BG, borderRadius: 8, padding: 10,
                borderWidth: 1, borderColor: BORDER,
                gap: 12,
              }}>
                {sys.gpu && <GpuPanel gpus={sys.gpu} />}
                {!sys.loading && <MemoryPanel mem={sys.memory} />}
              </Box>

              {/* Network + Disk stacked */}
              <Box style={{
                flex: 1,
                minWidth: 200,
                backgroundColor: CARD_BG, borderRadius: 8, padding: 10,
                borderWidth: 1, borderColor: BORDER,
                gap: 12,
              }}>
                {!sys.loading && <NetworkPanel interfaces={sys.network} />}
                {!sys.loading && <DiskPanel devices={sys.disk} />}
              </Box>
            </Box>
          </Box>
        )}

        {tab === 'processes' && (
          <Box style={{
            backgroundColor: CARD_BG, borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: BORDER, width: '100%',
          }}>
            {!sys.loading && <TaskSummary tasks={sys.tasks} />}
            <Spacer size={6} />
            {!sys.loading && <ProcessTable procs={sys.processes} />}
          </Box>
        )}

        {tab === 'ports' && (
          <Box style={{
            backgroundColor: CARD_BG, borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: BORDER, width: '100%',
          }}>
            {!ports.loading && <PortsPanel ports={ports.list} onKill={(pid) => ports.kill(pid)} />}
            {ports.loading && <Label text="Scanning ports..." color={MID} />}
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
