import React, { useMemo, useState } from 'react';
import {
  Box,
  Text,
  NavPanel,
  Tabs,
  Breadcrumbs,
  Toolbar,
  ScrollView,
  type BreadcrumbItem,
} from '../../../packages/shared/src';
import type { NavSection, Tab, ToolbarEntry } from '../../../packages/shared/src';
import { useThemeColors } from '../../../packages/theme/src';

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
    <Box
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        alignItems: 'center',
      }}
    >
      <ScrollView style={{ width: '100%', flexGrow: 1 }}>
        <Box style={{ width: '100%', alignItems: 'center', paddingBottom: 8 }}>
          <Box style={{ width: '100%', maxWidth: 780, gap: 14, alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>
              1. Unified navigation story
            </Text>

            <Box
              style={{
                width: '100%',
                backgroundColor: c.bgElevated,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border,
                padding: 12,
                gap: 10,
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
                NavPanel, Toolbar, Breadcrumbs, and Tabs in one centered layout
              </Text>

              <Box style={{ width: '100%', maxWidth: 620 }}>
                <Toolbar
                  items={TOOLBAR_ITEMS}
                  onSelect={setLastAction}
                  style={{ justifyContent: 'center' }}
                />
              </Box>

              <Box style={{ width: '100%', maxWidth: 620 }}>
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

              <Box style={{ width: '100%', maxWidth: 520 }}>
                <Tabs
                  tabs={TAB_ITEMS}
                  activeId={activeTab}
                  onSelect={setActiveTab}
                  variant="pill"
                  style={{ justifyContent: 'center', flexWrap: 'wrap' }}
                />
              </Box>

              <Box
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  gap: 10,
                }}
              >
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

                <Box
                  style={{
                    width: 360,
                    minHeight: 220,
                    backgroundColor: c.bgAlt,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: c.border,
                    padding: 14,
                    gap: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                    {PAGE_LABELS[activePage] ?? 'Home'}
                  </Text>
                  <Text style={{ color: c.textSecondary, fontSize: 11, textAlign: 'center' }}>
                    {TAB_DESCRIPTIONS[activeTab] ?? TAB_DESCRIPTIONS.overview}
                  </Text>
                  <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
                    {`Last action: ${lastAction}`}
                  </Text>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}
