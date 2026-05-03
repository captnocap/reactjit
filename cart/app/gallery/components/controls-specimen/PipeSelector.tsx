import { Box, Col, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';
import { classifiers as S } from '@reactjit/core';

export type PipeSelectorProps = {
  options?: string[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_OPTIONS = [
  'context · kernel',
  'tool invocations',
  'worker streams',
  'file edits',
  'git audit',
];

export function PipeSelector({
  options = DEFAULT_OPTIONS,
  active = 1,
  onChange,
}: PipeSelectorProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: options.length, onChange });

  return (
    <AtomFrame width={260} padding={10} gap={4}>
      {options.map((option, index) => {
        const selected = index === current;
        return (
          <Pressable key={`${option}-${index}`} onPress={() => setCurrent(index)}>
            <Row style={{ width: '100%', gap: 10, alignItems: 'stretch' }}>
              <S.StackX1Center>
                <Box style={{ width: 2, flexGrow: 1, backgroundColor: selected ? CTRL.accent : CTRL.rule }} />
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: selected ? CTRL.accent : CTRL.rule,
                  }}
                />
                <Box style={{ width: 2, flexGrow: 1, backgroundColor: selected ? CTRL.accent : CTRL.rule }} />
              </S.StackX1Center>
              <Box
                style={{
                  flexGrow: 1,
                  flexBasis: 0,
                  paddingTop: 7,
                  paddingBottom: 7,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderWidth: 1,
                  borderColor: selected ? CTRL.accent : CTRL.rule,
                  backgroundColor: selected ? CTRL.softAccent : CTRL.bg1,
                }}
              >
                <Body fontSize={11} color={selected ? CTRL.ink : CTRL.inkDim}>{option}</Body>
              </Box>
            </Row>
          </Pressable>
        );
      })}
      <Mono color={CTRL.inkGhost}>pipe spine selector</Mono>
    </AtomFrame>
  );
}
