# TODO: Templates & Demo Library — Showcase Everything, Inspire Everything

## Philosophy

Every template should make someone think "I could build that." We provide the base — functional, beautiful, modifiable — and they take it wherever they want. The methodology is systematic: cover every package, show cross-package integration, and fill the gaps between "component story" and "real app."

### Rules for every template

1. **Functional out of the box** — not a mockup, not placeholder data. It works. Buttons do things. Data flows. State persists.
2. **Looks appetizing** — dark-first, polished, the kind of thing you screenshot and share. Not "dev tool grey."
3. **Self-contained** — one file per template. Copy it, drop it in your project, it runs. No hidden dependencies on storybook internals.
4. **Modifiable** — clean structure, obvious customization points. No clever abstractions that make it hard to rip apart.
5. **Shows crossover** — each template should naturally use 3+ packages together. The AI chat uses `@ilovereact/ai` + storage + animation. The music player uses audio + storage + animation + router.

## Coverage methodology

### Tier 1: Package showcase templates
One template per package that didn't already have a demo. These prove the package works in a real context.

### Tier 2: Cross-package integration templates
Templates that combine 3+ packages in ways that feel like real apps. These show the framework's strength.

### Tier 3: "I'd actually use this" templates
Templates polished enough that someone might use them as-is or as the starting point for a real project.

---

## Inventory: what exists vs. what's missing

### Packages with demos already

| Package | Existing demo | Coverage |
|---------|--------------|----------|
| `@ilovereact/core` | Every primitive/component story | Good for reference, missing "real app" context |
| `@ilovereact/ai` | AI Chat, AI Canvas, MCP Server | Strong |
| `@ilovereact/apis` | REST APIs story | Minimal — just shows the hook |
| `@ilovereact/rss` | RSS Feeds story | Minimal |
| `@ilovereact/webhooks` | Webhooks story | Minimal |
| `@ilovereact/crypto` | Crypto story | Minimal |
| Networking (core) | Fetch, WebSocket stories | Minimal |
| System hooks | Neofetch, Weather, Data Dashboard | Good |

### Packages with NO demo

| Package | What it does | Needs |
|---------|-------------|-------|
| `@ilovereact/router` | Client-side routing (Route, Link, useNavigate, useParams) | Multi-page app template |
| `@ilovereact/storage` | Persistent data (SQLite, files, memory, web adapters) | CRUD app template |
| `@ilovereact/audio` | Audio playback, visualization | Music player template |
| `@ilovereact/server` | HTTP server hooks | API server template |
| `@ilovereact/components` | Card, Badge, Divider, FlexRow, FlexColumn, Spacer | Used everywhere but no dedicated app-level demo |

---

## Template list

### Tier 1: Package showcases (fill the gaps)

#### 1. Music Player
**Packages:** `audio`, `storage`, `animation`, core
**Shows:** Audio playback, playlist management, waveform visualization, animated progress, persistent library
**UI:** Album art grid, now-playing bar, playlist sidebar, animated equalizer bars
**Crossover:** Storage for saved playlists, animation for playback transitions, Sparkline for waveform

#### 2. Multi-Page App (Router Demo)
**Packages:** `router`, `components`, `animation`, core
**Shows:** Route definitions, navigation, URL params, nested routes, animated page transitions
**UI:** Sidebar nav with active state, breadcrumbs, tabbed content areas, 404 page
**Crossover:** NavPanel + Tabs + Breadcrumbs from navigation stories all working together in a real app

#### 3. Notes App (Storage Demo)
**Packages:** `storage`, `router`, `crypto`, core
**Shows:** CRUD operations, persistent data, search/filter, encrypted notes option
**UI:** Note list sidebar, markdown-ish editor (TextEditor), tag system, search bar
**Crossover:** Storage for persistence, crypto for optional encryption, router for note/:id deep links

#### 4. API Dashboard (Server Demo)
**Packages:** `server`, `apis`, `storage`, core
**Shows:** HTTP server endpoints, request/response logging, rate limiting, API key management
**UI:** Endpoint list, live request log, response inspector, latency charts
**Crossover:** Server for endpoints, storage for API keys, BarChart/Sparkline for metrics

#### 5. Feed Reader (RSS + Webhooks + Fetch)
**Packages:** `rss`, `webhooks`, `storage`, core
**Shows:** Subscribe to feeds, live updates via webhooks, persistent read state, article viewer
**UI:** Feed list sidebar, article list, reading pane, unread counts
**Crossover:** RSS for feed parsing, webhooks for push notifications, storage for read/unread state

#### 6. Password Manager (Crypto Showcase)
**Packages:** `crypto`, `storage`, core
**Shows:** Key derivation, encryption/decryption, secure clipboard copy, password generation
**UI:** Vault list, entry detail view, password generator with strength meter, master password unlock
**Crossover:** Crypto for all encryption, storage for the vault, ProgressBar for password strength

