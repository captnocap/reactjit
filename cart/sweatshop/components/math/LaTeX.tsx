
import { useTheme } from '../../theme';
import { LaTeXBlock } from './LaTeXBlock';
import { LaTeXInline } from './LaTeXInline';

export type LaTeXProps = {
  source: string;
  inline?: boolean;
  numbered?: boolean;
  equationNumber?: string | number;
  fontSize?: number;
  color?: string;
  style?: any;
};

export function LaTeX({ source, inline = false, numbered = false, equationNumber, fontSize, color, style }: LaTeXProps) {
  const theme = useTheme();
  const tone = color || theme.colors.text;
  if (inline) {
    return <LaTeXInline source={source} fontSize={fontSize ?? 16} color={tone} style={style} />;
  }
  return (
    <LaTeXBlock
      source={source}
      fontSize={fontSize ?? 18}
      color={tone}
      numbered={numbered}
      equationNumber={equationNumber}
      style={style}
    />
  );
}

export default LaTeX;
