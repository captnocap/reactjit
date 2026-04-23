const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MoleculeView } from './MoleculeView';

const PRESETS = [
  { id: 'water', label: 'Water', smiles: 'O' },
  { id: 'ethanol', label: 'Ethanol', smiles: 'CCO' },
  { id: 'caffeine', label: 'Caffeine', smiles: 'Cn1cnc2n(C)c(=O)n(C)c(=O)c12' },
  { id: 'benzene', label: 'Benzene', smiles: 'c1ccccc1' },
];

function PresetButton(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={{
      paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.active ? COLORS.blue : COLORS.border,
      backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
    }}>
      <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </Pressable>
  );
}

export function MoleculePanel(props: { onClose?: () => void }) {
  const [smiles, setSmiles] = useState('CCO');
  const [active, setActive] = useState('ethanol');

  useEffect(() => {
    if (!smiles) {
      setSmiles('CCO');
      setActive('ethanol');
    }
  }, [smiles]);

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 220 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Molecules</Text>
          <Text fontSize={10} color={COLORS.textDim}>SMILES input, atom layout, and bond rendering from the local parser.</Text>
        </Col>
        {props.onClose ? (
          <Pressable onPress={props.onClose} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Close</Text>
          </Pressable>
        ) : null}
      </Row>

      <Col style={{ gap: 10, padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <PresetButton
              key={preset.id}
              label={preset.label}
              active={active === preset.id}
              onPress={() => { setActive(preset.id); setSmiles(preset.smiles); }}
            />
          ))}
        </Row>
        <Box style={{ gap: 4 }}>
          <Text fontSize={9} color={COLORS.textDim}>SMILES</Text>
          <TextInput
            value={smiles}
            onChangeText={(value: string) => { setSmiles(value); setActive('custom'); }}
            placeholder="CCO"
            style={{
              height: 32,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: TOKENS.radiusSm,
              paddingLeft: 10,
              paddingRight: 10,
              backgroundColor: COLORS.panelBg,
              color: COLORS.textBright,
              fontFamily: 'monospace',
            }}
          />
        </Box>
      </Col>

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 12 }}>
        <MoleculeView smiles={smiles} />
      </Box>
    </Col>
  );
}

export default MoleculePanel;

