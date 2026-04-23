const React: any = require('react');


import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { usePWM } from '../../lib/gpio';

export function GPIOPWMControl(props: { chip: string; line: number }) {
  const { chip, line } = props;
  const pwm = usePWM(chip, line);

  return (
    <Box
      style={{
        padding: TOKENS.padNormal,
        borderWidth: TOKENS.borderW,
        borderColor: COLORS.border,
        borderRadius: TOKENS.radiusMd,
        backgroundColor: COLORS.panelRaised,
        marginBottom: TOKENS.spaceSm,
      }}
    >
      <Row style={{ alignItems: 'center', gap: TOKENS.spaceSm, marginBottom: TOKENS.spaceSm }}>
        <Text style={{ fontSize: TOKENS.fontSm, color: COLORS.textBright, fontWeight: 'bold' }}>
          Software PWM
        </Text>
        <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, fontFamily: TOKENS.fontMono }}>
          {chip}:{line}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable
          onClick={() => pwm.setEnabled(!pwm.enabled)}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: pwm.enabled ? COLORS.greenDeep : COLORS.panelAlt,
            borderWidth: 1,
            borderColor: pwm.enabled ? COLORS.green : COLORS.border,
          }}
        >
          <Text style={{ fontSize: TOKENS.fontXs, color: pwm.enabled ? COLORS.green : COLORS.textDim, fontWeight: 'bold' }}>
            {pwm.enabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </Row>

      <Row style={{ alignItems: 'center', gap: TOKENS.spaceMd, flexWrap: 'wrap' }}>
        {/* Duty */}
        <Row style={{ alignItems: 'center', gap: TOKENS.spaceSm }}>
          <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textDim, width: 30 }}>Duty</Text>
          <Pressable
            onClick={() => {
              const next = Math.max(0, Math.round(pwm.duty * 100) - 10);
              pwm.setDuty(next / 100);
            }}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: COLORS.panelAlt,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text }}>-</Text>
          </Pressable>
          <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text, width: 36, textAlign: 'center', fontFamily: TOKENS.fontMono }}>
            {Math.round(pwm.duty * 100)}%
          </Text>
          <Pressable
            onClick={() => {
              const next = Math.min(100, Math.round(pwm.duty * 100) + 10);
              pwm.setDuty(next / 100);
            }}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: COLORS.panelAlt,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text }}>+</Text>
          </Pressable>
        </Row>

        {/* Frequency */}
        <Row style={{ alignItems: 'center', gap: TOKENS.spaceSm }}>
          <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textDim, width: 30 }}>Freq</Text>
          <Pressable
            onClick={() => {
              const next = Math.max(1, pwm.frequency - 100);
              pwm.setFrequency(next);
            }}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: COLORS.panelAlt,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text }}>-</Text>
          </Pressable>
          <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text, width: 50, textAlign: 'center', fontFamily: TOKENS.fontMono }}>
            {pwm.frequency}Hz
          </Text>
          <Pressable
            onClick={() => {
              const next = Math.min(10000, pwm.frequency + 100);
              pwm.setFrequency(next);
            }}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: COLORS.panelAlt,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text }}>+</Text>
          </Pressable>
        </Row>
      </Row>

      {pwm.error && (
        <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.red, marginTop: TOKENS.spaceSm }}>
          {pwm.error}
        </Text>
      )}

      <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, marginTop: TOKENS.spaceSm }}>
        Software PWM via gpioset at 20 Hz update rate. Suitable for LEDs, not motors or servos.
      </Text>
    </Box>
  );
}
