/**
 * cart/watchdog.tsx — process babysitter as a one-screen IFTTT cart.
 *
 * Spawns a child process and declaratively expresses three failure
 * policies as `useIFTTT` calls. Replaces the legacy
 * framework/watchdog.zig + watchdog.sh shell script with cart-side
 * rules driven by the per-process memory sampler from Phase D.
 *
 *   memory leak   → rss > 80% of system total              → SIGTERM
 *   frozen child  → no cpu/stdout for 30s                  → SIGTERM
 *   engine hang   → system:hang reports >3 stuck frames    → SIGKILL
 *
 * The child command is hardcoded to a chatty bash loop so idle
 * detection can be exercised with the "Freeze child" button (sends
 * SIGSTOP — child stops emitting stdout/cpu, idle:30000 fires).
 */

import { useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '../runtime/primitives';
import { useHost } from '../runtime/hooks/useHost';
import { useIFTTT } from '../runtime/hooks/useIFTTT';
import * as proc from '../runtime/hooks/process';

const PAGE_BG = '#0a0e16';
const PANEL_BG = '#101824';
const ACCENT = '#5db4ff';
const OK = '#7ed957';
const WARN = '#f5a524';
const DANGER = '#ef4444';
const TEXT = '#eef2f8';
const DIM = '#7d8a9a';
const BORDER = '#18202b';

const RAM_THRESHOLD = 0.80;
const IDLE_MS = 30_000;
const KILL_COOLDOWN_MS = 60_000;

function fmtBytes(n: number): string {
  if (!n) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function fmtTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function StatRow({ label, value, color = TEXT }: { label: string; value: string; color?: string }) {
  return (
    <Row style={{ gap: 12, alignItems: 'center' }}>
      <Box style={{ width: 140 }}>
        <Text fontSize={11} color={DIM}>{label}</Text>
      </Box>
      <Text fontSize={12} color={color} style={{ fontWeight: 'bold' }}>{value}</Text>
    </Row>
  );
}

function Btn({ onPress, color, children }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
        borderRadius: 6, backgroundColor: color ?? ACCENT, alignSelf: 'flex-start',
      }}
    >
      <Text fontSize={11} color="#06121f" style={{ fontWeight: 'bold' }}>{children}</Text>
    </Pressable>
  );
}

