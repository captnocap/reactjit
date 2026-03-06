import React from 'react';
import { Box } from '@reactjit/core';
import { Section } from './Section';

export type LayoutMode = 'A' | 'AB' | 'ABC' | 'ABCD' | 'ABCDE' | 'ABCDEF' | 'ABCDEFG';
export type SectionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type PanelContent = Partial<Record<SectionId, string | React.ReactNode>>;

export const LAYOUTS: LayoutMode[] = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE', 'ABCDEF', 'ABCDEFG'];

const DEFAULT_LABELS: Record<SectionId, string> = {
  A: 'VESPER',
  B: 'MEMORY',
  C: 'SYSTEM',
  D: 'FLEET',
  E: 'GIT',
  F: 'DIFF',
  G: 'HISTORY',
};

interface Props {
  layout: LayoutMode;
  code: PanelContent;
  panelA: React.ReactNode;
  focusedPanel?: SectionId;
  onPanelPress?: (id: SectionId) => void;
  panelLabels?: Partial<Record<SectionId, string>>;
}

export function BentoLayout({ layout, code, panelA, focusedPanel, onPanelPress, panelLabels }: Props) {
  const labels = { ...DEFAULT_LABELS, ...panelLabels };

  const s = (id: SectionId) => {
    const label = labels[id];
    if (id === 'A') {
      return <Section id="A" focused={focusedPanel === 'A'} onPress={() => onPanelPress?.('A')} label={label}>{panelA}</Section>;
    }
    const content = code[id];
    if (typeof content === 'string') {
      return <Section id={id} code={content} focused={focusedPanel === id} onPress={() => onPanelPress?.(id)} label={label} />;
    }
    if (content) {
      return <Section id={id} focused={focusedPanel === id} onPress={() => onPanelPress?.(id)} label={label}>{content}</Section>;
    }
    return <Section id={id} focused={focusedPanel === id} onPress={() => onPanelPress?.(id)} label={label} />;
  };

  const row = (children: React.ReactNode) => (
    <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 4 }}>{children}</Box>
  );
  const col = (grow: number, children: React.ReactNode) => (
    <Box style={{ flexGrow: grow, flexDirection: 'column', gap: 4 }}>{children}</Box>
  );

  const content = (() => {
    switch (layout) {
      case 'A':
        return s('A');

      case 'AB':
        return row(<>{col(3, s('A'))}{col(1, s('B'))}</>);

      case 'ABC':
        return row(
          <>
            <Box style={{ flexGrow: 3 }}>{s('A')}</Box>
            <Box style={{ flexGrow: 2 }}>{s('B')}</Box>
            <Box style={{ flexGrow: 1 }}>{s('C')}</Box>
          </>
        );

      case 'ABCD':
        return row(
          <>
            {col(2, s('A'))}
            {col(3, <>{s('B')}{row(<>{s('C')}{s('D')}</>)}</>)}
          </>
        );

      case 'ABCDE':
        return (
          <>
            <Box style={{ flexGrow: 2, flexDirection: 'row', gap: 4 }}>
              <Box style={{ flexGrow: 3 }}>{s('A')}</Box>
              <Box style={{ flexGrow: 1 }}>{s('B')}</Box>
            </Box>
            {row(<>{s('C')}{s('D')}{s('E')}</>)}
          </>
        );

      case 'ABCDEF':
        return (
          <>
            <Box style={{ flexGrow: 2, flexDirection: 'row', gap: 4 }}>
              {col(2, s('A'))}
              {col(1, <>{s('B')}{s('C')}</>)}
            </Box>
            {row(<>{s('D')}{s('E')}<Box style={{ flexGrow: 2 }}>{s('F')}</Box></>)}
          </>
        );

      case 'ABCDEFG':
        return (
          <>
            <Box style={{ flexGrow: 3, flexDirection: 'row', gap: 4 }}>
              {col(3, s('A'))}
              {col(1, <>{s('B')}{s('C')}</>)}
            </Box>
            <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 4 }}>
              <Box style={{ flexGrow: 1 }}>{s('D')}</Box>
              <Box style={{ flexGrow: 1 }}>{s('E')}</Box>
              <Box style={{ flexGrow: 1 }}>{s('F')}</Box>
              <Box style={{ flexGrow: 1 }}>{s('G')}</Box>
            </Box>
          </>
        );
    }
  })();

  return (
    <Box style={{ flexGrow: 1, padding: 4, gap: 4, flexDirection: 'column' }}>
      {content}
    </Box>
  );
}
