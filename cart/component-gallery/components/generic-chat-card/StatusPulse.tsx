import { Box, Row, Text } from '@reactjit/runtime/primitives';
import { CHAT_CARD, type ConsoleMode } from './tokens';
import { classifiers as S } from '@reactjit/core';

function modeColor(mode: ConsoleMode): string {
  if (mode === 'stuck') return CHAT_CARD.orange;
  if (mode === 'streaming') return CHAT_CARD.green;
  return CHAT_CARD.faint;
}

export function StatusPulse({ mode }: { mode: ConsoleMode }) {
  const color = modeColor(mode);

  return (
    <S.InlineX3>
      <Box
        style={{
          width: 12,
          height: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: color,
          borderRadius: 6,
        }}
      >
        <Box style={{ width: 6, height: 6, backgroundColor: color, borderRadius: 3 }} />
      </Box>
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color }}>{mode}</Text>
    </S.InlineX3>
  );
}
