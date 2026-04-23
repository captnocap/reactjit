import { tokenizeTS, Token } from './languages/ts';
import { tokenizeJS } from './languages/js';
import { tokenizeLua } from './languages/lua';
import { tokenizeMD } from './languages/md';

export type { Token } from './languages/ts';

function tokenizeForLanguage(line: string, language: string): Token[] {
  const lang = language.toLowerCase();
  if (lang === 'typescript' || lang === 'ts') return tokenizeTS(line);
  if (lang === 'javascript' || lang === 'js') return tokenizeJS(line);
  if (lang === 'lua') return tokenizeLua(line);
  if (lang === 'markdown' || lang === 'md') return tokenizeMD(line);
  return tokenizeTS(line);
}

export function useCodeTokenize(text: string, language: string): Token[][] {
  return useMemo(() => {
    if (!text) return [];
    const lines = text.split('\n');
    return lines.map((line) => tokenizeForLanguage(line, language));
  }, [text, language]);
}
