import { Col, Row, Text } from '@reactjit/runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';
import { VesperSurface } from './VesperSurface';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperCard(props: {
  title?: string;
  subtitle?: string;
  tone?: VesperTone;
  selected?: boolean;
  compact?: boolean;
  footer?: any;
  children: any;
}) {
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'accent', colors);
  return (
    <VesperSurface
      tone={props.tone || 'accent'}
      elevated={props.selected}
      padding={props.compact ? tokens.padTight : tokens.padNormal}
      style={{ gap: tokens.spaceSm, backgroundColor: props.selected ? colors.panelHover : colors.panelRaised }}
    >
      {props.title || props.subtitle ? (
        <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: tokens.spaceSm }}>
          <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
            {props.title ? <Text fontSize={tokens.typeLg} color={colors.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text> : null}
            {props.subtitle ? <Text fontSize={tokens.typeSm} color={colors.textDim}>{props.subtitle}</Text> : null}
          </Col>
          <Text fontSize={tokens.typeXs} color={tone} style={{ fontWeight: 'bold' }}>{props.tone || 'accent'}</Text>
        </Row>
      ) : null}
      {props.children}
      {props.footer ? <>{props.footer}</> : null}
    </VesperSurface>
  );
}
