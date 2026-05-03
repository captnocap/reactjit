import { LaTeXBlock } from './LaTeXBlock';
import { LaTeXInline } from './LaTeXInline';

export type LatexProps = {
  source: string;
  inline?: boolean;
  numbered?: boolean;
  equationNumber?: string | number;
  fontSize?: number;
  color?: string;
  style?: any;
};

export function Latex({
  source,
  inline = false,
  numbered = false,
  equationNumber,
  fontSize,
  color,
  style,
}: LatexProps) {
  if (inline) {
    return <LaTeXInline source={source} fontSize={fontSize ?? 16} color={color} style={style} />;
  }
  return (
    <LaTeXBlock
      source={source}
      fontSize={fontSize ?? 18}
      color={color}
      numbered={numbered}
      equationNumber={equationNumber}
      style={style}
    />
  );
}

export default Latex;
