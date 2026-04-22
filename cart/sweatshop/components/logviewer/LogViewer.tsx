import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useLogStream } from './useLogStream';
import { useLogFilters } from './useLogFilters';
import { LogList } from './LogList';
import { LogFilterBar } from './LogFilterBar';
import { LogDetailPane } from './LogDetailPane';
import { LogFollowToggle } from './LogFollowToggle';
import { LogExport } from './LogExport';

const CATEGORY_COLORS: Record<string, string> = {
  app: COLORS.green,
  network: COLORS.blue,
  db: COLORS.purple,
  render: COLORS.orange,
  input: COLORS.yellow,
  bridge: COLORS.red,
  theme: COLORS.blue,
};

export interface LogViewerProps {
  maxEntries?: number;
}

export function LogViewer(props: LogViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [timestampFormat, setTimestampFormat] = useState<'iso' | 'time' | 'relative'>('iso');
  const [colorPerCategory, setColorPerCategory] = useState(true);
  const [autoScrollThreshold, setAutoScrollThreshold] = useState(200);

  const entries = useLogStream({ maxEntries: props.maxEntries ?? 50000 });
  const filters = useLogFilters();

  const categories = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.category));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(filters.applyFilter);
  }, [entries, filters.applyFilter]);

  const selectedEntry = useMemo(
    () => filtered.find((e) => e.id === selectedId) || null,
    [filtered, selectedId]
  );

  const isLive = entries.length > 0 && filtered.length > 0;

  const handleTimeRange = useCallback((range: '5m' | '1h' | 'all') => {
    const now = Date.now();
    if (range === '5m') filters.setTimeRange(now - 5 * 60000, now);
    else if (range === '1h') filters.setTimeRange(now - 3600000, now);
    else filters.setTimeRange(null, null);
  }, [filters]);

  return (
    <Col style={{ flexGrow: 1, backgroundColor: COLORS.panelBg }}>
      {/* Toolbar */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: COLORS.border }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Logs</Text>
          <Text fontSize={9} color={COLORS.textDim}>{filtered.length} / {entries.length}</Text>
        </Row>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <LogFollowToggle follow={follow} onToggle={() => setFollow((v) => !v)} live={isLive} />
          <LogExport entries={filtered} />
        </Row>
      </Row>

      {/* Filter bar */}
      <LogFilterBar
        activeLevels={filters.state.levels}
        toggleLevel={filters.toggleLevel}
        categories={categories}
        activeCategories={filters.state.categories}
        toggleCategory={filters.toggleCategory}
        search={filters.state.search}
        onSearch={filters.setSearch}
        onTimeRange={handleTimeRange}
      />

      {/* List + detail */}
      <Row style={{ flexGrow: 1 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0 }}>
          <LogList
            entries={filtered}
            selectedId={selectedId}
            onSelect={(e) => setSelectedId(e.id)}
            follow={follow}
            timestampFormat={timestampFormat}
            colorPerCategory={colorPerCategory}
            categoryColors={CATEGORY_COLORS}
          />
        </Box>
        <LogDetailPane entry={selectedEntry} />
      </Row>
    </Col>
  );
}

