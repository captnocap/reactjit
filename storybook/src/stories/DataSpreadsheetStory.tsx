import React, { useEffect, useMemo, useState } from 'react';
import { Box, CodeBlock, Pressable, ScrollView, Text, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Spreadsheet, columnIndexToLabel, useDataEvaluate } from '../../../packages/data/src';
import type { SpreadsheetCellMap } from '../../../packages/data/src';

const INSTALL_CODE = `import { Spreadsheet } from '@reactjit/data'

<Spreadsheet
  rows={60}
  cols={16}
  cells={cells}
  columnWidths={widths}
  onColumnWidthsChange={setWidths}
  selectedAddress={activeCell}
  onSelectedAddressChange={setActiveCell}
  autoScrollToSelection
  viewportHeight={440}
  showStatusBar
/>`;

const EXAMPLE_FORMULAS = `=SUM(B2:B5)
=AVG(E2:E5)
=CONVERT(A2, "mi", "km")
=REMAP(B2, 0, 100, 0, 10)
=CLAMP(E2, 0, 100)
=IF(E2 >= 90, "A", "B")`;

interface ScalePreset {
  id: string;
  label: string;
  rows: number;
  cols: number;
  viewportHeight: number;
}

const SCALE_PRESETS: ScalePreset[] = [
  { id: 'compact', label: 'Compact', rows: 14, cols: 8, viewportHeight: 380 },
  { id: 'ops', label: 'Ops Grid', rows: 48, cols: 16, viewportHeight: 430 },
  { id: 'massive', label: 'Massive', rows: 140, cols: 28, viewportHeight: 500 },
];
const FOCUS_CELLS = ['B2', 'C2', 'F2', 'B7', 'C10', 'D10'];
const MINI_SIZE = { width: 330, height: 235 };
const MEDIUM_SIZE = { width: 560, height: 300 };
const MINI_VIEWPORT_HEIGHT = 170;
const MEDIUM_VIEWPORT_HEIGHT = 210;

const LOGISTICS_PRESET: SpreadsheetCellMap = {
  A1: 'Route',
  B1: 'Miles',
  C1: 'Km',
  D1: 'Gallons',
  E1: 'Liters',
  F1: 'EtaScore',
  G1: 'Status',
  A2: 'North',
  B2: '18',
  C2: '=ROUND(CONVERT(B2, "mi", "km"), 2)',
  D2: '2.8',
  E2: '=ROUND(CONVERT(D2, "gal", "l"), 2)',
  F2: '=ROUND(REMAP(C2, 0, 80, 0, 100), 1)',
  G2: '=IF(F2 >= 70, "on-track", "review")',
  A3: 'South',
  B3: '42',
  C3: '=ROUND(CONVERT(B3, "mi", "km"), 2)',
  D3: '5.4',
  E3: '=ROUND(CONVERT(D3, "gal", "l"), 2)',
  F3: '=ROUND(CLAMP(REMAP(C3, 0, 80, 0, 100), 0, 100), 1)',
  G3: '=IF(F3 >= 70, "on-track", "review")',
  A4: 'East',
  B4: '27',
  C4: '=ROUND(CONVERT(B4, "mi", "km"), 2)',
  D4: '3.6',
  E4: '=ROUND(CONVERT(D4, "gal", "l"), 2)',
  F4: '=ROUND(REMAP(C4, 0, 80, 0, 100), 1)',
  G4: '=IF(F4 >= 70, "on-track", "review")',
  A5: 'West',
  B5: '35',
  C5: '=ROUND(CONVERT(B5, "mi", "km"), 2)',
  D5: '4.9',
  E5: '=ROUND(CONVERT(D5, "gal", "l"), 2)',
  F5: '=ROUND(REMAP(C5, 0, 80, 0, 100), 1)',
  G5: '=IF(F5 >= 70, "on-track", "review")',
  A7: 'Totals',
  B7: '=SUM(B2:B5)',
  C7: '=ROUND(SUM(C2:C5), 2)',
  E7: '=ROUND(SUM(E2:E5), 2)',
  F7: '=ROUND(AVG(F2:F5), 1)',
};

