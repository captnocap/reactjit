import React from 'react';
import { Box, Text } from './primitives';
import { useThemeColorsOptional } from './context';
import type { Style } from './types';

export interface TableColumn<T = any> {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey?: string | ((row: T, index: number) => string);
  striped?: boolean;
  borderless?: boolean;
  headerStyle?: Style;
  rowStyle?: Style;
  cellStyle?: Style;
  style?: Style;
}

function alignToTextAlign(align?: 'left' | 'center' | 'right'): 'left' | 'center' | 'right' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  return 'left';
}

function getRowKey<T>(row: T, index: number, rowKey?: string | ((row: T, index: number) => string)): string {
  if (typeof rowKey === 'function') return rowKey(row, index);
  if (typeof rowKey === 'string') return String((row as any)[rowKey]);
  return String(index);
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  striped = false,
  borderless = false,
  headerStyle,
  rowStyle,
  cellStyle,
  style,
}: TableProps<T>) {
  const theme = useThemeColorsOptional();
  const colors = {
    border: theme?.border ?? '#334155',
    headerBg: theme?.surface ?? '#1e293b',
    rowBg: theme?.bg ?? '#0f172a',
    rowAltBg: theme?.bgAlt ?? '#1e293b',
    headerText: theme?.text ?? '#e2e8f0',
    cellText: theme?.textSecondary ?? '#cbd5e1',
  };

  const border = borderless ? 0 : 1;
  const hasFlexibleColumns = columns.some(col => !col.width);

  return (
    <Box style={{
      alignSelf: hasFlexibleColumns ? undefined : 'flex-start',
      borderWidth: border,
      borderColor: colors.border,
      borderRadius: 6,
      overflow: 'hidden',
      ...style,
    }}>
      {/* Header row */}
      <Box style={{
        flexDirection: 'row',
        width: hasFlexibleColumns ? '100%' : undefined,
        backgroundColor: colors.headerBg,
        borderBottomWidth: border,
        borderColor: colors.border,
        ...headerStyle,
      }}>
        {columns.map((col, ci) => (
          <Box key={col.key} style={{
            width: col.width,
            flexGrow: col.width ? 0 : 1,
            flexShrink: 0,
            padding: 8,
            justifyContent: 'center',
            borderRightWidth: ci < columns.length - 1 ? border : 0,
            borderColor: colors.border,
            ...cellStyle,
          }}>
            <Text style={{ color: colors.headerText, fontSize: 11, fontWeight: 'bold', textAlign: alignToTextAlign(col.align), whiteSpace: 'nowrap' }}>
              {col.title}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {data.map((row, ri) => {
        const key = getRowKey(row, ri, rowKey);
        const bg = striped && ri % 2 === 1 ? colors.rowAltBg : colors.rowBg;

        return (
          <Box key={key} style={{
            flexDirection: 'row',
            width: hasFlexibleColumns ? '100%' : undefined,
            backgroundColor: bg,
            borderBottomWidth: ri < data.length - 1 ? border : 0,
            borderColor: colors.border,
            ...rowStyle,
          }}>
            {columns.map((col, ci) => {
              const value = row[col.key];
              const content = col.render
                ? col.render(value, row, ri)
                : <Text style={{ color: colors.cellText, fontSize: 11, width: '100%', textAlign: alignToTextAlign(col.align) }} numberOfLines={1}>{String(value ?? '')}</Text>;

              return (
                <Box key={col.key} style={{
                  width: col.width,
                  flexGrow: col.width ? 0 : 1,
                  flexShrink: col.width ? 0 : 1,
                  padding: 8,
                  justifyContent: 'center',
                  borderRightWidth: ci < columns.length - 1 ? border : 0,
                  borderColor: colors.border,
                  ...cellStyle,
                }}>
                  {content}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
