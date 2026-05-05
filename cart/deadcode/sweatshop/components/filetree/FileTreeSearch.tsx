import { Box, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export interface FileTreeSearchProps {
  query: string;
  onChange: (q: string) => void;
  resultCount: number;
  totalCount: number;
}

export function FileTreeSearch({ query, onChange, resultCount, totalCount }: FileTreeSearchProps) {
  return (
    <Box style={{ padding: 8, borderBottomWidth: 1, borderColor: COLORS.border }}>
      <TextInput
        value={query}
        onChange={onChange}
        placeholder="Filter files..."
        style={{
          fontSize: 12,
          color: COLORS.textBright,
          backgroundColor: COLORS.panelBg,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
        }}
      />
      {query ? (
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <Text fontSize={9} color={COLORS.textMuted}>
            {resultCount} of {totalCount}
          </Text>
          <Text fontSize={9} color={COLORS.textDim}>
            fuzzy match
          </Text>
        </Row>
      ) : null}
    </Box>
  );
}
