/**
 * AppSearch — full-screen search over the live rendered node tree.
 *
 * Hot search (live tree):   queries Lua directly. Every keypress resolves
 *   against the real in-memory node tree. The result IS the node — no ID
 *   lookup, no registration, no stale references. Selecting a result lets
 *   Lua resolve the structural path directly and scroll+highlight the node.
 *
 * Cold search (manifest):  filters a compile-time index from `rjit search-index`
 *   over stories/screens that haven't been rendered yet. Selecting navigates
 *   to the right story, then Lua does a text-match walk to highlight the node.
 *
 * @example
 * // Basic: hot search only
 * <AppSearch onClose={() => setOpen(false)} />
 *
 * @example
 * // With cold manifest for cross-story search
 * import manifest from '../dist/search-index.json';
 * <AppSearch manifest={manifest} onNavigate={entry => setStory(entry.storyId)} onClose={...} />
 *
 * Wrap searchable regions with <Searchable> to mark them for `rjit search-index`:
 * @example
 * <Searchable id="nav-demo">
 *   <NavigationDemo />
 * </Searchable>
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from '../primitives';
import { Modal } from '../Modal';
import { Pressable, type PressableState } from '../Pressable';
import { ScrollView } from '../ScrollView';
import { SearchBar } from './SearchBar';
import type { HotSearchResult, ColdSearchEntry } from '../useAppSearch';
import { useAppSearch } from '../useAppSearch';
import { useHotkey } from '../hooks';
import type { Style } from '../types';

// ── Searchable wrapper ───────────────────────────────────────

export interface SearchableProps {
  /** Logical ID for this region — used by `rjit search-index` to group results. */
  id?: string;
  children: React.ReactNode;
  style?: Style;
}

/**
 * Marks a subtree for compile-time text indexing by `rjit search-index`.
 * Zero overhead at runtime — renders children directly.
 */
export function Searchable({ children, style }: SearchableProps) {
  return <Box style={style as any}>{children}</Box>;
}

// ── Highlight helpers ────────────────────────────────────────

function splitHighlight(text: string, matchStart: number, matchEnd: number) {
  return {
    before: text.slice(0, matchStart - 1),
    match:  text.slice(matchStart - 1, matchEnd),
    after:  text.slice(matchEnd),
  };
}

function splitHighlightQuery(text: string, query: string) {
  if (!query) return { before: text, match: '', after: '' };
  const s = text.toLowerCase().indexOf(query.toLowerCase());
  if (s < 0) return { before: text, match: '', after: '' };
  return {
    before: text.slice(0, s),
    match:  text.slice(s, s + query.length),
    after:  text.slice(s + query.length),
  };
}

// ── Hot result row ───────────────────────────────────────────

interface HotRowProps {
  result: HotSearchResult;
  onSelect: (r: HotSearchResult) => void;
  active: boolean;
  activeColor: string;
  textColor: string;
  mutedColor: string;
}

function HotRow({ result, onSelect, active, activeColor, textColor, mutedColor }: HotRowProps) {
  const hl = useMemo(() =>
    splitHighlight(result.text, result.matchStart, result.matchEnd),
  [result]);

  return (
    <Pressable
      onPress={() => onSelect(result)}
      style={({ hovered }: PressableState) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        paddingLeft: 12,
        backgroundColor: active
          ? `${activeColor}22`
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderRadius: 6,
      })}
    >
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Box style={{ flexDirection: 'row' }}>
          {hl.before ? <Text style={{ fontSize: 13, color: textColor }}>{hl.before}</Text> : null}
          {hl.match  ? <Text style={{ fontSize: 13, color: activeColor }}>{hl.match}</Text> : null}
          {hl.after  ? <Text style={{ fontSize: 13, color: textColor }}>{hl.after}</Text> : null}
        </Box>
        {result.context.length > 0 && (
          <Text style={{ fontSize: 10, color: mutedColor }}>
            {result.context.slice(0, 3).join(' › ')}
          </Text>
        )}
      </Box>
      {result.propKey && (
        <Text style={{ fontSize: 9, color: mutedColor }}>{result.propKey}</Text>
      )}
    </Pressable>
  );
}

