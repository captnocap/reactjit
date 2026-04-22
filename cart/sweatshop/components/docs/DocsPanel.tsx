const React: any = require('react');
const { useEffect, useMemo, useState } = React;

import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { DocsBreadcrumbs } from './DocsBreadcrumbs';
import { DocsRenderer } from './DocsRenderer';
import { DocsSidebar } from './DocsSidebar';
import { docsPreferredFile, useDocsIndex } from './hooks/useDocsIndex';
import { useDocsFile } from './hooks/useDocsFile';

function normalize(path: string): string {
  return String(path || '').replace(/^\.\//, '').replace(/\/+/g, '/');
}

export function DocsPanel() {
  const index = useDocsIndex('.');
  const initial = useMemo(() => docsPreferredFile(index.files), [index.files]);
  const [selectedPath, setSelectedPath] = useState('');

  useEffect(() => {
    if (!index.files.length) return;
    if (!selectedPath) {
      setSelectedPath(initial?.path || index.files[0].path);
      return;
    }
    const exists = index.files.some((file) => file.path === selectedPath);
    if (!exists) setSelectedPath(initial?.path || index.files[0].path);
  }, [index.files, initial, selectedPath]);

  const file = useDocsFile(selectedPath, index.revision);

  const onOpenPath = (path: string) => {
    const clean = normalize(path).split('#')[0];
    if (!clean) return;
    setSelectedPath(clean);
  };

  return (
    <Row style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <DocsSidebar index={index} selectedPath={selectedPath} onSelectPath={onOpenPath} />
      <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
        <DocsBreadcrumbs path={selectedPath} />
        <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          {file.exists ? (
            <DocsRenderer path={selectedPath} source={file.source} query="" onOpenPath={onOpenPath} />
          ) : (
            <Col style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={12} color={COLORS.textDim}>Loading docs index…</Text>
            </Col>
          )}
        </Box>
      </Col>
    </Row>
  );
}

export default DocsPanel;
