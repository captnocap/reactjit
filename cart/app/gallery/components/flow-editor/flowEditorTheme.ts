// Theme tokens for the FlowEditor component. Hex/rgba literals are pinned
// here so consumers reference them via the `theme` prop instead of pasting
// colors into call sites. Override any field at the call site to re-skin.

export type FlowEditorTheme = {
  bg: string;
  tileBg: string;
  tileBgSelected: string;
  tileBorder: string;
  tileBorderSelected: string;
  tilePending: string;
  edgeColor: string;
  edgeStrokeWidth: number;
  portIn: string;
  portOut: string;
  portRadius: number;
  gridColor: string;
  gridMajorColor: string;
  gridStep: number;
  gridMajorEvery: number;
  textBright: string;
  textDim: string;
  deleteBg: string;
  radiusMd: number;
  tileWidth: number;
  tileHeight: number;
};

export const FLOW_EDITOR_DEFAULT_THEME: FlowEditorTheme = {
  bg: '#090d13',
  tileBg: '#101824',
  tileBgSelected: '#1a2738',
  tileBorder: '#18202b',
  tileBorderSelected: '#5db4ff',
  tilePending: '#f5c95b',
  edgeColor: '#5db4ff',
  edgeStrokeWidth: 2,
  portIn: '#243446',
  portOut: '#5db4ff',
  portRadius: 7,
  gridColor: '#161d27',
  gridMajorColor: '#1f2a37',
  gridStep: 40,
  gridMajorEvery: 5,
  textBright: '#eef2f8',
  textDim: '#7d8a9a',
  deleteBg: '#0a0f17',
  radiusMd: 8,
  tileWidth: 160,
  tileHeight: 64,
};
