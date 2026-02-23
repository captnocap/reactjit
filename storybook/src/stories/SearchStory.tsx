import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import {
  SearchBar,
  SearchResults,
  SearchResultsSections,
  SearchCombo,
  CommandPalette,
  useSearch,
  useFuzzySearch,
  useSearchHighlight,
  useSearchHistory,
  useCommandSearch,
} from '../../../packages/core/src';
import type { SearchResultItem, CommandDef } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// ── Sample data ───────────────────────────────────────────────────────────────

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
  { id: 9, label: 'window_manager.lua', description: 'Multi-window abstraction', meta: 'Lua', path: 'lua/window_manager.lua', type: 'file' },
  { id: 10, label: 'timer.lua', description: 'Timer capability', meta: 'Lua', path: 'lua/capabilities/timer.lua', type: 'file' },
  { id: 11, label: 'audio.lua', description: 'Audio capability', meta: 'Lua', path: 'lua/capabilities/audio.lua', type: 'file' },
  { id: 12, label: 'eventDispatcher.ts', description: 'Bridge event routing', meta: 'TS', path: 'packages/native/src/eventDispatcher.ts', type: 'file' },
];

const COMMANDS: CommandDef[] = [
  { id: 'new-file', label: 'New File', group: 'File', shortcut: 'ctrl+n', action: () => {} },
  { id: 'open-file', label: 'Open File...', group: 'File', shortcut: 'ctrl+o', action: () => {} },
  { id: 'save', label: 'Save', group: 'File', shortcut: 'ctrl+s', action: () => {} },
  { id: 'save-as', label: 'Save As...', group: 'File', shortcut: 'ctrl+shift+s', action: () => {} },
  { id: 'build', label: 'Build Project', group: 'Build', shortcut: 'ctrl+b', keywords: ['compile', 'rjit'], action: () => {} },
  { id: 'lint', label: 'Run Linter', group: 'Build', keywords: ['check', 'errors'], action: () => {} },
  { id: 'screenshot', label: 'Take Screenshot', group: 'Dev', shortcut: 'F9', keywords: ['capture', 'preview'], action: () => {} },
  { id: 'inspector', label: 'Toggle Inspector', group: 'Dev', shortcut: 'F12', keywords: ['debug', 'devtools'], action: () => {} },
  { id: 'reload', label: 'Reload Bundle', group: 'Dev', shortcut: 'F5', keywords: ['hmr', 'refresh'], action: () => {} },
  { id: 'theme', label: 'Switch Theme', group: 'Appearance', keywords: ['colors', 'dark', 'light'], action: () => {} },
  { id: 'quit', label: 'Quit', group: 'App', shortcut: 'ctrl+q', action: () => {} },
];

// ── Highlight component ───────────────────────────────────────────────────────

function HighlightedText({ text, query, color, matchColor, fontSize = 13 }: {
  text: string; query: string; color: string; matchColor: string; fontSize?: number;
}) {
  const parts = useSearchHighlight(text, query);
  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {parts.map((p, i) => (
        <Text
          key={i}
          style={{
            fontSize,
            color: p.match ? matchColor : color,
            fontWeight: p.match ? 'bold' : 'normal',
          }}
        >
          {p.text}
        </Text>
      ))}
    </Box>
  );
}

// ── Story ─────────────────────────────────────────────────────────────────────

