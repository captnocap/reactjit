import { tokenizeTS, Token } from './ts';

export function tokenizeJS(line: string): Token[] {
  return tokenizeTS(line);
}
