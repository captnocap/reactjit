import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Input,
  Pressable,
  Text,
  useThemeColorsOptional,
} from '@reactjit/core';
import {
  buildAddressMatrix,
  columnIndexToLabel,
  evaluateSpreadsheet,
  normalizeCellAddress,
} from './formula';
import type { SpreadsheetCellMap, SpreadsheetProps, SpreadsheetScalar } from './types';

const ROW_HEADER_WIDTH = 52;

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

function updateCellMap(cells: SpreadsheetCellMap, addressInput: string, input: string): SpreadsheetCellMap {
  const address = normalizeCellAddress(addressInput);
  const next = { ...cells };
  if (input.length === 0) delete next[address];
  else next[address] = input;
  return next;
}

export function Spreadsheet({
  rows = 20,
  cols = 8,
  initialCells,
  cells,
  onCellsChange,
  functionMap,
  readOnly = false,
  showFormulaBar = true,
  columnWidth = 118,
  rowHeight = 30,
  style,
  headerStyle,
  cellStyle,
  formulaBarStyle,
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

  const [selectedAddress, setSelectedAddress] = useState('A1');
  const selectedKey = normalizeCellAddress(selectedAddress);
  const [formulaInput, setFormulaInput] = useState(liveCells[selectedKey] ?? '');

  useEffect(() => {
    setFormulaInput(liveCells[selectedKey] ?? '');
  }, [liveCells, selectedKey]);

  const addressMatrix = useMemo(() => buildAddressMatrix(rows, cols), [rows, cols]);
  const evaluation = useMemo(
    () => evaluateSpreadsheet(liveCells, { functions: functionMap, targetAddresses: addressMatrix }),
    [liveCells, functionMap, addressMatrix],
  );

  const selectedError = evaluation.errors[selectedKey];

  const commitCell = (address: string, input: string) => {
    if (readOnly) return;
    const next = updateCellMap(liveCells, address, input);
    if (!controlled) setInternalCells(next);
    onCellsChange?.(next);
  };

  const commitFormula = (input: string) => {
    setFormulaInput(input);
    commitCell(selectedKey, input);
  };

  const totalWidth = ROW_HEADER_WIDTH + cols * columnWidth;
  const viewportRows = Math.max(6, Math.min(14, rows + 1));
  const gridViewportHeight = viewportRows * rowHeight + 2;

  return (
    <Box style={{
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: 'hidden',
      ...style,
    }}>
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
        </Box>
      )}

      <Box style={{ width: '100%', height: gridViewportHeight, overflow: 'scroll' }}>
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

            {Array.from({ length: cols }, (_, colIdx) => (
              <Box
                key={`header-${colIdx}`}
                style={{
                  width: columnWidth,
                  height: rowHeight,
                  borderRightWidth: colIdx < cols - 1 ? 1 : 0,
                  borderColor: colors.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontSize: 10, fontWeight: 'bold' }}>
                  {columnIndexToLabel(colIdx)}
                </Text>
              </Box>
            ))}
          </Box>

          {Array.from({ length: rows }, (_, rowIdx) => (
            <Box key={`row-${rowIdx}`} style={{ flexDirection: 'row' }}>
              <Box style={{
                width: ROW_HEADER_WIDTH,
                height: rowHeight,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{ color: colors.textDim, fontSize: 9 }}>{String(rowIdx + 1)}</Text>
              </Box>

              {Array.from({ length: cols }, (_, colIdx) => {
                const address = `${columnIndexToLabel(colIdx)}${rowIdx + 1}`;
                const normalized = normalizeCellAddress(address);
                const cellValue = evaluation.values[normalized] ?? '';
                const cellError = evaluation.errors[normalized];
                const selected = normalized === selectedKey;
                const displayValue = cellError ? '#ERR' : toDisplayString(cellValue);
                const align = isNumeric(cellValue) && !cellError ? 'right' : 'left';

                return (
                  <Pressable
                    key={normalized}
                    disabled={false}
                    onPress={() => {
                      setSelectedAddress(normalized);
                      setFormulaInput(liveCells[normalized] ?? '');
                    }}
                    style={{
                      width: columnWidth,
                      height: rowHeight,
                    }}
                  >
                    <Box style={{
                      width: '100%',
                      height: '100%',
                      borderRightWidth: colIdx < cols - 1 ? 1 : 0,
                      borderBottomWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentSoft : colors.bgAlt,
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 6,
                      paddingBottom: 6,
                      justifyContent: 'center',
                      ...cellStyle,
                    }}>
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
                    </Box>
                  </Pressable>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
