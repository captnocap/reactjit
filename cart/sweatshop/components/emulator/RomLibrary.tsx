import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useRomLibrary, type RomEntry } from './useRomLibrary';
import { RomCard } from './RomCard';
import { RomImport } from './RomImport';

type Filter = 'all' | 'favorites' | 'recent';

function sortedRoms(roms: RomEntry[], filter: Filter, query: string): RomEntry[] {
  const q = query.trim().toLowerCase();
  let list = roms;
  if (q) list = list.filter((r) =>
    r.displayName.toLowerCase().indexOf(q) >= 0 ||
    r.crc32.toLowerCase().indexOf(q) >= 0 ||
    r.path.toLowerCase().indexOf(q) >= 0,
  );
  if (filter === 'favorites') list = list.filter((r) => r.favorite);
  if (filter === 'recent') list = list.filter((r) => r.lastPlayedAt !== null);

  const out = list.slice();
  if (filter === 'recent') {
    out.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  } else {
    out.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      if ((a.lastPlayedAt || 0) !== (b.lastPlayedAt || 0)) return (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      return a.displayName.localeCompare(b.displayName);
    });
  }
  return out;
}

export function RomLibrary(props: {
  activeRomId: string | null;
  onPlay: (rom: RomEntry) => void;
}) {
  const lib = useRomLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = sortedRoms(lib.roms, filter, query);
  const hasAny = lib.roms.length > 0;

  const chip = (label: string, f: Filter) => (
    <Pressable onPress={() => setFilter(f)}>
      <Box style={{
        paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
        borderRadius: TOKENS.radiusXs, borderWidth: 1,
        borderColor: filter === f ? COLORS.blue : COLORS.border,
        backgroundColor: filter === f ? COLORS.blueDeep : COLORS.panelAlt,
      }}>
        <Text fontSize={TOKENS.fontXs} color={filter === f ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>{label}</Text>
      </Box>
    </Pressable>
  );

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: TOKENS.padNormal, gap: TOKENS.spaceSm }}>
      <Row style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>ROM Library</Text>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>{lib.roms.length} {lib.roms.length === 1 ? 'game' : 'games'}</Text>
        <Box style={{ flexGrow: 1, flexBasis: 0 }} />
        {chip('All',       'all')}
        {chip('Favorites', 'favorites')}
        {chip('Recent',    'recent')}
      </Row>

      <Row style={{ gap: 6, alignItems: 'center' }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, path, or CRC…"
          style={{
            flexGrow: 1, flexBasis: 0, height: 26,
            paddingLeft: 8, paddingRight: 8,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontUI, fontSize: TOKENS.fontXs,
            color: COLORS.text,
          }}
        />
      </Row>

      <RomImport />

      {!hasAny ? (
        <Box style={{
          padding: TOKENS.padLoose * 2,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1, borderColor: COLORS.borderSoft,
          backgroundColor: COLORS.panelBg,
          alignItems: 'center',
          gap: 4,
        }}>
          <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>
            No ROMs yet
          </Text>
          <Text fontSize={TOKENS.fontSm} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI }}>
            Paste a path above or click Browse… to pick a .nes file.
          </Text>
        </Box>
      ) : visible.length === 0 ? (
        <Box style={{ padding: TOKENS.padLoose, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
          <Text fontSize={TOKENS.fontSm} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI }}>
            No matches. {filter !== 'all' ? 'Try filter All.' : ''}
          </Text>
        </Box>
      ) : (
        <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
          <Row style={{ flexWrap: 'wrap', gap: TOKENS.spaceSm }}>
            {visible.map((rom) => (
              <RomCard
                key={rom.id}
                rom={rom}
                active={rom.id === props.activeRomId}
                onPlay={(r) => { lib.recordLaunch(r.id); props.onPlay(r); }}
                onToggleFavorite={lib.toggleFavorite}
                onRemove={lib.remove}
              />
            ))}
          </Row>
        </ScrollView>
      )}
    </Col>
  );
}
