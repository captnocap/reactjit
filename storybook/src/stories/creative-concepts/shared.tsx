import React from 'react';
import { Box, Pressable, Text } from '../../../../packages/core/src';

export const CREATIVE_COLORS = {
  ink: '#07111f',
  panel: '#0d1728',
  panelRaised: '#13203a',
  panelSoft: '#182742',
  stroke: 'rgba(255,255,255,0.08)',
  strokeStrong: 'rgba(255,255,255,0.18)',
  text: '#f7f9fc',
  textSoft: 'rgba(247,249,252,0.72)',
  textDim: 'rgba(247,249,252,0.46)',
  accent: '#f97316',
  accentSoft: 'rgba(249,115,22,0.16)',
  cyan: '#22d3ee',
  cyanSoft: 'rgba(34,211,238,0.16)',
  green: '#34d399',
  greenSoft: 'rgba(52,211,153,0.15)',
  blue: '#60a5fa',
  blueSoft: 'rgba(96,165,250,0.16)',
  rose: '#fb7185',
  roseSoft: 'rgba(251,113,133,0.14)',
  gold: '#fbbf24',
  goldSoft: 'rgba(251,191,36,0.15)',
  violet: '#a78bfa',
  violetSoft: 'rgba(167,139,250,0.16)',
};

export function Panel({
  children,
  accentColor,
  style,
}: {
  children: React.ReactNode;
  accentColor?: string;
  style?: Record<string, any>;
}) {
  return (
    <Box
      style={{
        backgroundColor: CREATIVE_COLORS.panel,
        borderWidth: 1,
        borderColor: accentColor || CREATIVE_COLORS.stroke,
        borderRadius: 12,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

export function SectionEyebrow({
  label,
  color = CREATIVE_COLORS.accent,
}: {
  label: string;
  color?: string;
}) {
  return (
    <Text
      style={{
        color,
        fontSize: 9,
        fontWeight: 'bold',
        letterSpacing: 0.8,
      }}
    >
      {label.toUpperCase()}
    </Text>
  );
}

export function ActionChip({
  label,
  active,
  onPress,
  color = CREATIVE_COLORS.accent,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress}>
      <Box
        style={{
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? color : CREATIVE_COLORS.stroke,
          backgroundColor: active ? `${color}22` : 'rgba(255,255,255,0.02)',
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
        }}
      >
        <Text
          style={{
            color: active ? color : CREATIVE_COLORS.textSoft,
            fontSize: 9,
            fontWeight: active ? 'bold' : 'normal',
          }}
        >
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}

export function FrameButton({
  label,
  onPress,
  active,
  tone = 'default',
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  tone?: 'default' | 'accent' | 'soft';
}) {
  const borderColor =
    tone === 'accent'
      ? CREATIVE_COLORS.accent
      : tone === 'soft'
        ? CREATIVE_COLORS.blue
        : CREATIVE_COLORS.strokeStrong;
  const textColor =
    tone === 'accent'
      ? CREATIVE_COLORS.accent
      : tone === 'soft'
        ? CREATIVE_COLORS.blue
        : CREATIVE_COLORS.textSoft;

  return (
    <Pressable onPress={onPress}>
      <Box
        style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor,
          backgroundColor: active ? 'rgba(255,255,255,0.05)' : 'transparent',
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 7,
          paddingBottom: 7,
        }}
      >
        <Text
          style={{
            color: textColor,
            fontSize: 10,
            fontWeight: 'bold',
          }}
        >
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}

export function MeterBar({
  value,
  color,
  backgroundColor = 'rgba(255,255,255,0.06)',
  height = 6,
}: {
  value: number;
  color: string;
  backgroundColor?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <Box
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor,
      }}
    >
      <Box
        style={{
          width: `${Math.round(clamped * 100)}%`,
          height,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
    </Box>
  );
}

export function StatTile({
  label,
  value,
  note,
  color,
}: {
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  return (
    <Box
      style={{
        flexGrow: 1,
        flexBasis: 0,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: CREATIVE_COLORS.stroke,
        borderRadius: 10,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 4,
      }}
    >
      <SectionEyebrow label={label} color={color} />
      <Text style={{ color: CREATIVE_COLORS.text, fontSize: 22, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: CREATIVE_COLORS.textDim, fontSize: 9 }}>{note}</Text>
    </Box>
  );
}

export function Divider() {
  return <Box style={{ width: '100%', height: 1, backgroundColor: CREATIVE_COLORS.stroke }} />;
}