### Tier 2: Cross-package integration

#### 7. Chat Room (Real-time)
**Packages:** `websocket`, `storage`, `crypto`, `animation`, core
**Shows:** Real-time messaging, message persistence, end-to-end encryption, typing indicators
**UI:** Message list with bubbles, input bar, user list sidebar, animated message arrival
**Crossover:** WebSocket for real-time, storage for message history, crypto for E2E, spring animations for message slide-in

#### 8. Project Manager / Kanban Board
**Packages:** `storage`, `router`, `components`, `animation`, core
**Shows:** Drag-and-drop columns, task CRUD, persistent state, route per board
**UI:** Three-column kanban (todo/doing/done), task cards with badges, add/edit modals, board switcher
**Crossover:** Storage for tasks, router for /board/:id, Card/Badge from components, animated card movement

#### 9. System Monitor (Neofetch Extended)
**Packages:** System hooks, `storage`, `rss`, core
**Shows:** Live CPU/memory/GPU/network, historical data logging, alert thresholds, export to RSS feed
**UI:** Full-screen dashboard with charts, sparklines, process table, GPU panel, alert banners
**Note:** Extends existing Neofetch demo into a full monitoring suite. The current Neofetch is blocked on the sysmon RPC bug (see BUG-neofetch-sysmon.md)

#### 10. AI Code Assistant
**Packages:** `ai`, `mcp`, `storage`, `crypto`, core
**Shows:** Multi-provider chat, MCP tool use, conversation persistence, API key encryption
**UI:** Chat interface with code blocks, tool call visualization, model switcher, conversation history sidebar
**Crossover:** AI for inference, MCP for tool integration, storage for history, crypto for API key storage

### Tier 3: "I'd actually use this"

#### 11. Terminal Emulator
**Packages:** Core, `storage`, `animation`
**Shows:** Command input, output scrollback, command history, tab completion
**UI:** Full-screen terminal with blinking cursor, scrollable output, status bar
**Why:** Shows that iLoveReact can build something that feels like a native tool, not just a UI demo

#### 12. File Browser
**Packages:** Core, `storage`, `router`
**Shows:** Directory tree, file preview, breadcrumb navigation, sort/filter
**UI:** Two-pane layout (tree + detail), file type icons (Box geometry), metadata panel
**Crossover:** Router for path navigation, storage for bookmarks/recent

#### 13. Dashboard Builder
**Packages:** `storage`, `components`, `animation`, core
**Shows:** Drag-and-drop widget placement, resizable panels, widget library, layout persistence
**UI:** Grid layout with movable cards, widget picker drawer, save/load layouts
**Crossover:** Storage for layouts, Card/Badge from components, animation for drag feedback

#### 14. Markdown Viewer
**Packages:** Core, `storage`, `router`
**Shows:** Parse and render markdown as iLoveReact components, heading anchors, code blocks, tables
**UI:** Sidebar TOC, styled headings/paragraphs/lists/code blocks, scroll-spy
**Why:** Proves the framework can do rich document rendering, not just dashboards

#### 15. Game HUD Overlay
**Packages:** Core, `audio`, `animation`, system hooks
**Shows:** Health/mana bars, minimap, inventory grid, damage numbers, cooldown timers
**UI:** Transparent overlay layout with animated elements, responsive to viewport size
**Why:** The original use case for iLoveReact — proving it's actually good at game UI

#### 16. Email Client
**Packages:** `apis`, `storage`, `router`, `crypto`, core
**Shows:** Inbox/sent/drafts, compose with rich text, search, encrypted drafts
**UI:** Three-column layout (folders/list/reading pane), compose modal, search bar
**Crossover:** APIs for IMAP/SMTP simulation, storage for local cache, router for mailbox navigation, crypto for draft encryption

#### 17. Media Gallery
**Packages:** Core, `storage`, `animation`
**Shows:** Image grid with lightbox, video thumbnails, drag-to-reorder, album organization
**UI:** Masonry-ish grid layout, full-screen viewer with zoom, album sidebar
**Crossover:** Image + Video primitives, storage for album metadata, spring animations for transitions

#### 18. Form Builder
**Packages:** Core, `storage`, `components`
**Shows:** Drag-and-drop form fields, live preview, validation rules, submission storage
**UI:** Field palette sidebar, canvas with draggable fields, property editor, preview toggle
**Crossover:** Every form component (Checkbox, Radio, Select, Slider, Switch, TextInput), storage for form definitions

