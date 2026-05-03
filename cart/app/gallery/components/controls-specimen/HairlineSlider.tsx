import { Box, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, MeterMarks, Mono } from './controlsSpecimenParts';
import { useControllableNumberState, useHorizontalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type HairlineSliderProps = {
  value?: number;
  width?: number;
  label?: string;
  onChange?: (next: number) => void;
};

export function HairlineSlider({
  value = 62,
  width = 240,
  label = 'GAIN',
  onChange,
}: HairlineSliderProps) {
  const [current, setCurrent] = useControllableNumberState({ value, defaultValue: value, onChange });
  const trackWidth = Math.max(0, width - 20);
  const drag = useHorizontalPercentDrag(current, setCurrent, trackWidth);
  const thumbCenterX = Math.round(trackWidth * drag.ratio);

  return (
    <AtomFrame width={width} padding={10} gap={8}>
      <S.InlineX4BetweenFull>
        <Mono>{label}</Mono>
        <Body fontSize={12}>{String(current).padStart(2, '0')}</Body>
      </S.InlineX4BetweenFull>
      <Box style={{ width: '100%', height: 24, justifyContent: 'center', position: 'relative' }}>
        <Box style={{ width: trackWidth, height: 1, backgroundColor: CTRL.rule }} />
        <Box style={{ position: 'absolute', left: 0, top: 11, width: thumbCenterX, height: 1, backgroundColor: CTRL.accent }} />
        <Box
          style={{
            position: 'absolute',
            left: thumbCenterX - 3,
            top: 3,
            width: 6,
            height: 18,
            borderWidth: 1,
            borderColor: CTRL.accent,
            backgroundColor: drag.dragging ? CTRL.accent : CTRL.bg,
          }}
        />
        <Pressable onMouseDown={drag.begin} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </Box>
      <MeterMarks labels={['0', '25', '50', '75', '100']} />
    </AtomFrame>
  );
}
