// ── Indexer Panel ────────────────────────────────────────────────────────────
// Workspace file indexing UI: index, search, stats, manage indexed files.

const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';
import {
  indexWorkspace,
  loadIndex,
  getIndexStats,
  getIndexProgress,
  searchIndex,
  clearIndex,
  type IndexStats,
  type IndexedFile,
  type IndexProgress,
} from '../indexer';

export function IndexerPanel(props: { workDir: string; onIndex?: () => void }) {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [progress, setProgress] = useState<IndexProgress>(getIndexProgress());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IndexedFile[]>([]);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setStats(getIndexStats());
      setProgress(getIndexProgress());
      setResults(query.trim() ? searchIndex(query) : loadIndex());
    };
    refresh();
    const id = setInterval(refresh, 300);
    return () => clearInterval(id);
  }, [props.workDir, query]);

  async function doIndex() {
    setIndexing(true);
    try {
      const s = await indexWorkspace(props.workDir);
      setStats(s);
      setResults(query.trim() ? searchIndex(query) : loadIndex());
      props.onIndex?.();
    } finally {
      setIndexing(false);
      setProgress(getIndexProgress());
    }
  }

  function doSearch(q: string) {
    setQuery(q);
    setResults(q.trim() ? searchIndex(q) : loadIndex());
  }

  function doClear() {
    clearIndex();
    setStats(getIndexStats());
    setProgress(getIndexProgress());
    setResults([]);
    props.onIndex?.();
  }

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
  const currentFileLabel = progress.currentFile
    ? progress.currentFile.replace(props.workDir.endsWith('/') ? props.workDir : `${props.workDir}/`, '')
    : 'Waiting for scan';

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
              {langEntries.slice(0, 5).map(([lang, count]) => (
                <Pill key={lang} label={`${lang}: ${count}`} tiny={true} />
              ))}
            </Row>
            <Text fontSize={10} color={COLORS.textDim}>Idle until the next re-index. The last snapshot stays in local store.</Text>
          </Col>
        )}
      </Box>

      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <TextInput
          value={query}
          onChangeText={doSearch}
          placeholder="Search indexed files..."
          style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
        />
        <Text fontSize={10} color={COLORS.textDim}>{results.length} file{results.length !== 1 ? 's' : ''}</Text>

        <Col style={{ gap: 4, maxHeight: 320 }}>
          <ScrollView style={{ flexGrow: 1 }}>
            {results.map(f => (
              <Row key={f.path} style={{ alignItems: 'center', gap: 8, padding: 6, borderRadius: 6 }}>
                <Pill label={f.metadata.language} color={COLORS.blue} tiny={true} />
                <Text fontSize={10} color={COLORS.textBright} style={{ flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>{f.path.replace(props.workDir + '/', '')}</Text>
                <Text fontSize={9} color={COLORS.textDim}>{f.tokenCount}t</Text>
              </Row>
            ))}
          </ScrollView>
        </Col>
      </Box>
    </Col>
  );
}
