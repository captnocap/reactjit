
import { Box } from '@reactjit/runtime/primitives';
import { useTheme } from '../../theme';
import { renderMathTree } from './mathRender';
import { useLaTeXParse } from './useLaTeXParse';

export type LaTeXInlineProps = {
  source: string;
  fontSize?: number;
  color?: string;
  style?: any;
};

export function LaTeXInline({ source, fontSize = 16, color, style }: LaTeXInlineProps) {
  const theme = useTheme();
  const nodes = useLaTeXParse(source);
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'flex-start', ...style }}>
      {renderMathTree(nodes, { fontSize, color: color || theme.colors.text, inline: true })}
    </Box>
  );
}

export default LaTeXInline;
