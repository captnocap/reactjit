// Types
export type {
  SpreadsheetScalar,
  SpreadsheetCellMap,
  SpreadsheetValueMap,
  SpreadsheetErrorMap,
  SpreadsheetEvaluation,
  SpreadsheetEvaluateOptions,
  SpreadsheetProps,
  UseSpreadsheetOptions,
  UseSpreadsheetResult,
} from './types';

// Formula engine (evaluation in Lua, address utils sync for render)
export {
  normalizeCellAddress,
  parseCellAddress,
  columnIndexToLabel,
  buildAddressMatrix,
  useDataEvaluate,
} from './formula';

// React surface
export { useSpreadsheet } from './hooks';
export { Spreadsheet } from './Spreadsheet';
