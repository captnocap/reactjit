import { Box, Canvas, Graph, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../sweatshop/theme';
import { colorForNode, graphPathFor } from './LayoutEngine';
import { NodeLabel } from './NodeLabel';
import type { GraphSim } from './useGraphSim';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nodeSize(node: any, selected: boolean): { w: number; h: number } {
  const labelWidth = 62 + node.label.length * 5.4;
  const w = clamp(Math.max(node.depth === 0 ? 186 : 146, labelWidth), 132, 248);
  const h = selected ? 88 : node.depth === 0 ? 78 : 70;
  return { w, h };
}

function gridPaths(extent: number) {
  const lines: any[] = [];
  const step = 240;
  for (let x = -extent; x <= extent; x += step) {
    lines.push(<Graph.Path key={`gx-${x}`} d={`M ${x} ${-extent} L ${x} ${extent}`} stroke="#1d2632" strokeWidth={1} />);
  }
  for (let y = -extent; y <= extent; y += step) {
    lines.push(<Graph.Path key={`gy-${y}`} d={`M ${-extent} ${y} L ${extent} ${y}`} stroke="#1d2632" strokeWidth={1} />);
  }
  return lines;
}

export function GraphStage(props: { sim: GraphSim }) {
  const sim = props.sim;
  const selectedSet = sim.neighborhood;
  const focusedNode = sim.selectedNode;
  const positions = sim.positions;

  const extent = Math.max(sim.layout.width, sim.layout.height, 1400);
  const edges: any[] = [];
  for (const edge of sim.graph.edges) {
    const from = sim.graph.byId.get(edge.from);
    const to = sim.graph.byId.get(edge.to);
    if (!from || !to) continue;
    const onPath = !selectedSet || (selectedSet.has(edge.from) && selectedSet.has(edge.to));
    const sourceColor = colorForNode(from, sim.colorMode);
    edges.push(
      <Graph.Path
        key={`${edge.from}-${edge.to}`}
        d={graphPathFor(edge, positions)}
        stroke={onPath ? sourceColor : COLORS.borderSoft}
        strokeWidth={edge.kind === 'tree' ? (onPath ? 1.8 : 1.2) : (onPath ? 1.4 : 1.0)}
        strokeDasharray={edge.kind === 'cross' ? '5 4' : undefined}
        fill="none"
      />,
    );
  }

  const nodes: any[] = [];
  for (const node of sim.graph.nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const selected = sim.selectedId === node.id;
    const dimmed = !!selectedSet && !selectedSet.has(node.id);
    const pulse = sim.pulseId === node.id;
    const size = nodeSize(node, selected);
    nodes.push(
      <Canvas.Node
        key={node.id}
        gx={pos.x}
        gy={pos.y}
        gw={size.w}
        gh={size.h}
        onMove={(e: any) => sim.moveNode(node.id, e.gx, e.gy)}
      >
        <NodeLabel
          node={node}
          colorMode={sim.colorMode}
          selected={selected}
          dimmed={dimmed}
          pulse={pulse}
          onPress={() => sim.selectNode(node.id)}
        />
      </Canvas.Node>,
    );
  }

  return (
    <Canvas
      style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.appBg }}
      viewX={sim.camera.x}
      viewY={sim.camera.y}
      viewZoom={sim.camera.zoom}
    >
      <Graph style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
        {gridPaths(extent)}
        {edges}
      </Graph>
      {nodes}
      <Canvas.Clamp>
        <Box
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            maxWidth: 420,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 2,
            borderRadius: TOKENS.radiusMd,
            backgroundColor: 'rgba(11, 18, 28, 0.78)',
            borderWidth: 1,
            borderColor: COLORS.borderSoft,
          }}
        >
          <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {focusedNode ? `focus ${focusedNode.label}` : 'click a node to inspect its neighborhood'}
          </Text>
          <Text fontSize={9} color={COLORS.textDim}>
            drag a node to reposition its subtree, search to pan camera and pulse a hit
          </Text>
        </Box>
      </Canvas.Clamp>
    </Canvas>
  );
}
