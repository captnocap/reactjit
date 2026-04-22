const React: any = require('react');
const { useState, useEffect, useMemo, useRef } = React;
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import type { Worker } from './WorkerTile';

// Activity weight per status — drives heatmap brightness and tool-rate lines.
const WEIGHT: Record<string, number> = {
  idle: 0, thinking: 2, tool: 4, stuck: 1, rationalizing: 3, done: 1,
};

interface HistoryFrame {
  t: number;
  perWorker: Record<string, number>;
  remainingTasks: Record<string, number>;
}

export interface WorkerChartsProps {
  workers: Worker[];
  initialRemaining?: Record<string, number>;
}

export function WorkerCharts({ workers, initialRemaining }: WorkerChartsProps) {
  const [history, setHistory] = useState<HistoryFrame[]>([]);
  const [level, setLevel] = useState(3);
  const [xp, setXp] = useState(420);
  const [pulse, setPulse] = useState(0);
  const [flash, setFlash] = useState(0);
  const prevLevelRef = useRef(3);

  // Build initial burn-down remaining counts per worker. Fake but consistent.
  const baseRemaining = useMemo(() => {
    if (initialRemaining) return initialRemaining;
    const r: Record<string, number> = {};
    workers.forEach((w, i) => { r[w.id] = 8 - (i % 5); });
    return r;
  }, [workers, initialRemaining]);

  // Push a history frame whenever workers change. Cap at 24 frames.
  useEffect(() => {
    setHistory((prev: HistoryFrame[]) => {
      const perWorker: Record<string, number> = {};
      workers.forEach((w) => { perWorker[w.id] = WEIGHT[w.status] ?? 0; });
      const lastRemaining = prev.length > 0 ? prev[prev.length - 1].remainingTasks : baseRemaining;
      const remainingTasks: Record<string, number> = {};
      workers.forEach((w) => {
        const last = lastRemaining[w.id] ?? baseRemaining[w.id] ?? 0;
        const burn = perWorker[w.id] >= 3 && Math.random() < 0.35 ? 1 : 0;
        remainingTasks[w.id] = Math.max(0, last - burn);
      });
      const next = [...prev, { t: (prev.length > 0 ? prev[prev.length - 1].t : 0) + 1, perWorker, remainingTasks }];
      if (next.length > 24) next.shift();
      return next;
    });
  }, [workers, baseRemaining]);

  // XP grind — creeps up with aggregate activity; level up at each 1000 XP.
  useEffect(() => {
    const totalActivity = workers.reduce((s, w) => s + (WEIGHT[w.status] ?? 0), 0);
    if (totalActivity === 0) return;
    const id = setTimeout(() => {
      setXp((v: number) => {
        const next = v + totalActivity * 3;
        const nextLevel = Math.floor(next / 1000) + 1;
        if (nextLevel > prevLevelRef.current) {
          prevLevelRef.current = nextLevel;
          setLevel(nextLevel);
          setFlash(1);
          setTimeout(() => setFlash(0), 1600);
        }
        return next;
      });
    }, 400);
    return () => clearTimeout(id);
  }, [workers]);

  // Pulsing glow tick for XP tile and level-up flash.
  useEffect(() => {
    const id = setInterval(() => setPulse((p: number) => (p + 1) % 60), 80);
    return () => clearInterval(id);
  }, []);

  const commits = 12 + Math.floor(xp / 180);
  const testsPassed = 28 + Math.floor(xp / 90);
  const microTasks = 6 + Math.floor(xp / 260);
  const xpWithinLevel = xp % 1000;

  return (
    <Col style={{
      width: 340,
      backgroundColor: '#05090f',
      borderLeftWidth: 1,
      borderColor: '#1a222c',
      gap: 10,
      padding: 12,
      minHeight: 0,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#79c0ff' }} />
        <Text style={{ color: '#79c0ff', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>HUD +</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: '#5c6a78', fontSize: 10 }}>{history.length}/24 frames</Text>
      </Row>

      <XpTile level={level} xpWithinLevel={xpWithinLevel} commits={commits} testsPassed={testsPassed} microTasks={microTasks} pulse={pulse} flash={flash} />
      <HeatmapTile workers={workers} history={history} />
      <ToolRateStack workers={workers} history={history} />
      <BurnDownTile workers={workers} history={history} baseRemaining={baseRemaining} />
    </Col>
  );
}

function HeatmapTile({ workers, history }: { workers: Worker[]; history: HistoryFrame[] }) {
  // Pad history to 24 columns so the grid is stable.
  const cols = 24;
  const filled: HistoryFrame[] = [];
  for (let i = 0; i < cols - history.length; i++) {
    filled.push({ t: -1, perWorker: {}, remainingTasks: {} });
  }
  history.forEach((h) => filled.push(h));

  const cell = (v: number) => {
    if (v <= 0) return '#080c12';
    if (v === 1) return '#143322';
    if (v === 2) return '#1f5a3a';
    if (v === 3) return '#2c8a56';
    return '#7ee787';
  };

  return (
    <Col style={tileStyle('#2d62ff')}>
      <TileHeader label="ACTIVITY HEATMAP" sub="hour × worker · last 24" tone="#79c0ff" />
      <Col style={{ gap: 2 }}>
        {workers.map((w) => (
          <Row key={w.id} style={{ gap: 2, alignItems: 'center' }}>
            <Text style={{ color: '#5c6a78', fontSize: 9, width: 24 }}>{w.id}</Text>
            {filled.map((f, i) => {
              const v = f.perWorker[w.id] ?? 0;
              return <Box key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: cell(v) }} />;
            })}
          </Row>
        ))}
      </Col>
      <Row style={{ gap: 4, alignItems: 'center', marginTop: 4 }}>
        <Text style={{ color: '#5c6a78', fontSize: 9 }}>cold</Text>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} style={{ width: 10, height: 6, backgroundColor: cell(i), borderRadius: 1 }} />
        ))}
        <Text style={{ color: '#5c6a78', fontSize: 9 }}>hot</Text>
      </Row>
    </Col>
  );
}

