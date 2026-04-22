import { useMemo } from 'react';
import { Box, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS } from '../../theme';
import { PaletteCommand, GroupedCategory } from './types';
import { PaletteRow } from './PaletteRow';
import { groupByCategory } from './useFuzzyFilter';

interface Props {
  filtered: PaletteCommand[];
  selectedIndex: number;
  isGotoFileMode: boolean;
  isShellMode: boolean;
  isEmptyQuery: boolean;
  onRun: (cmd: PaletteCommand) => void;
}

export function PaletteGroups({
  filtered,
  selectedIndex,
  isGotoFileMode,
  isShellMode,
  isEmptyQuery,
  onRun,
}: Props) {
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  if (filtered.length === 0) {
    return (
      <Box style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
          {isShellMode
            ? 'Type a command to run'
            : isGotoFileMode
            ? 'No matching files'
            : 'No matching commands'}
        </Text>
      </Box>
    );
  }

  let itemIdx = 0;

  return (
    <ScrollView showScrollbar={true} style={{ flexGrow: 1 }}>
      {grouped.map((group, groupIdx) => {
        const rows: any[] = [];
        rows.push(
          <Box
            key={'hdr:' + group.category + ':' + groupIdx}
            style={{
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 4,
              backgroundColor: 'transparent',
            }}
          >
            <Text style={{ fontSize: 9, color: COLORS.textDim, fontWeight: 'bold', textTransform: 'uppercase' }}>
              {group.category}
            </Text>
          </Box>
        );
        for (const cmd of group.items) {
          const idx = itemIdx;
          const isSel = idx === selectedIndex;
          itemIdx++;
          rows.push(
            <PaletteRow
              key={cmd.id}
              cmd={cmd}
              isSelected={isSel}
              isGotoFileMode={isGotoFileMode}
              isShellMode={isShellMode}
              onRun={() => onRun(cmd)}
            />
          );
        }
        return rows;
      })}
    </ScrollView>
  );
}
