const React: any = require('react');
const { useState, useCallback, useEffect } = React;

import { Box, Col, Row } from '../../../../runtime/primitives';
import type { SplitNode } from './SplitLayoutEngine';
import { createPane, splitNode, removeNode, updatePaneFilePath, resizeSplit, flattenPanes } from './SplitLayoutEngine';
import { useSplitFocus } from './useSplitFocus';
import { useSplitPersist } from './useSplitPersist';
import { SplitPane } from './SplitPane';
import { SplitDivider } from './SplitDivider';

interface SplitEditorHostProps {
  initialTree?: SplitNode;
  minPaneSize?: number;
  dividerThickness?: number;
  showPaneIndex?: boolean;
  renderEditor: (filePath: string | null) => React.ReactNode;
}

export function SplitEditorHost(props: SplitEditorHostProps) {
  const [tree, setTree] = useState<SplitNode>(props.initialTree || createPane());
  const { focusedPane, setFocusedPane, cycleFocus } = useSplitFocus(tree);
  const { saveLayout, loadLayout } = useSplitPersist();

  useEffect(() => {
    const saved = loadLayout();
    if (saved) setTree(saved);
  }, [loadLayout]);

  useEffect(() => {
    saveLayout(tree);
  }, [tree, saveLayout]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '1') { e.preventDefault(); cycleFocus(-1); }
      if (e.ctrlKey && e.key === '2') { e.preventDefault(); cycleFocus(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycleFocus]);

  const handleSplit = useCallback((paneId: string, direction: 'horizontal' | 'vertical') => {
    setTree((t) => splitNode(t, paneId, direction));
  }, []);

  const handleClose = useCallback((paneId: string) => {
    setTree((t) => removeNode(t, paneId) || createPane());
  }, []);

  const handleFileChange = useCallback((paneId: string, filePath: string | null) => {
    setTree((t) => updatePaneFilePath(t, paneId, filePath));
  }, []);

  const handleResize = useCallback((splitId: string, deltaWeight: number) => {
    setTree((t) => resizeSplit(t, splitId, deltaWeight));
  }, []);

  const allPanes = flattenPanes(tree);
  const minSize = props.minPaneSize ?? 120;

  function renderNode(node: SplitNode): React.ReactNode {
    if (node.type === 'pane') {
      const paneIndex = allPanes.findIndex((p) => p.id === node.id);
      return (
        <SplitPane
          key={node.id}
          pane={node}
          focused={focusedPane === node.id}
          paneIndex={paneIndex}
          showIndex={props.showPaneIndex ?? false}
          onFocus={() => setFocusedPane(node.id)}
          onClose={() => handleClose(node.id)}
          onSplit={(dir) => handleSplit(node.id, dir)}
          onFileChange={(path) => handleFileChange(node.id, path)}
          renderEditor={props.renderEditor}
        />
      );
    }
    const [first, second] = node.children;
    const isHorizontal = node.direction === 'horizontal';
    const Container = isHorizontal ? Row : Col;
    return (
      <Container key={node.id} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: minSize, minHeight: minSize }}>
        <Box style={{ flexGrow: node.weights[0], flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          {renderNode(first)}
        </Box>
        <SplitDivider direction={node.direction} thickness={props.dividerThickness ?? 4} onResize={(d) => handleResize(node.id, d)} />
        <Box style={{ flexGrow: node.weights[1], flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          {renderNode(second)}
        </Box>
      </Container>
    );
  }

  return <Box style={{ width: '100%', height: '100%', position: 'relative' }}>{renderNode(tree)}</Box>;
}
