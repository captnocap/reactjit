import { useMemo, useState } from 'react';
import { Box, Col, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { DexBreadcrumbs } from '../dex-breadcrumbs/DexBreadcrumbs';
import { DEX_COLORS, DexFrame } from '../dex-frame/DexFrame';
import { DexSearchBar } from '../dex-search-bar/DexSearchBar';
import { DexTreeRow, type DexTreeRowProps } from '../dex-tree-row/DexTreeRow';

export type DexTreeExplorerProps = {
  width?: number;
};

type TreeItem = DexTreeRowProps & {
  id: string;
  parent?: string;
  crumb: Array<string | number>;
};

const rows: TreeItem[] = [
  { id: 'root', depth: 0, label: 'root', value: 'object · 8', type: 'object', container: true, open: true, crumb: ['root'] },
  { id: 'supervisor', parent: 'root', depth: 1, label: 'supervisor', value: 'object · 3', type: 'object', container: true, open: true, crumb: ['root', 'supervisor'] },
  { id: 'supervisor.model', parent: 'supervisor', depth: 2, label: 'model', value: '"claude-haiku-4.5"', type: 'string', crumb: ['root', 'supervisor', 'model'] },
  { id: 'supervisor.budget', parent: 'supervisor', depth: 2, label: 'budget', value: 'object · 2', type: 'object', container: true, crumb: ['root', 'supervisor', 'budget'] },
  { id: 'workers', parent: 'root', depth: 1, label: 'workers', value: 'array · 5', type: 'array', container: true, open: true, crumb: ['root', 'workers'] },
  { id: 'workers.0', parent: 'workers', depth: 2, label: '[0]', value: 'planner · 0.82', type: 'object', crumb: ['root', 'workers', 0] },
  { id: 'workers.2', parent: 'workers', depth: 2, label: '[2]', value: 'impl · stuck', type: 'object', edited: true, crumb: ['root', 'workers', 2] },
  { id: 'flags', parent: 'root', depth: 1, label: 'flags', value: 'object · 4', type: 'object', container: true, crumb: ['root', 'flags'] },
  { id: 'flags.ratchet', parent: 'flags', depth: 2, label: 'ratchet', value: 'true', type: 'boolean', crumb: ['root', 'flags', 'ratchet'] },
  { id: 'flags.debug', parent: 'flags', depth: 2, label: 'debug', value: 'null', type: 'null', crumb: ['root', 'flags', 'debug'] },
];

function MiniMap() {
  return (
    <Col style={{ width: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: DEX_COLORS.bg1 }}>
      {[18, 34, 58, 22, 84, 48, 36, 70, 24, 50].map((height, index) => (
        <Box
          key={index}
          style={{
            height: 3,
            width: 2 + height / 14,
            marginBottom: 3,
            backgroundColor: index === 5 ? DEX_COLORS.accent : DEX_COLORS.ruleBright,
            opacity: 0.35 + height / 160,
          }}
        />
      ))}
    </Col>
  );
}

export function DexTreeExplorer({ width = 468 }: DexTreeExplorerProps) {
  const [selectedId, setSelectedId] = useState('workers.0');
  const [collapsed, setCollapsed] = useState(() => new Set<string>(['supervisor.budget', 'flags']));

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      let parent = row.parent;
      while (parent) {
        if (collapsed.has(parent)) return false;
        parent = rows.find((candidate) => candidate.id === parent)?.parent;
      }
      return true;
    });
  }, [collapsed]);

  const selected = rows.find((row) => row.id === selectedId) || rows[0];

  return (
    <DexFrame
      id="A.1"
      title="tree · run_config"
      width={width}
      height={300}
      right={
        <Row style={{ gap: 6 }}>
          <Text style={{ color: DEX_COLORS.accent, borderWidth: 1, borderColor: DEX_COLORS.ruleBright, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>TYPES</Text>
          <Text style={{ color: DEX_COLORS.inkDimmer, borderWidth: 1, borderColor: DEX_COLORS.rule, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>CLEAN</Text>
        </Row>
      }
      footer={
        <Row style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <DexBreadcrumbs items={selected.crumb} />
          <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>CLICK · SELECT / TOGGLE</Text>
        </Row>
      }
    >
      <DexSearchBar value="" count="8/42" placeholder="filter keys / values" />
      <Row style={{ flex: 1, minHeight: 0 }}>
      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          {visibleRows.map((row) => (
            <DexTreeRow
              key={row.id}
              {...row}
              selected={row.id === selectedId}
              open={row.container ? !collapsed.has(row.id) : false}
              onPress={() => {
                setSelectedId(row.id);
                if (row.container) {
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.id)) next.delete(row.id);
                    else next.add(row.id);
                    return next;
                  });
                }
              }}
            />
          ))}
        </ScrollView>
        <MiniMap />
      </Row>
    </DexFrame>
  );
}
