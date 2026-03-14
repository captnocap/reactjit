/**
 * Storage — Persistent state, document stores, SQLite, CRUD, and search.
 *
 * Four tiers of persistence, one import:
 * - useHotState: survives HMR (Lua memory, ephemeral)
 * - useLocalStore: survives restart (SQLite key-value)
 * - DocStore: MongoDB-like document queries (Lua FFI)
 * - @reactjit/storage: Zod schemas, CRUD hooks, 5 adapters, migrations
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, TextInput, classifiers as S} from '../../../packages/core/src';
import { useLocalStore } from '../../../packages/core/src/useLocalStore';
import { useHotState } from '../../../packages/core/src/useHotState';
import { useSearch, useFuzzySearch } from '../../../packages/core/src/useSearch';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useLocalStore, useHotState }
  from '@reactjit/core'
import { useSearch, useFuzzySearch }
  from '@reactjit/core/useSearch'
import { z, useCRUD, StorageProvider }
  from '@reactjit/storage'`;

const LOCALSTORE_CODE = `// Persistent useState — backed by SQLite
const [count, setCount] = useLocalStore('count', 0)
const [name, setName] = useLocalStore('name', 'World')

// Namespaced — group related keys
const [prefs, setPrefs] = useLocalStore(
  'prefs', defaults, { namespace: 'settings' }
)`;

const HOTSTATE_CODE = `// Survives HMR — lives in Lua memory
const [tab, setTab] = useHotState('activeTab', 0)
const [open, setOpen] = useHotState('sidebar', true)

// Zero flash — reads from __hotstateCache synchronously
// Lost on full restart (use useLocalStore for that)`;

const DOCSTORE_CODE = `-- Lua: MongoDB-like document store
local db = docstore.open("myapp.db")

db:save("heroes", { name = "Link", hp = 100 })
db:find("heroes", { hp = { gte = 50 } })
db:findOne("heroes", { name = "Link" })
db:update("heroes", id, { hp = 80 })
db:remove("heroes", id)
db:count("heroes")`;

const SQLITE_CODE = `-- Lua: raw SQLite FFI (full control)
local db = sqlite.open("data.db")

db:exec("CREATE TABLE users (id, name, age)")
db:exec("INSERT INTO users VALUES (?, ?, ?)",
  1, "Alice", 30)
local rows = db:query(
  "SELECT * FROM users WHERE age > ?", 25)
local n = db:scalar("SELECT COUNT(*) FROM users")
db:close()`;

const QUERY_CODE = `-- DocStore query operators
{ field = value }              -- exact match
{ field = { gt = 10 } }        -- greater than
{ field = { gte = 10 } }       -- >=
{ field = { lt = 10 } }        -- <
{ field = { lte = 10 } }       -- <=
{ field = { ne = "x" } }       -- not equal
{ field = { like = "%pat%" } } -- SQL LIKE
{ field = { contains = "x" } } -- array contains`;

const CRUD_CODE = `// Zod-like schema + CRUD hook
const Todo = z.object({
  title: z.string(),
  done: z.boolean().default(false),
  priority: z.number().optional(),
})

const todos = useCRUD('todos', Todo)
await todos.create({ title: 'Ship it' })
const all = await todos.list({ where: { done: false } })
await todos.update(id, { done: true })`;

const ADAPTER_CODE = `// 5 pluggable backends
import {
  MemoryAdapter,       // ephemeral (tests)
  Love2DFileAdapter,   // Love2D save dir (JSON/md)
  TerminalSQLiteAdapter, // Node v22 sqlite
  LocalStorageAdapter, // browser localStorage
  IndexedDBAdapter,    // browser IndexedDB
} from '@reactjit/storage'

<StorageProvider adapter={new Love2DFileAdapter({ rpc })}>
  <App />  {/* useCRUD reads adapter from context */}
</StorageProvider>`;

const SEARCH_CODE = `// In-memory search (substring + fuzzy)
const results = useSearch(items, query, {
  key: ['name', 'desc'],  // fields to search
  limit: 10,
})

// Fuzzy with scoring
const { results, items } = useFuzzySearch(
  items, query, { key: 'name', threshold: 0.3 }
)`;

const SEARCH_HISTORY_CODE = `// Persistent search history (SQLite-backed)
const { history, push, remove, clear }
  = useSearchHistory({ maxEntries: 20 })

// Highlight matching text in results
const parts = useSearchHighlight(text, query)
// [{ text: 'He', match: false },
//  { text: 'llo', match: true }]`;

