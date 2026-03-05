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
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, TextInput } from '../../../packages/core/src';
import { useLocalStore } from '../../../packages/core/src/useLocalStore';
import { useHotState } from '../../../packages/core/src/useHotState';
import { useSearch, useFuzzySearch } from '../../../packages/core/src/useSearch';
import { useThemeColors } from '../../../packages/theme/src';

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

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
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
    <Box style={{ gap: 10, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>{'Persists to SQLite — reload the app and values stay'}</Text>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.green }}>{'Counter (useLocalStore)'}</Text>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
              <Text style={{ fontSize: 10, color: c.text }}>{'Reset'}</Text>
            </Box>
          </Pressable>
        </Box>
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
    </Box>
  );
}

// ── Live Demo: useHotState ───────────────────────────────

function HotStateDemo() {
  const c = useThemeColors();
  const [tab, setTab] = useHotState('demo:tab', 0);
  const [open, setOpen] = useHotState('demo:sidebar', true);

  const tabs = ['Home', 'Settings', 'Profile'];

  return (
    <Box style={{ gap: 10, width: '100%' }}>
      <Text style={{ fontSize: 9, color: c.muted }}>{'Survives HMR — edit code and tab stays selected'}</Text>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.yellow }}>{'Active tab (useHotState)'}</Text>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
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
        </Box>
      </Box>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 9, color: C.yellow }}>{'Sidebar toggle (useHotState)'}</Text>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable onPress={() => setOpen(!open)}>
            <Box style={{ backgroundColor: open ? C.green : C.red, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12 }}>
              <Text style={{ fontSize: 10, color: '#1e1e2e' }}>{open ? 'Open' : 'Closed'}</Text>
            </Box>
          </Pressable>
          <Text style={{ fontSize: 9, color: c.muted }}>{'Lost on full restart — use useLocalStore for that'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Live Demo: Search ────────────────────────────────────

function SearchDemo() {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const results = useSearch(SEARCH_ITEMS, query, { key: ['name', 'role'] });

  return (
    <Box style={{ gap: 8, width: '100%' }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search people..."
        style={{ fontSize: 10, color: c.text, backgroundColor: c.surface1, borderRadius: 6, padding: 8 }}
      />
      <Box style={{ gap: 3 }}>
        {results.map(item => (
          <Box key={item.name} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.blue }} />
            <Text style={{ fontSize: 10, color: c.text, flexShrink: 0 }}>{item.name}</Text>
            <Text style={{ fontSize: 9, color: c.muted }}>{item.role}</Text>
          </Box>
        ))}
        {results.length === 0 && query.length > 0 && (
          <Text style={{ fontSize: 9, color: C.red }}>{'No matches'}</Text>
        )}
      </Box>
    </Box>
  );
}

// ── Tier Overview ────────────────────────────────────────