#### 19. Torrent-Style Download Manager
**Packages:** `websocket`, `storage`, core
**Shows:** Download queue, progress tracking, speed graphs, file priority
**UI:** Download list with ProgressBars, speed Sparklines, detail panel, add URL dialog
**Crossover:** WebSocket for transfer simulation, storage for download history, ProgressBar + Sparkline for visualization

#### 20. Clock / Timer / Stopwatch Suite
**Packages:** Core, `audio`, `animation`, `storage`
**Shows:** Analog clock (Box geometry), countdown timer, lap stopwatch, alarm with sound
**UI:** Tab-based (clock/timer/stopwatch/alarm), animated clock hands, smooth countdown
**Why:** Simple but visually rich — proves animation and precision timing work. Good "first template to try."

---

## Component coverage matrix

Every primitive and component should appear in at least 2 templates beyond its own story:

| Component | Stories using it | Templates that will use it |
|-----------|-----------------|---------------------------|
| Box | Everything | Everything |
| Text | Everything | Everything |
| Image | Image story | Media Gallery, Music Player, Game HUD |
| Video | Video story | Media Gallery |
| Pressable | Pressable story | Every template (buttons everywhere) |
| ScrollView | ScrollView story | Notes, Feed Reader, Chat, Email, File Browser |
| TextInput/TextEditor | Input stories | Notes, Chat, Email, Form Builder, Terminal |
| Slider | Slider story | Music Player, Dashboard Builder, Settings |
| Switch | Switch story | Settings, Form Builder |
| Checkbox | Checkbox story | Form Builder, Project Manager, Notes |
| Radio | Radio story | Form Builder, Settings |
| Select | Select story | Form Builder, API Dashboard, Email |
| Table | Table story | API Dashboard, System Monitor, Project Manager |
| BarChart | BarChart story | System Monitor, API Dashboard, Dashboard Builder |
| ProgressBar | ProgressBar story | Music Player, Download Manager, Game HUD |
| Sparkline | Sparkline story | System Monitor, Download Manager, Dashboard Builder |
| NavPanel | NavPanel story | Multi-Page App, Email, File Browser |
| Tabs | Tabs story | Multi-Page App, Clock Suite, System Monitor |
| Breadcrumbs | Breadcrumbs story | Multi-Page App, File Browser |
| Toolbar | Toolbar story | Notes, Email, Dashboard Builder |
| Card | Card story | Project Manager, Feed Reader, Dashboard Builder |
| Badge | Badge story | Project Manager, Email, Feed Reader, Chat |
| Modal | Settings demo | Notes, Email, Form Builder, Project Manager |
| Divider | Divider story | Everywhere (section separators) |

## Package coverage matrix

Every package should appear in at least 2 templates:

| Package | Templates |
|---------|-----------|
| `@ilovereact/router` | Multi-Page App, Notes, File Browser, Email |
| `@ilovereact/storage` | Notes, Music Player, Project Manager, Chat, API Dashboard, Feed Reader, Password Manager, every "persistence" template |
| `@ilovereact/audio` | Music Player, Clock Suite (alarms), Game HUD |
| `@ilovereact/server` | API Dashboard |
| `@ilovereact/ai` | AI Code Assistant, AI Chat (existing), AI Canvas (existing) |
| `@ilovereact/apis` | Email, API Dashboard, Feed Reader |
| `@ilovereact/rss` | Feed Reader, System Monitor (alerts as feeds) |
| `@ilovereact/webhooks` | Feed Reader, API Dashboard |
| `@ilovereact/crypto` | Password Manager, Notes (encrypted), Chat (E2E), Email (drafts) |
| `@ilovereact/components` | Every template (Card, Badge, Divider, Spacer are universal) |

## Build order

Phase 1 — Fill the package gaps (Tier 1):
1. Music Player (audio — zero demos currently)
2. Multi-Page App (router — zero demos currently)
3. Notes App (storage — zero demos currently)

Phase 2 — Crowd pleasers (visually impressive, sharable):
4. Game HUD Overlay
5. Chat Room
6. Clock Suite
7. Project Manager / Kanban

Phase 3 — Depth (show the framework handles complexity):
8. AI Code Assistant
9. Feed Reader
10. File Browser
11. Terminal Emulator

Phase 4 — Complete the set:
12-20. Remaining templates in any order, prioritizing whichever packages still lack coverage

## Quality bar

Each template ships with:
- [ ] Functional — all interactions work, state flows correctly
- [ ] Polished — dark theme, consistent spacing, animated transitions where appropriate
- [ ] Responsive — works at 800x600 and 1920x1080 (flex layout, not hardcoded positions)
- [ ] Copyable — clean imports, no storybook internal paths, documented customization points
- [ ] Storybook story — registered in `stories/index.ts` under a "Templates" category
- [ ] Playground template — available in the playground picker for instant use
