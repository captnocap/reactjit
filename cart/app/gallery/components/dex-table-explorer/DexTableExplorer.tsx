import { useMemo, useState } from 'react';
import { Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { DexBreadcrumbs } from '../dex-breadcrumbs/DexBreadcrumbs';
import { DEX_COLORS, DexFrame } from '../dex-frame/DexFrame';
import { DexSearchBar } from '../dex-search-bar/DexSearchBar';
import { DexSparkHistogram } from '../dex-spark-histogram/DexSparkHistogram';
import { DexTableCell } from '../dex-table-cell/DexTableCell';

export type DexTableExplorerProps = {
  width?: number;
};

type DexTableId = 'events' | 'runs' | 'users';
type DexTableCellValue = string | number;
type DexTableRow = DexTableCellValue[];

const columns = [
  { label: 'run_id', flex: 1.05, bins: [1, 1, 2, 4, 3, 2] },
  { label: 't', flex: 0.72, bins: [1, 3, 5, 2, 4, 6] },
  { label: 'kind', flex: 0.82, bins: [2, 5, 2, 1, 4, 3] },
  { label: 'who', flex: 0.68, bins: [3, 2, 4, 2, 1, 5] },
  { label: 'bytes', flex: 0.82, bins: [1, 2, 1, 5, 3, 6] },
  { label: 'lag', flex: 0.62, bins: [2, 2, 6, 4, 3, 1] },
] as const;

const eventRows: DexTableRow[] = [
  ['r_7f3a', 412.01, 'think', 'w-01', 412, '18ms'],
  ['r_7f3a', 412.34, 'tool', 'w-02', 1204, '44ms'],
  ['r_7f3b', 12.11, 'flag', 'w-04', 88, '9ms'],
  ['r_7f3c', 301.22, 'edit', 'w-03', 4402, '63ms'],
  ['r_7f3d', 3.44, 'warn', 'w-05', 120, '31ms'],
  ['r_7f3e', 88.02, 'ok', 'w-02', 302, '12ms'],
  ['r_7f3f', 141.7, 'tool', 'w-01', 980, '27ms'],
  ['r_7f40', 166.2, 'edit', 'w-04', 2188, '52ms'],
  ['r_7f41', 174.91, 'think', 'w-03', 388, '16ms'],
  ['r_7f42', 208.44, 'ok', 'w-05', 744, '22ms'],
  ['r_7f43', 233.18, 'tool', 'w-04', 1680, '35ms'],
  ['r_7f44', 261.02, 'warn', 'w-02', 210, '48ms'],
];

const runRows: DexTableRow[] = [
  ['r_7f3a', 412.01, 'ok', 'w-01', 84213, '18ms'],
  ['r_7f3b', 98.11, 'flag', 'w-04', 19022, '9ms'],
  ['r_7f3c', 301.22, 'edit', 'w-03', 4402, '63ms'],
  ['r_7f3d', 3.44, 'warn', 'w-05', 120, '31ms'],
  ['r_7f3e', 88.02, 'ok', 'w-02', 302, '12ms'],
  ['r_7f3f', 141.7, 'tool', 'w-01', 980, '27ms'],
  ['r_7f45', 388.2, 'think', 'w-05', 1204, '54ms'],
  ['r_7f46', 401.5, 'ok', 'w-02', 602, '11ms'],
];

const userRows: DexTableRow[] = [
  ['u_01', 17.02, 'ok', 'ada', 1288, '12ms'],
  ['u_02', 21.44, 'tool', 'grace', 604, '18ms'],
  ['u_03', 44.18, 'edit', 'alan', 1202, '22ms'],
  ['u_04', 66.41, 'warn', 'linus', 410, '39ms'],
  ['u_05', 88.8, 'ok', 'marg', 992, '9ms'],
  ['u_06', 104.3, 'flag', 'barb', 86, '44ms'],
  ['u_07', 144.9, 'think', 'ken', 730, '20ms'],
  ['u_08', 172.4, 'ok', 'radia', 540, '13ms'],
];

const tableIds: DexTableId[] = ['events', 'runs', 'users'];

function resolveRows(active: DexTableId): DexTableRow[] {
  switch (active) {
    case 'runs':
      return runRows;
    case 'users':
      return userRows;
    default:
      return eventRows;
  }
}

function toneFor(cell: string | number) {
  if (cell === 'flag') return 'flag';
  if (cell === 'warn') return 'warn';
  if (cell === 'edit') return 'edit';
  return typeof cell === 'number' ? 'number' : 'default';
}

export function DexTableExplorer({ width = 468 }: DexTableExplorerProps) {
  const [active, setActive] = useState<DexTableId>('events');
  const [selectedRow, setSelectedRow] = useState(3);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const activeRows = resolveRows(active);

  const rows = useMemo(() => {
    const base = activeRows.slice();
    if (sortColumn == null) return base;
    return base.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      return (av > bv ? 1 : av < bv ? -1 : 0) * sortDir;
    });
  }, [activeRows, sortColumn, sortDir]);

  const selected = rows[selectedRow] || rows[0];

  return (
    <DexFrame
      id="A.2"
      title="table · sweatshop.db"
      width={width}
      height={300}
      right={
        <Row style={{ gap: 6 }}>
          {tableIds.map((label) => (
            <Pressable
              key={label}
              onPress={() => {
                setActive(label);
                setSelectedRow(0);
                setSortColumn(null);
              }}
            >
              <Text style={{ color: label === active ? DEX_COLORS.accent : DEX_COLORS.inkDimmer, borderWidth: 1, borderColor: label === active ? DEX_COLORS.ruleBright : DEX_COLORS.rule, paddingLeft: 6, paddingRight: 6, fontSize: 9 }}>{label}</Text>
            </Pressable>
          ))}
        </Row>
      }
      footer={
        <Row style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <DexBreadcrumbs items={[active, `row ${selectedRow}`, selected?.[0] ?? 'none']} />
          <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>CLICK HDR · SORT</Text>
        </Row>
      }
    >
      <DexSearchBar value="edit" count={`${rows.length}/${activeRows.length}`} placeholder={`filter in ${active}`} />
      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ width: width - 2, flexShrink: 0 }}>
          <Row>
            {columns.map((column, columnIndex) => (
              <Pressable
                key={column.label}
                onPress={() => {
                  setSortColumn((current) => {
                    if (current === columnIndex) {
                      setSortDir((dir) => (dir === 1 ? -1 : 1));
                      return current;
                    }
                    setSortDir(1);
                    return columnIndex;
                  });
                }}
                style={{
                  flex: column.flex,
                  height: 46,
                  paddingLeft: 7,
                  paddingTop: 5,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: DEX_COLORS.rule,
                  backgroundColor: DEX_COLORS.bg1,
                  gap: 3,
                }}
              >
                <Text style={{ color: sortColumn === columnIndex ? DEX_COLORS.accent : DEX_COLORS.ink, fontSize: 9 }}>
                  {column.label}{sortColumn === columnIndex ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </Text>
                <DexSparkHistogram bins={[...column.bins]} />
              </Pressable>
            ))}
          </Row>
          {rows.map((row, rowIndex) => (
            <Pressable key={`${row[0]}-${rowIndex}`} onPress={() => setSelectedRow(rowIndex)}>
              <Row>
              {row.map((cell, cellIndex) => (
                <DexTableCell
                  key={cellIndex}
                  value={cell}
                  flex={columns[cellIndex].flex}
                  selected={rowIndex === selectedRow}
                  tone={toneFor(cell)}
                />
              ))}
            </Row>
            </Pressable>
          ))}
        </Col>
      </ScrollView>
    </DexFrame>
  );
}
