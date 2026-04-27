import { useRef, useState } from 'react';
import { Box, Canvas, Col, Graph, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from './sweatshop/theme';

type FlowNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type FlowEdge = {
  id: string;
  from: string;
  to: string;
};

const NODE_W = 160;
const NODE_H = 64;
const PORT_R = 7;

// Cubic bezier with horizontal tangents that stays sane when the target is
// behind, above, or below the source. Using a signed dx (clamped) instead of
// abs(dx) prevents control points from shooting past both endpoints and
// looping; bumping the offset by |dy| keeps the curve readable on stacked
// connections. Returns the path d-string AND the second control point so the
// arrowhead can use the real tangent at the endpoint.
function bezierFor(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Tangent magnitude: stay symmetric so forward/backward routes look the
  // same. Forward (dx>0) collapses gracefully; backward (dx<0) needs enough
  // bow to wrap around the source/target tiles instead of cutting through.
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const forward = Math.max(50, adx * 0.5);
  const backward = Math.max(80, ady * 0.5 + 60);
  const horiz = Math.min(240, dx >= 0 ? forward : backward);
  const c1x = x1 + horiz;
  const c2x = x2 - horiz;
  const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${y1.toFixed(1)}, ${c2x.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  return { d, c2x, c2y: y2 };
}

function arrowHeadFromTangent(x2: number, y2: number, fromX: number, fromY: number): string {
  const ang = Math.atan2(y2 - fromY, x2 - fromX);
  const len = 10;
  const spread = 0.5;
  const ax = x2 - Math.cos(ang - spread) * len;
  const ay = y2 - Math.sin(ang - spread) * len;
  const bx = x2 - Math.cos(ang + spread) * len;
  const by = y2 - Math.sin(ang + spread) * len;
  return `M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ax.toFixed(1)} ${ay.toFixed(1)} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

const SEED_NODES: FlowNode[] = [
  { id: 'n1', label: 'Trigger', x: -260, y: -40 },
  { id: 'n2', label: 'Transform', x: 0, y: -40 },
  { id: 'n3', label: 'HTTP Out', x: 260, y: -40 },
];
const SEED_EDGES: FlowEdge[] = [
  { id: 'e1', from: 'n1', to: 'n2' },
  { id: 'e2', from: 'n2', to: 'n3' },
];

type PendingWire = { nodeId: string; side: 'out' | 'in' } | null;

export default function FlowEditorCart() {
  const [nodes, setNodes] = useState<FlowNode[]>(SEED_NODES);
  const [edges, setEdges] = useState<FlowEdge[]>(SEED_EDGES);
  const [pending, setPending] = useState<PendingWire>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const pendingRef = useRef<PendingWire>(pending);
  pendingRef.current = pending;

  const counter = useRef(SEED_NODES.length);

  const addNode = () => {
    counter.current += 1;
    const id = `n${counter.current}`;
    const existing = nodesRef.current;
    const padX = NODE_W + 40;
    const padY = NODE_H + 30;
    const overlaps = (x: number, y: number) =>
      existing.some((n) => Math.abs(n.x - x) < padX && Math.abs(n.y - y) < padY);
    let x = 0;
    let y = 0;
    if (existing.length > 0) {
      // try a spiral of slots until we find a non-overlapping one
      for (let r = 1; r < 30; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const cx = dx * padX;
            const cy = dy * padY;
            if (!overlaps(cx, cy)) { x = cx; y = cy; r = 999; break; }
          }
          if (r === 999) break;
        }
      }
    }
    setNodes((prev) => [...prev, { id, label: `Step ${counter.current}`, x, y }]);
  };

  const moveNode = (id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  };

  const tryAddEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setEdges((prev) =>
      prev.some((e) => e.from === fromId && e.to === toId)
        ? prev
        : [...prev, { id: `e${Date.now()}`, from: fromId, to: toId }],
    );
  };

  // Click a port. If nothing pending, this becomes the pending anchor.
  // If a port is pending, complete the wire — but only when sides are
  // opposite (out→in or in→out). Same-side clicks just swap the anchor.
  const onPortClick = (nodeId: string, side: 'out' | 'in') => {
    const cur = pendingRef.current;
    if (!cur) {
      setPending({ nodeId, side });
      return;
    }
    if (cur.nodeId === nodeId) {
      setPending(null);
      return;
    }
    if (cur.side === side) {
      setPending({ nodeId, side });
      return;
    }
    if (cur.side === 'out') tryAddEdge(cur.nodeId, nodeId);
    else tryAddEdge(nodeId, cur.nodeId);
    setPending(null);
  };

  // Clicking the body completes whatever's pending using its natural side.
  const onNodeClick = (id: string) => {
    const cur = pendingRef.current;
    if (cur) {
      if (cur.nodeId !== id) {
        if (cur.side === 'out') tryAddEdge(cur.nodeId, id);
        else tryAddEdge(id, cur.nodeId);
      }
      setPending(null);
      return;
    }
    setSelectedId(id);
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedId === id) setSelectedId(null);
    if (pending?.nodeId === id) setPending(null);
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setPending(null);
    setSelectedId(null);
  };

  const byId = new Map<string, FlowNode>();
  for (const n of nodes) byId.set(n.id, n);

  const edgePaths: any[] = [];
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const x1 = a.x + NODE_W / 2;
    const y1 = a.y;
    const x2 = b.x - NODE_W / 2;
    const y2 = b.y;
    const bz = bezierFor(x1, y1, x2, y2);
    edgePaths.push(
      <Graph.Path key={`p-${e.id}`} d={bz.d} stroke={COLORS.accent || '#5db4ff'} strokeWidth={2} fill="none" />,
    );
    edgePaths.push(
      <Graph.Path key={`h-${e.id}`} d={arrowHeadFromTangent(x2, y2, bz.c2x, bz.c2y)} stroke={COLORS.accent || '#5db4ff'} strokeWidth={2} fill="none" />,
    );
  }

  const accent = COLORS.accent || '#5db4ff';
  const tiles: any[] = [];
  for (const node of nodes) {
    const isSelected = selectedId === node.id;
    const pendingOut = pending?.nodeId === node.id && pending.side === 'out';
    const pendingIn = pending?.nodeId === node.id && pending.side === 'in';
    const anyPending = pendingOut || pendingIn;
    tiles.push(
      <Canvas.Node
        key={node.id}
        gx={node.x}
        gy={node.y}
        gw={NODE_W}
        gh={NODE_H}
        onMove={(e: any) => moveNode(node.id, e.gx, e.gy)}
      >
        <Box
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            borderRadius: TOKENS.radiusMd,
            backgroundColor: isSelected ? '#1a2738' : '#101824',
            borderWidth: anyPending ? 2 : 1,
            borderColor: anyPending ? '#f5c95b' : isSelected ? accent : COLORS.borderSoft,
          }}
        >
          <Pressable
            onPress={() => onNodeClick(node.id)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 8,
              paddingBottom: 8,
              gap: 2,
            }}
          >
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {node.label}
            </Text>
            <Text fontSize={9} color={COLORS.textDim}>
              {node.id}
            </Text>
          </Pressable>
          {/* input port (left edge) */}
          <Pressable
            onPress={() => onPortClick(node.id, 'in')}
            style={{
              position: 'absolute',
              left: 2,
              top: NODE_H / 2 - PORT_R - 1,
              width: PORT_R * 2,
              height: PORT_R * 2,
              borderRadius: PORT_R,
              backgroundColor: pendingIn ? '#f5c95b' : '#243446',
              borderWidth: 1,
              borderColor: pendingIn ? '#f5c95b' : accent,
            }}
          />
          {/* output port (right edge) */}
          <Pressable
            onPress={() => onPortClick(node.id, 'out')}
            style={{
              position: 'absolute',
              left: NODE_W - PORT_R * 2 - 4,
              top: NODE_H / 2 - PORT_R - 1,
              width: PORT_R * 2,
              height: PORT_R * 2,
              borderRadius: PORT_R,
              backgroundColor: pendingOut ? '#f5c95b' : accent,
              borderWidth: 1,
              borderColor: '#0a0f17',
            }}
          />
          {/* delete × (top-right) */}
          <Pressable
            onPress={() => removeNode(node.id)}
            style={{
              position: 'absolute',
              left: NODE_W - 20,
              top: 4,
              width: 16,
              height: 16,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0a0f17',
            }}
          >
            <Text fontSize={10} color={COLORS.textDim}>×</Text>
          </Pressable>
        </Box>
      </Canvas.Node>,
    );
  }

  const status = pending
    ? `wiring ${pending.side === 'out' ? 'out of' : 'into'} ${pending.nodeId} — click another node's ${pending.side === 'out' ? 'input' : 'output'} (or any tile) to connect`
    : `${nodes.length} nodes, ${edges.length} edges — click any port (▸ or ◂) to start a wire`;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg }}>
      <Row
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 10,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
          backgroundColor: '#0b1118',
        }}
      >
        <Pressable
          onPress={addNode}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.accent || '#5db4ff',
          }}
        >
          <Text fontSize={11} color="#06121f" style={{ fontWeight: 'bold' }}>+ Add node</Text>
        </Pressable>
        <Pressable
          onPress={clearAll}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: TOKENS.radiusSm,
            borderWidth: 1,
            borderColor: COLORS.borderSoft,
          }}
        >
          <Text fontSize={11} color={COLORS.textDim}>clear</Text>
        </Pressable>
        {pending ? (
          <Pressable
            onPress={() => setPending(null)}
            style={{
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: '#f5c95b',
            }}
          >
            <Text fontSize={11} color="#f5c95b">cancel wire</Text>
          </Pressable>
        ) : null}
        <Text fontSize={10} color={COLORS.textDim} style={{ marginLeft: 6 }}>
          {status}
        </Text>
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0 }}>
        <Canvas
          style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.appBg }}
          gridStep={40}
          gridStroke={1}
          gridColor="#161d27"
          gridMajorColor="#1f2a37"
          gridMajorEvery={5}
        >
          <Graph
            style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
            viewX={0}
            viewY={0}
            viewZoom={1}
          >
            {edgePaths}
          </Graph>
          {tiles}
          <Canvas.Clamp>
            <Box
              style={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: TOKENS.radiusMd,
                backgroundColor: 'rgba(11,18,28,0.78)',
                borderWidth: 1,
                borderColor: COLORS.borderSoft,
                gap: 2,
              }}
            >
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>flow editor</Text>
              <Text fontSize={9} color={COLORS.textDim}>alt-drag tile to move · click any port (◂ in / ▸ out) then click a tile or its opposite port · × to delete</Text>
            </Box>
          </Canvas.Clamp>
        </Canvas>
      </Box>
    </Col>
  );
}
