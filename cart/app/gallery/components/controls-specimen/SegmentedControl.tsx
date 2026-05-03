import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type SegmentedControlProps = {
  options?: string[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_OPTIONS = ['DAY', 'WEEK', 'MONTH', 'YEAR'];

export function SegmentedControl({
  options = DEFAULT_OPTIONS,
  active = 1,
  onChange,
}: SegmentedControlProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: options.length, onChange });

  return (
    <AtomFrame width={240} padding={8} gap={6}>
      <Row style={{ width: '100%', gap: 4 }}>
        {options.map((option, index) => {
          const selected = index === current;
          return (
            <S.HalfPress key={option} onPress={() => setCurrent(index)}>
              <Box
                style={{
                  minHeight: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: selected ? CTRL.accent : CTRL.rule,
                  backgroundColor: selected ? CTRL.accent : CTRL.bg1,
                }}
              >
                <Body fontSize={10} color={selected ? CTRL.bg : CTRL.inkDim} fontWeight={selected ? 'bold' : 'normal'}>
                  {option}
                </Body>
              </Box>
            </S.HalfPress>
          );
        })}
      </Row>
    </AtomFrame>
  );
}