const SCHEMA_CODE = `// Zod-inspired validation (not full Zod)
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
})

type User = Infer<typeof User>
User.parse(data)       // throws ValidationError
User.safeParse(data)   // { success, data|error }`;

const MIGRATION_CODE = `// Schema migrations (automatic versioning)
const todos = useCRUD('todos', TodoV2, {
  migrations: {
    2: (doc) => ({ ...doc, priority: 'medium' }),
    3: (doc) => ({ ...doc, tags: [] }),
  },
  autoMigrate: true,
})`;

// ── Hoisted data arrays ─────────────────────────────────

const TIERS = [
  { label: 'useHotState', persist: 'Lua memory', survives: 'HMR', color: C.yellow },
  { label: 'useLocalStore', persist: 'SQLite KV', survives: 'Restart', color: C.green },
  { label: 'DocStore', persist: 'SQLite docs', survives: 'Restart', color: C.blue },
  { label: 'SQLite FFI', persist: 'Raw SQL', survives: 'Restart', color: C.mauve },
  { label: 'useCRUD', persist: 'Adapter', survives: 'Configurable', color: C.peach },
];

const ADAPTERS = [
  { name: 'MemoryAdapter', target: 'Tests/ephemeral', color: C.yellow },
  { name: 'Love2DFileAdapter', target: 'Love2D save dir', color: C.green },
  { name: 'TerminalSQLiteAdapter', target: 'Node.js v22+', color: C.blue },
  { name: 'LocalStorageAdapter', target: 'Browser localStorage', color: C.peach },
  { name: 'IndexedDBAdapter', target: 'Browser IndexedDB', color: C.mauve },
];

const SEARCH_ITEMS = [
  { name: 'Alice', role: 'Engineer' },
  { name: 'Bob', role: 'Designer' },
  { name: 'Charlie', role: 'Engineer' },
  { name: 'Diana', role: 'Manager' },
  { name: 'Eve', role: 'Designer' },
  { name: 'Frank', role: 'Engineer' },
  { name: 'Grace', role: 'Data Scientist' },
  { name: 'Hank', role: 'DevOps' },
];
const SEARCH_DEMO_OPTIONS: { key: Array<'name' | 'role'> } = { key: ['name', 'role'] };

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
  );
}

// ── Band wrapper (zigzag helper) ─────────────────────────

const bandStyle = {
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const halfStyle = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── Live Demo: useLocalStore Counter ─────────────────────

function LocalStoreDemo() {
  const c = useThemeColors();
  const [count, setCount] = useLocalStore('demo:counter', 0);
  const [text, setText] = useLocalStore('demo:note', '');

  return (
    <S.StackG10W100>
      <S.StoryCap>{'Persists to SQLite — reload the app and values stay'}</S.StoryCap>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.green }}>{'Counter (useLocalStore)'}</Text>
        <S.RowCenterG8>
          <Pressable onPress={() => setCount(n => n - 1)}>
            <Box style={{ backgroundColor: C.red, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'-1'}</Text>
            </Box>
          </Pressable>
          <Text style={{ fontSize: 20, color: c.text, minWidth: 40, textAlign: 'center' }}>{String(count)}</Text>
          <Pressable onPress={() => setCount(n => n + 1)}>
            <Box style={{ backgroundColor: C.green, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{'+1'}</Text>
            </Box>
          </Pressable>
          <Pressable onPress={() => setCount(0)}>
            <Box style={{ backgroundColor: c.surface2, borderRadius: 6, padding: 6, paddingLeft: 10, paddingRight: 10 }}>
              <S.StoryBody>{'Reset'}</S.StoryBody>
            </Box>
          </Pressable>
        </S.RowCenterG8>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.blue }}>{'Note (useLocalStore)'}</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a note — it persists..."
          style={{ fontSize: 10, color: c.text, backgroundColor: c.surface1, borderRadius: 6, padding: 8 }}
        />
      </Box>
    </S.StackG10W100>
  );
}

// ── Live Demo: useHotState ───────────────────────────────

