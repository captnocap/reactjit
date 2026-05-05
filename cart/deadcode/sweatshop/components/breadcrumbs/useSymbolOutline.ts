export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'export' | 'import' | 'variable' | 'unknown';

export type SymbolInfo = {
  name: string;
  kind: SymbolKind;
  line: number;
  isPrivate: boolean;
};

const PATTERNS: Array<{ kind: SymbolKind; regex: RegExp; isPrivate?: boolean }> = [
  { kind: 'import', regex: /^\s*import\s+/ },
  { kind: 'export', regex: /^\s*export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/ },
  { kind: 'export', regex: /^\s*export\s+\{[^}]*\}\s*from/ },
  { kind: 'export', regex: /^\s*export\s*\*\s*from/ },
  { kind: 'function', regex: /^\s*(?:async\s+)?function\s+(\w+)/ },
  { kind: 'class', regex: /^\s*class\s+(\w+)/ },
  { kind: 'interface', regex: /^\s*interface\s+(\w+)/ },
  { kind: 'type', regex: /^\s*type\s+(\w+)\s*[=\[]/ },
  { kind: 'variable', regex: /^\s*(?:const|let|var)\s+(\w+)/ },
];

function detectPrivate(line: string, name: string): boolean {
  if (name.startsWith('_')) return true;
  if (line.includes('private ')) return true;
  return false;
}

export function parseSymbolOutline(content: string): SymbolInfo[] {
  if (!content) return [];
  const lines = content.split('\n');
  const out: SymbolInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of PATTERNS) {
      const m = line.match(pat.regex);
      if (m) {
        const name = m[1] || (pat.kind === 'import' ? 'import' : 'export');
        out.push({
          name,
          kind: pat.kind,
          line: i + 1,
          isPrivate: detectPrivate(line, name),
        });
        break;
      }
    }
  }
  return out;
}

export function filterSymbols(
  symbols: SymbolInfo[],
  options: {
    kinds: SymbolKind[];
    showPrivate: boolean;
    showImports: boolean;
  }
): SymbolInfo[] {
  return symbols.filter((s) => {
    if (s.kind === 'import' && !options.showImports) return false;
    if (s.isPrivate && !options.showPrivate) return false;
    if (!options.kinds.includes(s.kind)) return false;
    return true;
  });
}
