import React, { useState } from 'react';
import { Box, Text, Toolbar } from '../../../../packages/shared/src';
import type { ToolbarEntry } from '../../../../packages/shared/src';

const BASIC_ITEMS: ToolbarEntry[] = [
  { type: 'item', id: 'new', label: 'New' },
  { type: 'item', id: 'open', label: 'Open' },
  { type: 'item', id: 'save', label: 'Save' },
  { type: 'item', id: 'export', label: 'Export' },
  { type: 'item', id: 'settings', label: 'Settings' },
];

const GROUPED_ITEMS: ToolbarEntry[] = [
  { type: 'item', id: 'undo', label: 'Undo' },
  { type: 'item', id: 'redo', label: 'Redo' },
  { type: 'divider' },
  { type: 'item', id: 'cut', label: 'Cut' },
  { type: 'item', id: 'copy', label: 'Copy' },
  { type: 'item', id: 'paste', label: 'Paste' },
  { type: 'divider' },
  { type: 'item', id: 'find', label: 'Find' },
  { type: 'item', id: 'replace', label: 'Replace' },
];

const DISABLED_ITEMS: ToolbarEntry[] = [
  { type: 'item', id: 'save', label: 'Save' },
  { type: 'item', id: 'undo', label: 'Undo', disabled: true },
  { type: 'item', id: 'redo', label: 'Redo', disabled: true },
  { type: 'divider' },
  { type: 'item', id: 'publish', label: 'Publish' },
  { type: 'item', id: 'delete', label: 'Delete', disabled: true },
];

export function ToolbarStory() {
  const [lastAction, setLastAction] = useState('(none)');

  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Basic Toolbar */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Basic Toolbar</Text>
        <Box style={{ width: 360 }}>
          <Toolbar items={BASIC_ITEMS} />
        </Box>
      </Box>

      {/* With Dividers */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>With Dividers</Text>
        <Box style={{ width: 420 }}>
          <Toolbar items={GROUPED_ITEMS} />
        </Box>
      </Box>

      {/* Disabled Items */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Disabled Items</Text>
        <Box style={{ width: 360 }}>
          <Toolbar items={DISABLED_ITEMS} />
        </Box>
      </Box>

      {/* Interactive */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Interactive</Text>
        <Box style={{ width: 420, gap: 8 }}>
          <Toolbar items={GROUPED_ITEMS} onSelect={setLastAction} />
          <Box style={{
            backgroundColor: '#1e293b',
            borderRadius: 6,
            padding: 8,
            flexDirection: 'row',
            width: 420,
            gap: 6,
          }}>
            <Text style={{ color: '#64748b', fontSize: 10 }}>Last action:</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 10, fontWeight: 'bold' }}>{lastAction}</Text>
          </Box>
        </Box>
      </Box>

    </Box>
  );
}
