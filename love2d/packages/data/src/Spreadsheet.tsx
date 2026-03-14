import React, { useMemo, useState } from 'react';
// rjit-ignore: useEffect needed for dep-driven internal state sync
import { useEffect } from 'react';
import { Box, Input, Text, useThemeColorsOptional } from '@reactjit/core';
import { normalizeCellAddress } from './formula';
import type { SpreadsheetCellMap, SpreadsheetProps, SpreadsheetScalar } from './types';

const DEFAULT_MIN_COLUMN_WIDTH = 72;
const DEFAULT_MAX_COLUMN_WIDTH = 460;

interface NativeSpreadsheetState {
  address: string;
  rawInput: string;
  draftInput: string;
  value: SpreadsheetScalar;
  error?: string;
  editing: boolean;
  valueType: string;
  valueDisplay: string;
  errorCount: number;
}

function toDisplayString(value: SpreadsheetScalar): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  return String(value);
}

function valueTypeLabel(value: SpreadsheetScalar): string {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string' && value.length === 0) return 'empty';
  return 'text';
}

function updateCellMap(cells: SpreadsheetCellMap, addressInput: string, input: string): SpreadsheetCellMap {
  const address = normalizeCellAddress(addressInput);
  const next = { ...cells };
  if (input.length === 0) delete next[address];
  else next[address] = input;
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeColumnWidths(
  widths: number[] | undefined,
  cols: number,
  fallbackWidth: number,
  minWidth: number,
  maxWidth: number,
): number[] {
  return Array.from({ length: cols }, (_, colIdx) => {
    const raw = widths?.[colIdx];
    const width = typeof raw === 'number' && Number.isFinite(raw) ? raw : fallbackWidth;
    return clamp(width, minWidth, maxWidth);
  });
}

function areEqualWidths(left: number[], right: number[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function normalizeNumberList(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  }
  if (!value || typeof value !== 'object') return [];

  return Object.keys(value as Record<string, unknown>)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => (value as Record<string, unknown>)[key])
    .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
}

function createNativeState(address: string, rawInput: string): NativeSpreadsheetState {
  return {
    address,
    rawInput,
    draftInput: rawInput,
    value: '',
    error: undefined,
    editing: false,
    valueType: 'empty',
    valueDisplay: '',
    errorCount: 0,
  };
}

export function Spreadsheet({
  rows = 20,
  cols = 8,
  initialCells,
  cells,
  onCellsChange,
  readOnly = false,
  showFormulaBar = true,
  columnWidth = 118,
  columnWidths,
  onColumnWidthsChange,
  resizableColumns = true,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  maxColumnWidth = DEFAULT_MAX_COLUMN_WIDTH,
  fitColumnsToViewport = false,
  rowHeight = 30,
  viewportHeight,
  minVisibleRows = 6,
  maxVisibleRows = 14,
  selectedAddress: selectedAddressProp,
  onSelectedAddressChange,
  autoScrollToSelection = true,
  showStatusBar = true,
  style,
  headerStyle: _headerStyle,
  cellStyle: _cellStyle,
  formulaBarStyle,
  statusBarStyle,
}: SpreadsheetProps) {
  const theme = useThemeColorsOptional();
  const colors = {
    bg: theme?.bg ?? '#0f172a',
    bgAlt: theme?.bgAlt ?? '#111827',
    surface: theme?.surface ?? '#1f2937',
    border: theme?.border ?? '#334155',
    text: theme?.text ?? '#e5e7eb',
    textDim: theme?.textDim ?? '#94a3b8',
    accent: theme?.accent ?? '#22d3ee',
    accentSoft: theme?.accentSoft ?? '#164e63',
    error: theme?.error ?? '#ef4444',
  };

  const controlled = cells !== undefined;
  const [internalCells, setInternalCells] = useState<SpreadsheetCellMap>(initialCells ?? {});
  const liveCells = controlled ? (cells as SpreadsheetCellMap) : internalCells;

  const widthControlled = columnWidths !== undefined;
  const canResizeColumns = resizableColumns && !readOnly && (!widthControlled || !!onColumnWidthsChange);
  const resolvedMinColumnWidth = Math.max(48, minColumnWidth);
  const resolvedMaxColumnWidth = Math.max(resolvedMinColumnWidth, maxColumnWidth);
  const [internalColumnWidths, setInternalColumnWidths] = useState<number[]>(() =>
    normalizeColumnWidths(columnWidths, cols, columnWidth, resolvedMinColumnWidth, resolvedMaxColumnWidth),
  );
  const liveColumnWidths = useMemo(() => {
    const sourceWidths = widthControlled ? columnWidths : internalColumnWidths;
    return normalizeColumnWidths(
      sourceWidths,
      cols,
      columnWidth,
      resolvedMinColumnWidth,
      resolvedMaxColumnWidth,
    );
  }, [
    widthControlled,
    columnWidths,
    internalColumnWidths,
    cols,
    columnWidth,
    resolvedMinColumnWidth,
    resolvedMaxColumnWidth,
  ]);

  // Dep-driven: sync internal column widths when cols/config change.
  // rjit-ignore-next-line
  useEffect(() => {
    if (widthControlled) return;
    setInternalColumnWidths((prev) => {
      const next = normalizeColumnWidths(
        prev,
        cols,
        columnWidth,
        resolvedMinColumnWidth,
        resolvedMaxColumnWidth,
      );
      return areEqualWidths(prev, next) ? prev : next;
    });
  }, [widthControlled, cols, columnWidth, resolvedMinColumnWidth, resolvedMaxColumnWidth]);

  const selectionControlled = selectedAddressProp !== undefined;
  const [internalSelectedAddress, setInternalSelectedAddress] = useState('A1');
  const selectedKey = normalizeCellAddress(selectionControlled ? (selectedAddressProp as string) : internalSelectedAddress);

  const [nativeState, setNativeState] = useState<NativeSpreadsheetState>(() =>
    createNativeState(selectedKey, liveCells[selectedKey] ?? ''),
  );
  const [formulaInput, setFormulaInput] = useState(liveCells[selectedKey] ?? '');

  // Dep-driven: sync formula input and native state when selection/cells change.
  // rjit-ignore-next-line
  useEffect(() => {
    const rawInput = liveCells[selectedKey] ?? '';
    if (!nativeState.editing) {
      setFormulaInput(rawInput);
    }
    setNativeState((prev) => (
      prev.address === selectedKey && prev.rawInput === rawInput
        ? prev
        : { ...prev, address: selectedKey, rawInput, draftInput: prev.editing ? prev.draftInput : rawInput }
    ));
  }, [liveCells, selectedKey, nativeState.editing]);

  const applySelection = (addressInput: string) => {
    const normalized = normalizeCellAddress(addressInput);
    if (!selectionControlled) setInternalSelectedAddress(normalized);
    onSelectedAddressChange?.(normalized);
  };

  const applyCellChange = (addressInput: string, input: string) => {
    const next = updateCellMap(liveCells, addressInput, input);
    if (!controlled) setInternalCells(next);
    onCellsChange?.(next);
    return next;
  };

  const handleNativeState = (event: Record<string, unknown>) => {
    const address = normalizeCellAddress(String(event.address ?? selectedKey));
    const rawInput = typeof event.rawInput === 'string' ? event.rawInput : (liveCells[address] ?? '');
    const value = (event.value as SpreadsheetScalar | undefined) ?? '';
    const error = typeof event.error === 'string' && event.error.length > 0 ? event.error : undefined;
    const editing = !!event.editing;
    const draftInput = typeof event.draftInput === 'string' ? event.draftInput : rawInput;
    const valueType = typeof event.valueType === 'string' ? event.valueType : valueTypeLabel(value);
    const valueDisplay = typeof event.valueDisplay === 'string'
      ? event.valueDisplay
      : (error ? '#ERR' : toDisplayString(value));
    const errorCount = typeof event.errorCount === 'number' ? event.errorCount : nativeState.errorCount;

    setNativeState({
      address,
      rawInput,
      draftInput,
      value,
      error,
      editing,
      valueType,
      valueDisplay,
      errorCount,
    });
    setFormulaInput(editing ? draftInput : rawInput);
  };

  const handleNativeSelect = (event: Record<string, unknown>) => {
    const address = normalizeCellAddress(String(event.address ?? selectedKey));
    applySelection(address);
    handleNativeState({ ...event, address });
  };

  const handleNativeChange = (event: Record<string, unknown>) => {
    if (readOnly) return;
    const address = normalizeCellAddress(String(event.address ?? selectedKey));
    const input = typeof event.input === 'string' ? event.input : '';
    applyCellChange(address, input);
    setFormulaInput(input);
  };

  const handleNativeColumnResize = (event: Record<string, unknown>) => {
    const nextWidths = normalizeColumnWidths(
      normalizeNumberList(event.widths),
      cols,
      columnWidth,
      resolvedMinColumnWidth,
      resolvedMaxColumnWidth,
    );
    if (!widthControlled) setInternalColumnWidths(nextWidths);
    onColumnWidthsChange?.(nextWidths);
  };

  const commitFormula = (input: string) => {
    if (readOnly) return;
    applyCellChange(selectedKey, input);
    setFormulaInput(input);
  };

  const resolvedMinRows = Math.max(1, minVisibleRows);
  const resolvedMaxRows = Math.max(resolvedMinRows, maxVisibleRows);
  const viewportRows = Math.max(resolvedMinRows, Math.min(resolvedMaxRows, rows + 1));
  const gridViewportHeight = viewportHeight ?? viewportRows * rowHeight + 2;

  const selectedError = nativeState.error;
  const selectedRawInput = nativeState.rawInput ?? (liveCells[selectedKey] ?? '');
  const selectedValueType = nativeState.valueType || valueTypeLabel(nativeState.value);
  const selectedValueDisplay = nativeState.valueDisplay || (selectedError ? '#ERR' : toDisplayString(nativeState.value));

  return (
    <Box
      style={{
        width: '100%',
        minWidth: 0,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      {showFormulaBar && (
        <Box style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 8,
          paddingBottom: selectedError ? 4 : 8,
          gap: 6,
          ...formulaBarStyle,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Box style={{
              width: 64,
              height: 28,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.bgAlt,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: colors.accent, fontSize: 10, fontWeight: 'bold' }}>{selectedKey}</Text>
            </Box>
            <Box style={{ flexGrow: 1 }}>
              <Input
                value={formulaInput}
                editable={!readOnly}
                live
                onLiveChange={setFormulaInput}
                onBlur={commitFormula}
                onSubmit={commitFormula}
                placeholder={'Type a value or formula: =SUM(A1:A4), =CONVERT(A2,"mi","km"), =REMAP(B2,0,100,0,1)'}
                style={{
                  height: 28,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                  color: colors.text,
                  fontSize: 10,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                }}
              />
            </Box>
          </Box>

          {selectedError && (
            <Text style={{ color: colors.error, fontSize: 9 }}>
              {`Formula error in ${selectedKey}: ${selectedError}`}
            </Text>
          )}
          {!selectedError && !readOnly && (
            <Text style={{ color: colors.textDim, fontSize: 9 }}>
              {'Arrow keys and Tab move. F2 or type to edit. Drag column separators to resize.'}
            </Text>
          )}
        </Box>
      )}

      {React.createElement('SpreadsheetGrid', {
        rows,
        cols,
        cells: liveCells,
        selectedAddress: selectedKey,
        readOnly,
        columnWidth,
        columnWidths: liveColumnWidths,
        resizableColumns: canResizeColumns,
        minColumnWidth: resolvedMinColumnWidth,
        maxColumnWidth: resolvedMaxColumnWidth,
        fitColumnsToViewport,
        rowHeight,
        autoScrollToSelection,
        colorBg: colors.bg,
        colorBgAlt: colors.bgAlt,
        colorSurface: colors.surface,
        colorBorder: colors.border,
        colorText: colors.text,
        colorTextDim: colors.textDim,
        colorAccent: colors.accent,
        colorAccentSoft: colors.accentSoft,
        colorError: colors.error,
        focusable: true,
        onSpreadsheetSelect: handleNativeSelect,
        onSpreadsheetChange: handleNativeChange,
        onSpreadsheetColumnResize: handleNativeColumnResize,
        onSpreadsheetState: handleNativeState,
        style: {
          width: '100%',
          minWidth: 0,
          height: gridViewportHeight,
        },
      })}

      {showStatusBar && (
        <Box style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 4,
          ...statusBarStyle,
        }}>
          <Text style={{ color: colors.textDim, fontSize: 9 }}>
            {`Selected ${selectedKey} | raw "${selectedRawInput || ''}" | value ${selectedValueDisplay || ''} | type ${selectedValueType} | errors ${nativeState.errorCount}`}
          </Text>
        </Box>
      )}
    </Box>
  );
}
