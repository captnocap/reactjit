const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { FeedItem } from '../../lib/rss/types';

export function FeedItemRow(props: {
  item: FeedItem;
  feedTitle?: string;
  selected?: boolean;
  unread?: boolean;
  onPress: () => void;
}) {
  const { item, feedTitle, selected, unread } = props;
  const date = item.pubDate
    ? new Date(item.pubDate).toLocaleDateString()
    : '';

  return (
    <Pressable
      onPress={props.onPress}
      style={{
        padding: TOKENS.spaceSm,
        borderRadius: TOKENS.radiusSm,
        backgroundColor: selected ? COLORS.blueDeep : unread ? COLORS.panelRaised : COLORS.panelAlt,
        borderWidth: 1,
        borderColor: selected ? COLORS.blue : COLORS.border,
        gap: TOKENS.spaceXs,
      }}
    >
      <Row style={{ alignItems: 'center', gap: TOKENS.spaceXs }}>
        {unread ? (
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} />
        ) : null}
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexShrink: 1 }} numberOfLines={1}>
          {item.title}
        </Text>
      </Row>
      <Row style={{ alignItems: 'center', gap: TOKENS.spaceXs }}>
        {feedTitle ? (
          <Text fontSize={9} color={COLORS.blue}>{feedTitle}</Text>
        ) : null}
        {item.author ? (
          <Text fontSize={9} color={COLORS.textDim}>{item.author}</Text>
        ) : null}
        <Box style={{ flexGrow: 1 }} />
        {date ? <Text fontSize={9} color={COLORS.textDim}>{date}</Text> : null}
      </Row>
      {item.categories.length > 0 ? (
        <Row style={{ gap: TOKENS.spaceXs, flexWrap: 'wrap' }}>
          {item.categories.slice(0, 3).map((cat) => (
            <Box key={cat} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelBg }}>
              <Text fontSize={8} color={COLORS.textDim}>{cat}</Text>
            </Box>
          ))}
        </Row>
      ) : null}
    </Pressable>
  );
}
