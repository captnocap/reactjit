import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Col, Row, Text, Pressable } from '@reactjit/runtime/primitives';

const COLS = 8;
const ROWS = 8;
const CELL = 80;
const GAP = 4;
const STEP = CELL + GAP;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;

const host: any = globalThis as any;

function readMouseX(): number { try { const v = Number(host.getMouseX?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; } }
function readMouseY(): number { try { const v = Number(host.getMouseY?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; } }
function readMouseDown(): boolean { try { return !!host.getMouseDown?.(); } catch { return false; } }

type Kind = 'header' | 'title' | 'badge' | 'icon' | 'avatar' | 'stat' | 'tags' | 'text' | 'quote' | 'button' | 'meter';

interface Item {
  id: string;
  kind: Kind;
  col: number;
  row: number;
  w: number;
  h: number;
  data: any;
}

const COLORS = {
  bg: '#0a0a0e',
  board: '#101015',
  cell: '#17171e',
  border: '#2a2a33',
  panel: '#1c1c24',
  text: '#e5e7eb',
  dim: '#9ca3af',
  accent: '#ec4899',
  ok: '#22c55e',
  bad: '#ef4444',
};

// Top half (rows 0-4) is densely packed; bottom half (rows 5-7) has
// breathing room so cards have somewhere to go when rearranging.
const SEED: Item[] = [
  { id: 'h1', kind: 'header', col: 0, row: 0, w: 4, h: 1, data: { title: 'PROFILE', subtitle: 'Engineer · Berlin' } },
  { id: 'b1', kind: 'badge', col: 4, row: 0, w: 1, h: 1, data: { text: 'PRO', color: '#22c55e' } },
  { id: 'b2', kind: 'badge', col: 5, row: 0, w: 1, h: 1, data: { text: 'VIP', color: '#a855f7' } },
  { id: 'i1', kind: 'icon', col: 6, row: 0, w: 1, h: 1, data: { glyph: '★', tint: '#eab308' } },
  { id: 'i2', kind: 'icon', col: 7, row: 0, w: 1, h: 1, data: { glyph: '♦', tint: '#06b6d4' } },
  { id: 'av', kind: 'avatar', col: 0, row: 1, w: 2, h: 2, data: { initials: 'JS', name: 'J. Stone' } },
  { id: 't1', kind: 'title', col: 2, row: 1, w: 3, h: 1, data: { text: 'Senior Designer' } },
  { id: 's1', kind: 'stat', col: 5, row: 1, w: 1, h: 2, data: { label: 'LVL', value: '47' } },
  { id: 's2', kind: 'stat', col: 6, row: 1, w: 1, h: 2, data: { label: 'DPS', value: '1.2k' } },
  { id: 's3', kind: 'stat', col: 7, row: 1, w: 1, h: 2, data: { label: 'HP', value: '99%' } },
  { id: 'tg', kind: 'tags', col: 2, row: 2, w: 3, h: 1, data: { tags: ['react', 'zig', 'typescript'] } },
  { id: 'tx', kind: 'text', col: 0, row: 3, w: 3, h: 2, data: { body: 'Forged in late-night merge conflicts and high-noon production deploys. Occasional ranter about typography.' } },
  { id: 'qt', kind: 'quote', col: 3, row: 3, w: 3, h: 2, data: { text: 'shipping is a feature.', author: '— anon' } },
  { id: 'bt', kind: 'button', col: 6, row: 3, w: 2, h: 1, data: { label: 'HIRE', tint: '#3b82f6' } },
  { id: 'mt1', kind: 'meter', col: 6, row: 4, w: 2, h: 1, data: { label: 'XP', value: 0.72, color: '#22c55e' } },
  { id: 'b3', kind: 'badge', col: 0, row: 5, w: 1, h: 1, data: { text: 'NEW', color: '#f97316' } },
  { id: 'i3', kind: 'icon', col: 1, row: 5, w: 1, h: 1, data: { glyph: '♪', tint: '#84cc16' } },
  { id: 'mt2', kind: 'meter', col: 4, row: 5, w: 2, h: 1, data: { label: 'MANA', value: 0.40, color: '#3b82f6' } },
  { id: 'bt2', kind: 'button', col: 0, row: 7, w: 2, h: 1, data: { label: 'CHAT', tint: '#ec4899' } },
  { id: 'b4', kind: 'badge', col: 3, row: 7, w: 1, h: 1, data: { text: 'OG', color: '#14b8a6' } },
];

function fits(items: Item[], itemId: string, col: number, row: number, w: number, h: number): boolean {
  if (col < 0 || row < 0 || col + w > COLS || row + h > ROWS) return false;
  for (const it of items) {
    if (it.id === itemId) continue;
    const overlapX = col < it.col + it.w && col + w > it.col;
    const overlapY = row < it.row + it.h && row + h > it.row;
    if (overlapX && overlapY) return false;
  }
  return true;
}

function ItemContent({ item }: { item: Item }) {
  const d = item.data;
  switch (item.kind) {
    case 'header':
      return (
        <Col style={{ flexGrow: 1, padding: 10, justifyContent: 'center', gap: 2 }}>
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>{d.title}</Text>
          <Text style={{ color: COLORS.dim, fontSize: 11 }}>{d.subtitle}</Text>
        </Col>
      );
    case 'title':
      return (
        <Col style={{ flexGrow: 1, padding: 10, justifyContent: 'center' }}>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: 600 }}>{d.text}</Text>
        </Col>
      );
    case 'badge':
      return (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: d.color, borderRadius: 4 }}>
          <Text style={{ color: '#0a0a0e', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{d.text}</Text>
        </Col>
      );
    case 'icon':
      return (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: d.tint, fontSize: 30 }}>{d.glyph}</Text>
        </Col>
      );
    case 'avatar':
      return (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Box style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{d.initials}</Text>
          </Box>
          <Text style={{ color: COLORS.text, fontSize: 12 }}>{d.name}</Text>
        </Col>
      );
    case 'stat':
      return (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Text style={{ color: COLORS.dim, fontSize: 9, letterSpacing: 1 }}>{d.label}</Text>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>{d.value}</Text>
        </Col>
      );
    case 'tags':
      return (
        <Row style={{ flexGrow: 1, alignItems: 'center', paddingLeft: 8, paddingRight: 8, gap: 6 }}>
          {d.tags.map((tag: string, i: number) => (
            <Box key={i} style={{ paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ color: COLORS.text, fontSize: 10 }}>{tag}</Text>
            </Box>
          ))}
        </Row>
      );
    case 'text':
      return (
        <Col style={{ flexGrow: 1, padding: 10 }}>
          <Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 18 }}>{d.body}</Text>
        </Col>
      );
    case 'quote':
      return (
        <Row style={{ flexGrow: 1 }}>
          <Box style={{ width: 3, backgroundColor: COLORS.accent }} />
          <Col style={{ flexGrow: 1, padding: 12, justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: COLORS.text, fontSize: 14, fontStyle: 'italic' }}>{`"${d.text}"`}</Text>
            <Text style={{ color: COLORS.dim, fontSize: 10 }}>{d.author}</Text>
          </Col>
        </Row>
      );
    case 'button':
      return (
        <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: d.tint, borderRadius: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>{d.label}</Text>
        </Col>
      );
    case 'meter':
      return (
        <Col style={{ flexGrow: 1, padding: 8, justifyContent: 'center', gap: 5 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: COLORS.dim, fontSize: 9, letterSpacing: 1 }}>{d.label}</Text>
            <Text style={{ color: COLORS.text, fontSize: 9 }}>{`${Math.round(d.value * 100)}%`}</Text>
          </Row>
          <Box style={{ height: 6, backgroundColor: '#0a0a0e', borderRadius: 3 }}>
            <Box style={{ width: `${Math.round(d.value * 100)}%`, height: 6, backgroundColor: d.color, borderRadius: 3 }} />
          </Box>
        </Col>
      );
  }
}

