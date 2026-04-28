import { classifiers as S } from '@reactjit/core';
import type {
  SpreadsheetCellMap,
  SpreadsheetGridTheme,
  SpreadsheetNativeState,
  SpreadsheetScalar,
} from '../../data/spreadsheet';
import { defaultSpreadsheetTheme, emptySpreadsheetNativeState } from '../../data/spreadsheet';

export const SPREADSHEET_NATIVE_TYPE = 'SpreadsheetGrid';

export const SPREADSHEET_NATIVE_EVENTS = {
  state: 'spreadsheet:state',
  select: 'spreadsheet:select',
  change: 'spreadsheet:change',
  columnResize: 'spreadsheet:columnresize',
} as const;

export type SpreadsheetSelectEvent = {
  address: string;
  targetId?: number;
};

export type SpreadsheetCellChangeEvent = {
  address: string;
  input: string;
  targetId?: number;
};

export type SpreadsheetColumnResizeEvent = {
  widths: number[];
  targetId?: number;
};

export type SpreadsheetGridProps = {
  rows: number;
  cols: number;
  cells: SpreadsheetCellMap;
  selectedAddress?: string;
  readOnly?: boolean;
  columnWidth?: number;
  columnWidths?: number[];
  resizableColumns?: boolean;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  fitColumnsToViewport?: boolean;
  rowHeight?: number;
  autoScrollToSelection?: boolean;
  theme?: SpreadsheetGridTheme;
  style?: Record<string, unknown>;
  onState?: (state: SpreadsheetNativeState) => void;
  onSelect?: (event: SpreadsheetSelectEvent) => void;
  onCellChange?: (event: SpreadsheetCellChangeEvent) => void;
  onColumnResize?: (event: SpreadsheetColumnResizeEvent) => void;
};

function toText(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function toBool(value: unknown): boolean {
  return value === true;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toScalar(value: unknown): SpreadsheetScalar | '' {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return '';
}

function normalizeNativeState(payload: any): SpreadsheetNativeState {
  return {
    address: toText(payload?.address, emptySpreadsheetNativeState.address),
    rawInput: toText(payload?.rawInput),
    draftInput: toText(payload?.draftInput),
    value: toScalar(payload?.value),
    error: payload?.error ? String(payload.error) : undefined,
    editing: toBool(payload?.editing),
    valueType: payload?.valueType || emptySpreadsheetNativeState.valueType,
    valueDisplay: toText(payload?.valueDisplay),
    errorCount: toNumber(payload?.errorCount, 0),
  };
}

function normalizeWidths(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => toNumber(entry)).filter((entry) => entry > 0);
}

export function SpreadsheetGrid({
  rows,
  cols,
  cells,
  selectedAddress = 'A1',
  readOnly = false,
  columnWidth = 118,
  columnWidths,
  resizableColumns = true,
  minColumnWidth = 72,
  maxColumnWidth = 460,
  fitColumnsToViewport = true,
  rowHeight = 30,
  autoScrollToSelection = true,
  theme = defaultSpreadsheetTheme,
  style,
  onState,
  onSelect,
  onCellChange,
  onColumnResize,
}: SpreadsheetGridProps) {
  const handleState = (payload: any) => {
    onState?.(normalizeNativeState(payload));
  };

  const handleSelect = (payload: any) => {
    onSelect?.({
      address: toText(payload?.address, selectedAddress),
      targetId: payload?.targetId,
    });
  };

  const handleCellChange = (payload: any) => {
    onCellChange?.({
      address: toText(payload?.address, selectedAddress),
      input: toText(payload?.input),
      targetId: payload?.targetId,
    });
  };

  const handleColumnResize = (payload: any) => {
    onColumnResize?.({
      widths: normalizeWidths(payload?.widths),
      targetId: payload?.targetId,
    });
  };

  return (
    <S.SpreadsheetGridSurface
      type={SPREADSHEET_NATIVE_TYPE}
      rows={rows}
      cols={cols}
      cells={cells}
      selectedAddress={selectedAddress}
      readOnly={readOnly}
      columnWidth={columnWidth}
      columnWidths={columnWidths}
      resizableColumns={resizableColumns}
      minColumnWidth={minColumnWidth}
      maxColumnWidth={maxColumnWidth}
      fitColumnsToViewport={fitColumnsToViewport}
      rowHeight={rowHeight}
      autoScrollToSelection={autoScrollToSelection}
      colorBg={theme.bg}
      colorBgAlt={theme.bgAlt}
      colorSurface={theme.surface}
      colorBorder={theme.border}
      colorText={theme.text}
      colorTextDim={theme.textDim}
      colorAccent={theme.accent}
      colorAccentSoft={theme.accentSoft}
      colorError={theme.error}
      onSpreadsheetState={handleState}
      onSpreadsheetSelect={handleSelect}
      onSpreadsheetChange={handleCellChange}
      onSpreadsheetColumnResize={handleColumnResize}
      style={style}
    />
  );
}
