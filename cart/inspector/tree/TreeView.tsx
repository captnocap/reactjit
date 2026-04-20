import { useState, useMemo, useEffect } from 'react';
import { Box, Col, Row, Text, Pressable, ScrollView, TextInput } from '../../../runtime/primitives';
import { InspectorNode, TreeStats } from '../types';
import { COLORS, TREE_INDENT } from '../constants';
import { DiffMap } from '../hooks/useTreeDiff';
import NodeRow from './NodeRow';

function filterMatches(node: InspectorNode, q: string): boolean {
  if (!q) return true;
  const source = `${node.type} ${node.debugName ?? ''} ${node.id}`.toLowerCase();
  if (source.includes(q)) return true;
  try {
    const propText = JSON.stringify(node.props || {}).toLowerCase();
    return propText.includes(q);
  } catch {
    return false;
  }
}

function renderTreeNode(
  node: InspectorNode,
  depth: number,
  version: number,
  collapsed: Record<number, boolean>,
  selectedId: number,
  hoverId: number,
  search: string,
  diff: DiffMap,
  showTreeDiff: boolean,
  showGuideGutters: boolean,
  onlyChanged: boolean,
  typeFilter: string | null,
  onSelect: (id: number) => void,
  onToggleExpand: (id: number) => void,
  onHover: (id: number) => void,
  onUnhover: () => void
): any[] {
  const isCollapsed = !!collapsed[node.id];
  const out: any[] = [];
  const matches = filterMatches(node, search.trim().toLowerCase());
  const changed = diff.get(node.id);
  const typeMatch = !typeFilter || node.type === typeFilter;
  const show = matches && (!onlyChanged || !!changed) && typeMatch;

  const guides: any[] = [];
  if (showGuideGutters) {
    for (let i = 0; i < depth; i++) {
      guides.push(
        <Box
          key={`g-${i}`}
          style={{
            width: TREE_INDENT,
            alignSelf: 'stretch',
            borderRightWidth: 1,
            borderColor: COLORS.guide,
          }}
        />
      );
    }
  } else if (depth > 0) {
    guides.push(
      <Box
        key="pad"
        style={{ width: depth * TREE_INDENT }}
      />
    );
  }

  if (show) {
    out.push(
      <Row key={`row-${node.id}-${version}`} style={{ alignItems: 'center' }}>
        {guides}
        <Box style={{ flexGrow: 1 }}>
          <NodeRow
            node={node}
            depth={0}
            selected={selectedId === node.id}
            hover={hoverId === node.id}
            collapsed={isCollapsed}
            diff={showTreeDiff ? changed || null : null}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
            onHover={onHover}
            onUnhover={onUnhover}
          />
        </Box>
      </Row>
    );
  }

  if (!isCollapsed && node.children.length > 0) {
    for (const c of node.children) {
      out.push(
        ...renderTreeNode(
          c,
          depth + 1,
          version,
          collapsed,
          selectedId,
          hoverId,
          search,
          diff,
          showTreeDiff,
          showGuideGutters,
          onlyChanged,
          typeFilter,
          onSelect,
          onToggleExpand,
          onHover,
          onUnhover
        )
      );
    }
  }

  return out;
}

