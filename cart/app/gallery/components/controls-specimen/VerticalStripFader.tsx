import { Box, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame } from './controlsSpecimenParts';
import { FaderLabel } from './FaderLabel';
import { useControllableNumberState, useVerticalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type VerticalStripFaderProps = {
  value?: number;
  label?: string;
  onChange?: (next: number) => void;
};

export function VerticalStripFader({
  value = 72,
  label = '−3',
  onChange,
}: VerticalStripFaderProps) {
  const [current, setCurrent] = useControllableNumberState({ value, defaultValue: value, onChange });
  const laneWidth = 44;
  const trackWidth = 20;
  const trackHeight = 120;
  const drag = useVerticalPercentDrag(current, setCurrent, trackHeight);
  const trackTop = 6;
  const trackBottom = trackTop + trackHeight;
  const trackLeft = Math.round((laneWidth - trackWidth) / 2);
  const fillWidth = 10;
  const fillLeft = trackLeft + Math.round((trackWidth - fillWidth) / 2);
  const thumbWidth = 26;
  const thumbLeft = Math.round((laneWidth - thumbWidth) / 2);
  const fillHeight = Math.round(drag.ratio * trackHeight);
  const thumbTop = Math.round(trackBottom - fillHeight - 5);

  return (
    <AtomFrame width={64} padding={10} gap={8}>
      <Box style={{ width: '100%', height: 132, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Box style={{ width: trackWidth, height: trackHeight, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg1 }} />
        {Array.from({ length: 6 }).map((_, index) => (
          <Box key={index} style={{ position: 'absolute', left: trackLeft + 4, top: 18 + index * 18, width: 12, height: 1, backgroundColor: CTRL.rule }} />
        ))}
        <Box style={{ position: 'absolute', left: fillLeft, top: trackBottom - fillHeight, width: fillWidth, height: fillHeight, backgroundColor: CTRL.accent }} />
        <Box
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: thumbWidth,
            height: 10,
            borderWidth: 1,
            borderColor: CTRL.accent,
            backgroundColor: drag.dragging ? CTRL.accentHot : CTRL.bg3,
          }}
        />
        <Pressable onMouseDown={drag.begin} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </Box>
      <FaderLabel label={label} accent={true} />
    </AtomFrame>
  );
}
