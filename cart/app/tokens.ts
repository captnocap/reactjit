// @-token registry — the zero-latency tier of the dispatch hierarchy.
//
// The user types `@home` or `@about` in the input strip; the resolver
// matches against this catalog and fires the corresponding IFTTT event
// before any model is involved. Add a token here when a new route or
// app-action lands.
//
// Today: route tokens only. When the cartridge ABI lands we'll grow the
// shape to include `{ type: 'app'; id: string }` and friends — see the
// commented union below.

export type RouteToken = { type: 'route'; path: string; label: string };
// Future: { type: 'app'; id: string; label: string } once cartridges mount inline.
export type Token = RouteToken;

export const TOKENS: Record<string, Token> = {
  home:      { type: 'route', path: '/',          label: 'Home' },
  about:     { type: 'route', path: '/about',     label: 'About' },
  settings:  { type: 'route', path: '/settings',  label: 'Settings' },
  character: { type: 'route', path: '/character', label: 'Character' },
};

export interface TokenMatch {
  raw: string;          // the matched substring including the '@'
  start: number;        // offset in the source text
  end: number;          // exclusive end offset
  token: Token;
}

const TOKEN_RE = /@([A-Za-z][A-Za-z0-9_-]*)/g;

export function resolveTokens(text: string): TokenMatch[] {
  const out: TokenMatch[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    const tok = TOKENS[key];
    if (!tok) continue;
    out.push({
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
      token: tok,
    });
  }
  return out;
}
