// SearchResults — windowed list of SearchResultFile groups. True pixel-level
// virtualization isn't available without scroll events on ScrollView, so we
// window by file-group count: render the current page (default 100 groups)
// and expose Prev / Next / Jump controls. This keeps 100k+ result sets
// responsive since only the current page mounts at a time.


import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { SearchResultFile } from './SearchResultFile';
import type { SearchMatch } from './useSearchEngine';

export interface SearchResultsProps {
  matches: SearchMatch[];
  running?: boolean;
  truncated?: boolean;
  scannedFiles?: number;
  groupsPerPage?: number;
  showContext?: boolean;
  onToggleContext?: () => void;
  onOpenLine?: (m: SearchMatch) => void;
  onHoverLine?: (m: SearchMatch | null) => void;
}

export function SearchResults(props: SearchResultsProps) {
  const { matches, running, truncated, scannedFiles, showContext, onToggleContext, onOpenLine, onHoverLine } = props;
  const groupsPerPage = props.groupsPerPage ?? 100;

  // Group by path preserving first-seen order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const by: Record<string, SearchMatch[]> = {};
    for (const m of matches) {
      if (!by[m.path]) { by[m.path] = []; order.push(m.path); }
      by[m.path].push(m);
    }
    return order.map((p) => ({ path: p, matches: by[p] }));
  }, [matches]);

  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(groups.length / groupsPerPage));
  useEffect(() => { if (page >= pageCount) setPage(0); }, [pageCount, page]);

  const slice = groups.slice(page * groupsPerPage, (page + 1) * groupsPerPage);

  const onToggle = (path: string) => setCollapsed((prev: Record<string, boolean>) => ({ ...prev, [path]: !prev[path] }));
  const onOpen = (m: SearchMatch) => {
    setSelectedKey(m.path + ':' + m.line + ':' + m.col);
    onOpenLine && onOpenLine(m);
  };

  const tone = COLORS.blue || '#79c0ff';

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
      <Row style={{
        alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
          {groups.length} {groups.length === 1 ? 'FILE' : 'FILES'} · {matches.length} HITS
        </Text>
        {running ? <Text style={{ color: COLORS.textDim, fontSize: 9 }}>· scanning {scannedFiles ?? 0}</Text> : null}
        {truncated ? <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700 }}>· truncated</Text> : null}
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={onToggleContext} style={chipStyle(showContext, tone)}>
          <Text style={{ color: showContext ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
            CONTEXT
          </Text>
        </Pressable>
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
        <Col style={{ padding: 6 }}>
          {slice.length === 0 ? (
            <Col style={{ padding: 18, alignItems: 'center', gap: 6 }}>
              <Text style={{ color: COLORS.textDim, fontSize: 11 }}>{running ? 'scanning...' : 'no results'}</Text>
              {!running ? <Text style={{ color: COLORS.textDim, fontSize: 9 }}>try widening scope or relaxing filters</Text> : null}
            </Col>
          ) : null}
          {slice.map((g) => (
            <SearchResultFile
              key={g.path}
              path={g.path}
              matches={g.matches}
              collapsed={!!collapsed[g.path]}
              onToggle={onToggle}
              selectedKey={selectedKey ?? undefined}
              showContext={showContext}
              onOpenLine={onOpen}
              onHoverLine={onHoverLine}
            />
          ))}
        </Col>
      </ScrollView>

      {pageCount > 1 ? (
        <Row style={{
          alignItems: 'center', gap: 6, padding: 6,
          backgroundColor: COLORS.panelRaised || '#05090f',
          borderTopWidth: 1, borderColor: COLORS.border || '#1f2630',
        }}>
          <Pressable onPress={() => setPage((p: number) => Math.max(0, p - 1))} style={navStyle()}>
            <Text style={{ color: tone, fontSize: 10, fontWeight: 700 }}>◀ prev</Text>
          </Pressable>
          <Text style={{ color: COLORS.textDim, fontSize: 10 }}>
            page {page + 1} / {pageCount} · files {page * groupsPerPage + 1}-{Math.min(groups.length, (page + 1) * groupsPerPage)} of {groups.length}
          </Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={() => setPage((p: number) => Math.min(pageCount - 1, p + 1))} style={navStyle()}>
            <Text style={{ color: tone, fontSize: 10, fontWeight: 700 }}>next ▶</Text>
          </Pressable>
        </Row>
      ) : null}
    </Col>
  );
}

function chipStyle(active: boolean, tone: string): any {
  return {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
    borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
  };
}

function navStyle(): any {
  return {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
  };
}
