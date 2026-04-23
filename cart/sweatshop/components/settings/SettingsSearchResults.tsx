import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { SettingsSearchEntry } from '../../lib/settings/search-index';
import { sectionForPath } from '../../lib/settings/search-index';
import { Glyph } from '../shared';

export function SettingsSearchResults(props: {
  query: string;
  results: SettingsSearchEntry[];
  activeSection: string;
  onOpenSection: (id: string) => void;
  onClearQuery: () => void;
}) {
  const query = props.query.trim();
  if (!query) return null;

  return (
    <Col style={{ gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {props.results.length} result{props.results.length === 1 ? '' : 's'} for "{query}"
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={props.onClearQuery}>
          <Box style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>back to tree</Text>
          </Box>
        </Pressable>
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ gap: 8 }}>
          {props.results.length === 0 ? (
            <Box style={{ padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={11} color={COLORS.textDim}>No matching settings sections.</Text>
            </Box>
          ) : props.results.map((entry) => {
            const section = sectionForPath(entry.path);
            const active = entry.path === props.activeSection;
            return (
              <Pressable key={entry.path} onPress={() => { props.onOpenSection(entry.path); props.onClearQuery(); }}>
                <Box style={{
                  padding: 12,
                  gap: 6,
                  borderRadius: TOKENS.radiusMd,
                  borderWidth: 1,
                  borderColor: active ? (section?.tone || COLORS.blue) : COLORS.border,
                  backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
                }}>
                  <Row style={{ alignItems: 'center', gap: 8 }}>
                    <Glyph icon={section?.icon || 'settings'} tone={section?.tone || COLORS.blue} backgroundColor="transparent" tiny={true} />
                    <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{entry.label}</Text>
                    <Box style={{ flexGrow: 1 }} />
                    <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{entry.path}</Text>
                  </Row>
                  <Text fontSize={10} color={COLORS.textDim}>{entry.description}</Text>
                  {entry.keywords.length ? (
                    <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
                      {entry.keywords.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </Box>
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}

