import { Box, Row } from '@reactjit/runtime/primitives';
import { Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor, toneSoftBackground } from './controlsSpecimenTheme';

export type StripBadgeSegment = {
  label: string;
  tone?: ControlTone;
};

export type StripBadgeProps = {
  segments: StripBadgeSegment[];
};

export function StripBadge({ segments }: StripBadgeProps) {
  return (
    <Row style={{ gap: 4, flexWrap: 'wrap' }}>
      {segments.map((segment, index) => {
        const tone = segment.tone ?? 'neutral';
        return (
          <Box
            key={`${segment.label}-${index}`}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderWidth: 1,
              borderColor: tone === 'neutral' ? CTRL.rule : toneColor(tone),
              backgroundColor: tone === 'neutral' ? CTRL.bg1 : toneSoftBackground(tone),
            }}
          >
            <Mono color={tone === 'neutral' ? CTRL.inkDim : toneColor(tone)} fontSize={9} fontWeight="bold" noWrap>
              {segment.label}
            </Mono>
          </Box>
        );
      })}
    </Row>
  );
}