function ToolRateStack({ workers, history }: { workers: Worker[]; history: HistoryFrame[] }) {
  const cols = 24;
  const maxStack = useMemo(() => {
    let m = 1;
    history.forEach((h) => {
      let sum = 0;
      workers.forEach((w) => { sum += h.perWorker[w.id] ?? 0; });
      if (sum > m) m = sum;
    });
    return m;
  }, [history, workers]);

  const padded: HistoryFrame[] = [];
  for (let i = 0; i < cols - history.length; i++) {
    padded.push({ t: -1, perWorker: {}, remainingTasks: {} });
  }
  history.forEach((h) => padded.push(h));

  return (
    <Col style={tileStyle('#7ee787')}>
      <TileHeader label="TOOL-CALL RATE" sub={'stacked · peak ' + String(maxStack)} tone="#7ee787" />
      <Row style={{ height: 64, alignItems: 'flex-end', gap: 2 }}>
        {padded.map((f, i) => (
          <Col key={i} style={{ width: 10, height: 64, justifyContent: 'flex-end' }}>
            {workers.map((w) => {
              const v = f.perWorker[w.id] ?? 0;
              const h = Math.round((v / maxStack) * 60);
              if (h <= 0) return null;
              return <Box key={w.id} style={{ height: h, backgroundColor: w.accent, opacity: 0.85 }} />;
            })}
          </Col>
        ))}
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {workers.slice(0, 6).map((w) => (
          <Row key={w.id} style={{ alignItems: 'center', gap: 3 }}>
            <Box style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: w.accent }} />
            <Text style={{ color: '#8b98a6', fontSize: 9 }}>{w.id}</Text>
          </Row>
        ))}
      </Row>
    </Col>
  );
}

