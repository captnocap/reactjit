import React from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';

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

const BORDER_COLOR = '#334155';
const HEADER_BG = '#1e293b';
const ROW_BG = '#0f172a';
const ROW_ALT_BG = '#1e293b';
const HEADER_TEXT = '#e2e8f0';
const CELL_TEXT = '#cbd5e1';

function alignToJustify(align?: 'left' | 'center' | 'right'): 'start' | 'center' | 'end' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'end';
  return 'start';
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
  const border = borderless ? 0 : 1;

  return (
    <Box style={{
      borderWidth: border,
      borderColor: BORDER_COLOR,
      borderRadius: 6,
      overflow: 'hidden',
      ...style,
    }}>
      {/* Header row */}
      <Box style={{
        flexDirection: 'row',
        width: '100%',
        backgroundColor: HEADER_BG,
        borderBottomWidth: border,
        borderColor: BORDER_COLOR,
        ...headerStyle,
      }}>
        {columns.map((col, ci) => (
          <Box key={col.key} style={{
            width: col.width,
            flexGrow: col.width ? 0 : 1,
            flexShrink: col.width ? 0 : 1,
            padding: 8,
            justifyContent: 'center',
            alignItems: alignToJustify(col.align),
            borderRightWidth: ci < columns.length - 1 ? border : 0,
            borderColor: BORDER_COLOR,
            ...cellStyle,
          }}>
            <Text style={{ color: HEADER_TEXT, fontSize: 11, fontWeight: 'bold' }}>
              {col.title}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {data.map((row, ri) => {
        const key = getRowKey(row, ri, rowKey);
        const bg = striped && ri % 2 === 1 ? ROW_ALT_BG : ROW_BG;

        return (
          <Box key={key} style={{
            flexDirection: 'row',
            width: '100%',
            backgroundColor: bg,
            borderBottomWidth: ri < data.length - 1 ? border : 0,
            borderColor: BORDER_COLOR,
            ...rowStyle,
          }}>
            {columns.map((col, ci) => {
              const value = row[col.key];
              const content = col.render
                ? col.render(value, row, ri)
                : <Text style={{ color: CELL_TEXT, fontSize: 11 }} numberOfLines={1}>{String(value ?? '')}</Text>;

              return (
                <Box key={col.key} style={{
                  width: col.width,
                  flexGrow: col.width ? 0 : 1,
                  flexShrink: col.width ? 0 : 1,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: alignToJustify(col.align),
                  borderRightWidth: ci < columns.length - 1 ? border : 0,
                  borderColor: BORDER_COLOR,
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
