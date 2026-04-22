const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { ServerFavorite } from './hooks/useFavorites';

export function FavoritesBar(props: {
  favorites: ServerFavorite[];
  selectedAddress?: string;
  onSelect: (favorite: ServerFavorite) => void;
  onRemove: (favorite: ServerFavorite) => void;
}) {
  return (
    <Col style={{ gap: 8 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 1.1, fontWeight: 'bold' }}>FAVORITES</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim}>{props.favorites.length} saved</Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {props.favorites.length === 0 ? (
          <Box style={{ padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim}>Pin servers from the list or details pane to keep them here.</Text>
          </Box>
        ) : props.favorites.map((fav) => (
          <Row
            key={`${fav.gameId}:${fav.address}`}
            style={{
              alignItems: 'center',
              gap: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: TOKENS.radiusLg,
              borderWidth: 1,
              borderColor: props.selectedAddress === fav.address ? COLORS.blue : COLORS.border,
              backgroundColor: props.selectedAddress === fav.address ? COLORS.blueDeep : COLORS.panelAlt,
            }}
          >
            <HoverPressable onPress={() => props.onSelect(fav)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusSm }}>
              <Col style={{ gap: 1 }}>
                <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{fav.name || fav.address}</Text>
                <Text fontSize={8} color={COLORS.textDim}>{fav.address}</Text>
              </Col>
            </HoverPressable>
            <Pressable onPress={() => props.onRemove(fav)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}>
              <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>×</Text>
            </Pressable>
          </Row>
        ))}
      </Row>
    </Col>
  );
}

