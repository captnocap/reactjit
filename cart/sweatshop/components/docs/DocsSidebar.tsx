const React: any = require('react');
const { useEffect, useMemo, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import type { DocsFileRecord, DocsIndex, DocsTreeNode } from './hooks/useDocsIndex';
import { DocsSearch } from './DocsSearch';

function matchesNode(node: DocsTreeNode, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (node.kind === 'file') {
    return node.path.toLowerCase().includes(needle) || node.name.toLowerCase().includes(needle) || String(node.file?.title || '').toLowerCase().includes(needle);
  }
  return node.name.toLowerCase().includes(needle) || node.children.some((child) => matchesNode(child, needle));
}

function ancestorPaths(path: string): string[] {
  const parts = String(path || '').split('/').filter(Boolean);
  const out: string[] = [];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    out.push(acc);
  }
  return out;
}

function TreeRow(props: {
  node: DocsTreeNode;
  depth: number;
  selectedPath: string;
  openMap: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  filter: string;
}) {
  const selected = props.node.kind === 'file' && props.node.path === props.selectedPath;
  const forcedOpen = props.filter.trim().length > 0;
  const open = forcedOpen || !!props.openMap[props.node.path];

  if (!matchesNode(props.node, props.filter)) return null;

  if (props.node.kind === 'file') {
    return (
      <Pressable onPress={() => props.onSelect(props.node.path)}>
        <Box style={{ marginLeft: props.depth * 12, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: selected ? COLORS.blueDeep : 'transparent' }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Icon name="file" size={11} color={selected ? COLORS.blue : COLORS.textDim} />
            <Text fontSize={10} color={selected ? COLORS.blue : COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, fontWeight: selected ? 'bold' : 'normal' }}>{props.node.name}</Text>
          </Row>
          <Text fontSize={8} color={COLORS.textDim} style={{ marginLeft: 17, fontFamily: TOKENS.fontMono }}>{props.node.path}</Text>
        </Box>
      </Pressable>
    );
  }

  const visibleChildren = props.node.children.filter((child) => matchesNode(child, props.filter));
  if (visibleChildren.length === 0) return null;

  return (
    <Col style={{ gap: 2 }}>
      <Pressable onPress={() => props.onToggle(props.node.path)}>
        <Box style={{ marginLeft: props.depth * 12, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, backgroundColor: open ? COLORS.panelAlt : 'transparent' }}>
          <Row style={{ alignItems: 'center', gap: 6 }}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={10} color={COLORS.textDim} />
            <Icon name="folder" size={11} color={COLORS.blue} />
            <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>{props.node.name}</Text>
          </Row>
        </Box>
      </Pressable>
      {open ? props.node.children.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          depth={props.depth + 1}
          selectedPath={props.selectedPath}
          openMap={props.openMap}
          onToggle={props.onToggle}
          onSelect={props.onSelect}
          filter={props.filter}
        />
      )) : null}
    </Col>
  );
}

export function DocsSidebar(props: {
  index: DocsIndex;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const path of ancestorPaths(props.selectedPath)) next[path] = true;
    setOpenMap((prev) => ({ ...prev, ...next }));
  }, [props.selectedPath]);

  const results = useMemo(() => props.index.search(query, 20), [props.index, query]);
  const count = props.index.files.length;

  const toggle = (path: string) => setOpenMap((prev) => ({ ...prev, [path]: !prev[path] }));

  return (
    <Col style={{ width: 360, minWidth: 320, maxWidth: 420, height: '100%', minHeight: 0, borderRightWidth: 1, borderRightColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
      <Col style={{ gap: 6, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Col style={{ gap: 2 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Docs</Text>
            <Text fontSize={9} color={COLORS.textDim}>{count} markdown files · live scan every 5s</Text>
          </Col>
          <Pressable onPress={props.index.refresh}>
            <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Icon name="refresh" size={11} color={COLORS.blue} />
              <Text fontSize={9} color={COLORS.text}>refresh</Text>
            </Box>
          </Pressable>
        </Row>
      </Col>

      <DocsSearch query={query} onQueryChange={setQuery} results={results} onOpenPath={props.onSelectPath} />

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ gap: 4, padding: 10 }}>
          {props.index.tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              selectedPath={props.selectedPath}
              openMap={openMap}
              onToggle={toggle}
              onSelect={props.onSelectPath}
              filter={query}
            />
          ))}
          {props.index.tree.length === 0 ? <Text fontSize={10} color={COLORS.textDim}>No markdown files found.</Text> : null}
        </Col>
      </ScrollView>
    </Col>
  );
}

export default DocsSidebar;
