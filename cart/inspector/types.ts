export type RuntimeNode = {
  id: number;
  type: string;
  props: Record<string, any>;
  handlers: Record<string, Function>;
  children: Array<any>;
  renderCount?: number;
  debugName?: string | null;
  debugSource?: { fileName?: string; lineNumber?: number };
};

export type InspectorNode = {
  id: number;
  type: string;
  renderCount?: number;
  debugName?: string | null;
  debugSource?: { fileName?: string; lineNumber?: number };
  handlers?: string[];
  props: Record<string, any>;
  style: Record<string, any> | null;
  children: InspectorNode[];
  parentId: number;
  path: number[];
};

export type TreeStats = {
  total: number;
  visible: number;
  hidden: number;
  text: number;
  image: number;
  pressable: number;
  scroll: number;
  zero: number;
};

export type EditTarget = {
  nodeId: number;
  section: 'props' | 'style';
  key: string;
  value: string;
} | null;

export type NodeIndex = Map<number, InspectorNode>;

export type LogEntry = {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'trace';
  message: string;
  timestamp: number;
  count: number;
};

export type NetworkEntry = {
  id: number;
  timestamp: number;
  cmds: any[];
  count: number;
  durationUs?: number;
  sizeEstimate?: number;
};

export type PerfSample = {
  fps: number;
  layoutUs: number;
  paintUs: number;
  frameTotalUs: number;
  nodes: number;
  visible: number;
  text: number;
  pressable: number;
  scroll: number;
  time: number;
};

export type MainTab = 'elements' | 'console' | 'network' | 'performance' | 'memory' | 'host' | 'settings';
export type DetailTab = 'props' | 'style' | 'computed' | 'layout' | 'tree' | 'events';
