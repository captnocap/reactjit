const React: any = require('react');
const { useState } = React;
import { Box, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { SymbolRow } from './SymbolRow';
import { parseSymbolOutline, filterSymbols, type SymbolKind } from './useSymbolOutline';

const ALL_KINDS: SymbolKind[] = ['function', 'class', 'interface', 'type', 'export', 'import', 'variable'];

const KIND_LABEL: Record<SymbolKind, string> = {
  function: 'Fn',
  class: 'Cl',
  interface: 'If',
  type: 'Ty',
  export: 'Ex',
  import: 'Im',
  variable: 'Va',
  unknown: '??',
};

export function BreadcrumbSymbols(props: {
  fileContent: string;
  onSelectLine?: (line: number) => void;
  onClose: () => void;
}) {
  const { fileContent, onSelectLine, onClose } = props;
  const symbols = parseSymbolOutline(fileContent);

  const [kinds, setKinds] = useState<SymbolKind[]>(['function', 'class', 'interface', 'type', 'export', 'variable']);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showImports, setShowImports] = useState(false);

  const toggleKind = (k: SymbolKind) => {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const filtered = filterSymbols(symbols, { kinds, showPrivate, showImports });

  return (
    <Box
      style={{
        position: 'absolute',
        top: 26,
        left: 0,
        backgroundColor: COLORS.panelRaised,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: COLORS.border,
        minWidth: 240,
        maxHeight: 320,
        zIndex: 20,
      }}
    >
      {/* Filter bar */}
      <Box
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
          gap: 6,
        }}
      >
        <Row style={{ gap: 4, flexWrap: 'wrap' }}>
          {ALL_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => toggleKind(k)}
              style={{
                paddingLeft: 5,
                paddingRight: 5,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: TOKENS.radiusSm,
                backgroundColor: kinds.includes(k) ? COLORS.blueDeep : COLORS.grayChip,
                borderWidth: 1,
                borderColor: kinds.includes(k) ? COLORS.blue : COLORS.border,
              }}
            >
              <Text fontSize={8} color={kinds.includes(k) ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
                {KIND_LABEL[k]}
              </Text>
            </Pressable>
          ))}
        </Row>
        <Row style={{ gap: 10 }}>
          <Pressable onPress={() => setShowPrivate((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: showPrivate ? COLORS.blue : 'transparent',
              }}
            />
            <Text fontSize={9} color={COLORS.textDim}>Private</Text>
          </Pressable>
          <Pressable onPress={() => setShowImports((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: showImports ? COLORS.blue : 'transparent',
              }}
            />
            <Text fontSize={9} color={COLORS.textDim}>Imports</Text>
          </Pressable>
        </Row>
      </Box>

      <ScrollView showScrollbar={true}>
        {filtered.length > 0 ? (
          filtered.map((sym, idx) => (
            <SymbolRow
              key={idx + '-' + sym.name + '-' + sym.line}
              symbol={sym}
              onPress={() => {
                if (onSelectLine) onSelectLine(sym.line);
                onClose();
              }}
            />
          ))
        ) : (
          <Box style={{ padding: 10 }}>
            <Text fontSize={10} color={COLORS.textDim}>No symbols match filters</Text>
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