const LAB_PRESET: SpreadsheetCellMap = {
  A1: 'Sample',
  B1: 'Temp(F)',
  C1: 'Temp(C)',
  D1: 'Flow(mph)',
  E1: 'Flow(mps)',
  F1: 'NormScore',
  G1: 'Distance2D',
  A2: 'S-101',
  B2: '74',
  C2: '=ROUND(CONVERT(B2, "f", "c"), 2)',
  D2: '16',
  E2: '=ROUND(CONVERT(D2, "mph", "mps"), 3)',
  F2: '=ROUND(CLAMP(REMAP(C2, 0, 40, 0, 100), 0, 100), 1)',
  G2: '=ROUND(DIST2D(B2, C2, D2, E2), 2)',
  A3: 'S-102',
  B3: '80',
  C3: '=ROUND(CONVERT(B3, "f", "c"), 2)',
  D3: '22',
  E3: '=ROUND(CONVERT(D3, "mph", "mps"), 3)',
  F3: '=ROUND(CLAMP(REMAP(C3, 0, 40, 0, 100), 0, 100), 1)',
  G3: '=ROUND(DIST2D(B3, C3, D3, E3), 2)',
  A4: 'S-103',
  B4: '67',
  C4: '=ROUND(CONVERT(B4, "f", "c"), 2)',
  D4: '12',
  E4: '=ROUND(CONVERT(D4, "mph", "mps"), 3)',
  F4: '=ROUND(CLAMP(REMAP(C4, 0, 40, 0, 100), 0, 100), 1)',
  G4: '=ROUND(DIST2D(B4, C4, D4, E4), 2)',
  A6: 'Summary',
  C6: '=ROUND(AVG(C2:C4), 2)',
  E6: '=ROUND(AVG(E2:E4), 3)',
  F6: '=ROUND(AVG(F2:F4), 1)',
};

function createColumnWidths(cols: number): number[] {
  return Array.from({ length: cols }, (_, colIdx) => {
    if (colIdx === 0) return 180;
    if (colIdx <= 4) return 128;
    return 112;
  });
}

function ensureScaleCells(seed: SpreadsheetCellMap, rows: number, cols: number): SpreadsheetCellMap {
  const next = { ...seed };

  for (let colIdx = 0; colIdx < cols; colIdx += 1) {
    const address = `${columnIndexToLabel(colIdx)}1`;
    if (!next[address]) {
      next[address] = colIdx === 0 ? 'Record' : `Metric ${colIdx}`;
    }
  }

  const syntheticRows = Math.min(rows, 72);
  for (let row = 2; row <= syntheticRows; row += 1) {
    if (cols > 0 && !next[`A${row}`]) next[`A${row}`] = `R-${row - 1}`;
    if (cols > 1 && !next[`B${row}`]) next[`B${row}`] = String((row * 13) % 97);
    if (cols > 2 && !next[`C${row}`]) next[`C${row}`] = `=ROUND(REMAP(B${row}, 0, 100, 0, 1), 3)`;
    if (cols > 3 && !next[`D${row}`]) next[`D${row}`] = `=IF(C${row} >= 0.7, "ok", "watch")`;
  }

  return next;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  const c = useThemeColors();
  return (
    <Box style={{
      width: 150,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 4,
    }}>
      <Text style={{ fontSize: 8, color: c.textDim, letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: tone, fontWeight: 'bold' }}>{value}</Text>
    </Box>
  );
}

