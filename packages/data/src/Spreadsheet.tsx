import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Input,
  type LayoutEvent,
  type LoveEvent,
  type ScrollEvent,
  Pressable,
  ScrollView,
  Text,
  useThemeColorsOptional,
} from '@reactjit/core';
import {
  columnIndexToLabel,
  normalizeCellAddress,
  parseCellAddress,
  useDataEvaluate,
} from './formula';
import { getNavigatedAddress, normalizeSpreadsheetKey } from './interaction';
import { fitColumnWidthsToViewport } from './layout';
import type { SpreadsheetCellMap, SpreadsheetEvaluation, SpreadsheetProps, SpreadsheetScalar } from './types';

const EMPTY_EVAL: SpreadsheetEvaluation = { values: {}, errors: {} };

const ROW_HEADER_WIDTH = 52;
const DEFAULT_MIN_COLUMN_WIDTH = 72;
const DEFAULT_MAX_COLUMN_WIDTH = 460;
const VISIBLE_ROW_BUFFER = 3;

function toDisplayString(value: SpreadsheetScalar): string {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  return String(value);
}

function isNumeric(value: SpreadsheetScalar): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return false;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return false;
  return Number.isFinite(Number(trimmed));
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

function buildEvaluationTargets(cells: SpreadsheetCellMap, selectedAddress: string): string[] {
  const targets = new Set(Object.keys(cells).map(normalizeCellAddress));
  targets.add(selectedAddress);
  return Array.from(targets);
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
  headerStyle,
  cellStyle,
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

  const resizeStateRef = useRef<{ columnIndex: number; startWidth: number } | null>(null);
  const [resizingColumnIndex, setResizingColumnIndex] = useState<number | null>(null);

  const selectionControlled = selectedAddressProp !== undefined;
  const [internalSelectedAddress, setInternalSelectedAddress] = useState('A1');
  const selectedKey = normalizeCellAddress(selectionControlled ? (selectedAddressProp as string) : internalSelectedAddress);
  const selectedLocation = parseCellAddress(selectedKey) ?? { col: 0, row: 0 };
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [programmaticScroll, setProgrammaticScroll] = useState<{ x: number; y: number } | null>(null);
  const scrollReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalSelectionChangeRef = useRef(false);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState('');
  const [formulaInput, setFormulaInput] = useState(liveCells[selectedKey] ?? '');

  useEffect(() => {
    if (editingAddress === selectedKey) {
      setFormulaInput(editingInput);
      return;
    }
    setFormulaInput(liveCells[selectedKey] ?? '');
  }, [liveCells, selectedKey, editingAddress, editingInput]);

  const columnLabels = useMemo(
    () => Array.from({ length: cols }, (_, colIdx) => columnIndexToLabel(colIdx)),
    [cols],
  );
  const renderedColumnWidths = useMemo(() => {
    if (!fitColumnsToViewport || viewportSize.width <= 0) return liveColumnWidths;
    return fitColumnWidthsToViewport({
      widths: liveColumnWidths,
      viewportWidth: viewportSize.width,
      rowHeaderWidth: ROW_HEADER_WIDTH,
      minWidth: resolvedMinColumnWidth,
      maxWidth: resolvedMaxColumnWidth,
    });
  }, [
    fitColumnsToViewport,
    liveColumnWidths,
    viewportSize.width,
    resolvedMinColumnWidth,
    resolvedMaxColumnWidth,
  ]);
  const columnOffsets = useMemo(() => {
    const offsets: number[] = [];
    let left = ROW_HEADER_WIDTH;
    for (let colIdx = 0; colIdx < cols; colIdx += 1) {
      offsets[colIdx] = left;
      left += renderedColumnWidths[colIdx] ?? columnWidth;
    }
    return offsets;
  }, [cols, renderedColumnWidths, columnWidth]);
  const evaluationTargets = useMemo(
    () => buildEvaluationTargets(liveCells, selectedKey),
    [liveCells, selectedKey],
  );
  const evaluate = useDataEvaluate();
  const [evaluation, setEvaluation] = useState<SpreadsheetEvaluation>(EMPTY_EVAL);
  useEffect(() => {
    let active = true;
    evaluate({ cells: liveCells, targets: evaluationTargets })
      .then((nextEvaluation) => {
        if (active) setEvaluation(nextEvaluation);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [evaluate, liveCells, evaluationTargets]);

  const selectedError = evaluation.errors[selectedKey];
  const selectedRawInput = liveCells[selectedKey] ?? '';
  const selectedValue = evaluation.values[selectedKey] ?? '';
  const selectedValueType = valueTypeLabel(selectedValue);
  const selectedValueDisplay = selectedError ? '#ERR' : toDisplayString(selectedValue);

  const commitCell = (address: string, input: string) => {
    if (readOnly) return;
    const next = updateCellMap(liveCells, address, input);
    if (!controlled) setInternalCells(next);
    onCellsChange?.(next);
  };

  const applySelection = (address: string) => {
    const normalized = normalizeCellAddress(address);
    internalSelectionChangeRef.current = true;
    if (!selectionControlled) setInternalSelectedAddress(normalized);
    onSelectedAddressChange?.(normalized);
    setFormulaInput(liveCells[normalized] ?? '');
  };

  const commitInlineEdit = (input: string, nextAddress?: string) => {
    if (readOnly) return;
    const address = editingAddress ?? selectedKey;
    setEditingAddress(null);
    setEditingInput('');
    commitCell(address, input);
    if (nextAddress) {
      applySelection(nextAddress);
      return;
    }
    setFormulaInput(input);
  };

  const cancelInlineEdit = () => {
    setEditingAddress(null);
    setEditingInput('');
    setFormulaInput(liveCells[selectedKey] ?? '');
  };

  const startInlineEdit = (seedInput?: string) => {
    if (readOnly) return;
    const nextInput = seedInput ?? liveCells[selectedKey] ?? '';
    setEditingAddress(selectedKey);
    setEditingInput(nextInput);
    setFormulaInput(nextInput);
  };

  const handleFormulaLiveChange = (input: string) => {
    setFormulaInput(input);
    if (editingAddress === selectedKey) setEditingInput(input);
  };

  const commitFormula = (input: string) => {
    if (editingAddress === selectedKey) {
      commitInlineEdit(input);
      return;
    }
    setFormulaInput(input);
    commitCell(selectedKey, input);
  };

  const selectAddress = (address: string) => {
    const normalized = normalizeCellAddress(address);
    if (editingAddress && editingAddress !== normalized) {
      commitInlineEdit(editingInput, normalized);
      return;
    }
    applySelection(normalized);
  };

  const queueProgrammaticScroll = (x: number, y: number) => {
    setScrollPosition({ x, y });
    setProgrammaticScroll({ x, y });
    if (typeof setTimeout !== 'function') return;
    if (scrollReleaseTimerRef.current && typeof clearTimeout === 'function') {
      clearTimeout(scrollReleaseTimerRef.current);
    }
    scrollReleaseTimerRef.current = setTimeout(() => {
      setProgrammaticScroll(null);
      scrollReleaseTimerRef.current = null;
    }, 48);
  };

  useEffect(() => () => {
    if (scrollReleaseTimerRef.current && typeof clearTimeout === 'function') {
      clearTimeout(scrollReleaseTimerRef.current);
    }
  }, []);

  const commitColumnWidths = (nextWidths: number[]) => {
    const normalized = normalizeColumnWidths(
      nextWidths,
      cols,
      columnWidth,
      resolvedMinColumnWidth,
      resolvedMaxColumnWidth,
    );
    if (!widthControlled) setInternalColumnWidths(normalized);
    onColumnWidthsChange?.(normalized);
  };

  const beginColumnResize = (columnIndex: number) => {
    if (!canResizeColumns) return;
    resizeStateRef.current = {
      columnIndex,
      startWidth: liveColumnWidths[columnIndex] ?? columnWidth,
    };
    setResizingColumnIndex(columnIndex);
  };

  const dragColumnResize = (columnIndex: number, event: LoveEvent) => {
    const resizeState = resizeStateRef.current;
    if (!resizeState || resizeState.columnIndex !== columnIndex) return;
    const delta = event.totalDeltaX ?? event.dx ?? 0;
    const nextWidth = clamp(
      resizeState.startWidth + delta,
      resolvedMinColumnWidth,
      resolvedMaxColumnWidth,
    );
    if (nextWidth === liveColumnWidths[columnIndex]) return;
    const nextWidths = [...liveColumnWidths];
    nextWidths[columnIndex] = nextWidth;
    commitColumnWidths(nextWidths);
  };

  const endColumnResize = () => {
    resizeStateRef.current = null;
    setResizingColumnIndex(null);
  };

  const totalWidth = ROW_HEADER_WIDTH + renderedColumnWidths.reduce((sum, width) => sum + width, 0);
  const resolvedMinRows = Math.max(1, minVisibleRows);
  const resolvedMaxRows = Math.max(resolvedMinRows, maxVisibleRows);
  const viewportRows = Math.max(resolvedMinRows, Math.min(resolvedMaxRows, rows + 1));
  const gridViewportHeight = viewportHeight ?? viewportRows * rowHeight + 2;
  const totalHeight = (rows + 1) * rowHeight;
  const fallbackViewportHeight = typeof gridViewportHeight === 'number' ? gridViewportHeight : viewportRows * rowHeight;
  const effectiveViewportHeight = viewportSize.height > 0 ? viewportSize.height : fallbackViewportHeight;
  const visibleRowCount = Math.max(1, Math.ceil(effectiveViewportHeight / rowHeight) + VISIBLE_ROW_BUFFER * 2);
  const firstVisibleRow = rows > 0
    ? clamp(Math.floor(Math.max(0, scrollPosition.y - rowHeight) / rowHeight) - VISIBLE_ROW_BUFFER, 0, rows - 1)
    : 0;
  const lastVisibleRow = rows > 0
    ? clamp(firstVisibleRow + visibleRowCount - 1, 0, rows - 1)
    : -1;
  const topSpacerHeight = Math.max(0, firstVisibleRow * rowHeight);
  const bottomSpacerHeight = Math.max(0, (rows - lastVisibleRow - 1) * rowHeight);

  const handleScroll = (event: ScrollEvent) => {
    setScrollPosition((prev) => (
      prev.x === event.scrollX && prev.y === event.scrollY
        ? prev
        : { x: event.scrollX, y: event.scrollY }
    ));
  };

  const handleGridKeyDown = (event: LoveEvent) => {
    event.stopPropagation?.();
    const key = normalizeSpreadsheetKey(event);
    if (editingAddress === selectedKey) {
      if (key === 'escape') {
        cancelInlineEdit();
        return;
      }
      if (key === 'tab') {
        const nextAddress = getNavigatedAddress({
          selectedAddress: selectedKey,
          rows,
          cols,
          key,
          shift: !!event.shift,
        });
        commitInlineEdit(editingInput, nextAddress ?? selectedKey);
      }
      return;
    }

    const nextAddress = getNavigatedAddress({
      selectedAddress: selectedKey,
      rows,
      cols,
      key,
      shift: !!event.shift,
    });
    if (nextAddress) {
      applySelection(nextAddress);
      return;
    }

    if (readOnly) return;
    if (key === 'f2') {
      startInlineEdit();
      return;
    }
    if (key === 'backspace' || key === 'delete') {
      startInlineEdit('');
    }
  };

  const handleGridTextInput = (event: LoveEvent) => {
    event.stopPropagation?.();
    if (readOnly || editingAddress) return;
    if (event.ctrl || event.alt || event.meta) return;
    const text = event.text ?? '';
    if (text.length === 0 || /[\u0000-\u001f]/.test(text)) return;
    startInlineEdit(text);
  };

  useEffect(() => {
    const fromInternalSelection = internalSelectionChangeRef.current;
    internalSelectionChangeRef.current = false;
    if (!selectionControlled || !autoScrollToSelection || fromInternalSelection) return;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const cellLeft = columnOffsets[selectedLocation.col] ?? ROW_HEADER_WIDTH;
    const cellWidth = renderedColumnWidths[selectedLocation.col] ?? columnWidth;
    const cellTop = rowHeight + selectedLocation.row * rowHeight;

    const targetX = clamp(
      cellLeft - Math.max(0, (viewportSize.width - cellWidth) / 2),
      0,
      Math.max(0, totalWidth - viewportSize.width),
    );
    const targetY = clamp(
      cellTop - Math.max(0, (viewportSize.height - rowHeight) / 2),
      0,
      Math.max(0, totalHeight - viewportSize.height),
    );
    queueProgrammaticScroll(targetX, targetY);
  }, [
    selectionControlled,
    autoScrollToSelection,
    selectedKey,
    selectedLocation.col,
    selectedLocation.row,
    viewportSize.width,
    viewportSize.height,
    columnOffsets,
    renderedColumnWidths,
    columnWidth,
    rowHeight,
    totalWidth,
    totalHeight,
  ]);

  return (
    <Box
      focusable
      focusGroup
      onKeyDown={handleGridKeyDown}
      onTextInput={handleGridTextInput}
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
                onLiveChange={handleFormulaLiveChange}
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

      <Box
        onLayout={(event: LayoutEvent) => {
          if (event.width === viewportSize.width && event.height === viewportSize.height) return;
          setViewportSize({ width: event.width, height: event.height });
        }}
        style={{
          width: '100%',
          minWidth: 0,
          height: gridViewportHeight,
        }}
      >
        <ScrollView
          onScroll={handleScroll}
          style={{
            width: '100%',
            minWidth: 0,
            height: '100%',
            ...(programmaticScroll ? { scrollX: programmaticScroll.x, scrollY: programmaticScroll.y } : {}),
          }}
        >
          <Box style={{ width: totalWidth }}>
            <Box style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderColor: colors.border,
              ...headerStyle,
            }}>
              <Box style={{
                width: ROW_HEADER_WIDTH,
                height: rowHeight,
                borderRightWidth: 1,
                borderColor: colors.border,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: colors.textDim, fontSize: 9, fontWeight: 'bold' }}>{'ROW'}</Text>
              </Box>

              {columnLabels.map((label, colIdx) => (
                <Box
                  key={`header-${label}`}
                  style={{
                    width: renderedColumnWidths[colIdx],
                    height: rowHeight,
                    borderRightWidth: colIdx < cols - 1 ? 1 : 0,
                    borderColor: colors.border,
                    backgroundColor: selectedLocation.col === colIdx ? colors.accentSoft : colors.surface,
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  <Text style={{ color: selectedLocation.col === colIdx ? colors.accent : colors.text, fontSize: 10, fontWeight: 'bold' }}>
                    {label}
                  </Text>
                  {canResizeColumns && (
                    <Box
                      onDragStart={() => beginColumnResize(colIdx)}
                      onDrag={(event) => dragColumnResize(colIdx, event)}
                      onDragEnd={endColumnResize}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: 8,
                        height: rowHeight,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: resizingColumnIndex === colIdx ? colors.accentSoft : 'transparent',
                        userSelect: 'none',
                      }}
                    >
                      <Box style={{
                        width: 2,
                        height: rowHeight - 10,
                        borderRadius: 2,
                        backgroundColor: resizingColumnIndex === colIdx ? colors.accent : colors.border,
                      }} />
                    </Box>
                  )}
                </Box>
              ))}
            </Box>

            {topSpacerHeight > 0 && (
              <Box style={{ width: '100%', height: topSpacerHeight }} />
            )}

            {Array.from({ length: Math.max(0, lastVisibleRow - firstVisibleRow + 1) }, (_, visibleIdx) => {
              const rowIdx = firstVisibleRow + visibleIdx;
              return (
                <Box key={`row-${rowIdx}`} style={{ flexDirection: 'row' }}>
                  <Box style={{
                    width: ROW_HEADER_WIDTH,
                    height: rowHeight,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: selectedLocation.row === rowIdx ? colors.accentSoft : colors.surface,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ color: selectedLocation.row === rowIdx ? colors.accent : colors.textDim, fontSize: 9 }}>{String(rowIdx + 1)}</Text>
                  </Box>

                  {columnLabels.map((label, colIdx) => {
                    const normalized = `${label}${rowIdx + 1}`;
                    const cellValue = evaluation.values[normalized] ?? '';
                    const cellError = evaluation.errors[normalized];
                    const selected = normalized === selectedKey;
                    const inSelectionBand = selectedLocation.col === colIdx || selectedLocation.row === rowIdx;
                    const displayValue = cellError ? '#ERR' : toDisplayString(cellValue);
                    const align = isNumeric(cellValue) && !cellError ? 'right' : 'left';

                    return (
                      <Pressable
                        key={normalized}
                        disabled={false}
                        onPress={() => {
                          selectAddress(normalized);
                        }}
                        style={{
                          width: renderedColumnWidths[colIdx],
                          height: rowHeight,
                        }}
                      >
                        <Box style={{
                          width: '100%',
                          height: '100%',
                          borderRightWidth: colIdx < cols - 1 ? 1 : 0,
                          borderBottomWidth: 1,
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: selected ? colors.accentSoft : (inSelectionBand ? colors.surface : colors.bgAlt),
                          paddingLeft: selected && editingAddress === normalized ? 0 : 6,
                          paddingRight: selected && editingAddress === normalized ? 0 : 6,
                          paddingTop: selected && editingAddress === normalized ? 0 : 6,
                          paddingBottom: selected && editingAddress === normalized ? 0 : 6,
                          justifyContent: 'center',
                          ...cellStyle,
                        }}>
                          {selected && editingAddress === normalized ? (
                            <Box onKeyDown={handleGridKeyDown} style={{ width: '100%', height: '100%' }}>
                              <Input
                                value={editingInput}
                                editable={!readOnly}
                                live
                                autoFocus
                                submitOnEnter
                                onLiveChange={setEditingInput}
                                onBlur={commitInlineEdit}
                                onSubmit={commitInlineEdit}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderWidth: 0,
                                  borderRadius: 0,
                                  backgroundColor: colors.accentSoft,
                                  color: colors.text,
                                  fontSize: 10,
                                  paddingLeft: 6,
                                  paddingRight: 6,
                                  paddingTop: 6,
                                  paddingBottom: 6,
                                }}
                              />
                            </Box>
                          ) : (
                            <Text
                              style={{
                                color: cellError ? colors.error : colors.text,
                                fontSize: 10,
                                textAlign: align,
                                whiteSpace: 'nowrap',
                              }}
                              numberOfLines={1}
                            >
                              {displayValue}
                            </Text>
                          )}
                        </Box>
                      </Pressable>
                    );
                  })}
                </Box>
              );
            })}

            {bottomSpacerHeight > 0 && (
              <Box style={{ width: '100%', height: bottomSpacerHeight }} />
            )}
          </Box>
        </ScrollView>
      </Box>

      {showStatusBar && (
        <Box style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          gap: 3,
          ...statusBarStyle,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ color: colors.accent, fontSize: 9, fontWeight: 'bold' }}>{`Cell ${selectedKey}`}</Text>
            <Text style={{ color: colors.textDim, fontSize: 9 }}>{`Type ${selectedValueType}`}</Text>
            <Text style={{ color: selectedError ? colors.error : colors.textDim, fontSize: 9 }}>
              {selectedError ? `Error ${selectedError}` : `Value ${selectedValueDisplay}`}
            </Text>
          </Box>
          <Text style={{ color: colors.text, fontSize: 9 }} numberOfLines={1}>
            {selectedRawInput.length > 0 ? `Input ${selectedRawInput}` : 'Input empty'}
          </Text>
        </Box>
      )}
    </Box>
  );
}
