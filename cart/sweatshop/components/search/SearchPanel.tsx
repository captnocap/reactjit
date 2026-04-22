
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

import { SearchInput } from './SearchInput';
import { SearchScope } from './SearchScope';
import { SearchFilters, DEFAULT_FILE_TYPES } from './SearchFilters';
import { SearchResults } from './SearchResults';
import { SearchPreview } from './SearchPreview';
import { SearchReplace } from './SearchReplace';

import { useSearchEngine, type SearchMatch, type SearchMode, type SearchProvider, type SearchScope as Scope, type SearchOptions } from './useSearchEngine';
import { useSearchHistory } from './useSearchHistory';

export interface SearchPanelProps {
  provider: SearchProvider;
  currentFile?: string | null;
  openFiles?: string[];
  hasSelection?: boolean;
  onOpenMatch?: (m: SearchMatch) => void;
  onConfirmReplace?: (replacement: string, matches: SearchMatch[]) => void;
  width?: number | string;
}

export function SearchPanel(props: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('literal');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [scope, setScope] = useState<Scope>('directory');
  const [customGlob, setCustomGlob] = useState('');
  const [include, setInclude] = useState<string[]>([]);
  const [exclude, setExclude] = useState<string[]>(['node_modules/**', 'dist/**', '.git/**']);
  const [activeFileTypes, setActiveFileTypes] = useState<Record<string, boolean>>({});
  const [maxResults, setMaxResults] = useState(5000);
  const [showContext, setShowContext] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hovered, setHovered] = useState<SearchMatch | null>(null);
  const [showReplace, setShowReplace] = useState(false);

  const engine = useSearchEngine(props.provider);
  const history = useSearchHistory();

  const effectiveInclude = useMemo(() => {
    const types = Object.keys(activeFileTypes).filter((k) => activeFileTypes[k]);
    if (types.length === 0) return include;
    const globs = types.map((t) => '**/*.' + t);
    return include.concat(globs);
  }, [include, activeFileTypes]);

  const submit = useCallback(() => {
    if (!query.trim()) return;
    const opts: SearchOptions = {
      query,
      mode,
      caseSensitive,
      scope,
      customGlob,
      include: effectiveInclude,
      exclude,
      currentFile: props.currentFile ?? null,
      openFiles: props.openFiles ?? [],
      selection: null,
      maxResults,
    };
    engine.run(opts);
    history.push(query);
  }, [query, mode, caseSensitive, scope, customGlob, effectiveInclude, exclude, maxResults, engine, history, props.currentFile, props.openFiles]);

  const toneDim = COLORS.textDim;

  return (
    <Col style={{
      width: props.width ?? 420,
      flexGrow: 1, flexBasis: 0, minHeight: 0,
      backgroundColor: COLORS.appBg || '#02050a',
      borderLeftWidth: 1, borderColor: COLORS.border || '#1a222c',
      flexDirection: 'column',
    }}>
      <SearchInput
        query={query}
        onQueryChange={setQuery}
        onSubmit={submit}
        mode={mode}
        onModeChange={setMode}
        caseSensitive={caseSensitive}
        onToggleCase={() => setCaseSensitive(!caseSensitive)}
        running={engine.running}
        onCancel={engine.cancel}
        hitCount={engine.totalMatches}
      />

      <SearchScope
        scope={scope}
        onChange={setScope}
        customGlob={customGlob}
        onCustomGlobChange={setCustomGlob}
        openFileCount={(props.openFiles ?? []).length}
        currentFile={props.currentFile ?? null}
        hasSelection={!!props.hasSelection}
      />

      <SearchFilters
        include={include}
        exclude={exclude}
        onIncludeChange={setInclude}
        onExcludeChange={setExclude}
        fileTypes={DEFAULT_FILE_TYPES}
        activeFileTypes={activeFileTypes}
        onToggleFileType={(t) => setActiveFileTypes((prev: Record<string, boolean>) => ({ ...prev, [t]: !prev[t] }))}
        maxResults={maxResults}
        onMaxResultsChange={setMaxResults}
        expanded={filtersOpen}
        onToggleExpanded={() => setFiltersOpen(!filtersOpen)}
      />

      <Row style={{
        alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Pressable onPress={() => setShowReplace(!showReplace)}
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
            backgroundColor: showReplace ? (COLORS.purple || '#d2a8ff') : (COLORS.panelAlt || '#0b1018'),
            borderWidth: 1, borderColor: COLORS.purple || '#d2a8ff',
          }}>
          <Text style={{ color: showReplace ? (COLORS.appBg || '#05090f') : (COLORS.purple || '#d2a8ff'), fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
            {showReplace ? 'HIDE REPLACE' : 'REPLACE'}
          </Text>
        </Pressable>
        {history.entries.length > 0 ? (
          <Text style={{ color: toneDim, fontSize: 9 }}>history:</Text>
        ) : null}
        {history.entries.slice(0, 4).map((h) => (
          <Pressable key={h.q + ':' + h.t} onPress={() => { setQuery(h.q); }}
            style={{
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
              backgroundColor: COLORS.panelAlt || '#0b1018',
              borderWidth: 1, borderColor: COLORS.border || '#1f2630',
            }}>
            <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{h.q}</Text>
          </Pressable>
        ))}
        <Box style={{ flexGrow: 1 }} />
        {engine.error ? <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9 }}>{engine.error}</Text> : null}
      </Row>

      {showReplace ? (
        <Box style={{ padding: 8 }}>
          <SearchReplace matches={engine.matches} disabled={engine.running} onConfirm={props.onConfirmReplace} />
        </Box>
      ) : null}

      <SearchResults
        matches={engine.matches}
        running={engine.running}
        truncated={engine.truncated}
        scannedFiles={engine.scannedFiles}
        showContext={showContext}
        onToggleContext={() => setShowContext(!showContext)}
        onOpenLine={props.onOpenMatch}
        onHoverLine={setHovered}
      />

      <Box style={{ padding: 8, borderTopWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
        <SearchPreview match={hovered} />
      </Box>
    </Col>
  );
}
