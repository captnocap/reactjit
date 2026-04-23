import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { computeWordDiff, WordDiffSpans } from './DiffWordDiff';
import type { SideBySideRow } from '../../app/diff-helpers';

interface DiffSideBySideProps {
  rows: SideBySideRow[];
  wordDiffEnabled: boolean;
}

export function DiffSideBySide(props: DiffSideBySideProps) {
  return (
    <>
      {props.rows.map((row, i) => (
        <SideBySideDiffRow key={i} row={row} wordDiffEnabled={props.wordDiffEnabled} />
      ))}
    </>
  );
}

function SideBySideDiffRow(props: { row: SideBySideRow; wordDiffEnabled: boolean }) {
  const { row, wordDiffEnabled } = props;
  const oldBg = row.kind === 'old' || row.kind === 'both' ? COLORS.redDeep : 'transparent';
  const newBg = row.kind === 'new' || row.kind === 'both' ? COLORS.greenDeep : 'transparent';
  const oldFg = row.kind === 'old' || row.kind === 'both' ? COLORS.red : COLORS.text;
  const newFg = row.kind === 'new' || row.kind === 'both' ? COLORS.green : COLORS.text;

  const showWordDiff = wordDiffEnabled && row.kind === 'both';

  return (
    <Row style={{ height: 18, alignItems: 'center' }}>
      {/* Old gutter */}
      <Box
        style={{
          width: 44,
          height: '100%',
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingRight: 6,
          backgroundColor: oldBg,
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>
          {row.oldLine ?? ''}
        </Text>
      </Box>
      {/* Old content */}
      <Box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          height: '100%',
          justifyContent: 'center',
          backgroundColor: oldBg,
          paddingLeft: 4,
          overflow: 'hidden',
        }}
      >
        {showWordDiff ? (
          <WordDiffSpans parts={computeWordDiff(row.oldText, row.newText).oldParts} baseColor={oldFg} highlightColor={COLORS.red} />
        ) : (
          <Text fontSize={9} color={oldFg} style={{ whiteSpace: 'pre' }}>
            {row.oldText}
          </Text>
        )}
      </Box>
      {/* Divider */}
      <Box style={{ width: 1, height: '100%', backgroundColor: COLORS.borderSoft }} />
      {/* New gutter */}
      <Box
        style={{
          width: 44,
          height: '100%',
          justifyContent: 'center',
          alignItems: 'flex-end',
          paddingRight: 6,
          backgroundColor: newBg,
        }}
      >
        <Text fontSize={9} color={COLORS.textDim}>
          {row.newLine ?? ''}
        </Text>
      </Box>
      {/* New content */}
      <Box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          height: '100%',
          justifyContent: 'center',
          backgroundColor: newBg,
          paddingLeft: 4,
          overflow: 'hidden',
        }}
      >
        {showWordDiff ? (
          <WordDiffSpans parts={computeWordDiff(row.oldText, row.newText).newParts} baseColor={newFg} highlightColor={COLORS.green} />
        ) : (
          <Text fontSize={9} color={newFg} style={{ whiteSpace: 'pre' }}>
            {row.newText}
          </Text>
        )}
      </Box>
    </Row>
  );
}
