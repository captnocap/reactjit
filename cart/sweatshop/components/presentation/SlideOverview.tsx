import { Box, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { ParsedSlide } from '../../lib/presentation/parseSlides';

export function SlideOverview(props: {
  slides: ParsedSlide[];
  activeIndex: number;
  onSelectSlide: (index: number) => void;
}) {
  return (
    <Box style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.panelBg, overflow: 'hidden' }}>
      <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>SLIDE OVERVIEW</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.slides.length} slide{props.slides.length === 1 ? '' : 's'}</Text>
      </Box>
      <ScrollView showScrollbar={true} style={{ maxHeight: 340 }}>
        <Row style={{ flexWrap: 'wrap', gap: 8, padding: 10 }}>
          {props.slides.map((slide, index) => {
            const active = index === props.activeIndex;
            return (
              <Pressable
                key={slide.id}
                onPress={() => props.onSelectSlide(index)}
                style={{
                  width: 132,
                  minHeight: 92,
                  padding: 10,
                  gap: 6,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? COLORS.blue : COLORS.border,
                  backgroundColor: active ? COLORS.blueDeep : COLORS.panelRaised,
                }}
              >
                <Text fontSize={9} color={active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }} numberOfLines={2}>
                  {slide.title}
                </Text>
                <Text fontSize={9} color={COLORS.textDim} numberOfLines={3}>
                  {slide.preview || slide.body || ' '}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>
    </Box>
  );
}
