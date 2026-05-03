// Composer — the canvas surface.
//
// Per docs/02-canvas-and-substrates.md: the canvas is the *open scene*. No
// chat box at the bottom, no fixed layout. Three palette tiers (capabilities,
// domain nodes, rules/effects) compose freely. Composition is structural;
// useIFTTT is reactive. Both coexist.
//
// This file is a placeholder. The real canvas lands here when the substrate
// surfaces are ready. For now: prove data continuity (the goal node knows
// what the user typed at onboarding) and lay out the tier hint.

import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { useUser, useLatestGoal } from './data';

const TIERS = [
  { id: 'capability', label: 'Capability palette', hint: 'runtime/hooks/* — sensors, sources, effects' },
  { id: 'domain',     label: 'Domain nodes',       hint: 'component-gallery shapes — Goal, Connection, Workspace' },
  { id: 'rules',      label: 'Rules & effects',    hint: 'useIFTTT — reactive substrate over the structure' },
];

function GoalNode() {
  const goal = useLatestGoal();
  const text = goal.data[0]?.statement ?? '(no goal set)';
  return (
    <Col style={{
      backgroundColor: 'theme:surface',
      borderColor: 'theme:line',
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      width: 360,
    }}>
      <Text size={11} color="theme:inkMuted" bold={true}>GOAL</Text>
      <Text size={16} color="theme:ink">{text}</Text>
      <Text size={10} color="theme:inkMuted">review socket — pinned to the run</Text>
    </Col>
  );
}

function TierHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Col style={{
      backgroundColor: 'theme:surfaceSubtle',
      borderColor: 'theme:lineSoft',
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 4,
      flexGrow: 1,
    }}>
      <Text size={11} color="theme:ink" bold={true}>{label}</Text>
      <Text size={10} color="theme:inkMuted">{hint}</Text>
    </Col>
  );
}

export default function ComposerPage() {
  const user = useUser();
  const name = user.data?.displayName ?? '';
  return (
    <Col style={{ flexGrow: 1, padding: 24, gap: 24, backgroundColor: 'theme:bg' }}>
      <Row style={{ alignItems: 'baseline', gap: 12 }}>
        <Text size={20} color="theme:ink" bold={true}>Canvas</Text>
        <Text size={11} color="theme:inkMuted">
          {name ? `${name}'s open scene` : 'open scene — nothing required, everything composes'}
        </Text>
      </Row>

      <Box style={{
        flexGrow: 1,
        borderColor: 'theme:lineSoft',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 32,
        backgroundColor: 'theme:bg',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <GoalNode />
      </Box>

      <Row style={{ gap: 12 }}>
        {TIERS.map((t) => (
          <TierHint key={t.id} label={t.label} hint={t.hint} />
        ))}
      </Row>
    </Col>
  );
}
