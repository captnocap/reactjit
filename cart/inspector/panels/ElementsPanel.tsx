import { Row } from '@reactjit/runtime/primitives';
import { InspectorNode, NodeIndex, TreeStats } from '../types';
import { DiffMap } from '../hooks/useTreeDiff';
import TreeView from '../tree/TreeView';
import DetailPanel from '../detail/DetailPanel';

export default function ElementsPanel({
  tree,
  version,
  selectedId,
  hoverId,
  collapsed,
  search,
  telemetry,
  perf,
  index,
  diff,
  edit,
  draft,
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
  onEdit,
  onCloseDetail,
  onDraftChange,
  onApplyEdit,
  onDeleteProp,
  onDeleteStyle,
}: {
  tree: InspectorNode[];
  version: number;
  selectedId: number;
  hoverId: number;
  collapsed: Record<number, boolean>;
  search: string;
  telemetry: TreeStats;
  perf: { fps: number };
  index: NodeIndex;
  diff: DiffMap;
  edit: { section: 'props' | 'style'; key: string } | null;
  draft: string;
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
  onEdit: (section: 'props' | 'style', key: string) => void;
  onCloseDetail: () => void;
  onDraftChange: (v: string) => void;
  onApplyEdit: () => void;
  onDeleteProp: (key: string) => void;
  onDeleteStyle: (key: string) => void;
}) {
  const selected = selectedId ? index.get(selectedId) || null : null;

  return (
    <Row style={{ flexGrow: 1 }}>
      <TreeView
        tree={tree}
        version={version}
        selectedId={selectedId}
        hoverId={hoverId}
        collapsed={collapsed}
        search={search}
        telemetry={telemetry}
        perf={perf}
        diff={diff}
        showTreeDiff={showTreeDiff}
        showGuideGutters={showGuideGutters}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
        onHover={onHover}
        onUnhover={onUnhover}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        onExpandIds={onExpandIds}
        onSearchChange={onSearchChange}
      />
      <DetailPanel
        selected={selected}
        index={index}
        telemetry={telemetry}
        perf={perf}
        edit={edit}
        draft={draft}
        onSelect={onSelect}
        onEdit={onEdit}
        onClose={onCloseDetail}
        onDraftChange={onDraftChange}
        onApplyEdit={onApplyEdit}
        onDeleteProp={onDeleteProp}
        onDeleteStyle={onDeleteStyle}
      />
    </Row>
  );
}