export default function WatchdogCart() {
  const [, tick] = useState(0);
  const bump = () => tick((n) => (n + 1) & 0xffff);

  const [killCount, setKillCount] = useState(0);
  const [lastKillAt, setLastKillAt] = useState(0);
  const [lastReason, setLastReason] = useState('—');
  const [latestSample, setLatestSample] = useState<any>(null);

  // Chatty child so idle is meaningful — emits a heartbeat each second.
  // SIGSTOP from the "Freeze" button silences it, exercising proc:idle.
  const child = useHost({
    kind: 'process',
    cmd: 'bash',
    args: ['-c', 'while true; do echo heartbeat $(date +%T); sleep 1; done'],
    onStdout: () => bump(), // drives stat-row refresh
    onExit: (r) => {
      setLastReason(`child exited (code ${r.code})`);
      bump();
    },
  });

  const recordKill = (reason: string, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') => {
    setKillCount((n) => n + 1);
    setLastKillAt(Date.now());
    setLastReason(reason);
    if (child.pid > 0) child.kill?.(signal);
  };

  // ── 1. Memory leak guard ───────────────────────────────────────────
  // proc:ram:<pid>:>:0.80 fires whenever a sample lands with rss/total > 80%.
  // The cooldown prevents loop-on-respawn while the OS reaps + we restart.
  useIFTTT(
    {
      trigger: {
        all: [
          `proc:ram:${child.pid}:>:${RAM_THRESHOLD}`,
          () => child.state === 'running' && child.pid > 0,
        ],
      },
      cooldown: KILL_COOLDOWN_MS,
    },
    (payload: any) => {
      setLatestSample(payload);
      recordKill(`ram > ${(RAM_THRESHOLD * 100).toFixed(0)}% (rss=${fmtBytes(payload?.rss ?? 0)})`);
    },
  );

  // ── 2. Frozen child guard ──────────────────────────────────────────
  useIFTTT(
    `proc:idle:${child.pid}:${IDLE_MS}`,
    () => {
      if (child.state !== 'running') return;
      recordKill(`idle > ${IDLE_MS}ms`);
    },
  );

  // ── 3. Engine hang escalation ──────────────────────────────────────
  useIFTTT(
    { on: 'system:hang', when: (e: any) => (e?.count ?? 0) > 3 },
    (e: any) => recordKill(`engine hang (${e?.count ?? '?'} frames)`, 'SIGKILL'),
  );

  // Live RAM sample for display — no threshold filter, just the raw stream.
  useIFTTT(`proc:ram:${child.pid}`, (payload: any) => {
    setLatestSample(payload);
  });

  const stateColor =
    child.state === 'running' ? OK :
    child.state === 'error' ? DANGER :
    child.state === 'stopped' ? WARN : DIM;

  const ramPct = latestSample?.percent ?? 0;
  const ramColor = ramPct > RAM_THRESHOLD ? DANGER : ramPct > RAM_THRESHOLD * 0.75 ? WARN : OK;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: PAGE_BG, padding: 24, gap: 18 }}>
      <Col style={{ gap: 4 }}>
        <Text fontSize={22} color={TEXT} style={{ fontWeight: 'bold' }}>watchdog</Text>
        <Text fontSize={11} color={DIM}>cart-side replacement for framework/watchdog.zig — declarative IFTTT rules over per-pid sampling</Text>
      </Col>

      <Col style={{ gap: 10, padding: 16, backgroundColor: PANEL_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER }}>
        <Text fontSize={13} color={ACCENT} style={{ fontWeight: 'bold' }}>child</Text>
        <StatRow label="pid" value={child.pid > 0 ? String(child.pid) : '(starting)'} />
        <StatRow label="state" value={child.state} color={stateColor} />
        <StatRow label="rss" value={latestSample ? `${fmtBytes(latestSample.rss)} (${(ramPct * 100).toFixed(2)}%)` : '—'} color={ramColor} />
        <StatRow label="vsize" value={latestSample ? fmtBytes(latestSample.vsize) : '—'} />
        <StatRow label="cmd" value="bash -c 'while true; do echo heartbeat …; sleep 1; done'" />
      </Col>

      <Col style={{ gap: 10, padding: 16, backgroundColor: PANEL_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER }}>
        <Text fontSize={13} color={ACCENT} style={{ fontWeight: 'bold' }}>watchdog rules</Text>
        <StatRow label="memory ceiling" value={`rss > ${(RAM_THRESHOLD * 100).toFixed(0)}% → SIGTERM (cooldown ${KILL_COOLDOWN_MS / 1000}s)`} />
        <StatRow label="idle ceiling" value={`no cpu/stdout for ${IDLE_MS / 1000}s → SIGTERM`} />
        <StatRow label="hang escalation" value={`system:hang count > 3 → SIGKILL`} />
      </Col>

      <Col style={{ gap: 10, padding: 16, backgroundColor: PANEL_BG, borderRadius: 8, borderWidth: 1, borderColor: BORDER }}>
        <Text fontSize={13} color={ACCENT} style={{ fontWeight: 'bold' }}>activity</Text>
        <StatRow label="kills" value={String(killCount)} color={killCount > 0 ? WARN : DIM} />
        <StatRow label="last kill" value={fmtTime(lastKillAt)} />
        <StatRow label="last reason" value={lastReason} />
      </Col>

      <Row style={{ gap: 10 }}>
        <Btn color={WARN} onPress={() => { if (child.pid > 0) proc.kill(child.pid, 'SIGSTOP'); }}>
          Freeze child (SIGSTOP)
        </Btn>
        <Btn color={OK} onPress={() => { if (child.pid > 0) proc.kill(child.pid, 'SIGCONT'); }}>
          Resume (SIGCONT)
        </Btn>
        <Btn color={DANGER} onPress={() => recordKill('manual', 'SIGTERM')}>
          Kill manually
        </Btn>
      </Row>

      <Text fontSize={10} color={DIM}>
        Threshold and idle window are constants at the top of cart/watchdog.tsx — edit and the
        dev host hot-reloads.
      </Text>
    </Col>
  );
}
