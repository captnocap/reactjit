import { Box, Col, Pressable, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { useControllableIndexState } from './controlsSpecimenInteractions';
import { CTRL } from './controlsSpecimenTheme';

export type ChoiceListItem = {
  label: string;
  active?: boolean;
};

export type ChoiceListProps = {
  items?: ChoiceListItem[];
  marker?: 'square' | 'round' | 'bracket';
  active?: number;
  onChange?: (next: number) => void;
};

const DEFAULT_ITEMS: ChoiceListItem[] = [
  { label: 'alpha' },
  { label: 'beta', active: true },
  { label: 'gamma' },
  { label: 'delta' },
];

function markerNode(marker: ChoiceListProps['marker'], active: boolean) {
  if (marker === 'round') {
    return (
      <Box
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: active ? CTRL.accent : CTRL.rule,
          backgroundColor: active ? CTRL.accent : CTRL.bg1,
        }}
      />
    );
  }

  if (marker === 'bracket') {
    return (
      <Row style={{ gap: 1, alignItems: 'center' }}>
        <Mono color={active ? CTRL.accent : CTRL.inkDim}>[</Mono>
        <Box style={{ width: 8, height: 2, backgroundColor: active ? CTRL.accent : CTRL.rule }} />
        <Mono color={active ? CTRL.accent : CTRL.inkDim}>]</Mono>
      </Row>
    );
  }

  return (
    <Box
      style={{
        width: 12,
        height: 12,
        borderWidth: 1,
        borderColor: active ? CTRL.accent : CTRL.rule,
        backgroundColor: active ? CTRL.accent : CTRL.bg1,
      }}
    />
  );
}

export function ChoiceList({
  items = DEFAULT_ITEMS,
  marker = 'square',
  active,
  onChange,
}: ChoiceListProps) {
  const defaultIndex = Math.max(0, items.findIndex((item) => item.active));
  const [current, setCurrent] = useControllableIndexState({
    value: active,
    defaultValue: active ?? defaultIndex,
    count: items.length,
    onChange,
  });

  return (
    <AtomFrame width={240} padding={10} gap={6}>
      {items.map((item, index) => {
        const selected = index === current;
        return (
          <Pressable key={`${item.label}-${index}`} onPress={() => setCurrent(index)}>
            <Row
              style={{
                width: '100%',
                gap: 10,
                alignItems: 'center',
                paddingTop: 5,
                paddingBottom: 5,
                paddingLeft: 6,
                paddingRight: 6,
                borderWidth: 1,
                borderColor: selected ? CTRL.accent : CTRL.rule,
                backgroundColor: selected ? CTRL.softAccent : CTRL.bg1,
              }}
            >
              {markerNode(marker, selected)}
              <Body fontSize={12} color={selected ? CTRL.ink : CTRL.inkDim}>
                {item.label}
              </Body>
            </Row>
          </Pressable>
        );
      })}
    </AtomFrame>
  );
}
