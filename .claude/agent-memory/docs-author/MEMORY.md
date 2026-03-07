# Docs Author Memory

## Content Format
- Docs live in `content/sections/NN-section-name/` as `.txt` files
- Required sections: `=== METADATA ===` (title, description, category, platforms, keywords, difficulty)
- Optional sections: `=== OVERVIEW ===`, `=== API / SYNTAX ===`, `=== EXAMPLES ===`, `=== PLATFORM NOTES ===`, `=== CRITICAL RULES ===`, `=== COMMON PATTERNS ===`, `=== SEE ALSO ===`
- Examples: `Example N: Title` then `---` code `---` then `Platforms: love2d`
- Index files use OVERVIEW and optionally EXAMPLES; non-index files should have OVERVIEW
- Valid platforms: love2d (web/terminal/etc removed in architecture purge)
- Valid difficulties: beginner, intermediate, advanced
- Validation: `npm run validate:docs` (runs `npx tsx scripts/docs/build.ts validate`)
- Parser: `scripts/docs/parser.ts`, Validator: `scripts/docs/validate.ts`

## Source Files
- Types: `packages/core/src/types.ts` -- Style interface, BoxProps, TextProps, ImageProps, etc.
- Primitives: `packages/core/src/primitives.tsx` -- Box, Row, Col, Text, Image
- Layout engine: `lua/layout.lua` -- the actual flex layout implementation
- Linter: `cli/commands/lint.mjs` -- static layout linter rules

## Layout Engine Facts (verified against layout.lua)
- flexDirection defaults to "column" (line 657)
- alignItems defaults to "stretch" (line 1154)
- Default fontSize: 14px (line 307)
- Rows auto-wrap by default UNLESS any child has flexGrow > 0 (lines 1155-1411)
- Surface types: View, Image, Video, VideoPlayer, Scene3D, Emulator, Render, Chart2D
- Surface fallback: `ph / 4` using resolved parent height (line 1972)
- Scroll containers excluded from isSurface (line 176)
- flexShrink defaults to 1 (line 1531)
- Units: number (px), '%', 'vw', 'vh', 'calc(X% +/- Ypx)', 'fit-content'/'fit'

## Linter Removed Rules (engine handles now)
- no-text-without-fontsize, no-unicode-symbol-in-text, no-row-justify-without-width
- no-flexrow-flexcolumn, no-uncontexted-flexgrow, no-deep-flex-nesting
- no-implicit-container-sizing

## Conventions
- Always use `useThemeColors()` in examples, never hardcoded colors
- `useThemeColors` is from `@reactjit/theme`, NOT `@reactjit/core` (core has `useThemeColorsOptional` which is different)
- Use `flexGrow: 1` not hardcoded pixel heights
- Platform is `love2d` for all current docs
- Template literals in Text: `{`Score: ${score}`}` not mixed children
- No paddingHorizontal/paddingVertical (linter rejects)
- The `Read` tool sometimes has permission issues on first parallel call; retry individually
- Content format spec is at `.claude/docs-generator/references/content-format.md` (project-local), NOT the skills directory

