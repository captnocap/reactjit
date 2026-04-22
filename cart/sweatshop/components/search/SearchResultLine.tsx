import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { SearchMatch } from './useSearchEngine';

export interface SearchResultLineProps {
  match: SearchMatch;
  selected?: boolean;
  showContext?: boolean;
  onClick?: (m: SearchMatch) => void;
  onHover?: (m: SearchMatch | null) => void;
}

// Splits the matched line into { before, hit, after } so the hit can be
// highlighted without re-running the regex on every render.
function splitHit(text: string, col: number, length: number): { before: string; hit: string; after: string } {
  const start = Math.max(0, col - 1);
  const end = Math.min(text.length, start + length);
  return { before: text.slice(0, start), hit: text.slice(start, end), after: text.slice(end) };
}

export function SearchResultLine({ match, selected, showContext, onClick, onHover }: SearchResultLineProps) {
  const tone = COLORS.yellow || '#f2e05a';
  const bg = selected ? (COLORS.panelHover || '#173048') : (COLORS.panelBg || '#0b1018');
  const parts = splitHit(match.text, match.col, match.length);

  return (
    <Pressable
      onPress={() => onClick && onClick(match)}
      onHoverIn={() => onHover && onHover(match)}
      onHoverOut={() => onHover && onHover(null)}
      style={{
        paddingHorizontal: 8, paddingVertical: 3,
        backgroundColor: bg,
        borderLeftWidth: 2,
        borderColor: selected ? tone : 'transparent',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {showContext && match.before.length > 0 ? (
        <Col style={{ gap: 0 }}>
          {match.before.map((c, i) => (
            <Row key={'b' + i} style={{ gap: 6 }}>
              <Text style={{ color: COLORS.textDim, fontSize: 10, width: 40, textAlign: 'right' }}>
                {match.line - match.before.length + i}
              </Text>
              <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{c}</Text>
            </Row>
          ))}
        </Col>
      ) : null}

      <Row style={{ gap: 6, alignItems: 'center' }}>
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, width: 40, textAlign: 'right' }}>{match.line}</Text>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>:{match.col}</Text>
        <Row style={{ flexGrow: 1, flexBasis: 0, flexWrap: 'nowrap' }}>
          <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{parts.before}</Text>
          <Box style={{ backgroundColor: tone, borderRadius: 2, paddingHorizontal: 1 }}>
            <Text style={{ color: COLORS.appBg || '#05090f', fontSize: 11, fontWeight: 700 }}>{parts.hit}</Text>
          </Box>
          <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{parts.after}</Text>
        </Row>
      </Row>

      {showContext && match.after.length > 0 ? (
        <Col style={{ gap: 0 }}>
          {match.after.map((c, i) => (
            <Row key={'a' + i} style={{ gap: 6 }}>
              <Text style={{ color: COLORS.textDim, fontSize: 10, width: 40, textAlign: 'right' }}>
                {match.line + 1 + i}
              </Text>
              <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{c}</Text>
            </Row>
          ))}
        </Col>
      ) : null}
    </Pressable>
  );
}
