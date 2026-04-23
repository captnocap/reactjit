const { useEffect, useRef, useState } = require('react');

function callHost(name: string, fallback: any): any {
  try {
    const host: any = globalThis;
    const fn = (host as any)[name];
    if (typeof fn !== 'function') return fallback;
    return fn();
  } catch {
    return fallback;
  }
}

function posToLineColumn(text: string, byteOffset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < Math.min(byteOffset, text.length); i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

export function useCursorPosition(content: string, activeView: string) {
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    if (activeView !== 'editor') return;
    const timer = setInterval(() => {
      const pos = callHost('__input_get_focused_cursor_pos', 0);
      if (typeof pos === 'number' && pos > 0) {
        const { line, column } = posToLineColumn(contentRef.current, pos);
        setCursorLine(line);
        setCursorColumn(column);
      }
    }, 120);
    return () => clearInterval(timer);
  }, [activeView]);

  return { cursorLine, cursorColumn };
}
