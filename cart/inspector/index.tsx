import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Col, Row, Text, Pressable } from '../../runtime/primitives';
import { InspectorNode, MainTab, NodeIndex } from './types';
import { COLORS } from './constants';
import { coerceHostId } from './utils';
import { setNodeDim, resetNodeDim, sendUpdate } from './bridge';
import { installConsoleCapture } from './capture/console';
import { installNetworkCapture } from './capture/network';
import { getRootInstances } from '../../renderer/hostConfig';
import { usePerfPoller } from './hooks/usePerfPoller';
import { InspectorProvider, useInspectorSettings } from './InspectorContext';
import { useTreeDiff } from './hooks/useTreeDiff';
import TabButton from './components/TabButton';
import ShortcutsHelp from './components/ShortcutsHelp';
import ElementsPanel from './panels/ElementsPanel';
import ConsolePanel from './panels/ConsolePanel';
import NetworkPanel from './panels/NetworkPanel';
import PerformancePanel from './panels/PerformancePanel';
import MemoryPanel from './panels/MemoryPanel';
import HostPanel from './panels/HostPanel';
import SettingsPanel from './panels/SettingsPanel';

// Self-inspection note: when the Inspector is the whole app, auto-installing
// network capture creates a feedback loop — every flush becomes a NetworkPanel
// entry, which triggers a re-render, which emits more flushes. Gated off
// until we land overlay mode (inspector observing a separate app root) OR a
// manual "start capture" toggle.
const AUTO_CAPTURE = false;
if (AUTO_CAPTURE) {
  installConsoleCapture();
  installNetworkCapture();
}

function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

// Sentinel tagged on the inspector's root Box. Any node carrying this debugName
// (and its entire subtree) is filtered out of the snapshot — otherwise the
// inspector inspects itself, which compounds tree size every tick and OOMs QJS.
// When the inspector is the ONLY thing mounted, this yields an empty tree (as
// it should — nothing else to inspect). Overlay mode (dual React roots) fixes
// the empty state once we land it.
const INSPECTOR_ROOT_SENTINEL = '__inspector_root__';

function normalizeChildren(
  child: any,
  parentId: number,
  path: number[]
): { node: InspectorNode | null; nodes: InspectorNode[] } {
  if (!child) return { node: null, nodes: [] };
  if (typeof child.id !== 'number') return { node: null, nodes: [] };

  // Stop recursion at the inspector's own root.
  if (child.props?.debugName === INSPECTOR_ROOT_SENTINEL) {
    return { node: null, nodes: [] };
  }

  if (child.text !== undefined && Object.keys(child).length <= 2 && !child.type) {
    const textNode: InspectorNode = {
      id: child.id,
      type: 'TextNode',
      props: { text: child.text },
      style: null,
      children: [],
      parentId,
      path,
      handlers: [],
      renderCount: 0,
    };
    return { node: textNode, nodes: [textNode] };
  }

  const runtime = child as any;
  const props = runtime.props ? { ...runtime.props } : {};
  const children = (runtime.children || [])
    .map((c: any, idx: number) => normalizeChildren(c, runtime.id, [...path, runtime.id, idx]).node)
    .filter(Boolean) as InspectorNode[];

  const style = isPlainObject(props.style) ? { ...props.style } : null;
  const node: InspectorNode = {
    id: runtime.id,
    type: runtime.type || 'Unknown',
    renderCount: runtime.renderCount,
    debugName: runtime.debugName ?? null,
    debugSource: runtime.debugSource,
    handlers: Object.keys(runtime.handlers || {}),
    props,
    style,
    children,
    parentId,
    path,
  };

  const nodes = [node];
  const stack = [...children];
  while (stack.length) {
    const n = stack.pop()!;
    nodes.push(n);
    for (const c of n.children) stack.push(c);
  }
  return { node, nodes };
}

function buildTree(): InspectorNode[] {
  const roots = getRootInstances() || [];
  const out: InspectorNode[] = [];
  for (let i = 0; i < roots.length; i++) {
    const normalized = normalizeChildren(roots[i], 0, [i]);
    if (normalized.node) out.push(normalized.node);
  }
  return out;
}

