// Public types for the FlowEditor component.

export type FlowNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  // Free-form payload — embedders may stash whatever per-node data they want
  // here. The editor never inspects it; it is preserved across moves and
  // returned via onNodesChange.
  data?: unknown;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
};

export type FlowPendingWire = {
  nodeId: string;
  side: 'in' | 'out';
} | null;

// Render slot for a tile's body. Embedders can supply this to draw arbitrary
// content inside the tile — the editor still owns the outer rect, ports,
// border, and delete button.
export type FlowTileBodyRenderer = (ctx: {
  node: FlowNode;
  selected: boolean;
  pending: boolean;
}) => any;
