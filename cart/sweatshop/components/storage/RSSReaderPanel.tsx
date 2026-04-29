
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useFeedAggregate } from '../../lib/rss/useFeedStream';
import { generateOPML } from '../../lib/rss/opml';
import type { FeedItem } from '../../lib/rss/types';
import { FeedItemRow } from './FeedItemRow';
import { FeedReader } from './FeedReader';
import { OPMLImport, type FeedSub } from './OPMLImport';

const FEEDS_KEY = 'rssreader_feeds_v1';
const READ_KEY = 'rssreader_read_v1';

function loadFeeds(): FeedSub[] {
  try {
    const raw = (globalThis as any).__localstore_get?.(FEEDS_KEY);
    return raw ? JSON.parse(raw) : [
      { title: 'HN', xmlUrl: 'https://hnrss.org/frontpage' },
      { title: 'Lobsters', xmlUrl: 'https://lobste.rs/rss' },
    ];
  } catch { return []; }
}
function saveFeeds(feeds: FeedSub[]) {
  (globalThis as any).__localstore_set?.(FEEDS_KEY, JSON.stringify(feeds));
}
function loadRead(): Set<string> {
  try {
    const raw = (globalThis as any).__localstore_get?.(READ_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveRead(read: Set<string>) {
  (globalThis as any).__localstore_set?.(READ_KEY, JSON.stringify(Array.from(read)));
}

export function RSSReaderPanel() {
  const [feeds, setFeeds] = useState<FeedSub[]>(loadFeeds);
  const [readIds, setReadIds] = useState<Set<string>>(loadRead);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [interval, setIntervalMs] = useState(300000);
  const urls = useMemo(() => feeds.map(f => f.xmlUrl), [feeds]);
  const { items, loading, refetch } = useFeedAggregate(urls, { interval: intervalMs, limit: 200 });

  const markRead = useCallback((id: string) => {
    setReadIds(prev => { const next = new Set(prev); next.add(id); saveRead(next); return next; });
  }, []);

  const onSelect = useCallback((item: FeedItem) => {
    markRead(item.id);
    setSelectedItem(item);
  }, [markRead]);

  const addFeed = useCallback(() => {
    if (!newUrl) return;
    const next = [...feeds, { title: newTitle || newUrl, xmlUrl: newUrl }];
    setFeeds(next); saveFeeds(next); setNewUrl(''); setNewTitle(''); setShowAdd(false);
  }, [feeds, newUrl, newTitle]);

  const removeFeed = useCallback((url: string) => {
    const next = feeds.filter(f => f.xmlUrl !== url);
    setFeeds(next); saveFeeds(next);
  }, [feeds]);

  const filtered = unreadOnly ? items.filter(i => !readIds.has(i.id)) : items;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ padding: TOKENS.spaceSm, alignItems: 'center', gap: TOKENS.spaceSm, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>RSS</Text>
        <Pressable onPress={refetch} style={{ padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}><Text fontSize={9} color={COLORS.text}>Refresh</Text></Pressable>
        <Pressable onPress={() => setUnreadOnly(!unreadOnly)} style={{ padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: unreadOnly ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={9} color={unreadOnly ? COLORS.blue : COLORS.text}>{unreadOnly ? 'Unread' : 'All'}</Text></Pressable>
        <Pressable onPress={() => setShowAdd(!showAdd)} style={{ padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}><Text fontSize={9} color={COLORS.text}>+Feed</Text></Pressable>
        {loading ? <Text fontSize={9} color={COLORS.textDim}>…</Text> : <Text fontSize={9} color={COLORS.textDim}>{filtered.length}</Text>}
      </Row>

      {showAdd ? (
        <Row style={{ padding: TOKENS.spaceSm, gap: TOKENS.spaceSm, borderBottomWidth: 1, borderBottomColor: COLORS.border, alignItems: 'center' }}>
          <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Title" style={{ fontSize: 9, color: COLORS.text, backgroundColor: COLORS.panelAlt, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, padding: TOKENS.spaceXs, width: 120 }} />
          <TextInput value={newUrl} onChangeText={setNewUrl} placeholder="Feed URL" style={{ fontSize: 9, color: COLORS.text, backgroundColor: COLORS.panelAlt, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, padding: TOKENS.spaceXs, flexGrow: 1 }} />
          <Pressable onPress={addFeed} style={{ padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.blueDeep }}><Text fontSize={9} color={COLORS.blue}>Add</Text></Pressable>
        </Row>
      ) : null}

      <Row style={{ flexGrow: 1, flexBasis: 0 }}>
        <Col style={{ width: 160, borderRightWidth: 1, borderRightColor: COLORS.border }}>
          <ScrollView style={{ flexGrow: 1, padding: TOKENS.spaceXs }}>
            <Col style={{ gap: TOKENS.spaceXs }}>
              {feeds.map(f => (
                <Row key={f.xmlUrl} style={{ alignItems: 'center', gap: TOKENS.spaceXs, padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm }}>
                  <Text fontSize={9} color={COLORS.text} style={{ flexShrink: 1 }} numberOfLines={1}>{f.title}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Pressable onPress={() => removeFeed(f.xmlUrl)}><Text fontSize={9} color={COLORS.textDim}>×</Text></Pressable>
                </Row>
              ))}
            </Col>
          </ScrollView>
          <Box style={{ borderTopWidth: 1, borderTopColor: COLORS.border, padding: TOKENS.spaceXs }}>
            <OPMLImport feeds={feeds} onImport={(subs) => { const next = [...feeds, ...subs]; setFeeds(next); saveFeeds(next); }} onExport={() => {
              const opml = generateOPML('Sweatshop Feeds', feeds);
              (globalThis as any).__clipboard_set?.(opml);
            }} />
          </Box>
        </Col>

        <Box style={{ flexGrow: 1, flexBasis: 0 }}>
          {selectedItem ? (
            <FeedReader item={selectedItem} onClose={() => setSelectedItem(null)} />
          ) : (
            <ScrollView style={{ flexGrow: 1, padding: TOKENS.spaceSm }}>
              <Col style={{ gap: TOKENS.spaceXs }}>
                {filtered.map(item => (
                  <FeedItemRow key={item.id} item={item} feedTitle={item.feedTitle} unread={!readIds.has(item.id)} onPress={() => onSelect(item)} />
                ))}
                {filtered.length === 0 && !loading ? <Text fontSize={10} color={COLORS.textDim}>No items</Text> : null}
              </Col>
            </ScrollView>
          )}
        </Box>
      </Row>
    </Box>
  );
}
