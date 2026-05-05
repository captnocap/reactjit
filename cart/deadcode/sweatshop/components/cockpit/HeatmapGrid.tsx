
import { Box, Canvas, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export interface PanelDef { id: string; label: string; }

export interface HeatmapGridProps {
  panels: PanelDef[];
  usage: Record<string, number>;
  cols?: number;
  cellSize?: number;
  gap?: number;
  height?: number;
}

const DEFAULT_PANELS: PanelDef[] = [
  { id: 'cockpit',   label: 'cockpit'  },
  { id: 'editor',    label: 'editor'   },
  { id: 'landing',   label: 'landing'  },
  { id: 'settings',  label: 'settings' },
  { id: 'terminal',  label: 'terminal' },
  { id: 'git',       label: 'git'      },
  { id: 'plan',      label: 'plan'     },
  { id: 'search',    label: 'search'   },
  { id: 'chat',      label: 'chat'     },
  { id: 'hotpanel',  label: 'hot'      },
  { id: 'diff',      label: 'diff'     },
  { id: 'indexer',   label: 'indexer'  },
];

export function HeatmapGrid(props: HeatmapGridProps) {
  const panels = props.panels.length > 0 ? props.panels : DEFAULT_PANELS;
  const cols = props.cols ?? 4;
  const cellSize = props.cellSize ?? 64;
  const gap = props.gap ?? 8;
  const height = props.height ?? 260;

  const { max } = useMemo(() => {
    let m = 0;
    for (const id in props.usage) if (props.usage[id] > m) m = props.usage[id];
    return { max: m };
  }, [props.usage]);

  const tone = COLORS.cyan || COLORS.blue || '#79c0ff';
  const toneDim = COLORS.border || '#1f2630';

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8, padding: 10, gap: 8,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 4, height: 12, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>PANEL HEATMAP</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{Object.keys(props.usage).length} active · peak {max}</Text>
      </Row>

      <Canvas style={{ width: '100%', height }}>
        {panels.map((p, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const gx = gap + col * (cellSize + gap);
          const gy = gap + row * (cellSize + gap);
          const v = props.usage[p.id] ?? 0;
          const ratio = max > 0 ? v / max : 0;
          const alpha = 0.08 + 0.72 * ratio;
          return (
            <Canvas.Node key={p.id} gx={gx} gy={gy} gw={cellSize} gh={cellSize}>
              <Box style={{
                width: '100%', height: '100%',
                borderRadius: 6,
                backgroundColor: toneDim,
                borderWidth: 1, borderColor: ratio > 0 ? tone : (COLORS.border || '#1f2630'),
                padding: 6,
                flexDirection: 'column',
              }}>
                <Box style={{
                  position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
                  backgroundColor: tone, opacity: alpha, borderRadius: 6,
                }} />
                <Text style={{ color: COLORS.textBright, fontSize: 10, fontWeight: 700 }}>{p.label}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Row style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: ratio > 0 ? COLORS.textBright : COLORS.textDim, fontSize: 18, fontWeight: 700 }}>{v}</Text>
                  <Text style={{ color: COLORS.textDim, fontSize: 9 }}>hits</Text>
                </Row>
              </Box>
            </Canvas.Node>
          );
        })}
      </Canvas>

      <Row style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>cold</Text>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((a) => (
          <Box key={a} style={{ width: 14, height: 6, borderRadius: 1, backgroundColor: tone, opacity: a }} />
        ))}
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>hot</Text>
      </Row>
    </Col>
  );
}
