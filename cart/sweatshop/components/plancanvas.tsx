const React: any = require('react');
const { useState, useCallback, useMemo } = React;
import { Box, Col, Pressable, Row, Text, TextInput, Canvas } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import {
  authorColor,
  authorLabel,
  createPlanItem,
  deletePlanItem,
  movePlanItem,
  statusColor,
  updatePlanItem,
  type Plan,
  type PlanItem,
} from '../plan';

interface PlanCanvasProps {
  plan: Plan;
  workDir: string;
  onChange: () => void;
  onSendToAI: (msg: string) => void;
}

const STATUSES: PlanItem['status'][] = ['idea', 'todo', 'doing', 'done', 'blocked', 'review'];
const NODE_W = 170;
const NODE_H = 60;
const SEL_W = 220;
const SEL_H = 190;

function GridPaths() {
  const lines: any[] = [];
  const step = 100;
  const limit = 1000;
  for (let x = -limit; x <= limit; x += step) {
    lines.push(<Canvas.Path key={`v${x}`} d={`M ${x} ${-limit} L ${x} ${limit}`} stroke="#111820" strokeWidth={1} />);
  }
  for (let y = -limit; y <= limit; y += step) {
    lines.push(<Canvas.Path key={`h${y}`} d={`M ${-limit} ${y} L ${limit} ${y}`} stroke="#111820" strokeWidth={1} />);
  }
  return <>{lines}</>;
}

function PlanNode(props: any) {
  const { item, selected, onSelect, onUpdate, onMove, onDelete, onAddChild, onLinkFile } = props;
  const sColor = statusColor(item.status);
  const aColor = authorColor(item.author);

  if (selected) {
    return (
      <Canvas.Node gx={item.x} gy={item.y} gw={SEL_W} gh={SEL_H} onMove={(e: any) => onMove(e.gx, e.gy)}>
        <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelRaised, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.blue, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8, gap: 5 }}>
          <Row style={{ gap: 5, alignItems: 'center' }}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => onUpdate({ status: s })}>
                <Box style={{ width: 10, height: 10, borderRadius: TOKENS.radiusSm, backgroundColor: statusColor(s), borderWidth: item.status === s ? 2 : 0, borderColor: '#fff' }} />
              </Pressable>
            ))}
            <Box style={{ flexGrow: 1 }} />
            <Text fontSize={9} color={aColor} style={{ fontWeight: 'bold' }}>{authorLabel(item.author)}</Text>
          </Row>
          <TextInput
            value={item.text}
            onChangeText={(t: string) => onUpdate({ text: t })}
            style={{ fontSize: 11, color: COLORS.textBright, backgroundColor: COLORS.panelBg, borderRadius: TOKENS.radiusXs, paddingLeft: 4, paddingRight: 4, paddingTop: 3, paddingBottom: 3 }}
          />
          <TextInput
            value={item.note || ''}
            placeholder="note..."
            onChangeText={(t: string) => onUpdate({ note: t })}
            style={{ fontSize: 10, color: COLORS.textMuted, backgroundColor: COLORS.panelBg, borderRadius: TOKENS.radiusXs, paddingLeft: 4, paddingRight: 4, paddingTop: 3, paddingBottom: 3 }}
          />
          <Row style={{ gap: 5, flexWrap: 'wrap' }}>
            <Pressable onPress={onAddChild}>
              <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.blueDeep }}>
                <Text fontSize={9} color={COLORS.blue}>+ child</Text>
              </Box>
            </Pressable>
            <Pressable onPress={onLinkFile}>
              <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, backgroundColor: item.linkedFile ? COLORS.greenDeep : COLORS.grayChip }}>
                <Text fontSize={9} color={item.linkedFile ? COLORS.green : COLORS.textDim}>{item.linkedFile ? item.linkedFile.split('/').pop() : 'link'}</Text>
              </Box>
            </Pressable>
            <Pressable onPress={onDelete}>
              <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.redDeep }}>
                <Text fontSize={9} color={COLORS.red}>del</Text>
              </Box>
            </Pressable>
          </Row>
        </Box>
      </Canvas.Node>
    );
  }

  return (
    <Canvas.Node gx={item.x} gy={item.y} gw={NODE_W} gh={NODE_H} onMove={(e: any) => onMove(e.gx, e.gy)}>
      <Pressable onPress={onSelect} style={{ width: '100%', height: '100%' }}>
        <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelRaised, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, paddingLeft: 6, paddingRight: 6, paddingTop: 6, paddingBottom: 6, gap: 3 }}>
          <Row style={{ gap: 5, alignItems: 'center' }}>
            <Box style={{ width: 8, height: 8, borderRadius: TOKENS.radiusXs, backgroundColor: sColor }} />
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1 }} numberOfLines={1}>
              {item.text}
            </Text>
            <Text fontSize={9} color={aColor} style={{ fontWeight: 'bold' }}>{authorLabel(item.author)}</Text>
          </Row>
          {item.tags.length > 0 && (
            <Row style={{ gap: 3, flexWrap: 'wrap' }}>
              {item.tags.slice(0, 3).map((tag: string) => (
                <Box key={tag} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.grayChip }}>
                  <Text fontSize={7} color={COLORS.textMuted}>{tag}</Text>
                </Box>
              ))}
            </Row>
          )}
        </Box>
      </Pressable>
    </Canvas.Node>
  );
}

