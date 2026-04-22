// =============================================================================
// GamepadPanel — live gamepad surface, visible-gap banner when host is unbound
// =============================================================================
// Composes ControllerList + GamepadVisualizer + InputMapPanel + a rumble test
// row. Visible banner above everything when useGamepad reports bound=false,
// so the surface is honest when the __gamepad_* host fns are pending.
// =============================================================================

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useGamepad } from '../../lib/gamepad/useGamepad';
import { useHaptic } from '../../lib/gamepad/useHaptic';
import { ControllerList } from './ControllerList';
import { GamepadVisualizer } from './GamepadVisualizer';
import { InputMapPanel } from './InputMapPanel';

export function GamepadPanel() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const { state, bridge } = useGamepad({ id: activeId ?? undefined });
  const haptic = useHaptic(state.id);

  // When the bridge is up and the user hasn't picked a controller yet, pin to
  // whatever useGamepad auto-picked (state.id set by polling list()[0]).
  useEffect(() => {
    if (activeId === null && state.id >= 0) setActiveId(state.id);
  }, [state.id, activeId]);

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: 10, gap: 10 }}>
        {!bridge.bound ? (
          <Box style={{
            padding: 10, borderRadius: TOKENS.radiusSm,
            borderWidth: 1, borderColor: COLORS.orange,
            backgroundColor: COLORS.orangeDeep, gap: 4,
          }}>
            <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text fontSize={10} color={COLORS.orange} style={{ fontWeight: 'bold', letterSpacing: 0.5 }}>BRIDGE MISSING</Text>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Gamepad host fn bindings pending — connect a controller later.</Text>
            </Row>
            <Text fontSize={9} color={COLORS.text}>{bridge.gap}</Text>
            <Text fontSize={9} color={COLORS.textDim}>The Input map editor below still works — bind actions now, the runtime will pick them up when __gamepad_list / __gamepad_state land.</Text>
          </Box>
        ) : (
          <Box style={{
            padding: 8, borderRadius: TOKENS.radiusSm,
            borderWidth: 1, borderColor: COLORS.green,
            backgroundColor: COLORS.greenDeep,
          }}>
            <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text fontSize={10} color={COLORS.green} style={{ fontWeight: 'bold' }}>BRIDGE BOUND</Text>
              <Text fontSize={10} color={COLORS.text}>
                {state.id >= 0
                  ? 'active: #' + state.id + ' · ' + (state.name || 'unnamed') + ' · frame ' + state.frame
                  : 'no controller detected — plug one in'}
              </Text>
              <Box style={{ flexGrow: 1 }} />
              {haptic.available && state.id >= 0 ? (
                <Pressable onPress={() => haptic.rumble({ low: 0.6, high: 0.6, durationMs: 250 })}
                  style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.purple, backgroundColor: COLORS.purpleDeep }}>
                  <Text fontSize={9} color={COLORS.purple} style={{ fontWeight: 'bold' }}>rumble 250ms</Text>
                </Pressable>
              ) : null}
            </Row>
          </Box>
        )}

        <ControllerList activeId={activeId} onSelect={(id) => setActiveId(id)} bound={bridge.bound} />
        <GamepadVisualizer state={state} />
        <InputMapPanel state={state} />
      </Col>
    </ScrollView>
  );
}
