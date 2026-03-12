/**
 * Accessibility Mirror — reads the desktop accessibility tree via AT-SPI2
 * and renders it as a live React component hierarchy.
 *
 * Polls the tree and diffs against previous state — only damaged nodes update.
 * Expand/collapse state is preserved across polls.
 *
 * Requires: /usr/bin/python3 tools/a11y_server.py running on port 9876
 */

import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useAPI, useAPIMutation } from '../../../packages/apis/src/base';

// ── Palette ──────────────────────────────────────────────

const C = {
  frame: '#3b82f6',
  panel: '#6366f1',
  menu: '#8b5cf6',
  menuItem: '#a78bfa',
  button: '#06b6d4',
  text: '#10b981',
  icon: '#f59e0b',
  input: '#ec4899',
  scrollPane: '#64748b',
  toolbar: '#0ea5e9',
  statusBar: '#14b8a6',
  separator: '#334155',
  splitPane: '#7c3aed',
  treeTable: '#059669',
  layeredPane: '#d97706',
  toggleButton: '#0891b2',
  filler: '#475569',
  slider: '#e11d48',
  unknown: '#64748b',
};

const ROLE_COLORS: Record<string, string> = {
  'application': C.frame,
  'frame': C.frame,
  'panel': C.panel,
  'menu': C.menu,
  'menu item': C.menuItem,
  'menu bar': C.menu,
  'button': C.button,
  'push button': C.button,
  'toggle button': C.toggleButton,
  'text': C.text,
  'label': C.text,
  'icon': C.icon,
  'text field': C.input,
  'scroll pane': C.scrollPane,
  'scroll bar': C.scrollPane,
  'tool bar': C.toolbar,
  'status bar': C.statusBar,
  'separator': C.separator,
  'split pane': C.splitPane,
  'tree table': C.treeTable,
  'table cell': C.treeTable,
  'table column header': C.treeTable,
  'layered pane': C.layeredPane,
  'filler': C.filler,
  'slider': C.slider,
};

function roleColor(role: string): string {
  return ROLE_COLORS[role] || C.unknown;
}

// ── Types ────────────────────────────────────────────────

interface A11yNode {
  role: string;
  name: string;
  path: number[];
  rect: { x: number; y: number; w: number; h: number } | null;
  actions: { index: number; name: string; description: string }[];
  states: string[];
  text?: string;
  value?: { current: number; min: number; max: number };
  childCount: number;
  children?: A11yNode[];
}

interface AppInfo {
  name: string;
  windows: number;
}

// ── Stable tree merge ────────────────────────────────────
// Diff incoming tree against previous, return same reference if unchanged.
// This prevents React from re-rendering nodes that haven't changed.

function nodeFingerprint(n: A11yNode): string {
  const r = n.rect;
  return `${n.role}|${n.name}|${r ? `${r.x},${r.y},${r.w},${r.h}` : '-'}|${n.states.join(',')}|${n.childCount}|${n.text || ''}`;
}

function mergeTree(prev: A11yNode | null, next: A11yNode): A11yNode {
  if (!prev) return next;
  if (prev.role !== next.role) return next;

  const sameSelf = nodeFingerprint(prev) === nodeFingerprint(next);

  // Merge children recursively
  let mergedChildren: A11yNode[] | undefined;
  let childrenChanged = false;

  if (next.children && next.children.length > 0) {
    const prevChildren = prev.children || [];
    mergedChildren = next.children.map((nextChild, i) => {
      const prevChild = i < prevChildren.length ? prevChildren[i] : null;
      const merged = mergeTree(prevChild, nextChild);
      if (merged !== prevChild) childrenChanged = true;
      return merged;
    });
    if (mergedChildren.length !== prevChildren.length) childrenChanged = true;
  } else if (prev.children && !next.children) {
    // Next has no children data (shallow fetch) — keep previous children
    mergedChildren = prev.children;
  }

  if (sameSelf && !childrenChanged) return prev; // same reference = no re-render

  return {
    ...next,
    children: mergedChildren || next.children,
  };
}

// ── Server URL ───────────────────────────────────────────

const SERVER = 'http://127.0.0.1:9876';

// ── Components ───────────────────────────────────────────

