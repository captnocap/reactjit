// =============================================================================
// GamepadVisualizer — full controller layout wired to live state
// =============================================================================
// Face cluster (A/B/X/Y) on the right, DPAD diamond on the left, shoulders
// + triggers on top, meta row (back/guide/start) in the middle, twin sticks
// beneath. Every lit button + axis offset is real state from the host — no
// synthetic data.
// =============================================================================

import { Box, Col, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { GamepadState } from '../../lib/gamepad/types';
import {
  DPAD_BUTTONS, FACE_BUTTONS, META_BUTTONS, SHOULDER_BUTTONS,
} from '../../lib/gamepad/types';
import { ButtonLight } from './ButtonLight';
import { StickView } from './StickView';

export interface GamepadVisualizerProps {
  state: GamepadState;
}

function TriggerBar(props: { label: string; value: number; tone: string }) {
  // triggers in SDL arrive 0..1. Negative-biased controllers sometimes report
  // -1..1 — clamp to 0..1 for the bar fill regardless.
  const v = Math.max(0, Math.min(1, props.value ?? 0));
  return (
    <Col style={{ gap: 2, alignItems: 'center' }}>
      <Box style={{
        width: 64, height: 10,
        borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelBg, overflow: 'hidden',
      }}>
        <Box style={{
          width: (v * 100) + '%', height: '100%',
          backgroundColor: props.tone,
        }} />
      </Box>
      <Row style={{ gap: 4, alignItems: 'center' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{props.label}</Text>
        <Text fontSize={8} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}</Text>
      </Row>
    </Col>
  );
}

export function GamepadVisualizer(props: GamepadVisualizerProps) {
  const { buttons, axes } = props.state;

  return (
    <Col style={{
      gap: 14, padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      {/* Top row: triggers + shoulders */}
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <TriggerBar label="LT" value={axes.triggerleft  ?? 0} tone={COLORS.purple} />
          {SHOULDER_BUTTONS.filter((b) => b === 'leftshoulder' || b === 'leftstick').map((b) => (
            <ButtonLight key={b} button={b} pressed={!!buttons[b]} shape="square" tone={COLORS.blue} />
          ))}
        </Row>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          {SHOULDER_BUTTONS.filter((b) => b === 'rightshoulder' || b === 'rightstick').map((b) => (
            <ButtonLight key={b} button={b} pressed={!!buttons[b]} shape="square" tone={COLORS.blue} />
          ))}
          <TriggerBar label="RT" value={axes.triggerright ?? 0} tone={COLORS.purple} />
        </Row>
      </Row>

      {/* Middle row: dpad / meta / face cluster */}
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        {/* DPAD diamond */}
        <Col style={{ gap: 4, alignItems: 'center' }}>
          <ButtonLight button="dpup"    pressed={!!buttons.dpup}    shape="square" tone={COLORS.green} />
          <Row style={{ gap: 32 }}>
            <ButtonLight button="dpleft"  pressed={!!buttons.dpleft}  shape="square" tone={COLORS.green} />
            <ButtonLight button="dpright" pressed={!!buttons.dpright} shape="square" tone={COLORS.green} />
          </Row>
          <ButtonLight button="dpdown"  pressed={!!buttons.dpdown}  shape="square" tone={COLORS.green} />
        </Col>

        {/* Meta row */}
        <Col style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>system</Text>
          <Row style={{ gap: 6 }}>
            {META_BUTTONS.map((b) => (
              <ButtonLight key={b} button={b} pressed={!!buttons[b]} tone={b === 'guide' ? COLORS.orange : COLORS.textMuted} />
            ))}
          </Row>
        </Col>

        {/* Face cluster Y-top, A-bottom, X-left, B-right */}
        <Col style={{ gap: 4, alignItems: 'center' }}>
          <ButtonLight button="y" pressed={!!buttons.y} tone={COLORS.yellow} />
          <Row style={{ gap: 32 }}>
            <ButtonLight button="x" pressed={!!buttons.x} tone={COLORS.blue} />
            <ButtonLight button="b" pressed={!!buttons.b} tone={COLORS.red} />
          </Row>
          <ButtonLight button="a" pressed={!!buttons.a} tone={COLORS.green} />
        </Col>
      </Row>

      {/* Bottom row: sticks */}
      <Row style={{ alignItems: 'center', justifyContent: 'space-around', gap: 18, flexWrap: 'wrap' }}>
        <StickView label="left stick"  x={axes.leftx  ?? 0} y={axes.lefty  ?? 0} tone={COLORS.blue} />
        <StickView label="right stick" x={axes.rightx ?? 0} y={axes.righty ?? 0} tone={COLORS.purple} />
      </Row>

      {/* Tiny debug row — face-button list for discoverability */}
      <Row style={{ gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>live buttons:</Text>
        {FACE_BUTTONS.concat(DPAD_BUTTONS).concat(SHOULDER_BUTTONS).concat(META_BUTTONS).map((b) => (
          <Text key={b} fontSize={9}
            color={buttons[b] ? COLORS.textBright : COLORS.textDim}
            style={{ fontFamily: 'monospace' }}>
            {b}{buttons[b] ? '●' : '·'}
          </Text>
        ))}
      </Row>
    </Col>
  );
}
