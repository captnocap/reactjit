/**
 * SearchCombo — SearchBar with an inline results dropdown.
 *
 * The combo owns all state: query, results, loading, activeIndex.
 * You provide items + searchKey (or a custom search fn) and it handles the rest.
 *
 * @example
 * // Minimal — searches an array of objects by 'name'
 * <SearchCombo items={users} searchKey="name" onSelect={setUser} />
 *
 * @example
 * // Async search + sections via onSearch
 * <SearchCombo
 *   onSearch={async (q) => fetchResults(q)}
 *   onSelect={handleSelect}
 * />
 */

import React, { useCallback, useState } from 'react';
import { Box } from '../primitives';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { SearchSchemaHint } from './SearchSchemaHint';
import type { SearchResultItem } from './SearchResults';
import type { Style } from '../types';
import { useHotkey } from '../hooks';
import { useSearchSchema, detectSearchableFields } from '../useSearch';

export type ComboItem = SearchResultItem;

export interface SearchComboProps<T extends ComboItem = ComboItem> {
  /**
   * Static items to search client-side. Provide either items+searchKey
   * OR onSearch for async/custom search.
   */
  items?: T[];
  /**
   * Key(s) of T to match against the query. String or array of strings.
   * Ignored when onSearch is provided.
   */
  searchKey?: keyof T | (keyof T)[];
  /**
   * Async search function. Return items to display.
   * When provided, items prop is ignored.
   */
  onSearch?: (query: string) => T[] | Promise<T[]>;
  onSelect?: (item: T, index: number) => void;
  onClear?: () => void;
  debounce?: number;
  placeholder?: string;
  /** Max results to show. Default: 8. */
  maxResults?: number;
  /** Show dropdown only when query is non-empty. Default: true. */
  showOnlyWhenTyping?: boolean;
  /**
   * Show a "Searching: field1, field2" hint below the input.
   * Useful for non-technical users who need to know what the search looks at.
   * Default: false.
   */
  showSchema?: boolean;
  style?: Style;
  dropdownStyle?: Style;
  autoFocus?: boolean;
  activeColor?: string;
  textColor?: string;
  mutedColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
}

export function SearchCombo<T extends ComboItem = ComboItem>({
  items: staticItems,
  searchKey,
  onSearch: asyncSearch,
  onSelect,
  onClear,
  debounce = 300,
  placeholder = 'Search...',
  maxResults = 8,
  showOnlyWhenTyping = true,
  showSchema = false,
  style,
  dropdownStyle,
  autoFocus,
  activeColor = '#3b82f6',
  textColor = 'rgba(255,255,255,0.9)',
  mutedColor = 'rgba(255,255,255,0.45)',
  backgroundColor = 'rgba(20,20,28,0.97)',
  borderColor = 'rgba(255,255,255,0.1)',
  borderRadius = 8,
}: SearchComboProps<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const sharedColors = { activeColor, textColor, mutedColor, backgroundColor, borderColor, borderRadius };

  // Schema: what fields this combo is actually searching
  const schema = useSearchSchema(staticItems ?? [], { key: searchKey });

  const runSearch = useCallback(
    async (q: string) => {
      setQuery(q);
      if (!q.trim()) {
        setResults([]);
        setActiveIndex(-1);
        setOpen(false);
        return;
      }

      setOpen(true);
      setActiveIndex(-1);

      if (asyncSearch) {
        setLoading(true);
        try {
          const res = await asyncSearch(q);
          setResults(res.slice(0, maxResults));
        } finally {
          setLoading(false);
        }
        return;
      }

      // Client-side search
      if (!staticItems || !searchKey) {
        setResults([]);
        return;
      }
      const keys = Array.isArray(searchKey) ? searchKey : [searchKey];
      const lower = q.toLowerCase();
      const matched = staticItems.filter((item) =>
        keys.some((k) => String(item[k] ?? '').toLowerCase().includes(lower)),
      );
      setResults(matched.slice(0, maxResults));
    },
    [asyncSearch, staticItems, searchKey, maxResults],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setOpen(false);
    onClear?.();
  }, [onClear]);

  const handleSelect = useCallback(
    (item: T, index: number) => {
      setOpen(false);
      setActiveIndex(-1);
      onSelect?.(item, index);
    },
    [onSelect],
  );

  // Arrow key navigation
  useHotkey('arrowdown', () => {
    if (!open || results.length === 0) return;
    setActiveIndex((i) => Math.min(i + 1, results.length - 1));
  }, { enabled: open });

  useHotkey('arrowup', () => {
    if (!open || results.length === 0) return;
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, { enabled: open });

  useHotkey('escape', () => {
    if (!open) return;
    setOpen(false);
    setActiveIndex(-1);
  }, { enabled: open });

  useHotkey('return', () => {
    if (!open || activeIndex < 0 || activeIndex >= results.length) return;
    handleSelect(results[activeIndex], activeIndex);
  }, { enabled: open && activeIndex >= 0 });

  const showDropdown = open && (!showOnlyWhenTyping || query.length > 0);

  return (
    <Box style={{ gap: 4, ...(style as any) }}>
      <SearchBar
        onSearch={runSearch}
        onClear={handleClear}
        debounce={debounce}
        placeholder={placeholder}
        autoFocus={autoFocus}
        accentColor={activeColor}
        backgroundColor={backgroundColor}
        color={textColor}
        borderColor={borderColor}
        borderRadius={borderRadius}
      />
      {showSchema && (
        <SearchSchemaHint
          schema={schema}
          color={mutedColor}
          fieldColor={textColor}
        />
      )}
      {showDropdown && (
        <SearchResults
          items={results}
          activeIndex={activeIndex}
          onSelect={handleSelect}
          loading={loading}
          emptyMessage="No results found"
          style={dropdownStyle}
          {...sharedColors}
        />
      )}
    </Box>
  );
}
