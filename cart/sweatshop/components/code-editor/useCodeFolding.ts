const React: any = require('react');
const { useState, useMemo, useCallback } = React;

export interface FoldRange {
  startLine: number;
  endLine: number;
}

export interface CodeFolding {
  folds: FoldRange[];
  toggleFold: (line: number) => void;
  foldedLines: Set<number>;
  isFolded: (line: number) => boolean;
}

function computeFolds(text: string): FoldRange[] {
  const lines = text.split('\n');
  const folds: FoldRange[] = [];
  const stack: { line: number; indent: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const indent = lines[i].search(/\S/);
    if (indent < 0) continue;
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      const top = stack.pop()!;
      if (i - top.line > 1) {
        folds.push({ startLine: top.line, endLine: i - 1 });
      }
    }
    stack.push({ line: i, indent });
  }
  return folds;
}

export function useCodeFolding(text: string): CodeFolding {
  const folds = useMemo(() => computeFolds(text), [text]);
  const [folded, setFolded] = useState<Set<number>>(new Set());

  const toggleFold = useCallback((line: number) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }, []);

  const isFolded = useCallback(
    (line: number) => folded.has(line),
    [folded]
  );

  return { folds, toggleFold, foldedLines: folded, isFolded };
}
