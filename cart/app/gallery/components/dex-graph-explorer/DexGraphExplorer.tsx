import { useEffect, useMemo, useState } from 'react';
import { Box, Canvas, Col, Row, Text } from '@reactjit/runtime/primitives';
import { DexBreadcrumbs } from '../dex-breadcrumbs/DexBreadcrumbs';
import { DexCanvasEdge } from '../dex-canvas-edge/DexCanvasEdge';
import { DexCanvasNode } from '../dex-canvas-node/DexCanvasNode';
import { DEX_COLORS, DexFrame } from '../dex-frame/DexFrame';
import { DexHeatCell } from '../dex-heat-cell/DexHeatCell';
import { DexSearchBar } from '../dex-search-bar/DexSearchBar';
import { useAnimationsDisabled } from '../../lib/useSpring';

export type DexGraphExplorerProps = {
  width?: number;
};

const graphNodes = [
  { id: 'planner', x: 72, y: 74, r: 14, color: DEX_COLORS.blue },
  { id: 'impl', x: 184, y: 152, r: 17, color: DEX_COLORS.ok },
  { id: 'critic', x: 292, y: 82, r: 13, color: DEX_COLORS.lilac },
  { id: 'ratchet', x: 214, y: 48, r: 12, color: DEX_COLORS.flag },
  { id: 'diff', x: 116, y: 194, r: 11, color: DEX_COLORS.warn },
];

const graphEdges = [
  ['planner', 'impl', 0.71],
  ['planner', 'diff', 0.58],
  ['impl', 'critic', 0.64],
  ['critic', 'ratchet', 0.62],
  ['impl', 'diff', 0.86],
] as const;

const heatValues = [0.82, 0.71, 0.58, 0.49, 0.77, 0.7, 0.5, 0.4, 0.32, 0.19, 0.63, 0.88];

export function DexGraphExplorer({ width = 468 }: DexGraphExplorerProps) {
  const animationsDisabled = useAnimationsDisabled();
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState('planner');
  const graphWidth = Math.max(214, width - 130);
  const graphHeight = 216;

  useEffect(() => {
    if (animationsDisabled) return;
    const id = setInterval(() => setPhase((value) => value + 1), 700);
    return () => clearInterval(id);
  }, [animationsDisabled]);

  const liveNodes = useMemo(() => {
    return graphNodes.map((node, index) => {
      const hot = node.id === selected;
      const angle = phase * 0.32 + index * 1.7;
      const pull = hot ? 1.5 : 1;
      return {
        ...node,
        x: node.x + Math.cos(angle) * 4 * pull,
        y: node.y + Math.sin(angle * 0.8) * 3 * pull,
        r: node.r + (hot ? 2 : 0) + Math.sin(phase * 0.5 + index) * 0.8,
      };
    });
  }, [phase, selected]);

  const byId = new Map(liveNodes.map((node) => [node.id, node]));
  const heat = heatValues.map((value, index) => {
    const wobble = Math.sin(phase * 0.45 + index * 0.8) * 0.08;
    return Math.max(0.05, Math.min(0.95, value + wobble + (index % 4 === 0 ? 0.04 : 0)));
  });

  return (
    <DexFrame
      id="A.4"
      title="graph · embeddings"
      width={width}
      height={300}
      right={
        <Row style={{ gap: 6 }}>
          <Text style={{ color: DEX_COLORS.accent, borderWidth: 1, borderColor: DEX_COLORS.ruleBright, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>LABELS</Text>
          <Text style={{ color: DEX_COLORS.inkDimmer, borderWidth: 1, borderColor: DEX_COLORS.rule, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>CLEAN</Text>
        </Row>
      }
      footer={
        <Row style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <DexBreadcrumbs items={['graph', selected, '~', selected === 'planner' ? 'impl' : 'planner']} />
          <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>DRAG · PAN / WHEEL · ZOOM</Text>
        </Row>
      }
    >
      <DexSearchBar value="plan" count="1 hit" placeholder="find node" />
      <Row style={{ flex: 1, minHeight: 0 }}>
        <Box style={{ width: graphWidth, height: graphHeight, position: 'relative', backgroundColor: DEX_COLORS.bg }}>
          <Canvas style={{ width: graphWidth, height: graphHeight, backgroundColor: DEX_COLORS.bg }}>
            {graphEdges.map(([from, to, weight]) => {
              const a = byId.get(from)!;
              const b = byId.get(to)!;
              const hot = from === selected || to === selected;
              const liveWeight = Math.max(0.1, Math.min(0.98, weight + Math.sin(phase * 0.38 + a.x * 0.01 + b.y * 0.01) * 0.09));
              return (
                <DexCanvasEdge
                  key={`${from}-${to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  weight={liveWeight}
                  hot={hot}
                />
              );
            })}
            {liveNodes.map((node) => (
              <DexCanvasNode
                key={node.id}
                x={node.x - node.r}
                y={node.y - node.r}
                size={node.r * 2}
                label={node.id}
                value={node.id === selected ? 'focus' : 'node'}
                selected={node.id === selected}
                onPress={() => setSelected(node.id)}
              />
            ))}
          </Canvas>
        </Box>
        <Col style={{ width: 128, borderLeftWidth: 1, borderColor: DEX_COLORS.rule, padding: 8, gap: 8 }}>
          <Text style={{ color: DEX_COLORS.accent, fontSize: 10 }}>{`HEAT · ${selected}`}</Text>
          <Row style={{ gap: 3, flexWrap: 'wrap' }}>
            {heat.map((value, index) => (
              <DexHeatCell key={index} value={value} size={18} selected={index === 0} />
            ))}
          </Row>
          <Col style={{ gap: 3 }}>
            {['spec 0.82', 'impl 0.71', 'diff 0.58', 'tokens 0.40'].map((label) => (
              <Text key={label} style={{ color: DEX_COLORS.inkDim, fontSize: 9 }}>{label}</Text>
            ))}
          </Col>
        </Col>
      </Row>
    </DexFrame>
  );
}
