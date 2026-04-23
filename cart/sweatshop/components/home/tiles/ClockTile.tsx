
const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

export function ClockTile() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));

  return (
    <Box style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, justifyContent: 'center', alignItems: 'center', gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>TIME</Text>
      <Text fontSize={28} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
        {pad(hour)}:{pad(m)}:{pad(s)}
      </Text>
      <Text fontSize={10} color={COLORS.textDim}>
        {now.toLocaleDateString()}
      </Text>
    </Box>
  );
}