function TierOverview() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4, width: '100%' }}>
      {TIERS.map(t => (
        <Box key={t.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, flexShrink: 0 }}>{t.label}</Text>
          <Text style={{ fontSize: 8, color: t.color, flexShrink: 0 }}>{t.persist}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{`survives ${t.survives}`}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Adapter List ─────────────────────────────────────────

function AdapterList() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4, width: '100%' }}>
      {ADAPTERS.map(a => (
        <Box key={a.name} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: a.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, flexShrink: 0 }}>{a.name}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{a.target}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── StorageStory ─────────────────────────────────────────

export function StorageStory() {
  const c = useThemeColors();

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
        <Image src="database" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Storage'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Forget me knots'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

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
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Four tiers of persistence. Pick the right one.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'useHotState for HMR-surviving UI state. useLocalStore for restart-surviving app data. DocStore for MongoDB-like queries. SQLite FFI for raw SQL. Plus @reactjit/storage for Zod schemas, CRUD hooks, and 5 pluggable adapters.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Core hooks (useLocalStore, useHotState, useSearch) live in @reactjit/core. Schema validation, CRUD hooks, and adapters are in @reactjit/storage.'}
            </Text>
            <TierOverview />
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band 2: demo | text + code — useLocalStore ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <LocalStoreDemo />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="save">{'useLocalStore'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Drop-in replacement for useState that persists to SQLite. Values are JSON-encoded with 300ms debounced writes. Optional namespace for grouping related keys.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Backed by lua/localstore.lua — a key-value table in localstore.db. The hook loads the initial value on mount via RPC, then debounces writes. Survives full app restart.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={LOCALSTORE_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: text + code | demo — useHotState ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="zap">{'useHotState'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Lives in Lua memory — survives HMR because the Lua process persists across JS reloads. Zero flash on mount: reads synchronously from __hotstateCache. No async delay.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Use for ephemeral UI state: active tab, sidebar open/closed, scroll position. Lost on full restart — upgrade to useLocalStore when you need true persistence.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={HOTSTATE_CODE} />
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
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'useHotState = fast, ephemeral, HMR-safe. useLocalStore = persistent, debounced, SQLite-backed. Both are drop-in useState replacements — same [value, setValue] API.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 4: text + code | code — DocStore ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="hard-drive">{'DOCSTORE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'MongoDB-like document store built on SQLite. Save, find, update, remove — with query operators for filtering. All Lua-side, zero JS overhead.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Documents get auto-generated _id fields. Queries support gt, gte, lt, lte, ne, like, and contains operators. Results are plain Lua tables.'}
            </Text>
            <CodeBlock language="lua" fontSize={9} code={DOCSTORE_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <Text style={{ color: c.muted, fontSize: 9, marginBottom: 4 }}>{'Query operators:'}</Text>
            <CodeBlock language="lua" fontSize={9} code={QUERY_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: code | text — SQLite FFI ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <CodeBlock language="lua" fontSize={9} code={SQLITE_CODE} />
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="terminal">{'SQLITE FFI'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Raw SQLite bindings via LuaJIT FFI. Full SQL — CREATE, INSERT, SELECT, joins, transactions. For when DocStore is too abstract and you need direct control.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'sqlite.open(path) for file-backed or sqlite.open() for in-memory. Parameterized queries prevent injection. db:changes() returns affected rows. db:busyTimeout(ms) handles lock contention.'}
            </Text>
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
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'DocStore and SQLite run entirely in Lua via FFI — zero bridge round-trips for queries. useLocalStore and useHotState bridge to these via RPC for React integration.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 6: text + code | text + list — CRUD + Schemas ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="layers">{'CRUD + SCHEMAS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Define a Zod-inspired schema, get a typed CRUD handle with create, get, update, delete, list. Includes reactive hooks: useQuery and useListQuery for auto-refetching.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={CRUD_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="check-circle">{'SCHEMA VALIDATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The z builder supports string, number, boolean, object, array, optional, nullable, and default. parse() throws, safeParse() returns a result object.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SCHEMA_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: text + list | code — ADAPTERS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="settings">{'ADAPTERS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useCRUD reads its adapter from StorageProvider context. Swap backends without changing application code. Five built-in adapters cover every deployment target.'}
            </Text>
            <AdapterList />
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All adapters implement the same interface: get, set, delete, list. Custom adapters just need those four methods.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={ADAPTER_CODE} />
        </Box>

        <Divider />

        {/* ── Band 8: code | text — MIGRATIONS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row' }}>
          <CodeBlock language="tsx" fontSize={9} code={MIGRATION_CODE} />
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="git-merge">{'MIGRATIONS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Schema versions are tracked via a _version field on each document. Migration functions transform old shapes to new. autoMigrate applies them on read — no separate migration step.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Each migration function receives the old document and returns the new shape. Versions are integers, applied in order. Missing fields get defaults from the schema.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useSearch filters in-memory arrays by substring match. useFuzzySearch adds scoring and ranking. Both auto-detect searchable fields (strings and numbers, skipping ids and URLs).'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SEARCH_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 10: text + code | text — SEARCH EXTRAS ── */}
        <Box style={{ ...bandStyle, flexDirection: 'row', paddingBottom: 24 }}>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="clock">{'SEARCH HISTORY & HIGHLIGHT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useSearchHistory persists recent queries to SQLite via useLocalStore. useSearchHighlight splits text into matched/unmatched parts for rendering highlighted results.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SEARCH_HISTORY_CODE} />
          </Box>
          <Box style={{ ...halfStyle }}>
            <SectionLabel icon="command">{'COMMAND SEARCH'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useCommandSearch filters a list of command definitions by name, alias, and description — the backbone of command palette UIs. useSearchSchema introspects the searchable fields of any array.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Auto-detection skips id, key, uuid, type, kind, index, href, url, src, path, color, icon — focusing on human-readable string fields.'}
            </Text>
          </Box>
        </Box>

      </ScrollView>

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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="database" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Storage'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