export function PlanCanvas(props: PlanCanvasProps) {
  const { plan, workDir, onChange, onSendToAI } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanItem['status'] | 'all'>('all');

  const filteredItems = useMemo(() => {
    if (filter === 'all') return plan.items;
    return plan.items.filter((i) => i.status === filter);
  }, [plan.items, filter]);

  const itemById = useMemo(() => {
    const map = new Map<string, PlanItem>();
    for (const it of plan.items) map.set(it.id, it);
    return map;
  }, [plan.items]);

  const handleUpdate = useCallback((itemId: string, updates: Partial<PlanItem>) => {
    updatePlanItem(plan.id, itemId, updates);
    onChange();
  }, [plan.id, onChange]);

  const handleMove = useCallback((itemId: string, x: number, y: number) => {
    movePlanItem(plan.id, itemId, x, y);
    onChange();
  }, [plan.id, onChange]);

  const handleDelete = useCallback((itemId: string) => {
    deletePlanItem(plan.id, itemId);
    setSelectedId(null);
    onChange();
  }, [plan.id, onChange]);

  const handleAddChild = useCallback((parentId: string) => {
    const parent = itemById.get(parentId);
    if (!parent) return;
    createPlanItem(plan.id, {
      text: 'New idea',
      status: 'idea',
      author: 'human',
      x: parent.x + 40,
      y: parent.y + 80,
      tags: [],
      parentId,
    });
    onChange();
  }, [plan.id, itemById, onChange]);

  const handleAddIdea = useCallback(() => {
    createPlanItem(plan.id, {
      text: 'New idea',
      status: 'idea',
      author: 'human',
      x: 40,
      y: 40,
      tags: [],
    });
    onChange();
  }, [plan.id, onChange]);

  const handleLinkFile = useCallback((itemId: string) => {
    const item = itemById.get(itemId);
    if (!item) return;
    handleUpdate(itemId, { linkedFile: item.linkedFile ? undefined : workDir });
  }, [handleUpdate, itemById, workDir]);

  const handleAskAI = useCallback(() => {
    const items = plan.items.map((i) => `- [${i.status}] ${i.text} (${i.author})`).join('\n');
    const msg = `Plan: ${plan.title}\n\n${items}\n\nWhat should we focus on next?`;
    onSendToAI(msg);
  }, [plan, onSendToAI]);

  const connections = useMemo(() => {
    const lines: any[] = [];
    for (const child of plan.items) {
      if (!child.parentId) continue;
      const parent = itemById.get(child.parentId);
      if (!parent) continue;
      const mx = parent.x + NODE_W / 2;
      const my = parent.y + NODE_H / 2;
      const cx = child.x + NODE_W / 2;
      const cy = child.y + NODE_H / 2;
      lines.push(
        <Canvas.Path
          key={`conn-${parent.id}-${child.id}`}
          d={`M ${mx} ${my} L ${cx} ${cy}`}
          stroke={COLORS.border}
          strokeWidth={1}
        />
      );
    }
    return lines;
  }, [plan.items, itemById]);

  return (
    <Canvas style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg }}>
      <GridPaths />
      {plan.items
        .filter((i) => i.author === 'ai')
        .map((i) => (
          <Canvas.Node key={`glow-${i.id}`} gx={i.x - 4} gy={i.y - 4} gw={NODE_W + 8} gh={NODE_H + 8}>
            <Box style={{ width: '100%', height: '100%', borderRadius: TOKENS.radiusMd, backgroundColor: 'rgba(210,168,255,0.06)' }} />
          </Canvas.Node>
        ))}
      {connections}
      {filteredItems.map((item) => (
        <PlanNode
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onSelect={() => setSelectedId(item.id)}
          onUpdate={(u: Partial<PlanItem>) => handleUpdate(item.id, u)}
          onMove={(x: number, y: number) => handleMove(item.id, x, y)}
          onDelete={() => handleDelete(item.id)}
          onAddChild={() => handleAddChild(item.id)}
          onLinkFile={() => handleLinkFile(item.id)}
        />
      ))}
      <Canvas.Clamp>
        <Box style={{ width: '100%', height: '100%', flexDirection: 'column' }}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8, gap: 5 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{plan.title}</Text>
            <Row style={{ gap: 5, flexWrap: 'wrap' }}>
              <Pressable onPress={handleAddIdea}>
                <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                  <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+ Add Idea</Text>
                </Box>
              </Pressable>
              {(['all', 'idea', 'todo', 'doing', 'done', 'blocked', 'review'] as const).map((s) => (
                <Pressable key={s} onPress={() => setFilter(s)}>
                  <Box style={{ paddingLeft: 7, paddingRight: 7, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, backgroundColor: filter === s ? COLORS.grayDeep : COLORS.panelAlt, borderWidth: 1, borderColor: filter === s ? statusColor(s) : COLORS.border }}>
                    <Text fontSize={9} color={filter === s ? statusColor(s) : COLORS.textDim}>{s}</Text>
                  </Box>
                </Pressable>
              ))}
              <Pressable onPress={handleAskAI}>
                <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.purpleDeep, borderWidth: 1, borderColor: COLORS.purple }}>
                  <Text fontSize={10} color={COLORS.purple} style={{ fontWeight: 'bold' }}>Ask AI</Text>
                </Box>
              </Pressable>
            </Row>
          </Box>
          <Box style={{ flexGrow: 1 }} />
        </Box>
      </Canvas.Clamp>
    </Canvas>
  );
}
