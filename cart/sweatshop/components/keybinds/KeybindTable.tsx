import { Box, Col, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { KeybindConflictReport, KeybindAction } from '../../lib/keybinds/conflict-detect';

function KeybindRow(props: { action: KeybindAction; conflicted?: boolean }) {
  const tone = props.conflicted ? COLORS.warning : COLORS.textBright;
  const border = props.conflicted ? COLORS.warning : COLORS.border;
  const background = props.conflicted ? COLORS.panelAlt : COLORS.panelRaised;

  return (
    <Box style={{
      padding: 10,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: background,
      gap: 6,
    }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={tone} style={{ fontWeight: 'bold' }}>{props.action.label}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{props.action.category} · {props.action.id}</Text>
        </Col>
        <Text fontSize={10} color={tone} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{props.action.combo || 'Unbound'}</Text>
      </Row>
      <Text fontSize={10} color={COLORS.textSecondary}>{props.action.description}</Text>
    </Box>
  );
}

export function KeybindTable(props: { report: KeybindConflictReport }) {
  if (!props.report.all.length) {
    return (
      <Box style={{ padding: 16, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={11} color={COLORS.textDim}>No keybinds registered.</Text>
      </Box>
    );
  }

  return (
    <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
      {props.report.conflicts.map((group) => (
        <Box
          key={group.combo}
          style={{
            padding: 12,
            borderRadius: TOKENS.radiusMd,
            borderWidth: 1,
            borderColor: COLORS.warning,
            backgroundColor: COLORS.redDeep,
            gap: 10,
          }}
        >
          <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Col style={{ gap: 2 }}>
              <Text fontSize={10} color={COLORS.warning} style={{ letterSpacing: 0.7, fontWeight: 'bold' }}>CONFLICT</Text>
              <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{group.combo}</Text>
            </Col>
            <Text fontSize={10} color={COLORS.warning} style={{ fontFamily: 'monospace' }}>{group.actions.length} actions</Text>
          </Row>
          <Col style={{ gap: 8 }}>
            {group.actions.map((action) => (
              <KeybindRow key={action.id} action={action} conflicted />
            ))}
          </Col>
        </Box>
      ))}

      {props.report.clean.length ? (
        <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>CLEAN</Text>
          <Col style={{ gap: 8 }}>
            {props.report.clean.map((action) => (
              <KeybindRow key={action.id} action={action} />
            ))}
          </Col>
        </Box>
      ) : null}
    </ScrollView>
  );
}
