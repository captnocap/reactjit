const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS, baseName } from '../../theme';
import { Icon } from '../icons';
import { GraphCanvas } from './GraphCanvas';
import { GraphControls, type GraphLayoutMode } from './GraphControls';
import { GraphLegend } from './GraphLegend';
import { useImportGraph } from './useImportGraph';

export function GraphPanel(props: {
  currentFilePath: string;
  currentSource: string;
  workDir?: string;
  widthBand?: string;
  onOpenPath: (path: string) => void;
  onClose?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<GraphLayoutMode>('tree');
  const [filterExt, setFilterExt] = useState('all');
  const graph = useImportGraph(props.currentFilePath, props.currentSource, 2);
  const title = useMemo(() => {
    if (!props.currentFilePath || props.currentFilePath === '__landing__') return 'Workspace';
    if (props.currentFilePath === '__settings__') return 'Settings';
    return baseName(props.currentFilePath) || props.currentFilePath;
  }, [props.currentFilePath]);

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Icon name="git-branch" size={12} color={COLORS.blue} />
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Dependency Graph</Text>
          </Row>
          <Text fontSize={10} color={COLORS.textDim}>
            {title} {props.workDir ? '· ' + props.workDir : ''}
          </Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      <GraphControls
        zoom={zoom}
        layout={layout}
        filterExt={filterExt}
        extOptions={graph.extOptions}
        onZoomChange={setZoom}
        onLayoutChange={setLayout}
        onFilterChange={setFilterExt}
        onReset={() => { setZoom(1); setLayout('tree'); setFilterExt('all'); }}
      />

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <GraphCanvas graph={graph} layout={layout} zoom={zoom} filterExt={filterExt} onOpenPath={props.onOpenPath} />
      </Box>

      <GraphLegend nodes={graph.nodes} filterExt={filterExt} onFilterChange={setFilterExt} />
    </Col>
  );
}