export function DataSpreadsheetStory() {
  const c = useThemeColors();
  const [scalePreset, setScalePreset] = useState<ScalePreset>(SCALE_PRESETS[0]);
  const [columnWidths, setColumnWidths] = useState<number[]>(() => createColumnWidths(SCALE_PRESETS[0].cols));
  const [selectedAddress, setSelectedAddress] = useState('B2');
  const [cells, setCells] = useState<SpreadsheetCellMap>(() =>
    ensureScaleCells(LOGISTICS_PRESET, SCALE_PRESETS[0].rows, SCALE_PRESETS[0].cols),
  );

  const evaluate = useDataEvaluate();
  const [errorCount, setErrorCount] = useState(0);
  useEffect(() => {
    evaluate({ cells }).then(r => setErrorCount(Object.keys(r.errors).length)).catch(() => {});
  }, [cells]);
  const summary = useMemo(() => ({
    formulaCount:    Object.values(cells).filter(v => v.trim().startsWith('=')).length,
    conversionCount: Object.values(cells).filter(v => v.includes('CONVERT(')).length,
    mathCount:       Object.values(cells).filter(v => /(REMAP|CLAMP|DIST2D|ROUND|AVG|SUM)\(/.test(v)).length,
    errorCount,
  }), [cells, errorCount]);

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <Box style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 26, gap: 14 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
            {'Data Spreadsheet: Excel Replacement Case'}
          </Text>
          <S.StoryMuted>
            {'Grid editor + formula graph + built-in convert/math packs in one runtime component.'}
          </S.StoryMuted>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatCard label="Formula Cells" value={String(summary.formulaCount)} tone={c.primary} />
          <StatCard label="CONVERT Calls" value={String(summary.conversionCount)} tone={c.success} />
          <StatCard label="Math Calls" value={String(summary.mathCount)} tone={c.warning} />
          <StatCard label="Evaluation Errors" value={String(summary.errorCount)} tone={summary.errorCount > 0 ? c.error : c.success} />
          <StatCard label="Grid Size" value={`${scalePreset.rows} x ${scalePreset.cols}`} tone={c.accent} />
          <StatCard label="Selected Cell" value={selectedAddress} tone={c.primary} />
        </Box>

        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable onPress={() => {
            setCells(ensureScaleCells(LOGISTICS_PRESET, scalePreset.rows, scalePreset.cols));
            setSelectedAddress('B2');
          }}>
            <Box style={{
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
            }}>
              <S.StoryBody>{'Load Logistics Preset'}</S.StoryBody>
            </Box>
          </Pressable>

          <Pressable onPress={() => {
            setCells(ensureScaleCells(LAB_PRESET, scalePreset.rows, scalePreset.cols));
            setSelectedAddress('B2');
          }}>
            <Box style={{
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
            }}>
              <S.StoryBody>{'Load Lab Preset'}</S.StoryBody>
            </Box>
          </Pressable>

          <Pressable onPress={() => {
            setColumnWidths(createColumnWidths(scalePreset.cols));
            setSelectedAddress('B2');
          }}>
            <Box style={{
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
            }}>
              <S.StoryBody>{'Reset Column Widths'}</S.StoryBody>
            </Box>
          </Pressable>
        </Box>

        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Workflow Focus'}</Text>
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {FOCUS_CELLS.map((cell) => (
              <Pressable key={cell} onPress={() => setSelectedAddress(cell)}>
                <Box style={{
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: selectedAddress === cell ? c.primary : c.border,
                  backgroundColor: selectedAddress === cell ? c.bgAlt : c.surface,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                }}>
                  <S.StoryBody>{`Jump ${cell}`}</S.StoryBody>
                </Box>
              </Pressable>
            ))}
          </Box>
          <S.StoryCap>
            {'Status bar shows live input/value/error context for the active cell. This keeps edits auditable in app workflows.'}
          </S.StoryCap>
        </Box>

        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Scale Presets'}</Text>
          <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {SCALE_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => {
                  setScalePreset(preset);
                  setColumnWidths(createColumnWidths(preset.cols));
                  setCells((prev) => ensureScaleCells(prev, preset.rows, preset.cols));
                  setSelectedAddress('B2');
                }}
              >
                <Box style={{
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: scalePreset.id === preset.id ? c.primary : c.border,
                  backgroundColor: scalePreset.id === preset.id ? c.bgAlt : c.surface,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                }}>
                  <S.StoryBody>
                    {`${preset.label} ${preset.rows}x${preset.cols}`}
                  </S.StoryBody>
                </Box>
              </Pressable>
            ))}
          </Box>
          <S.StoryCap>
            {'Drag any header separator to resize columns. Shift + wheel or drag in the grid to pan horizontally.'}
          </S.StoryCap>
        </Box>

        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Live Sheet'}</Text>
          <Spreadsheet
            rows={scalePreset.rows}
            cols={scalePreset.cols}
            cells={cells}
            onCellsChange={setCells}
            selectedAddress={selectedAddress}
            onSelectedAddressChange={setSelectedAddress}
            autoScrollToSelection
            columnWidths={columnWidths}
            onColumnWidthsChange={setColumnWidths}
            minColumnWidth={72}
            maxColumnWidth={420}
            viewportHeight={scalePreset.viewportHeight}
            showStatusBar
          />
        </Box>

        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Embed Sizes: Mini + Medium'}</Text>
          <S.StoryCap>
            {'Same dataset, same formulas, same jump behavior. These are constrained component containers, not full-screen views.'}
          </S.StoryCap>
          <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Box style={{
              width: MINI_SIZE.width,
              maxWidth: '100%',
              height: MINI_SIZE.height,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.border,
              overflow: 'hidden',
            }}>
              <Spreadsheet
                rows={12}
                cols={8}
                cells={cells}
                selectedAddress={selectedAddress}
                onSelectedAddressChange={setSelectedAddress}
                autoScrollToSelection
                columnWidths={columnWidths.slice(0, 8)}
                viewportHeight={MINI_VIEWPORT_HEIGHT}
                minVisibleRows={4}
                maxVisibleRows={8}
                showFormulaBar={false}
                showStatusBar
              />
            </Box>

            <Box style={{
              width: MEDIUM_SIZE.width,
              maxWidth: '100%',
              height: MEDIUM_SIZE.height,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: c.border,
              overflow: 'hidden',
            }}>
              <Spreadsheet
                rows={20}
                cols={12}
                cells={cells}
                selectedAddress={selectedAddress}
                onSelectedAddressChange={setSelectedAddress}
                autoScrollToSelection
                columnWidths={columnWidths.slice(0, 12)}
                viewportHeight={MEDIUM_VIEWPORT_HEIGHT}
                minVisibleRows={6}
                maxVisibleRows={12}
                showStatusBar
              />
            </Box>
          </Box>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'start' }}>
          <Box style={{
            flexGrow: 1,
            minWidth: 260,
            gap: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 10,
            paddingBottom: 10,
          }}>
            <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Why teams would choose this over Excel in-app'}</Text>
            <S.StoryBreadcrumbActive>{'Excel pain: file handoffs, hidden macros, and no runtime guarantees.'}</S.StoryBreadcrumbActive>
            <S.StoryCap>{'Runtime answer: formulas execute in the same app runtime as the UI and business logic.'}</S.StoryCap>
            <S.StoryBreadcrumbActive>{'Excel pain: conversion logic scattered across tabs and helper sheets.'}</S.StoryBreadcrumbActive>
            <S.StoryCap>{'Runtime answer: CONVERT + math pack are first-class functions in every cell.'}</S.StoryCap>
            <S.StoryBreadcrumbActive>{'Excel pain: hard to productize collaborative workflows.'}</S.StoryBreadcrumbActive>
            <S.StoryCap>{'Runtime answer: spreadsheet UI is a composable component with controlled state and events.'}</S.StoryCap>
            <S.StoryBreadcrumbActive>{'Excel pain: context is lost during edits.'}</S.StoryBreadcrumbActive>
            <S.StoryCap>{'Runtime answer: selection-aware headers + status bar keep input/value/error visible at all times.'}</S.StoryCap>
          </Box>

          <Box style={{ flexGrow: 1, minWidth: 260, gap: 8 }}>
            <CodeBlock code={INSTALL_CODE} language="typescript" maxHeight={120} />
            <CodeBlock code={EXAMPLE_FORMULAS} language="typescript" maxHeight={140} />
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
}
