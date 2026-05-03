import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type KeycapSelectorProps = {
  options?: string[];
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_OPTIONS = ['1x', '2x', '4x', '8x'];

export function KeycapSelector({
  options = DEFAULT_OPTIONS,
  active = 1,
  onChange,
}: KeycapSelectorProps) {
  const [current, setCurrent] = useControllableIndexState({ value: active, defaultValue: active, count: options.length, onChange });

  return (
    <AtomFrame width={240} padding={8} gap={6}>
      <Row style={{ width: '100%', gap: 6, flexWrap: 'wrap' }}>
        {options.map((option, index) => {
          const selected = index === current;
          return (
            <Pressable key={option} onPress={() => setCurrent(index)}>
              <Box
                style={{
                  minWidth: 38,
                  minHeight: 30,
                  paddingLeft: 10,
                  paddingRight: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: selected ? CTRL.accent : CTRL.rule,
                  backgroundColor: selected ? CTRL.accent : CTRL.bg1,
                }}
              >
                <Body fontSize={11} color={selected ? CTRL.bg : CTRL.ink}>{option}</Body>
              </Box>
            </Pressable>
          );
        })}
      </Row>
    </AtomFrame>
  );
}
