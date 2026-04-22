const React: any = require('react');
import { Box, Row, Text, Pressable } from '../../../../runtime/primitives';
import { useTransition as useAnimatedTransition } from '../../anim';

export type WorkerStatus = 'idle' | 'thinking' | 'tool' | 'stuck' | 'rationalizing' | 'done';

export interface Worker {
  id: string;
  name: string;
  model: string;
  status: WorkerStatus;
  accent: string;
  latestTool: string;
  taskSlug: string;
  heartbeat: number;
  x: number;
  y: number;
  blockedOn?: string | null;
  assignedTask?: string | null;
}

const STATUS_TONE: Record<WorkerStatus, { label: string; color: string; glow: string }> = {
  idle:          { label: 'IDLE',      color: '#5c6a78', glow: '#2a3340' },
  thinking:      { label: 'THINKING',  color: '#79c0ff', glow: '#173048' },
  tool:          { label: 'TOOL-USE',  color: '#7ee787', glow: '#143322' },
  stuck:         { label: 'STUCK',     color: '#ffb86b', glow: '#3a2a14' },
  rationalizing: { label: 'FLAGGED',   color: '#ff6b6b', glow: '#3a1616' },
  done:          { label: 'DONE',      color: '#d2a8ff', glow: '#2a1840' },
};

export interface WorkerTileProps {
  worker: Worker;
  focused?: boolean;
  onFocus?: (id: string) => void;
  inCanvas?: boolean;
}

export function WorkerTile({ worker, focused, onFocus, inCanvas }: WorkerTileProps) {
  const tone = STATUS_TONE[worker.status] || STATUS_TONE.idle;
  const border = focused ? worker.accent : '#1f2630';
  const focusProgress = useAnimatedTransition(focused ? 1 : 0, 180);
  const width = 260 + (420 - 260) * focusProgress;
  const height = 168 + (280 - 168) * focusProgress;
  const scale = 1 + focusProgress * 0.06;
  const positioning: any = inCanvas
    ? { width: '100%', height: '100%' }
    : { position: 'absolute', left: worker.x, top: worker.y, width, height, zIndex: focused ? 10 : 1, transform: { scaleX: scale, scaleY: scale } };
  return (
    <Pressable onPress={() => onFocus && onFocus(worker.id)}
      style={{
        ...positioning,
        backgroundColor: '#0b1018',
        borderWidth: 2,
        borderColor: border,
        borderRadius: 10,
        padding: 12,
        flexDirection: 'column',
        gap: 6,
      }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone.color }} />
        <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: 700 }}>{worker.name}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Box style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: tone.glow }}>
          <Text style={{ color: tone.color, fontSize: 10, fontWeight: 700 }}>{tone.label}</Text>
        </Box>
      </Row>
      <Text style={{ color: '#6b7684', fontSize: 11 }}>{worker.model} · {worker.taskSlug}</Text>
      <Box style={{ height: 1, backgroundColor: '#1f2630' }} />
      <Text style={{ color: '#8b98a6', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>LATEST TOOL</Text>
      <Box style={{ backgroundColor: '#05090f', borderRadius: 6, padding: 8, flexGrow: 1 }}>
        <Text style={{ color: tone.color, fontSize: 11 }}>{worker.latestTool}</Text>
      </Box>
      {worker.blockedOn ? (
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#3a1616' }}>
            <Text style={{ color: '#ff6b6b', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>BLOCKED ON</Text>
          </Box>
          <Text style={{ color: '#ff9b9b', fontSize: 10 }}>worker-{worker.blockedOn}</Text>
        </Row>
      ) : null}
      <Row style={{ gap: 4, alignItems: 'center' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Box key={i} style={{
            width: 6, height: 10, borderRadius: 2,
            backgroundColor: i < worker.heartbeat ? worker.accent : '#1a222c',
          }} />
        ))}
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: '#5c6a78', fontSize: 10 }}>#{worker.id}</Text>
      </Row>
    </Pressable>
  );
}
