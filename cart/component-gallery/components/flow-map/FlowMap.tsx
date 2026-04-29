import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type FlowNode = { x: number; y: number; r: number; label: string };
export type FlowEdge = { from: number; to: number };

export type FlowMapProps = {
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  width?: number;
  height?: number;
};

export function FlowMap(props: FlowMapProps) {
  const width = props.width ?? 320;
  const height = props.height ?? 200;
  const designWidth = 320;
  const designHeight = 200;
  const fit = Math.min(width / designWidth, height / designHeight);
  const offsetX = (width - designWidth * fit) / 2;
  const offsetY = (height - designHeight * fit) / 2;
  const sx = (x: number) => offsetX + x * fit;
  const sy = (y: number) => offsetY + y * fit;
  const sr = (r: number) => r * fit;

  const nodes = props.nodes ?? [
    { x: 60, y: 100, r: 6, label: 'Src' },
    { x: 150, y: 60, r: 5, label: 'Proc' },
    { x: 160, y: 130, r: 5, label: 'Filter' },
    { x: 250, y: 80, r: 6, label: 'Merge' },
    { x: 260, y: 130, r: 5, label: 'Out' },
  ];

  const flows = props.edges ?? [
    { from: 0, to: 1 },
    { from: 0, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 4 },
    { from: 3, to: 4 },
  ];

  const nodeStaggers = useStagger(nodes.length, { stiffness: 140, damping: 18 });
  const edgeStaggers = useStagger(flows.length, { stiffness: 120, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {flows.map((f, i) => {
          const a = nodes[f.from];
          const b = nodes[f.to];
          const s = edgeStaggers[i];
          const mx = a.x + (b.x - a.x) * s;
          const my = a.y + (b.y - a.y) * s;
          return (
            <Graph.Path
              key={i}
              d={`M ${sx(a.x)} ${sy(a.y)} L ${sx(mx)} ${sy(my)}`}
              stroke={PALETTE.cyan}
              strokeWidth={Math.max(1, 2 * fit)}
              strokeOpacity={0.5}
            />
          );
        })}
        {nodes.map((n, i) => {
          const x = sx(n.x);
          const y = sy(n.y);
          const r = sr(n.r) * nodeStaggers[i];
          return (
            <Graph.Path
              key={`n-${i}`}
              d={`M ${x - r} ${y} A ${r} ${r} 0 1 1 ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y}`}
              fill={hovered === i ? PALETTE.pink : PALETTE.cyan}
              stroke={PALETTE.white}
              strokeWidth={Math.max(1, fit)}
            />
          );
        })}
      </S.BareGraph>

      {nodes.map((n, i) => (
        <Pressable
          key={`hit-${i}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          style={{
            opacity: 0,
            position: 'absolute',
            left: sx(n.x) - 12,
            top: sy(n.y) - 12,
            width: 24,
            height: 24,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={sx(nodes[hovered].x) + 12}
          y={sy(nodes[hovered].y) - 20}
          title={`Node ${nodes[hovered].label}`}
          rows={[{ label: 'Connections', value: String(flows.filter((f) => f.from === hovered || f.to === hovered).length), color: PALETTE.cyan }]}
        />
      )}

      {nodes.map((n, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: sx(n.x) - 18, top: sy(n.y) + sr(n.r) + 4, width: 36, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight} noWrap>{n.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
