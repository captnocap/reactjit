import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import {
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
  useCommandSearch,
  useSearchSchema,
  detectSearchableFields,
  useAppSearch,
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

// ── Schema demo subcomponent ──────────────────────────────────────────────────

// An opaque dataset with many fields — a non-technical user would not know
// which ones are searchable without schema introspection.
const OPAQUE_DATA = [
  { id: 'u1', name: 'Alice Nakamura', email: 'alice@example.com', role: 'Engineer', department: 'Platform', joined: 2021, avatar: 'https://cdn.example.com/avatars/alice.png' },
  { id: 'u2', name: 'Bob Chen',       email: 'bob@example.com',   role: 'Designer', department: 'Product',  joined: 2022, avatar: 'https://cdn.example.com/avatars/bob.png' },
  { id: 'u3', name: 'Cleo Okafor',    email: 'cleo@example.com',  role: 'Manager',  department: 'Platform', joined: 2019, avatar: 'https://cdn.example.com/avatars/cleo.png' },
  { id: 'u4', name: 'Diego Flores',   email: 'diego@example.com', role: 'Engineer', department: 'Data',     joined: 2023, avatar: 'https://cdn.example.com/avatars/diego.png' },
];

function SearchComboSchemaDemo({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const [selected, setSelected] = useState('');

  // Schema with no key specified — auto-detects string fields, skips id/avatar/url
  const autoSchema = useSearchSchema(OPAQUE_DATA);
  // Schema with explicit key
  const explicitSchema = useSearchSchema(OPAQUE_DATA, { key: 'name' });
  // Raw field list
  const allFields = detectSearchableFields(OPAQUE_DATA);

  return (
    <Box style={{ width: '100%', gap: 12 }}>
      {/* Show what auto-detection found */}
      <Box style={{ backgroundColor: c.surface, borderRadius: 8, padding: 10, gap: 6 }}>
        <Text style={{ fontSize: 11, color: c.textSecondary }}>Auto-detected searchable fields:</Text>
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {allFields.map(String).map((f) => (
            <Box
              key={f}
              style={{ backgroundColor: c.bgElevated, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ fontSize: 10, color: c.primary }}>{f}</Text>
            </Box>
          ))}
        </Box>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          (id, email, avatar skipped — not useful for text search)
        </Text>
      </Box>

      {/* SearchCombo with auto schema shown */}
      <Text style={{ fontSize: 11, color: c.textSecondary }}>With showSchema — user sees what they can search:</Text>
      <SearchCombo
        items={OPAQUE_DATA.map((u) => ({ id: u.id, label: u.name, description: `${u.role} · ${u.department}`, meta: String(u.joined), data: u }))}
        onSelect={(item) => setSelected((item.data as any).name)}
        placeholder="Search users..."
        showSchema
        maxResults={4}
        style={{ width: '100%' }}
        activeColor={c.primary}
        textColor={c.text}
        mutedColor={c.textSecondary}
        backgroundColor={c.bgElevated}
        borderColor={c.border}
      />
      {selected && <Text style={{ color: c.success, fontSize: 12 }}>{`Selected: ${selected}`}</Text>}

      {/* Side-by-side schema comparison */}
      <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 8, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>No key (auto)</Text>
          <SearchSchemaHint schema={autoSchema} color={c.textDim} fieldColor={c.text} />
        </Box>
        <Box style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 8, padding: 8, gap: 4 }}>
          <Text style={{ fontSize: 10, color: c.textDim }}>key=&quot;name&quot;</Text>
          <SearchSchemaHint schema={explicitSchema} color={c.textDim} fieldColor={c.text} />
        </Box>
      </Box>
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
          accentColor={c.primary}
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
          accentColor={c.primary}
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
          accentColor={c.primary}
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
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'normal' }}>Open Command Palette</Text>
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
          accentColor={c.primary}
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

      {/* 7. useSearchSchema + discoverability */}
      <StorySection index={7} title="useSearchSchema (discoverability)">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Non-technical users can see exactly what the search looks at.
          SearchCombo with showSchema=true auto-detects and labels all searchable fields.
        </Text>
        {/* Auto-detected schema on FILES */}
        <SearchComboSchemaDemo c={c} />
      </StorySection>

      {/* 8. useSearchHistory */}
      <StorySection index={8} title="useSearchHistory">
        <Text style={{ color: c.textDim, fontSize: 10 }}>
          Persistent history backed by SQLite. Type a query and submit to record it.
        </Text>
        <SearchBar
          onSearch={setHistoryQuery}
          onSubmit={(q) => { if (q.trim()) pushHistory(q); }}
          placeholder="Search (Enter to save)..."
          style={{ width: '100%' }}
          accentColor={c.primary}
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

      {/* ── Section 9: AppSearch ──────────────────────────────────────────── */}
      <StorySection index={9} title="AppSearch (live hot + compile-time cold)">
        <AppSearchDemo />
      </StorySection>

    </StoryPage>
  );
}

