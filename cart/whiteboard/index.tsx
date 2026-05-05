import { useMemo, useRef, useState } from 'react';
import { Box, Canvas, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';

type Tool = 'select' | 'pen' | 'rect' | 'ellipse' | 'diamond' | 'text';
type BoardItem =
  | { id: string; kind: 'rect' | 'ellipse' | 'diamond'; x: number; y: number; w: number; h: number; stroke: string; fill: string; label?: string }
  | { id: string; kind: 'text'; x: number; y: number; w: number; h: number; text: string; color: string }
  | { id: string; kind: 'stroke'; points: Point[]; color: string; width: number };
type Point = { x: number; y: number };

const COLORS = {
  app: '#f5f7fb',
  ink: '#111827',
  dim: '#667085',
  panel: '#ffffff',
  rule: '#d8dee9',
  accent: '#2563eb',
  accentSoft: '#dbeafe',
  green: '#16a34a',
  orange: '#f59e0b',
  red: '#dc2626',
  purple: '#7c3aed',
  cyan: '#0891b2',
  board: '#0b111a',
  grid: '#263241',
  gridMajor: '#3b4a5c',
};

const START_ITEMS: BoardItem[] = [
  { id: 'rect-1', kind: 'rect', x: 132, y: 94, w: 240, h: 116, stroke: COLORS.accent, fill: '#eff6ff', label: 'Plan' },
  { id: 'diamond-1', kind: 'diamond', x: 462, y: 92, w: 150, h: 120, stroke: COLORS.orange, fill: '#fff7ed', label: 'Decision' },
  { id: 'ellipse-1', kind: 'ellipse', x: 368, y: 310, w: 210, h: 104, stroke: COLORS.green, fill: '#f0fdf4', label: 'Outcome' },
  { id: 'text-1', kind: 'text', x: 86, y: 292, w: 300, h: 116, text: 'Drag objects. Pick a tool, then click the canvas to add more.', color: COLORS.ink },
  { id: 'stroke-1', kind: 'stroke', color: '#ff3b30', width: 5, points: [{ x: 466, y: 252 }, { x: 512, y: 322 }, { x: 616, y: 298 }, { x: 732, y: 382 }] },
];

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999).toString(36)}`;
}

function pathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`;
}

function diamondPath(w: number, h: number): string {
  return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
}

function ellipsePath(w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  return `M 0 ${ry} C 0 ${ry * 0.45} ${rx * 0.45} 0 ${rx} 0 C ${rx * 1.55} 0 ${w} ${ry * 0.45} ${w} ${ry} C ${w} ${ry * 1.55} ${rx * 1.55} ${h} ${rx} ${h} C ${rx * 0.45} ${h} 0 ${ry * 1.55} 0 ${ry} Z`;
}

function strokeBounds(points: Point[], pad = 18) {
  if (points.length === 0) return { x: 0, y: 0, w: pad * 2, h: pad * 2 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(32, maxX - minX + pad * 2),
    h: Math.max(32, maxY - minY + pad * 2),
  };
}

