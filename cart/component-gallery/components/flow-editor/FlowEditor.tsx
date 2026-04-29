import { Box, Canvas, Graph } from '@reactjit/runtime/primitives';
import { FLOW_EDITOR_DEFAULT_THEME, type FlowEditorTheme } from './flowEditorTheme';
import { arrowHeadPath, bezierFor } from './bezier';
import { FlowTile } from './FlowTile';
import type { FlowEdge, FlowNode, FlowTileBodyRenderer } from './types';
import { useFlowEditorState, type UseFlowEditorStateOptions } from './useFlowEditorState';

// Public, embeddable flow editor.
//
// Two ways to use it:
//
//   1. Uncontrolled (simplest)
//      <FlowEditor initialNodes={...} initialEdges={...} />
//      The editor manages its own state. Node/edge changes can be observed
//      via onChange callbacks if you want to mirror them out.
//
//   2. Controlled
//      Drive `nodes` + `edges` from your own state, then pass `onNodesChange`
//      and `onEdgesChange` to receive updates. The component will not write
//      to its internal state when you supply both.
//
// Theme is a single prop with sensible defaults; pass a partial override to
// re-skin without forking the component.
export type FlowEditorProps = {
  // Controlled
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  onNodesChange?: (next: FlowNode[]) => void;
  onEdgesChange?: (next: FlowEdge[]) => void;

  // Uncontrolled seeds (ignored if `nodes`/`edges` are passed)
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];

  // Visuals
  theme?: Partial<FlowEditorTheme>;
  renderTileBody?: FlowTileBodyRenderer;

  // Layout knobs
  spawnPadX?: number;
  spawnPadY?: number;

  // Behavior
  allowDelete?: boolean; // false hides the × button on tiles
};

export function FlowEditor(props: FlowEditorProps) {
  const theme: FlowEditorTheme = { ...FLOW_EDITOR_DEFAULT_THEME, ...(props.theme ?? {}) };
  const stateOptions: UseFlowEditorStateOptions = {
    initialNodes: props.initialNodes,
    initialEdges: props.initialEdges,
    spawnPadX: props.spawnPadX,
    spawnPadY: props.spawnPadY,
  };
  const state = useFlowEditorState(stateOptions);

  // Controlled mode: prefer external nodes/edges if supplied. We still use
  // the headless state machine for pending/selected/handlers; the data lists
  // come from props.
  const controlledNodes = props.nodes;
  const controlledEdges = props.edges;
  const nodes = controlledNodes ?? state.nodes;
  const edges = controlledEdges ?? state.edges;

  const propagateNodes = (next: FlowNode[]) => {
    if (props.onNodesChange) props.onNodesChange(next);
    if (controlledNodes == null) state.setNodes(next);
  };
  const propagateEdges = (next: FlowEdge[]) => {
    if (props.onEdgesChange) props.onEdgesChange(next);
    if (controlledEdges == null) state.setEdges(next);
  };

  const moveNode = (id: string, x: number, y: number) => {
    propagateNodes(nodes.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };
  const removeNode = (id: string) => {
    propagateNodes(nodes.filter((n) => n.id !== id));
    propagateEdges(edges.filter((e) => e.from !== id && e.to !== id));
    if (state.selectedId === id) state.setSelectedId(null);
    if (state.pending?.nodeId === id) state.setPending(null);
  };

  const tryAddEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (edges.some((e) => e.from === fromId && e.to === toId)) return;
    const id = `e${Date.now().toString(36)}`;
    propagateEdges([...edges, { id, from: fromId, to: toId }]);
  };

  const onPortClick = (nodeId: string, side: 'in' | 'out') => {
    const cur = state.pending;
    if (!cur) { state.setPending({ nodeId, side }); return; }
    if (cur.nodeId === nodeId) { state.setPending(null); return; }
    if (cur.side === side) { state.setPending({ nodeId, side }); return; }
    if (cur.side === 'out') tryAddEdge(cur.nodeId, nodeId);
    else tryAddEdge(nodeId, cur.nodeId);
    state.setPending(null);
  };
  const onTileClick = (id: string) => {
    const cur = state.pending;
    if (cur) {
      if (cur.nodeId !== id) {
        if (cur.side === 'out') tryAddEdge(cur.nodeId, id);
        else tryAddEdge(id, cur.nodeId);
      }
      state.setPending(null);
      return;
    }
    state.setSelectedId(id);
  };

  const byId = new Map<string, FlowNode>();
  for (const n of nodes) byId.set(n.id, n);

  const halfW = theme.tileWidth / 2;
  const edgePaths: any[] = [];
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + halfW;
    const y1 = a.y;
    const x2 = b.x - halfW;
    const y2 = b.y;
    const bz = bezierFor(x1, y1, x2, y2);
    edgePaths.push(
      <Graph.Path
        key={`p-${e.id}`}
        d={bz.d}
        stroke={theme.edgeColor}
        strokeWidth={theme.edgeStrokeWidth}
        fill="none"
      />,
    );
    edgePaths.push(
      <Graph.Path
        key={`h-${e.id}`}
        d={arrowHeadPath(x2, y2, bz.c2x, bz.c2y)}
        stroke={theme.edgeColor}
        strokeWidth={theme.edgeStrokeWidth}
        fill="none"
      />,
    );
  }

  const tiles = nodes.map((node) => (
    <FlowTile
      key={node.id}
      node={node}
      theme={theme}
      selected={state.selectedId === node.id}
      pendingIn={state.pending?.nodeId === node.id && state.pending.side === 'in'}
      pendingOut={state.pending?.nodeId === node.id && state.pending.side === 'out'}
      onMove={moveNode}
      onPortClick={onPortClick}
      onTileClick={onTileClick}
      onRemove={props.allowDelete === false ? undefined : removeNode}
      renderBody={props.renderTileBody}
    />
  ));

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: theme.bg }}>
      <Canvas
        style={{ width: '100%', height: '100%', backgroundColor: theme.bg }}
        gridStep={theme.gridStep}
        gridStroke={1}
        gridColor={theme.gridColor}
        gridMajorColor={theme.gridMajorColor}
        gridMajorEvery={theme.gridMajorEvery}
      >
        <Graph
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
          viewX={0}
          viewY={0}
          viewZoom={1}
        >
          {edgePaths}
        </Graph>
        {tiles}
      </Canvas>
    </Box>
  );
}

// Re-exports for convenience.
export type { FlowEdge, FlowNode, FlowTileBodyRenderer } from './types';
export type { FlowEditorTheme } from './flowEditorTheme';
export { FLOW_EDITOR_DEFAULT_THEME } from './flowEditorTheme';
export { useFlowEditorState } from './useFlowEditorState';
export { bezierFor, arrowHeadPath } from './bezier';