function buildNodeIndex(nodes: InspectorNode[]): NodeIndex {
  const index = new Map<number, InspectorNode>();
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    index.set(n.id, n);
    for (let i = 0; i < n.children.length; i++) stack.push(n.children[i]);
  }
  return index;
}

const TABS: MainTab[] = ['elements', 'console', 'network', 'performance', 'memory', 'host', 'settings'];

function InspectorApp() {
  const [tree, setTree] = useState<InspectorNode[]>([]);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [hoverId, setHoverId] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');
  const [mainTab, setMainTab] = useState<MainTab>('elements');
  const [edit, setEdit] = useState<{ section: 'props' | 'style'; key: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [pickMode, setPickMode] = useState(false);

  const refreshTree = useCallback(() => {
    const next = buildTree();
    setTree(next);
    setVersion((v) => v + 1);
  }, []);

  const { settings } = useInspectorSettings();
  const { perf, telemetry, history } = usePerfPoller(refreshTree, settings.pollIntervalMs);
  const index = useMemo(() => buildNodeIndex(tree), [tree]);
  const diff = useTreeDiff(tree);

  useEffect(() => {
    if (!selectedId) return;
    const dim = coerceHostId(selectedId);
    setNodeDim(dim, 0.28);
    return () => resetNodeDim();
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') {
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        setSelectedId(0);
        setEdit(null);
        return;
      }
      const key = e.key.toLowerCase();
      const map: Record<string, MainTab> = {
        '1': 'elements',
        '2': 'console',
        '3': 'network',
        '4': 'performance',
        '5': 'memory',
        '6': 'host',
        '7': 'settings',
        e: 'elements',
        c: 'console',
        n: 'network',
        p: 'performance',
        m: 'memory',
        h: 'host',
      };
      if (map[key]) {
        setMainTab(map[key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleCollapsed = (nodeId: number) => {
    setCollapsed((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsed({});

  const expandIds = useCallback((ids: number[]) => {
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        next[id] = false;
      }
      return next;
    });
  }, []);

  const collapseAll = () => {
    const next: Record<number, boolean> = {};
    index.forEach((node) => {
      if (node.children.length) next[node.id] = true;
    });
    setCollapsed(next);
  };

  const handleEdit = (section: 'props' | 'style', key: string) => {
    const n = index.get(selectedId);
    if (!n && key !== '') return;
    const value = section === 'style' ? n?.style?.[key] : n?.props[key];
    setEdit({ section, key });
    setEditDraft(value !== undefined ? String(value) : '');
  };

  const handleApplyEdit = () => {
    setEdit(null);
    setEditDraft('');
  };

  const handleDeleteProp = (key: string) => {
    const n = index.get(selectedId);
    if (!n) return;
    sendUpdate(n.id, {}, { removeKeys: [key] });
  };

  const handleDeleteStyle = (key: string) => {
    const n = index.get(selectedId);
    if (!n) return;
    sendUpdate(n.id, {}, { removeStyleKeys: [key] });
  };

  const handleHover = (id: number) => {
    setHoverId(id);
    setNodeDim(coerceHostId(id), 0.12);
  };

  const handleUnhover = () => {
    setHoverId(0);
    resetNodeDim();
  };

  const exportTree = () => {
    const payload = JSON.stringify(tree, null, 2);
    console.log('--- Inspector Tree Export ---');
    console.log(payload);
    console.log('--- End Export ---');
  };

  return (
    <Col debugName={INSPECTOR_ROOT_SENTINEL} style={{ width: '100%', height: '100%', backgroundColor: COLORS.bg, gap: 0 }}>
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      {pickMode && (
        <Row
          style={{
            backgroundColor: COLORS.bgSelected,
            padding: 6,
            paddingLeft: 10,
            gap: 8,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderColor: COLORS.accentLight,
          }}
        >
          <Text fontSize={10} color={COLORS.accentLight} style={{ fontWeight: 'bold' }}>
            Pick mode active
          </Text>
          <Text fontSize={9} color={COLORS.textMuted}>
            Click on the app to inspect a node. Press Esc to cancel.
          </Text>
          <Pressable
            onPress={() => setPickMode(false)}
            style={{ marginLeft: 'auto', backgroundColor: COLORS.bgHover, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}
          >
            <Text fontSize={9} color={COLORS.textDim}>Cancel</Text>
          </Pressable>
        </Row>
      )}

      {/* Main tab bar */}
      <Row
        style={{
          backgroundColor: COLORS.bgElevated,
          borderBottomWidth: 1,
          borderColor: COLORS.border,
          alignItems: 'center',
        }}
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab}
            label={tab.charAt(0).toUpperCase() + tab.slice(1)}
            active={mainTab === tab}
            onPress={() => setMainTab(tab)}
          />
        ))}
        <Row
          style={{
            marginLeft: 'auto',
            gap: 6,
            paddingRight: 10,
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => setPickMode((v) => !v)}
            style={{
              backgroundColor: pickMode ? COLORS.bgSelected : COLORS.bgHover,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
              borderWidth: 1,
              borderColor: pickMode ? COLORS.accentLight : COLORS.border,
            }}
          >
            <Text fontSize={9} color={pickMode ? COLORS.accentLight : COLORS.textDim}>
              {pickMode ? 'Picking…' : 'Pick'}
            </Text>
          </Pressable>
          <Pressable
            onPress={exportTree}
            style={{
              backgroundColor: COLORS.bgHover,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text fontSize={9} color={COLORS.accentLight}>Export</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowShortcuts(true)}
            style={{
              backgroundColor: COLORS.bgHover,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text fontSize={9} color={COLORS.textMuted}>?</Text>
          </Pressable>
          <Box
            style={{
              backgroundColor: COLORS.bgHover,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
            }}
          >
            <Text
              fontSize={9}
              color={perf.fps >= 55 ? COLORS.green : perf.fps >= 30 ? COLORS.yellow : COLORS.red}
            >
              {perf.fps} fps
            </Text>
          </Box>
          <Box
            style={{
              backgroundColor: COLORS.bgHover,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 3,
              paddingBottom: 3,
            }}
          >
            <Text fontSize={9} color={COLORS.textMuted}>
              {telemetry.total} nodes
            </Text>
          </Box>
        </Row>
      </Row>

      {mainTab === 'elements' && (
        <ElementsPanel
          tree={tree}
          version={version}
          selectedId={selectedId}
          hoverId={hoverId}
          collapsed={collapsed}
          search={search}
          telemetry={telemetry}
          perf={perf}
          index={index}
          diff={diff}
          edit={edit}
          draft={editDraft}
          showTreeDiff={settings.showTreeDiff}
          showGuideGutters={settings.showGuideGutters}
          onSelect={setSelectedId}
          onToggleExpand={toggleCollapsed}
          onHover={handleHover}
          onUnhover={handleUnhover}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onExpandIds={expandIds}
          onSearchChange={setSearch}
          onEdit={handleEdit}
          onCloseDetail={() => { setSelectedId(0); setEdit(null); }}
          onDraftChange={setEditDraft}
          onApplyEdit={handleApplyEdit}
          onDeleteProp={handleDeleteProp}
          onDeleteStyle={handleDeleteStyle}
        />
      )}

      {mainTab === 'console' && <ConsolePanel logLevel={settings.logLevel} />}
      {mainTab === 'network' && <NetworkPanel />}
      {mainTab === 'performance' && <PerformancePanel history={history} />}
      {mainTab === 'memory' && <MemoryPanel />}
      {mainTab === 'host' && <HostPanel />}
      {mainTab === 'settings' && <SettingsPanel />}

      {/* Settings wiring note: TreeView diff/gutters come via ElementsPanel */}

      {/* Bottom status bar */}
      <Row
        style={{
          padding: 4,
          paddingLeft: 10,
          paddingRight: 10,
          gap: 12,
          borderTopWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.bgElevated,
          alignItems: 'center',
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>
          {`layout ${perf.layoutUs}µs`}
        </Text>
        <Text fontSize={9} color={COLORS.textDim}>
          {`paint ${perf.paintUs}µs`}
        </Text>
        <Text fontSize={9} color={COLORS.textDim}>
          {`frame ${perf.frameTotalUs}µs`}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim}>
          {`${telemetry.text} text · ${telemetry.pressable} pressable · ${telemetry.scroll} scroll`}
        </Text>
      </Row>
    </Col>
  );
}

export default function Inspector() {
  return (
    <InspectorProvider>
      <InspectorApp />
    </InspectorProvider>
  );
}
