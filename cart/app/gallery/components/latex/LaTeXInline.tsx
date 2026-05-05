import { Box } from '@reactjit/runtime/primitives';
import { renderMathTree } from './mathRender';
import { useLaTeXParse } from './useLaTeXParse';

export type LaTeXInlineProps = {
  source: string;
  fontSize?: number;
  color?: string;
  style?: any;
};

export function LaTeXInline({ source, fontSize = 16, color = 'theme:ink', style }: LaTeXInlineProps) {
  const nodes = useLaTeXParse(source);
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'flex-start', ...style }}>
      {renderMathTree(nodes, { fontSize, color, inline: true })}
    </Box>
  );
}

export default LaTeXInline;
