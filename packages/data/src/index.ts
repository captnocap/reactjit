// Types
export type {
  SpreadsheetScalar,
  SpreadsheetCellMap,
  SpreadsheetValueMap,
  SpreadsheetErrorMap,
  SpreadsheetFormulaFn,
  SpreadsheetFunctionMap,
  SpreadsheetEvaluation,
  SpreadsheetEvaluateOptions,
  SpreadsheetProps,
  UseSpreadsheetOptions,
  UseSpreadsheetResult,
} from './types';

// Formula engine
export {
  normalizeCellAddress,
  parseCellAddress,
  buildCellAddress,
  expandCellRange,
  columnIndexToLabel,
  columnLabelToIndex,
  evaluateSpreadsheet,
  createSpreadsheetFunctions,
  buildAddressMatrix,
} from './formula';

// React surface
export { useSpreadsheet } from './hooks';
export { Spreadsheet } from './Spreadsheet';
