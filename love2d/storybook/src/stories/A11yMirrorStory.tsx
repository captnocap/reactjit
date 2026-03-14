/**
 * Accessibility Mirror — reads the desktop accessibility tree via AT-SPI2
 * and renders it as a live React component hierarchy.
 *
 * All data flows through Lua RPC (frame-synced in love.update).
 * No useEffect, no useAPI, no fetch() polyfill.
 *
 * Requires: /usr/bin/python3 tools/a11y_server.py running on port 9876
 */

import React, { useState, useRef } from 'react';
import { Box, Text, Pressable, ScrollView, useLuaEffect, useMount, useBridge } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

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
  truncated?: boolean;
  shownChildren?: number;
}

interface AppInfo {
  name: string;
  windows: number;
}

// ── Stable tree merge ────────────────────────────────────

function nodeFingerprint(n: A11yNode): string {
  const r = n.rect;
  return `${n.role}|${n.name}|${r ? `${r.x},${r.y},${r.w},${r.h}` : '-'}|${n.states.join(',')}|${n.childCount}|${n.text || ''}`;
}

function mergeTree(prev: A11yNode | null, next: A11yNode): A11yNode {
  if (!prev) return next;
  if (prev.role !== next.role) return next;

  const sameSelf = nodeFingerprint(prev) === nodeFingerprint(next);

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
    mergedChildren = prev.children;
  }

  if (sameSelf && !childrenChanged) return prev;

  return { ...next, children: mergedChildren || next.children };
}

// ── Mirror View ──────────────────────────────────────────

interface FlatNode {
  role: string;
  name: string;
  path: number[];
  rect: { x: number; y: number; w: number; h: number };
  actions: { index: number; name: string; description: string }[];
  states: string[];
  text?: string;
  depth: number;
}

function flattenWithRects(node: A11yNode, depth: number = 0): FlatNode[] {
  if (!node) return [];
  const result: FlatNode[] = [];
  if (node.rect && node.rect.w > 2 && node.rect.h > 2 && node.rect.x >= 0) {
    result.push({
      role: node.role,
      name: node.name,
      path: node.path,
      rect: node.rect,
      actions: node.actions,
      states: node.states,
      text: node.text,
      depth,
    });
  }
  if (node.children) {
    for (const ch of node.children) {
      if (Array.isArray(ch)) continue;
      result.push(...flattenWithRects(ch, depth + 1));
    }
  }
  return result;
}

function findFrame(tree: A11yNode): { x: number; y: number; w: number; h: number } | null {
  if (tree.role === 'frame' && tree.rect) return tree.rect;
  if (tree.children) {
    for (const ch of tree.children) {
      const r = findFrame(ch);
      if (r) return r;
    }
  }
  return tree.rect;
}

/** Renders leaf-ish nodes — the actual interactive/visible elements */
function isLeafLike(node: FlatNode): boolean {
  const LEAF_ROLES = new Set([
    'button', 'push button', 'toggle button', 'menu', 'menu item',
    'label', 'text', 'icon', 'text field', 'slider', 'status bar',
    'check menu item', 'check box', 'radio button', 'combo box',
    'page tab', 'table cell', 'table column header',
    'scroll bar', 'progress bar', 'separator',
  ]);
  return LEAF_ROLES.has(node.role);
}

/** Renders structural nodes as wireframe regions */
function isStructural(node: FlatNode): boolean {
  const STRUCTURAL = new Set([
    'frame', 'panel', 'split pane', 'scroll pane', 'tool bar',
    'menu bar', 'tree table', 'page tab list', 'info bar',
  ]);
  return STRUCTURAL.has(node.role);
}

