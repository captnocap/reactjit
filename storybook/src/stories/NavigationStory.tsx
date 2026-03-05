/**
 * Navigation — Navigation & Search component suite documentation page.
 *
 * Covers: NavPanel, Tabs, Breadcrumbs, Toolbar (structural navigation)
 *         SearchBar, SearchResults, SearchCombo, CommandPalette,
 *         useFuzzySearch, useSearchHighlight, useSearchHistory, AppSearch
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Text,
  Image,
  TextEditor,
  CodeBlock,
  Pressable,
  ScrollView,
  NavPanel,
  Tabs,
  Breadcrumbs,
  Toolbar,
  SearchBar,
  SearchResults,
  SearchResultsSections,
  SearchCombo,
  CommandPalette,
  SearchSchemaHint,
  AppSearch,
  Searchable,
  useSearch,
  useFuzzySearch,
  useSearchHighlight,
  useSearchHistory,
  useSearchSchema,
  detectSearchableFields,
  useAppSearch,
  useHotkey,
  type BreadcrumbItem,
} from '../../../packages/core/src';
import type { NavSection, Tab, ToolbarEntry, SearchResultItem, CommandDef } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors ─────────────────────────────────────────────────────────────

const SYN = {
  tag: '#f38ba8',
  component: '#89b4fa',
  prop: '#cba6f7',
  value: '#f9e2af',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function styleTooltip(style: Record<string, any>) {
  const STRUCTURAL = new Set([
    'flexGrow', 'flexShrink', 'flexBasis', 'flexDirection', 'flexWrap',
    'alignItems', 'alignSelf', 'justifyContent', 'overflow',
    'position', 'zIndex', 'display',
  ]);
  const entries = Object.entries(style).filter(([k, v]) => !STRUCTURAL.has(k) && v !== undefined);
  if (entries.length === 0) return undefined;
  const content = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { content, layout: 'table', type: 'cursor' };
}

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

function SectionLabel({ label }: { label: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{label}</Text>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

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
  { type: 'item', id: 'search', label: 'Search' },
  { type: 'item', id: 'help', label: 'Help' },
];

const PAGE_LABELS: Record<string, string> = {
  home: 'Home', library: 'Library', favorites: 'Favorites',
  profile: 'Profile', settings: 'Settings',
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

interface FileItem extends SearchResultItem {
  path: string;
  type: 'file' | 'dir';
}

const FILES: FileItem[] = [
  { id: 1, label: 'main.lua', description: 'Entry point', meta: 'Lua', path: 'src/main.lua', type: 'file' },
  { id: 2, label: 'init.lua', description: 'Framework init', meta: 'Lua', path: 'lua/init.lua', type: 'file' },
  { id: 3, label: 'layout.lua', description: 'Flex layout engine', meta: 'Lua', path: 'lua/layout.lua', type: 'file' },
  { id: 4, label: 'App.tsx', description: 'React root', meta: 'TSX', path: 'src/App.tsx', type: 'file' },
  { id: 5, label: 'primitives.tsx', description: 'Box, Text, Image', meta: 'TSX', path: 'packages/core/src/primitives.tsx', type: 'file' },
  { id: 6, label: 'TextInput.tsx', description: 'Lua-owned text input', meta: 'TSX', path: 'packages/core/src/TextInput.tsx', type: 'file' },
  { id: 7, label: 'hooks.ts', description: 'useLove, useHotkey…', meta: 'TS', path: 'packages/core/src/hooks.ts', type: 'file' },
  { id: 8, label: 'capabilities.lua', description: 'Capability registry', meta: 'Lua', path: 'lua/capabilities.lua', type: 'file' },
  { id: 9, label: 'window_manager.lua', description: 'Multi-window', meta: 'Lua', path: 'lua/window_manager.lua', type: 'file' },
  { id: 10, label: 'eventDispatcher.ts', description: 'Bridge event routing', meta: 'TS', path: 'packages/renderer/src/eventDispatcher.ts', type: 'file' },
];

const COMMANDS: CommandDef[] = [
  { id: 'new-file', label: 'New File', group: 'File', shortcut: 'ctrl+n', action: () => {} },
  { id: 'open-file', label: 'Open File...', group: 'File', shortcut: 'ctrl+o', action: () => {} },
  { id: 'save', label: 'Save', group: 'File', shortcut: 'ctrl+s', action: () => {} },
  { id: 'build', label: 'Build Project', group: 'Build', shortcut: 'ctrl+b', keywords: ['compile', 'rjit'], action: () => {} },
  { id: 'lint', label: 'Run Linter', group: 'Build', keywords: ['check', 'errors'], action: () => {} },
  { id: 'inspector', label: 'Toggle Inspector', group: 'Dev', shortcut: 'F12', keywords: ['debug', 'devtools'], action: () => {} },
  { id: 'reload', label: 'Reload Bundle', group: 'Dev', shortcut: 'F5', keywords: ['hmr', 'refresh'], action: () => {} },
  { id: 'theme', label: 'Switch Theme', group: 'Appearance', keywords: ['colors', 'dark', 'light'], action: () => {} },
  { id: 'quit', label: 'Quit', group: 'App', shortcut: 'ctrl+q', action: () => {} },
];

const OPAQUE_DATA = [
  { id: 'u1', name: 'Alice Nakamura', email: 'alice@example.com', role: 'Engineer', department: 'Platform', joined: 2021, avatar: 'x' },
  { id: 'u2', name: 'Bob Chen', email: 'bob@example.com', role: 'Designer', department: 'Product', joined: 2022, avatar: 'x' },
  { id: 'u3', name: 'Cleo Okafor', email: 'cleo@example.com', role: 'Manager', department: 'Platform', joined: 2019, avatar: 'x' },
  { id: 'u4', name: 'Diego Flores', email: 'diego@example.com', role: 'Engineer', department: 'Data', joined: 2023, avatar: 'x' },
];

// ── Static doc data ───────────────────────────────────────────────────────────

const USAGE_CODE = `// Sidebar navigation
const [page, setPage] = useState('home');
<NavPanel
  sections={[{ title: 'App', items: [{ id: 'home', label: 'Home' }] }]}
  activeId={page}
  onSelect={setPage}
/>

// Tab bar
<Tabs
  tabs={[{ id: 'a', label: 'Overview' }, { id: 'b', label: 'Activity' }]}
  activeId={tab}
  onSelect={setTab}
  variant="pill"
/>

// Breadcrumb trail
<Breadcrumbs
  items={[{ id: 'home', label: 'Home' }, { id: 'docs', label: 'Docs' }]}
  separator=">"
  onSelect={setPage}
/>

// Search combo (input + dropdown)
<SearchCombo
  items={files}
  searchKey="label"
  onSelect={handleSelect}
  placeholder="Search..."
/>

// Command palette (modal launcher)
<CommandPalette
  visible={open}
  commands={cmds}
  onClose={() => setOpen(false)}
/>`;

const STARTER_CODE = `<Box style={{ padding: 16, gap: 10, backgroundColor: '#1e1e2e', borderRadius: 8 }}>
  <Text style={{ color: '#cdd6f4', fontSize: 14, fontWeight: 'bold' }}>
    Navigation
  </Text>
  <Text style={{ color: '#6c7086', fontSize: 11 }}>
    NavPanel · Tabs · Breadcrumbs · SearchBar
  </Text>
</Box>`;

const PROPS: [string, string, string][] = [
  ['sections', 'NavSection[]', 'layers'],
  ['tabs', 'Tab[]', 'list'],
  ['items', 'BreadcrumbItem[] | ToolbarEntry[]', 'git-branch'],
  ['activeId', 'string', 'hash'],
  ['variant', "'pill' | 'underline'", 'sliders'],
  ['header', 'ReactNode', 'layout'],
  ['commands', 'CommandDef[]', 'terminal'],
  ['visible', 'boolean', 'eye'],
  ['placeholder', 'string', 'edit'],
  ['searchKey', 'string', 'search'],
  ['showSchema', 'boolean', 'info'],
  ['style', 'ViewStyle', 'layout'],
];

const CALLBACKS: [string, string, string][] = [
  ['onSelect (nav)', '(id: string) => void', 'pointer'],
  ['onSelect (search)', '(item: SearchResultItem) => void', 'search'],
  ['onSearch', '(query: string) => void', 'search'],
  ['onSubmit', '(query: string) => void', 'send'],
  ['onClose', '() => void', 'x'],
];

const BEHAVIOR_NOTES = [
  'All nav components are controlled (activeId + onSelect)',
  'ReactJIT is not a DOM/browser runtime, but internal routing behaves like a traditional app router',
  'SearchBar debounces 300ms; onSubmit fires on Enter',
  'CommandPalette / AppSearch are modal overlays (Esc closes)',
  'useFuzzySearch scores by relevance; useSearchHighlight marks matches',
];

// ── Demo sub-components ───────────────────────────────────────────────────────

function NavPanelDemo() {
  const c = useThemeColors();
  const [activePage, setActivePage] = useState('home');
  const containerStyle = { backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 12 };

  return (
    <Box style={{ gap: 10 }}>
      <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch' }}>
        <NavPanel
          sections={NAV_SECTIONS}
          activeId={activePage}
          onSelect={setActivePage}
          header={
            <Box style={{ width: '100%', gap: 2 }}>
              <Text style={{ color: c.text, fontSize: 11, fontWeight: 'bold' }}>Studio</Text>
              <Text style={{ color: c.textDim, fontSize: 9 }}>Navigation</Text>
            </Box>
          }
          width={210}
          style={{ height: 200, borderRadius: 10 }}
        />
        <Box style={{ flexGrow: 1, minHeight: 200, ...containerStyle, gap: 8, alignItems: 'center', justifyContent: 'center' }} tooltip={styleTooltip(containerStyle)}>
          <Text style={{ color: c.text, fontSize: 13 }}>{PAGE_LABELS[activePage] ?? 'Home'}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
            Select a route from the sidebar.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function TabsDemo() {
  const c = useThemeColors();
  const [activeTab, setActiveTab] = useState('overview');
  const containerStyle = { backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 12 };

  return (
    <Box style={{ width: '100%' }}>
      <Box style={{ width: '100%', ...containerStyle, gap: 8 }} tooltip={styleTooltip(containerStyle)}>
        <Tabs
          tabs={TAB_ITEMS}
          activeId={activeTab}
          onSelect={setActiveTab}
          variant="pill"
          style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
        />
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>
          {TAB_DESCRIPTIONS[activeTab] ?? TAB_DESCRIPTIONS.overview}
        </Text>
      </Box>
    </Box>
  );
}

function BreadcrumbsDemo() {
  const c = useThemeColors();
  const [activePage, setActivePage] = useState('settings');
  const breadcrumbs = useMemo(
    () => BREADCRUMB_MAP[activePage] ?? BREADCRUMB_MAP.home,
    [activePage],
  );
  const containerStyle = { backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 12 };

  return (
    <Box style={{ width: '100%' }}>
      <Box style={{ width: '100%', ...containerStyle, gap: 8 }} tooltip={styleTooltip(containerStyle)}>
        <Breadcrumbs
          items={breadcrumbs}
          separator=">"
          onSelect={(id) => { if (BREADCRUMB_MAP[id]) setActivePage(id); }}
          style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}
        />
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(PAGE_LABELS).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setActivePage(id)}
              style={(state) => ({
                borderRadius: 5,
                borderWidth: 1,
                borderColor: activePage === id ? c.primary : c.border,
                backgroundColor: activePage === id ? c.primary : (state.hovered ? c.surfaceHover : c.bgElevated),
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
              })}
            >
              <Text style={{ color: activePage === id ? c.text : c.textSecondary, fontSize: 9 }}>{label}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function ToolbarDemo() {
  const c = useThemeColors();
  const [lastAction, setLastAction] = useState('(none)');
  return (
    <Box style={{ gap: 6 }}>
      <Toolbar items={TOOLBAR_ITEMS} onSelect={setLastAction} style={{ justifyContent: 'space-between' }} />
      <Text style={{ color: c.textDim, fontSize: 10 }}>{`Last action: ${lastAction}`}</Text>
    </Box>
  );
}

function SearchBarDemo() {
  const c = useThemeColors();
  const [barQuery, setBarQuery] = useState('');
  const [barSubmit, setBarSubmit] = useState('');
  return (
    <Box style={{ gap: 6 }}>
      <SearchBar
        onSearch={setBarQuery}
        onSubmit={setBarSubmit}
        placeholder="Search files..."
        style={{ width: '100%' }}
        accentColor={c.primary}
        backgroundColor={c.surface}
        color={c.text}
        borderColor={c.border}
      />
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>{`query: "${barQuery}"`}</Text>
        {barSubmit ? <Text style={{ color: c.success, fontSize: 11 }}>{`submitted: "${barSubmit}"`}</Text> : null}
      </Box>
    </Box>
  );
}

function SearchResultsDemo() {
  const c = useThemeColors();
  const [flatQuery, setFlatQuery] = useState('');
  const [flatSelected, setFlatSelected] = useState('');
  const [flatOpen, setFlatOpen] = useState(false);
  const flatResults = useSearch(FILES, flatQuery, { key: 'label', showAllOnEmpty: false, limit: 6 });
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>SearchBar + flat SearchResults dropdown:</Text>
      <Box style={{ width: '100%', position: 'relative' }}>
        <SearchBar
          onSearch={(q) => { setFlatQuery(q); setFlatOpen(q.trim().length > 0); }}
          placeholder="Filter files..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {flatOpen && flatQuery.trim().length > 0 ? (
          <Box
            style={{ width: '100%', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40 }}
            onPointerEnter={() => setFlatOpen(true)}
            onPointerLeave={() => setFlatOpen(false)}
          >
            <SearchResults
              items={flatResults}
              activeIndex={-1}
              onSelect={(item) => { setFlatSelected(item.label); setFlatOpen(false); }}
              style={{ width: '100%' }}
              activeColor={c.primary}
              textColor={c.text}
              mutedColor={c.textSecondary}
              backgroundColor={c.bgElevated}
              borderColor={c.border}
            />
          </Box>
        ) : null}
      </Box>
      {flatSelected ? <Text style={{ color: c.success, fontSize: 11 }}>{`Selected: ${flatSelected}`}</Text> : null}
    </Box>
  );
}

function SearchSectionsDemo() {
  const c = useThemeColors();
  const [sectQuery, setSectQuery] = useState('');
  const [sectSelected, setSectSelected] = useState('');
  const [sectOpen, setSectOpen] = useState(false);
  const luaFiles = useSearch(FILES.filter(f => f.meta === 'Lua'), sectQuery, { key: 'label', showAllOnEmpty: false });
  const tsFiles = useSearch(FILES.filter(f => f.meta !== 'Lua'), sectQuery, { key: 'label', showAllOnEmpty: false });
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>SearchResultsSections — grouped by file type:</Text>
      <Box style={{ width: '100%', position: 'relative' }}>
        <SearchBar
          onSearch={(q) => { setSectQuery(q); setSectOpen(q.trim().length > 0); }}
          placeholder="Filter by language..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {sectOpen && sectQuery.trim().length > 0 ? (
          <Box
            style={{ width: '100%', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40 }}
            onPointerEnter={() => setSectOpen(true)}
            onPointerLeave={() => setSectOpen(false)}
          >
            <SearchResultsSections
              sections={[
                { title: 'Lua', items: luaFiles },
                { title: 'TypeScript', items: tsFiles },
              ]}
              activeIndex={-1}
              onSelect={(item) => { setSectSelected(item.label); setSectOpen(false); }}
              style={{ width: '100%' }}
              activeColor={c.primary}
              textColor={c.text}
              mutedColor={c.textSecondary}
              sectionTitleColor={c.textDim}
              backgroundColor={c.bgElevated}
              borderColor={c.border}
            />
          </Box>
        ) : null}
      </Box>
      {sectSelected ? <Text style={{ color: c.success, fontSize: 11 }}>{`Selected: ${sectSelected}`}</Text> : null}
    </Box>
  );
}

function SearchComboDemo() {
  const c = useThemeColors();
  const [comboSelected, setComboSelected] = useState('');
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>SearchCombo — all-in-one input + dropdown:</Text>
      <SearchCombo
        items={FILES}
        searchKey="label"
        onSelect={(item) => setComboSelected(item.label)}
        placeholder="Search files..."
        maxResults={6}
        style={{ width: '100%', position: 'relative' }}
        dropdownStyle={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40 }}
        activeColor={c.primary}
        textColor={c.text}
        mutedColor={c.textSecondary}
        backgroundColor={c.bgElevated}
        borderColor={c.border}
      />
      {comboSelected ? <Text style={{ color: c.success, fontSize: 11 }}>{`Selected: ${comboSelected}`}</Text> : null}
    </Box>
  );
}

function CommandPaletteDemo() {
  const c = useThemeColors();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastCmd, setLastCmd] = useState('');
  const btnStyle = { backgroundColor: c.primary, borderRadius: 6, paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8 };
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>CommandPalette — full-screen modal launcher:</Text>
      <Pressable
        onPress={() => setPaletteOpen(true)}
        style={({ pressed, hovered }) => ({
          ...btnStyle,
          backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>Open Command Palette</Text>
      </Pressable>
      {lastCmd ? <Text style={{ color: c.success, fontSize: 11 }}>{`Last command: ${lastCmd}`}</Text> : null}
      <CommandPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={COMMANDS.map((cmd) => ({
          ...cmd,
          action: () => { setLastCmd(cmd.label); cmd.action(); },
        }))}
        activeColor={c.primary}
        textColor={c.text}
        mutedColor={c.textSecondary}
        backgroundColor={c.bgElevated}
        borderColor={c.border}
      />
    </Box>
  );
}

function HighlightedText({ text, query, color, matchColor }: {
  text: string; query: string; color: string; matchColor: string;
}) {
  const parts = useSearchHighlight(text, query);
  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {parts.map((p, i) => (
        <Text key={i} style={{ fontSize: 11, color: p.match ? matchColor : color, fontWeight: p.match ? 'bold' : 'normal' }}>
          {p.text}
        </Text>
      ))}
    </Box>
  );
}

function FuzzySearchDemo() {
  const c = useThemeColors();
  const [fuzzyQuery, setFuzzyQuery] = useState('');
  const [fuzzyOpen, setFuzzyOpen] = useState(false);
  const { results: fuzzyResults } = useFuzzySearch(FILES, fuzzyQuery, { key: 'label', showAllOnEmpty: false, limit: 6 });
  const dropStyle = { backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 };
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>useFuzzySearch + useSearchHighlight — sorted by relevance:</Text>
      <Box style={{ width: '100%', position: 'relative' }}>
        <SearchBar
          onSearch={(q) => { setFuzzyQuery(q); setFuzzyOpen(q.trim().length > 0); }}
          placeholder="Fuzzy search files..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {fuzzyOpen && fuzzyQuery.trim().length > 0 ? (
          <Box
            style={{ width: '100%', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40, gap: 4, ...dropStyle }}
            tooltip={styleTooltip(dropStyle)}
            onPointerEnter={() => setFuzzyOpen(true)}
            onPointerLeave={() => setFuzzyOpen(false)}
          >
            {fuzzyResults.length === 0 ? (
              <Text style={{ color: c.textDim, fontSize: 11 }}>No fuzzy matches</Text>
            ) : (
              <ScrollView style={{ width: '100%', height: Math.min(200, fuzzyResults.length * 36 + 8) }}>
                <Box style={{ width: '100%', gap: 3 }}>
                  {fuzzyResults.map(({ item, score }) => {
                    const rowStyle = { backgroundColor: c.surface, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 };
                    return (
                      <Box key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, ...rowStyle }} tooltip={styleTooltip(rowStyle)}>
                        <Box style={{ flexGrow: 1 }}>
                          <HighlightedText text={item.label} query={fuzzyQuery} color={c.text} matchColor={c.primary} />
                        </Box>
                        <Text style={{ fontSize: 9, color: c.textDim }}>{`score: ${score}`}</Text>
                        <Text style={{ fontSize: 9, color: c.textSecondary }}>{item.meta}</Text>
                      </Box>
                    );
                  })}
                </Box>
              </ScrollView>
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function SearchSchemaDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState('');
  const autoSchema = useSearchSchema(OPAQUE_DATA);
  const explicitSchema = useSearchSchema(OPAQUE_DATA, { key: 'name' });
  const allFields = detectSearchableFields(OPAQUE_DATA);
  return (
    <Box style={{ width: '100%', gap: 10 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>useSearchSchema — auto-detects searchable fields, shows them to the user:</Text>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {allFields.map(String).map((f) => {
          const chipStyle = { backgroundColor: c.bgElevated, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderWidth: 1, borderColor: c.border };
          return (
            <Box key={f} style={chipStyle} tooltip={styleTooltip(chipStyle)}>
              <Text style={{ fontSize: 9, color: c.primary }}>{f}</Text>
            </Box>
          );
        })}
      </Box>
      <SearchCombo
        items={OPAQUE_DATA.map((u) => ({ id: u.id, label: u.name, description: `${u.role} · ${u.department}`, meta: String(u.joined), data: u }))}
        onSelect={(item) => setSelected((item.data as any).name)}
        placeholder="Search users..."
        showSchema
        maxResults={4}
        style={{ width: '100%', position: 'relative' }}
        dropdownStyle={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40 }}
        activeColor={c.primary}
        textColor={c.text}
        mutedColor={c.textSecondary}
        backgroundColor={c.bgElevated}
        borderColor={c.border}
      />
      {selected ? <Text style={{ color: c.success, fontSize: 11 }}>{`Selected: ${selected}`}</Text> : null}
      <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 8, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 9, color: c.textDim }}>No key (auto)</Text>
          <SearchSchemaHint schema={autoSchema} color={c.textDim} fieldColor={c.text} />
        </Box>
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 8, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 9, color: c.textDim }}>key="name"</Text>
          <SearchSchemaHint schema={explicitSchema} color={c.textDim} fieldColor={c.text} />
        </Box>
      </Box>
    </Box>
  );
}

function SearchHistoryDemo() {
  const c = useThemeColors();
  const { history, push: pushHistory, clear: clearHistory } = useSearchHistory({ storeKey: 'navStoryHistory' });
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <Box style={{ gap: 6 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>useSearchHistory — SQLite-backed. Type and press Enter to record:</Text>
      <Box style={{ width: '100%', position: 'relative' }}>
        <SearchBar
          onSearch={(q) => { setHistoryQuery(q); setHistoryOpen(q.trim().length > 0); }}
          onSubmit={(q) => { if (q.trim()) pushHistory(q); }}
          placeholder="Search (Enter to save)..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {historyOpen && history.length > 0 && historyQuery.trim().length > 0 ? (
          <Box
            style={{ width: '100%', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40, gap: 4, backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
            onPointerEnter={() => setHistoryOpen(true)}
            onPointerLeave={() => setHistoryOpen(false)}
          >
            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <Text style={{ color: c.textDim, fontSize: 10 }}>Recent searches</Text>
              <Pressable onPress={clearHistory}>
                <Text style={{ color: c.error, fontSize: 10 }}>Clear all</Text>
              </Pressable>
            </Box>
            <ScrollView style={{ width: '100%', height: Math.min(160, history.length * 32 + 8) }}>
              <Box style={{ width: '100%', gap: 3 }}>
                {history.map((h) => (
                  <Box key={h} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6, backgroundColor: c.surface }}>
                    <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary, marginRight: 8 }} />
                    <Text style={{ color: c.text, fontSize: 11, flexGrow: 1 }}>{h}</Text>
                  </Box>
                ))}
              </Box>
            </ScrollView>
          </Box>
        ) : null}
      </Box>
      {history.length === 0 ? <Text style={{ color: c.textDim, fontSize: 11 }}>No history yet. Submit a search above.</Text> : null}
    </Box>
  );
}

function AppSearchSection() {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const [hotQuery, setHotQuery] = useState('');
  const [hotOpen, setHotOpen] = useState(false);
  const { results, loading, search, navigateTo, clear } = useAppSearch({ debounce: 120 });
  const btnStyle = { backgroundColor: c.primary, borderRadius: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8 };

  useHotkey('escape', () => setHotOpen(false), { enabled: hotOpen && hotQuery.trim().length > 0 });

  return (
    <Searchable id="nav-story-app-search" style={{ width: '100%', gap: 10 }}>
      <Text style={{ color: c.textDim, fontSize: 10 }}>AppSearch — hot (live tree) + cold (compile-time) dual-tier:</Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => setOpen(true)} style={btnStyle} tooltip={styleTooltip(btnStyle)}>
          <Text style={{ color: '#fff', fontSize: 12 }}>Open AppSearch</Text>
        </Pressable>
        <Text style={{ color: c.textDim, fontSize: 11 }}>or ⌘K / Ctrl+K</Text>
      </Box>
      <Box style={{ width: '100%', position: 'relative' }}>
        <SearchBar
          onSearch={(q) => { setHotQuery(q); search(q); setHotOpen(q.trim().length > 0); }}
          placeholder="Search live tree..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {hotOpen && hotQuery.trim().length > 0 ? (
          <Box
            style={{ width: '100%', position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 40, gap: 4, backgroundColor: c.bgElevated, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
            onPointerEnter={() => setHotOpen(true)}
            onPointerLeave={() => setHotOpen(false)}
          >
            {loading ? (
              <Text style={{ color: c.textDim, fontSize: 11 }}>Searching live tree...</Text>
            ) : results.length > 0 ? (
              <ScrollView style={{ width: '100%', height: Math.min(200, results.length * 36 + 8) }}>
                <Box style={{ gap: 3 }}>
                  {results.slice(0, 10).map((r) => (
                    <Pressable
                      key={r.path}
                      onPress={() => { navigateTo(r); clear(); setHotQuery(''); setHotOpen(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6, backgroundColor: c.surface, gap: 8 }}
                    >
                      <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.primary }} />
                      <Text style={{ color: c.text, fontSize: 11, flexGrow: 1 }}>{r.text}</Text>
                      <Text style={{ color: c.textDim, fontSize: 9 }}>{r.context[0] ?? ''}</Text>
                    </Pressable>
                  ))}
                </Box>
              </ScrollView>
            ) : (
              <Text style={{ color: c.textDim, fontSize: 11 }}>No live matches</Text>
            )}
          </Box>
        ) : null}
      </Box>
      {open ? (
        <AppSearch
          onClose={() => setOpen(false)}
          onNavigate={() => setOpen(false)}
          activeColor={c.primary}
          textColor={c.text}
          mutedColor={c.textDim}
          backgroundColor={c.bgElevated}
          borderColor={c.border}
        />
      ) : null}
    </Searchable>
  );
}

// ── Story ─────────────────────────────────────────────────────────────────────

export function NavigationStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) processCode(code);
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);


  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="menu" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Navigation'}
        </Text>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Getting from here to not here'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </Box>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Interactive preview ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 16, gap: 20 }}>

                <SectionLabel label="NAVPANEL" />
                <NavPanelDemo />

                <SectionLabel label="TABS" />
                <TabsDemo />

                <SectionLabel label="BREADCRUMBS" />
                <BreadcrumbsDemo />

                <SectionLabel label="TOOLBAR" />
                <ToolbarDemo />

                <SectionLabel label="SEARCHBAR" />
                <SearchBarDemo />

                <SectionLabel label="SEARCHRESULTS (FLAT)" />
                <SearchResultsDemo />

                <SectionLabel label="SEARCHRESULTSSECTIONS" />
                <SearchSectionsDemo />

                <SectionLabel label="SEARCHCOMBO" />
                <SearchComboDemo />

                <SectionLabel label="COMMANDPALETTE" />
                <CommandPaletteDemo />

                <SectionLabel label="FUZZY SEARCH + HIGHLIGHT" />
                <FuzzySearchDemo />

                <SectionLabel label="SEARCH SCHEMA" />
                <SearchSchemaDemo />

                <SectionLabel label="SEARCH HISTORY" />
                <SearchHistoryDemo />

                <SectionLabel label="APP SEARCH" />
                <AppSearchSection />

              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API reference ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'OVERVIEW'}</Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'Navigation & Search is two suites that answer the same question — where can I go, and what can I find. NavPanel, Tabs, Breadcrumbs, and Toolbar cover page-level wayfinding: where you are in a hierarchy, what views are available, and what actions are contextually relevant. SearchBar, SearchResults, SearchCombo, CommandPalette, and AppSearch cover item-level discovery: matching text against datasets, ranking results, persisting history, and launching commands by name. ReactJIT is not a traditional browser/DOM runtime, but it still has internal routing that behaves like a standard app router. All navigation components are fully controlled: pass activeId and onSelect. All search components compose from the same base hooks (useSearch, useFuzzySearch) and can be assembled into custom UIs.'}
                </Text>

                <HorizontalDivider />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'USAGE'}</Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'BEHAVIOR'}</Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'PROPS'}</Text>
                <Box style={{ gap: 3 }}>
                  {PROPS.map(([prop, type, icon]) => (
                    <Box key={prop} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{prop}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'CALLBACKS'}</Text>
                <Box style={{ gap: 3 }}>
                  {CALLBACKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="menu" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Navigation'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
          <Image
            src={playground ? 'book-open' : 'play'}
            style={{ width: 10, height: 10 }}
            tintColor={playground ? 'white' : c.text}
          />
          <Text style={{ color: playground ? 'white' : c.text, fontSize: 9, fontWeight: 'bold' }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
