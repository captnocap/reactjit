import { useLoveRPC } from '@reactjit/core';
import type { SpreadsheetEvaluation } from './types';
export {
  buildAddressMatrix,
  columnIndexToLabel,
  normalizeCellAddress,
  parseCellAddress,
} from './address';

/** All formula evaluation runs in Lua via data:evaluate RPC. */
export const useDataEvaluate = () => useLoveRPC<SpreadsheetEvaluation>('data:evaluate');
