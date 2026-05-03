import { Box, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame } from './controlsSpecimenParts';
import { FaderLabel } from './FaderLabel';
import { useControllableNumberState, useVerticalPercentDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type VerticalBipolarFaderProps = {
  value?: number;
  label?: string;
  onChange?: (next: number) => void;
};

export function VerticalBipolarFader({
  value = 72,
  label = '+22',
  onChange,
}: VerticalBipolarFaderProps) {
  const [current, setCurrent] = useControllableNumberState({ value, defaultValue: value, onChange });
  const laneWidth = 44;
  const trackWidth = 14;
  const center = 0.5;
  const trackHeight = 120;
  const drag = useVerticalPercentDrag(current, setCurrent, trackHeight);
  const trackTop = 6;
  const trackBottom = trackTop + trackHeight;
  const trackLeft = Math.round((laneWidth - trackWidth) / 2);
  const fillWidth = 12;
  const fillLeft = trackLeft + Math.round((trackWidth - fillWidth) / 2);
  const thumbWidth = 34;
  const thumbLeft = Math.round((laneWidth - thumbWidth) / 2);
  const centerY = Math.round(trackTop + trackHeight / 2);
  const thumbCenterY = Math.round(trackBottom - drag.ratio * trackHeight);
  const fillTop = Math.min(centerY, thumbCenterY);
  const fillHeight = Math.abs(thumbCenterY - centerY);
  const thumbTop = thumbCenterY - 4;
  const tone = drag.ratio >= center ? CTRL.accent : CTRL.flag;

  return (
    <AtomFrame width={64} padding={10} gap={8}>
      <Box style={{ width: '100%', height: 132, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Box style={{ width: trackWidth, height: trackHeight, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg1 }} />
        <Box style={{ position: 'absolute', left: trackLeft, top: centerY, width: trackWidth, height: 1, backgroundColor: CTRL.inkDim }} />
        <Box style={{ position: 'absolute', left: fillLeft, top: fillTop, width: fillWidth, height: fillHeight, backgroundColor: tone }} />
        <Box
          style={{
            position: 'absolute',
            left: thumbLeft,
            top: thumbTop,
            width: thumbWidth,
            height: 8,
            borderWidth: 1,
            borderColor: tone,
            backgroundColor: drag.dragging ? tone : CTRL.bg3,
          }}
        />
        <Pressable onMouseDown={drag.begin} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </Box>
      <FaderLabel label={label} accent={true} />
    </AtomFrame>
  );
}
