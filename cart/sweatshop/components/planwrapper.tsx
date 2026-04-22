const React: any = require('react');
const { useState, useMemo } = React;

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { PlanCanvas } from './plancanvas';
import { loadPlans, createPlan, createPlanItem, type Plan } from '../plan';
import { Pill } from './shared';

const PANEL_WIDTH = 360;

function PlanHeader(props: { title: string; subtitle: string; onAction?: () => void; actionLabel?: string; onToggleList?: () => void }) {
  return (
    <Col style={{ flexShrink: 0, gap: 6, padding: 12, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold', letterSpacing: 2 }}>◆ PLAN</Text>
        <Box style={{ flexGrow: 1 }} />
        {props.onAction ? (
          <Pressable onPress={props.onAction}>
            <Box style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{props.actionLabel || '+ New Plan'}</Text>
            </Box>
          </Pressable>
        ) : null}
      </Row>
      <Pressable onPress={props.onToggleList}>
        <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text>
      </Pressable>
      <Text fontSize={10} color={COLORS.textMuted}>{props.subtitle}</Text>
    </Col>
  );
}

function EmptyFlowPanel(props: { primaryLabel: string; onPrimary: () => void; steps: { n: string; title: string; body: string; tone: string }[] }) {
  return (
    <Col style={{ flexGrow: 1, padding: 16, gap: 14, justifyContent: 'flex-start' }}>
      <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>How the plan panel works</Text>
      <Text fontSize={11} color={COLORS.textMuted}>Scratch out a task, then spawn workers against it and track their progress here — all without leaving the editor.</Text>
      <Col style={{ gap: 10 }}>
        {props.steps.map((s) => (
          <Row key={s.n} style={{ gap: 10, alignItems: 'flex-start' }}>
            <Box style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.tone, alignItems: 'center', justifyContent: 'center' }}>
              <Text fontSize={10} color={COLORS.appBg} style={{ fontWeight: 'bold' }}>{s.n}</Text>
            </Box>
            <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{s.title}</Text>
              <Text fontSize={10} color={COLORS.textDim}>{s.body}</Text>
            </Col>
          </Row>
        ))}
      </Col>
      <Pressable onPress={props.onPrimary}>
        <Box style={{ padding: 10, borderRadius: TOKENS.radiusMd, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue, alignItems: 'center' }}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{props.primaryLabel}</Text>
        </Box>
      </Pressable>
    </Col>
  );
}

const FLOW_STEPS = [
  { n: '1', title: 'Plan a task',      body: 'Drop an idea on the canvas. Link files, break it into children, tag it.',       tone: COLORS.blue },
  { n: '2', title: 'Spawn workers',    body: 'Send the plan to the AI — it branches into subtasks and assigns them.',          tone: COLORS.purple },
  { n: '3', title: 'Track progress',   body: 'Statuses flow idea → todo → doing → done; blocked and review keep things honest.', tone: '#7ee787' },
];

export function PlanPanelWrapper(props: { workDir: string; activePlanId: string; onChange: (id: string) => void; onSendToAI: (msg: string) => void }) {
  const plans = useMemo(() => loadPlans(), []);
  const [planList, setPlanList] = useState<Plan[]>(plans);
  const [showList, setShowList] = useState(false);

  const activePlan = planList.find(p => p.id === props.activePlanId) || planList[0];

  function handleCreate() {
    const newPlan = createPlan('New Plan');
    const next = [...planList, newPlan];
    setPlanList(next);
    props.onChange(newPlan.id);
    setShowList(false);
  }

  function handleChange() {
    if (activePlan) {
      const next = planList.map(p => p.id === activePlan.id ? activePlan : p);
      setPlanList(next);
    }
  }

  if (!activePlan) {
    return (
      <Box style={{ width: PANEL_WIDTH, height: '100%', flexDirection: 'column', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
        <PlanHeader title="No plan selected" subtitle="Create one to start thinking out loud, then let the AI run with it." onAction={handleCreate} actionLabel="+ New Plan" />
        <EmptyFlowPanel primaryLabel="Create your first plan" onPrimary={handleCreate} steps={FLOW_STEPS} />
      </Box>
    );
  }

  const itemCount = activePlan.items.length;
  const subtitle = itemCount === 0
    ? 'Plan a task → spawn workers → track progress. Add your first idea to start.'
    : 'Plan a task → spawn workers → track progress · ' + itemCount + ' ' + (itemCount === 1 ? 'item' : 'items');

  return (
    <Box style={{ width: PANEL_WIDTH, height: '100%', flexDirection: 'column', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <PlanHeader title={activePlan.title} subtitle={subtitle} onAction={handleCreate} actionLabel="+ New Plan" onToggleList={() => setShowList(!showList)} />
      {showList && (
        <Col style={{ gap: 4, padding: 10, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
          {planList.map(p => (
            <Pressable key={p.id} onPress={() => { props.onChange(p.id); setShowList(false); }} style={{ padding: 8, borderRadius: TOKENS.radiusSm, backgroundColor: p.id === activePlan.id ? COLORS.panelHover : 'transparent' }}>
              <Text fontSize={10} color={COLORS.textBright}>{p.title}</Text>
              <Text fontSize={9} color={COLORS.textDim}>{p.items.length} items</Text>
            </Pressable>
          ))}
        </Col>
      )}
      {itemCount === 0 ? (
        <EmptyFlowPanel primaryLabel="+ Add your first idea" onPrimary={() => {
          createPlanItem(activePlan.id, { text: 'New idea', status: 'idea', author: 'human', x: 40, y: 40, tags: [] });
          setPlanList(loadPlans());
        }} steps={FLOW_STEPS} />
      ) : (
        <Box style={{ flexGrow: 1 }}>
          <PlanCanvas plan={activePlan} workDir={props.workDir} onChange={handleChange} onSendToAI={props.onSendToAI} />
        </Box>
      )}
    </Box>
  );
}
