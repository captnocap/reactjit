const React: any = require('react');

import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { GAME_DEFS } from '../../lib/game-servers/catalog';
import { HoverPressable } from '../shared';

export function GamePicker(props: { value: string; onChange: (gameId: string) => void }) {
  return (
    <Col style={{ gap: 8 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 1.2, fontWeight: 'bold' }}>GAME</Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {GAME_DEFS.map((game) => {
          const active = game.id === props.value;
          return (
            <HoverPressable
              key={game.id}
              onPress={() => props.onChange(game.id)}
              style={{
                minWidth: 118,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: TOKENS.radiusLg,
                borderWidth: 1,
                borderColor: active ? COLORS.blue : COLORS.border,
                backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
              }}
            >
              <Row style={{ alignItems: 'center', gap: 8 }}>
                <Box style={{
                  width: 24, height: 24, borderRadius: 12,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: active ? COLORS.blue : COLORS.grayChip,
                }}>
                  <Text fontSize={9} color={active ? COLORS.blueDeep : COLORS.textBright} style={{ fontWeight: 'bold' }}>{game.icon}</Text>
                </Box>
                <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={active ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{game.title}</Text>
                  <Text fontSize={9} color={COLORS.textDim}>{game.description}</Text>
                </Col>
              </Row>
              <Row style={{ justifyContent: 'space-between', gap: 4, marginTop: 6 }}>
                <Text fontSize={8} color={COLORS.textDim} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{game.protocol}</Text>
                <Text fontSize={8} color={COLORS.textDim} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>{game.engine}</Text>
              </Row>
            </HoverPressable>
          );
        })}
      </Row>
    </Col>
  );
}
