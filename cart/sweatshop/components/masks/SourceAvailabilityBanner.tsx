import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MaskChip } from './MaskChip';
import type { LiveSourceInfo } from './useLiveSource';

export function SourceAvailabilityBanner(props: { sources: LiveSourceInfo[] }) {
  return (
    <Box style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Live source picker</Text>
          <Text fontSize={10} color={COLORS.textDim}>The panel uses the selected media-library item as the live source today.</Text>
        </Col>
        <MaskChip label="media library" active={true} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {props.sources.map((source) => (
          <MaskChip key={source.id} label={source.label} active={source.active} muted={!source.available} disabled={!source.available} />
        ))}
      </Row>
      <Box style={{ padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, gap: 4 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Unwired live sources</Text>
        {props.sources.filter((source) => !source.available).map((source) => (
          <Text key={source.id} fontSize={10} color={COLORS.textDim}>{source.label + ': ' + source.detail}</Text>
        ))}
      </Box>
    </Box>
  );
}
