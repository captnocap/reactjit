const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import type { DocsSearchHit } from './hooks/useDocsIndex';

function HitRow(props: { hit: DocsSearchHit; onOpenPath: (path: string) => void }) {
  return (
    <Pressable onPress={() => props.onOpenPath(props.hit.path)}>
      <Box style={{ gap: 4, padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Icon name="file" size={11} color={COLORS.blue} />
          <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexShrink: 1 }}>{props.hit.title}</Text>
        </Row>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{props.hit.path}</Text>
        <Text fontSize={9} color={COLORS.text} style={{ lineHeight: 13 }}>{props.hit.snippet || ' '}</Text>
      </Box>
    </Pressable>
  );
}

export function DocsSearch(props: {
  query: string;
  onQueryChange: (next: string) => void;
  results: DocsSearchHit[];
  onOpenPath: (path: string) => void;
}) {
  return (
    <Col style={{ gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Icon name="search" size={12} color={COLORS.blue} />
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Search docs</Text>
      </Row>
      <TextInput
        value={props.query}
        onChangeText={props.onQueryChange}
        placeholder="Search title + body across markdown files"
        style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, color: COLORS.textBright, fontSize: 10 }}
      />
      <Text fontSize={9} color={COLORS.textDim}>{props.query.trim() ? `${props.results.length} matches` : 'Type to search the live docs index.'}</Text>
      {props.query.trim() ? (
        <ScrollView showScrollbar={true} style={{ maxHeight: 220, minHeight: 90, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
          <Col style={{ gap: 6, padding: 8 }}>
            {props.results.length === 0 ? <Text fontSize={10} color={COLORS.textDim}>No matches.</Text> : props.results.map((hit) => <HitRow key={hit.path} hit={hit} onOpenPath={props.onOpenPath} />)}
          </Col>
        </ScrollView>
      ) : null}
    </Col>
  );
}

export default DocsSearch;
