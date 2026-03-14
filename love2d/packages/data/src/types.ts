import type { Style } from '@reactjit/core';

export type SpreadsheetScalar = string | number | boolean;

export type SpreadsheetCellMap = Record<string, string>;
export type SpreadsheetValueMap = Record<string, SpreadsheetScalar>;
export type SpreadsheetErrorMap = Record<string, string>;

export interface SpreadsheetEvaluation {
  values: SpreadsheetValueMap;
  errors: SpreadsheetErrorMap;
}

export interface SpreadsheetEvaluateOptions {
  targetAddresses?: string[];
  maxRangeCells?: number;
}

export interface SpreadsheetProps {
  rows?: number;
  cols?: number;
  initialCells?: SpreadsheetCellMap;
  cells?: SpreadsheetCellMap;
  onCellsChange?: (cells: SpreadsheetCellMap) => void;
  readOnly?: boolean;
  showFormulaBar?: boolean;
  columnWidth?: number;
  columnWidths?: number[];
  onColumnWidthsChange?: (widths: number[]) => void;
  resizableColumns?: boolean;
  minColumnWidth?: number;
  maxColumnWidth?: number;
  fitColumnsToViewport?: boolean;
  rowHeight?: number;
  viewportHeight?: number | string;
  minVisibleRows?: number;
  maxVisibleRows?: number;
  selectedAddress?: string;
  onSelectedAddressChange?: (address: string) => void;
  autoScrollToSelection?: boolean;
  showStatusBar?: boolean;
  style?: Style;
  headerStyle?: Style;
  cellStyle?: Style;
  formulaBarStyle?: Style;
  statusBarStyle?: Style;
}

export interface UseSpreadsheetOptions extends SpreadsheetEvaluateOptions {
  initialCells?: SpreadsheetCellMap;
}

export interface UseSpreadsheetResult {
  cells: SpreadsheetCellMap;
  values: SpreadsheetValueMap;
  errors: SpreadsheetErrorMap;
  setCell: (address: string, input: string) => void;
  setCells: (next: SpreadsheetCellMap) => void;
  getCellInput: (address: string) => string;
  getCellValue: (address: string) => SpreadsheetScalar;
  getCellError: (address: string) => string | undefined;
}
