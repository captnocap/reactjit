import { useState } from 'react';
import { Col, Row, Text, Pressable, ScrollView, Box } from '@reactjit/runtime/primitives';
import { InspectorNode, DetailTab, TreeStats } from '../types';
import { COLORS } from '../constants';
import { NodeIndex } from '../types';
import Breadcrumbs from '../tree/Breadcrumbs';
import Badge from '../components/Badge';
import PropEditor from './PropEditor';
import StyleEditor from './StyleEditor';
import LayoutInfo from './LayoutInfo';
import EventList from './EventList';
import ComputedStyles from './ComputedStyles';
import TreeContext from './TreeContext';
import EditModal from './EditModal';

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'props', label: 'Properties' },
  { id: 'style', label: 'Style' },
  { id: 'computed', label: 'Computed' },
  { id: 'layout', label: 'Layout' },
  { id: 'tree', label: 'Tree' },
  { id: 'events', label: 'Events' },
];

export default function DetailPanel({
  selected,
  index,
  telemetry,
  perf,
  edit,
  draft,
  onSelect,
  onEdit,
  onClose,
  onDraftChange,
  onApplyEdit,
  onDeleteProp,
  onDeleteStyle,
}: {
  selected: InspectorNode | null;
  index: NodeIndex;
  telemetry: TreeStats;
  perf: { fps: number };
  edit: { section: 'props' | 'style'; key: string } | null;
  draft: string;
  onSelect: (id: number) => void;
  onEdit: (section: 'props' | 'style', key: string) => void;
  onClose: () => void;
  onDraftChange: (v: string) => void;
  onApplyEdit: () => void;
  onDeleteProp: (key: string) => void;
  onDeleteStyle: (key: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('props');

  const chain: InspectorNode[] = [];
  if (selected) {
    let cur: InspectorNode | undefined = selected;
    while (cur) {
      chain.unshift(cur);
      cur = index.get(cur.parentId);
    }
  }

  if (!selected) {
    return (
      <Col
        style={{
          flexGrow: 1,
          backgroundColor: COLORS.bgPanel,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Text fontSize={12} color={COLORS.textDim}>Select a node to inspect</Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {`${telemetry.total} nodes · ${telemetry.visible} visible · ${perf.fps} fps`}
        </Text>
      </Col>
    );
  }

  return (
    <Col style={{ flexGrow: 1, backgroundColor: COLORS.bgPanel, gap: 0 }}>
      {/* Header */}
      <Col
        style={{
          padding: 10,
          paddingBottom: 8,
          gap: 6,
          borderBottomWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {selected.debugName || selected.type}
            </Text>
            <Badge text={`#${selected.id}`} />
            {selected.renderCount != null && selected.renderCount > 1 ? (
              <Badge text={`${selected.renderCount} renders`} color={COLORS.red} />
            ) : null}
          </Row>
          <Row style={{ gap: 4 }}>
            <Pressable
              onPress={() => {
                const path = chain.map((n) => n.debugName || n.type).join(' > ');
                if ((globalThis as any).__copyToClipboard) {
                  (globalThis as any).__copyToClipboard(path);
                } else {
                  console.log('[copy path]', path);
                }
              }}
              style={{
                backgroundColor: COLORS.bgElevated,
                borderRadius: 4,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 2,
                paddingBottom: 2,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text fontSize={9} color={COLORS.textDim}>Copy path</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: '#5a1d1d',
                borderRadius: 4,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 2,
                paddingBottom: 2,
              }}
            >
              <Text fontSize={9} color={COLORS.red}>Close</Text>
            </Pressable>
          </Row>
        </Row>
        <Breadcrumbs node={selected} index={index} onSelect={onSelect} />
      </Col>

      {/* Tab bar */}
      <Row
        style={{
          gap: 0,
          borderBottomWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgElevated,
        }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              borderBottomWidth: tab === t.id ? 2 : 0,
              borderColor: COLORS.accentLight,
              backgroundColor: tab === t.id ? COLORS.bgPanel : 'transparent',
            }}
          >
            <Text
              fontSize={10}
              color={tab === t.id ? COLORS.textBright : COLORS.textDim}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </Row>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Col style={{ gap: 8, padding: 10 }}>
          {tab === 'props' && (
            <PropEditor
              node={selected}
              onEdit={(key) => onEdit('props', key)}
              onDelete={onDeleteProp}
              onAdd={() => onEdit('props', '')}
            />
          )}
          {tab === 'style' && (
            <StyleEditor
              node={selected}
              onEdit={(key) => onEdit('style', key)}
              onDelete={onDeleteStyle}
              onAdd={() => onEdit('style', '')}
            />
          )}
          {tab === 'computed' && <ComputedStyles node={selected} index={index} />}
          {tab === 'layout' && <LayoutInfo node={selected} index={index} />}
          {tab === 'tree' && <TreeContext node={selected} index={index} onSelect={onSelect} />}
        {tab === 'events' && <EventList node={selected} />}

          <EditModal
            edit={edit ? { nodeId: selected.id, ...edit } : null}
            selected={selected}
            draft={draft}
            onDraftChange={onDraftChange}
            onClose={onApplyEdit}
            onApply={onApplyEdit}
          />
        </Col>
      </ScrollView>
    </Col>
  );
}
