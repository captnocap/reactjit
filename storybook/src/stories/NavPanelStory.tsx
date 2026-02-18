import React, { useState } from 'react';
import { Box, Text, NavPanel } from '../../../packages/shared/src';
import type { NavSection } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

const SECTIONS: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'install', label: 'Installation' },
      { id: 'quickstart', label: 'Quick Start' },
    ],
  },
  {
    title: 'Components',
    items: [
      { id: 'buttons', label: 'Buttons' },
      { id: 'forms', label: 'Forms' },
      { id: 'modals', label: 'Modals' },
      { id: 'tables', label: 'Tables' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { id: 'theming', label: 'Theming' },
      { id: 'animation', label: 'Animation' },
      { id: 'perf', label: 'Performance' },
    ],
  },
];

export function NavPanelStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState('intro');

  return (
    <Box style={{ width: '100%', gap: 20, padding: 16 }}>

      {/* Basic NavPanel */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Basic NavPanel</Text>
        <NavPanel
          sections={SECTIONS}
          activeId="quickstart"
        />
      </Box>

      {/* With Header */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>With Header</Text>
        <NavPanel
          sections={SECTIONS}
          activeId="forms"
          header={
            <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold' }}>MY APP</Text>
          }
        />
      </Box>

      {/* Custom Widths */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Custom Widths</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <NavPanel
            sections={[SECTIONS[0]]}
            activeId="intro"
            width={140}
          />
          <NavPanel
            sections={[SECTIONS[0]]}
            activeId="install"
            width={220}
          />
        </Box>
      </Box>

      {/* Interactive */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Interactive</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <NavPanel
            sections={SECTIONS}
            activeId={activeId}
            onSelect={setActiveId}
            header={
              <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold' }}>DOCS</Text>
            }
          />
          <Box style={{
            width: 200,
            height: 100,
            backgroundColor: c.bgElevated,
            borderRadius: 8,
            padding: 12,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>Selected:</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{activeId}</Text>
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
