
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useGamifyEvents } from './useGamifyEvents';
import { XPBar } from './XPBar';
import { AchievementFeed } from './AchievementFeed';
import { HeatmapGrid, type PanelDef } from './HeatmapGrid';
import { WorkerStats, type WorkerStatRow } from './WorkerStats';
import type { GamifyEventType } from './LevelCalc';

export interface GamifyProps {
  panels?: PanelDef[];
  workers?: WorkerStatRow[];
  width?: number;
}

const ACCENT_FALLBACK = ['#2d62ff', '#ff7b72', '#7ee787', '#d2a8ff', '#ffb86b', '#79c0ff', '#ff6bcb', '#f2e05a'];

function demoWorkers(): WorkerStatRow[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: String(i + 1).padStart(2, '0'),
    name: 'worker-' + String(i + 1).padStart(2, '0'),
    accent: ACCENT_FALLBACK[i % ACCENT_FALLBACK.length],
    linesChanged: 40 + i * 37,
    commits: 1 + (i % 4),
    uptimeSec: 320 + i * 97,
    tasksCompleted: i,
    sparkline: Array.from({ length: 14 }, (_, j) => Math.round(2 + Math.abs(Math.sin((i + 1) * (j + 1) * 0.6)) * 8)),
  }));
}

export function Gamify({ panels, workers, width }: GamifyProps) {
  const gamify = useGamifyEvents(true);
  const demo = useMemo(() => (workers && workers.length > 0 ? workers : demoWorkers()), [workers]);

  // Listen for loosely-dispatched events from elsewhere in the cart:
  //   window.dispatchEvent(new CustomEvent('gamify:record', { detail: { type, panelId, workerId } }))
  useEffect(() => {
    const g: any = globalThis as any;
    const target = (typeof g.window !== 'undefined' ? g.window : g.document) || null;
    if (!target || !target.addEventListener) return;
    const handler = (ev: any) => {
      const d = ev && ev.detail;
      if (!d || !d.type) return;
      gamify.record(d.type as GamifyEventType, { panelId: d.panelId, workerId: d.workerId });
    };
    target.addEventListener('gamify:record', handler);
    return () => { try { target.removeEventListener('gamify:record', handler); } catch (_) {} };
  }, [gamify.record]);

  if (!gamify.enabled) {
    return (
      <Col style={wrap(width)}>
        <Header enabled={gamify.enabled} onToggle={() => gamify.setEnabled(true)} onReset={gamify.reset} />
        <Box style={{ padding: 14, gap: 8 }}>
          <Text style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>[ gamify off ]</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>flip the switch to start recording xp, panel usage, and milestones</Text>
        </Box>
      </Col>
    );
  }

  return (
    <Col style={wrap(width)}>
      <Header enabled={gamify.enabled} onToggle={() => gamify.setEnabled(false)} onReset={gamify.reset} />
      <ScrollView showScrollbar={true} style={{ flexGrow: 1 }}>
        <Col style={{ padding: 10, gap: 10 }}>
          <XPBar level={gamify.level} />
          <AchievementFeed unlocks={gamify.unlocks} />
          <HeatmapGrid panels={panels ?? []} usage={gamify.usage} />
          <WorkerStats rows={demo} />
        </Col>
      </ScrollView>
    </Col>
  );
}

function wrap(width?: number) {
  return {
    width: width ?? 360,
    backgroundColor: COLORS.appBg || '#02050a',
    borderLeftWidth: 1, borderColor: COLORS.border || '#1a222c',
    flexDirection: 'column',
    minHeight: 0,
  } as any;
}

function Header({ enabled, onToggle, onReset }: { enabled: boolean; onToggle: () => void; onReset: () => void }) {
  const tone = COLORS.purple || '#d2a8ff';
  return (
    <Row style={{
      alignItems: 'center', gap: 8, padding: 10,
      backgroundColor: COLORS.panelRaised || '#05090f',
      borderBottomWidth: 1, borderColor: COLORS.border || '#1a222c',
    }}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
      <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>◆ GAMIFY</Text>
      <Box style={{ flexGrow: 1 }} />
      <Pressable onPress={onReset} style={chipStyle(COLORS.redDeep || '#3a1616', COLORS.red || '#ff6b6b')}>
        <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>RESET</Text>
      </Pressable>
      <Pressable onPress={onToggle} style={chipStyle(enabled ? tone : (COLORS.panelAlt || '#0b1018'), tone)}>
        <Text style={{ color: enabled ? (COLORS.appBg || '#05090f') : tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </Pressable>
    </Row>
  );
}

function chipStyle(bg: string, border: string): any {
  return { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: bg, borderWidth: 1, borderColor: border };
}
