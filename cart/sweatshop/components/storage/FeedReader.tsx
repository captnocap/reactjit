
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { FeedItem } from '../../lib/rss/types';

export function FeedReader(props: { item: FeedItem; onClose: () => void }) {
  const { item } = props;
  const body = item.content || item.description || '';
  const date = item.pubDate ? new Date(item.pubDate).toLocaleString() : '';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelRaised, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
      <Row style={{ padding: TOKENS.spaceSm, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>READER</Text>
        <Pressable onPress={props.onClose} style={{ padding: TOKENS.spaceXs }}>
          <Text fontSize={12} color={COLORS.textDim}>×</Text>
        </Pressable>
      </Row>
      <ScrollView style={{ flexGrow: 1, padding: TOKENS.spaceSm }}>
        <Col style={{ gap: TOKENS.spaceSm }}>
          <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.title}</Text>
          <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap' }}>
            {item.author ? <Text fontSize={9} color={COLORS.textDim}>By {item.author}</Text> : null}
            {date ? <Text fontSize={9} color={COLORS.textDim}>{date}</Text> : null}
            {item.link ? <Text fontSize={9} color={COLORS.blue}>{item.link}</Text> : null}
          </Row>
          <Text fontSize={10} color={COLORS.text} style={{ lineHeight: 16 }}>
            {body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
          </Text>
        </Col>
      </ScrollView>
    </Box>
  );
}
