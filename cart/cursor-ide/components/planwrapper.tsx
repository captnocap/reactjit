const React: any = require('react');
const { useState, useMemo } = React;

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { PlanCanvas } from './plancanvas';
import { loadPlans, createPlan, type Plan } from '../plan';
import { Pill } from './shared';

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
      <Box style={{ width: 360, height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text fontSize={13} color={COLORS.textMuted}>No plans yet</Text>
        <Pressable onPress={handleCreate} style={{ padding: 10, borderRadius: TOKENS.radiusMd, backgroundColor: COLORS.blueDeep }}>
          <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Create Plan</Text>
        </Pressable>
      </Box>
    );
  }

  return (
    <Box style={{ width: 360, height: '100%', flexDirection: 'column', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ flexShrink: 0, alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderColor: COLORS.border }}>
        <Pressable onPress={() => setShowList(!showList)}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{activePlan.title}</Text>
        </Pressable>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={handleCreate}>
          <Pill label="+" color={COLORS.blue} tiny={true} />
        </Pressable>
      </Row>
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
      <Box style={{ flexGrow: 1 }}>
        <PlanCanvas plan={activePlan} workDir={props.workDir} onChange={handleChange} onSendToAI={props.onSendToAI} />
      </Box>
    </Box>
  );
}
