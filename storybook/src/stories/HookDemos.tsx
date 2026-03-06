/**
 * HookDemos — Hook definitions and thumbnail renderers for the Hook Gallery.
 *
 * Each hook gets a surface type that determines its thumbnail visual.
 * Surfaces are shared across hooks — one component per visual pattern.
 */

import React from 'react';
import { Box, Text, Image } from '../../../packages/core/src';

// ── Types ────────────────────────────────────────────────

export type ThemeColors = {
  text: string; bg: string; bgElevated: string; surface: string;
  border: string; muted: string; primary: string; [key: string]: string;
};

export interface HookDef {
  id: string;
  pkg: string;
  cat: string;
  surface: string;
  desc: string;
  sig: string;
  returns: string;
  usage: string;
}

const A = '#8b5cf6';

// ══════════════════════════════════════════════════════════
// HOOK DEFINITIONS
// ══════════════════════════════════════════════════════════

export const HOOKS: HookDef[] = [
  // ── State ───────────────────────────────────────────────
  { id: 'useHotState', pkg: 'core', cat: 'State', surface: 'counter',
    desc: 'State stored in Lua memory — survives hot reload',
    sig: '<T>(key: string, init: T)',
    returns: '[T, (value: T) => void]',
    usage: `const [count, setCount] = useHotState('c', 0);\nsetCount(count + 1);` },
  { id: 'useLoveState', pkg: 'core', cat: 'State', surface: 'counter',
    desc: 'Bidirectional shared state between React and Lua',
    sig: '<T>(key: string, initialValue: T)',
    returns: '[T, (value: T) => void]',
    usage: `const [score, setScore] = useLoveState('score', 0);` },
  { id: 'useLocalStore', pkg: 'core', cat: 'State', surface: 'counter',
    desc: 'Persist state to SQLite — survives app restarts',
    sig: '<T>(namespace: string, defaultValue: T)',
    returns: '[T, (value: T) => void]',
    usage: `const [prefs, setPrefs] = useLocalStore('settings', { theme: 'dark' });` },
  { id: 'useOverlay', pkg: 'core', cat: 'State', surface: 'bool',
    desc: 'Get/set overlay visibility for debugging UI',
    sig: '()',
    returns: 'OverlayState',
    usage: `const { visible, toggle } = useOverlay();` },
  { id: 'useLoveReady', pkg: 'core', cat: 'State', surface: 'bool',
    desc: 'Returns true when the Love2D bridge is initialized',
    sig: '()',
    returns: 'boolean',
    usage: `const ready = useLoveReady();\nif (!ready) return <Text>Loading...</Text>;` },

  // ── UI ──────────────────────────────────────────────────
  { id: 'useThemeColors', pkg: 'theme', cat: 'UI', surface: 'palette',
    desc: 'Semantic color tokens for the active theme',
    sig: '()',
    returns: 'ThemeColors { text, bg, surface, border, muted, primary, ... }',
    usage: `const c = useThemeColors();\n<Box style={{ backgroundColor: c.surface }}>` },
  { id: 'useThemeTypography', pkg: 'theme', cat: 'UI', surface: 'palette',
    desc: 'Typography scale — sizes, weights, line-heights',
    sig: '()',
    returns: 'ThemeTypography',
    usage: `const t = useThemeTypography();\n<Text style={{ fontSize: t.lg }}>` },
  { id: 'useThemeSpacing', pkg: 'theme', cat: 'UI', surface: 'palette',
    desc: 'Spacing scale — gaps, padding constants',
    sig: '()',
    returns: 'ThemeSpacing',
    usage: `const s = useThemeSpacing();\n<Box style={{ gap: s.md }}>` },
  { id: 'useThemeRadii', pkg: 'theme', cat: 'UI', surface: 'palette',
    desc: 'Border-radius scale for consistent rounding',
    sig: '()',
    returns: 'ThemeRadii',
    usage: `const r = useThemeRadii();\n<Box style={{ borderRadius: r.lg }}>` },
  { id: 'useWindowDimensions', pkg: 'core', cat: 'UI', surface: 'value',
    desc: 'Current window/viewport dimensions, reactive on resize',
    sig: '()',
    returns: '{ width: number, height: number }',
    usage: `const { width, height } = useWindowDimensions();` },
  { id: 'useScale', pkg: 'core', cat: 'UI', surface: 'value',
    desc: 'Current UI scale factor',
    sig: '()',
    returns: 'number',
    usage: `const scale = useScale();\n<Text style={{ fontSize: 14 * scale }}>` },
  { id: 'useBreakpoint', pkg: 'core', cat: 'UI', surface: 'value',
    desc: 'Responsive breakpoint based on viewport width',
    sig: '()',
    returns: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
    usage: `const bp = useBreakpoint();\nconst cols = bp === 'xl' ? 4 : bp === 'lg' ? 3 : 2;` },
  { id: 'useScaledStyle', pkg: 'core', cat: 'UI', surface: 'signature',
    desc: 'Apply scale factor to style properties automatically',
    sig: '(style: Style | undefined)',
    returns: 'Style | undefined',
    usage: `const scaled = useScaledStyle({ fontSize: 14, padding: 8 });` },

  // ── Animation ───────────────────────────────────────────
  { id: 'useSpring', pkg: 'core', cat: 'Animation', surface: 'animated',
    desc: 'Spring physics — value bounces toward target',
    sig: '(target: number, stiffness?: number, damping?: number)',
    returns: 'number',
    usage: `const x = useSpring(pressed ? 200 : 0, 120, 14);` },
  { id: 'useAnimation', pkg: 'core', cat: 'Animation', surface: 'animated',
    desc: 'Spring-based animation with easing config',
    sig: '(config: AnimationConfig)',
    returns: 'AnimationResult',
    usage: `const { value } = useAnimation({ to: 1, duration: 300 });` },
  { id: 'useTransition', pkg: 'core', cat: 'Animation', surface: 'animated',
    desc: 'Animate element entrance and exit',
    sig: '(isVisible: boolean, enter?: Style, exit?: Style)',
    returns: '{ style: Style, mounted: boolean }',
    usage: `const { style, mounted } = useTransition(show,\n  { opacity: 1 }, { opacity: 0 });` },
  { id: 'useLerp', pkg: 'math', cat: 'Animation', surface: 'animated',
    desc: 'Linear interpolation between two values',
    sig: '(from: number, to: number, t: number)',
    returns: 'number',
    usage: `const v = useLerp(0, 100, progress);` },
  { id: 'useSmoothstep', pkg: 'math', cat: 'Animation', surface: 'animated',
    desc: 'Hermite smoothstep interpolation',
    sig: '(edge0: number, edge1: number, x: number)',
    returns: 'number',
    usage: `const v = useSmoothstep(0, 1, t);` },

  // ── Time ────────────────────────────────────────────────
  { id: 'useTime', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Poll Date.now() at given rate — JS-based clock',
    sig: '(rateMs?: number)',
    returns: 'number (timestamp)',
    usage: `const now = useTime(1000);\nconst time = new Date(now).toLocaleTimeString();` },
  { id: 'useLuaTime', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Lua monotonic + wall clock time',
    sig: '(rateMs?: number)',
    returns: 'LuaTimeState | null',
    usage: `const t = useLuaTime(1000);\nt?.formatted // "12:34:56"` },
  { id: 'useStopwatch', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Lua-driven stopwatch with start/stop/reset',
    sig: '(opts?: StopwatchOptions)',
    returns: '{ elapsed, running, start, stop, reset, lap }',
    usage: `const sw = useStopwatch();\nsw.start(); // sw.elapsed updates` },
  { id: 'useCountdown', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Lua-driven countdown timer',
    sig: '(durationMs: number, opts?: CountdownOptions)',
    returns: '{ remaining, running, start, stop, reset }',
    usage: `const cd = useCountdown(60000);\ncd.start(); // cd.remaining ticks down` },
  { id: 'useLuaInterval', pkg: 'core', cat: 'Time', surface: 'clock',
    desc: 'Lua-side interval on exact frame boundaries',
    sig: '(intervalMs: number | null, callback: () => void)',
    returns: 'void',
    usage: `useLuaInterval(1000, () => {\n  console.log('tick');\n});` },
  { id: 'useInterval', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Repeating JS interval',
    sig: '(fn: () => void, intervalMs: number)',
    returns: 'void',
    usage: `useInterval(() => setTick(t => t + 1), 500);` },
  { id: 'useOnTime', pkg: 'time', cat: 'Time', surface: 'clock',
    desc: 'Schedule one-time function after delay',
    sig: '(fn: () => void, delayMs: number, deps?: any[])',
    returns: 'void',
    usage: `useOnTime(() => setReady(true), 3000);` },

  // ── Text ────────────────────────────────────────────────
  { id: 'useTruncate', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Truncate string with ellipsis',
    sig: '(str: string, max: number, ellipsis?: string)',
    returns: 'string | null',
    usage: `const short = useTruncate('Hello World', 8); // "Hello..."` },
  { id: 'useSlugify', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Convert string to URL-safe slug',
    sig: '(str: string)',
    returns: 'string | null',
    usage: `const slug = useSlugify('Hello World!'); // "hello-world"` },
  { id: 'useCamelCase', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Convert to camelCase',
    sig: '(str: string)',
    returns: 'string | null',
    usage: `const cc = useCamelCase('hello-world'); // "helloWorld"` },
  { id: 'useSnakeCase', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Convert to snake_case',
    sig: '(str: string)',
    returns: 'string | null',
    usage: `const sc = useSnakeCase('helloWorld'); // "hello_world"` },
  { id: 'useKebabCase', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Convert to kebab-case',
    sig: '(str: string)',
    returns: 'string | null',
    usage: `const kc = useKebabCase('helloWorld'); // "hello-world"` },
  { id: 'usePascalCase', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Convert to PascalCase',
    sig: '(str: string)',
    returns: 'string | null',
    usage: `const pc = usePascalCase('hello world'); // "HelloWorld"` },
  { id: 'usePluralize', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Pluralize word based on count',
    sig: '(count: number, singular: string, plural?: string)',
    returns: 'string | null',
    usage: `const label = usePluralize(3, 'item'); // "3 items"` },
  { id: 'useTimeAgo', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Format timestamp as relative time',
    sig: '(timestamp: number)',
    returns: 'string | null',
    usage: `const ago = useTimeAgo(Date.now() - 3600000); // "1 hour ago"` },
  { id: 'useFormatDate', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Format timestamp via Lua datelib',
    sig: '(timestamp: number, pattern?: string)',
    returns: 'string | null',
    usage: `const d = useFormatDate(Date.now(), 'YYYY-MM-DD');` },
  { id: 'useMsParse', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Parse duration string to milliseconds',
    sig: '(str: string)',
    returns: 'number | null',
    usage: `const ms = useMsParse('1h30m'); // 5400000` },
  { id: 'useMsFormat', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Format milliseconds to human duration',
    sig: '(ms: number)',
    returns: 'string | null',
    usage: `const fmt = useMsFormat(5400000); // "1:30:00"` },
  { id: 'useDuration', pkg: 'core', cat: 'Text', surface: 'transform',
    desc: 'Break duration into hours/minutes/seconds',
    sig: '(ms: number)',
    returns: 'Duration | null',
    usage: `const d = useDuration(5400000); // {h:1, m:30, s:0}` },

  // ── Data ────────────────────────────────────────────────
  { id: 'useCapabilities', pkg: 'core', cat: 'Data', surface: 'list',
    desc: 'Discover all registered Lua capabilities via schema',
    sig: '()',
    returns: '{ [name: string]: CapabilitySchema }',
    usage: `const caps = useCapabilities();\nObject.keys(caps) // ["Audio", "Video", ...]` },
  { id: 'useSearch', pkg: 'core', cat: 'Data', surface: 'list',
    desc: 'Full-text search with ranking',
    sig: '<T>(data: T[], schema: SearchSchema)',
    returns: 'SearchResult<T>',
    usage: `const { results, query, setQuery } = useSearch(items, {\n  fields: ['name', 'desc']\n});` },
  { id: 'useFuzzySearch', pkg: 'core', cat: 'Data', surface: 'list',
    desc: 'Fuzzy substring search with Jaro-Winkler distance',
    sig: '<T>(data: T[], schema: SearchSchema)',
    returns: 'SearchResult<T>',
    usage: `const { results } = useFuzzySearch(items, {\n  fields: ['name'], threshold: 0.6\n});` },
  { id: 'useSearchHighlight', pkg: 'core', cat: 'Data', surface: 'transform',
    desc: 'Mark regions of text that match a query',
    sig: '(text: string, query: string)',
    returns: 'HighlightPart[]',
    usage: `const parts = useSearchHighlight('ReactJIT', 'jit');\n// [{text:'React',match:false},{text:'JIT',match:true}]` },
  { id: 'useCommandSearch', pkg: 'core', cat: 'Data', surface: 'list',
    desc: 'Search command palette entries',
    sig: '(commands: CommandEntry[], initialQuery?: string)',
    returns: '{ results, query, setQuery }',
    usage: `const { results } = useCommandSearch(commands);` },
  { id: 'useFetch', pkg: 'core', cat: 'Data', surface: 'gauge',
    desc: 'Fetch data from URL with loading/error state',
    sig: '<T>(url: string | null, options?: RequestInit)',
    returns: '{ data: T | null, loading: boolean, error: string | null }',
    usage: `const { data, loading } = useFetch('/api/users');` },
  { id: 'useWebSocket', pkg: 'core', cat: 'Data', surface: 'flash',
    desc: 'WebSocket with auto-reconnect',
    sig: '(url: string | null, options?: WebSocketOptions)',
    returns: '{ send, lastMessage, readyState }',
    usage: `const { send, lastMessage } = useWebSocket('ws://localhost:8080');` },
  { id: 'useEventBus', pkg: 'core', cat: 'Data', surface: 'flash',
    desc: 'In-app event bus for component communication',
    sig: '()',
    returns: 'EventBus',
    usage: `const bus = useEventBus();` },
  { id: 'useEvent', pkg: 'core', cat: 'Data', surface: 'flash',
    desc: 'Listen to events on a bus',
    sig: '<T>(bus: EventBus, channel: string, handler: (payload: T) => void)',
    returns: 'void',
    usage: `useEvent(bus, 'update', (data) => setItems(data));` },
  { id: 'useEmit', pkg: 'core', cat: 'Data', surface: 'flash',
    desc: 'Get a function to emit events on a bus',
    sig: '(bus: EventBus, channel: string)',
    returns: '(payload?: any) => void',
    usage: `const emit = useEmit(bus, 'update');\nemit({ count: 1 });` },

  // ── System ──────────────────────────────────────────────
  { id: 'useLoveRPC', pkg: 'core', cat: 'System', surface: 'signature',
    desc: 'Call a Lua RPC method and await result',
    sig: '<T>(method: string)',
    returns: '(params?: any) => Promise<T>',
    usage: `const rpc = useLoveRPC<number>('system:fps');\nconst fps = await rpc();` },
  { id: 'useBridge', pkg: 'core', cat: 'System', surface: 'signature',
    desc: 'Access the React-to-Lua bridge directly',
    sig: '()',
    returns: 'IBridge',
    usage: `const bridge = useBridge();\nbridge.send('custom:event', payload);` },
  { id: 'useLoveSend', pkg: 'core', cat: 'System', surface: 'signature',
    desc: 'Fire-and-forget send function to Lua',
    sig: '()',
    returns: '(cmd: string, payload?: any) => void',
    usage: `const send = useLoveSend();\nsend('audio:play', { src: 'beep.wav' });` },
  { id: 'useLoveEvent', pkg: 'core', cat: 'System', surface: 'flash',
    desc: 'Fire-and-forget Love2D event listener',
    sig: '(eventType: string, handler: (payload: any) => void)',
    returns: 'void',
    usage: `useLoveEvent('resize', ({ w, h }) => setSize({ w, h }));` },
  { id: 'useSystemInfo', pkg: 'core', cat: 'System', surface: 'gauge',
    desc: 'CPU/memory/disk system stats',
    sig: '(refreshInterval?: number)',
    returns: 'SystemInfo',
    usage: `const info = useSystemInfo(5000);\ninfo.cpuPercent // 42` },
  { id: 'useSystemMonitor', pkg: 'core', cat: 'System', surface: 'gauge',
    desc: 'Poll CPU%, memory, thermal metrics',
    sig: '(updateRate?: number)',
    returns: '{ cpu, memory, thermal, ... }',
    usage: `const mon = useSystemMonitor(2000);\nmon.memory.usedPercent // 61` },
  { id: 'usePorts', pkg: 'core', cat: 'System', surface: 'list',
    desc: 'Monitor open network ports',
    sig: '(interval?: number)',
    returns: 'PortMonitor',
    usage: `const { ports } = usePorts(2000);\n// [{port: 3000, pid: 1234}, ...]` },
  { id: 'useId', pkg: 'core', cat: 'System', surface: 'value',
    desc: 'Generate a random alphanumeric ID',
    sig: '(length?: number)',
    returns: 'string | null',
    usage: `const id = useId(8); // "a3f9b2c1"` },
  { id: 'useUUID', pkg: 'core', cat: 'System', surface: 'value',
    desc: 'Generate a UUID v4',
    sig: '()',
    returns: 'string | null',
    usage: `const uuid = useUUID(); // "550e8400-e29b-..."` },
  { id: 'useDebug', pkg: 'core', cat: 'System', surface: 'signature',
    desc: 'Store debug data for F12 inspector',
    sig: '(key: string, data: any)',
    returns: 'void',
    usage: `useDebug('state', { count, items });` },
  { id: 'useHotkey', pkg: 'core', cat: 'System', surface: 'flash',
    desc: 'Register global keyboard shortcuts',
    sig: '(keys: string | string[], handler: (e?) => void)',
    returns: 'void',
    usage: `useHotkey('ctrl+s', () => save());` },
  { id: 'useClipboard', pkg: 'core', cat: 'System', surface: 'flash',
    desc: 'System clipboard copy/paste',
    sig: '()',
    returns: '{ copy: (text) => void, paste: () => Promise<string> }',
    usage: `const { copy, paste } = useClipboard();\ncopy('Hello');` },

  // ── Math ────────────────────────────────────────────────
  { id: 'useVec2', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Create/update 2D vector with setter',
    sig: '(x?: number, y?: number)',
    returns: '[Vec2, Vec2Setter]',
    usage: `const [pos, setPos] = useVec2(10, 20);\nsetPos(pos.x + 1, pos.y);` },
  { id: 'useVec3', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Create/update 3D vector with setter',
    sig: '(x?: number, y?: number, z?: number)',
    returns: '[Vec3, Vec3Setter]',
    usage: `const [dir, setDir] = useVec3(0, 1, 0);` },
  { id: 'useDistance', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Euclidean distance between two points',
    sig: '(a: Vec2 | Vec3, b: Vec2 | Vec3)',
    returns: 'number',
    usage: `const d = useDistance({ x: 0, y: 0 }, { x: 3, y: 4 }); // 5` },
  { id: 'useNoise', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Perlin noise at a point (1D/2D/3D)',
    sig: '(config: NoiseConfig)',
    returns: 'number | null',
    usage: `const n = useNoise({ x: t * 0.1, y: 0, scale: 4 });` },
  { id: 'useNoiseField', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Generate 2D noise field grid',
    sig: '(config: NoiseFieldConfig)',
    returns: 'number[] | null',
    usage: `const field = useNoiseField({ w: 16, h: 16, scale: 4 });` },
  { id: 'useFFT', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Fast Fourier Transform',
    sig: '(samples: number[])',
    returns: 'number[] | null',
    usage: `const spectrum = useFFT(audioSamples);` },
  { id: 'useBezier', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Generate Bezier curve points',
    sig: '(config: BezierConfig)',
    returns: 'Vec2[] | null',
    usage: `const pts = useBezier({ p0, p1, p2, p3, steps: 20 });` },
  { id: 'useBBox', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Compute 2D bounding box from points',
    sig: '(points: Vec2[])',
    returns: 'BBox2',
    usage: `const box = useBBox(points); // {min, max, width, height}` },
  { id: 'useIntersection', pkg: 'math', cat: 'Math', surface: 'math',
    desc: 'Test if two bounding boxes overlap',
    sig: '(a: BBox2, b: BBox2)',
    returns: 'boolean',
    usage: `const hit = useIntersection(boxA, boxB);` },
  { id: 'useConvert', pkg: 'convert', cat: 'Math', surface: 'transform',
    desc: 'Access unit conversion system',
    sig: '()',
    returns: 'ConvertAPI',
    usage: `const conv = useConvert();\nconv.convert(5, 'kg', 'lb'); // 11.02` },
  { id: 'useUnitConvert', pkg: 'convert', cat: 'Math', surface: 'transform',
    desc: 'Convert between units directly',
    sig: '(value: number, from: string, to: string)',
    returns: 'number | null',
    usage: `const lbs = useUnitConvert(5, 'kg', 'lb'); // 11.02` },

  // ── APIs (representative) ──────────────────────────────
  { id: 'useGitHubUser', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get GitHub user profile',
    sig: '(username: string, token?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useGitHubUser('octocat');\ndata?.login // "octocat"` },
  { id: 'useWeatherCurrent', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get current weather for location',
    sig: '(lat: number, lon: number, apiKey?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useWeatherCurrent(40.7, -74.0);` },
  { id: 'useSpotifyNowPlaying', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get currently playing Spotify track',
    sig: '(token: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useSpotifyNowPlaying(token);\ndata?.track // "Song Name"` },
  { id: 'useNASAApod', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Astronomy Picture of the Day',
    sig: '(apiKey?: string, date?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useNASAApod();\ndata?.title // "Nebula M42"` },
  { id: 'useCoinPrice', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get current cryptocurrency price',
    sig: '(coinId: string, currency?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useCoinPrice('bitcoin');\ndata?.price // 67432.50` },
  { id: 'useHAStates', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get all Home Assistant entity states',
    sig: '(baseUrl: string, token: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useHAStates(url, token);` },
  { id: 'useTMDBTrending', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get trending movies and shows',
    sig: '(apiKey: string, timeWindow?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useTMDBTrending(key);` },
  { id: 'useNotionDatabases', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'List Notion databases',
    sig: '(token: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useNotionDatabases(token);` },
  { id: 'useTodoistTasks', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get all Todoist tasks',
    sig: '(token: string, projectId?: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useTodoistTasks(token);` },
  { id: 'useSteamUser', pkg: 'apis', cat: 'APIs', surface: 'signature',
    desc: 'Get Steam user profile',
    sig: '(steamId: string, apiKey: string)',
    returns: '{ data, loading, error }',
    usage: `const { data } = useSteamUser(id, key);` },
  { id: 'useChat', pkg: 'ai', cat: 'APIs', surface: 'signature',
    desc: 'Conversational AI with streaming and tool use',
    sig: '(options?: ChatOptions)',
    returns: '{ messages, send, streaming, stop }',
    usage: `const { messages, send } = useChat({ model: 'claude-opus-4-6' });\nsend('Hello');` },
  { id: 'useElement', pkg: 'chemistry', cat: 'APIs', surface: 'signature',
    desc: 'Get element from periodic table',
    sig: '(key: number | string)',
    returns: 'Element | undefined',
    usage: `const fe = useElement('Fe');\nfe?.name // "Iron"` },
  { id: 'useRouter', pkg: 'router', cat: 'APIs', surface: 'signature',
    desc: 'Access current route, navigate, back, forward',
    sig: '()',
    returns: 'RouterState',
    usage: `const { path, navigate } = useRouter();\nnavigate('/settings');` },
  { id: 'useMap', pkg: 'geo', cat: 'APIs', surface: 'signature',
    desc: 'Access map instance and methods',
    sig: '()',
    returns: 'MapHandle',
    usage: `const map = useMap();\nmap.setCenter(40.7, -74.0);` },
  { id: 'useRack', pkg: 'audio', cat: 'APIs', surface: 'signature',
    desc: 'Access audio rack modules/connections',
    sig: '(options?: UseRackOptions)',
    returns: 'UseRackResult',
    usage: `const rack = useRack();\nrack.addModule('oscillator', { freq: 440 });` },
  { id: 'useCrypto', pkg: 'crypto', cat: 'APIs', surface: 'signature',
    desc: 'Cryptographic operations — hash, sign, encrypt',
    sig: '()',
    returns: 'CryptoAPI',
    usage: `const crypto = useCrypto();\nconst hash = await crypto.sha256('data');` },
  { id: 'useForce', pkg: 'physics', cat: 'APIs', surface: 'signature',
    desc: 'Apply force to rigid body',
    sig: '(bodyId: string, force: [number, number])',
    returns: 'void',
    usage: `useForce('player', [0, -500]); // jump` },
  { id: 'useServer', pkg: 'server', cat: 'APIs', surface: 'signature',
    desc: 'Run HTTP server with routing',
    sig: '(config: ServerConfig | null)',
    returns: 'UseServerResult',
    usage: `const srv = useServer({ port: 8080,\n  routes: { '/api': handler } });` },
  { id: 'useSpreadsheet', pkg: 'data', cat: 'APIs', surface: 'signature',
    desc: 'In-memory spreadsheet with formulas',
    sig: '(options?: UseSpreadsheetOptions)',
    returns: 'UseSpreadsheetResult',
    usage: `const sheet = useSpreadsheet();\nsheet.setCell('A1', '=SUM(B1:B5)');` },
  { id: 'useImaging', pkg: 'imaging', cat: 'APIs', surface: 'signature',
    desc: 'Access imaging canvas and operations',
    sig: '()',
    returns: 'UseImagingResult',
    usage: `const img = useImaging();\nimg.apply('blur', { radius: 4 });` },
];

// ══════════════════════════════════════════════════════════
// THUMBNAILS — one per surface type
// ══════════════════════════════════════════════════════════

export function ThumbCounter({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Box style={{ width: 10, height: 10, backgroundColor: c.surface, borderRadius: 2, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 5 }}>{'-'}</Text>
        </Box>
        <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>{'7'}</Text>
        <Box style={{ width: 10, height: 10, backgroundColor: A, borderRadius: 2, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 5 }}>{'+'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbPalette({ c }: { c: ThemeColors }) {
  const colors = [c.primary, c.text, c.surface, c.border, c.muted, '#10b981'];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, width: 36, justifyContent: 'center' }}>
        {colors.map((color, i) => (
          <Box key={i} style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbTransform({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 5 }}>{'hello-world'}</Text>
      <Text style={{ color: A, fontSize: 4 }}>{'--->'}</Text>
      <Text style={{ color: c.text, fontSize: 5, fontWeight: 'bold' }}>{'helloWorld'}</Text>
    </Box>
  );
}

export function ThumbClock({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
      <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>{'12:34'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'ticking'}</Text>
    </Box>
  );
}

export function ThumbAnimated({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 44, height: 12, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 0, top: 5, width: 44, height: 2, backgroundColor: c.border, borderRadius: 1 }} />
        <Box style={{ position: 'absolute', left: 28, top: 2, width: 8, height: 8, backgroundColor: A, borderRadius: 4 }} />
        <Box style={{ position: 'absolute', left: 12, top: 4, width: 4, height: 4, backgroundColor: A, borderRadius: 2, opacity: 0.3 }} />
        <Box style={{ position: 'absolute', left: 20, top: 3, width: 5, height: 5, backgroundColor: A, borderRadius: 3, opacity: 0.5 }} />
      </Box>
    </Box>
  );
}

export function ThumbList({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      {[32, 24, 18].map((w, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
          <Box style={{ width: 3, height: 3, backgroundColor: i === 0 ? A : c.muted, borderRadius: 2 }} />
          <Box style={{ width: w, height: 3, backgroundColor: i === 0 ? c.text : c.muted, borderRadius: 1, opacity: 1 - i * 0.2 }} />
        </Box>
      ))}
    </Box>
  );
}

export function ThumbFlash({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Image src="zap" style={{ width: 16, height: 16 }} tintColor={A} />
    </Box>
  );
}

export function ThumbMath({ c }: { c: ThemeColors }) {
  const dots = [[10, 8], [30, 12], [20, 28], [38, 32], [14, 22], [28, 6]];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 48, height: 36, position: 'relative' }}>
        {dots.map(([x, y], i) => (
          <Box key={i} style={{
            position: 'absolute', left: x, top: y,
            width: 4, height: 4, borderRadius: 2,
            backgroundColor: i < 3 ? A : '#3b82f6',
            opacity: 0.5 + i * 0.1,
          }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbGauge({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 42, height: 5, backgroundColor: c.surface, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ width: '62%', height: 5, backgroundColor: '#10b981', borderRadius: 2 }} />
      </Box>
      <Text style={{ color: c.muted, fontSize: 5 }}>{'62%'}</Text>
    </Box>
  );
}

export function ThumbValue({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
      <Text style={{ color: c.text, fontSize: 7, fontWeight: 'bold' }}>{'1280x720'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'md'}</Text>
    </Box>
  );
}

export function ThumbBool({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
      <Text style={{ color: c.text, fontSize: 5 }}>{'ready'}</Text>
    </Box>
  );
}

export function ThumbSignature({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: A, fontSize: 5 }}>{'f(x)'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'API'}</Text>
    </Box>
  );
}

// ── Thumbnail registry ──────────────────────────────────

const SURFACE_THUMBS: Record<string, (c: ThemeColors) => React.ReactNode> = {
  counter:   (c) => <ThumbCounter c={c} />,
  palette:   (c) => <ThumbPalette c={c} />,
  transform: (c) => <ThumbTransform c={c} />,
  clock:     (c) => <ThumbClock c={c} />,
  animated:  (c) => <ThumbAnimated c={c} />,
  list:      (c) => <ThumbList c={c} />,
  flash:     (c) => <ThumbFlash c={c} />,
  math:      (c) => <ThumbMath c={c} />,
  gauge:     (c) => <ThumbGauge c={c} />,
  value:     (c) => <ThumbValue c={c} />,
  bool:      (c) => <ThumbBool c={c} />,
  signature: (c) => <ThumbSignature c={c} />,
};

export function getThumb(surface: string, c: ThemeColors): React.ReactNode {
  return (SURFACE_THUMBS[surface] || SURFACE_THUMBS.signature)(c);
}
