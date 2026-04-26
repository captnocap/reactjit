import { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Col, Row, Text, Pressable } from '../runtime/primitives';

const COLS = 4;
const ROWS = 3;
const TILE = 120;
const GAP = 16;
const BOARD_W = COLS * TILE + (COLS - 1) * GAP;
const BOARD_H = ROWS * TILE + (ROWS - 1) * GAP;

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#a855f7', '#f43f5e', '#84cc16',
];

const host: any = globalThis as any;

function readMouseX(): number {
  try { const v = Number(host.getMouseX?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
function readMouseY(): number {
  try { const v = Number(host.getMouseY?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
function readMouseDown(): boolean {
  try { return !!host.getMouseDown?.(); } catch { return false; }
}

function slotPos(slot: number) {
  const col = slot % COLS;
  const row = Math.floor(slot / COLS);
  return { x: col * (TILE + GAP), y: row * (TILE + GAP) };
}

function slotForPoint(localX: number, localY: number): number {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor(localX / (TILE + GAP) + 0.0001)));
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(localY / (TILE + GAP) + 0.0001)));
  return row * COLS + col;
}

type Tile = { id: number; color: string; label: string };

function makeTiles(): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    out.push({ id: i, color: PALETTE[i % PALETTE.length], label: String(i + 1) });
  }
  return out;
}

export default function TileDragCart() {
  const [order, setOrder] = useState<number[]>(() => makeTiles().map((t) => t.id));
  const [tiles] = useState<Tile[]>(() => makeTiles());
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragDX, setDragDX] = useState(0);
  const [dragDY, setDragDY] = useState(0);

  const startMouseX = useRef(0);
  const startMouseY = useRef(0);
  const startSlot = useRef(0);
  const orderRef = useRef<number[]>(order);
  const draggingIdRef = useRef<number | null>(null);
  const frameRef = useRef<any>(null);

  orderRef.current = order;

  const stopFrame = useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = host.cancelAnimationFrame?.bind(host);
    if (cancel) cancel(frameRef.current); else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const scheduleFrame = useCallback((tick: () => void) => {
    const raf = host.requestAnimationFrame?.bind(host);
    if (raf) frameRef.current = raf(tick);
    else frameRef.current = setTimeout(tick, 16);
  }, []);

  const tick = useCallback(() => {
    const id = draggingIdRef.current;
    if (id == null) { stopFrame(); return; }

    if (!readMouseDown()) {
      draggingIdRef.current = null;
      setDragId(null);
      setDragDX(0);
      setDragDY(0);
      stopFrame();
      return;
    }

    const mx = readMouseX();
    const my = readMouseY();
    const dx = mx - startMouseX.current;
    const dy = my - startMouseY.current;
    setDragDX(dx);
    setDragDY(dy);

    const origin = slotPos(startSlot.current);
    const centerLocalX = origin.x + TILE / 2 + dx;
    const centerLocalY = origin.y + TILE / 2 + dy;
    const targetSlot = slotForPoint(centerLocalX, centerLocalY);

    const cur = orderRef.current;
    const fromIndex = cur.indexOf(id);
    if (fromIndex !== -1 && targetSlot !== fromIndex) {
      const next = cur.slice();
      next.splice(fromIndex, 1);
      next.splice(targetSlot, 0, id);
      orderRef.current = next;
      setOrder(next);
      const newPos = slotPos(targetSlot);
      const oldPos = slotPos(fromIndex);
      startMouseX.current += newPos.x - oldPos.x;
      startMouseY.current += newPos.y - oldPos.y;
      startSlot.current = targetSlot;
      setDragDX(mx - startMouseX.current);
      setDragDY(my - startMouseY.current);
    }

    scheduleFrame(tick);
  }, [scheduleFrame, stopFrame]);

  const beginDrag = useCallback((id: number) => {
    const cur = orderRef.current;
    const slot = cur.indexOf(id);
    if (slot < 0) return;
    startSlot.current = slot;
    startMouseX.current = readMouseX();
    startMouseY.current = readMouseY();
    draggingIdRef.current = id;
    setDragId(id);
    setDragDX(0);
    setDragDY(0);
    stopFrame();
    scheduleFrame(tick);
  }, [scheduleFrame, stopFrame, tick]);

  useEffect(() => () => stopFrame(), [stopFrame]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: '#0e0e12', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ color: '#e5e7eb', fontSize: 14 }}>drag tiles to rearrange</Text>
      <Text style={{ color: '#9ca3af', fontSize: 11 }}>dragId={dragId == null ? 'none' : String(dragId)} dx={Math.round(dragDX)} dy={Math.round(dragDY)}</Text>
      <Box style={{ width: BOARD_W, height: BOARD_H, position: 'relative', backgroundColor: '#17171d', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a33' }}>
        {tiles.map((t) => {
          const slot = order.indexOf(t.id);
          const pos = slotPos(slot);
          const isDragging = dragId === t.id;
          const left = pos.x + (isDragging ? dragDX : 0);
          const top = pos.y + (isDragging ? dragDY : 0);
          return (
            <Pressable
              key={t.id}
              onMouseDown={() => beginDrag(t.id)}
              style={{
                position: 'absolute',
                left,
                top,
                width: TILE,
                height: TILE,
                backgroundColor: t.color,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isDragging ? 100 : 1,
                opacity: isDragging ? 0.92 : 1,
                borderWidth: isDragging ? 2 : 0,
                borderColor: '#ffffff',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </Box>
    </Col>
  );
}
