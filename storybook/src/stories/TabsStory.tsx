import React, { useState } from 'react';
import { Box, Text, Tabs } from '../../../../packages/shared/src';
import type { Tab } from '../../../../packages/shared/src';

const BASIC_TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'docs', label: 'Docs' },
];

const MANY_TABS: Tab[] = [
  { id: 'all', label: 'All' },
  { id: 'design', label: 'Design' },
  { id: 'dev', label: 'Development' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sales', label: 'Sales' },
  { id: 'support', label: 'Support' },
  { id: 'ops', label: 'Operations' },
];

const TAB_CONTENT: Record<string, string> = {
  overview: 'Welcome to the product overview. This is the main landing area.',
  features: 'Feature list: Fast rendering, cross-platform, React-based.',
  pricing: 'Free tier available. Pro starts at $9/mo.',
  docs: 'Full documentation available at docs.example.com.',
};

export function TabsStory() {
  const [activeUnderline, setActiveUnderline] = useState('overview');
  const [activePill, setActivePill] = useState('overview');
  const [activeInteractive, setActiveInteractive] = useState('overview');
  const [activeMany, setActiveMany] = useState('all');

  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Underline Tabs */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Underline Tabs</Text>
        <Box style={{ width: 360 }}>
          <Tabs tabs={BASIC_TABS} activeId={activeUnderline} onSelect={setActiveUnderline} />
        </Box>
      </Box>

      {/* Pill Tabs */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Pill Tabs</Text>
        <Box style={{ width: 360 }}>
          <Tabs tabs={BASIC_TABS} activeId={activePill} onSelect={setActivePill} variant="pill" />
        </Box>
      </Box>

      {/* Interactive with Content */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Interactive</Text>
        <Box style={{ width: 360, gap: 0 }}>
          <Tabs tabs={BASIC_TABS} activeId={activeInteractive} onSelect={setActiveInteractive} />
          <Box style={{
            padding: 12,
            backgroundColor: '#1e293b',
            borderRadius: 0,
            borderBottomLeftRadius: 6,
            borderBottomRightRadius: 6,
          }}>
            <Text style={{ color: '#cbd5e1', fontSize: 11 }}>
              {TAB_CONTENT[activeInteractive] ?? 'Select a tab'}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Many Tabs */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Many Tabs</Text>
        <Box style={{ width: 480 }}>
          <Tabs tabs={MANY_TABS} activeId={activeMany} onSelect={setActiveMany} variant="pill" />
        </Box>
      </Box>

    </Box>
  );
}
