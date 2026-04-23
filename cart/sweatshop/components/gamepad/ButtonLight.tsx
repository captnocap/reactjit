// =============================================================================
// ButtonLight — single gamepad button, lit when pressed
// =============================================================================

import { Box, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ButtonId } from '../../lib/gamepad/types';

export interface ButtonLightProps {
  button: ButtonId;
  /** short label to display — usually matches button but can be overridden. */
  label?: string;
  pressed: boolean;
  /** visual tint when lit — defaults to theme accent. */
  tone?: string;
  /** circular face-button look vs square dpad/shoulder look. */
  shape?: 'circle' | 'square';
}

export function ButtonLight(props: ButtonLightProps) {
  const { button, pressed } = props;
  const tone = props.tone ?? COLORS.blue;
  const shape = props.shape ?? 'circle';
  const size = 32;
  const radius = shape === 'circle' ? size / 2 : TOKENS.radiusSm;

  return (
    <Box style={{
      width: size, height: size,
      borderRadius: radius,
      borderWidth: pressed ? 2 : 1,
      borderColor: pressed ? tone : COLORS.border,
      backgroundColor: pressed ? tone : COLORS.panelAlt,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text fontSize={10}
        color={pressed ? COLORS.textBright : COLORS.textDim}
        style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
        {props.label ?? labelFor(button)}
      </Text>
    </Box>
  );
}

function labelFor(b: ButtonId): string {
  if (b === 'leftshoulder')  return 'LB';
  if (b === 'rightshoulder') return 'RB';
  if (b === 'leftstick')     return 'L3';
  if (b === 'rightstick')    return 'R3';
  if (b === 'dpup')    return '↑';
  if (b === 'dpdown')  return '↓';
  if (b === 'dpleft')  return '←';
  if (b === 'dpright') return '→';
  if (b === 'guide')   return 'Ⓖ';
  return b.toUpperCase();
}