// ── AppSearch demo ────────────────────────────────────────────────────────────

function AppSearchDemo() {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const { results, loading, search, navigateTo, clear } = useAppSearch({ debounce: 120 });

  return (
    <Searchable id="app-search-demo" style={{ width: '100%', gap: 12 }}>
      {/* Controls */}
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable
          onPress={() => setOpen(true)}
          style={{
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 8,
            backgroundColor: c.primary,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'normal' }}>Open AppSearch</Text>
        </Pressable>
        <Text style={{ color: c.textDim, fontSize: 12 }}>or press ⌘K / Ctrl+K</Text>
      </Box>

      {/* Description */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'normal' }}>How it works</Text>
        <Text style={{ color: c.textDim, fontSize: 12 }}>
          AppSearch runs two search tiers simultaneously:
        </Text>
        <Box style={{ gap: 4, paddingLeft: 12 }}>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary, marginTop: 4 }} />
            <Text style={{ color: c.text, fontSize: 12, flexGrow: 1 }}>
              Hot (live tree) — walks the Lua node tree right now. Direct node references,
              zero indirection. Structural path "2.0.1" is the node address.
            </Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 4 }} />
            <Text style={{ color: c.text, fontSize: 12, flexGrow: 1 }}>
              Cold (compile-time) — generated by running{' '}
              <Text style={{ color: c.primary, fontSize: 12 }}>rjit search-index</Text>.
              Walks .tsx AST, finds all static Text children, emits dist/search-index.json.
              Powers cross-story search without mounting every story.
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Searchable wrapper example */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'normal' }}>Searchable wrapper</Text>
        <Box
          style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            gap: 4,
          }}
        >
          <Text style={{ color: c.textDim, fontSize: 11 }}>
            Wrap any section with &lt;Searchable id="..."&gt; to group its content in the cold index:
          </Text>
          <Box style={{ padding: 10, borderRadius: 6, backgroundColor: c.bg, gap: 2 }}>
            <Text style={{ color: c.primary, fontSize: 11 }}>{'<Searchable id="my-feature">'}</Text>
            <Text style={{ color: c.text, fontSize: 11, paddingLeft: 12 }}>{'<Text>Settings</Text>'}</Text>
            <Text style={{ color: c.text, fontSize: 11, paddingLeft: 12 }}>{'<TextInput placeholder="Username" />'}</Text>
            <Text style={{ color: c.primary, fontSize: 11 }}>{'</Searchable>'}</Text>
          </Box>
          <Text style={{ color: c.textDim, fontSize: 11 }}>
            At compile time, rjit search-index groups these entries under the id "my-feature".
            Zero runtime overhead — Searchable renders as a plain Box.
          </Text>
        </Box>
      </Box>

      {/* Live results preview */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'normal' }}>Inline hot search</Text>
        <SearchBar
          onSearch={search}
          placeholder="Search live tree..."
          style={{ width: '100%' }}
          accentColor={c.primary}
          backgroundColor={c.surface}
          color={c.text}
          borderColor={c.border}
        />
        {loading && (
          <Text style={{ color: c.textDim, fontSize: 12 }}>Searching live tree...</Text>
        )}
        {!loading && results.length > 0 && (
          <Box style={{ gap: 4 }}>
            {results.slice(0, 5).map((r) => (
              <Pressable
                key={r.path}
                onPress={() => { navigateTo(r); clear(); }}
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
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                <Text style={{ color: c.text, fontSize: 12, flexGrow: 1 }}>{r.text}</Text>
                <Text style={{ color: c.textDim, fontSize: 10 }}>{r.context[0] ?? ''}</Text>
              </Pressable>
            ))}
            {results.length > 5 && (
              <Text style={{ color: c.textDim, fontSize: 11 }}>
                +{results.length - 5} more — open AppSearch for full results
              </Text>
            )}
          </Box>
        )}
        {!loading && results.length === 0 && (
          <Text style={{ color: c.textDim, fontSize: 12 }}>Type to search the live tree</Text>
        )}
      </Box>

      {/* AppSearch modal */}
      {open && (
        <AppSearch
          onClose={() => setOpen(false)}
          onNavigate={(r) => setOpen(false)}
          activeColor={c.primary}
          textColor={c.text}
          mutedColor={c.textDim}
          backgroundColor={c.bgElevated}
          borderColor={c.border}
        />
      )}
    </Searchable>
  );
}
