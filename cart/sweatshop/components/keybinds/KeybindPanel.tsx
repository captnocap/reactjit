import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { detectKeybindConflicts } from '../../lib/keybinds/conflict-detect';
import { KeybindTable } from './KeybindTable';
import { useKeybindStore } from '../keybind-editor/useKeybindStore';

export function KeybindPanel() {
  const store = useKeybindStore();
  const report = React.useMemo(
    () => detectKeybindConflicts(store.bindings, store.commands),
    [store.bindings, store.commands],
  );

  const conflictCount = report.conflicts.length;
  const totalCount = report.all.length;

  return (
    <Col style={{ flexGrow: 1, gap: 12, minHeight: 0 }}>
      <Box style={{
        padding: 14,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: conflictCount > 0 ? COLORS.warning : COLORS.border,
        backgroundColor: conflictCount > 0 ? COLORS.redDeep : COLORS.panelRaised,
        gap: 8,
      }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={10} color={conflictCount > 0 ? COLORS.warning : COLORS.textDim} style={{ letterSpacing: 0.7, fontWeight: 'bold' }}>
              KEYBIND VISUALIZER
            </Text>
            <Text fontSize={18} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {conflictCount > 0 ? `${conflictCount} conflicts detected` : 'All clean'}
            </Text>
            <Text fontSize={11} color={COLORS.textSecondary}>
              {totalCount} registered shortcuts are being read live from the keybind store.
            </Text>
          </Col>
          <Text fontSize={10} color={conflictCount > 0 ? COLORS.warning : COLORS.textDim} style={{ fontFamily: 'monospace' }}>
            {report.clean.length} clean
          </Text>
        </Row>
      </Box>

      <KeybindTable report={report} />
    </Col>
  );
}
