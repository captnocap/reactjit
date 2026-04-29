import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type DiodeOption = {
  number: string;
  label: string;
};

export type DiodeSelectorProps = {
  options?: DiodeOption[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_OPTIONS: DiodeOption[] = [
  { number: '01', label: 'BANK' },
  { number: '02', label: 'BANK' },
  { number: '03', label: 'BANK' },
  { number: '04', label: 'BANK' },
];

export function DiodeSelector({
  options = DEFAULT_OPTIONS,
  active = 1,
  onChange,
}: DiodeSelectorProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: options.length, onChange });

  return (
    <AtomFrame width={252} padding={10} gap={6}>
      <Row style={{ width: '100%', gap: 6 }}>
        {options.map((option, index) => {
          const selected = index === current;
          return (
            <S.HalfPress key={`${option.number}-${option.label}`} onPress={() => setCurrent(index)}>
              <Box
                style={{
                  minHeight: 54,
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 8,
                  paddingRight: 8,
                  gap: 6,
                  borderWidth: 1,
                  borderColor: selected ? CTRL.accent : CTRL.rule,
                  backgroundColor: selected ? CTRL.softAccent : CTRL.bg1,
                }}
              >
                <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Body fontSize={16}>{option.number}</Body>
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: selected ? CTRL.accent : CTRL.rule,
                    }}
                  />
                </Row>
                <Mono color={selected ? CTRL.accent : CTRL.inkDimmer}>{option.label}</Mono>
              </Box>
            </S.HalfPress>
          );
        })}
      </Row>
    </AtomFrame>
  );
}
