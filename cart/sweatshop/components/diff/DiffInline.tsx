import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { DiffWordDiff } from './DiffWordDiff';
import type { DiffHunk } from '../../app/diff-helpers';

interface DiffInlineProps {
  hunk: DiffHunk;
  wordDiffEnabled: boolean;
}

export function DiffInline(props: DiffInlineProps) {
  const { hunk, wordDiffEnabled } = props;

  return (
    <>
      {hunk.lines.map((line, i) => {
        const prefix = line.charAt(0);
        const text = line.slice(1);
        let color = COLORS.text;
        let bg = 'transparent';
        let showWordDiff = false;

        if (prefix === '-') {
          color = COLORS.red;
          bg = COLORS.redDeep;
        } else if (prefix === '+') {
          color = COLORS.green;
          bg = COLORS.greenDeep;
        } else if (prefix === '\\') {
          color = COLORS.textDim;
        }

        // Simple word-diff for adjacent +/- lines would require pairing,
        // so we skip inline word-diff for the inline view to avoid complexity.
        return (
          <Row key={i} style={{ height: 18, alignItems: 'center', backgroundColor: bg }}>
            <Box
              style={{
                width: 44,
                height: '100%',
                justifyContent: 'center',
                alignItems: 'flex-end',
                paddingRight: 6,
              }}
            >
              <Text fontSize={9} color={COLORS.textDim}>
                {prefix}
              </Text>
            </Box>
            <Box
              style={{
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                height: '100%',
                justifyContent: 'center',
                paddingLeft: 4,
                overflow: 'hidden',
              }}
            >
              <Text fontSize={9} color={color} style={{ whiteSpace: 'pre' }}>
                {text}
              </Text>
            </Box>
          </Row>
        );
      })}
    </>
  );
}
