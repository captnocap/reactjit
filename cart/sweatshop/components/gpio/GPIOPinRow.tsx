const React: any = require('react');


import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useGPIO } from '../../lib/gpio';
import type { GPIOLineInfo } from '../../lib/gpio';

export function GPIOPinRow(props: { line: GPIOLineInfo }) {
  const { line } = props;
  const pin = useGPIO(line.chip, line.offset, line.direction);
  const mode = line.direction;

  const isHigh = pin.value;
  const tone = isHigh ? COLORS.green : COLORS.textDim;
  const usedClass = line.used ? COLORS.yellow : COLORS.textMuted;

  return (
    <Row
      style={{
        alignItems: 'center',
        gap: TOKENS.spaceSm,
        padding: TOKENS.padTight,
        borderBottomWidth: TOKENS.borderW,
        borderColor: COLORS.borderSoft,
      }}
    >
      {/* Status dot */}
      <Box
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isHigh ? COLORS.green : COLORS.grayDeep,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      />

      {/* Chip + offset */}
      <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.textMuted, width: 70, fontFamily: TOKENS.fontMono }}>
        {line.chip}:{line.offset}
      </Text>

      {/* Name */}
      <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.text, width: 120 }}>
        {line.name || 'unnamed'}
      </Text>

      {/* Consumer */}
      <Text style={{ fontSize: TOKENS.fontXs, color: usedClass, width: 90 }}>
        {line.consumer || (line.used ? 'used' : 'unused')}
      </Text>

      {/* Direction badge */}
      <Box
        style={{
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: mode === 'output' ? COLORS.blueDeep : COLORS.panelAlt,
          borderWidth: 1,
          borderColor: mode === 'output' ? COLORS.blue : COLORS.border,
        }}
      >
        <Text style={{ fontSize: TOKENS.fontXs, color: mode === 'output' ? COLORS.blue : COLORS.textDim }}>
          {mode}
        </Text>
      </Box>

      {/* Active-low badge */}
      {line.activeLow && (
        <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.yellow }}>¬</Text>
      )}

      <Box style={{ flexGrow: 1 }} />

      {/* Value control */}
      {mode === 'output' ? (
        <Pressable
          onClick={() => pin.toggle()}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: isHigh ? COLORS.greenDeep : COLORS.panelAlt,
            borderWidth: 1,
            borderColor: isHigh ? COLORS.green : COLORS.border,
          }}
        >
          <Text style={{ fontSize: TOKENS.fontXs, color: isHigh ? COLORS.green : COLORS.textDim, fontWeight: 'bold' }}>
            {isHigh ? 'HIGH' : 'LOW'}
          </Text>
        </Pressable>
      ) : (
        <Text style={{ fontSize: TOKENS.fontXs, color: tone, width: 40, textAlign: 'right' }}>
          {isHigh ? 'HIGH' : 'LOW'}
        </Text>
      )}

      {/* Error */}
      {pin.error && (
        <Text style={{ fontSize: TOKENS.fontXs, color: COLORS.red, maxWidth: 120 }}>
          {pin.error}
        </Text>
      )}
    </Row>
  );
}