export function SearchStory() {
  const c = useThemeColors();

  // Section 1: SearchBar alone
  const [barQuery, setBarQuery] = useState('');
  const [barSubmit, setBarSubmit] = useState('');

  // Section 2: SearchResults (flat)
  const [flatQuery, setFlatQuery] = useState('');
  const [flatActive, setFlatActive] = useState(-1);
  const [flatSelected, setFlatSelected] = useState<string>('');
  const flatResults = useSearch(FILES, flatQuery, { key: 'label', showAllOnEmpty: true, limit: 6 });

  // Section 3: SearchResultsSections
  const [sectQuery, setSectQuery] = useState('');
  const [sectActive, setSectActive] = useState(-1);
  const [sectSelected, setSectSelected] = useState('');
  const luaFiles = useSearch(FILES.filter(f => f.meta === 'Lua'), sectQuery, { key: 'label', showAllOnEmpty: true });
  const tsFiles = useSearch(FILES.filter(f => f.meta !== 'Lua'), sectQuery, { key: 'label', showAllOnEmpty: true });

  // Section 4: SearchCombo
  const [comboSelected, setComboSelected] = useState('');

  // Section 5: CommandPalette
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastCmd, setLastCmd] = useState('');

  // Section 6: useFuzzySearch
  const [fuzzyQuery, setFuzzyQuery] = useState('');
  const { results: fuzzyResults } = useFuzzySearch(FILES, fuzzyQuery, { key: 'label', showAllOnEmpty: false, limit: 6 });

  // Section 7: useSearchHistory
  const { history, push: pushHistory, clear: clearHistory } = useSearchHistory({ storeKey: 'searchStoryHistory' });
  const [historyQuery, setHistoryQuery] = useState('');

  return (
    <StoryPage>

      {/* 1. SearchBar */}
      <StorySection index={1} title="SearchBar">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Debounce 300ms in Lua. No per-keystroke bridge traffic.
        </Text>
        <SearchBar
          onSearch={setBarQuery}
          onSubmit={setBarSubmit}
          placeholder="Search files..."
          style={{ width: '100%' }}
          activeColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        <Box style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`query: "${barQuery}"`}</Text>
          {barSubmit && <Text style={{ color: c.success, fontSize: 12 }}>{`submitted: "${barSubmit}"`}</Text>}
        </Box>
      </StorySection>

      {/* 2. SearchResults flat */}
      <StorySection index={2} title="SearchResults (flat)">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          SearchBar drives a flat results list with keyboard active tracking.
        </Text>
        <SearchBar
          onSearch={(q) => { setFlatQuery(q); setFlatActive(-1); }}
          placeholder="Filter files..."
          style={{ width: '100%' }}
          activeColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        <SearchResults
          items={flatResults}
          activeIndex={flatActive}
          onSelect={(item) => setFlatSelected(item.label)}
          style={{ width: '100%' }}
          activeColor={c.primary}
          textColor={c.text}
          mutedColor={c.textSecondary}
          backgroundColor={c.bgElevated}
          borderColor={c.border}
        />
        {flatSelected && (
          <Text style={{ color: c.success, fontSize: 12 }}>{`Selected: ${flatSelected}`}</Text>
        )}
      </StorySection>

      {/* 3. SearchResultsSections */}
      <StorySection index={3} title="SearchResultsSections">
        <Text style={{ color: c.textDim, fontSize: 10 }}>Results grouped by file type.</Text>
        <SearchBar
          onSearch={(q) => { setSectQuery(q); setSectActive(-1); }}
          placeholder="Filter by language..."
          style={{ width: '100%' }}
          activeColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        <SearchResultsSections
          sections={[
            { title: 'Lua', items: luaFiles },
            { title: 'TypeScript', items: tsFiles },
          ]}
          activeIndex={sectActive}
          onSelect={(item) => setSectSelected(item.label)}
          style={{ width: '100%' }}
          activeColor={c.primary}
          textColor={c.text}
          mutedColor={c.textSecondary}
          sectionTitleColor={c.textDim}
          backgroundColor={c.bgElevated}
          borderColor={c.border}
        />
        {sectSelected && (
          <Text style={{ color: c.success, fontSize: 12 }}>{`Selected: ${sectSelected}`}</Text>
        )}
      </StorySection>

      {/* 4. SearchCombo */}
      <StorySection index={4} title="SearchCombo">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          All-in-one: input + dropdown. Keyboard nav built in.
        </Text>
        <SearchCombo
          items={FILES}
          searchKey="label"
          onSelect={(item) => setComboSelected(item.label)}
          placeholder="Search files..."
          maxResults={6}
          style={{ width: '100%' }}
          activeColor={c.primary}
          textColor={c.text}
          mutedColor={c.textSecondary}
          backgroundColor={c.bgElevated}
          borderColor={c.border}
        />
        {comboSelected && (
          <Text style={{ color: c.success, fontSize: 12 }}>{`Selected: ${comboSelected}`}</Text>
        )}
      </StorySection>

      {/* 5. CommandPalette */}
      <StorySection index={5} title="CommandPalette">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Full-screen modal command launcher. Press the button to open.
        </Text>
        <Pressable
          onPress={() => setPaletteOpen(true)}
          style={({ pressed, hovered }) => ({
            backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
            borderRadius: 6,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 9,
            paddingBottom: 9,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Open Command Palette</Text>
        </Pressable>
        {lastCmd && (
          <Text style={{ color: c.success, fontSize: 12 }}>{`Last command: ${lastCmd}`}</Text>
        )}
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
      </StorySection>

      {/* 6. useFuzzySearch */}
      <StorySection index={6} title="useFuzzySearch + useSearchHighlight">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Fuzzy match with score. Results sorted by relevance. Characters highlighted.
        </Text>
        <SearchBar
          onSearch={setFuzzyQuery}
          placeholder="Fuzzy search files..."
          style={{ width: '100%' }}
          activeColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        <Box style={{ width: '100%', gap: 4 }}>
          {fuzzyResults.length === 0 && fuzzyQuery.length > 0 && (
            <Text style={{ color: c.textDim, fontSize: 12 }}>No fuzzy matches</Text>
          )}
          {fuzzyResults.map(({ item, score }) => (
            <Box
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 6,
                backgroundColor: c.surface,
                gap: 8,
              }}
            >
              <Box style={{ flexGrow: 1 }}>
                <HighlightedText
                  text={item.label}
                  query={fuzzyQuery}
                  color={c.text}
                  matchColor={c.primary}
                />
              </Box>
              <Text style={{ fontSize: 10, color: c.textDim }}>{`score: ${score}`}</Text>
              <Text style={{ fontSize: 10, color: c.textSecondary }}>{item.meta}</Text>
            </Box>
          ))}
        </Box>
      </StorySection>

      {/* 7. useSearchHistory */}
      <StorySection index={7} title="useSearchHistory">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Persistent history backed by SQLite. Type a query and submit to record it.
        </Text>
        <SearchBar
          onSearch={setHistoryQuery}
          onSubmit={(q) => { if (q.trim()) pushHistory(q); }}
          placeholder="Search (Enter to save)..."
          style={{ width: '100%' }}
          activeColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {history.length > 0 ? (
          <Box style={{ width: '100%', gap: 4 }}>
            <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
              <Text style={{ color: c.textDim, fontSize: 10 }}>Recent searches</Text>
              <Pressable onPress={clearHistory}>
                <Text style={{ color: c.error, fontSize: 10 }}>Clear all</Text>
              </Pressable>
            </Box>
            {history.map((h) => (
              <Box
                key={h}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 6,
                  backgroundColor: c.surface,
                }}
              >
                <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginRight: 8 }} />
                <Text style={{ color: c.text, fontSize: 12, flexGrow: 1 }}>{h}</Text>
              </Box>
            ))}
          </Box>
        ) : (
          <Text style={{ color: c.textDim, fontSize: 12 }}>No history yet. Submit a search above.</Text>
        )}
      </StorySection>

    </StoryPage>
  );
}
