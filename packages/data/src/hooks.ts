import { useCallback, useMemo, useState } from 'react';
import { evaluateSpreadsheet, normalizeCellAddress } from './formula';
import type {
  SpreadsheetCellMap,
  SpreadsheetScalar,
  UseSpreadsheetOptions,
  UseSpreadsheetResult,
} from './types';

function cloneCells(cells: SpreadsheetCellMap): SpreadsheetCellMap {
  return { ...cells };
}

export function useSpreadsheet(options: UseSpreadsheetOptions = {}): UseSpreadsheetResult {
  const [cells, setCellsState] = useState<SpreadsheetCellMap>(() => cloneCells(options.initialCells ?? {}));

  const evaluation = useMemo(
    () => evaluateSpreadsheet(cells, options),
    [cells, options.functions, options.maxRangeCells, options.targetAddresses],
  );

  const setCell = useCallback((addressInput: string, input: string) => {
    const address = normalizeCellAddress(addressInput);
    setCellsState((prev) => {
      const next = { ...prev };
      if (input.length === 0) delete next[address];
      else next[address] = input;
      return next;
    });
  }, []);

  const setCells = useCallback((next: SpreadsheetCellMap) => {
    setCellsState(cloneCells(next));
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

  return {
    cells,
    values: evaluation.values,
    errors: evaluation.errors,
    setCell,
    setCells,
    getCellInput,
    getCellValue,
    getCellError,
  };
}
