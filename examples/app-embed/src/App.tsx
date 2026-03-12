import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, Render, useBridge, useMount, useLuaInterval } from '@reactjit/core';
import type { IBridge } from '@reactjit/core';

// --- Theme ---
const C = {
  bg: '#0f0f1a',
  panel: '#1a1a2e',
  border: '#2a2a4a',
  text: '#cdd6f4',
  muted: '#6c7086',
  accent: '#89b4fa',
  titleBar: '#181825',
  close: '#f38ba8',
  green: '#a6e3a1',
  divider: '#45475a',
  pickerBg: '#1e1e2e',
};

// --- App registry ---
type AppConfig = {
  id: string; label: string; resolution: string;
  source?: string; command?: string;
  vmMemory?: number; vmCpus?: number; fps?: number;
};

const APPS: AppConfig[] = [
  { id: 'calc', source: 'display', command: 'python3 apps/calculator.py', label: 'Calculator', resolution: '300x400' },
  { id: 'kitty', source: 'display', command: 'kitty -o remember_window_size=no -o initial_window_width=832 -o initial_window_height=709', label: 'Terminal', resolution: '832x709' },
  { id: 'nemo', source: 'display', command: 'GDK_BACKEND=x11 GSK_RENDERER=cairo dbus-launch nemo --no-desktop', label: 'Files', resolution: '832x709' },
  { id: 'blissos', source: '/home/siah/Downloads/Bliss-Surface-v14.10.3-x86_64-OFFICIAL-foss-20241013.iso', label: 'BlissOS', resolution: '1280x720', vmMemory: 4096, vmCpus: 4, fps: 60 },
  { id: 'android9', source: 'android-x86_64-9.0-r2.iso', label: 'Android 9', resolution: '1280x720', vmMemory: 4096, vmCpus: 4, fps: 60 },
  { id: 'cbpp', source: 'cbpp-12.1-amd64-20240201.iso', label: '#!++', resolution: '1280x720', vmMemory: 2048, vmCpus: 2, fps: 30 },
  { id: 'antix', source: 'antiX-23.1_x64-full.iso', label: 'antiX', resolution: '1280x720', vmMemory: 2048, vmCpus: 2, fps: 30 },
  { id: 'debian', source: 'debian-12.8.0-amd64-netinst.iso', label: 'Debian', resolution: '1280x720', vmMemory: 2048, vmCpus: 2, fps: 30 },
  { id: 'win7', source: 'en_windows_7_professional_with_sp1_x64_dvd_u_676939.iso', label: 'Windows 7', resolution: '1280x720', vmMemory: 4096, vmCpus: 4, fps: 30 },
  { id: 'balatro', source: 'window:Balatro', label: 'Balatro', resolution: '1920x1080', fps: 60 },
];

// --- Tree types (read-only from Lua) ---
type LeafNode = { type: 'leaf'; id: string; app: AppConfig };
type SplitNode = { type: 'split'; id: string; direction: 'h' | 'v'; ratio: number; children: [TreeNode, TreeNode] };
type TreeNode = SplitNode | LeafNode;

type WorkspaceState = {
  tree: TreeNode;
  focusedId: string;
  swapSource: string | null;
};

// --- Picking state (UI-only, stays in React) ---
type PickState = { leafId: string; direction: 'h' | 'v' } | null;

// --- Divider ---
function Divider({ splitId, direction, bridge }: {
  splitId: string; direction: 'h' | 'v';
  bridge: any;
}) {
  const isH = direction === 'h';
  return (
    <Box
      onDrag={(e: any) => {
        const delta = isH ? e.deltaX : e.deltaY;
        bridge.rpc('workspace:adjustRatio', { splitId, delta: delta / 600 });
      }}
      style={{
        width: isH ? 8 : '100%',
        height: isH ? '100%' : 8,
        backgroundColor: C.divider,
      }}
    />
  );
}

