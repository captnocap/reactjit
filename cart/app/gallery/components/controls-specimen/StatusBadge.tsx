import { Box, Row } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor, toneSoftBackground } from './controlsSpecimenTheme';

export type StatusBadgeProps = {
  label: string;
  tone?: ControlTone;
  variant?: 'outline' | 'solid' | 'led' | 'pill' | 'dot';
};

export function StatusBadge({
  label,
  tone = 'accent',
  variant = 'outline',
}: StatusBadgeProps) {
  const color = toneColor(tone);
  const rounded = variant === 'pill' || variant === 'dot';
  const solid = variant === 'solid';

  if (variant === 'led' || variant === 'dot') {
    return (
      <Row
        style={{
          gap: 8,
          alignItems: 'center',
          paddingLeft: rounded ? 10 : 8,
          paddingRight: rounded ? 10 : 8,
          paddingTop: 5,
          paddingBottom: 5,
          borderWidth: 1,
          borderColor: color,
          borderRadius: rounded ? 6 : 0,
          backgroundColor: toneSoftBackground(tone),
        }}
      >
        <Box
          style={{
            width: variant === 'dot' ? 6 : 8,
            height: variant === 'dot' ? 6 : 8,
            borderRadius: variant === 'dot' ? 3 : 4,
            backgroundColor: color,
          }}
        />
        <Mono color={color} fontSize={9} fontWeight="bold" letterSpacing={1.4} lineHeight={10} noWrap>
          {label}
        </Mono>
      </Row>
    );
  }

  return (
    <Box
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        borderWidth: 1,
        borderColor: color,
        borderRadius: rounded ? 999 : 0,
        backgroundColor: solid ? color : toneSoftBackground(tone),
      }}
    >
      <Mono color={solid ? CTRL.bg : color} fontSize={9} fontWeight="bold" letterSpacing={1.4} lineHeight={10} noWrap>
        {label}
      </Mono>
    </Box>
  );
}
