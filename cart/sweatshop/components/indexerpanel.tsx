// ── Indexer Panel ────────────────────────────────────────────────────────────
// Workspace file indexing UI: index, search, stats, manage indexed files.

const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';
import { RenamePanel } from './renamepanel';
import {
  indexWorkspace,
  loadIndex,
  getIndexStats,
  getIndexProgress,
  getStaleIndexCount,
  getIndexAutoReindexConfig,
  listIndexDirectories,
  markAutoReindexRun,
  searchIndexHits,
  setIndexAutoReindexMode,
  setDirectoryIncluded,
  clearIndex,
  type IndexStats,
  type IndexSearchHit,
  type IndexProgress,
  type IndexDirectory,
  type IndexAutoReindexMode,
} from '../indexer';

export function IndexerPanel(props: { workDir: string; onIndex?: () => void }) {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [progress, setProgress] = useState<IndexProgress>(getIndexProgress());
  const [staleCount, setStaleCount] = useState(0);
  const [directories, setDirectories] = useState<IndexDirectory[]>([]);
  const [autoMode, setAutoModeState] = useState<IndexAutoReindexMode>(getIndexAutoReindexConfig().mode);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexSearchHit[]>([]);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setStats(getIndexStats());
      setProgress(getIndexProgress());
      setStaleCount(getStaleIndexCount(props.workDir));
      setAutoModeState(getIndexAutoReindexConfig().mode);
      setResults(query.trim() ? searchIndexHits(query) : buildIdleHits());
    };
    refresh();
    const id = setInterval(refresh, 300);
    return () => clearInterval(id);
  }, [props.workDir, query]);

  useEffect(() => {
    setDirectories(listIndexDirectories(props.workDir));
  }, [props.workDir]);

  async function doIndex(reason: 'manual' | 'auto' = 'manual') {
    setIndexing(true);
    try {
      const s = await indexWorkspace(props.workDir);
      setStats(s);
      if (reason === 'auto') {
        markAutoReindexRun();
      }
      setResults(query.trim() ? searchIndexHits(query) : buildIdleHits());
      props.onIndex?.();
    } finally {
      setIndexing(false);
      setProgress(getIndexProgress());
    }
  }

  function doSearch(q: string) {
    setQuery(q);
    setResults(q.trim() ? searchIndexHits(q) : buildIdleHits());
  }

  function doClear() {
    clearIndex();
    setStats(getIndexStats());
    setProgress(getIndexProgress());
    setResults([]);
    props.onIndex?.();
  }

  function toggleDirectory(dir: IndexDirectory) {
    setDirectoryIncluded(dir.path, !dir.included);
    setDirectories(listIndexDirectories(props.workDir));
  }

  function setAutoMode(mode: IndexAutoReindexMode) {
    setIndexAutoReindexMode(mode);
    setAutoModeState(mode);
  }

  function buildIdleHits() {
    return loadIndex().map((file) => ({
      path: file.path,
      lineNumber: 1,
      snippet: file.content ? file.content.split('\n')[0] || file.path : file.path,
      matchKind: 'path' as const,
      symbols: file.symbols || [],
    }));
  }

  function formatDuration(ms: number): string {
    if (!isFinite(ms) || ms <= 0) return 'due now';
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.ceil(minutes / 60);
    return `${hours}h`;
  }

  useEffect(() => {
    if (autoMode === 'off' || indexing) return;
    const tick = () => {
      const cfg = getIndexAutoReindexConfig();
      const currentMode = cfg.mode;
      if (currentMode !== autoMode) {
        setAutoModeState(currentMode);
      }
      if (currentMode === 'off' || indexing) return;
      const now = Date.now();
      const lastIndexedAt = stats?.lastIndexedAt || 0;
      const stale = getStaleIndexCount(props.workDir);
      if (currentMode === 'on-save') {
        if (stale > 0 && now - cfg.lastAutoReindexAt > 30_000) {
          doIndex('auto');
        }
        return;
      }
      const intervalMs = currentMode === '15m' ? 15 * 60 * 1000 : 60 * 60 * 1000;
      if (lastIndexedAt > 0 && now - lastIndexedAt >= intervalMs && now - cfg.lastAutoReindexAt > 30_000) {
        doIndex('auto');
      }
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [autoMode, indexing, props.workDir, stats?.lastIndexedAt, staleCount]);

  const langEntries = stats ? Object.entries(stats.languages).sort((a, b) => b[1] - a[1]) : [];
  const progressLabel = progress.totalFiles > 0
    ? `${progress.scannedFiles}/${progress.totalFiles} files`
    : '0 files';
  const progressRate = progress.rate > 0 ? `${progress.rate.toFixed(1)} files/s` : '0 files/s';
  const lastIndexedLabel = stats && stats.lastIndexedAt > 0
    ? new Date(stats.lastIndexedAt).toLocaleString()
    : 'never';
  const indexSizeLabel = stats
    ? `${stats.totalTokens.toLocaleString()} tokens`
    : '0 tokens';
  const staleLabel = staleCount > 0 ? `${staleCount} stale` : 'fresh';
  const currentFileLabel = progress.currentFile
    ? progress.currentFile.replace(props.workDir.endsWith('/') ? props.workDir : `${props.workDir}/`, '')
    : 'Waiting for scan';
  const scheduleIntervalMs = autoMode === '15m' ? 15 * 60 * 1000 : autoMode === '1h' ? 60 * 60 * 1000 : 0;
  const nextAutoLabel = autoMode === 'off'
    ? 'off'
    : autoMode === 'on-save'
      ? (staleCount > 0 ? 'pending save' : 'watching saves')
      : stats && stats.lastIndexedAt > 0
        ? formatDuration(scheduleIntervalMs - (Date.now() - stats.lastIndexedAt))
        : 'waiting';

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Workspace Index</Text>
        <Text fontSize={10} color={COLORS.textDim}>Index files for semantic search, context injection, and code intelligence.</Text>

        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={doIndex} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{indexing ? 'Indexing...' : 'Re-index'}</Text>
          </Pressable>
          <Pressable onPress={doClear} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={11} color={COLORS.textDim}>Clear</Text>
          </Pressable>
        </Row>

        <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Auto reindex</Text>
          {([
            ['off', 'Off'],
            ['15m', '15m'],
            ['1h', '1h'],
            ['on-save', 'On save'],
          ] as Array<[IndexAutoReindexMode, string]>).map(([mode, label]) => (
            <Pressable
              key={mode}
              onPress={() => setAutoMode(mode)}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: autoMode === mode ? COLORS.blue : COLORS.border,
                backgroundColor: autoMode === mode ? COLORS.blueDeep : COLORS.panelAlt,
              }}
            >
              <Text fontSize={9} color={autoMode === mode ? COLORS.blue : COLORS.textDim}>{label}</Text>
            </Pressable>
          ))}
          <Pill label={`next ${nextAutoLabel}`} tiny={true} />
        </Row>

        {progress.active ? (
          <Col style={{ gap: 8 }}>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Pill label={progressLabel} color={COLORS.yellow} tiny={true} />
              <Pill label={progressRate} color={COLORS.blue} tiny={true} />
              <Pill label={`current: ${currentFileLabel}`} color={COLORS.textBright} tiny={true} />
            </Row>
            <Text fontSize={10} color={COLORS.textDim}>Scanning in progress. The rate updates as files are indexed.</Text>
          </Col>
        ) : (
          <Col style={{ gap: 8 }}>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Pill label={`${stats?.totalFiles || 0} files`} color={COLORS.green} tiny={true} />
              <Pill label={indexSizeLabel} color={COLORS.blue} tiny={true} />
              <Pill label={`last indexed ${lastIndexedLabel}`} color={COLORS.yellow} tiny={true} />
              <Pill label={staleLabel} color={staleCount > 0 ? COLORS.red : COLORS.green} tiny={true} />
              {langEntries.slice(0, 5).map(([lang, count]) => (
                <Pill key={lang} label={`${lang}: ${count}`} tiny={true} />
              ))}
            </Row>
            <Text fontSize={10} color={COLORS.textDim}>Idle until the next re-index. The last snapshot stays in local store.</Text>
          </Col>
        )}
      </Box>

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Directory filters</Text>
          <Pill label={`${directories.length} dirs`} tiny={true} />
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>Toggle directories to include or exclude them from the next index run.</Text>
        <ScrollView style={{ maxHeight: 180 }}>
          <Col style={{ gap: 6 }}>
            {directories.map((dir) => (
              <Pressable
                key={dir.path}
                onPress={() => toggleDirectory(dir)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: dir.included ? COLORS.border : COLORS.red,
                  backgroundColor: dir.included ? COLORS.panelAlt : COLORS.redDeep,
                }}
              >
                <Row style={{ alignItems: 'center', gap: 8 }}>
                  <Text fontSize={10} color={COLORS.textBright} style={{ flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>
                    {dir.path}
                  </Text>
                  <Pill label={dir.included ? 'include' : 'exclude'} color={dir.included ? COLORS.green : COLORS.red} tiny={true} />
                </Row>
              </Pressable>
            ))}
          </Col>
        </ScrollView>
      </Box>

      <RenamePanel workDir={props.workDir} onApplied={props.onIndex} />

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <TextInput
          value={query}
          onChangeText={doSearch}
          placeholder="Keyword search indexed content..."
          style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <Text fontSize={10} color={COLORS.textDim}>{results.length} hit{results.length !== 1 ? 's' : ''}</Text>

        <Col style={{ gap: 8, maxHeight: 320 }}>
          <ScrollView style={{ flexGrow: 1 }}>
            {results.map((hit) => {
              const relativePath = hit.path.replace(props.workDir + '/', '');
              const symbolNames = hit.symbols.slice(0, 4);
              const moreSymbols = hit.symbols.length - symbolNames.length;
              return (
                <Box key={`${hit.path}:${hit.lineNumber}`} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
                  <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>
                      {relativePath}:{hit.lineNumber}
                    </Text>
                    <Pill
                      label={hit.matchKind}
                      color={hit.matchKind === 'content' ? COLORS.green : hit.matchKind === 'symbol' ? COLORS.blue : COLORS.textDim}
                      tiny={true}
                    />
                  </Row>
                  <Text fontSize={10} color={COLORS.text}>{hit.snippet || 'TODO: no snippet available'}</Text>
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {symbolNames.length > 0 ? symbolNames.map((symbol) => (
                      <Pill key={`${hit.path}:${symbol.name}:${symbol.lineNumber}`} label={`${symbol.kind} ${symbol.name}`} color={COLORS.yellow} tiny={true} />
                    )) : (
                      <Pill label="TODO: symbol index" color={COLORS.textDim} tiny={true} />
                    )}
                    {moreSymbols > 0 ? <Pill label={`+${moreSymbols}`} tiny={true} /> : null}
                  </Row>
                </Box>
              );
            })}
          </ScrollView>
        </Col>
      </Box>
    </Col>
  );
}
