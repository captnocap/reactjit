import React, { useMemo, useState } from 'react';
import { Box, CodeBlock, Pressable, ScrollView, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Spreadsheet, evaluateSpreadsheet } from '../../../packages/data/src';
import type { SpreadsheetCellMap } from '../../../packages/data/src';

const INSTALL_CODE = `import { Spreadsheet } from '@reactjit/data'

<Spreadsheet
  rows={14}
  cols={8}
  initialCells={cells}
/>`;

const EXAMPLE_FORMULAS = `=SUM(B2:B5)
=AVG(E2:E5)
=CONVERT(A2, "mi", "km")
=REMAP(B2, 0, 100, 0, 10)
=CLAMP(E2, 0, 100)
=IF(E2 >= 90, "A", "B")`;

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
  const [cells, setCells] = useState<SpreadsheetCellMap>(LOGISTICS_PRESET);

  const summary = useMemo(() => {
    const formulaCount = Object.values(cells).filter((v) => v.trim().startsWith('=')).length;
    const conversionCount = Object.values(cells).filter((v) => v.includes('CONVERT(')).length;
    const mathCount = Object.values(cells).filter((v) => /(REMAP|CLAMP|DIST2D|ROUND|AVG|SUM)\(/.test(v)).length;
    const evaluation = evaluateSpreadsheet(cells);
    const errorCount = Object.keys(evaluation.errors).length;
    return { formulaCount, conversionCount, mathCount, errorCount };
  }, [cells]);

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <Box style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 20, paddingBottom: 26, gap: 14 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
            {'Data Spreadsheet: Excel Replacement Case'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textDim }}>
            {'Grid editor + formula graph + built-in convert/math packs in one runtime component.'}
          </Text>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <StatCard label="Formula Cells" value={String(summary.formulaCount)} tone="#38bdf8" />
          <StatCard label="CONVERT Calls" value={String(summary.conversionCount)} tone="#22c55e" />
          <StatCard label="Math Calls" value={String(summary.mathCount)} tone="#f59e0b" />
          <StatCard label="Evaluation Errors" value={String(summary.errorCount)} tone={summary.errorCount > 0 ? '#ef4444' : '#22c55e'} />
        </Box>

        <Box style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => setCells(LOGISTICS_PRESET)}>
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
              <Text style={{ fontSize: 10, color: c.text }}>{'Load Logistics Preset'}</Text>
            </Box>
          </Pressable>

          <Pressable onPress={() => setCells(LAB_PRESET)}>
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
              <Text style={{ fontSize: 10, color: c.text }}>{'Load Lab Preset'}</Text>
            </Box>
          </Pressable>
        </Box>

        <Box style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Live Sheet'}</Text>
          <Spreadsheet rows={14} cols={8} cells={cells} onCellsChange={setCells} />
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
            <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>{'Why this replaces Excel for app workflows'}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{'1. Spreadsheet formulas evaluate directly inside the ReactJIT runtime.'}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{'2. Unit conversion is native through CONVERT(value, from, to).'}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{'3. Math pack functions (REMAP, CLAMP, DIST2D, LERP) are sheet-callable.'}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{'4. No external SaaS dependency: deterministic local/offline evaluation.'}</Text>
            <Text style={{ fontSize: 9, color: c.textDim }}>{'5. UI is themeable and composable with the rest of your app components.'}</Text>
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
