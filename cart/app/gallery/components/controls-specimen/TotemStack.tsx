import { Col, Row } from '@reactjit/runtime/primitives';
import { Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor, toneSoftBackground } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type TotemSegment = {
  label: string;
  tone?: ControlTone;
};

export type TotemStackProps = {
  segments: TotemSegment[];
};

export function TotemStack({ segments }: TotemStackProps) {
  return (
    <S.StackX2>
      {segments.map((segment, index) => {
        const tone = segment.tone ?? 'neutral';
        return (
          <Row
            key={`${segment.label}-${index}`}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderWidth: 1,
              borderColor: tone === 'neutral' ? CTRL.rule : toneColor(tone),
              backgroundColor: tone === 'neutral' ? CTRL.bg1 : toneSoftBackground(tone),
            }}
          >
            <Mono color={tone === 'neutral' ? CTRL.inkDim : toneColor(tone)} fontSize={9} fontWeight="bold">
              {segment.label}
            </Mono>
          </Row>
        );
      })}
    </S.StackX2>
  );
}