function BurnDownTile({ workers, history, baseRemaining }: { workers: Worker[]; history: HistoryFrame[]; baseRemaining: Record<string, number> }) {
  const cols = 24;
  const initialTotal = useMemo(() => {
    return workers.reduce((s, w) => s + (baseRemaining[w.id] ?? 0), 0) || 1;
  }, [workers, baseRemaining]);

  const padded: HistoryFrame[] = [];
  for (let i = 0; i < cols - history.length; i++) {
    padded.push({ t: -1, perWorker: {}, remainingTasks: baseRemaining });
  }
  history.forEach((h) => padded.push(h));

  const latestTotal = padded[padded.length - 1]
    ? workers.reduce((s, w) => s + (padded[padded.length - 1].remainingTasks[w.id] ?? 0), 0)
    : initialTotal;
  const burned = Math.max(0, initialTotal - latestTotal);

  return (
    <Col style={tileStyle('#ffb86b')}>
      <TileHeader label="BURN-DOWN" sub={burned + '/' + initialTotal + ' tasks burned'} tone="#ffb86b" />
      <Row style={{ height: 56, alignItems: 'flex-end', gap: 2 }}>
        {padded.map((f, i) => (
          <Col key={i} style={{ width: 10, height: 56, justifyContent: 'flex-end' }}>
            {workers.map((w) => {
              const v = f.remainingTasks[w.id] ?? baseRemaining[w.id] ?? 0;
              const h = Math.round((v / initialTotal) * 52);
              if (h <= 0) return null;
              return <Box key={w.id} style={{ height: h, backgroundColor: w.accent, opacity: 0.7 }} />;
            })}
          </Col>
        ))}
      </Row>
      <Row style={{ alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Box style={{ flexGrow: 1, height: 4, backgroundColor: '#1a222c', borderRadius: 2 }}>
          <Box style={{ width: String(Math.round((burned / initialTotal) * 100)) + '%', height: 4, backgroundColor: '#ffb86b', borderRadius: 2 }} />
        </Box>
        <Text style={{ color: '#ffb86b', fontSize: 10, fontWeight: 700 }}>{Math.round((burned / initialTotal) * 100)}%</Text>
      </Row>
    </Col>
  );
}

function XpTile({ level, xpWithinLevel, commits, testsPassed, microTasks, pulse, flash }: {
  level: number; xpWithinLevel: number; commits: number; testsPassed: number; microTasks: number; pulse: number; flash: number;
}) {
  const glowAlpha = flash ? 1 : 0.3 + 0.25 * Math.sin(pulse / 4);
  const borderColor = flash ? '#f2e05a' : '#2a1840';
  const ringShadow = flash ? '#f2e05a' : '#d2a8ff';
  const pct = Math.min(100, Math.round((xpWithinLevel / 1000) * 100));
  return (
    <Col style={{
      backgroundColor: '#0b1018',
      borderRadius: 10,
      borderWidth: 2,
      borderColor,
      padding: 12,
      gap: 8,
      position: 'relative',
    }}>
      {/* pulsing ring overlay */}
      <Box style={{
        position: 'absolute', left: -2, top: -2, right: -2, bottom: -2, borderRadius: 12,
        borderWidth: 2, borderColor: ringShadow, opacity: glowAlpha,
      }} />
      <Row style={{ alignItems: 'center', gap: 10 }}>
        <Box style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: flash ? '#f2e05a' : '#2a1840',
          borderWidth: 2, borderColor: flash ? '#fff7b3' : '#d2a8ff',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: flash ? '#05090f' : '#d2a8ff', fontSize: 18, fontWeight: 700 }}>{level}</Text>
        </Box>
        <Col style={{ flexGrow: 1, gap: 2 }}>
          <Text style={{ color: '#e6edf3', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            {flash ? 'LEVEL UP!' : 'SUPERVISOR LVL ' + level}
          </Text>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Box style={{ flexGrow: 1, height: 6, backgroundColor: '#1a222c', borderRadius: 3 }}>
              <Box style={{ width: String(pct) + '%', height: 6, backgroundColor: '#d2a8ff', borderRadius: 3 }} />
            </Box>
            <Text style={{ color: '#d2a8ff', fontSize: 10, fontWeight: 700 }}>{xpWithinLevel}/1000</Text>
          </Row>
        </Col>
      </Row>
      <Row style={{ gap: 6 }}>
        <XpStat label="COMMITS"   value={commits}      tone="#7ee787" />
        <XpStat label="TESTS"     value={testsPassed}  tone="#79c0ff" />
        <XpStat label="MICRO"     value={microTasks}   tone="#ffb86b" />
      </Row>
    </Col>
  );
}

function XpStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Col style={{
      flexGrow: 1, flexBasis: 0,
      backgroundColor: '#05090f', borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8,
      borderWidth: 1, borderColor: '#1f2630',
    }}>
      <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: '#e6edf3', fontSize: 18, fontWeight: 700 }}>{value}</Text>
    </Col>
  );
}

function TileHeader({ label, sub, tone }: { label: string; sub: string; tone: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 6 }}>
      <Box style={{ width: 4, height: 12, backgroundColor: tone, borderRadius: 1 }} />
      <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>{label}</Text>
      <Box style={{ flexGrow: 1 }} />
      <Text style={{ color: '#5c6a78', fontSize: 9 }}>{sub}</Text>
    </Row>
  );
}

function tileStyle(_accent: string) {
  return {
    backgroundColor: '#0b1018',
    borderWidth: 1,
    borderColor: '#1f2630',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  } as any;
}