function Button(props: { label: string; active?: boolean; onPress: () => void; tone?: string }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: props.active ? COLORS.accent : COLORS.rule,
        backgroundColor: props.active ? COLORS.accentSoft : COLORS.panel,
      }}
    >
      <Text fontSize={11} color={props.tone ?? (props.active ? COLORS.accent : COLORS.ink)} style={{ fontWeight: props.active ? 700 : 600 }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

function ShapeItem(props: { item: Extract<BoardItem, { kind: 'rect' | 'ellipse' | 'diamond' }>; selected: boolean; onMove: (x: number, y: number) => void; onSelect: () => void }) {
  const item = props.item;
  return (
    <Canvas.Node gx={item.x} gy={item.y} gw={item.w} gh={item.h} onMove={(evt: any) => props.onMove(evt.gx, evt.gy)}>
      <Pressable onPress={props.onSelect} style={{ width: '100%', height: '100%' }}>
        <Box style={{ width: '100%', height: '100%', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
          {item.kind === 'rect' ? (
            <Box style={{ position: 'absolute', inset: 0, borderRadius: 8, borderWidth: props.selected ? 3 : 2, borderColor: item.stroke, backgroundColor: item.fill }} />
          ) : item.kind === 'ellipse' ? (
            <Box style={{ position: 'absolute', inset: 0, borderRadius: 999, borderWidth: props.selected ? 3 : 2, borderColor: item.stroke, backgroundColor: item.fill }} />
          ) : (
            <>
              <Box style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff01' }} />
              <Canvas.Path d={diamondPath(item.w, item.h)} stroke={item.stroke} strokeWidth={props.selected ? 3 : 2} fill={item.fill} />
            </>
          )}
          {item.label ? (
            <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 6, backgroundColor: '#ffffffee', borderWidth: 1, borderColor: item.stroke }}>
              <Text fontSize={17} color={COLORS.ink} style={{ fontWeight: 800 }}>{item.label}</Text>
            </Box>
          ) : null}
        </Box>
      </Pressable>
    </Canvas.Node>
  );
}

function StrokeItem(props: { item: Extract<BoardItem, { kind: 'stroke' }>; selected: boolean; onMove: (points: Point[]) => void; onSelect: () => void }) {
  const item = props.item;
  const bounds = strokeBounds(item.points, Math.max(18, item.width * 3));
  const localPoints = item.points.map((point) => ({ x: point.x - bounds.x, y: point.y - bounds.y }));
  return (
    <Canvas.Node
      gx={bounds.x}
      gy={bounds.y}
      gw={bounds.w}
      gh={bounds.h}
      onMove={(evt: any) => {
        const dx = Number(evt.gx ?? bounds.x) - bounds.x;
        const dy = Number(evt.gy ?? bounds.y) - bounds.y;
        props.onMove(item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })));
      }}
    >
      <Pressable onPress={props.onSelect} style={{ width: '100%', height: '100%' }}>
        <Box style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, borderWidth: props.selected ? 1 : 0, borderColor: COLORS.accent, backgroundColor: props.selected ? '#ffffff12' : '#ffffff01' }}>
          <Canvas.Path d={pathFromPoints(localPoints)} stroke={item.color} strokeWidth={item.width} fill="none" />
        </Box>
      </Pressable>
    </Canvas.Node>
  );
}

function TextItem(props: { item: Extract<BoardItem, { kind: 'text' }>; selected: boolean; onMove: (x: number, y: number) => void; onSelect: () => void }) {
  const item = props.item;
  return (
    <Canvas.Node gx={item.x} gy={item.y} gw={item.w} gh={item.h} onMove={(evt: any) => props.onMove(evt.gx, evt.gy)}>
      <Pressable onPress={props.onSelect} style={{ width: '100%', height: '100%' }}>
        <Box style={{ width: '100%', height: '100%', padding: 12, borderRadius: 8, borderWidth: props.selected ? 2 : 1, borderColor: props.selected ? COLORS.accent : '#cbd5e1', backgroundColor: '#fffffff2' }}>
          <Text fontSize={18} color={item.color} style={{ lineHeight: 25, fontWeight: 800 }}>{item.text}</Text>
        </Box>
      </Pressable>
    </Canvas.Node>
  );
}

