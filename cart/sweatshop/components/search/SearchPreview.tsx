import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { SearchMatch } from './useSearchEngine';

export interface SearchPreviewProps {
  match: SearchMatch | null;
  contextLines?: number;
}

// Inline 10-line preview. Uses the before/after slices already attached to
// the match so no extra file read happens while hovering.
export function SearchPreview({ match, contextLines }: SearchPreviewProps) {
  const ctx = contextLines ?? 5;
  const tone = COLORS.purple || '#d2a8ff';

  if (!match) {
    return (
      <Box style={{
        backgroundColor: COLORS.panelBg || '#0b1018',
        borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        borderRadius: 6, padding: 12,
      }}>
        <Text style={{ color: COLORS.textDim, fontSize: 10, letterSpacing: 1 }}>[ hover a result to preview ]</Text>
      </Box>
    );
  }

  const before = match.before.slice(-ctx);
  const after = match.after.slice(0, ctx);
  const firstLineNo = match.line - before.length;

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: tone,
      borderRadius: 6, overflow: 'hidden',
    }}>
      <Row style={{
        paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>PREVIEW</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textBright, fontSize: 10 }}>{match.path}:{match.line}:{match.col}</Text>
      </Row>
      <Col style={{ padding: 8, gap: 0 }}>
        {before.map((c, i) => (
          <PreviewRow key={'b' + i} lineNo={firstLineNo + i} text={c} kind="ctx" />
        ))}
        <PreviewRow lineNo={match.line} text={match.text} kind="hit" hitCol={match.col} hitLen={match.length} />
        {after.map((c, i) => (
          <PreviewRow key={'a' + i} lineNo={match.line + 1 + i} text={c} kind="ctx" />
        ))}
      </Col>
    </Col>
  );
}

function PreviewRow({ lineNo, text, kind, hitCol, hitLen }: { lineNo: number; text: string; kind: 'ctx' | 'hit'; hitCol?: number; hitLen?: number }) {
  const tone = COLORS.yellow || '#f2e05a';
  const isHit = kind === 'hit';
  const bg = isHit ? (COLORS.yellowDeep || '#3a2e14') : 'transparent';
  if (isHit && typeof hitCol === 'number' && typeof hitLen === 'number') {
    const start = Math.max(0, hitCol - 1);
    const end = Math.min(text.length, start + hitLen);
    const before = text.slice(0, start);
    const hit = text.slice(start, end);
    const after = text.slice(end);
    return (
      <Row style={{ gap: 6, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: bg, borderRadius: 2 }}>
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, width: 36, textAlign: 'right' }}>{lineNo}</Text>
        <Row style={{ flexGrow: 1 }}>
          <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{before}</Text>
          <Box style={{ backgroundColor: tone, borderRadius: 2, paddingHorizontal: 1 }}>
            <Text style={{ color: COLORS.appBg || '#05090f', fontSize: 11, fontWeight: 700 }}>{hit}</Text>
          </Box>
          <Text style={{ color: COLORS.textBright, fontSize: 11 }}>{after}</Text>
        </Row>
      </Row>
    );
  }
  return (
    <Row style={{ gap: 6, paddingHorizontal: 4 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 10, width: 36, textAlign: 'right' }}>{lineNo}</Text>
      <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{text}</Text>
    </Row>
  );
}
