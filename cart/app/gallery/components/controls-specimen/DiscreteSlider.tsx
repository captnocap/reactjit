import { Box, Col, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, HorizontalTicks, Mono } from './controlsSpecimenParts';
import { useControllableIndexState, useHorizontalIndexDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type DiscreteSliderProps = {
  steps?: number;
  active?: number;
  slot?: boolean;
  ruler?: boolean;
  onChange?: (next: number) => void;
};

export function DiscreteSlider({
  steps = 10,
  active = 4,
  slot = false,
  ruler = false,
  onChange,
}: DiscreteSliderProps) {
  const count = Math.max(2, steps);
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count, onChange });
  const drag = useHorizontalIndexDrag(current, setCurrent, count, 220);

  return (
    <AtomFrame width={240} padding={10} gap={10}>
      <S.InlineX4BetweenFull>
        <Mono>{slot ? 'SLOT' : 'STEP'}</Mono>
        <Mono color={CTRL.accent} fontSize={10} fontWeight="bold">
          {String(current + 1).padStart(2, '0')}
        </Mono>
      </S.InlineX4BetweenFull>
      <Row style={{ width: '100%', gap: 4 }}>
        {Array.from({ length: count }).map((_, index) => {
          const activeCell = index <= current;
          return (
            <Pressable
              key={index}
              onMouseDown={() => drag.begin(index)}
              style={{
                flexGrow: 1,
                flexBasis: 0,
                height: slot ? 16 : 12,
                borderWidth: 1,
                borderColor: index === current ? CTRL.accent : CTRL.rule,
                backgroundColor: activeCell ? (drag.dragging ? CTRL.accentHot : CTRL.accent) : CTRL.bg1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {slot ? <Box style={{ width: '100%', height: 2, backgroundColor: index === current ? CTRL.bg : CTRL.rule }} /> : null}
            </Pressable>
          );
        })}
      </Row>
      {ruler ? <HorizontalTicks count={count} active={current} tone="accent" /> : null}
    </AtomFrame>
  );
}