const NODE_TYPES = ['View', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput', 'TextEditor'];

export default function TreeView({
  tree,
  version,
  selectedId,
  hoverId,
  collapsed,
  search,
  telemetry,
  perf,
  diff,
  showTreeDiff,
  showGuideGutters,
  onSelect,
  onToggleExpand,
  onHover,
  onUnhover,
  onExpandAll,
  onCollapseAll,
  onExpandIds,
  onSearchChange,
}: {
  tree: InspectorNode[];
  version: number;
  selectedId: number;
  hoverId: number;
  collapsed: Record<number, boolean>;
  search: string;
  telemetry: TreeStats;
  perf: { fps: number };
  diff: DiffMap;
  showTreeDiff: boolean;
  showGuideGutters: boolean;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onHover: (id: number) => void;
  onUnhover: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onExpandIds: (ids: number[]) => void;
  onSearchChange: (v: string) => void;
}) {
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      tree.flatMap((node) =>
        renderTreeNode(
          node,
          0,
          version,
          collapsed,
          selectedId,
          hoverId,
          search,
          diff,
          showTreeDiff,
          showGuideGutters,
          onlyChanged,
          typeFilter,
          onSelect,
          onToggleExpand,
          onHover,
          onUnhover
        )
      ),
    [tree, version, collapsed, selectedId, hoverId, search, diff, showTreeDiff, showGuideGutters, onlyChanged, typeFilter]
  );

  // Auto-expand ancestors of search matches
  useEffect(() => {
    if (!search.trim()) return;
    const toExpand = new Set<number>();
    const traverse = (nodes: InspectorNode[], ancestorIds: number[]) => {
      for (const n of nodes) {
        if (filterMatches(n, search.trim().toLowerCase())) {
          for (const id of ancestorIds) {
            toExpand.add(id);
          }
        }
        if (n.children.length) {
          traverse(n.children, [...ancestorIds, n.id]);
        }
      }
    };
    traverse(tree, []);
    if (toExpand.size > 0) {
      onExpandIds(Array.from(toExpand));
    }
  }, [search, tree, onExpandIds]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const visibleIds: number[] = [];
      const collect = (nodes: InspectorNode[]) => {
        for (const n of nodes) {
          const matches = filterMatches(n, search.trim().toLowerCase());
          const changed = diff.get(n.id);
          const typeMatch = !typeFilter || n.type === typeFilter;
          const show = matches && (!onlyChanged || !!changed) && typeMatch;
          if (show) visibleIds.push(n.id);
          if (!collapsed[n.id] && n.children.length > 0) {
            collect(n.children);
          }
        }
      };
      collect(tree);

      const idx = visibleIds.indexOf(selectedId);
      if (e.key === 'ArrowDown' && idx >= 0 && idx < visibleIds.length - 1) {
        e.preventDefault();
        onSelect(visibleIds[idx + 1]);
      } else if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault();
        onSelect(visibleIds[idx - 1]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = tree.flatMap((t) => {
          const all: InspectorNode[] = [t];
          const stack = [...t.children];
          while (stack.length) {
            const x = stack.pop()!;
            all.push(x);
            for (const c of x.children) stack.push(c);
          }
          return all;
        }).find((n) => n.id === selectedId);
        if (n && n.children.length > 0 && !collapsed[n.id]) {
          onToggleExpand(n.id);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const n = tree.flatMap((t) => {
          const all: InspectorNode[] = [t];
          const stack = [...t.children];
          while (stack.length) {
            const x = stack.pop()!;
            all.push(x);
            for (const c of x.children) stack.push(c);
          }
          return all;
        }).find((n) => n.id === selectedId);
        if (n && n.children.length > 0 && collapsed[n.id]) {
          onToggleExpand(n.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tree, selectedId, collapsed, search, diff, onlyChanged, typeFilter, onSelect, onToggleExpand]);

  return (
    <Col
      style={{
        width: 340,
        backgroundColor: COLORS.bgPanel,
        borderRightWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      {/* Header */}
      <Row
        style={{
          padding: 10,
          paddingBottom: 8,
          gap: 8,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          Elements
        </Text>
        <Row style={{ marginLeft: 'auto', gap: 4 }}>
          <Pressable
            onPress={() => setOnlyChanged((v) => !v)}
            style={{
              backgroundColor: onlyChanged ? COLORS.bgSelected : COLORS.bgElevated,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderWidth: 1,
              borderColor: onlyChanged ? COLORS.accentLight : COLORS.border,
            }}
          >
            <Text fontSize={8} color={onlyChanged ? COLORS.accentLight : COLORS.textDim}>Δ</Text>
          </Pressable>
          <Pressable
            onPress={onExpandAll}
            style={{
              backgroundColor: COLORS.bgElevated,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text fontSize={8} color={COLORS.textDim}>expand</Text>
          </Pressable>
          <Pressable
            onPress={onCollapseAll}
            style={{
              backgroundColor: COLORS.bgElevated,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text fontSize={8} color={COLORS.textDim}>collapse</Text>
          </Pressable>
        </Row>
      </Row>

      {/* Type filter chips */}
      <Row
        style={{
          padding: 6,
          paddingLeft: 8,
          gap: 4,
          borderBottomWidth: 1,
          borderColor: COLORS.border,
          flexWrap: 'wrap',
        }}
      >
        <Pressable
          onPress={() => setTypeFilter(null)}
          style={{
            backgroundColor: typeFilter === null ? COLORS.bgSelected : COLORS.bgElevated,
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            borderWidth: 1,
            borderColor: typeFilter === null ? COLORS.accentLight : COLORS.border,
          }}
        >
          <Text fontSize={8} color={typeFilter === null ? COLORS.accentLight : COLORS.textDim}>all</Text>
        </Pressable>
        {NODE_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTypeFilter(typeFilter === t ? null : t)}
            style={{
              backgroundColor: typeFilter === t ? COLORS.bgSelected : COLORS.bgElevated,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderWidth: 1,
              borderColor: typeFilter === t ? COLORS.accentLight : COLORS.border,
            }}
          >
            <Text fontSize={8} color={typeFilter === t ? COLORS.accentLight : COLORS.textDim}>{t}</Text>
          </Pressable>
        ))}
      </Row>

      {/* Search */}
      <Box style={{ padding: 8, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: COLORS.border }}>
        <TextInput
          value={search}
          placeholder="Filter nodes…"
          style={{
            height: 26,
            backgroundColor: COLORS.bg,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingLeft: 8,
            paddingRight: 8,
            fontSize: 11,
          }}
          onChangeText={onSearchChange}
        />
      </Box>

      {/* Tree rows */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Col style={{ gap: 0 }}>
          {rows.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim} style={{ padding: 12 }}>
              No render nodes match.
            </Text>
          ) : (
            rows
          )}
        </Col>
      </ScrollView>

      {/* Status bar */}
      <Row
        style={{
          padding: 6,
          paddingLeft: 10,
          paddingRight: 10,
          gap: 10,
          borderTopWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgElevated,
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>{telemetry.total} nodes</Text>
        <Text fontSize={9} color={COLORS.textDim}>{telemetry.visible} visible</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={perf.fps >= 55 ? COLORS.green : perf.fps >= 30 ? COLORS.yellow : COLORS.red}>
          {perf.fps} fps
        </Text>
      </Row>
    </Col>
  );
}
