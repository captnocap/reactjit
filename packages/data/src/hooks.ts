import { useCallback, useEffect, useState } from 'react';
import { useDataEvaluate, normalizeCellAddress } from './formula';
import type {
  SpreadsheetCellMap,
  SpreadsheetEvaluation,
  SpreadsheetScalar,
  UseSpreadsheetOptions,
  UseSpreadsheetResult,
} from './types';

const EMPTY_EVAL: SpreadsheetEvaluation = { values: {}, errors: {} };

export function useSpreadsheet(options: UseSpreadsheetOptions = {}): UseSpreadsheetResult {
  const [cells, setCellsState] = useState<SpreadsheetCellMap>(() => ({ ...(options.initialCells ?? {}) }));
  const [evaluation, setEvaluation] = useState<SpreadsheetEvaluation>(EMPTY_EVAL);
  const evaluate = useDataEvaluate();

  useEffect(() => {
    const targets = options.targetAddresses && options.targetAddresses.length > 0
      ? options.targetAddresses
      : undefined;
    evaluate({ cells, targets, maxRangeCells: options.maxRangeCells })
      .then(setEvaluation)
      .catch(() => {});
  }, [cells, options.maxRangeCells, options.targetAddresses]);

  const setCell = useCallback((addressInput: string, input: string) => {
    const address = normalizeCellAddress(addressInput);
    setCellsState(prev => {
      const next = { ...prev };
      if (input.length === 0) delete next[address];
      else next[address] = input;
      return next;
    });
  }, []);

  const setCells = useCallback((next: SpreadsheetCellMap) => {
    setCellsState({ ...next });
  }, []);

  const getCellInput = useCallback(
    (addressInput: string) => cells[normalizeCellAddress(addressInput)] ?? '',
    [cells],
  );

  const getCellValue = useCallback(
    (addressInput: string): SpreadsheetScalar => evaluation.values[normalizeCellAddress(addressInput)] ?? '',
    [evaluation.values],
  );

  const getCellError = useCallback(
    (addressInput: string) => evaluation.errors[normalizeCellAddress(addressInput)],
    [evaluation.errors],
  );

  return { cells, values: evaluation.values, errors: evaluation.errors, setCell, setCells, getCellInput, getCellValue, getCellError };
}
