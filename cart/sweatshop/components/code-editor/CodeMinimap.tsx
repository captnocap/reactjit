import { memo, useMemo } from 'react';
import { Col, Box } from '../../../../runtime/primitives';
import { editorTokenTone } from '../../utils';
import { Token } from './languages/ts';
import { COLORS } from '../../theme';

export interface CodeMinimapProps {
  tokenLines: Token[][];
  fontSize?: number;
  visibleStart?: number;
  visibleEnd?: number;
  width?: number;
}

export const CodeMinimap = memo(function CodeMinimap(props: CodeMinimapProps) {
  const { tokenLines, fontSize = 13, visibleStart = 0, visibleEnd = 20, width = 80 } = props;
  const rowH = Math.max(1, (fontSize + 5) * 0.25);
  const maxRows = Math.max(220, Math.ceil(600 / rowH));

  const rows = useMemo(() => {
    const step = Math.max(1, Math.ceil(tokenLines.length / maxRows));
    const out: { color: string; active: boolean }[] = [];
    for (let i = 0; i < tokenLines.length; i += step) {
      const lineIndex = i;
      const toks = tokenLines[lineIndex];
      let ink = 0;
      let color = COLORS.textDim;
      for (const t of toks) {
        if (t.kind !== 'text' && t.kind !== 'comment') {
          ink += t.text.length;
          color = editorTokenTone(t.kind);
        }
      }
      const isActive = lineIndex >= visibleStart && lineIndex <= visibleEnd;
      out.push({ color: ink > 0 ? color : COLORS.textDim, active: isActive });
      if (out.length >= maxRows) break;
    }
    return out;
  }, [tokenLines, maxRows, visibleStart, visibleEnd]);

  const totalH = rows.length * rowH;
  const viewportH = Math.max(rowH, ((visibleEnd - visibleStart + 1) / Math.max(1, tokenLines.length)) * totalH);
  const viewportTop = (visibleStart / Math.max(1, tokenLines.length)) * totalH;

  return (
    <Box style={{ width, position: 'relative', backgroundColor: COLORS.panelRaised, borderLeftWidth: 1, borderColor: COLORS.borderSoft }}>
      <Col style={{ width: '100%', height: totalH }}>
        {rows.map((row, i) => (
          <Box
            key={i}
            style={{
              height: rowH,
              width: '100%',
              backgroundColor: row.active ? 'rgba(100,149,237,0.35)' : row.color + '44',
            }}
          />
        ))}
      </Col>
      <Box style={{
        position: 'absolute',
        top: viewportTop,
        left: 0,
        right: 0,
        height: viewportH,
        backgroundColor: 'rgba(100,149,237,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(100,149,237,0.5)',
      }} />
    </Box>
  );
});
