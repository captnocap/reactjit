import { Box, Col, Image, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { type ChemistryElement } from '../../hooks/useElement';
import { categoryTone } from './ElementFilter';
import { type PubChemState } from '../../hooks/usePubChem';

function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function usesFor(element: ChemistryElement): string[] {
  switch (element.category) {
    case 'alkali-metal': return ['Battery chemistry', 'strong reducing agents', 'heat-transfer alloys'];
    case 'alkaline-earth': return ['Light alloys', 'metallurgy', 'pyrotechnics'];
    case 'transition-metal': return ['Structural alloys', 'catalysts', 'conductive materials'];
    case 'post-transition-metal': return ['Alloys', 'coatings', 'semiconductors and packaging'];
    case 'metalloid': return ['Semiconductors', 'glass doping', 'electronics'];
    case 'nonmetal': return ['Biochemistry', 'atmospheres', 'industrial feedstocks'];
    case 'halogen': return ['Disinfectants', 'organic synthesis', 'flame-retardant chemistry'];
    case 'noble-gas': return ['Lighting', 'inert atmospheres', 'cryogenics'];
    case 'lanthanide': return ['Magnets', 'phosphors', 'laser materials'];
    case 'actinide': return ['Nuclear fuel', 'radioisotopes', 'specialty research'];
    default: return ['Reference chemistry', 'materials science'];
  }
}

function factsFor(element: ChemistryElement): string[] {
  const meta = [
    `Electron configuration: ${element.electronConfig}`,
    `State at STP: ${element.phase}`,
    `First ionization: ${formatNumber(element.firstIonization, 4)} eV`,
    `Known isotopes: ${element.isotopeCount ?? 'n/a'}`,
    `Representative mass number: ${Math.round(element.mass)}${element.symbol}`,
  ];
  if (element.discoverer) meta.push(`Discoverer: ${element.discoverer}`);
  if (element.yearDiscovered) meta.push(`Discovered: ${element.yearDiscovered}`);
  return meta;
}

function PubChemCard(props: { pubchem: PubChemState }) {
  const compound = props.pubchem.compound;
  if (!props.pubchem.query) return null;
  return (
    <Box style={{ gap: 8, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>PubChem</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.pubchem.loading ? 'loading' : props.pubchem.supported ? 'live' : 'offline'}</Text>
      </Row>
      {props.pubchem.error ? <Text fontSize={9} color={COLORS.red}>{props.pubchem.error}</Text> : null}
      {props.pubchem.results.length > 0 ? (
        <Col style={{ gap: 4 }}>
          {props.pubchem.results.slice(0, 3).map((row) => (
            <Text key={row.cid} fontSize={9} color={COLORS.textDim}>{`${row.cid} · ${row.formula} · ${formatNumber(row.weight, 2)}`}</Text>
          ))}
        </Col>
      ) : null}
      {compound ? (
        <Col style={{ gap: 6 }}>
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{compound.iupacName || compound.name || props.pubchem.query}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{compound.molecularFormula || 'formula unavailable'}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{`CID ${compound.cid} · MW ${formatNumber(compound.molecularWeight, 2)} · TPSA ${formatNumber(compound.topologicalPolarSurfaceArea, 1)}`}</Text>
          {compound.structureSvg ? (
            <Image source={`data:image/svg+xml;utf8,${encodeURIComponent(compound.structureSvg)}`} style={{ width: '100%', height: 170, backgroundColor: COLORS.panelBg, borderRadius: TOKENS.radiusMd }} />
          ) : null}
        </Col>
      ) : null}
    </Box>
  );
}

export function ElementDetail(props: {
  element: ChemistryElement | undefined;
  pubchem: PubChemState;
}) {
  const element = props.element;
  if (!element) {
    return <Box style={{ padding: 12 }}><Text fontSize={10} color={COLORS.textDim}>Select an element.</Text></Box>;
  }

  const tone = categoryTone(element.category);
  const uses = usesFor(element);
  const facts = factsFor(element);

  return (
    <Col style={{ gap: 10, padding: 12, minHeight: 0 }}>
      <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: tone, backgroundColor: COLORS.panelRaised }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Col style={{ gap: 2 }}>
            <Text fontSize={10} color={COLORS.textDim}>Atomic {element.number}</Text>
            <Text fontSize={18} color={tone} style={{ fontWeight: 'bold' }}>{element.symbol}</Text>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{element.name}</Text>
          </Col>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
            <Text fontSize={9} color={tone} style={{ fontWeight: 'bold' }}>{element.category}</Text>
          </Box>
        </Row>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Text fontSize={9} color={COLORS.textDim}>{`Mass ${formatNumber(element.mass, 4)}`}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{`Density ${formatNumber(element.density, 4)} g/cm³`}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{`Melting ${formatNumber(element.meltingPoint, 2)} K`}</Text>
          <Text fontSize={9} color={COLORS.textDim}>{`Boiling ${formatNumber(element.boilingPoint, 2)} K`}</Text>
        </Row>
      </Box>

      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {facts.map((fact) => (
          <Box key={fact} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textBright}>{fact}</Text>
          </Box>
        ))}
      </Row>

      <Box style={{ gap: 6, padding: 10, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Common uses</Text>
        {uses.map((use) => <Text key={use} fontSize={9} color={COLORS.textDim}>• {use}</Text>)}
      </Box>

      <PubChemCard pubchem={props.pubchem} />
    </Col>
  );
}
