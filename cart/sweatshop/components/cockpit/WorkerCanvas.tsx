const React: any = require('react');
const { useState, useMemo, useCallback, useEffect } = React;
import { Box, Col, Row, Text, Pressable, Canvas } from '../../../../runtime/primitives';
import { WorkerTile, type Worker, type WorkerStatus } from './WorkerTile';
import { WorkerStrip } from './WorkerStrip';
import { WorkerCharts } from './WorkerCharts';
import { HoverPressable } from '../shared';

const ACCENTS = ['#2d62ff', '#ff7b72', '#7ee787', '#d2a8ff', '#ffb86b', '#79c0ff', '#ff6bcb', '#f2e05a'];
const STATUSES: WorkerStatus[] = ['thinking', 'tool', 'idle', 'stuck', 'rationalizing', 'thinking', 'tool', 'done'];
const TASKS = [
  'worker-cockpit', 'worker-gitpanel-refactor', 'worker-settings-polish', 'worker-chat-export',
  'worker-apikey-rewire', 'worker-terminal-playback', 'worker-diff-viewer', 'worker-indexer-tune',
];
const TOOLS = [
  'Read(cart/cursor-ide/index.tsx)',
  'Edit(components/gitpanel.tsx) — +142 −38',
  'Bash(./scripts/ship cursor-ide)',
  'Grep("activeView") → 14 matches',
  'Write(components/cockpit/WorkerTile.tsx)',
  'Read(FEATURES.md, offset=200)',
  'Bash(git add . && git commit)',
  'Edit(theme.ts) — tweak accent palette',
];
const MODELS = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'kimi-k2', 'gpt-5'];

export function seedFakeWorkers(n: number = 8): Worker[] {
  const out: Worker[] = [];
  const cols = 3;
  const pad = 32;
  const w = 260 + pad;
  const h = 168 + pad;
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.push({
      id: String(i + 1).padStart(2, '0'),
      name: 'worker-' + String(i + 1).padStart(2, '0'),
      model: MODELS[i % MODELS.length],
      status: STATUSES[i % STATUSES.length],
      accent: ACCENTS[i % ACCENTS.length],
      latestTool: TOOLS[i % TOOLS.length],
      taskSlug: TASKS[i % TASKS.length],
      heartbeat: 3 + ((i * 3) % 6),
      x: 40 + col * w,
      y: 40 + row * h,
      blockedOn: i === 3 ? '01' : i === 6 ? '02' : null,
      assignedTask: null,
    });
  }
  return out;
}

export const TILE_W = 260;
export const TILE_H = 168;

export interface WorkerCanvasProps {
  widthBand?: string;
  windowHeight?: number;
}

export type CockpitMode = 'brainstorm' | 'enforce';