function MirrorView({ tree, appName, onAction, selectedNode, onSelectNode }: {
  tree: A11yNode;
  appName: string;
  onAction: (path: number[], actionIndex: number) => void;
  selectedNode: FlatNode | null;
  onSelectNode: (node: FlatNode | null) => void;
}) {
  const c = useThemeColors();
  const frame = findFrame(tree);
  if (!frame) return <Text style={{ color: c.muted }}>No frame rect found</Text>;

  const allNodes = flattenWithRects(tree);
  const structural = allNodes.filter(n => isStructural(n) && !isLeafLike(n));
  const leaves = allNodes.filter(n => isLeafLike(n));
  // Sort leaves by area (largest first) so small elements render on top
  leaves.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
  // Deduplicate table cells: group by row (same Y), prefer named cell, merge widths
  const dedupedLeaves: FlatNode[] = [];
  const tableCells = leaves.filter(n => n.role === 'table cell');
  const nonCells = leaves.filter(n => n.role !== 'table cell');

  // Group table cells by row (same Y position)
  const rowMap = new Map<number, FlatNode[]>();
  for (const cell of tableCells) {
    const y = cell.rect.y;
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(cell);
  }

  // For each row, create one merged cell spanning the full row width
  for (const [, cells] of rowMap) {
    const named = cells.find(c => c.name);
    if (!named) continue;
    const minX = Math.min(...cells.map(c => c.rect.x));
    const maxX = Math.max(...cells.map(c => c.rect.x + c.rect.w));
    const h = cells[0].rect.h;
    dedupedLeaves.push({
      ...named,
      rect: { x: minX, y: cells[0].rect.y, w: maxX - minX, h },
    });
  }

  // Add non-cell leaves with basic dedup
  const seen = new Set<string>();
  for (const n of nonCells) {
    if (n.rect.w === 0 || n.rect.h === 0) continue;
    const key = `${n.rect.x},${n.rect.y},${n.rect.w},${n.rect.h}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedLeaves.push(n);
  }

  // Scale: fit frame into available viewport (use 100% width, proportional height)
  // We'll render at a fixed scale - viewport is ~800px wide typically
  const VIEWPORT_W = 700;
  const scale = VIEWPORT_W / frame.w;
  const viewH = frame.h * scale;

  const toLocal = (r: { x: number; y: number; w: number; h: number }) => ({
    left: (r.x - frame.x) * scale,
    top: (r.y - frame.y) * scale,
    width: r.w * scale,
    height: r.h * scale,
  });

  return (
    <Box style={{ flexDirection: 'row', flexGrow: 1 }}>
      {/* Mirror canvas */}
      <Box style={{ flexGrow: 1 }}>
        <ScrollView style={{ flexGrow: 1, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 20 }}>
          <Box style={{ width: VIEWPORT_W, height: viewH, backgroundColor: '#0f172a', borderRadius: 8, overflow: 'hidden' }}>
            {/* Structural wireframes */}
            {structural.map((n, i) => {
              const pos = toLocal(n.rect);
              const color = roleColor(n.role);
              return (
                <Box
                  key={`s-${i}`}
                  style={{
                    position: 'absolute',
                    left: pos.left, top: pos.top,
                    width: pos.width, height: pos.height,
                    borderWidth: 1,
                    borderColor: `${color}33`,
                  }}
                />
              );
            })}
            {/* Leaf elements */}
            {dedupedLeaves.map((n, i) => {
              const pos = toLocal(n.rect);
              const color = roleColor(n.role);
              const isSelected = selectedNode && selectedNode.path.join(',') === n.path.join(',');
              const hasAction = n.actions.length > 0;
              const label = n.name || n.text || '';
              const showLabel = label && pos.width > 20 && pos.height > 8;

              return (
                <Pressable
                  key={`l-${i}`}
                  onPress={() => onSelectNode(n)}
                  style={{
                    position: 'absolute',
                    left: pos.left, top: pos.top,
                    width: pos.width, height: pos.height,
                  }}
                >
                  <Box style={{
                    width: '100%', height: '100%',
                    backgroundColor: isSelected ? `${color}44` : `${color}22`,
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? color : `${color}88`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    justifyContent: 'center',
                    paddingLeft: 2, paddingRight: 2,
                  }}>
                    {showLabel ? (
                      <Text numberOfLines={1} style={{
                        color: isSelected ? '#fff' : `${color}cc`,
                        fontSize: Math.min(9, pos.height * 0.6, pos.width / (label.length * 0.62)),
                      }}>
                        {label}
                      </Text>
                    ) : null}
                  </Box>
                </Pressable>
              );
            })}
          </Box>
        </ScrollView>
      </Box>

      {/* Inspector panel */}
      <Box style={{
        width: 260,
        borderLeftWidth: 1, borderColor: c.border,
        paddingLeft: 12, paddingRight: 12, paddingTop: 12,
      }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: '700', paddingBottom: 8 }}>Inspector</Text>
        {selectedNode ? (
          <Box style={{ gap: 6 }}>
            <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Box style={{ backgroundColor: roleColor(selectedNode.role), paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{selectedNode.role}</Text>
              </Box>
            </Box>
            {selectedNode.name ? (
              <Text style={{ color: c.text, fontSize: 12 }}>{`"${selectedNode.name}"`}</Text>
            ) : null}
            <Text style={{ color: c.muted, fontSize: 10 }}>
              {`${selectedNode.rect.x},${selectedNode.rect.y} ${selectedNode.rect.w}x${selectedNode.rect.h}`}
            </Text>
            <Text style={{ color: c.muted, fontSize: 10 }}>
              {`path: [${selectedNode.path.join(',')}]`}
            </Text>
            {selectedNode.states.length > 0 ? (
              <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {selectedNode.states.map((s, i) => (
                  <Box key={`st-${i}`} style={{ backgroundColor: 'rgba(99,102,241,0.2)', paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
                    <Text style={{ color: '#818cf8', fontSize: 9 }}>{s}</Text>
                  </Box>
                ))}
              </Box>
            ) : null}
            {TEXT_ROLES.has(selectedNode.role) ? (
              <TextPreview appName={appName} path={selectedNode.path} />
            ) : selectedNode.text ? (
              <Text style={{ color: C.text, fontSize: 11, fontStyle: 'italic' }}>{`"${selectedNode.text.slice(0, 200)}"`}</Text>
            ) : null}
            {selectedNode.actions.length > 0 ? (
              <Box style={{ gap: 4, paddingTop: 4 }}>
                <Text style={{ color: c.muted, fontSize: 10 }}>Actions:</Text>
                {selectedNode.actions.map((a, i) => (
                  <Pressable
                    key={`act-${i}`}
                    onPress={() => onAction(selectedNode.path, a.index)}
                    style={{
                      backgroundColor: 'rgba(6,182,212,0.15)',
                      paddingLeft: 8, paddingRight: 8,
                      paddingTop: 4, paddingBottom: 4,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: 'rgba(6,182,212,0.3)',
                    }}
                  >
                    <Text style={{ color: C.button, fontSize: 11 }}>{a.name}</Text>
                  </Pressable>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : (
          <Text style={{ color: c.muted, fontSize: 11 }}>Click an element to inspect</Text>
        )}
      </Box>
    </Box>
  );
}

// ── Text Preview ─────────────────────────────────────────

const TEXT_ROLES = new Set(['text', 'document text', 'document frame', 'terminal', 'text field']);

function TextPreview({ appName, path }: { appName: string; path: number[] }) {
  const c = useThemeColors();
  const bridge = useBridge();
  const [textData, setTextData] = useState<{ text: string; length: number; caret?: number; selection?: { start: number; end: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const pathKey = path.join(',');

  useMount(() => {
    bridge.rpc<any>('a11y:text', { app: appName, path: pathKey, max: 50000 }).then((result: any) => {
      if (result && !result.error) {
        setTextData(result);
      }
      setLoading(false);
    });
  });

  // Poll for live updates
  useLuaEffect({ type: 'poll', interval: 1000 }, () => {
    bridge.rpc<any>('a11y:text', { app: appName, path: pathKey, max: 50000 }).then((result: any) => {
      if (result && !result.error) {
        setTextData(result);
      }
    });
  }, [appName, pathKey]);

  if (loading) return <Text style={{ color: c.muted, fontSize: 10 }}>Loading text...</Text>;
  if (!textData) return <Text style={{ color: c.muted, fontSize: 10 }}>No text content</Text>;

  return (
    <Box style={{ gap: 4 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {`${textData.length.toLocaleString()} chars`}
        </Text>
        {textData.caret !== undefined ? (
          <Text style={{ color: '#f59e0b', fontSize: 9 }}>
            {`caret: ${textData.caret}`}
          </Text>
        ) : null}
        {textData.selection ? (
          <Text style={{ color: '#a78bfa', fontSize: 9 }}>
            {`sel: ${textData.selection.start}-${textData.selection.end}`}
          </Text>
        ) : null}
      </Box>
      <ScrollView style={{ height: 300, backgroundColor: '#0f172a', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 10, fontFamily: 'monospace' }}>
          {textData.text}
        </Text>
      </ScrollView>
      {textData.truncated ? (
        <Text style={{ color: '#f59e0b', fontSize: 9 }}>
          {`Showing first ${textData.text.length.toLocaleString()} of ${textData.length.toLocaleString()} chars`}
        </Text>
      ) : null}
    </Box>
  );
}

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
function LazyNode({ node, depth, appName, onAction, humanFilter }: {
  node: A11yNode;
  depth: number;
  appName: string;
  onAction: (path: number[], actionIndex: number) => void;
  humanFilter?: boolean;
}) {
  const c = useThemeColors();
  const hasInlineChildren = node.children && node.children.length > 0;
  const hasMoreChildren = node.childCount > 0 && !hasInlineChildren;
  const expandable = hasInlineChildren || hasMoreChildren;
  const [expanded, setExpanded] = useState(depth < 2 && !hasMoreChildren);
  const color = roleColor(node.role);
  const isContainer = node.role === 'application' || node.role === 'frame' || node.role === 'filler' || node.role === 'panel';
  const isVisible = isContainer || node.states.length === 0 || node.states.includes('visible') || node.states.includes('showing');

  return (
    <Box style={{ paddingLeft: depth > 0 ? 16 : 0, opacity: isVisible ? 1.0 : 0.4 }}>
      {/* Node header row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 2 }}>
        {expandable ? (
          <Pressable onPress={() => setExpanded(!expanded)} style={{ paddingRight: 4 }}>
            <Text style={{ color: c.muted, fontSize: 11 }}>{expanded ? '▼' : '▶'}</Text>
          </Pressable>
        ) : (
          <Box style={{ width: 16 }} />
        )}

        <Box style={{
          backgroundColor: color,
          paddingLeft: 6, paddingRight: 6,
          paddingTop: 2, paddingBottom: 2,
          borderRadius: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{node.role}</Text>
        </Box>

        {node.name ? (
          <Text style={{ color: c.text, fontSize: 12 }}>{`"${node.name}"`}</Text>
        ) : null}

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {node.rect ? `${node.rect.x},${node.rect.y} ${node.rect.w}x${node.rect.h}` : 'hidden'}
        </Text>

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

      {node.text ? (
        <Box style={{ paddingLeft: 32 }}>
          <Text style={{ color: C.text, fontSize: 11, fontStyle: 'italic' }}>{`"${node.text.slice(0, 100)}"`}</Text>
        </Box>
      ) : null}

      {expanded && hasInlineChildren ? (
        <Box>
          {node.children!.map((child, i) => (
            <LazyNode
              key={`${child.role}-${i}`}
              node={child}
              depth={depth + 1}
              appName={appName}
              onAction={onAction}
              humanFilter={humanFilter}
            />
          ))}
        </Box>
      ) : null}

      {expanded && hasMoreChildren ? (
        <LazyChildren appName={appName} path={node.path} depth={depth} onAction={onAction} humanFilter={humanFilter} />
      ) : null}

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

/** Fetches children via Lua RPC (one-shot, no polling) */
function LazyChildren({ appName, path, depth, onAction, humanFilter }: {
  appName: string;
  path: number[];
  depth: number;
  onAction: (path: number[], actionIndex: number) => void;
  humanFilter?: boolean;
}) {
  const c = useThemeColors();
  const bridge = useBridge();
  const [data, setData] = useState<A11yNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stableRef = useRef<A11yNode | null>(null);

  useMount(() => {
    const rpcArgs: any = { app: appName, path: path.join(','), depth: 1 };
    if (humanFilter) rpcArgs.filter = 'human';
    bridge.rpc<A11yNode>('a11y:subtree', rpcArgs).then((result: any) => {
      if (result && result.error) {
        setError(result.error);
      } else if (result) {
        stableRef.current = mergeTree(stableRef.current, result);
        setData(stableRef.current);
      }
      setLoading(false);
    }).catch((err: any) => {
      setError(String(err));
      setLoading(false);
    });
  });

  if (loading) {
    return (
      <Box style={{ paddingLeft: 32 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>Loading...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ paddingLeft: 32 }}>
        <Text style={{ color: '#ef4444', fontSize: 10 }}>{`Error: ${error}`}</Text>
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
          humanFilter={humanFilter}
        />
      ))}
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

export function A11yMirrorStory() {
  const c = useThemeColors();
  const bridge = useBridge();
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [treeData, setTreeData] = useState<A11yNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [humanFilter, setHumanFilter] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'mirror'>('mirror');
  const [mirrorTree, setMirrorTree] = useState<A11yNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FlatNode | null>(null);
  const stableTreeRef = useRef<A11yNode | null>(null);
  const stableMirrorRef = useRef<A11yNode | null>(null);
  const prevAppRef = useRef<string | null>(null);

  // Poll app list every 5s via Lua timer
  useLuaEffect({ type: 'poll', interval: 5000 }, () => {
    bridge.rpc<{ apps: AppInfo[] }>('a11y:apps').then((result: any) => {
      if (result && result.apps) setApps(result.apps);
    });
  }, []);

  // Fetch app list once on mount
  useMount(() => {
    bridge.rpc<{ apps: AppInfo[] }>('a11y:apps').then((result: any) => {
      if (result && result.apps) setApps(result.apps);
    });
  });

  // Poll selected app's tree every 1.5s via Lua timer
  useLuaEffect({ type: 'poll', interval: 1500 }, () => {
    if (!selectedApp) return;
    const rpcArgs: any = { app: selectedApp, depth: 3 };
    if (humanFilter) rpcArgs.filter = 'human';
    bridge.rpc<A11yNode>('a11y:tree', rpcArgs).then((result: any) => {
      if (result && result.error) {
        setTreeError(result.error);
        return;
      }
      if (result) {
        stableTreeRef.current = mergeTree(stableTreeRef.current, result);
        setTreeData(stableTreeRef.current);
        setTreeError(null);
      }
    });
  }, [selectedApp, humanFilter]);

  // Poll mirror tree at deeper depth (8) for full layout
  useLuaEffect({ type: 'poll', interval: 2000 }, () => {
    if (!selectedApp || viewMode !== 'mirror') return;
    bridge.rpc<A11yNode>('a11y:tree', { app: selectedApp, depth: 15, filter: 'human' }).then((result: any) => {
      if (result && !result.error) {
        stableMirrorRef.current = mergeTree(stableMirrorRef.current, result);
        setMirrorTree(stableMirrorRef.current);
      }
    });
  }, [selectedApp, viewMode]);

  // Handle app selection — reset tree and fetch immediately
  const handleSelectApp = (name: string) => {
    setSelectedApp(name);
    setSelectedNode(null);
    stableTreeRef.current = null;
    stableMirrorRef.current = null;
    setTreeData(null);
    setMirrorTree(null);
    setTreeLoading(true);
    setTreeError(null);
    const rpcArgs: any = { app: name, depth: 3 };
    if (humanFilter) rpcArgs.filter = 'human';
    bridge.rpc<A11yNode>('a11y:tree', rpcArgs).then((result: any) => {
      if (result && result.error) {
        setTreeError(result.error);
      } else if (result) {
        stableTreeRef.current = result;
        setTreeData(result);
      }
      setTreeLoading(false);
    });
    // Also fetch deep tree for mirror
    bridge.rpc<A11yNode>('a11y:tree', { app: name, depth: 15, filter: 'human' }).then((result: any) => {
      if (result && !result.error) {
        stableMirrorRef.current = result;
        setMirrorTree(result);
      }
    });
  };

  // Handle action execution
  const handleAction = (path: number[], actionIndex: number) => {
    if (!selectedApp) return;
    bridge.rpc('a11y:action', { app: selectedApp, path, action: actionIndex });
  };

  const serverDown = apps.length === 0 && !treeLoading;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Header */}
      <Box style={{
        paddingLeft: 20, paddingRight: 20,
        paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderColor: c.border,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>Accessibility Mirror</Text>
            <Text style={{ color: c.muted, fontSize: 12, paddingTop: 4 }}>
              {`Live AT-SPI2 tree — Lua RPC polling, damage-only updates`}
            </Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pressable
              onPress={() => setViewMode('mirror')}
              style={{
                paddingLeft: 10, paddingRight: 10,
                paddingTop: 5, paddingBottom: 5,
                borderRadius: 5,
                backgroundColor: viewMode === 'mirror' ? C.frame : c.surface,
                borderWidth: 1,
                borderColor: viewMode === 'mirror' ? C.frame : c.border,
              }}
            >
              <Text style={{ color: viewMode === 'mirror' ? '#fff' : c.text, fontSize: 11, fontWeight: '600' }}>Mirror</Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('tree')}
              style={{
                paddingLeft: 10, paddingRight: 10,
                paddingTop: 5, paddingBottom: 5,
                borderRadius: 5,
                backgroundColor: viewMode === 'tree' ? C.frame : c.surface,
                borderWidth: 1,
                borderColor: viewMode === 'tree' ? C.frame : c.border,
              }}
            >
              <Text style={{ color: viewMode === 'tree' ? '#fff' : c.text, fontSize: 11, fontWeight: '600' }}>Tree</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setHumanFilter(!humanFilter);
                stableTreeRef.current = null;
                stableMirrorRef.current = null;
                setTreeData(null);
                setMirrorTree(null);
              }}
              style={{
                paddingLeft: 10, paddingRight: 10,
                paddingTop: 5, paddingBottom: 5,
                borderRadius: 5,
                backgroundColor: humanFilter ? '#10b981' : c.surface,
                borderWidth: 1,
                borderColor: humanFilter ? '#10b981' : c.border,
              }}
            >
              <Text style={{ color: humanFilter ? '#fff' : c.text, fontSize: 11, fontWeight: '600' }}>
                {humanFilter ? 'Filtered' : 'Raw'}
              </Text>
            </Pressable>
          </Box>
        </Box>
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
          <AppPicker apps={apps} onSelect={handleSelectApp} selected={selectedApp} />
        </Box>
      ) : null}

      {/* Content area */}
      <Box style={{ flexGrow: 1 }}>
        {viewMode === 'mirror' && mirrorTree ? (
          <MirrorView
            tree={mirrorTree}
            appName={selectedApp!}
            onAction={handleAction}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        ) : viewMode === 'tree' && treeData ? (
          <ScrollView style={{ flexGrow: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 20 }}>
            <LazyNode node={treeData} depth={0} appName={selectedApp!} onAction={handleAction} humanFilter={humanFilter} />
          </ScrollView>
        ) : treeLoading ? (
          <Box style={{ padding: 20 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Loading...</Text>
          </Box>
        ) : selectedApp && treeError ? (
          <Box style={{ padding: 20 }}>
            <Text style={{ color: '#ef4444', fontSize: 13 }}>{`Error: ${treeError}`}</Text>
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
