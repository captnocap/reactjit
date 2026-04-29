import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, HorizontalTicks, Mono } from './controlsSpecimenParts';
import { useControllableIndexState, useHorizontalIndexDrag } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type StepSliderProps = {
  labels?: string[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_LABELS = ['OFF', 'LO', 'MID', 'HI', 'MAX'];

export function StepSlider({
  labels = DEFAULT_LABELS,
  active = 2,
  onChange,
}: StepSliderProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: labels.length, onChange });
  const drag = useHorizontalIndexDrag(current, setCurrent, labels.length, 220);

  return (
    <AtomFrame width={240} padding={10} gap={10}>
      <Row style={{ width: '100%', justifyContent: 'space-between', gap: 6 }}>
        {labels.map((label, index) => {
          const selected = index === current;
          return (
            <S.HalfPress key={label} onMouseDown={() => drag.begin(index)}>
              <Box style={{ gap: 6, alignItems: 'center' }}>
                <Body
                  fontSize={10}
                  color={selected ? CTRL.accent : CTRL.inkDim}
                  fontWeight={selected ? 'bold' : 'normal'}
                >
                  {label}
                </Body>
                <Box
                  style={{
                    width: 14,
                    height: 14,
                    borderWidth: 1,
                    borderColor: selected ? CTRL.accent : CTRL.rule,
                    backgroundColor: selected ? (drag.dragging ? CTRL.accentHot : CTRL.accent) : CTRL.bg1,
                  }}
                />
              </Box>
            </S.HalfPress>
          );
        })}
      </Row>
      <HorizontalTicks count={labels.length} active={current} tone="accent" />
      <Mono color={CTRL.inkGhost}>named step selector</Mono>
    </AtomFrame>
  );
}
