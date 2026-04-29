import { Box, Col, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export function SpeakerNotes(props: {
  visible: boolean;
  title: string;
  notes: string;
  slideIndex: number;
  slideCount: number;
}) {
  if (!props.visible) return null;
  const hasNotes = String(props.notes || '').trim().length > 0;

  return (
    <Box style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.panelRaised, overflow: 'hidden' }}>
      <Col style={{ gap: 8, padding: 12 }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>SPEAKER NOTES</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.title} · slide {props.slideIndex + 1} of {props.slideCount}</Text>
      </Col>
      <ScrollView showScrollbar={true} style={{ maxHeight: 180 }}>
        <Col style={{ gap: 8, paddingLeft: 12, paddingRight: 12, paddingBottom: 12 }}>
          {hasNotes ? (
            <Text fontSize={12} color={COLORS.textBright} style={{ lineHeight: 18 }}>
              {props.notes}
            </Text>
          ) : (
            <Text fontSize={11} color={COLORS.textDim}>No speaker notes on this slide.</Text>
          )}
        </Col>
      </ScrollView>
    </Box>
  );
}