// ── Cold result row ──────────────────────────────────────────

interface ColdRowProps {
  entry: ColdSearchEntry;
  query: string;
  onSelect: (e: ColdSearchEntry) => void;
  active: boolean;
  activeColor: string;
  textColor: string;
  mutedColor: string;
}

function ColdRow({ entry, query, onSelect, active, activeColor, textColor, mutedColor }: ColdRowProps) {
  const hl = useMemo(() => splitHighlightQuery(entry.text, query), [entry.text, query]);

  return (
    <Pressable
      onPress={() => onSelect(entry)}
      style={({ hovered }: PressableState) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        paddingLeft: 12,
        backgroundColor: active
          ? `${activeColor}22`
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderRadius: 6,
      })}
    >
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Box style={{ flexDirection: 'row' }}>
          {hl.before ? <Text style={{ fontSize: 13, color: textColor }}>{hl.before}</Text> : null}
          {hl.match  ? <Text style={{ fontSize: 13, color: activeColor }}>{hl.match}</Text> : null}
          {hl.after  ? <Text style={{ fontSize: 13, color: textColor }}>{hl.after}</Text> : null}
        </Box>
        <Text style={{ fontSize: 10, color: mutedColor }}>{entry.component}</Text>
      </Box>
      <Text style={{ fontSize: 9, color: mutedColor }}>
        {entry.file.split('/').pop() ?? ''}
      </Text>
    </Pressable>
  );
}

// ── AppSearch ────────────────────────────────────────────────

export interface AppSearchProps {
  onClose: () => void;
  /** Cold manifest from `rjit search-index` for cross-story/pre-mount search. */
  manifest?: ColdSearchEntry[];
  /** Called when user selects a cold result — navigate to the target story/screen. */
  onNavigate?: (entry: ColdSearchEntry) => void;
  maxHotResults?: number;
  maxColdResults?: number;
  activeColor?:     string;
  textColor?:       string;
  mutedColor?:      string;
  backgroundColor?: string;
  borderColor?:     string;
}

