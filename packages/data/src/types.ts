import type { Style } from '@reactjit/core';

export type SpreadsheetScalar = string | number | boolean;

export type SpreadsheetCellMap = Record<string, string>;
export type SpreadsheetValueMap = Record<string, SpreadsheetScalar>;
export type SpreadsheetErrorMap = Record<string, string>;

export type SpreadsheetFormulaFn = (...args: unknown[]) => unknown;
export type SpreadsheetFunctionMap = Record<string, SpreadsheetFormulaFn>;

export interface SpreadsheetEvaluation {
  values: SpreadsheetValueMap;
  errors: SpreadsheetErrorMap;
}

export interface SpreadsheetEvaluateOptions {
  functions?: SpreadsheetFunctionMap;
  targetAddresses?: string[];
  maxRangeCells?: number;
}

export interface SpreadsheetProps {
  rows?: number;
  cols?: number;
  initialCells?: SpreadsheetCellMap;
  cells?: SpreadsheetCellMap;
  onCellsChange?: (cells: SpreadsheetCellMap) => void;
  functionMap?: SpreadsheetFunctionMap;
  readOnly?: boolean;
  showFormulaBar?: boolean;
  columnWidth?: number;
  rowHeight?: number;
  style?: Style;
  headerStyle?: Style;
  cellStyle?: Style;
  formulaBarStyle?: Style;
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
