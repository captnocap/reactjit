import { useEffect, useMemo, useState } from 'react';
import { Box, Canvas, Row, Text } from '@reactjit/runtime/primitives';
import { DexBreadcrumbs } from '../dex-breadcrumbs/DexBreadcrumbs';
import { DexCanvasEdge } from '../dex-canvas-edge/DexCanvasEdge';
import { DexCanvasNode } from '../dex-canvas-node/DexCanvasNode';
import { DexCanvasRing } from '../dex-canvas-ring/DexCanvasRing';
import { DEX_COLORS, DexFrame } from '../dex-frame/DexFrame';
import { DexSearchBar } from '../dex-search-bar/DexSearchBar';

export type DexSpatialExplorerProps = {
  width?: number;
};

const spatialNodes = [
  { label: 'root', value: '{8}', cx: 204, cy: 140, size: 72, selected: true },
  { label: 'workers', value: '[5]', cx: 106, cy: 114, size: 64 },
  { label: 'routing', value: '{3}', cx: 289, cy: 101, size: 62 },
  { label: 'flags', value: '{4}', cx: 139, cy: 217, size: 54 },
  { label: 'stats', value: '{3}', cx: 295, cy: 209, size: 50, container: false },
];

export function DexSpatialExplorer({ width = 468 }: DexSpatialExplorerProps) {
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState('routing');
  const graphWidth = Math.max(320, width - 2);
  const graphHeight = 216;

  useEffect(() => {
    const id = setInterval(() => setPhase((value) => value + 1), 760);
    return () => clearInterval(id);
  }, []);

  const liveNodes = useMemo(() => {
    const cx = 204;
    const cy = 140;
    return spatialNodes.map((node, index) => {
      const hot = node.label === selected;
      const size = node.size + (node.label === 'root' ? Math.sin(phase * 0.4) * 1.5 : hot ? 4 : 0);

      if (node.label === 'root') {
        return {
          ...node,
          size,
          x: node.cx - size / 2,
          y: node.cy - size / 2,
          selected: true,
        };
      }

      const angle = Math.atan2(node.cy - cy, node.cx - cx);
      const radiusPulse = Math.sin(phase * 0.34 + index) * 6;
      const centerX = cx + Math.cos(angle) * (index === 2 ? 95 : 102) + Math.cos(phase * 0.22 + index) * radiusPulse;
      const centerY = cy + Math.sin(angle) * (index === 2 ? 92 : 98) + Math.sin(phase * 0.28 + index) * radiusPulse;
      return {
        ...node,
        cx: centerX,
        cy: centerY,
        x: centerX - size / 2,
        y: centerY - size / 2,
        size,
        selected: hot,
      };
    });
  }, [phase, selected]);

  const root = liveNodes[0];
  const rootCenter = { x: root.cx, y: root.cy };

  return (
    <DexFrame
      id="A.3"
      title="shape · radial object map"
      width={width}
      height={300}
      right={
        <Row style={{ gap: 6 }}>
          {['L2', 'L3', 'L4'].map((label) => (
            <Text key={label} style={{ color: label === 'L3' ? DEX_COLORS.accent : DEX_COLORS.inkDimmer, borderWidth: 1, borderColor: label === 'L3' ? DEX_COLORS.ruleBright : DEX_COLORS.rule, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>{label}</Text>
          ))}
        </Row>
      }
      footer={
        <Row style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <DexBreadcrumbs items={['root', selected, selected === 'workers' ? 0 : 'affinities']} />
          <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>DRAG · PAN / WHEEL · ZOOM</Text>
        </Row>
      }
    >
      <DexSearchBar value="" count="23N" placeholder="filter keys / values" />
      <Box style={{ width: graphWidth, height: graphHeight, position: 'relative', backgroundColor: DEX_COLORS.bg }}>
        <Canvas style={{ width: graphWidth, height: graphHeight, backgroundColor: DEX_COLORS.bg }}>
          <DexCanvasRing x={204} y={140} r={126 + Math.sin(phase * 0.25) * 3} />
          <DexCanvasRing x={204} y={140} r={54 + Math.cos(phase * 0.32) * 2} hot dashed />
          {liveNodes.slice(1).map((node, index) => (
            <DexCanvasEdge
              key={node.label}
              x1={rootCenter.x}
              y1={rootCenter.y}
              x2={node.cx}
              y2={node.cy}
              weight={node.label === selected ? 0.62 : 0.25 + index * 0.04}
              hot={node.label === selected}
            />
          ))}
          {liveNodes.map((node) => (
            <DexCanvasNode
              key={node.label}
              {...node}
              onPress={node.label === 'root' ? undefined : () => setSelected(node.label)}
            />
          ))}
        </Canvas>
      </Box>
    </DexFrame>
  );
}
