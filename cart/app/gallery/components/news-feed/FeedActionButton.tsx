import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';

export type FeedActionButtonProps = {
  icon: IconData;
  label: string;
  count?: number;
  active?: boolean;
  color?: string;
  onPress?: () => void;
};

const COLORS = {
  idle: '#8c7d68',
  activeBg: '#271912',
};

function formatCount(value: number | undefined): string {
  if (typeof value !== 'number') return '';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

export function FeedActionButton({
  icon,
  label,
  count,
  active = false,
  color = '#d26a2a',
  onPress,
}: FeedActionButtonProps) {
  const fg = active ? color : COLORS.idle;
  return (
    <Pressable onPress={onPress}>
      <Row
        style={{
          height: 36,
          minWidth: 86,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          paddingLeft: 10,
          paddingRight: 10,
          borderRadius: 6,
          backgroundColor: active ? COLORS.activeBg : 'transparent',
        }}
      >
        <Box style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon icon={icon} size={13} color={fg} strokeWidth={1.75} />
        </Box>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: fg }}>{label}</Text>
        {typeof count === 'number' ? (
          <Text style={{ minWidth: 22, textAlign: 'right', fontSize: 10, color: fg }}>{formatCount(count)}</Text>
        ) : null}
      </Row>
    </Pressable>
  );
}
