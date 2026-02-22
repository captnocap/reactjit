import React, { useMemo, useState } from 'react';
import {
  Box,
  Text,
  NavPanel,
  Tabs,
  Breadcrumbs,
  Toolbar,
  Pressable,
  type BreadcrumbItem,
} from '../../../packages/core/src';
import type { NavSection, Tab, ToolbarEntry } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, color: c.muted }}>{title.toUpperCase()}</Text>
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        padding: 12,
        gap: 8,
        alignItems: 'center',
      }}>
        {children}
      </Box>
    </Box>
  );
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { id: 'home', label: 'Home' },
      { id: 'library', label: 'Library' },
      { id: 'favorites', label: 'Favorites' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'settings', label: 'Settings' },
    ],
  },
];

const TAB_ITEMS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'insights', label: 'Insights' },
];

const TOOLBAR_ITEMS: ToolbarEntry[] = [
  { type: 'item', id: 'refresh', label: 'Refresh' },
  { type: 'item', id: 'share', label: 'Share' },
  { type: 'divider' },
  { type: 'item', id: 'search', label: 'Search' },
  { type: 'item', id: 'help', label: 'Help' },
];

const PAGE_LABELS: Record<string, string> = {
  home: 'Home',
  library: 'Library',
  favorites: 'Favorites',
  profile: 'Profile',
  settings: 'Settings',
};

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  home: [{ id: 'home', label: 'Home' }],
  library: [{ id: 'home', label: 'Home' }, { id: 'library', label: 'Library' }],
  favorites: [{ id: 'home', label: 'Home' }, { id: 'favorites', label: 'Favorites' }],
  profile: [{ id: 'home', label: 'Home' }, { id: 'profile', label: 'Profile' }],
  settings: [{ id: 'home', label: 'Home' }, { id: 'settings', label: 'Settings' }],
};

const TAB_DESCRIPTIONS: Record<string, string> = {
  overview: 'High-level snapshot and quick actions.',
  activity: 'Recent updates and timeline signals.',
  insights: 'Performance trends and usage patterns.',
};

export function NavigationStory() {
  const c = useThemeColors();
  const [activePage, setActivePage] = useState('home');
  const [activeTab, setActiveTab] = useState('overview');
  const [lastAction, setLastAction] = useState('(none)');

  const breadcrumbs = useMemo(
    () => BREADCRUMB_MAP[activePage] ?? BREADCRUMB_MAP.home,
    [activePage],
  );

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, alignItems: 'center', overflow: 'scroll' }}>
      <Box style={{ width: '100%', maxWidth: 760, gap: 14, alignItems: 'center' }}>

        {/* 1. NavPanel */}
        <Section title="1. NavPanel">
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            Grouped sidebar navigation with sections, active-item highlighting, and custom header.
          </Text>
          <Box style={{ width: '100%', alignItems: 'center' }}>
            <NavPanel
              sections={NAV_SECTIONS}
              activeId={activePage}
              onSelect={(id) => {
                setActivePage(id);
                setActiveTab('overview');
              }}
              header={
                <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
                  NAVIGATION
                </Text>
              }
              width={280}
              contentAlign="center"
              style={{ borderRadius: 10 }}
            />
          </Box>
          <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
            {`Active page: ${PAGE_LABELS[activePage] ?? 'Home'}`}
          </Text>
        </Section>

        {/* 2. Tabs */}
        <Section title="2. Tabs">
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            Pill-style tab bar for switching views within a page.
          </Text>
          <Box style={{ width: '100%', maxWidth: 420 }}>
            <Tabs
              tabs={TAB_ITEMS}
              activeId={activeTab}
              onSelect={setActiveTab}
              variant="pill"
              style={{ justifyContent: 'center', flexWrap: 'wrap' }}
            />
          </Box>
          <Box style={{
            width: '100%',
            backgroundColor: c.surface,
            borderRadius: 8,
            padding: 12,
            alignItems: 'center',
            gap: 4,
          }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
              {TAB_DESCRIPTIONS[activeTab] ?? TAB_DESCRIPTIONS.overview}
            </Text>
          </Box>
        </Section>

        {/* 3. Breadcrumbs */}
        <Section title="3. Breadcrumbs">
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            Path trail reflecting the current navigation depth. Click a crumb to jump back.
          </Text>
          <Box style={{ width: '100%', maxWidth: 520 }}>
            <Breadcrumbs
              items={breadcrumbs}
              separator=">"
              onSelect={(id) => {
                if (BREADCRUMB_MAP[id]) {
                  setActivePage(id);
                }
              }}
              style={{ justifyContent: 'center', flexWrap: 'wrap' }}
            />
          </Box>
          <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
            Navigate to a deeper page via NavPanel above to see multi-level breadcrumbs.
          </Text>
        </Section>

        {/* 4. Toolbar */}
        <Section title="4. Toolbar">
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            Horizontal action bar with items and dividers. Reports selection via callback.
          </Text>
          <Box style={{ width: '100%', maxWidth: 520 }}>
            <Toolbar
              items={TOOLBAR_ITEMS}
              onSelect={setLastAction}
              style={{ justifyContent: 'center' }}
            />
          </Box>
          <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
            {`Last action: ${lastAction}`}
          </Text>
        </Section>

        {/* 5. Combined */}
        <Section title="5. Combined Layout">
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            All four navigation components working together. Select a page, switch tabs, and trigger toolbar actions.
          </Text>
          <Box style={{
            width: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'stretch',
            gap: 10,
          }}>
            <NavPanel
              sections={NAV_SECTIONS}
              activeId={activePage}
              onSelect={(id) => {
                setActivePage(id);
                setActiveTab('overview');
              }}
              header={
                <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
                  NAVIGATION
                </Text>
              }
              width={220}
              contentAlign="center"
              style={{ height: 220, borderRadius: 10 }}
            />

            <Box style={{
              width: 360,
              minHeight: 220,
              backgroundColor: c.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 14,
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                {PAGE_LABELS[activePage] ?? 'Home'}
              </Text>
              <Box style={{ width: '100%', maxWidth: 320 }}>
                <Tabs
                  tabs={TAB_ITEMS}
                  activeId={activeTab}
                  onSelect={setActiveTab}
                  variant="pill"
                  style={{ justifyContent: 'center', flexWrap: 'wrap' }}
                />
              </Box>
              <Text style={{ color: c.textSecondary, fontSize: 11, textAlign: 'center' }}>
                {TAB_DESCRIPTIONS[activeTab] ?? TAB_DESCRIPTIONS.overview}
              </Text>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
                {`Last action: ${lastAction}`}
              </Text>
            </Box>
          </Box>
        </Section>

      </Box>
    </Box>
  );
}