export function AppSearch({
  onClose,
  manifest,
  onNavigate,
  maxHotResults   = 20,
  maxColdResults  = 10,
  activeColor     = '#3b82f6',
  textColor       = 'rgba(255,255,255,0.9)',
  mutedColor      = 'rgba(255,255,255,0.45)',
  backgroundColor = 'rgba(12,12,18,0.98)',
  borderColor     = 'rgba(255,255,255,0.08)',
}: AppSearchProps) {
  const [query, setQuery] = useState('');
  const [activeHotIdx,  setActiveHotIdx]  = useState(0);
  const [activeColdIdx, setActiveColdIdx] = useState(-1);

  const { results: hotResults, loading, search, navigateTo, navigateByText } = useAppSearch();

  const slicedHot   = hotResults.slice(0, maxHotResults);
  const coldResults = useMemo<ColdSearchEntry[]>(() => {
    if (!manifest || !query.trim()) return [];
    const q = query.toLowerCase();
    return manifest.filter(e => e.text.toLowerCase().includes(q)).slice(0, maxColdResults);
  }, [manifest, query, maxColdResults]);

  const hasHot  = slicedHot.length > 0;
  const hasCold = coldResults.length > 0;
  const total   = slicedHot.length + coldResults.length;
  const noResults = !loading && query.trim() !== '' && total === 0;

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setActiveHotIdx(0);
    setActiveColdIdx(-1);
    search(q);
  }, [search]);

  const handleSelectHot = useCallback((r: HotSearchResult) => {
    navigateTo(r);
    onClose();
  }, [navigateTo, onClose]);

  const handleSelectCold = useCallback((e: ColdSearchEntry) => {
    onNavigate?.(e);
    navigateByText(e.text);
    onClose();
  }, [onNavigate, navigateByText, onClose]);

  useHotkey('escape', onClose, { enabled: true });

  useHotkey('arrowdown', () => {
    if (hasHot) setActiveHotIdx(i => Math.min(i + 1, slicedHot.length - 1));
    else if (hasCold) setActiveColdIdx(i => Math.min(i + 1, coldResults.length - 1));
  }, { enabled: total > 0 });

  useHotkey('arrowup', () => {
    if (hasHot) setActiveHotIdx(i => Math.max(i - 1, 0));
    else if (hasCold) setActiveColdIdx(i => Math.max(i - 1, 0));
  }, { enabled: total > 0 });

  useHotkey('return', () => {
    if (hasHot && activeHotIdx < slicedHot.length) handleSelectHot(slicedHot[activeHotIdx]);
    else if (hasCold && activeColdIdx >= 0) handleSelectCold(coldResults[activeColdIdx]);
  }, { enabled: total > 0 });

  return (
    <Modal visible onClose={onClose}>
      <Box style={{
        width: 580,
        backgroundColor,
        borderRadius: 12,
        borderWidth: 1,
        borderColor,
        gap: 0,
      } as any}>

        {/* Input */}
        <Box style={{ padding: 10 }}>
          <SearchBar
            onSearch={handleSearch}
            onClear={() => { setQuery(''); search(''); }}
            placeholder="Search anywhere in the app..."
            autoFocus
            debounce={100}
            accentColor={activeColor}
            backgroundColor="transparent"
            color={textColor}
            borderColor="transparent"
            borderRadius={6}
          />
        </Box>

        {/* Divider */}
        <Box style={{ height: 1, backgroundColor: borderColor }} />

        {/* Results */}
        <ScrollView style={{ height: 320 }}>
          <Box style={{ padding: 6, gap: 2 }}>
            {loading && (
              <Box style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: mutedColor }}>Searching...</Text>
              </Box>
            )}

            {noResults && (
              <Box style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: mutedColor }}>
                  No results for "{query}"
                </Text>
              </Box>
            )}

            {!loading && !query.trim() && (
              <Box style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: mutedColor }}>
                  Type to search text in the live tree
                </Text>
              </Box>
            )}

            {/* Hot results */}
            {hasHot && (
              <Box style={{ gap: 1 }}>
                <Box style={{ paddingLeft: 12, paddingTop: 6, paddingBottom: 4 }}>
                  <Text style={{ fontSize: 10, color: mutedColor }}>LIVE TREE</Text>
                </Box>
                {slicedHot.map((r, i) => (
                  <HotRow
                    key={r.path}
                    result={r}
                    onSelect={handleSelectHot}
                    active={i === activeHotIdx}
                    activeColor={activeColor}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                ))}
              </Box>
            )}

            {/* Cold results */}
            {hasCold && (
              <Box style={{ gap: 1, marginTop: hasHot ? 8 : 0 }}>
                <Box style={{ paddingLeft: 12, paddingTop: 6, paddingBottom: 4 }}>
                  <Text style={{ fontSize: 10, color: mutedColor }}>INDEXED</Text>
                </Box>
                {coldResults.map((e, i) => (
                  <ColdRow
                    key={e.id}
                    entry={e}
                    query={query}
                    onSelect={handleSelectCold}
                    active={i === activeColdIdx}
                    activeColor={activeColor}
                    textColor={textColor}
                    mutedColor={mutedColor}
                  />
                ))}
              </Box>
            )}
          </Box>
        </ScrollView>

        {/* Footer */}
        <Box style={{ height: 1, backgroundColor: borderColor }} />
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 8,
          paddingLeft: 12,
          paddingRight: 12,
        }}>
          <Text style={{ fontSize: 10, color: mutedColor }}>
            {query.trim()
              ? `${total} result${total !== 1 ? 's' : ''}`
              : 'hot + cold search'}
          </Text>
          <Text style={{ fontSize: 10, color: mutedColor }}>
            arrows navigate  ·  enter jump  ·  esc close
          </Text>
        </Box>

      </Box>
    </Modal>
  );
}
