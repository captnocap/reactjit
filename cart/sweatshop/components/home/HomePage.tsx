const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

type Lead = {
  id: string;
  label: string;
  description: string;
  onPress: (props: HomePageProps) => void;
};

const LEADS: Lead[] = [
  {
    id: 'ide',
    label: 'Open IDE',
    description: 'The code IDE surface — files, editor, terminal, agent, plan, palette.',
    onPress: (props) => props.onOpenIDE(),
  },
];

type HomePageProps = {
  onOpenIDE: () => void;
};

export function HomePage(props: HomePageProps) {
  return (
    <Box style={{ flexGrow: 1, width: '100%', height: '100%', backgroundColor: COLORS.appBg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Col style={{ gap: 20, alignItems: 'center', maxWidth: 720 }}>
        <Text fontSize={22} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Sweatshop</Text>
        <Text fontSize={11} color={COLORS.textDim}>Native agent workspace</Text>
        <Row style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {LEADS.map((lead) => (
            <Pressable
              key={lead.id}
              onPress={() => lead.onPress(props)}
              style={{ width: 320, padding: 20, gap: 10, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusMd }}
            >
              <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{lead.label}</Text>
              <Text fontSize={11} color={COLORS.textDim}>{lead.description}</Text>
            </Pressable>
          ))}
        </Row>
      </Col>
    </Box>
  );
}