function HotStateDemo() {
  const c = useThemeColors();
  const [tab, setTab] = useHotState('demo:tab', 0);
  const [open, setOpen] = useHotState('demo:sidebar', true);

  const tabs = ['Home', 'Settings', 'Profile'];

  return (
    <S.StackG10W100>
      <S.StoryCap>{'Survives HMR — edit code and tab stays selected'}</S.StoryCap>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.yellow }}>{'Active tab (useHotState)'}</Text>
        <S.RowG6>
          {tabs.map((t, i) => (
            <Pressable key={t} onPress={() => setTab(i)}>
              <Box style={{
                backgroundColor: tab === i ? C.yellow : c.surface2,
                borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12,
              }}>
                <Text style={{ fontSize: 10, color: tab === i ? '#1e1e2e' : c.muted }}>{t}</Text>
              </Box>
            </Pressable>
          ))}
        </S.RowG6>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.yellow }}>{'Sidebar toggle (useHotState)'}</Text>
        <S.RowCenterG8>
          <Pressable onPress={() => setOpen(!open)}>
            <Box style={{ backgroundColor: open ? C.green : C.red, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{open ? 'Open' : 'Closed'}</Text>
            </Box>
          </Pressable>
          <S.StoryCap>{'Lost on full restart — use useLocalStore for that'}</S.StoryCap>
        </S.RowCenterG8>
      </Box>
    </S.StackG10W100>
  );
}

// ── Live Demo: Search ────────────────────────────────────

function SearchDemo() {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const results = useSearch(SEARCH_ITEMS, query, SEARCH_DEMO_OPTIONS);

  return (
    <S.StackG8W100>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search people..."
        style={{ fontSize: 10, color: c.text, backgroundColor: c.surface1, borderRadius: 6, padding: 8 }}
      />
      <Box style={{ gap: 3 }}>
        {results.map(item => (
          <S.RowCenterG8 key={item.name}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue }} />
            <S.StoryBody>{item.name}</S.StoryBody>
            <S.StoryCap>{item.role}</S.StoryCap>
          </S.RowCenterG8>
        ))}
        {results.length === 0 && query.length > 0 && (
          <Text style={{ fontSize: 9, color: C.red }}>{'No matches'}</Text>
        )}
      </Box>
    </S.StackG8W100>
  );
}

// ── Tier Overview ────────────────────────────────────────

function TierOverview() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4 }}>
      {TIERS.map(t => (
        <S.RowCenterG8 key={t.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.color }} />
          <S.StoryBreadcrumbActive>{t.label}</S.StoryBreadcrumbActive>
          <Text style={{ fontSize: 8, color: t.color }}>{t.persist}</Text>
          <S.StoryTiny>{`survives ${t.survives}`}</S.StoryTiny>
        </S.RowCenterG8>
      ))}
    </Box>
  );
}

// ── Adapter List ─────────────────────────────────────────

function AdapterList() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4 }}>
      {ADAPTERS.map(a => (
        <S.RowCenterG8 key={a.name}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color }} />
          <S.StoryBreadcrumbActive>{a.name}</S.StoryBreadcrumbActive>
          <S.StoryTiny>{a.target}</S.StoryTiny>
        </S.RowCenterG8>
      ))}
    </Box>
  );
}

// ── StorageStory ─────────────────────────────────────────

