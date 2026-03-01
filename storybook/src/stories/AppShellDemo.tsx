import React, { useState } from 'react';
import { Box, Text, NavPanel, Tabs, Breadcrumbs, Toolbar, Divider } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import type { NavSection, Tab, BreadcrumbItem, ToolbarEntry } from '../../../packages/core/src';

/* ── Data ─────────────────────────────────────────────────── */

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'projects', label: 'Projects' },
      { id: 'team', label: 'Team' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'billing', label: 'Billing' },
      { id: 'api-keys', label: 'API Keys' },
    ],
  },
  {
    title: 'Help',
    items: [
      { id: 'docs', label: 'Documentation' },
      { id: 'support', label: 'Support' },
    ],
  },
];

const TOOLBAR_ITEMS: ToolbarEntry[] = [
  { type: 'item', id: 'new', label: 'New' },
  { type: 'item', id: 'import', label: 'Import' },
  { type: 'divider' },
  { type: 'item', id: 'refresh', label: 'Refresh' },
  { type: 'divider' },
  { type: 'item', id: 'help', label: 'Help' },
];

const CONTENT_TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
];

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  dashboard: [{ id: 'home', label: 'Home' }, { id: 'dashboard', label: 'Dashboard' }],
  projects: [{ id: 'home', label: 'Home' }, { id: 'projects', label: 'Projects' }],
  team: [{ id: 'home', label: 'Home' }, { id: 'team', label: 'Team' }],
  profile: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'profile', label: 'Profile' }],
  billing: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'billing', label: 'Billing' }],
  'api-keys': [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'api-keys', label: 'API Keys' }],
  docs: [{ id: 'home', label: 'Home' }, { id: 'help-root', label: 'Help' }, { id: 'docs', label: 'Documentation' }],
  support: [{ id: 'home', label: 'Home' }, { id: 'help-root', label: 'Help' }, { id: 'support', label: 'Support' }],
};

/* ── Colors ────────────────────────────────────────────────── */

/* ── Demo ──────────────────────────────────────────────────── */

export function AppShellDemoStory() {
  const c = useThemeColors();
  const [activePage, setActivePage] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('overview');
  const [lastAction, setLastAction] = useState('(none)');

  const breadcrumbs = BREADCRUMB_MAP[activePage] ?? [{ id: 'home', label: 'Home' }];

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: c.bg }}>

      {/* Sidebar */}
      <NavPanel
        sections={NAV_SECTIONS}
        activeId={activePage}
        onSelect={(id) => {
          setActivePage(id);
          setActiveTab('overview');
        }}
        header={
          <Text style={{ color: c.textDim, fontSize: 10, fontWeight: 'normal' }}>ACME APP</Text>
        }
      />

      {/* Main content area */}
      <Box style={{ flexGrow: 1, gap: 0 }}>

        {/* Toolbar */}
        <Box style={{ padding: 8 }}>
          <Toolbar items={TOOLBAR_ITEMS} onSelect={setLastAction} />
        </Box>

        {/* Breadcrumbs */}
        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
          <Breadcrumbs items={breadcrumbs} separator=">" />
        </Box>

        <Divider color={c.border} />

        {/* Tabs */}
        <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4 }}>
          <Tabs tabs={CONTENT_TABS} activeId={activeTab} onSelect={setActiveTab} />
        </Box>

        {/* Content */}
        <Box style={{ flexGrow: 1, padding: 16, gap: 12 }}>
          {/* Page title */}
          <Text style={{ color: c.text, fontSize: 16, fontWeight: 'normal' }}>
            {breadcrumbs[breadcrumbs.length - 1].label}
          </Text>
          <Text style={{ color: c.textDim, fontSize: 11 }}>
            {`Viewing: ${activeTab} tab`}
          </Text>

          {/* Content card */}
          <Box style={{
            backgroundColor: c.bgElevated,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            padding: 16,
            gap: 8,
            flexGrow: 1,
          }}>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: 'normal' }}>
              {`${breadcrumbs[breadcrumbs.length - 1].label} - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            </Text>
            <Box style={{ height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.textDim, fontSize: 11 }}>
              This area would contain the page content. All four navigation components are working together:
            </Text>
            <Box style={{ gap: 4, paddingLeft: 8 }}>
              <Text style={{ color: c.textDim, fontSize: 10 }}>- NavPanel controls the page</Text>
              <Text style={{ color: c.textDim, fontSize: 10 }}>- Toolbar triggers actions</Text>
              <Text style={{ color: c.textDim, fontSize: 10 }}>- Breadcrumbs show location</Text>
              <Text style={{ color: c.textDim, fontSize: 10 }}>- Tabs switch content views</Text>
            </Box>
            <Box style={{ flexGrow: 1 }} />
            <Box style={{
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.textDim, fontSize: 10 }}>
                {`Last toolbar action: ${lastAction}`}
              </Text>
              <Text style={{ color: c.textDim, fontSize: 10 }}>
                {`Page: ${activePage} | Tab: ${activeTab}`}
              </Text>
            </Box>
          </Box>
        </Box>

      </Box>
    </Box>
  );
}
