// =============================================================================
// TreeView — indented list of the live React tree
// =============================================================================
// Uses useNodeGraph for a live snapshot and renders TreeRow per node inside a
// ScrollView. I picked the indented-list representation over Canvas.Node
// because cursor-ide-scale trees (hundreds of nodes) render more predictably
// as a flat virtualisable list than as a spatial canvas — the node graph
// already encodes depth per row.
//
// Header offers a text filter (matches against type / id / propsSummary) and
// a node count. Selecting a row drives the shared inspector store so
// PropEditor (and future subscribers) can key off selectedNodeId.
// =============================================================================

const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import { TreeRow } from './TreeRow';
import { useNodeGraph } from './useNodeGraph';
import { useInspectorStore, setSelectedNodeId } from './useInspectorStore';

interface TreeViewProps {
  pollPaused?: boolean;
  filter?: string;
  onFilterChange?: (v: string) => void;
}

export function TreeView(props: TreeViewProps) {
  const store = useInspectorStore();
  const { snapshot } = useNodeGraph(props.pollPaused ? 0 : 500);

  const filter = (props.filter || '').toLowerCase();
  const filtered = useMemo(() => {
    if (!filter) return snapshot.nodes;
    return snapshot.nodes.filter((n) => {
      const hay = (n.type + ' #' + n.id + ' ' + n.propsSummary).toLowerCase();
      return hay.indexOf(filter) >= 0;
    });
  }, [snapshot.nodes, filter]);

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 8 }}>
      <Row style={{
        alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 8, borderRadius: TOKENS.radiusSm,
        borderWidth: 1, borderColor: COLORS.border,
        backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Tree</Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {snapshot.nodes.length} node{snapshot.nodes.length === 1 ? '' : 's'} · {snapshot.rootIds.length} root
          {props.pollPaused ? ' · frozen' : ''}
        </Text>
        {filtered.length !== snapshot.nodes.length ? (
          <Text fontSize={10} color={COLORS.blue}>{filtered.length} match</Text>
        ) : null}
        <Box style={{ flexGrow: 1 }} />
        <TextInput
          value={props.filter || ''}
          onChangeText={props.onFilterChange || (() => {})}
          placeholder="Filter by type / id / prop…"
          style={{
            flexBasis: 200, flexShrink: 1, flexGrow: 1, minWidth: 140, height: 28,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
          }}
        />
        {store.selectedNodeId !== null ? (
          <Pressable onPress={() => setSelectedNodeId(null)} style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border,
            backgroundColor: COLORS.panelAlt,
          }}>
            <Text fontSize={10} color={COLORS.textDim}>deselect</Text>
          </Pressable>
        ) : null}
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
        <Col style={{ gap: 2, padding: 4 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 14, alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>
                {snapshot.nodes.length === 0 ? 'No nodes rendered yet.' : `No nodes match "${props.filter}".`}
              </Text>
            </Box>
          ) : null}
          {filtered.map((node) => (
            <TreeRow key={node.id} node={node}
              selected={store.selectedNodeId === node.id}
              onSelect={setSelectedNodeId} />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
