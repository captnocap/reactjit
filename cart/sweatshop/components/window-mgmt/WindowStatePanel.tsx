
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useMultiWindow } from './useMultiWindow';
import { PopOutButton } from './PopOutButton';

// Lists every panel the user has torn off into its own OS window.
//
// Honest about scope: `focus` and per-row `close` are labelled TODO until
// the host exposes `__windowFocus(id)` / `__windowCloseById(id)`. Until
// then, "drop" just forgets the local intent record — the OS window
// survives and the user closes it via its own chrome.
export function WindowStatePanel(props: { title?: string }) {
  const { openWindows, closePanel, closeAll, focusPanel, hostSupported } = useMultiWindow();

  return (
    <Col style={{
      gap: 8,
      padding: 10,
      borderRadius: TOKENS.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.purple} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>WINDOWS</Text>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }}>
          {props.title || 'Open windows'}
        </Text>
        <Pressable onPress={closeAll}>
          <Box style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusXs, borderWidth: 1,
            borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
          }}>
            <Text fontSize={9} color={COLORS.textDim}>Forget all</Text>
          </Box>
        </Pressable>
      </Row>

      {!hostSupported ? (
        <Box style={{
          padding: 8, borderRadius: TOKENS.radiusSm,
          borderWidth: 1, borderColor: COLORS.yellow,
          backgroundColor: COLORS.yellowDeep,
        }}>
          <Text fontSize={10} color={COLORS.yellow}>
            Host is missing __openWindow. Tear-off disabled until framework build ships it.
          </Text>
        </Box>
      ) : null}

      {openWindows.length === 0 ? (
        <Text fontSize={10} color={COLORS.textDim}>No panels torn off yet. Use the ⇱ handle on a panel header.</Text>
      ) : (
        <ScrollView style={{
          maxHeight: 180,
          borderWidth: 1, borderColor: COLORS.borderSoft,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.panelBg,
        }}>
          <Col style={{ padding: 4, gap: 3 }}>
            {openWindows.map((record) => (
              <Row key={record.id} style={{
                alignItems: 'center', gap: 6,
                padding: 4, borderRadius: TOKENS.radiusXs,
                backgroundColor: COLORS.panelAlt,
              }}>
                <Col style={{ flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={COLORS.text} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>
                    {record.title}
                  </Text>
                  <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
                    {record.panelId} · {record.width}×{record.height}
                  </Text>
                </Col>
                <Pressable onPress={() => focusPanel(record.id)}>
                  <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, opacity: 0.55 }}>
                    <Text fontSize={9} color={COLORS.textDim}>focus · TODO</Text>
                  </Box>
                </Pressable>
                <PopOutButton panelId={record.panelId} title={record.title} compact={true} />
                <Pressable onPress={() => closePanel(record.id)}>
                  <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                    <Text fontSize={9} color={COLORS.red}>drop</Text>
                  </Box>
                </Pressable>
              </Row>
            ))}
          </Col>
        </ScrollView>
      )}
    </Col>
  );
}