// --- App picker overlay ---
function AppPicker({ onPick, onCancel }: { onPick: (app: AppConfig) => void; onCancel: () => void }) {
  return (
    <Box style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
    }}>
      <Box style={{ backgroundColor: C.pickerBg, borderRadius: 12, paddingTop: 16, paddingBottom: 16, paddingLeft: 20, paddingRight: 20, gap: 8, minWidth: 200 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold' }}>{`Launch App`}</Text>
        {APPS.map(app => (
          <Pressable key={app.id} onPress={() => onPick(app)} style={{
            backgroundColor: C.border, borderRadius: 6,
            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
          }}>
            <Text style={{ color: C.text, fontSize: 13 }}>{app.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onCancel} style={{
          paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, alignItems: 'center',
        }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>{`Cancel`}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

// --- Tile view (leaf node) ---
function TileView({ leaf, focused, swapSource, bridge, onRequestSplit }: {
  leaf: LeafNode; focused: boolean;
  swapSource: string | null;
  bridge: any;
  onRequestSplit: (leafId: string, dir: 'h' | 'v') => void;
}) {
  const isSwapSource = swapSource === leaf.id;
  const isSwapTarget = swapSource !== null && swapSource !== leaf.id;
  const borderColor = isSwapSource ? C.green : isSwapTarget ? '#f9e2af' : focused ? C.accent : C.border;
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, overflow: 'hidden', borderWidth: (isSwapSource || isSwapTarget) ? 2 : focused ? 2 : 1, borderColor, borderRadius: 4 }}>
      <Box style={{
        flexDirection: 'row', backgroundColor: C.titleBar, alignItems: 'center',
        paddingLeft: 4, paddingRight: 4, paddingTop: 3, paddingBottom: 3, gap: 4,
      }}>
        <Pressable onPress={() => bridge.rpc('workspace:swapTap', { leafId: leaf.id })} style={{
          paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
          backgroundColor: isSwapSource ? C.green : isSwapTarget ? '#f9e2af' : C.border, borderRadius: 3,
        }}>
          <Text style={{ color: isSwapSource ? C.bg : isSwapTarget ? C.bg : C.muted, fontSize: 9 }}>{`\u2261`}</Text>
        </Pressable>
        <Pressable onPress={() => bridge.rpc('workspace:setFocus', { leafId: leaf.id })} style={{ flexGrow: 1 }}>
          <Text style={{ color: focused ? C.accent : C.muted, fontSize: 11, fontWeight: 'bold' }}>
            {isSwapTarget ? `${leaf.app.label} \u2190 swap here` : leaf.app.label}
          </Text>
        </Pressable>
        <Pressable onPress={() => onRequestSplit(leaf.id, 'h')} style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, backgroundColor: C.border, borderRadius: 3 }}>
          <Text style={{ color: C.muted, fontSize: 9 }}>{`\u2502`}</Text>
        </Pressable>
        <Pressable onPress={() => onRequestSplit(leaf.id, 'v')} style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, backgroundColor: C.border, borderRadius: 3 }}>
          <Text style={{ color: C.muted, fontSize: 9 }}>{`\u2500`}</Text>
        </Pressable>
        <Pressable onPress={() => bridge.rpc('workspace:remove', { leafId: leaf.id })} style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, backgroundColor: C.border, borderRadius: 3 }}>
          <Text style={{ color: C.close, fontSize: 9 }}>{`\u00d7`}</Text>
        </Pressable>
      </Box>
      <Render
        source={leaf.app.source || 'display'}
        command={leaf.app.command}
        resolution={leaf.app.resolution}
        vmMemory={leaf.app.vmMemory}
        vmCpus={leaf.app.vmCpus}
        fps={leaf.app.fps}
        interactive
        style={{ flexGrow: 1, width: '100%' }}
      />
    </Box>
  );
}

// --- Recursive tree renderer ---
function TreeView({ node, focusedId, swapSource, bridge, onRequestSplit }: {
  node: TreeNode; focusedId: string;
  swapSource: string | null;
  bridge: any;
  onRequestSplit: (leafId: string, dir: 'h' | 'v') => void;
}) {
  if (node.type === 'leaf') {
    return (
      <TileView
        leaf={node}
        focused={node.id === focusedId}
        swapSource={swapSource}
        bridge={bridge}
        onRequestSplit={onRequestSplit}
      />
    );
  }

  const isH = node.direction === 'h';
  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, flexDirection: isH ? 'row' : 'column' }}>
      <Box style={{ flexGrow: node.ratio, flexBasis: 0 }}>
        <TreeView node={node.children[0]} focusedId={focusedId} swapSource={swapSource} bridge={bridge} onRequestSplit={onRequestSplit} />
      </Box>
      <Divider splitId={node.id} direction={node.direction} bridge={bridge} />
      <Box style={{ flexGrow: 1 - node.ratio, flexBasis: 0 }}>
        <TreeView node={node.children[1]} focusedId={focusedId} swapSource={swapSource} bridge={bridge} onRequestSplit={onRequestSplit} />
      </Box>
    </Box>
  );
}

// --- Root (gate on bridge) ---
export function App() {
  const bridge = useBridge();
  if (!bridge) {
    return (
      <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 14 }}>{`Loading workspace...`}</Text>
      </Box>
    );
  }
  return <AppInner bridge={bridge} />;
}

function AppInner({ bridge }: { bridge: IBridge }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [picking, setPicking] = useState<PickState>(null);

  // Init workspace in Lua on mount
  useMount(() => {
    bridge.rpc('workspace:init', APPS[1]);
  });

  // Poll workspace state from Lua (16ms ≈ every frame)
  useLuaInterval(16, () => {
    bridge.rpc<WorkspaceState>('workspace:getState', {}).then(setState);
  });

  const handleRequestSplit = useCallback((leafId: string, dir: 'h' | 'v') => {
    setPicking({ leafId, direction: dir });
  }, []);

  const handlePick = useCallback((app: AppConfig) => {
    if (!picking) return;
    bridge.rpc('workspace:split', { leafId: picking.leafId, app, direction: picking.direction });
    setPicking(null);
  }, [picking, bridge]);

  if (!state || !state.tree) {
    return (
      <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 14 }}>{`Loading workspace...`}</Text>
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 4 }}>
      <TreeView
        node={state.tree}
        focusedId={state.focusedId}
        swapSource={state.swapSource}
        bridge={bridge}
        onRequestSplit={handleRequestSplit}
      />
      {picking ? <AppPicker onPick={handlePick} onCancel={() => setPicking(null)} /> : null}
    </Box>
  );
}
