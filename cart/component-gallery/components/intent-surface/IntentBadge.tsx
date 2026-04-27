import { Box, Text } from '../../../../runtime/primitives';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#475569', fg: '#f8fafc' },
  success: { bg: '#16a34a', fg: '#ffffff' },
  warning: { bg: '#d97706', fg: '#ffffff' },
  error:   { bg: '#dc2626', fg: '#ffffff' },
  info:    { bg: '#2563eb', fg: '#ffffff' },
};

export function IntentBadge({ tone = 'neutral', children }: { tone?: Tone; children?: any }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <Box style={{
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 2,
      paddingBottom: 2,
      backgroundColor: t.bg,
      borderRadius: 999,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: 11, color: t.fg, fontWeight: 500 }}>{children}</Text>
    </Box>
  );
}
