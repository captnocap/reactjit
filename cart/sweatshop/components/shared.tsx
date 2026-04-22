const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { iconLabel } from '../utils';
import { useHover } from '../anim';

function hexToRgb(hex: string): [number, number, number] | null {
  const value = String(hex || '').trim();
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const raw = match[1];
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return [r, g, b];
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('');
}

function brightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex([
    rgb[0] + (255 - rgb[0]) * amount,
    rgb[1] + (255 - rgb[1]) * amount,
    rgb[2] + (255 - rgb[2]) * amount,
  ]);
}

function mergeTransform(baseTransform: any, hoverScale: number, hovered: boolean): any {
  const next: any = hovered ? { scaleX: hoverScale, scaleY: hoverScale } : {};
  if (baseTransform && typeof baseTransform === 'object') {
    return { ...baseTransform, ...next };
  }
  return hovered ? next : baseTransform;
}

export function HoverPressable(props: any) {
  const [hoverHandlers, hovered] = useHover();
  const { hoverScale = 1.02, style = {}, children, ...rest } = props;
  const backgroundColor = hovered && typeof style.backgroundColor === 'string'
    ? brightenHex(style.backgroundColor, 0.06)
    : style.backgroundColor;
  const borderColor = hovered && typeof style.borderColor === 'string'
    ? brightenHex(style.borderColor, 0.14)
    : style.borderColor;
  const nextStyle = {
    ...style,
    backgroundColor,
    borderColor,
    transform: mergeTransform(style.transform, hoverScale, hovered),
  };

  return (
    <Pressable
      {...rest}
      onHoverEnter={hoverHandlers.onHoverEnter}
      onHoverExit={hoverHandlers.onHoverExit}
      onMouseEnter={hoverHandlers.onMouseEnter}
      onMouseLeave={hoverHandlers.onMouseLeave}
      style={nextStyle}
    >
      {children}
    </Pressable>
  );
}

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
    <HoverPressable
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
    </HoverPressable>
  );
}
