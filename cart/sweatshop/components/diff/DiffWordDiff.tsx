import { Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface WordPart {
  text: string;
  type: 'same' | 'del' | 'ins';
}

export function computeWordDiff(oldText: string, newText: string): { oldParts: WordPart[]; newParts: WordPart[] } {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  let i = 0;
  let j = 0;
  const oldParts: WordPart[] = [];
  const newParts: WordPart[] = [];
  const maxLookahead = 8;

  while (i < oldWords.length || j < newWords.length) {
    if (oldWords[i] === newWords[j]) {
      oldParts.push({ text: oldWords[i], type: 'same' });
      newParts.push({ text: newWords[j], type: 'same' });
      i++;
      j++;
    } else {
      let matchI = -1;
      let matchJ = -1;
      for (let oi = i; oi < Math.min(i + maxLookahead, oldWords.length); oi++) {
        for (let nj = j; nj < Math.min(j + maxLookahead, newWords.length); nj++) {
          if (oldWords[oi] === newWords[nj]) {
            matchI = oi;
            matchJ = nj;
            break;
          }
        }
        if (matchI >= 0) break;
      }

      if (matchI < 0) {
        while (i < oldWords.length) {
          oldParts.push({ text: oldWords[i], type: 'del' });
          i++;
        }
        while (j < newWords.length) {
          newParts.push({ text: newWords[j], type: 'ins' });
          j++;
        }
      } else {
        while (i < matchI) {
          oldParts.push({ text: oldWords[i], type: 'del' });
          i++;
        }
        while (j < matchJ) {
          newParts.push({ text: newWords[j], type: 'ins' });
          j++;
        }
      }
    }
  }

  return { oldParts, newParts };
}

interface WordDiffSpansProps {
  parts: WordPart[];
  baseColor: string;
  highlightColor: string;
}

export function WordDiffSpans(props: WordDiffSpansProps) {
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      {props.parts.map((part, idx) => (
        <Text
          key={idx}
          fontSize={9}
          color={part.type === 'same' ? props.baseColor : props.highlightColor}
          style={{ whiteSpace: 'pre' }}
        >
          {part.text}
        </Text>
      ))}
    </Row>
  );
}