function AppPicker({ apps, onSelect, selected }: {
  apps: AppInfo[];
  onSelect: (name: string) => void;
  selected: string | null;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
      {apps.map((app, i) => {
        const active = app.name === selected;
        return (
          <Pressable
            key={`${app.name}-${i}`}
            onPress={() => onSelect(app.name)}
            style={{
              paddingLeft: 14, paddingRight: 14,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 6,
              backgroundColor: active ? C.frame : c.surface,
              borderWidth: 1,
              borderColor: active ? C.frame : c.border,
            }}
          >
            <Text style={{ color: active ? '#fff' : c.text, fontSize: 13, fontWeight: active ? '700' : '400' }}>
              {`${app.name} (${app.windows})`}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}

/** A single node that can lazy-load its children on expand */
function LazyNode({ node, depth, appName, onAction }: {
  node: A11yNode;
  depth: number;
  appName: string;
  onAction: (path: number[], actionIndex: number) => void;
}) {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(depth < 2);
  const hasInlineChildren = node.children && node.children.length > 0;
  const hasMoreChildren = node.childCount > 0 && !hasInlineChildren;
  const expandable = hasInlineChildren || hasMoreChildren;
  const color = roleColor(node.role);
  const isContainer = node.role === 'application' || node.role === 'frame' || node.role === 'filler' || node.role === 'panel';
  const isVisible = isContainer || node.states.length === 0 || node.states.includes('visible') || node.states.includes('showing');

  return (
    <Box style={{ paddingLeft: depth > 0 ? 16 : 0, opacity: isVisible ? 1.0 : 0.4 }}>
      {/* Node header row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 2 }}>
        {/* Expand toggle */}
        {expandable ? (
          <Pressable onPress={() => setExpanded(!expanded)} style={{ paddingRight: 4 }}>
            <Text style={{ color: c.muted, fontSize: 11 }}>{expanded ? '▼' : '▶'}</Text>
          </Pressable>
        ) : (
          <Box style={{ width: 16 }} />
        )}

        {/* Role badge */}
        <Box style={{
          backgroundColor: color,
          paddingLeft: 6, paddingRight: 6,
          paddingTop: 2, paddingBottom: 2,
          borderRadius: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{node.role}</Text>
        </Box>

        {/* Name */}
        {node.name ? (
          <Text style={{ color: c.text, fontSize: 12 }}>{`"${node.name}"`}</Text>
        ) : null}

        {/* Rect */}
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {node.rect ? `${node.rect.x},${node.rect.y} ${node.rect.w}x${node.rect.h}` : 'hidden'}
        </Text>

        {/* Action buttons */}
        {node.actions.map((action, i) => (
          <Pressable
            key={`a-${i}`}
            onPress={() => onAction(node.path, action.index)}
            style={{
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              paddingLeft: 6, paddingRight: 6,
              paddingTop: 2, paddingBottom: 2,
              borderRadius: 3,
              borderWidth: 1,
              borderColor: 'rgba(6, 182, 212, 0.3)',
            }}
          >
            <Text style={{ color: C.button, fontSize: 10 }}>{action.name}</Text>
          </Pressable>
        ))}

        {/* State badges */}
        {node.states.includes('focused') ? (
          <Box style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
            <Text style={{ color: '#ef4444', fontSize: 9 }}>focused</Text>
          </Box>
        ) : null}
        {node.states.includes('selected') ? (
          <Box style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
            <Text style={{ color: '#22c55e', fontSize: 9 }}>selected</Text>
          </Box>
        ) : null}
        {node.states.includes('checked') ? (
          <Box style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
            <Text style={{ color: '#a855f7', fontSize: 9 }}>checked</Text>
          </Box>
        ) : null}
      </Box>

      {/* Text content */}
      {node.text ? (
        <Box style={{ paddingLeft: 32 }}>
          <Text style={{ color: C.text, fontSize: 11, fontStyle: 'italic' }}>{`"${node.text.slice(0, 100)}"`}</Text>
        </Box>
      ) : null}

      {/* Inline children (already fetched) */}
      {expanded && hasInlineChildren ? (
        <Box>
          {node.children!.map((child, i) => (
            <LazyNode
              key={`${child.role}-${i}`}
              node={child}
              depth={depth + 1}
              appName={appName}
              onAction={onAction}
            />
          ))}
        </Box>
      ) : null}

      {/* Lazy children (need to fetch) */}
      {expanded && hasMoreChildren ? (
        <LazyChildren appName={appName} path={node.path} depth={depth} onAction={onAction} />
      ) : null}

      {/* Collapsed indicator */}
      {!expanded && expandable ? (
        <Box style={{ paddingLeft: 32 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {hasInlineChildren
              ? `... ${node.children!.length} children`
              : `... ${node.childCount} children (click to load)`}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

/** Fetches children of a node lazily when expanded, polls and diffs */
function LazyChildren({ appName, path, depth, onAction }: {
  appName: string;
  path: number[];
  depth: number;
  onAction: (path: number[], actionIndex: number) => void;
}) {
  const c = useThemeColors();
  const pathStr = path.join(',');
  const stableRef = useRef<A11yNode | null>(null);

  const { data: rawData, loading, error } = useAPI<A11yNode>(
    `${SERVER}/subtree/${appName}?path=${pathStr}&depth=2`,
    { interval: 1500 }
  );

  // Merge incoming data with stable reference
  if (rawData) {
    stableRef.current = mergeTree(stableRef.current, rawData);
  }
  const data = stableRef.current;

  if (loading && !data) {
    return (
      <Box style={{ paddingLeft: 32 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>Loading...</Text>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box style={{ paddingLeft: 32 }}>
        <Text style={{ color: '#ef4444', fontSize: 10 }}>{`Error: ${error?.message || 'no data'}`}</Text>
      </Box>
    );
  }

  if (!data || !data.children || data.children.length === 0) {
    return (
      <Box style={{ paddingLeft: 32 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>(empty)</Text>
      </Box>
    );
  }

  return (
    <Box>
      {data.children.map((child, i) => (
        <LazyNode
          key={`${child.role}-${i}`}
          node={child}
          depth={depth + 1}
          appName={appName}
          onAction={onAction}
        />
      ))}
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

export function A11yMirrorStory() {
  const c = useThemeColors();
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const stableTreeRef = useRef<A11yNode | null>(null);

  // Fetch app list, poll every 5s
  const { data: appsData } = useAPI<{ apps: AppInfo[] }>(
    `${SERVER}/apps`,
    { interval: 5000 }
  );

  // Fetch shallow tree, poll every 3s, diff against stable ref
  const { data: rawTree, loading: treeLoading, error: treeError } = useAPI<A11yNode>(
    selectedApp ? `${SERVER}/tree/${selectedApp}?depth=3` : null,
    { interval: 1500 }
  );

  // Merge incoming tree into stable reference — only changed nodes get new references
  if (rawTree) {
    stableTreeRef.current = mergeTree(stableTreeRef.current, rawTree);
  }
  // Reset stable ref when switching apps
  const prevAppRef = useRef(selectedApp);
  if (selectedApp !== prevAppRef.current) {
    stableTreeRef.current = null;
    prevAppRef.current = selectedApp;
  }
  const treeData = stableTreeRef.current;

  // Action mutation
  const { execute: executeAction } = useAPIMutation<{ ok: boolean; action: string }>();

  const handleAction = useCallback((path: number[], actionIndex: number) => {
    if (!selectedApp) return;
    executeAction(`${SERVER}/action`, {
      method: 'POST',
      body: { app: selectedApp, path, action: actionIndex },
    });
  }, [selectedApp]);

  const apps = appsData?.apps || [];
  const serverDown = !appsData && !treeLoading;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Header */}
      <Box style={{
        paddingLeft: 20, paddingRight: 20,
        paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>Accessibility Mirror</Text>
        <Text style={{ color: c.muted, fontSize: 12, paddingTop: 4 }}>
          {`Live AT-SPI2 tree — polls every 3s, only damaged nodes update`}
        </Text>
      </Box>

      {/* Server status */}
      {serverDown ? (
        <Box style={{
          marginLeft: 20, marginRight: 20, marginTop: 12,
          paddingLeft: 16, paddingRight: 16,
          paddingTop: 12, paddingBottom: 12,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
        }}>
          <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Server not running</Text>
          <Text style={{ color: '#fca5a5', fontSize: 12, paddingTop: 4 }}>
            {`Run: /usr/bin/python3 tools/a11y_server.py`}
          </Text>
        </Box>
      ) : null}

      {/* App picker */}
      {apps.length > 0 ? (
        <Box style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 12 }}>
          <Text style={{ color: c.muted, fontSize: 11, paddingBottom: 6 }}>
            {`${apps.length} apps with windows`}
          </Text>
          <AppPicker apps={apps} onSelect={setSelectedApp} selected={selectedApp} />
        </Box>
      ) : null}

      {/* Tree view */}
      <Box style={{ flexGrow: 1 }}>
        {treeData ? (
          <ScrollView style={{ flexGrow: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 20 }}>
            <LazyNode node={treeData} depth={0} appName={selectedApp!} onAction={handleAction} />
          </ScrollView>
        ) : treeLoading ? (
          <Box style={{ padding: 20 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Loading tree...</Text>
          </Box>
        ) : selectedApp ? (
          <Box style={{ padding: 20 }}>
            <Text style={{ color: '#ef4444', fontSize: 13 }}>{`Error: ${treeError?.message || 'Failed to load tree'}`}</Text>
          </Box>
        ) : (
          <Box style={{ padding: 20 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Select an app above to see its accessibility tree</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
