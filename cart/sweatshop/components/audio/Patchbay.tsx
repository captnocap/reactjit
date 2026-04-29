
import { Box, Canvas, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import type { AudioRackApi } from '../../lib/audio/hooks/useAudioRack';
import type { Connection, Module, PortSpec } from '../../lib/audio/types';

export interface PatchbayProps {
  rackApi: AudioRackApi;
  height?: number;
}

const PORT_COLOR: Record<string, string> = {
  audio: '#79c0ff',
  cv:    '#d2a8ff',
  gate:  '#7ee787',
  midi:  '#ffb86b',
};

// World-space grid layout: each module occupies a 220-wide column, ports are
// placed along the left (ins) and right (outs) edges. Patch cables are
// Canvas.Paths drawn between source and destination dots.
const COL_WIDTH = 220;
const ROW_HEIGHT = 24;
const DOT = 8;
const PADDING = 16;

export function Patchbay({ rackApi, height }: PatchbayProps) {
  const [pending, setPending] = useState<{ moduleId: string; portId: string; direction: 'in' | 'out' } | null>(null);

  const layout = useMemo(() => {
    const cols: { module: Module; x: number; ports: { port: PortSpec; y: number }[] }[] = [];
    rackApi.rack.modules.forEach((m, i) => {
      const ports = m.ports.map((p, j) => ({ port: p, y: PADDING + j * ROW_HEIGHT }));
      cols.push({ module: m, x: PADDING + i * COL_WIDTH, ports });
    });
    return cols;
  }, [rackApi.rack, rackApi.revision]);

  const portPos = (moduleId: string, portId: string, direction: 'in' | 'out'): { x: number; y: number } | null => {
    const col = layout.find((c) => c.module.id === moduleId);
    if (!col) return null;
    const entry = col.ports.find((pe) => pe.port.id === portId);
    if (!entry) return null;
    return { x: col.x + (direction === 'out' ? COL_WIDTH - 20 : 20), y: entry.y + 10 };
  };

  const startOrFinish = (moduleId: string, portId: string, direction: 'in' | 'out') => {
    if (!pending) { setPending({ moduleId, portId, direction }); return; }
    // Must join an out -> in, never two of the same direction.
    if (pending.direction === direction) { setPending({ moduleId, portId, direction }); return; }
    const from = pending.direction === 'out' ? pending : { moduleId, portId };
    const to = pending.direction === 'in'  ? pending : { moduleId, portId };
    if (from.moduleId === to.moduleId) { setPending(null); return; }
    rackApi.connect(from.moduleId, from.portId, to.moduleId, to.portId);
    setPending(null);
  };

  const width = layout.length * COL_WIDTH + PADDING * 2;
  const tone = COLORS.purple || '#d2a8ff';
  const h = height ?? 260;

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Row style={{
        alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>PATCHBAY</Text>
        <Box style={{ flexGrow: 1 }} />
        {pending ? (
          <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 9 }}>
            click a matching {pending.direction === 'out' ? 'input' : 'output'} to finish · or click again to cancel
          </Text>
        ) : (
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{rackApi.rack.connections.length} cables</Text>
        )}
      </Row>

      <Box style={{ height: h }}>
        <Canvas style={{ width: '100%', height: '100%' }}>
          {layout.map((col) => (
            <Canvas.Node key={col.module.id} gx={col.x} gy={0} gw={COL_WIDTH - 20} gh={col.ports.length * ROW_HEIGHT + PADDING}>
              <Box style={{
                width: '100%', height: '100%',
                borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
                backgroundColor: COLORS.panelAlt || '#05090f',
                padding: 6,
              }}>
                <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>{col.module.label}</Text>
                {col.module.ports.map((p) => (
                  <Row key={p.id} style={{ alignItems: 'center', gap: 4, height: ROW_HEIGHT - 4 }}>
                    {p.direction === 'in' ? (
                      <Pressable onPress={() => startOrFinish(col.module.id, p.id, 'in')}>
                        <Box style={dotStyle(PORT_COLOR[p.kind] || tone, pending && pending.moduleId === col.module.id && pending.portId === p.id)} />
                      </Pressable>
                    ) : null}
                    <Text style={{ color: COLORS.textDim, fontSize: 9, flexGrow: 1, textAlign: p.direction === 'out' ? 'right' : 'left' }}>
                      {p.label}
                    </Text>
                    {p.direction === 'out' ? (
                      <Pressable onPress={() => startOrFinish(col.module.id, p.id, 'out')}>
                        <Box style={dotStyle(PORT_COLOR[p.kind] || tone, pending && pending.moduleId === col.module.id && pending.portId === p.id)} />
                      </Pressable>
                    ) : null}
                  </Row>
                ))}
              </Box>
            </Canvas.Node>
          ))}
          {rackApi.rack.connections.map((c: Connection) => {
            const from = portPos(c.fromModule, c.fromPort, 'out');
            const to = portPos(c.toModule, c.toPort, 'in');
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const d = 'M ' + from.x.toFixed(1) + ' ' + from.y.toFixed(1)
                   + ' C ' + midX.toFixed(1) + ' ' + from.y.toFixed(1)
                   + ', ' + midX.toFixed(1) + ' ' + to.y.toFixed(1)
                   + ', ' + to.x.toFixed(1) + ' ' + to.y.toFixed(1);
            return (
              <Canvas.Path key={c.id} d={d} stroke={COLORS.purple || '#d2a8ff'} strokeWidth={2} fill="none" />
            );
          })}
        </Canvas>
      </Box>

      <Row style={{ gap: 6, padding: 6, flexWrap: 'wrap', borderTopWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
        {rackApi.rack.connections.map((c) => {
          const fromMod = rackApi.rack.modules.find((m) => m.id === c.fromModule);
          const toMod = rackApi.rack.modules.find((m) => m.id === c.toModule);
          return (
            <Pressable key={c.id} onPress={() => rackApi.disconnect(c.id)} style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
              backgroundColor: COLORS.panelAlt || '#05090f',
              borderWidth: 1, borderColor: COLORS.red || '#ff6b6b',
            }}>
              <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700 }}>
                × {fromMod?.label || c.fromModule}:{c.fromPort} → {toMod?.label || c.toModule}:{c.toPort}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </Col>
  );
}

function dotStyle(color: string, pending: boolean | null | undefined): any {
  return {
    width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: color,
    borderWidth: pending ? 2 : 1,
    borderColor: pending ? (COLORS.yellow || '#f2e05a') : COLORS.border || '#1f2630',
  };
}
