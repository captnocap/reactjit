import { Col, Row } from '@reactjit/runtime/primitives';
import { AtomFrame, Body, Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';

export type TabularHierarchyRow = {
  label: string;
  value: string;
  current?: boolean;
};

export type TabularHierarchyProps = {
  rows?: TabularHierarchyRow[];
};

const DEFAULT_ROWS: TabularHierarchyRow[] = [
  { label: 'ENV', value: 'staging' },
  { label: 'HOST', value: 'worker-g12' },
  { label: 'SHA', value: '4ab1d92' },
  { label: 'RUN', value: '#9138 · 2m04s', current: true },
];

export function TabularHierarchy({
  rows = DEFAULT_ROWS,
}: TabularHierarchyProps) {
  return (
    <AtomFrame width={252} padding={10} gap={6}>
      {rows.map((row, index) => (
        <Row
          key={`${row.label}-${index}`}
          style={{
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderBottomWidth: index === rows.length - 1 ? 0 : 1,
            borderColor: CTRL.rule,
          }}
        >
          <Mono color={row.current ? CTRL.accent : CTRL.inkDimmer}>{row.label}</Mono>
          <Body fontSize={11} color={row.current ? CTRL.ink : CTRL.inkDim}>{row.value}</Body>
        </Row>
      ))}
    </AtomFrame>
  );
}