export function WorkerCanvas(_props: WorkerCanvasProps) {
  const initial = useMemo(() => seedFakeWorkers(8), []);
  const [workers, setWorkers] = useState<Worker[]>(initial);

  // Live fake-data tick: rotate tool calls, cycle status, pulse heartbeat.
  // Replaced with real pty/tool-feed wire-up later.
  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t++;
      setWorkers((prev: Worker[]) => prev.map((w, i) => {
        const pulse = (i + t) % 7;
        const nextStatus: WorkerStatus = (i + t) % 11 === 0 ? 'rationalizing'
          : (i + t) % 5 === 0 ? 'stuck'
          : (i + t) % 3 === 0 ? 'tool'
          : (i + t) % 3 === 1 ? 'thinking'
          : w.status;
        return {
          ...w,
          status: nextStatus,
          latestTool: TOOLS[(i + t) % TOOLS.length],
          heartbeat: 2 + (pulse % 6),
        };
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);
  const [focusedId, setFocusedId] = useState<string | null>(initial[0]?.id || null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<CockpitMode>('enforce');
  const [showCharts, setShowCharts] = useState(true);

  const pan = useCallback((dx: number, dy: number) => {
    setOffsetX((v: number) => v + dx);
    setOffsetY((v: number) => v + dy);
  }, []);

  const focusWorker = useCallback((id: string) => {
    setFocusedId(id);
    const w = initial.find((x) => x.id === id);
    if (w) { setOffsetX(-w.x + 240); setOffsetY(-w.y + 180); }
  }, [initial]);

  // Keyboard shortcuts: 1-9 jump to worker N, B/E toggle mode
  useEffect(() => {
    const handler = (e: any) => {
      const k = e && (e.key || '');
      if (k >= '1' && k <= '9') {
        const idx = parseInt(k, 10) - 1;
        if (idx < initial.length) focusWorker(initial[idx].id);
      } else if (k === 'b' || k === 'B') {
        setMode('brainstorm');
      } else if (k === 'e' || k === 'E') {
        setMode('enforce');
      }
    };
    try {
      const g: any = globalThis as any;
      const target = (typeof g.window !== 'undefined' ? g.window : g.document) || null;
      if (target && target.addEventListener) {
        target.addEventListener('keydown', handler);
        return () => { try { target.removeEventListener('keydown', handler); } catch (_) {} };
      }
    } catch (_) {}
    return undefined;
  }, [initial, focusWorker]);

  const reset = useCallback(() => { setOffsetX(0); setOffsetY(0); setZoom(1); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    workers.forEach((w) => { c[w.status] = (c[w.status] || 0) + 1; });
    return c;
  }, [workers]);

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, backgroundColor: '#02050a', minHeight: 0 }}>
      {/* Cockpit header strip — game HUD */}
      <Row style={{
        height: 48, paddingHorizontal: 14, alignItems: 'center', gap: 12,
        backgroundColor: '#05090f', borderBottomWidth: 1, borderColor: '#1a222c',
      }}>
        <Text style={{ color: '#2d62ff', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>◆ COCKPIT</Text>
        <Text style={{ color: '#5c6a78', fontSize: 11 }}>worker supervisor · {workers.length} tiles</Text>
        <ModeToggle mode={mode} onChange={setMode} />
        <Box style={{ flexGrow: 1 }} />
        <HudCount label="THINK"   n={counts.thinking      || 0} color="#79c0ff" />
        <HudCount label="TOOL"    n={counts.tool          || 0} color="#7ee787" />
        <HudCount label="STUCK"   n={counts.stuck         || 0} color="#ffb86b" />
        <HudCount label="FLAGGED" n={counts.rationalizing || 0} color="#ff6b6b" />
        <HudCount label="IDLE"    n={counts.idle          || 0} color="#5c6a78" />
        <Box style={{ width: 1, height: 22, backgroundColor: '#1a222c', marginHorizontal: 6 }} />
        <PanBtn label="◀" onPress={() => pan(120, 0)} />
        <PanBtn label="▲" onPress={() => pan(0, 120)} />
        <PanBtn label="▼" onPress={() => pan(0, -120)} />
        <PanBtn label="▶" onPress={() => pan(-120, 0)} />
        <PanBtn label="−" onPress={() => setZoom((z: number) => Math.max(0.5, z - 0.1))} />
        <PanBtn label="+" onPress={() => setZoom((z: number) => Math.min(1.6, z + 0.1))} />
        <PanBtn label="⟳" onPress={reset} />
        <Box style={{ width: 1, height: 22, backgroundColor: '#1a222c', marginHorizontal: 6 }} />
        <Pressable onPress={() => setShowCharts((v: boolean) => !v)} style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
          backgroundColor: showCharts ? '#79c0ff' : '#0b1018',
          borderWidth: 1, borderColor: showCharts ? '#79c0ff' : '#1f2630',
        }}>
          <Text style={{ color: showCharts ? '#05090f' : '#79c0ff', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>HUD +</Text>
        </Pressable>
      </Row>

      {/* Pannable canvas surface + optional right-side HUD charts dock */}
      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
      <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* grid backdrop */}
        <Box style={{
          position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
          backgroundColor: '#02050a',
        }} />
        <GridBackdrop offsetX={offsetX} offsetY={offsetY} />
        {mode === 'enforce' ? (
          <Canvas style={{ flexGrow: 1, flexBasis: 0 }} viewX={offsetX} viewY={offsetY} viewZoom={zoom}>
            {/* World-space connection lines: anchored at origin, spans tile grid */}
            <Canvas.Node gx={0} gy={0} gw={2400} gh={1600}>
              <ConnectionLines workers={workers} />
            </Canvas.Node>
            {workers.map((w) => {
              const gw = w.id === focusedId ? 420 : 260;
              const gh = w.id === focusedId ? 280 : 168;
              return (
                <Canvas.Node
                  key={w.id}
                  gx={w.x}
                  gy={w.y}
                  gw={gw}
                  gh={gh}
                  onMove={(e: any) => setWorkers((prev: Worker[]) => prev.map((pw) => pw.id === w.id ? { ...pw, x: e.gx, y: e.gy } : pw))}
                >
                  <WorkerTile worker={w} focused={w.id === focusedId} onFocus={focusWorker} inCanvas />
                </Canvas.Node>
              );
            })}
            {/* Clamp-overlay mini-legend lives above canvas, stays fixed across pan/zoom */}
            <Canvas.Clamp>
              <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Box style={{
                  position: 'absolute', right: 14, bottom: 14,
                  backgroundColor: '#0b1018', borderWidth: 1, borderColor: '#1f2630', borderRadius: 8,
                  padding: 10, gap: 4,
                }}>
                  <Text style={{ color: '#5c6a78', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>CANVAS</Text>
                  <Text style={{ color: '#e6edf3', fontSize: 11 }}>pan {Math.round(offsetX)},{Math.round(offsetY)}</Text>
                  <Text style={{ color: '#e6edf3', fontSize: 11 }}>zoom {zoom.toFixed(2)}x</Text>
                  <Text style={{ color: '#5c6a78', fontSize: 9 }}>drag tile · scroll zoom</Text>
                </Box>
              </Box>
            </Canvas.Clamp>
          </Canvas>
        ) : (
          <BrainstormPanel workers={workers} />
        )}
      </Box>
      {showCharts ? <WorkerCharts workers={workers} /> : null}
      </Row>

      {/* persistent bottom strip */}
      <WorkerStrip workers={workers} focusedId={focusedId} onFocus={focusWorker} />
    </Col>
  );
}

function HudCount({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: '#8b98a6', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 12, fontWeight: 700 }}>{n}</Text>
    </Row>
  );
}

function PanBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <HoverPressable onPress={onPress} style={{
      width: 26, height: 26, borderRadius: 6,
      backgroundColor: '#0b1018', borderWidth: 1, borderColor: '#1f2630',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#8b98a6', fontSize: 12, fontWeight: 700 }}>{label}</Text>
    </HoverPressable>
  );
}

function ModeToggle({ mode, onChange }: { mode: CockpitMode; onChange: (m: CockpitMode) => void }) {
  const btn = (m: CockpitMode, label: string, color: string) => {
    const active = mode === m;
    return (
      <Pressable onPress={() => onChange(m)} style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
        backgroundColor: active ? color : '#0b1018',
        borderWidth: 1, borderColor: active ? color : '#1f2630',
      }}>
        <Text style={{ color: active ? '#05090f' : color, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <Row style={{ gap: 4, marginLeft: 8 }}>
      {btn('brainstorm', 'BRAINSTORM', '#d2a8ff')}
      {btn('enforce', 'ENFORCE', '#7ee787')}
    </Row>
  );
}

function BrainstormPanel({ workers }: { workers: Worker[] }) {
  return (
    <Row style={{
      position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
      alignItems: 'stretch',
    }}>
      <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Box style={{
        width: 520, maxWidth: '90%',
        backgroundColor: '#0b1018',
        borderWidth: 1, borderColor: '#2a1840',
        borderRadius: 12, padding: 20, gap: 12,
      }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#d2a8ff' }} />
          <Text style={{ color: '#d2a8ff', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>BRAINSTORM MODE</Text>
        </Row>
        <Text style={{ color: '#e6edf3', fontSize: 16, fontWeight: 700 }}>What are we exploring?</Text>
        <Text style={{ color: '#8b98a6', fontSize: 12 }}>Worker tiles hidden. Talk through the feature with the supervisor. Past bundles touching the same area will auto-surface as chips. When ready, crystallize → switch to ENFORCE to spawn workers against the spec.</Text>
        <Box style={{
          backgroundColor: '#05090f', borderRadius: 8, borderWidth: 1, borderColor: '#1f2630',
          padding: 12, minHeight: 120,
        }}>
          <Text style={{ color: '#5c6a78', fontSize: 11 }}>[ conversation surface placeholder ]</Text>
        </Box>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Chip label="prior: cursor-ide plan surface" />
          <Chip label="prior: worker lifecycle policy" />
          <Chip label="prior: fake-green pathology" />
        </Row>
      </Box>
      </Box>
      <TaskBoard workers={workers} />
    </Row>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <Box style={{
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
      backgroundColor: '#173048', borderWidth: 1, borderColor: '#2a4d6e',
    }}>
      <Text style={{ color: '#79c0ff', fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

function ConnectionLines({ workers }: { workers: Worker[] }) {
  const byId: Record<string, Worker> = {};
  workers.forEach((w) => { byId[w.id] = w; });
  const edges: { from: Worker; to: Worker }[] = [];
  workers.forEach((w) => {
    if (w.blockedOn && byId[w.blockedOn]) edges.push({ from: w, to: byId[w.blockedOn] });
  });
  const out: any[] = [];
  edges.forEach((e, idx) => {
    const cx1 = e.from.x + TILE_W / 2;
    const cy1 = e.from.y + TILE_H / 2;
    const cx2 = e.to.x + TILE_W / 2;
    const cy2 = e.to.y + TILE_H / 2;
    // L-shape: horizontal from (cx1,cy1) to (cx2,cy1), then vertical to (cx2,cy2)
    const hLeft = Math.min(cx1, cx2);
    const hWidth = Math.abs(cx2 - cx1);
    const vTop = Math.min(cy1, cy2);
    const vHeight = Math.abs(cy2 - cy1);
    out.push(<Box key={'h' + idx} style={{
      position: 'absolute', left: hLeft, top: cy1 - 1, width: hWidth, height: 2,
      backgroundColor: '#ff6b6b', opacity: 0.55, borderRadius: 1,
    }} />);
    out.push(<Box key={'v' + idx} style={{
      position: 'absolute', left: cx2 - 1, top: vTop, width: 2, height: vHeight,
      backgroundColor: '#ff6b6b', opacity: 0.55, borderRadius: 1,
    }} />);
    // Arrowhead dot at the blocker end
    out.push(<Box key={'d' + idx} style={{
      position: 'absolute', left: cx2 - 5, top: cy2 - 5, width: 10, height: 10,
      borderRadius: 5, backgroundColor: '#ff6b6b', opacity: 0.85,
    }} />);
  });
  return <Box style={{ position: 'absolute', left: 0, top: 0, width: 2400, height: 1600 }}>{out}</Box>;
}

interface TaskItem { id: string; title: string; priority: 'hi' | 'md' | 'lo'; assignee: string | null; }

function TaskBoard({ workers }: { workers: Worker[] }) {
  const [tasks, setTasks] = useState<TaskItem[]>([
    { id: 't1', title: 'Wire cockpit → pty feed',     priority: 'hi', assignee: '01' },
    { id: 't2', title: 'Rationalization classifier',  priority: 'hi', assignee: null },
    { id: 't3', title: 'Bundle store retrieval',      priority: 'md', assignee: '04' },
    { id: 't4', title: 'Restore-point timeline tile', priority: 'md', assignee: null },
    { id: 't5', title: 'Autotest grid inspector',     priority: 'lo', assignee: null },
    { id: 't6', title: 'L2 affect heatmap overlay',   priority: 'lo', assignee: null },
  ]);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const cycleAssign = (taskId: string) => {
    setTasks((prev: TaskItem[]) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const ids = workers.map((w) => w.id);
      const cur = t.assignee;
      const idx = cur == null ? -1 : ids.indexOf(cur);
      const nextIdx = idx + 1;
      const next = nextIdx >= ids.length ? null : ids[nextIdx];
      return { ...t, assignee: next };
    }));
  };

  const assignTo = (taskId: string, workerId: string) => {
    setTasks((prev: TaskItem[]) => prev.map((t) => t.id === taskId ? { ...t, assignee: workerId } : t));
    setDragTaskId(null);
  };

  const PRI_TONE: Record<string, string> = { hi: '#ff6b6b', md: '#ffb86b', lo: '#79c0ff' };

  return (
    <Col style={{
      width: 320, backgroundColor: '#0b1018',
      borderLeftWidth: 1, borderColor: '#1f2630',
      padding: 14, gap: 10, minHeight: 0,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#7ee787' }} />
        <Text style={{ color: '#7ee787', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>TASK BOARD</Text>
      </Row>
      <Text style={{ color: '#5c6a78', fontSize: 10 }}>Click a task to pick it up, then click a worker pill to drop.</Text>
      <Col style={{ gap: 6 }}>
        {tasks.map((t) => {
          const dragging = dragTaskId === t.id;
          return (
            <Pressable key={t.id} onPress={() => setDragTaskId(dragging ? null : t.id)}
              style={{
                padding: 10, borderRadius: 8,
                backgroundColor: dragging ? '#173048' : '#05090f',
                borderWidth: 1, borderColor: dragging ? '#2d62ff' : '#1f2630',
                gap: 4,
              }}>
              <Row style={{ alignItems: 'center', gap: 6 }}>
                <Box style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: PRI_TONE[t.priority] }} />
                <Text style={{ color: '#e6edf3', fontSize: 12, fontWeight: 700, flexGrow: 1 }}>{t.title}</Text>
                <Text style={{ color: PRI_TONE[t.priority], fontSize: 9, fontWeight: 700 }}>{t.priority.toUpperCase()}</Text>
              </Row>
              <Row style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#5c6a78', fontSize: 10 }}>assign:</Text>
                <Pressable onPress={() => cycleAssign(t.id)} style={{
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                  backgroundColor: t.assignee ? '#143322' : '#1a222c',
                  borderWidth: 1, borderColor: t.assignee ? '#7ee787' : '#1f2630',
                }}>
                  <Text style={{ color: t.assignee ? '#7ee787' : '#8b98a6', fontSize: 10, fontWeight: 700 }}>
                    {t.assignee ? 'worker-' + t.assignee : 'unassigned'}
                  </Text>
                </Pressable>
                {dragging ? <Text style={{ color: '#2d62ff', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>↓ DROP</Text> : null}
              </Row>
            </Pressable>
          );
        })}
      </Col>
      <Box style={{ height: 1, backgroundColor: '#1f2630', marginVertical: 4 }} />
      <Text style={{ color: '#5c6a78', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>DROP TARGETS</Text>
      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {workers.map((w) => (
          <Pressable key={w.id} onPress={() => dragTaskId && assignTo(dragTaskId, w.id)}
            style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
              backgroundColor: dragTaskId ? w.accent : '#05090f',
              borderWidth: 1, borderColor: dragTaskId ? w.accent : '#1f2630',
              opacity: dragTaskId ? 1 : 0.7,
            }}>
            <Text style={{ color: dragTaskId ? '#05090f' : '#8b98a6', fontSize: 10, fontWeight: 700 }}>
              {w.name}
            </Text>
          </Pressable>
        ))}
      </Row>
    </Col>
  );
}

function GridBackdrop({ offsetX, offsetY }: { offsetX: number; offsetY: number }) {
  const lines = [];
  const step = 80;
  const modX = ((offsetX % step) + step) % step;
  const modY = ((offsetY % step) + step) % step;
  for (let i = 0; i < 40; i++) {
    lines.push(<Box key={'v' + i} style={{
      position: 'absolute', left: modX + i * step, top: 0, bottom: 0, width: 1,
      backgroundColor: i % 4 === 0 ? '#0f1620' : '#080c12',
    }} />);
  }
  for (let i = 0; i < 24; i++) {
    lines.push(<Box key={'h' + i} style={{
      position: 'absolute', top: modY + i * step, left: 0, right: 0, height: 1,
      backgroundColor: i % 4 === 0 ? '#0f1620' : '#080c12',
    }} />);
  }
  return <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>{lines}</Box>;
}
