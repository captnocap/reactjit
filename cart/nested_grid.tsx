import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Box, Col, Row, Text, Pressable } from '@reactjit/runtime/primitives';

const host: any = globalThis as any;
function readMouseX(): number { try { const v = Number(host.getMouseX?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; } }
function readMouseY(): number { try { const v = Number(host.getMouseY?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; } }
function readMouseDown(): boolean { try { return !!host.getMouseDown?.(); } catch { return false; } }

// ── recursive pixel-based grid ────────────────────────────────
// Each Grid declares cols × rows over a pixel area. Children are positioned
// absolutely in pixel-space. A Cell that itself has cols/rows opens a new
// coordinate system for its children — pixel sizes cascade down the tree.

type GridShape = { cellW: number; cellH: number };
const GridCtx = createContext<GridShape>({ cellW: 0, cellH: 0 });

interface GridProps {
  cols: number;
  rows: number;
  width: number;
  height: number;
  showGuides?: boolean;
  guideColor?: string;
  fill?: string;
  border?: string;
  borderRadius?: number;
  children?: any;
}

function Grid({ cols, rows, width, height, showGuides, guideColor, fill, border, borderRadius, children }: GridProps) {
  const cellW = width / cols;
  const cellH = height / rows;
  return (
    <Box style={{
      position: 'relative',
      width,
      height,
      backgroundColor: fill,
      borderWidth: border ? 1 : 0,
      borderColor: border,
      borderRadius,
    }}>
      {showGuides ? <GridGuides cols={cols} rows={rows} cellW={cellW} cellH={cellH} color={guideColor || '#1f2937'} /> : null}
      <GridCtx.Provider value={{ cellW, cellH }}>
        {children}
      </GridCtx.Provider>
    </Box>
  );
}

function GridGuides({ cols, rows, cellW, cellH, color }: { cols: number; rows: number; cellW: number; cellH: number; color: string }) {
  const out: any[] = [];
  for (let c = 1; c < cols; c++) {
    out.push(
      <Box key={`vx${c}`} style={{ position: 'absolute', left: c * cellW, top: 0, width: 1, height: rows * cellH, backgroundColor: color }} />
    );
  }
  for (let r = 1; r < rows; r++) {
    out.push(
      <Box key={`hz${r}`} style={{ position: 'absolute', top: r * cellH, left: 0, width: cols * cellW, height: 1, backgroundColor: color }} />
    );
  }
  return <>{out}</>;
}

interface CellProps {
  col: number;
  row: number;
  w?: number;
  h?: number;
  cols?: number;
  rows?: number;
  showGuides?: boolean;
  guideColor?: string;
  fill?: string;
  border?: string;
  borderRadius?: number;
  label?: string;
  children?: any;
}

function Cell(props: CellProps) {
  const parent = useContext(GridCtx);
  const w = props.w ?? 1;
  const h = props.h ?? 1;
  const left = props.col * parent.cellW;
  const top = props.row * parent.cellH;
  const width = w * parent.cellW;
  const height = h * parent.cellH;

  const isInnerGrid = typeof props.cols === 'number' && typeof props.rows === 'number';

  return (
    <Box
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderWidth: props.border ? 1 : 0,
        borderColor: props.border,
        borderRadius: props.borderRadius,
      }}
    >
      {isInnerGrid ? (
        <Grid cols={props.cols!} rows={props.rows!} width={width} height={height} showGuides={props.showGuides} guideColor={props.guideColor} fill={props.fill}>
          {props.children}
        </Grid>
      ) : (
        <Box style={{ position: 'relative', width, height, backgroundColor: props.fill }}>
          {props.children}
        </Box>
      )}
      {props.label ? (
        <Box style={{ position: 'absolute', left: 6, top: 4, zIndex: 100 }}>
          <Text style={{ color: '#9ca3af', fontSize: 9, letterSpacing: 1 }}>{props.label}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

// ── cell-fill widgets (each fills its enclosing pixel box) ────

function W_Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Col style={{ flexGrow: 1, padding: 10, justifyContent: 'center', gap: 2 }}>
      <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>{title}</Text>
      {subtitle ? <Text style={{ color: '#9ca3af', fontSize: 10 }}>{subtitle}</Text> : null}
    </Col>
  );
}

function W_Title({ text }: { text: string }) {
  return (
    <Col style={{ flexGrow: 1, padding: 8, justifyContent: 'center' }}>
      <Text style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>{text}</Text>
    </Col>
  );
}

function W_Badge({ text, color }: { text: string; color: string }) {
  return (
    <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
      <Text style={{ color: '#0a0a0e', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{text}</Text>
    </Col>
  );
}

function W_Icon({ glyph, tint }: { glyph: string; tint: string }) {
  return (
    <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: tint, fontSize: 24 }}>{glyph}</Text>
    </Col>
  );
}

function W_Stat({ label, value }: { label: string; value: string }) {
  return (
    <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Text style={{ color: '#9ca3af', fontSize: 8, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 700 }}>{value}</Text>
    </Col>
  );
}

function W_Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Col style={{ flexGrow: 1, padding: 6, justifyContent: 'center', gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: '#9ca3af', fontSize: 8, letterSpacing: 1 }}>{label}</Text>
        <Text style={{ color: '#e5e7eb', fontSize: 8 }}>{`${Math.round(value * 100)}%`}</Text>
      </Row>
      <Box style={{ height: 4, backgroundColor: '#0a0a0e', borderRadius: 2 }}>
        <Box style={{ width: `${Math.round(value * 100)}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
      </Box>
    </Col>
  );
}

function W_Avatar({ initials, name }: { initials: string; name: string }) {
  return (
    <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Box style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ec4899', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{initials}</Text>
      </Box>
      <Text style={{ color: '#e5e7eb', fontSize: 10 }}>{name}</Text>
    </Col>
  );
}

function W_Quote({ text, author }: { text: string; author: string }) {
  return (
    <Row style={{ flexGrow: 1 }}>
      <Box style={{ width: 3, backgroundColor: '#ec4899' }} />
      <Col style={{ flexGrow: 1, padding: 10, justifyContent: 'center', gap: 4 }}>
        <Text style={{ color: '#e5e7eb', fontSize: 12, fontStyle: 'italic' }}>{`"${text}"`}</Text>
        <Text style={{ color: '#9ca3af', fontSize: 9 }}>{author}</Text>
      </Col>
    </Row>
  );
}

// ── demo ──────────────────────────────────────────────────────
// Root is a fixed 1200×800 pixel surface, letterboxed inside the window.
// L0 = 10×10 → each L0 cell = 120×80.
// Inner grids divide their parent by 5 (so L1+ cells = parent_cell / 5).

const ROOT_W = 1200;
const ROOT_H = 800;
const L0_COLS = 10;
const L0_ROWS = 10;
const L0_CELL_W = ROOT_W / L0_COLS;
const L0_CELL_H = ROOT_H / L0_ROWS;

// ── L0 items (drag-to-rearrange) ──────────────────────────────
// Each entry is a self-contained nested-grid card. Body() runs inside the
// item's pixel box, so it can declare its own L1/L2/L3 grids freely.

interface L0Item {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
  body: () => any;
}

const SEED_ITEMS: L0Item[] = [
  {
    id: 'header', col: 0, row: 0, w: 6, h: 1,
    body: () => (
      <Cell col={0} row={0} w={6} h={1} cols={5} rows={1} fill="#101015" border="#2a2a33">
        <Cell col={0} row={0} w={4} h={1}><W_Header title="DASHBOARD" subtitle="profile · stats · activity" /></Cell>
        <Cell col={4} row={0} w={1} h={1}><W_Badge text="LIVE" color="#22c55e" /></Cell>
      </Cell>
    ),
  },
  {
    id: 'badgestrip', col: 6, row: 0, w: 4, h: 1,
    body: () => (
      <Cell col={6} row={0} w={4} h={1} cols={4} rows={1} fill="#101015" border="#2a2a33">
        <Cell col={0} row={0} w={1} h={1}><W_Badge text="PRO" color="#a855f7" /></Cell>
        <Cell col={1} row={0} w={1} h={1}><W_Icon glyph="★" tint="#eab308" /></Cell>
        <Cell col={2} row={0} w={1} h={1}><W_Icon glyph="♦" tint="#06b6d4" /></Cell>
        <Cell col={3} row={0} w={1} h={1}><W_Icon glyph="✦" tint="#ec4899" /></Cell>
      </Cell>
    ),
  },
  {
    id: 'primary', col: 0, row: 1, w: 6, h: 5,
    body: () => (
      <Cell col={0} row={1} w={6} h={5} cols={5} rows={5} showGuides guideColor="#1f2a3a" fill="#0e1726" border="#3b82f6" borderRadius={4}>
        <Cell col={0} row={0} w={5} h={1} cols={5} rows={1} fill="#1c1c24" border="#2a2a33">
          <Cell col={0} row={0} w={2} h={1}><W_Avatar initials="JS" name="J. Stone" /></Cell>
          <Cell col={2} row={0} w={1} h={1}><W_Stat label="LVL" value="47" /></Cell>
          <Cell col={3} row={0} w={1} h={1}><W_Stat label="DPS" value="1.2k" /></Cell>
          <Cell col={4} row={0} w={1} h={1}><W_Stat label="HP" value="99%" /></Cell>
        </Cell>
        <Cell col={0} row={1} w={3} h={4} cols={5} rows={4} fill="#101822" border="#1f2a3a">
          <Cell col={0} row={0} w={5} h={1}><W_Title text="Senior Designer" /></Cell>
          <Cell col={0} row={1} w={5} h={2}><W_Quote text="shipping is a feature." author="— anon" /></Cell>
          <Cell col={0} row={3} w={3} h={1}><W_Meter label="XP" value={0.72} color="#22c55e" /></Cell>
          <Cell col={3} row={3} w={2} h={1}><W_Meter label="STA" value={0.55} color="#f43f5e" /></Cell>
        </Cell>
        <Cell col={3} row={1} w={2} h={4} cols={2} rows={5} fill="#101822" border="#1f2a3a">
          <Cell col={0} row={0} w={2} h={1}><W_Meter label="MANA" value={0.40} color="#3b82f6" /></Cell>
          <Cell col={0} row={1} w={2} h={1}><W_Meter label="REP" value={0.90} color="#eab308" /></Cell>
          <Cell col={0} row={2} w={1} h={1}><W_Badge text="OG" color="#14b8a6" /></Cell>
          <Cell col={1} row={2} w={1} h={1}><W_Badge text="AI" color="#8b5cf6" /></Cell>
          <Cell col={0} row={3} w={2} h={2} cols={5} rows={5} showGuides guideColor="#2a1f2a" fill="#1c0e1c" border="#ec4899" label="L3">
            <Cell col={0} row={0} w={5} h={1}><W_Title text="L3" /></Cell>
            <Cell col={1} row={2} w={3} h={2}><W_Badge text="DEEP" color="#ec4899" /></Cell>
            <Cell col={4} row={1} w={1} h={4} fill="#831843" />
          </Cell>
        </Cell>
      </Cell>
    ),
  },
  {
    id: 'activity', col: 6, row: 1, w: 4, h: 3,
    body: () => (
      <Cell col={6} row={1} w={4} h={3} cols={4} rows={3} fill="#191323" border="#7c3aed" borderRadius={4}>
        <Cell col={0} row={0} w={4} h={1}><W_Header title="ACTIVITY" subtitle="last 24h" /></Cell>
        <Cell col={0} row={1} w={2} h={2}><W_Stat label="COMMITS" value="42" /></Cell>
        <Cell col={2} row={1} w={2} h={2}><W_Stat label="DEPLOYS" value="7" /></Cell>
      </Cell>
    ),
  },
  {
    id: 'health', col: 6, row: 4, w: 4, h: 2,
    body: () => (
      <Cell col={6} row={4} w={4} h={2} cols={4} rows={2} fill="#0c1a14" border="#22c55e" borderRadius={4}>
        <Cell col={0} row={0} w={4} h={1}><W_Title text="HEALTH" /></Cell>
        <Cell col={0} row={1} w={2} h={1}><W_Meter label="CPU" value={0.34} color="#22c55e" /></Cell>
        <Cell col={2} row={1} w={2} h={1}><W_Meter label="MEM" value={0.61} color="#eab308" /></Cell>
      </Cell>
    ),
  },
  {
    id: 'roster', col: 0, row: 6, w: 10, h: 3,
    body: () => (
      <Cell col={0} row={6} w={10} h={3} cols={10} rows={3} fill="#0d0d12" border="#2a2a33">
        <Cell col={0} row={0} w={10} h={1}><W_Header title="ROSTER" subtitle="active operators" /></Cell>
        <Cell col={0} row={1} w={2} h={2}><W_Avatar initials="AK" name="A. Kim" /></Cell>
        <Cell col={2} row={1} w={2} h={2}><W_Avatar initials="MN" name="M. Nair" /></Cell>
        <Cell col={4} row={1} w={2} h={2}><W_Avatar initials="RS" name="R. Soto" /></Cell>
        <Cell col={6} row={1} w={2} h={2}><W_Avatar initials="LT" name="L. Tran" /></Cell>
        <Cell col={8} row={1} w={1} h={1}><W_Badge text="HIRE" color="#3b82f6" /></Cell>
        <Cell col={9} row={1} w={1} h={1}><W_Badge text="FIRE" color="#ef4444" /></Cell>
        <Cell col={8} row={2} w={2} h={1}><W_Meter label="MORALE" value={0.78} color="#a855f7" /></Cell>
      </Cell>
    ),
  },
  {
    id: 'status', col: 0, row: 9, w: 10, h: 1,
    body: () => (
      <Cell col={0} row={9} w={10} h={1} cols={10} rows={1} fill="#08080c" border="#2a2a33">
        <Cell col={0} row={0} w={4} h={1}>
          <Col style={{ flexGrow: 1, justifyContent: 'center', paddingLeft: 12 }}>
            <Text style={{ color: '#6b7280', fontSize: 10, letterSpacing: 2 }}>L0 10×10 · 1200×800px · drag any card</Text>
          </Col>
        </Cell>
        <Cell col={4} row={0} w={1} h={1}><W_Badge text="OK" color="#22c55e" /></Cell>
        <Cell col={5} row={0} w={1} h={1}><W_Badge text="DEV" color="#f97316" /></Cell>
        <Cell col={9} row={0} w={1} h={1}><W_Icon glyph="●" tint="#22c55e" /></Cell>
      </Cell>
    ),
  },
];

function fits(items: L0Item[], itemId: string, col: number, row: number, w: number, h: number): boolean {
  if (col < 0 || row < 0 || col + w > L0_COLS || row + h > L0_ROWS) return false;
  for (const it of items) {
    if (it.id === itemId) continue;
    const overlapX = col < it.col + it.w && col + w > it.col;
    const overlapY = row < it.row + it.h && row + h > it.row;
    if (overlapX && overlapY) return false;
  }
  return true;
}

export default function NestedGridCart() {
  const [items, setItems] = useState<L0Item[]>(SEED_ITEMS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDX, setDragDX] = useState(0);
  const [dragDY, setDragDY] = useState(0);
  const [targetCol, setTargetCol] = useState(0);
  const [targetRow, setTargetRow] = useState(0);
  const [targetValid, setTargetValid] = useState(true);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const draggingIdRef = useRef<string | null>(null);
  const startMouseX = useRef(0);
  const startMouseY = useRef(0);
  const startCol = useRef(0);
  const startRow = useRef(0);
  const dragWHRef = useRef({ w: 1, h: 1 });
  const frameRef = useRef<any>(null);

  const stopFrame = useCallback(() => {
    if (frameRef.current == null) return;
    clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const id = draggingIdRef.current;
    if (id == null) { stopFrame(); return; }
    const { w, h } = dragWHRef.current;
    const mx = readMouseX();
    const my = readMouseY();
    const dx = mx - startMouseX.current;
    const dy = my - startMouseY.current;

    if (!readMouseDown()) {
      const tcol = Math.max(0, Math.min(L0_COLS - w, Math.round(startCol.current + dx / L0_CELL_W)));
      const trow = Math.max(0, Math.min(L0_ROWS - h, Math.round(startRow.current + dy / L0_CELL_H)));
      if (fits(itemsRef.current, id, tcol, trow, w, h)) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, col: tcol, row: trow } : it));
      }
      draggingIdRef.current = null;
      setDragId(null);
      setDragDX(0);
      setDragDY(0);
      stopFrame();
      return;
    }

    setDragDX(dx);
    setDragDY(dy);
    const tcol = Math.max(0, Math.min(L0_COLS - w, Math.round(startCol.current + dx / L0_CELL_W)));
    const trow = Math.max(0, Math.min(L0_ROWS - h, Math.round(startRow.current + dy / L0_CELL_H)));
    setTargetCol(tcol);
    setTargetRow(trow);
    setTargetValid(fits(itemsRef.current, id, tcol, trow, w, h));
    frameRef.current = setTimeout(tick, 16);
  }, [stopFrame]);

  const beginDrag = useCallback((id: string) => {
    const it = itemsRef.current.find(i => i.id === id);
    if (!it) return;
    startCol.current = it.col;
    startRow.current = it.row;
    dragWHRef.current = { w: it.w, h: it.h };
    startMouseX.current = readMouseX();
    startMouseY.current = readMouseY();
    draggingIdRef.current = id;
    setDragId(id);
    setDragDX(0);
    setDragDY(0);
    setTargetCol(it.col);
    setTargetRow(it.row);
    setTargetValid(true);
    stopFrame();
    frameRef.current = setTimeout(tick, 16);
  }, [stopFrame, tick]);

  useEffect(() => () => stopFrame(), [stopFrame]);

  const dragItem = dragId ? items.find(i => i.id === dragId) ?? null : null;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: '#050507', alignItems: 'center', justifyContent: 'center' }}>
      <Box style={{ position: 'relative', width: ROOT_W, height: ROOT_H }}>
        <Grid cols={L0_COLS} rows={L0_ROWS} width={ROOT_W} height={ROOT_H} showGuides guideColor="#15151a" fill="#0a0a0e" border="#1f2937">
          {/* drop preview */}
          {dragItem ? (
            <Box style={{
              position: 'absolute',
              left: targetCol * L0_CELL_W,
              top: targetRow * L0_CELL_H,
              width: dragItem.w * L0_CELL_W,
              height: dragItem.h * L0_CELL_H,
              borderWidth: 2,
              borderColor: targetValid ? '#22c55e' : '#ef4444',
              backgroundColor: targetValid ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
              borderRadius: 4,
              zIndex: 50,
            }} />
          ) : null}
        </Grid>
        {/* draggable items live in a sibling absolute layer so dragDX/dragDY translate freely */}
        {items.map(it => {
          const isDragging = dragId === it.id;
          const left = it.col * L0_CELL_W + (isDragging ? dragDX : 0);
          const top = it.row * L0_CELL_H + (isDragging ? dragDY : 0);
          const width = it.w * L0_CELL_W;
          const height = it.h * L0_CELL_H;
          return (
            <Pressable
              key={it.id}
              onMouseDown={() => beginDrag(it.id)}
              style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                zIndex: isDragging ? 100 : 10,
                opacity: isDragging ? 0.95 : 1,
              }}
            >
              {/* Mount the body in a fresh root-sized Grid so the body's hardcoded
                  L0 coords (e.g. col=6 row=4) still render correctly inside the
                  Pressable. We translate the inner grid up-and-left so the body's
                  cell lands at the Pressable's (0,0). */}
              <Box style={{ position: 'absolute', left: -it.col * L0_CELL_W, top: -it.row * L0_CELL_H, width: ROOT_W, height: ROOT_H }}>
                <Grid cols={L0_COLS} rows={L0_ROWS} width={ROOT_W} height={ROOT_H}>
                  {it.body()}
                </Grid>
              </Box>
            </Pressable>
          );
        })}
      </Box>
    </Col>
  );
}
