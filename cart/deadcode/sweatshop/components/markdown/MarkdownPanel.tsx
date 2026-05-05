
import { Box, Col, Pressable, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS, baseName } from '../../theme';
import { MarkdownRenderer } from './MarkdownRenderer';
import { HeadingNav } from './HeadingNav';
import { useMarkdownAst } from './useMarkdownAst';

function TabButton(props: { active?: boolean; label: string; onPress: () => void }) {
  const active = props.active === true;
  return <Pressable onPress={props.onPress} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={active ? COLORS.blue : COLORS.text}>{props.label}</Text></Pressable>;
}

export function MarkdownPanel(props: { currentFilePath: string; source: string; title?: string; onOpenPath: (path: string) => void; onClose?: () => void }) {
  const ast = useMarkdownAst(props.source);
  const [tab, setTab] = useState<'preview' | 'toc' | 'search'>('preview');
  const [showToc, setShowToc] = useState(1);
  const [fontSize, setFontSize] = useState(12);
  const [lineWidth, setLineWidth] = useState(760);
  const [query, setQuery] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [headingY, setHeadingY] = useState<Record<string, number>>({});

  const activeHeadingId = useMemo(() => {
    let active = ast.headings[0]?.id || '';
    for (const heading of ast.headings) if ((headingY[heading.id] ?? 0) <= scrollY + 24) active = heading.id;
    return active;
  }, [ast.headings, headingY, scrollY]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? ast.search.filter((entry) => entry.text.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q)) : ast.search).slice(0, 30);
  }, [ast.search, query]);

  const jumpTo = (id: string) => setScrollY(headingY[id] ?? 0);
  const isPreview = tab === 'preview';

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 140 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || baseName(props.currentFilePath) || 'Markdown Preview'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{ast.blocks.length} blocks · {ast.headings.length} headings</Text>
        </Col>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <TabButton label="Preview" active={tab === 'preview'} onPress={() => setTab('preview')} />
          <TabButton label="TOC" active={tab === 'toc'} onPress={() => setTab('toc')} />
          <TabButton label="Search" active={tab === 'search'} onPress={() => setTab('search')} />
          <TabButton label={showToc ? 'Hide TOC' : 'Show TOC'} active={showToc === 1} onPress={() => setShowToc(showToc ? 0 : 1)} />
        </Row>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim}>font</Text>
          <TextInput value={String(fontSize)} onChangeText={(v: string) => { const n = Number(v); if (Number.isFinite(n)) setFontSize(Math.max(10, Math.min(20, Math.round(n)))); }} style={{ width: 42, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10 }} />
          <Text fontSize={9} color={COLORS.textDim}>width</Text>
          <TextInput value={String(lineWidth)} onChangeText={(v: string) => { const n = Number(v); if (Number.isFinite(n)) setLineWidth(Math.max(520, Math.min(1200, Math.round(n)))); }} style={{ width: 56, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10 }} />
          {props.onClose ? <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}><Text fontSize={10} color={COLORS.textDim}>Close</Text></Pressable> : null}
        </Row>
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, position: 'relative' }}>
        <MarkdownRenderer ast={ast} basePath={props.currentFilePath} fontSize={fontSize} lineWidth={lineWidth} query={query} scrollY={scrollY} onScroll={setScrollY} onHeadingLayout={(id, y) => setHeadingY((prev) => (prev[id] === y ? prev : { ...prev, [id]: y }))} onOpenPath={props.onOpenPath} />
        {tab !== 'search' && (showToc || tab === 'toc') ? <HeadingNav headings={ast.headings} activeId={activeHeadingId} visible={true} onJump={jumpTo} /> : null}
        {tab === 'search' ? (
          <Box style={{ position: 'absolute', right: 10, top: 10, bottom: 10, width: 250, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusLg, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
            <Col style={{ padding: 8, gap: 6, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search current markdown…" style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10 }} />
              <Text fontSize={9} color={COLORS.textDim}>{hits.length} matches</Text>
            </Col>
            <Col style={{ gap: 4, padding: 8 }}>
              {hits.map((hit) => <Pressable key={hit.id} onPress={() => jumpTo(hit.id)} style={{ padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}><Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{hit.label}</Text><Text fontSize={9} color={COLORS.textDim}>{hit.text.slice(0, 120)}</Text></Pressable>)}
            </Col>
          </Box>
        ) : null}
      </Box>
    </Col>
  );
}

export default MarkdownPanel;
