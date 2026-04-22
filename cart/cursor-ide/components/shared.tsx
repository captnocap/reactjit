const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { iconLabel } from '../utils';

export function Glyph(props: { icon: string; tone?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 4 : 5,
        paddingRight: props.tiny ? 4 : 5,
        paddingTop: props.tiny ? 2 : 3,
        paddingBottom: props.tiny ? 2 : 3,
        borderRadius: props.tiny ? TOKENS.radiusSm : TOKENS.radiusMd,
        backgroundColor: props.backgroundColor || COLORS.grayChip,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: props.tiny ? 18 : 22,
      }}
    >
      <Text fontSize={props.tiny ? 8 : 9} color={props.tone || COLORS.textBright} style={{ fontWeight: 'bold' }}>
        {iconLabel(props.icon)}
      </Text>
    </Box>
  );
}

export function Pill(props: { label: string; color?: string; borderColor?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 6 : 8,
        paddingRight: props.tiny ? 6 : 8,
        paddingTop: props.tiny ? 3 : 5,
        paddingBottom: props.tiny ? 3 : 5,
        borderRadius: TOKENS.radiusPill,
        borderWidth: TOKENS.borderW,
        borderColor: props.borderColor || COLORS.border,
        backgroundColor: props.backgroundColor || COLORS.panelAlt,
      }}
    >
      <Text fontSize={props.tiny ? 9 : 10} color={props.color || COLORS.text}>
        {props.label}
      </Text>
    </Box>
  );
}

export function HeaderButton(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: props.compact ? 0 : 6,
        paddingLeft: props.compact ? 8 : 10,
        paddingRight: props.compact ? 8 : 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: TOKENS.radiusLg,
        borderWidth: TOKENS.borderW,
        borderColor: active ? COLORS.blue : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Glyph icon={props.icon} tone={active ? COLORS.blue : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      {!props.compact && (
        <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
          {props.label}
        </Text>
      )}
      {!props.compact && props.meta ? (
        <Text fontSize={9} color={COLORS.textDim}>
          {props.meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

