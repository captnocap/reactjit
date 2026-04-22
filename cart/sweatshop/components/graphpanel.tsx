const React: any = require('react');

import { GraphPanel } from './graph/GraphPanel';

export function GraphPanelSurface(props: {
  currentFilePath: string;
  currentSource: string;
  workDir?: string;
  widthBand?: string;
  onOpenPath: (path: string) => void;
  onClose?: () => void;
}) {
  return <GraphPanel {...props} />;
}

export default GraphPanelSurface;