export default function CardGridCart() {
  const [items, setItems] = useState<Item[]>(() => SEED.map(s => ({ ...s })));
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

  const scheduleFrame = useCallback((fn: () => void) => {
    frameRef.current = setTimeout(fn, 16);
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
      const tcol = Math.max(0, Math.min(COLS - w, Math.round(startCol.current + dx / STEP)));
      const trow = Math.max(0, Math.min(ROWS - h, Math.round(startRow.current + dy / STEP)));
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
    const tcol = Math.max(0, Math.min(COLS - w, Math.round(startCol.current + dx / STEP)));
    const trow = Math.max(0, Math.min(ROWS - h, Math.round(startRow.current + dy / STEP)));
    setTargetCol(tcol);
    setTargetRow(trow);
    setTargetValid(fits(itemsRef.current, id, tcol, trow, w, h));
    scheduleFrame(tick);
  }, [scheduleFrame, stopFrame]);

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
    scheduleFrame(tick);
  }, [scheduleFrame, stopFrame, tick]);

  useEffect(() => () => stopFrame(), [stopFrame]);

  const dragItem = dragId ? items.find(i => i.id === dragId) : null;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
      <Text style={{ color: COLORS.dim, fontSize: 11, letterSpacing: 3 }}>INVENTORY · DRAG TO REARRANGE</Text>
      <Box style={{ width: BOARD_W, height: BOARD_H, position: 'relative', backgroundColor: COLORS.board, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6 }}>
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          return (
            <Box key={`bg-${i}`} style={{
              position: 'absolute',
              left: c * STEP,
              top: r * STEP,
              width: CELL,
              height: CELL,
              backgroundColor: COLORS.cell,
              borderRadius: 2,
            }} />
          );
        })}
        {dragItem ? (
          <Box style={{
            position: 'absolute',
            left: targetCol * STEP,
            top: targetRow * STEP,
            width: dragItem.w * CELL + (dragItem.w - 1) * GAP,
            height: dragItem.h * CELL + (dragItem.h - 1) * GAP,
            borderWidth: 2,
            borderColor: targetValid ? COLORS.ok : COLORS.bad,
            backgroundColor: targetValid ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            borderRadius: 4,
            zIndex: 50,
          }} />
        ) : null}
        {items.map(it => {
          const isDragging = dragId === it.id;
          const left = it.col * STEP + (isDragging ? dragDX : 0);
          const top = it.row * STEP + (isDragging ? dragDY : 0);
          const w = it.w * CELL + (it.w - 1) * GAP;
          const h = it.h * CELL + (it.h - 1) * GAP;
          return (
            <Pressable
              key={it.id}
              onMouseDown={() => beginDrag(it.id)}
              style={{
                position: 'absolute',
                left,
                top,
                width: w,
                height: h,
                backgroundColor: COLORS.panel,
                borderWidth: 1,
                borderColor: isDragging ? COLORS.accent : COLORS.border,
                borderRadius: 4,
                zIndex: isDragging ? 100 : 10,
                opacity: isDragging ? 0.95 : 1,
                overflow: 'hidden',
              }}
            >
              <ItemContent item={it} />
            </Pressable>
          );
        })}
      </Box>
    </Col>
  );
}
