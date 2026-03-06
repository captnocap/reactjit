/**
 * SearchPanel — full-text search over conversation history via claude:search.
 *
 * Uses TextInput.onLiveChange for debounced-at-Lua keystroke updates.
 * Shows kind badges, matched text trimmed to context window, turn number.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, ScrollView, TextInput, useLoveRPC } from '@reactjit/core';
import { C } from '../theme';

interface SearchResult {
  row:    number;
  kind:   string;
  text:   string;
  turnId: number | string;
  nodeId: number | string;
}

interface SearchResponse {
  results: SearchResult[];
  total:   number;
  query:   string;
}

function kindColor(kind: string): string {
  switch (kind) {
    case 'user_prompt':    return C.accent;
    case 'assistant_text': return C.approve;
    case 'tool':           return C.warning;
    case 'error':          return C.deny;
    default:               return C.textDim;
  }
}

const KIND_LABEL: Record<string, string> = {
  user_prompt:    'you',
  assistant_text: 'me',
  tool:           'tool',
  result:         'result',
  error:          'error',
  diff:           'diff',
};

function KindBadge({ kind }: { kind: string }) {
  const color = kindColor(kind);
  const label = KIND_LABEL[kind] ?? kind;
  return (
    <Box style={{
      backgroundColor: color + '1a',
      borderRadius:    3,
      paddingLeft:     4,
      paddingRight:    4,
      paddingTop:      1,
      paddingBottom:   1,
      flexShrink:      0,
    }}>
      <Text style={{ fontSize: 8, color, fontWeight: 'bold' }}>{label}</Text>
    </Box>
  );
}

function excerpt(text: string, query: string): string {
  const lower = text.toLowerCase();
  const qi    = lower.indexOf(query.toLowerCase());
  if (qi < 0) return text.slice(0, 110);
  const start = Math.max(0, qi - 28);
  const end   = Math.min(text.length, qi + query.length + 60);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  return (
    <Box style={{
      flexDirection:     'row',
      alignItems:        'flex-start',
      gap:               8,
      paddingLeft:       12,
      paddingRight:      12,
      paddingTop:        7,
      paddingBottom:     7,
      borderBottomWidth: 1,
      borderColor:       C.border,
    }}>
      <KindBadge kind={result.kind} />
      <Text style={{ fontSize: 11, color: C.textDim, flexGrow: 1, lineHeight: 16 }}>
        {excerpt(result.text, query)}
      </Text>
      <Text style={{ fontSize: 8, color: C.textMuted, flexShrink: 0 }}>
        {`t${result.turnId}`}
      </Text>
    </Box>
  );
}

export function SearchPanel() {
  const rpcSearch = useLoveRPC('claude:search');
  const rpcRef    = useRef(rpcSearch);
  rpcRef.current  = rpcSearch;

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setTotal(0); return; }
    setLoading(true);
    try {
      const res = await rpcRef.current({ query: q.trim(), session: 'default', limit: 30 }) as SearchResponse;
      setResults(res?.results ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const hasQuery   = query.trim().length > 0;
  const hasResults = results.length > 0;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column', backgroundColor: C.panelG }}>

      {/* Search bar */}
      <Box style={{
        flexDirection:     'row',
        alignItems:        'center',
        gap:               8,
        paddingLeft:       12,
        paddingRight:      12,
        paddingTop:        8,
        paddingBottom:     8,
        borderBottomWidth: 1,
        borderColor:       C.border,
        flexShrink:        0,
      }}>
        <Text style={{ fontSize: 12, color: C.textMuted }}>{'⌕'}</Text>
        <TextInput
          placeholder="search conversation…"
          placeholderColor={C.textMuted}
          onLiveChange={runSearch}
          liveChangeDebounce={250}
          style={{
            flexGrow:        1,
            fontSize:        12,
            color:           C.text,
            backgroundColor: C.surface,
            borderRadius:    4,
            borderWidth:     1,
            borderColor:     C.border,
            paddingLeft:     8,
            paddingRight:    8,
            paddingTop:      4,
            paddingBottom:   4,
            height:          28,
          }}
        />
        {hasQuery && (
          <Text style={{ fontSize: 9, color: C.textMuted, flexShrink: 0 }}>
            {loading ? '…' : `${total}`}
          </Text>
        )}
      </Box>

      {/* Empty state */}
      {!hasQuery && (
        <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, color: C.textDim }}>{'Search conversation history'}</Text>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{'Full-text · all turns · live results'}</Text>
        </Box>
      )}

      {/* No results */}
      {hasQuery && !hasResults && !loading && (
        <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 10, color: C.textMuted }}>{`No results for "${query}"`}</Text>
        </Box>
      )}

      {/* Results list */}
      {hasResults && (
        <ScrollView style={{ flexGrow: 1 }}>
          {results.map((r, i) => (
            <ResultRow key={`${r.nodeId}-${i}`} result={r} query={query} />
          ))}
          {total > results.length && (
            <Box style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: C.textMuted }}>
                {`+${total - results.length} more — narrow your query`}
              </Text>
            </Box>
          )}
        </ScrollView>
      )}
    </Box>
  );
}
