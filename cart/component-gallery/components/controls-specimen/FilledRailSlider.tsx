import { Box, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { useControllableNumberState, useHorizontalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type FilledRailSliderProps = {
  value?: number;
  width?: number;
  label?: string;
  onChange?: (next: number) => void;
};

export function FilledRailSlider({
  value = 45,
  width = 240,
  label = 'DRIVE',
  onChange,
}: FilledRailSliderProps) {
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
      <Box style={{ width: '100%', height: 28, justifyContent: 'center', position: 'relative' }}>
        <Box style={{ width: trackWidth, height: 8, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg1 }}>
          <Box style={{ width: thumbCenterX, height: 6, backgroundColor: CTRL.accent }} />
        </Box>
        <Box
          style={{
            position: 'absolute',
            left: thumbCenterX - 5,
            top: 3,
            width: 10,
            height: 20,
            borderWidth: 1,
            borderColor: CTRL.accent,
            backgroundColor: drag.dragging ? CTRL.accentHot : CTRL.bg3,
          }}
        />
        <Pressable onMouseDown={drag.begin} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </Box>
      <Mono color={CTRL.inkGhost}>{drag.dragging ? 'dragging' : 'filled rail control'}</Mono>
    </AtomFrame>
  );
}
