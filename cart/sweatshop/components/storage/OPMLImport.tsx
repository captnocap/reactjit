
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { parseOPML, generateOPML } from '../../lib/rss/opml';

export interface FeedSub {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
}

export function OPMLImport(props: {
  feeds: FeedSub[];
  onImport: (feeds: FeedSub[]) => void;
  onExport: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleImport = useCallback(() => {
    setError('');
    try {
      const outlines = parseOPML(text);
      const subs = outlines.map((o) => ({
        title: o.title || o.text,
        xmlUrl: o.xmlUrl,
        htmlUrl: o.htmlUrl,
      }));
      props.onImport(subs);
      setText('');
    } catch (e) {
      setError('Invalid OPML');
    }
  }, [text, props]);

  return (
    <Box style={{ padding: TOKENS.spaceSm, gap: TOKENS.spaceSm }}>
      <Row style={{ gap: TOKENS.spaceSm, alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>OPML</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable
          onPress={props.onExport}
          style={{ paddingLeft: TOKENS.spaceSm, paddingRight: TOKENS.spaceSm, paddingTop: TOKENS.spaceXs, paddingBottom: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}
        >
          <Text fontSize={9} color={COLORS.text}>Export</Text>
        </Pressable>
      </Row>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Paste OPML XML..."
        multiline={true}
        style={{
          fontSize: 9,
          color: COLORS.text,
          backgroundColor: COLORS.panelBg,
          borderRadius: TOKENS.radiusSm,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: TOKENS.spaceSm,
          minHeight: 80,
        }}
      />
      {error ? <Text fontSize={9} color={COLORS.red}>{error}</Text> : null}
      <Pressable
        onPress={handleImport}
        style={{
          padding: TOKENS.spaceSm,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.blueDeep,
          borderWidth: 1,
          borderColor: COLORS.blue,
          alignItems: 'center',
        }}
      >
        <Text fontSize={10} color={COLORS.blue}>Import feeds</Text>
      </Pressable>
    </Box>
  );
}