export function StorageStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="database" tintColor={C.accent} />
        <S.StoryTitle>
          {'Storage'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core + @reactjit/storage'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Forget me knots'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'Four tiers of persistence. Pick the right one.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'useHotState for HMR-surviving UI state. useLocalStore for restart-surviving app data. DocStore for MongoDB-like queries. SQLite FFI for raw SQL. Plus @reactjit/storage for Zod schemas, CRUD hooks, and 5 pluggable adapters.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Core hooks (useLocalStore, useHotState, useSearch) live in @reactjit/core. Schema validation, CRUD hooks, and adapters are in @reactjit/storage.'}
            </S.StoryBody>
            <TierOverview />
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Box>

        <Divider />

        {/* ── Band 2: demo | text + code — useLocalStore ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <LocalStoreDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="save">{'useLocalStore'}</SectionLabel>
            <S.StoryBody>
              {'Drop-in replacement for useState that persists to SQLite. Values are JSON-encoded with 300ms debounced writes. Optional namespace for grouping related keys.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Backed by lua/localstore.lua — a key-value table in localstore.db. The hook loads the initial value on mount via RPC, then debounces writes. Survives full app restart.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={LOCALSTORE_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: text + code | demo — useHotState ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="zap">{'useHotState'}</SectionLabel>
            <S.StoryBody>
              {'Lives in Lua memory — survives HMR because the Lua process persists across JS reloads. Zero flash on mount: reads synchronously from __hotstateCache. No async delay.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Use for ephemeral UI state: active tab, sidebar open/closed, scroll position. Lost on full restart — upgrade to useLocalStore when you need true persistence.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={HOTSTATE_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <HotStateDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Callout: when to use what ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'useHotState = fast, ephemeral, HMR-safe. useLocalStore = persistent, debounced, SQLite-backed. Both are drop-in useState replacements — same [value, setValue] API.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 4: text + code | code — DocStore ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="hard-drive">{'DOCSTORE'}</SectionLabel>
            <S.StoryBody>
              {'MongoDB-like document store built on SQLite. Save, find, update, remove — with query operators for filtering. All Lua-side, zero JS overhead.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Documents get auto-generated _id fields. Queries support gt, gte, lt, lte, ne, like, and contains operators. Results are plain Lua tables.'}
            </S.StoryCap>
            <CodeBlock language="lua" fontSize={9} code={DOCSTORE_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <S.StoryCap style={{ marginBottom: 4 }}>{'Query operators:'}</S.StoryCap>
            <CodeBlock language="lua" fontSize={9} code={QUERY_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: code | text — SQLite FFI ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <CodeBlock language="lua" fontSize={9} code={SQLITE_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="terminal">{'SQLITE FFI'}</SectionLabel>
            <S.StoryBody>
              {'Raw SQLite bindings via LuaJIT FFI. Full SQL — CREATE, INSERT, SELECT, joins, transactions. For when DocStore is too abstract and you need direct control.'}
            </S.StoryBody>
            <S.StoryCap>
              {'sqlite.open(path) for file-backed or sqlite.open() for in-memory. Parameterized queries prevent injection. db:changes() returns affected rows. db:busyTimeout(ms) handles lock contention.'}
            </S.StoryCap>
          </Box>
        </Box>

        <Divider />

        {/* ── Callout: Lua-side storage ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'DocStore and SQLite run entirely in Lua via FFI — zero bridge round-trips for queries. useLocalStore and useHotState bridge to these via RPC for React integration.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 6: text + code | text + list — CRUD + Schemas ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="layers">{'CRUD + SCHEMAS'}</SectionLabel>
            <S.StoryBody>
              {'Define a Zod-inspired schema, get a typed CRUD handle with create, get, update, delete, list. Includes reactive hooks: useQuery and useListQuery for auto-refetching.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={CRUD_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="check-circle">{'SCHEMA VALIDATION'}</SectionLabel>
            <S.StoryBody>
              {'The z builder supports string, number, boolean, object, array, optional, nullable, and default. parse() throws, safeParse() returns a result object.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={SCHEMA_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: text + list | code — ADAPTERS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="settings">{'ADAPTERS'}</SectionLabel>
            <S.StoryBody>
              {'useCRUD reads its adapter from StorageProvider context. Swap backends without changing application code. Five built-in adapters cover every deployment target.'}
            </S.StoryBody>
            <AdapterList />
            <S.StoryCap>
              {'All adapters implement the same interface: get, set, delete, list. Custom adapters just need those four methods.'}
            </S.StoryCap>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={ADAPTER_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
        </Box>

        <Divider />

        {/* ── Band 8: code | text — MIGRATIONS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <CodeBlock language="tsx" fontSize={9} code={MIGRATION_CODE} style={{ flexGrow: 1, flexBasis: 0 }} />
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="git-merge">{'MIGRATIONS'}</SectionLabel>
            <S.StoryBody>
              {'Schema versions are tracked via a _version field on each document. Migration functions transform old shapes to new. autoMigrate applies them on read — no separate migration step.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Each migration function receives the old document and returns the new shape. Versions are integers, applied in order. Missing fields get defaults from the schema.'}
            </S.StoryCap>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 9: demo | text + code — SEARCH ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SearchDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="search">{'SEARCH'}</SectionLabel>
            <S.StoryBody>
              {'useSearch filters in-memory arrays by substring match. useFuzzySearch adds scoring and ranking. Both auto-detect searchable fields (strings and numbers, skipping ids and URLs).'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={SEARCH_CODE} style={{ width: '100%' }} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 10: text + code | text — SEARCH EXTRAS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row', paddingBottom: 24 }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="clock">{'SEARCH HISTORY & HIGHLIGHT'}</SectionLabel>
            <S.StoryBody>
              {'useSearchHistory persists recent queries to SQLite via useLocalStore. useSearchHighlight splits text into matched/unmatched parts for rendering highlighted results.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={SEARCH_HISTORY_CODE} style={{ width: '100%' }} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="command">{'COMMAND SEARCH'}</SectionLabel>
            <S.StoryBody>
              {'useCommandSearch filters a list of command definitions by name, alias, and description — the backbone of command palette UIs. useSearchSchema introspects the searchable fields of any array.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Auto-detection skips id, key, uuid, type, kind, index, href, url, src, path, color, icon — focusing on human-readable string fields.'}
            </S.StoryCap>
          </Box>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="database" />
        <S.StoryBreadcrumbActive>{'Storage'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
