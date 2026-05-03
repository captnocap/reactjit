import { Box, Col, Pressable } from '@reactjit/runtime/primitives';
import { AtomFrame, Mono } from './controlsSpecimenParts';
import { FaderLabel } from './FaderLabel';
import { useControllableIndexState, useVerticalIndexDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type VerticalNotchFaderProps = {
  active?: number;
  label?: string;
  steps?: number;
  cells?: string[];
  onChange?: (next: number) => void;
};

export function VerticalNotchFader({
  active = 9,
  label = 'L',
  steps = 12,
  cells,
  onChange,
}: VerticalNotchFaderProps) {
  const count = Math.max(2, cells?.length ?? steps);
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count, onChange });
  const drag = useVerticalIndexDrag(current, setCurrent, count, 128);

  return (
    <AtomFrame width={58} padding={10} gap={8}>
      <Col style={{ width: '100%', gap: 4, justifyContent: 'flex-end', minHeight: 128 }}>
        {Array.from({ length: count }).map((_, index) => {
          const realIndex = count - 1 - index;
          const filled = realIndex <= current;
          const peak = realIndex === current;
          return (
            <Pressable key={realIndex} onMouseDown={() => drag.begin(realIndex)} style={{ width: '100%' }}>
              <Box
                style={{
                  width: '100%',
                  height: peak ? 10 : 8,
                  borderWidth: 1,
                  borderColor: peak ? CTRL.accent : CTRL.rule,
                  backgroundColor: filled ? (drag.dragging ? CTRL.accentHot : CTRL.accent) : CTRL.bg1,
                }}
              />
            </Pressable>
          );
        })}
      </Col>
      <FaderLabel label={label} value={String(current + 1)} accent={true} />
    </AtomFrame>
  );
}
