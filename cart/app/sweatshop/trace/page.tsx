// Trace — score after the music.
//
// Per docs/03-sequencer-plan-trace.md: the trace is what actually happened
// during a run, replayed against the plan. Not a log dump — a structural
// review surface where you can see which passes fired, which cells were
// dropped, where the playhead stalled, and what the agent narrated.
//
// This file is a placeholder. The real review surface lands when runs
// produce trace records. For now: an empty-state showing what *would*
// be shown, anchored to the persisted user/goal context.

import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { useUser, useLatestGoal } from '../data';

export default function TracePage() {
  const user = useUser();
  const goal = useLatestGoal();
  const name = user.data?.displayName ?? '';
  const goalText = goal.data[0]?.statement ?? null;

  return (
    <Col style={{ flexGrow: 1, padding: 24, gap: 24, backgroundColor: 'theme:bg' }}>
      <Row style={{ alignItems: 'baseline', gap: 12 }}>
        <Text size={20} color="theme:ink" bold={true}>Trace</Text>
        <Text size={11} color="theme:inkMuted">score after the music</Text>
      </Row>

      <Box style={{
        flexGrow: 1,
        padding: 32,
        backgroundColor: 'theme:surface',
        borderColor: 'theme:lineSoft',
        borderWidth: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Col style={{ gap: 8, alignItems: 'center' }}>
          <Text size={14} color="theme:ink" bold={true}>No runs yet</Text>
          <Text size={11} color="theme:inkMuted">
            {name ? `${name}, sweep the sequencer to commit a plan.` : 'Sweep the sequencer to commit a plan.'}
          </Text>
          {goalText ? (
            <Text size={10} color="theme:inkMuted" style={{ marginTop: 12 }}>
              {`Pinned goal: ${goalText}`}
            </Text>
          ) : null}
        </Col>
      </Box>
    </Col>
  );
}
