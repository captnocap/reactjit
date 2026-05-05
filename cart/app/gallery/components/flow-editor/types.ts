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

export type FlowPortSide = 'in' | 'out';

export type FlowPortKind =
  | 'flow'
  | 'data'
  | 'tool'
  | 'cond-true'
  | 'cond-false'
  | 'error'
  | 'ctx'
  | 'loop';

export type FlowNodeState = 'idle' | 'run' | 'ok' | 'err' | 'wait';

export type FlowNodeKind =
  | 'action'
  | 'sequence'
  | 'if'
  | 'switch'
  | 'lanes'
  | 'loop'
  | 'token'
  | 'trigger'
  | 'end';

export type FlowPort = {
  id: string;
  side: FlowPortSide;
  kind: FlowPortKind;
  label: string;
  offsetY?: number;
};

export type FlowKvPair = {
  key: string;
  value: string;
};

export type FlowStep = {
  id: string;
  label: string;
  glyph?: string;
  state?: FlowNodeState | 'done' | 'skip';
  metric?: string;
};

export type FlowCase = {
  id: string;
  label: string;
  value?: string;
  hitRate?: string;
  active?: boolean;
};

export type FlowLane = {
  id: string;
  label: string;
  state?: FlowNodeState;
  metric?: string;
  lines?: string[];
};

export type FlowNodeMeta = {
  runs?: string;
  ms?: string;
  cost?: string;
  model?: string;
  version?: string;
  lastRun?: string;
};

export type FlowNodeVisualData = {
  kind?: FlowNodeKind;
  role?: string;
  roleGlyph?: string;
  roleKind?: FlowPortKind;
  state?: FlowNodeState;
  quickActions?: string[];
  kv?: FlowKvPair[];
  code?: string[];
  steps?: FlowStep[];
  cases?: FlowCase[];
  lanes?: FlowLane[];
  meta?: FlowNodeMeta;
  ports?: FlowPort[];
  loop?: {
    current: number;
    total: number;
    label?: string;
  };
  hitRate?: {
    true?: string;
    false?: string;
  };
  activeCaseId?: string;
  draft?: boolean;
  stripe?: 'trigger' | 'end';
  note?: string;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  kind?: FlowPortKind;
  label?: string;
};

export type FlowPendingWire = {
  nodeId: string;
  side: FlowPortSide;
  portId?: string;
} | null;

// Render slot for a tile's body. Embedders can supply this to draw arbitrary
// content inside the tile — the editor still owns the outer rect, ports,
// border, and delete button.
export type FlowTileBodyRenderer = (ctx: {
  node: FlowNode;
  selected: boolean;
  pending: boolean;
}) => any;
