import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { PeriodicTable } from './PeriodicTable';
import { ElementDetail } from './ElementDetail';
import { ElementFilter, type ElementCategoryFilter } from './ElementFilter';
import { useElement } from '../../hooks/useElement';
import { usePubChem } from '../../hooks/usePubChem';

export function PeriodicTablePanel(props: { onClose?: () => void }) {
  const [selected, setSelected] = useState(1);
  const [filterCategory, setFilterCategory] = useState<ElementCategoryFilter>('all');
  const [query, setQuery] = useState('');
  const element = useElement(selected);
  const pubchem = usePubChem(query);
  const httpAvailable = pubchem.supported;

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 220 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Periodic Table</Text>
          <Text fontSize={10} color={COLORS.textDim}>118 real elements · category coloring · element details · PubChem compound search</Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      {!httpAvailable ? (
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
            PubChem lookup needs the host HTTP bridge. The table remains fully usable offline.
          </Text>
        </Box>
      ) : null}

      <Col style={{ gap: 10, padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
        <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Filter</Text>
          <ElementFilter value={filterCategory} onChange={setFilterCategory} />
        </Row>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Search compound</Text>
          <Box style={{ flexGrow: 1, minWidth: 220, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
            <TextInput value={query} onChange={setQuery} placeholder="water, glucose, caffeine..." fontSize={11} color={COLORS.textBright} style={{ borderWidth: 0, backgroundColor: 'transparent' }} />
          </Box>
          <Text fontSize={9} color={COLORS.textDim}>{pubchem.loading ? 'loading' : pubchem.query ? `${pubchem.results.length} result(s)` : 'idle'}</Text>
        </Row>
      </Col>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 12, padding: 12 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <PeriodicTable selected={selected} filterCategory={filterCategory} onSelect={(next) => setSelected(next.number)} tileSize={50} />
        </Box>
        <Box style={{ width: 360, flexShrink: 0, minHeight: 0, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, overflow: 'hidden' }}>
          <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <ElementDetail element={element} pubchem={pubchem} />
          </ScrollView>
        </Box>
      </Row>
    </Col>
  );
}

export default PeriodicTablePanel;
