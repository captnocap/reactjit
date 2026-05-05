import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { SymbolInfo, SymbolKind } from './useSymbolOutline';

const KIND_ICON: Record<SymbolKind, string> = {
  function: 'fn',
  class: 'cl',
  interface: 'if',
  type: 'ty',
  export: 'ex',
  import: 'im',
  variable: 'va',
  unknown: '??',
};

const KIND_TONE: Record<SymbolKind, string> = {
  function: COLORS.yellow,
  class: COLORS.blue,
  interface: COLORS.purple,
  type: COLORS.green,
  export: COLORS.orange,
  import: COLORS.textDim,
  variable: COLORS.textBright,
  unknown: COLORS.textDim,
};

export function SymbolRow(props: {
  symbol: SymbolInfo;
  onPress?: () => void;
}) {
  const { symbol, onPress } = props;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: TOKENS.radiusSm,
      }}
    >
      <Box
        style={{
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.grayChip,
          minWidth: 22,
          alignItems: 'center',
        }}
      >
        <Text fontSize={8} color={KIND_TONE[symbol.kind]} style={{ fontWeight: 'bold' }}>
          {KIND_ICON[symbol.kind]}
        </Text>
      </Box>
      <Text
        fontSize={11}
        color={symbol.isPrivate ? COLORS.textDim : COLORS.text}
        style={{ flexGrow: 1, fontWeight: symbol.kind === 'export' ? 'bold' : 'normal' }}
      >
        {symbol.name}
      </Text>
      <Text fontSize={9} color={COLORS.textMuted}>
        L{symbol.line}
      </Text>
    </Pressable>
  );
}