export default function WhiteboardCart() {
  const [items, setItems] = useState<BoardItem[]>(START_ITEMS);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>('rect-1');
  const [draftText, setDraftText] = useState('New idea');
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const drawingRef = useRef<Point[] | null>(null);
  const drawingIdRef = useRef<string | null>(null);

  const updateItem = (id: string, patch: Partial<any>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } as BoardItem : item)));
  };

  const selected = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);
  const renderItems = useMemo(() => {
    const strokes = items.filter((item) => item.kind === 'stroke');
    const rest = items.filter((item) => item.kind !== 'stroke');
    return [...strokes, ...rest];
  }, [items]);

  const screenToBoard = (evt: any): Point => {
    const x = Number(evt?.x ?? evt?.clientX ?? viewport.width / 2);
    const y = Number(evt?.y ?? evt?.clientY ?? viewport.height / 2);
    return { x, y };
  };

  const addShape = (kind: 'rect' | 'ellipse' | 'diamond', at?: Point) => {
    const point = at ?? { x: Math.round(Math.random() * 260 - 130), y: Math.round(Math.random() * 180 - 90) };
    const palette = kind === 'rect'
      ? { stroke: COLORS.accent, fill: '#eff6ff', label: 'Box' }
      : kind === 'diamond'
        ? { stroke: COLORS.orange, fill: '#fff7ed', label: 'Choice' }
        : { stroke: COLORS.green, fill: '#f0fdf4', label: 'Bubble' };
    const item: BoardItem = { id: nextId(kind), kind, x: point.x, y: point.y, w: kind === 'diamond' ? 146 : 210, h: kind === 'diamond' ? 122 : 104, ...palette };
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const addText = (at?: Point) => {
    const point = at ?? { x: -80, y: -40 };
    const item: BoardItem = { id: nextId('text'), kind: 'text', x: point.x, y: point.y, w: 260, h: 82, text: draftText.trim() || 'Text', color: COLORS.ink };
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
  };

  const handleCanvasPress = (evt: any) => {
    if (tool === 'rect' || tool === 'ellipse' || tool === 'diamond') addShape(tool, screenToBoard(evt));
    if (tool === 'text') addText(screenToBoard(evt));
  };

  const toolbarTools: { id: Tool; label: string }[] = [
    { id: 'select', label: 'Select' },
    { id: 'pen', label: 'Pen' },
    { id: 'rect', label: 'Rect' },
    { id: 'ellipse', label: 'Ellipse' },
    { id: 'diamond', label: 'Diamond' },
    { id: 'text', label: 'Text' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.app }}>
      <Row style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, gap: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: COLORS.rule, backgroundColor: COLORS.panel }}>
        <Text fontSize={14} color={COLORS.ink} style={{ fontWeight: 800, marginRight: 8 }}>Whiteboard</Text>
        {toolbarTools.map((entry) => <Button key={entry.id} label={entry.label} active={tool === entry.id} onPress={() => setTool(entry.id)} />)}
        <Box style={{ width: 1, height: 28, backgroundColor: COLORS.rule, marginLeft: 4, marginRight: 4 }} />
        <Button label="+ Shape" onPress={() => addShape('rect')} />
        <Button label="Reset" tone={COLORS.red} onPress={() => { setItems(START_ITEMS); setSelectedId('rect-1'); }} />
        <Box style={{ flexGrow: 1, flexBasis: 0 }} />
        <TextInput
          value={draftText}
          onChangeText={setDraftText}
          placeholder="Text"
          style={{ width: 180, height: 32, paddingLeft: 9, paddingRight: 9, borderRadius: 7, borderWidth: 1, borderColor: COLORS.rule, backgroundColor: '#fbfcff', color: COLORS.ink, fontSize: 12 }}
        />
        <Text fontSize={11} color={COLORS.dim}>{selected ? `${selected.kind} selected` : `${items.length} items`}</Text>
      </Row>
      <Box
        onLayout={(layout: any) => {
          const width = Math.max(1, Number(layout?.width ?? layout?.layout?.width ?? 1));
          const height = Math.max(1, Number(layout?.height ?? layout?.layout?.height ?? 1));
          setViewport((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        }}
        style={{ position: 'relative', width: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0, overflow: 'hidden' }}
      >
        <Canvas
          style={{ width: '100%', height: '100%', backgroundColor: COLORS.board }}
          gridStep={64}
          gridStroke={1}
          gridColor={COLORS.grid}
          gridMajorColor={COLORS.gridMajor}
          gridMajorEvery={4}
        >
          {renderItems.map((item) => {
            if (item.kind === 'stroke') {
              return <StrokeItem key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} onMove={(points) => updateItem(item.id, { points })} />;
            }
            if (item.kind === 'text') {
              return <TextItem key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} onMove={(x, y) => updateItem(item.id, { x, y })} />;
            }
            return <ShapeItem key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} onMove={(x, y) => updateItem(item.id, { x, y })} />;
          })}
        </Canvas>
        {tool !== 'select' ? (
          <Pressable
            onPress={handleCanvasPress}
            onPointerDown={(evt: any) => {
              if (tool !== 'pen') return;
              const point = screenToBoard(evt);
              drawingRef.current = [point];
              const stroke: BoardItem = { id: nextId('stroke'), kind: 'stroke', points: [point], color: COLORS.purple, width: 4 };
              drawingIdRef.current = stroke.id;
              setItems((current) => [...current, stroke]);
              setSelectedId(stroke.id);
            }}
            onPointerMove={(evt: any) => {
              if (tool !== 'pen' || !drawingRef.current || !drawingIdRef.current) return;
              const point = screenToBoard(evt);
              const prev = drawingRef.current[drawingRef.current.length - 1];
              if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 3) return;
              drawingRef.current = [...drawingRef.current, point];
              updateItem(drawingIdRef.current, { points: drawingRef.current });
            }}
            onPointerUp={() => {
              drawingRef.current = null;
              drawingIdRef.current = null;
            }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#00000000',
            }}
          />
        ) : null}
        <Box style={{ position: 'absolute', left: 14, bottom: 14, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 7, borderWidth: 1, borderColor: COLORS.rule, backgroundColor: '#ffffffdd' }}>
          <Text fontSize={11} color={COLORS.dim}>Canvas pans and zooms through the host; objects stay draggable in canvas space.</Text>
        </Box>
      </Box>
    </Box>
  );
}