## Component Docs (05-components)
- Layout components: FlexRow, FlexColumn, Spacer, Card, Badge, Divider (all written 2026-03-06)
- Navigation components: NavPanel, Tabs, Breadcrumbs, Toolbar, Table (all written 2026-03-06)
- Existing core primitives: Box, Text, Image, Pressable, ScrollView, Modal, FlatList, Portal, Video
- Component source files: `packages/core/src/<ComponentName>.tsx` (one component per file)
- NavPanel, Tabs, Toolbar, Breadcrumbs use `useThemeColorsOptional()` internally with fallbacks
- Card and Badge use hardcoded dark colors -- note this in PLATFORM NOTES for theme integration
- Table is generic (`Table<T>`) -- columns with no width use flexGrow:1, fixed-width tables shrink-wrap
- Spacer without size = flexGrow:1; with size = fixed height (note: height not width, important caveat)
- FlexRow has wrap prop; FlexColumn does not (matches source)
- Input/form components (written 2026-03-06): Input (textinput.txt), CodeBlock, Math, ContextMenu, Slider, Switch, Checkbox, Radio/RadioGroup, Select, MonacoMirror
- Input is the unified text input (Input.tsx); TextInput.tsx is a deprecated alias
- Input emits either 'TextInput' (single-line) or 'TextEditor' (multiline+editor features) host element based on props
- MonacoMirror is a React compound component wrapping Input with VS Code chrome (NOT a Lua primitive)
- Math is internally named MathBlock to avoid shadowing globalThis.Math
- Select serializes options as JSON.stringify() to cross the bridge
- Radio requires RadioGroup ancestor (uses React context for selection state)
- All form controls (Slider, Switch, Checkbox, Radio, Select) support controlled + uncontrolled modes
- Chart components (written 2026-03-06): BarChart, ProgressBar, Sparkline, HorizontalBarChart, StackedBarChart, LineChart, AreaChart, PieChart, RadarChart, CandlestickChart, DepthChart, OrderBook
- Chart2D surface components: BarChart, LineChart, AreaChart, PieChart, CandlestickChart, DepthChart (rendered by lua/chart.lua)
- Box-primitive charts (NOT Chart2D): ProgressBar, Sparkline, HorizontalBarChart, StackedBarChart, RadarChart (use polygonPoints style)
- OrderBook has its own Lua node type ('OrderBook'), not Chart2D
- AreaChart is a thin wrapper around LineChart with showArea=true, showDots=false, areaOpacity=0.4
- CandlestickChart supports ChartOverlay[] for MA/EMA/Bollinger indicators
- Miscellaneous components (written 2026-03-06): ImageGallery, BentoImageGallery, HoverPreviewRowsGallery, ImageViewerModal, Emulator, Terminal, SemanticTerminal, SearchBar, SearchResults, SearchCombo, CommandPalette, AppSearch, Searchable, MessageBubble, ChatInput, MessageList, DebugOverlay, DebugBox, useDebugOverlay, PixelArt, usePixelArt, Fleet, useFleet, Render, VideoPlayer
- Search system: components in `packages/core/src/search/` (SearchBar, SearchResults, SearchCombo, CommandPalette, AppSearch, Searchable); hooks in `packages/core/src/useSearch.ts` + `useAppSearch.ts`
- ImageGallery family: ImageGallery.tsx, BentoImageGallery.tsx, HoverPreviewRowsGallery.tsx, ImageViewerModal.tsx
- Chat components: MessageBubble.tsx, ChatInput.tsx, MessageList.tsx (use hardcoded dark colors like #1e293b, #2563eb)
- Terminal vs SemanticTerminal: Terminal is non-visual (capability node), SemanticTerminal is visual (renders, needs sizing)
- Fleet uses useFleet hook, manages N concurrent Claude Code sessions, session-scoped RPCs
- Render component in primitives.tsx (not a standalone file), routes through Native host element
- VideoPlayer in VideoPlayer.tsx, extends VideoProps with controls prop
- PixelArt/usePixelArt: built-in symbol bitmaps (play, pause, stop, check, arrows, heart, star, etc.), custom string art
- search.txt is a large doc covering 6 components + 8 hooks -- the most comprehensive single doc file

## Architecture Docs (02-architecture)
- Written 2026-03-06: index, pipeline, reconciler, layout-engine, painter, transport, source-of-truth
- Architecture category, intermediate difficulty, love2d platform
- index.txt: overview-only (no API/SYNTAX, no EXAMPLES per format spec for index files)
- pipeline.txt: frame cycle walkthrough (love.update -> love.draw), mutation command types list
- reconciler.txt: Instance interface, extractHandlers, partial diffing, command coalescing, HTML remapping
- transport.txt: host functions (__hostFlush, __hostGetEvents, __hostMeasureText), NativeBridge, RPC flow
- layout-engine.txt: three sizing tiers, surface types, unit resolution, flex defaults
- painter.txt: draw order, overflow clipping (stencil vs scissor), z-index, opacity multiplication
- source-of-truth.txt: file ownership map, sync pipeline (make cli-setup -> reactjit update), storybook symlinks
- Key sources: hostConfig.ts, NativeBridge.ts, eventDispatcher.ts, bridge_quickjs.lua, tree.lua, layout.lua, painter.lua

## Hook Docs (06-hooks)
- Written 2026-03-06: index, usebridge, uselove, useloveevent, useloverpc, uselovestate, useloveready, uselovesend, useloveoverlays, usewindowdimensions, usehotkey, useclipboard, uselocalstore, usehotstate
- Hooks category, intermediate difficulty (useloveready and useclipboard are beginner, useloveoverlays is advanced)
- Source: `packages/core/src/hooks.ts` (useLove, useLoveEvent, useLoveRPC, useLoveState, useLoveReady, useLoveSend, useLoveOverlays, useWindowDimensions, useWindowSize, useWindowPosition, useWindowAlwaysOnTop, useHotkey, useClipboard, useFetch, useWebSocket, usePeerServer, useLuaInterval)
- Source: `packages/core/src/context.ts` (useBridge, useBridgeOptional)
- Source: `packages/core/src/useLocalStore.ts`, `useHotState.ts`, `useBreakpoint.ts`, `useCapabilities.ts`
- Source: `packages/core/src/overlay.ts` (useOverlay), `useEvents.ts` (useEventBus, useEvent, useEventState, useEmit), `useIFTTT.ts`
- IBridge interface in `packages/core/src/bridge.ts`: send, flush, subscribe, rpc, setState, isReady, onReady, destroy
- useWindowDimensions.txt covers 4 hooks: useWindowDimensions + useWindowSize + useWindowPosition + useWindowAlwaysOnTop
- WindowControlOptions shared by size/position/alwaysOnTop: windowId, animate, duration, revert
- useLocalStore: debounced 300ms writes to SQLite via `localstore:get`/`localstore:set` RPCs, namespace option defaults to 'app'
- useHotState: reads from globalThis.__hotstateCache synchronously on first render (zero flash), writes immediately to Lua memory table
- useBreakpoint: sm(0), md(640), lg(1024), xl(1440) thresholds
- Utility hooks (written 2026-03-06): usefetch, usewebsocket, usepeerserver, useluainterval, usesysteminfo, usesystemmonitor, useports, usedebug, usesearch, usescrape, usegpio, useutils, usescale, userecorder, usepty, usesemanticterminal, usefleet, useoverlay, useevents, useifttt, usecapabilities, usebreakpoint
- useSearch doc covers 7 hooks in one file: useSearch, useFuzzySearch, useAsyncSearch, useSearchHistory, useSearchHighlight, useCommandSearch, useSearchSchema
- useGPIO doc covers 4 hooks: usePin, usePWM, useSerial, useI2C -- each returns `element` that MUST be rendered
- useUtils doc covers 16+ hooks: useId, useUUID, useDeepEqual, useTruncate, useSlugify, useCamelCase, useSnakeCase, useKebabCase, usePascalCase, usePluralize, useTimeAgo, useFormatDate, useMsParse, useMsFormat, useDuration, useSafeStringify, useUtilsBatch
- useRecorder doc covers 2 hooks: useGifRecorder + useRecorder
- Hook files use `.ts` extension (not `.tsx`) except useGPIO.tsx (renders JSX internally)
- Total files in 06-hooks/: 36 (index + 13 pre-existing bridge/state hooks + 22 new utility hooks)

## Animation Docs (07-animation)
- Written 2026-03-06: index, animatedvalue, useanimation, usespring, usetransition, easing, composite, presets
- Animation category, intermediate difficulty, love2d platform
- Two animation layers: JS-driven (useAnimation/useSpring/useTransition/composites/presets) and Lua-driven (style.transition, style.animation keyframes, strokeDasharray/offset)
- JS animations driven by Lua's love.update(dt) via tickAnimations() -- no independent JS timers
- Source: `packages/core/src/animation.ts` (AnimatedValue, useAnimation, useSpring, useTransition, Easing, parallel/sequence/stagger/loop)
- Source: `packages/core/src/animationPresets.ts` (usePulse, useCountUp, useTypewriter, useShake, useEntrance, useBounce, useRepeat)
- Lua transition/keyframe types in `packages/core/src/types.ts` lines 167-190
- Easing has static functions (linear, easeIn, easeOut, easeInOut, bounce) and factories (elastic(bounciness), bezier(x1,y1,x2,y2))
- Lua easing strings: 'linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'elastic'
- TimingConfig defaults: duration=300, easing=easeInOut, delay=0
- SpringConfig defaults: stiffness=100, damping=10, mass=1, velocity=0, restThreshold=0.001
- useSpring hook defaults: stiffness=100, damping=10 (from SpringConfig); useBounce preset: stiffness=180, damping=12
- AnimatedValue.interpolate supports rgba() color strings and numeric ranges
- useTypewriter uses setTimeout internally (not frame loop), so timing is approximate

## Routing Docs (08-routing)
- Written 2026-03-06: index, router
- Routing category, intermediate difficulty, love2d platform
- index.txt: overview-only listing three layers (history, matching, components/hooks)
- router.txt: full API reference with ---- subsection headers for each export
- Source: `packages/router/src/` -- index.ts, context.tsx, components.tsx, matcher.ts, history.ts, types.ts
- Key exports: RouterProvider, Routes, Route, Link, Navigate, Outlet, useRouter, useNavigate, useLocation, useParams, useRoute, createMemoryHistory, createBrowserHistory
- Route matching scoring: static=4, required param=3, optional param=2, wildcard=1
- Link renders `<a>` which reconciler remaps to View (HTML_TYPE_MAP in hostConfig.ts)
- createBrowserHistory() only for WASM builds (needs window.history)
- Route is a marker component -- actual rendering done by Routes container

## Targets Docs (09-targets)
- Written 2026-03-06: index, love2d, wasm
- Targets category, love2d platform
- index.txt intermediate, love2d.txt intermediate, wasm.txt advanced
- Target interface: lua/target_love2d.lua -- { name, measure, images, videos, painter }
- Native: QuickJS FFI bridge (bridge_quickjs.lua), synchronous in-process
- WASM: love.js + Emscripten, Module.FS file polling (bridge_fs.lua), JS runs natively in browser
- WASM entry: createWasmApp() from @reactjit/renderer, entry file main-wasm.tsx or main-web.tsx
- WASM uses PUC Lua 5.1 (not LuaJIT), no multi-window support
- conf.lua: identity, window.title/width/height/vsync/msaa/resizable, modules.joystick/physics
- main.lua: ReactJIT.init({ mode, bundlePath, libpath }), love callbacks forward via safeCall()
- Multi-window: <Window> spawns child Love2D process via TCP IPC (window_manager.lua)

## Advanced Docs (10-advanced)
- Written 2026-03-06: index, event-handling, focus-management, lua-runtime, performance, debugging, devtools, rendering, capabilities, session-recording
- Advanced category, advanced difficulty, love2d platform
- index.txt: overview-only listing 9 topic areas
- event-handling.txt: 3 dispatch modes (bubbling, target-only, broadcast), LoveEvent shape, hit test logic from events.lua
- focus-management.txt: FocusGroup component, controller/mouse input modes, spatial navigation, keystrokeTarget/submitTarget/escapeTarget
- lua-runtime.txt: LuaJIT stack, QuickJS FFI bridge, adding new modules, capability registration pattern
- performance.txt: hoisting styles, static strings, useMemo, theme cache bug pattern (module-level C.* objects go stale)
- debugging.txt: useDebug (globalThis.__debug), DebugOverlay/DebugBox, registerDebug, error overlay, console watch expressions
- devtools.txt: Chrome-style bottom panel, 7 tabs (Elements/Console/Network/Perf/Wireframe/Logs/Source), pop-out, DevToolsEmbed component
- rendering.txt: Render component for external capture (screen/cam/hdmi/window/display/vm), objectFit, RenderProps
- capabilities.txt: full lifecycle (register/create/update/tick/destroy), schema for AI discovery, pushEvent pattern, useCapabilities hook
- session-recording.txt: session_recorder.lua, .rec.lua format, Recorder API (new/start/stop/capture/export/save/load)
- Key sources: events.lua, focus.lua, inspector.lua, devtools/main.lua, capabilities.lua, session_recorder.lua, eventDispatcher.ts, useCapabilities.ts, useDebug.ts, DebugOverlay.tsx

## Troubleshooting Docs (11-troubleshooting)
- Written 2026-03-06: index, common-errors, faq
- Troubleshooting category, beginner difficulty, love2d platform
- index.txt: brief overview pointing to common-errors and faq
- common-errors.txt: 8 examples covering mixed text children, proportional fallback, ScrollView sizing, root container, stale theme, paddingHorizontal, silent handler loss, CRLF
- faq.txt: 6 examples covering no DOM, no CSS, flexGrow vs heights, capability system for features, browser API alternatives, click debugging checklist
- Pattern: each FAQ/error uses Example format with narrative explanation inside the code block delimiters

## API Reference Docs (12-api-reference)
- Written 2026-03-06: index, spotify, tmdb, github, weather, home-assistant, lastfm, plex, trakt, notion, todoist, ynab, google, hue, nasa, coingecko, steam, telegram, polypizza, style-properties, types
- Total files: 21 (index + 10 original services + 9 new services + style-properties + types)
- API Reference category, intermediate difficulty, love2d platform
- Source: `packages/apis/src/` -- base.ts (useAPI, useAPIMutation, bearer, qs), registry.ts (ServiceDefinition, builtinServices), useServiceKey.ts, rateLimit.ts, settings.ts
- All service hooks follow pattern: first arg is key/token (null to disable), returns APIResult<T> = { data, loading, error, refetch }
- Polling driven by useLuaInterval (Lua-side timers), not JS setInterval
- Rate limiting: sliding window per domain via rateLimit.ts, optional `rateLimit: { maxCalls, perSeconds }` in APIOptions
- Key management: useServiceKey reads from Lua persistent storage via bridge RPC 'settings:getKey'
- Service registry: builtinServices array, categories: media/dev/ai/smart-home/productivity/finance/social/custom
- Pre-built display components in components.tsx: SpotifyNowPlaying, TMDBTrending, GitHubProfile, etc.
- Auth patterns vary: bearer token (Spotify, GitHub, HA, Notion, Todoist, YNAB, Google), API key as query param (TMDB, Weather, Last.fm, NASA, Steam), custom headers (Plex, Jellyfin, Trakt, CoinGecko x-cg-demo-api-key, Poly Pizza x-api-key), URL path (Hue bridge API key, Telegram bot token)
- Plex wraps all responses in MediaContainer; always access data.MediaContainer.Metadata/Directory
- TMDB image paths are relative; use tmdbImage(path, size) helper
- Last.fm artist format varies by endpoint ('#text' in recent, 'name' in top)
- Trakt has no images; use ids.tmdb with tmdbImage() for poster art
- Notion search/query endpoints use POST (useAPIMutation internally) but present as reactive hooks
- useSpotifyNowPlaying polls 5s, useLastFMNowPlaying polls 10s, usePlexSessions/useJellyfinSessions poll 10s, useTraktWatching polls 30s
- ---- subsection headers used in API/SYNTAX for per-hook documentation
- index.txt uses EXAMPLES (not just OVERVIEW) to demonstrate useAPI, useServiceKey, useSettingsRegistry, useAPIMutation
- style-properties.txt: comprehensive Style reference organized by category (Sizing, Flexbox, Spacing, Visual, Shadow, Gradient, Transform, Text, Positioning, Scroll, Vector Shapes, Stroke Dash, Transitions, Keyframe Animations)
- types.txt: BoxProps (with shorthand props), TextProps, ImageProps, InputProps, ScrollViewProps, FlatListProps, LoveEvent (all event fields by category), LayoutEvent, TooltipConfig, CapabilitySchema
- YNAB amounts are in milliunits (/1000); ynabAmount() helper documented
- NASA hooks fall back to DEMO_KEY when apiKey is null
- CoinGecko free tier needs no auth; optional apiKey for higher rate limits
- Hue uses local bridge IP + API key in URL path; hueXYToHex converts CIE xy colors
- Telegram bot token in URL path; updates polling defaults to 5s interval
- Poly Pizza response shape varies by API version; attribution helpers are defensive
- Google covers both Calendar and Sheets in one file; mutations use USER_ENTERED

## Storage Docs (13-storage)
- Written 2026-03-06: index, storage-api
- Storage category, intermediate difficulty, love2d platform
- Source: `packages/storage/src/` -- index.ts, hooks.ts, crud.ts, schema.ts, types.ts, query.ts, migrations.ts, format.ts, adapters/
- z schema builder: string, number, boolean, date, array, object, enum, literal -- all support optional/nullable/default
- ObjectSchema has: strict(), partial(), pick(), omit(), merge() -- passes through unknown fields by default
- useCRUD: returns CRUDHandle<T> with create/get/update/delete/list + useQuery/useListQuery (reactive)
- createCRUD: same without React (no useQuery/useListQuery)
- StorageProvider provides adapter via context; useCRUD can also take explicit adapter option
- Adapters: MemoryAdapter (in-memory), Love2DFileAdapter (RPC to Lua), TerminalSQLiteAdapter (node:sqlite), LocalStorageAdapter, IndexedDBAdapter
- Query engine: where (direct/$eq/$ne/$gt/$gte/$lt/$lte/$in/$contains), orderBy, order, limit, offset
- Migrations: versioned via _version field, sequential v1->v2->v3, autoMigrate reads+writes back
- Format utils: parseContent/serializeContent for json/markdown/text

## Domain Package Docs (14-packages)
- Written 2026-03-06: chemistry, physics, finance, imaging, math, time, convert, 3d, ai, audio, controls, theme, privacy, icons, data, layouts, geo, geo3d, wireguard, media, rss, webhooks, server, networking, terminal-package
- Total files: 25 (12 original + 13 new domain packages)
- Packages category, love2d. Validator does NOT check category whitelist -- "Packages" and "Storage" are fine
- 3d: Scene/Camera/Mesh/DirectionalLight/AmbientLight via g3d, host elements (Scene3D/Camera3D/Mesh3D etc), orbitControls Lua-owned
- ai: AIProvider+useChat+useCompletion+useModels, 3 tiers (hooks/components/templates), MCP, tool execution loops, SSE streaming
- audio: rack/module/port model, Lua engine, useRack/useModule/useParam/useMIDI/useClock/useSampler/useRecorder/useSequencer
- controls: Knob/Fader/Meter/LEDIndicator/PadButton/StepSequencer/TransportBar/PianoKeyboard/XYPad/PitchWheel, decoupled from audio
- theme: ThemeProvider/useThemeColors/createTheme/registerTheme/ThemeSwitcher, 16+ built-in themes, auto-persist, Lua sync
- chemistry: ELEMENTS[118], hooks+Lua capabilities, LaTeX notation, PubChem API, registers conversions into @reactjit/convert
- physics: Box2D wrappers (PhysicsWorld/RigidBody/Collider/Sensor/joints/useForce/useImpulse/useTorque) via Native
- finance: pure indicators, useTechnicalAnalysis (Lua), usePriceFeed (CoinGecko+Binance WS), TickerTape (Lua-owned)
- imaging: useImaging (GPU pipeline), useImagingComposer, useImagingSelection, useDrawCanvas, golden testing
- math: Vec2/Vec3/Vec4/Mat4/Quat static namespaces on tuples, interpolation, Lua-backed noise/FFT/bezier
- time: useStopwatch/useCountdown (Lua-driven), useOnTime (frame-precise), widgets, date utils
- convert: fluent convert(val,from).to(target), extensible registry, 11 unit categories + color + encoding + currency
- privacy: usePrivacy() master hook with 17 namespaces (gpg, keyring, shamir, sanitize, noise, steganography, audit, policy, etc.), all operations async via Lua RPCs
- icons: Icon component with strokePaths rendering, 1400+ Lucide-compatible names, auto-registration via registerIcons()
- data: Spreadsheet component (visual + formula bar + cell selection), useSpreadsheet (headless), formula engine with 25+ built-in functions, cell references, circular reference detection
- layouts: 3 tiers -- page (AppShell, HolyGrail, Centered, Stage, Mosaic, Pinboard, Curtain), container (Stack, Cluster, Sidebar, Shelf, Keystone, Frame, Ladder, Reel), nav (TopNav, SideNav, BottomNav, CommandShell, Drawer, Bookshelf, Crumb)
- geo: MapContainer + 12 vector layers + 6 hooks (useMap, useMapEvent, useMapEvents, useMapView, useTileCache, useProjection), react-leaflet-compatible API, Lua MapView host element
- geo3d: GeoScene + TerrainLayer + BuildingLayer + GeoPath3D + GeoMarker3D + Sky, useGeoCamera + useTerrainHeight, extends @reactjit/3d Scene3D
- wireguard: two tiers -- useWireGuard (kernel wg CLI, needs root) and usePeerTunnel (userspace libsodium, no root), useWireGuardIdentity for keypair management
- media: archive hooks (useArchive, useArchiveInfo, useArchiveRead, useArchiveSearch) + media library hooks (useMediaLibrary, useMediaStats, useMediaIndex), classifyFile + formatSize utils
- rss: useRSSFeed (single), useRSSAggregate (multi), fetchFeed (imperative), parseOPML/generateOPML, polling via useLuaInterval, deduplication
- webhooks: useWebhook (receiver w/ HMAC-SHA256), sendWebhook (imperative w/ retries), useWebhookSender (React hook), exponential backoff, GitHub-style signatures
- server: useServer (dynamic routes + static), useStaticServer (one-liner), useLibrary (media indexing), Lua HTTP server (zero bridge overhead for static)
- networking: GameServer component (goldsrc/source/source2/minecraft), useGameServer + usePlayerList + useServerStatus + useServerLogs, A2S query protocol, RCON, staggered polling
- terminal-package: ClaudeCanvas (Lua capability node), useClaude (permission/question/status state), useSessionChrome (polls claude:classified at 100ms), proxy input pattern (keystrokeTarget/submitTarget)

## Section Patterns
- index.txt: METADATA + OVERVIEW + EXAMPLES (section contents listing) + SEE ALSO
- Tutorial files: METADATA + OVERVIEW + progressive EXAMPLES + CRITICAL RULES + SEE ALSO
- Valid categories: Getting Started, Architecture, CLI, Layout, Components, Hooks, Animation, Routing, Targets, Advanced, Troubleshooting, API Reference, Storage, Packages (not enforced by validator)
