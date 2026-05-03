import { Box, Col, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type StackSelectorOption = {
  label: string;
  cost: string;
};

export type StackSelectorProps = {
  options?: StackSelectorOption[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_OPTIONS: StackSelectorOption[] = [
  { label: 'haiku · 1.4k', cost: '$0.01' },
  { label: 'sonnet · 18k', cost: '$0.06' },
  { label: 'opus · 42k', cost: '$0.22' },
];

export function StackSelector({
  options = DEFAULT_OPTIONS,
  active = 1,
  onChange,
}: StackSelectorProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: options.length, onChange });

  return (
    <AtomFrame width={256} padding={10} gap={6}>
      {options.map((option, index) => {
        const selected = index === current;
        return (
          <Pressable key={`${option.label}-${index}`} onPress={() => setCurrent(index)}>
            <Row
              style={{
                width: '100%',
                alignItems: 'center',
                gap: 10,
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 8,
                paddingRight: 8,
                borderWidth: 1,
                borderColor: selected ? CTRL.accent : CTRL.rule,
                backgroundColor: selected ? CTRL.softAccent : CTRL.bg1,
              }}
            >
              <Box
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: selected ? CTRL.accent : CTRL.rule,
                  backgroundColor: selected ? CTRL.accent : CTRL.bg,
                }}
              />
              <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
                <Body fontSize={12}>{option.label}</Body>
                <Mono color={CTRL.inkDimmer}>{selected ? 'selected' : 'available'}</Mono>
              </Col>
              <Mono color={selected ? CTRL.accent : CTRL.inkDim}>{option.cost}</Mono>
            </Row>
          </Pressable>
        );
      })}
    </AtomFrame>
  );
}
