/**
 * FileTreePanel — collapsible src/ file tree with recency highlighting.
 *
 * Runs: find src/ -type f -printf '%T@ %p\n'
 * Parses paths into a nested tree. Files modified < 5m ago glow amber.
 * Modified < 30m ago are dim-highlighted. Polls every 30s.
 * All folders open by default; click to collapse.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView, useLoveRPC, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const CWD      = '/home/siah/creative/reactjit/workspace';
const HOT_MS   = 5  * 60 * 1000;   // < 5m  → hot (amber)
const WARM_MS  = 30 * 60 * 1000;   // < 30m → warm (dim highlight)
const POLL_MS  = 31 * 1000;  // staggered from daily summary (30s)

// ── Tree types ───────────────────────────────────────────────────────

interface FileNode {
  type:     'file';
  name:     string;
  path:     string;
  modTime:  number;   // unix seconds
}

interface DirNode {
  type:     'dir';
  name:     string;
  path:     string;
  children: TreeNode[];
  newestMod: number;  // max modTime of all descendants
}

type TreeNode = FileNode | DirNode;

// ── Parser ───────────────────────────────────────────────────────────

function parseFindOutput(raw: string): TreeNode[] {
  const lines = raw.trim().split('\n').filter(Boolean);
  const entries: Array<{ modTime: number; path: string }> = [];

  for (const line of lines) {
    const space = line.indexOf(' ');
    if (space < 0) continue;
    const modTime = parseFloat(line.slice(0, space));
    const path    = line.slice(space + 1);
    if (!isNaN(modTime) && path) entries.push({ modTime, path });
  }

  // Build tree
  const root: DirNode = { type: 'dir', name: 'src', path: 'src', children: [], newestMod: 0 };
  const dirMap: Record<string, DirNode> = { src: root };

  const ensureDir = (dirPath: string): DirNode => {
    if (dirMap[dirPath]) return dirMap[dirPath];
    const parts  = dirPath.split('/');
    const name   = parts[parts.length - 1];
    const parent = ensureDir(parts.slice(0, -1).join('/') || 'src');
    const node: DirNode = { type: 'dir', name, path: dirPath, children: [], newestMod: 0 };
    dirMap[dirPath] = node;
    parent.children.push(node);
    return node;
  };

  for (const { modTime, path } of entries) {
    const parts   = path.split('/');
    const name    = parts[parts.length - 1];
    const dirPath = parts.slice(0, -1).join('/') || 'src';
    const dir     = ensureDir(dirPath);
    dir.children.push({ type: 'file', name, path, modTime });
  }

  // Propagate newestMod up
  const propagate = (node: DirNode): number => {
    let max = 0;
    for (const child of node.children) {
      const t = child.type === 'file' ? child.modTime : propagate(child);
      if (t > max) max = t;
    }
    node.newestMod = max;
    return max;
  };
  propagate(root);

  // Sort: dirs first (by newestMod desc), then files (by modTime desc)
  const sortChildren = (node: DirNode) => {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      const at = a.type === 'dir' ? a.newestMod : a.modTime;
      const bt = b.type === 'dir' ? b.newestMod : b.modTime;
      return bt - at;
    });
    for (const child of node.children) {
      if (child.type === 'dir') sortChildren(child);
    }
  };
  sortChildren(root);

  return root.children;
}

// ── Tree node renderer ───────────────────────────────────────────────

const EXT_COLOR: Record<string, string> = {
  tsx: C.accent,
  ts:  C.accentDim,
  lua: C.warning,
  css: C.approve,
  md:  C.textDim,
  json: C.textDim,
  mjs: C.warning,
};

function extOf(name: string): string {
  return name.includes('.') ? name.split('.').pop()! : '';
}

function FileRow({ node, nowSec, depth }: { node: FileNode; nowSec: number; depth: number }) {
  const ageSec  = nowSec - node.modTime;
  const isHot   = ageSec * 1000 < HOT_MS;
  const isWarm  = ageSec * 1000 < WARM_MS;
  const ext     = extOf(node.name);
  const extColor = EXT_COLOR[ext] ?? C.textMuted;

  const nameColor = isHot  ? C.warning
                  : isWarm ? C.textDim
                  :           C.textMuted;

  return (
    <Box style={{
      flexDirection:   'row',
      alignItems:      'center',
      gap:             4,
      paddingLeft:     8 + depth * 14,
      paddingTop:      2,
      paddingBottom:   2,
      backgroundColor: isHot ? C.warning + '0a' : 'transparent',
    }}>
      {isHot  && <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.warning, flexShrink: 0 }} />}
      {!isHot && <Box style={{ width: 4, flexShrink: 0 }} />}
      <Text style={{ fontSize: 10, color: nameColor, flexGrow: 1 }}>{node.name}</Text>
      {ext ? (
        <Text style={{ fontSize: 8, color: extColor + '88' }}>{ext}</Text>
      ) : null}
    </Box>
  );
}

function DirRow({
  node, depth, nowSec, open, onToggle,
}: {
  node: DirNode; depth: number; nowSec: number;
  open: boolean; onToggle: () => void;
}) {
  const ageSec = nowSec - node.newestMod;
  const isHot  = ageSec * 1000 < HOT_MS;
  const isWarm = ageSec * 1000 < WARM_MS;
  const dirColor = isHot  ? C.warning
                 : isWarm ? C.textDim
                 :           C.textMuted;

  return (
    <Pressable onPress={onToggle} style={{
      flexDirection:   'row',
      alignItems:      'center',
      gap:             5,
      paddingLeft:     8 + depth * 14,
      paddingTop:      3,
      paddingBottom:   3,
    }}>
      <Text style={{ fontSize: 9, color: dirColor }}>{open ? '▾' : '▸'}</Text>
      <Text style={{ fontSize: 10, color: dirColor, fontWeight: 'bold' }}>{node.name}</Text>
      <Text style={{ fontSize: 8, color: C.textMuted }}>
        {`(${node.children.length})`}
      </Text>
    </Pressable>
  );
}

function TreeLevel({
  nodes, depth, nowSec, openPaths, onToggle,
}: {
  nodes: TreeNode[]; depth: number; nowSec: number;
  openPaths: Set<string>; onToggle: (path: string) => void;
}) {
  return (
    <>
      {nodes.map(node => {
        if (node.type === 'file') {
          return <FileRow key={node.path} node={node} depth={depth} nowSec={nowSec} />;
        }
        const isOpen = openPaths.has(node.path);
        return (
          <Box key={node.path}>
            <DirRow
              node={node} depth={depth} nowSec={nowSec}
              open={isOpen} onToggle={() => onToggle(node.path)}
            />
            {isOpen && (
              <TreeLevel
                nodes={node.children} depth={depth + 1} nowSec={nowSec}
                openPaths={openPaths} onToggle={onToggle}
              />
            )}
          </Box>
        );
      })}
    </>
  );
}

// ── Panel ────────────────────────────────────────────────────────────

function collectDirPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const n of nodes) {
    if (n.type === 'dir') {
      paths.push(n.path);
      paths.push(...collectDirPaths(n.children));
    }
  }
  return paths;
}

export function FileTreePanel() {
  const rpcExec = useLoveRPC('shell:exec');
  const rpcRef  = useRef(rpcExec);
  rpcRef.current = rpcExec;

  const [nodes,     setNodes]     = useState<TreeNode[]>([]);
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());
  const [nowSec,    setNowSec]    = useState(Math.floor(Date.now() / 1000));
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const fetch = useCallback(async () => {
    try {
      const res = await rpcRef.current({
        command: `cd "${CWD}" && find src/ -type f -printf '%T@ %p\n' 2>/dev/null | sort -k2`,
      }) as any;

      if (!res?.ok && res?.exitCode !== 0) {
        setError(res?.output?.slice(0, 120) || 'find failed');
        return;
      }

      const parsed = parseFindOutput(res?.output ?? '');
      setNodes(parsed);
      setNowSec(Math.floor(Date.now() / 1000));
      setError('');

      // Open all dirs by default on first load
      setOpenPaths(prev => {
        if (prev.size > 0) return prev;
        return new Set(collectDirPaths(parsed));
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useLuaInterval(POLL_MS, fetch);

  // Keep nowSec fresh for recency colours
  // Staggered from FileTree fetch (30s) — offset by 3s
  useLuaInterval(10300, () => setNowSec(Math.floor(Date.now() / 1000)));

  const toggleDir = useCallback((path: string) => {
    setOpenPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll  = useCallback(() => setOpenPaths(new Set(collectDirPaths(nodes))), [nodes]);
  const collapseAll = useCallback(() => setOpenPaths(new Set()), []);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column', backgroundColor: C.panelF }}>

      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'src/'}</Text>
          {loading && <Text style={{ fontSize: 8, color: C.textMuted }}>{'…'}</Text>}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={expandAll}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'expand'}</Text>
          </Pressable>
          <Pressable onPress={collapseAll}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'collapse'}</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Legend */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingLeft: 12, paddingTop: 4, paddingBottom: 4,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.warning }} />
          <Text style={{ fontSize: 8, color: C.textMuted }}>{'< 5m'}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.textDim }} />
          <Text style={{ fontSize: 8, color: C.textMuted }}>{'< 30m'}</Text>
        </Box>
      </Box>

      {/* Error */}
      {error ? (
        <Box style={{ padding: 12 }}>
          <Text style={{ fontSize: 9, color: C.deny }}>{error}</Text>
        </Box>
      ) : (
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ paddingTop: 4, paddingBottom: 8 }}>
            <TreeLevel
              nodes={nodes} depth={0} nowSec={nowSec}
              openPaths={openPaths} onToggle={toggleDir}
            />
          </Box>
        </ScrollView>
      )}
    </Box>
  );
}
