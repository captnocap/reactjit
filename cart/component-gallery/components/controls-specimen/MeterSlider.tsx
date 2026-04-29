import { Box, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame, MeterMarks, Mono } from './controlsSpecimenParts';
import { useControllableNumberState, useHorizontalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL, type ControlTone } from './controlsSpecimenTheme';

export type MeterSliderProps = {
  value?: number;
  label?: string;
  width?: number;
  tone?: ControlTone;
  onChange?: (next: number) => void;
};

export function MeterSlider({
  value = 68,
  label = '068 · IOPS',
  width = 240,
  tone = 'accent',
  onChange,
}: MeterSliderProps) {
  const [current, setCurrent] = useControllableNumberState({ value, defaultValue: value, onChange });
  const fillColor = tone === 'warn' ? CTRL.warn : tone === 'flag' ? CTRL.flag : CTRL.accent;
  const trackWidth = Math.max(0, width - 20);
  const drag = useHorizontalPercentDrag(current, setCurrent, trackWidth);
  const fillWidth = Math.round(trackWidth * drag.ratio);

  return (
    <AtomFrame width={width} padding={10} gap={8}>
      <Box style={{ width: '100%', height: 36, justifyContent: 'center', position: 'relative' }}>
        <Box style={{ width: trackWidth, height: 18, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg1 }}>
          <Box style={{ width: fillWidth, height: 16, backgroundColor: fillColor }} />
          {[25, 50, 75].map((mark) => (
            <Box key={mark} style={{ position: 'absolute', left: Math.round((mark / 100) * trackWidth), top: 0, width: 1, height: 16, backgroundColor: CTRL.bg }} />
          ))}
          <Mono
            color={drag.ratio > 0.35 ? CTRL.bg : CTRL.ink}
            fontSize={10}
            fontWeight="bold"
            style={{ position: 'absolute', left: 8, top: 3 }}
          >
            {label.replace(/^\d+/, String(current).padStart(3, '0'))}
          </Mono>
        </Box>
        <Pressable onMouseDown={drag.begin} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </Box>
      <MeterMarks labels={['0', '25', '50', '75', '100']} />
    </AtomFrame>
  );
}
