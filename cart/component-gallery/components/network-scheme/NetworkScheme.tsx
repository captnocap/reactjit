import { useState } from 'react';
import { Box, Graph, Pressable, Text } from '@reactjit/runtime/primitives';
import { PALETTE } from '../../lib/chart-utils';
import { useStagger } from '../../lib/useStagger';
import { Tooltip } from '../../lib/Tooltip';
import { classifiers as S } from '@reactjit/core';

export type NetworkNode = { x: number; y: number; r: number; label: string; color?: string };
export type NetworkEdge = [number, number];

export type NetworkSchemeProps = {
  nodes?: NetworkNode[];
  edges?: NetworkEdge[];
  width?: number;
  height?: number;
};

export function NetworkScheme(props: NetworkSchemeProps) {
  const width = props.width ?? 280;
  const height = props.height ?? 180;

  const nodes = props.nodes ?? [
    { x: 140, y: 30, r: 8, color: PALETTE.pink, label: 'API' },
    { x: 80, y: 80, r: 6, color: PALETTE.cyan, label: 'Auth' },
    { x: 200, y: 80, r: 6, color: PALETTE.cyan, label: 'DB' },
    { x: 50, y: 140, r: 5, color: PALETTE.blue, label: 'Cache' },
    { x: 120, y: 150, r: 5, color: PALETTE.blue, label: 'Queue' },
    { x: 190, y: 140, r: 5, color: PALETTE.blue, label: 'Worker' },
    { x: 230, y: 130, r: 5, color: PALETTE.blue, label: 'Store' },
  ];

  const edges = props.edges ?? [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6], [4, 5],
  ] as NetworkEdge[];

  const nodeStaggers = useStagger(nodes.length, { stiffness: 140, damping: 18 });
  const edgeStaggers = useStagger(edges.length, { stiffness: 120, damping: 16 });
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Box style={{ width, height }}>
      <S.BareGraph>
        {edges.map(([a, b], i) => {
          const na = nodes[a];
          const nb = nodes[b];
          const s = edgeStaggers[i];
          const mx = na.x + (nb.x - na.x) * s;
          const my = na.y + (nb.y - na.y) * s;
          return (
            <Graph.Path
              key={i}
              d={`M ${na.x} ${na.y} L ${mx} ${my}`}
              stroke={PALETTE.slateLight}
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((n, i) => {
          const r = n.r * nodeStaggers[i];
          return (
            <Graph.Path
              key={i}
              d={`M ${n.x - r} ${n.y} A ${r} ${r} 0 1 1 ${n.x + r} ${n.y} A ${r} ${r} 0 1 1 ${n.x - r} ${n.y}`}
              fill={hovered === i ? PALETTE.pink : n.color ?? PALETTE.cyan}
              stroke={PALETTE.white}
              strokeWidth={1}
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
            left: n.x - 12,
            top: n.y - 12,
            width: 24,
            height: 24,
          }}
        />
      ))}

      {hovered != null && (
        <Tooltip
          visible={true}
          x={nodes[hovered].x + 12}
          y={nodes[hovered].y - 20}
          title={`Node ${nodes[hovered].label}`}
          rows={[{ label: 'Degree', value: String(edges.filter(([a, b]) => a === hovered || b === hovered).length), color: PALETTE.pink }]}
        />
      )}

      {nodes.map((n, i) => (
        <Box key={`lbl-${i}`} style={{ position: 'absolute', left: n.x - 8, top: n.y + n.r + 2, width: 16, alignItems: 'center' }}>
          <Text fontSize={8} color={PALETTE.slateLight}>{n.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
