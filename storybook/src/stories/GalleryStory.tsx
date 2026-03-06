/**
 * Gallery — Component showcase with live thumbnail tab bar.
 *
 * Structure:
 *   Header row 1 — Gallery title + badge
 *   Header row 2 — Component name + package badge + counter
 *   Info row     — description | code example | props/callbacks
 *   Preview      — LIVE DEMO of active component (flexGrow: 1)
 *   Divider bar  — drag handle + search input (expandable)
 *   Tab grid     — thumbnail previews (fills remaining space)
 *
 * All thumbnails and previews live in GalleryComponents.tsx.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, Input } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { THUMBS, PREVIEWS } from './GalleryComponents';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// Package colors for non-core component indicators
const PKG: Record<string, string | undefined> = {
  core: undefined,
  controls: '#f59e0b',
  chemistry: '#10b981',
  finance: '#3b82f6',
  time: '#06b6d4',
  ai: '#ec4899',
  data: '#a855f7',
  apis: '#f97316',
};

// ── Tab definitions ─────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  pkg: string;
  desc: string;
  usage: string;
  props: [string, string][];
  callbacks: [string, string][];
}

const TABS: TabDef[] = [
  {
    id: 'card', label: 'Card', pkg: 'core',
    desc: 'Container with title, subtitle, border, and rounded corners. Separates header and body regions for grouped content panels.',
    usage: `<Card title="Settings" subtitle="App config">\n  <Text>Card body content</Text>\n</Card>`,
    props: [['title', 'string'], ['subtitle', 'string'], ['style', 'Style'], ['headerStyle', 'Style'], ['bodyStyle', 'Style']],
    callbacks: [],
  },
  {
    id: 'badge', label: 'Badge', pkg: 'core',
    desc: 'Status label with semantic color variants. Five built-in variants: default, success, warning, error, info.',
    usage: `<Badge label="Active" variant="success" />\n<Badge label="Warning" variant="warning" />`,
    props: [['label', 'string'], ['variant', "'default' | 'success' | 'warning' | 'error' | 'info'"], ['style', 'Style']],
    callbacks: [],
  },
  {
    id: 'tabs', label: 'Tabs', pkg: 'core',
    desc: 'Tab switcher with underline and pill variants. Lua-owned keyboard navigation and active state tracking.',
    usage: `<Tabs\n  tabs={[{ id: 'a', label: 'Tab A' }]}\n  activeId={active}\n  onSelect={setActive}\n/>`,
    props: [['tabs', 'Tab[]'], ['activeId', 'string'], ['variant', "'underline' | 'pill'"], ['style', 'Style']],
    callbacks: [['onSelect', '(id: string) => void']],
  },
  {
    id: 'navpanel', label: 'NavPanel', pkg: 'core',
    desc: 'Sidebar navigation with grouped sections and active state highlighting. Fixed-width panel with scrollable content.',
    usage: `<NavPanel\n  sections={[{\n    title: 'Main',\n    items: [{ id: 'home', label: 'Home' }],\n  }]}\n  activeId="home"\n/>`,
    props: [['sections', 'NavSection[]'], ['activeId', 'string'], ['width', 'number'], ['header', 'ReactNode']],
    callbacks: [['onSelect', '(id: string) => void']],
  },
  {
    id: 'toolbar', label: 'Toolbar', pkg: 'core',
    desc: 'Horizontal action bar with icon buttons and divider support. Use for editor toolbars and command rows.',
    usage: `<Toolbar items={[\n  { id: 'bold', icon: 'bold' },\n  'divider',\n  { id: 'link', icon: 'link' },\n]} onAction={handleAction} />`,
    props: [['items', "(ToolbarItem | 'divider')[]"], ['style', 'Style']],
    callbacks: [['onAction', '(id: string) => void']],
  },
  {
    id: 'breadcrumbs', label: 'Breadcrumbs', pkg: 'core',
    desc: 'Navigation breadcrumb trail with clickable segments and customizable separator.',
    usage: `<Breadcrumbs\n  items={[\n    { id: 'home', label: 'Home' },\n    { id: 'api', label: 'API' },\n  ]}\n/>`,
    props: [['items', 'BreadcrumbItem[]'], ['separator', 'string'], ['style', 'Style']],
    callbacks: [['onSelect', '(id: string) => void']],
  },
  {
    id: 'table', label: 'Table', pkg: 'core',
    desc: 'Columnar data display with configurable headers, column widths, alignment, and striped rows.',
    usage: `<Table\n  columns={[{ key: 'name', title: 'Name' }]}\n  data={[{ name: 'Alice' }]}\n  striped\n/>`,
    props: [['columns', 'TableColumn[]'], ['data', 'T[]'], ['striped', 'boolean'], ['borderless', 'boolean']],
    callbacks: [],
  },
  {
    id: 'progressbar', label: 'ProgressBar', pkg: 'core',
    desc: 'Linear progress indicator with configurable colors, height, and optional percentage label.',
    usage: `<ProgressBar value={0.65}\n  color="#3b82f6" height={8} />`,
    props: [['value', 'number (0-1)'], ['color', 'Color'], ['trackColor', 'Color'], ['height', 'number'], ['showLabel', 'boolean']],
    callbacks: [],
  },
  {
    id: 'sparkline', label: 'Sparkline', pkg: 'core',
    desc: 'Tiny inline chart for at-a-glance trends. Renders a mini line, area, or dot chart.',
    usage: `<Sparkline\n  data={[4, 7, 2, 8, 5, 9]}\n  width={80} height={24}\n  color="#10b981"\n/>`,
    props: [['data', 'number[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color']],
    callbacks: [],
  },
  {
    id: 'messagebubble', label: 'MessageBubble', pkg: 'core',
    desc: 'Chat message bubble with left/right/center alignment. Includes optional label and timestamp.',
    usage: `<MessageBubble variant="right"\n  label="You" timestamp="2:30 PM">\n  Hello there!\n</MessageBubble>`,
    props: [['variant', "'left' | 'right' | 'center'"], ['label', 'string'], ['timestamp', 'string'], ['bg', 'Color']],
    callbacks: [],
  },
  {
    id: 'chatinput', label: 'ChatInput', pkg: 'core',
    desc: 'Message input bar with send button and left/right slots. Handles Enter-to-send and disabled state.',
    usage: `<ChatInput\n  onSend={(msg) => send(msg)}\n  placeholder="Type a message..."\n/>`,
    props: [['placeholder', 'string'], ['disabled', 'boolean'], ['sendLabel', 'string'], ['sendColor', 'Color']],
    callbacks: [['onSend', '(text: string) => void'], ['onChangeText', '(text: string) => void']],
  },
  {
    id: 'searchbar', label: 'SearchBar', pkg: 'core',
    desc: 'Debounced search input with magnifier icon and clear button. Zero per-keystroke bridge traffic.',
    usage: `<SearchBar\n  onSearch={setQuery}\n  placeholder="Search..."\n  debounce={300}\n/>`,
    props: [['placeholder', 'string'], ['debounce', 'number'], ['value', 'string'], ['autoFocus', 'boolean']],
    callbacks: [['onSearch', '(query: string) => void'], ['onSubmit', '(query: string) => void']],
  },
  {
    id: 'codeblock', label: 'CodeBlock', pkg: 'core',
    desc: 'Syntax-highlighted code display. Lua-owned tokenizer for 60fps rendering.',
    usage: `<CodeBlock language="tsx"\n  fontSize={12}\n  code={\`const x = 42;\`}\n/>`,
    props: [['code', 'string'], ['language', 'string'], ['fontSize', 'number']],
    callbacks: [],
  },
  {
    id: 'loadingdots', label: 'LoadingDots', pkg: 'core',
    desc: 'Animated ellipsis loading indicator. Cycles through dot patterns.',
    usage: `<LoadingDots color="#8b5cf6" size={12} />`,
    props: [['color', 'Color'], ['size', 'number'], ['count', 'number']],
    callbacks: [],
  },
  {
    id: 'elementcard', label: 'ElementCard', pkg: 'chemistry',
    desc: 'Periodic table element tile + detail card. Compact tile shows number, symbol, mass. Press to flip open full detail.',
    usage: `import { ElementTile, ElementCard } from '@reactjit/chemistry';\n\n<ElementTile element="Fe" size={64} />\n<ElementCard element="Fe" />`,
    props: [['element', 'number | string'], ['size', 'number (Tile)'], ['selected', 'boolean (Tile)'], ['style', 'Style']],
    callbacks: [['onPress', '(element: Element) => void']],
  },
  {
    id: 'knob', label: 'Knob', pkg: 'controls',
    desc: 'Rotary knob with drag interaction. Lua-owned drawing for 60fps response.',
    usage: `import { Knob } from '@reactjit/controls';\n\n<Knob value={0.5} onChange={setVal}\n  label="Gain" color="#f59e0b" />`,
    props: [['value', 'number (0-1)'], ['label', 'string'], ['color', 'Color'], ['size', 'number']],
    callbacks: [['onChange', '(v: number) => void']],
  },
  {
    id: 'fader', label: 'Fader', pkg: 'controls',
    desc: 'Vertical or horizontal fader slider. Hardware-style control with Lua-owned drag.',
    usage: `import { Fader } from '@reactjit/controls';\n\n<Fader value={0.7} onChange={setLevel}\n  orientation="vertical" />`,
    props: [['value', 'number (0-1)'], ['orientation', "'vertical' | 'horizontal'"], ['color', 'Color']],
    callbacks: [['onChange', '(v: number) => void']],
  },
  {
    id: 'meter', label: 'Meter', pkg: 'controls',
    desc: 'Segmented level meter with peak hold. Color zones: green, yellow, red.',
    usage: `import { Meter } from '@reactjit/controls';\n\n<Meter value={0.72} peak={0.85}\n  orientation="vertical" />`,
    props: [['value', 'number (0-1)'], ['peak', 'number (0-1)'], ['orientation', "'vertical' | 'horizontal'"], ['segments', 'number']],
    callbacks: [],
  },
  {
    id: 'tickersymbol', label: 'TickerSymbol', pkg: 'finance',
    desc: 'Stock/crypto ticker display. Shows symbol, price, change percentage, optional sparkline.',
    usage: `import { TickerSymbol } from '@reactjit/finance';\n\n<TickerSymbol symbol="AAPL"\n  price={182.52} change={1.34} />`,
    props: [['symbol', 'string'], ['price', 'number'], ['change', 'number'], ['changePercent', 'number']],
    callbacks: [['onPress', '() => void']],
  },
  {
    id: 'clock', label: 'Clock', pkg: 'time',
    desc: 'Live updating clock. Shows time, date, or both. Supports timezone selection.',
    usage: `import { Clock } from '@reactjit/time';\n\n<Clock format="time"\n  timezone="America/New_York" />`,
    props: [['format', "'time' | 'date' | 'datetime'"], ['timezone', 'string'], ['fontSize', 'number']],
    callbacks: [],
  },
  {
    id: 'stopwatch', label: 'Stopwatch', pkg: 'time',
    desc: 'Self-contained stopwatch with play/pause/reset. Lua-side high-resolution timer.',
    usage: `import { Stopwatch } from '@reactjit/time';\n\n<Stopwatch showMs fontSize={24} />`,
    props: [['showMs', 'boolean'], ['fontSize', 'number'], ['autoStart', 'boolean']],
    callbacks: [['onLap', '(time: number) => void']],
  },
  // ── Form Controls ──
  {
    id: 'slider', label: 'Slider', pkg: 'core',
    desc: 'Lua-owned drag slider with zero-latency interaction. Track, fill, and thumb painted at 60fps.',
    usage: `<Slider value={0.5}\n  onChange={setVal}\n  color="#3b82f6" />`,
    props: [['value', 'number'], ['min', 'number'], ['max', 'number'], ['step', 'number'], ['color', 'Color']],
    callbacks: [['onChange', '(v: number) => void']],
  },
  {
    id: 'switch', label: 'Switch', pkg: 'core',
    desc: 'Toggle switch with animated thumb. Lua-owned on/off state.',
    usage: `<Switch value={on}\n  onChange={setOn} />`,
    props: [['value', 'boolean'], ['disabled', 'boolean'], ['color', 'Color']],
    callbacks: [['onChange', '(v: boolean) => void']],
  },
  {
    id: 'checkbox', label: 'Checkbox', pkg: 'core',
    desc: 'Toggleable checkbox with optional label. Lua-owned state.',
    usage: `<Checkbox checked={val}\n  onChange={setVal}\n  label="Accept terms" />`,
    props: [['checked', 'boolean'], ['label', 'string'], ['disabled', 'boolean']],
    callbacks: [['onChange', '(v: boolean) => void']],
  },
  {
    id: 'radio', label: 'RadioGroup', pkg: 'core',
    desc: 'Mutually exclusive radio buttons. Lua-owned selection state.',
    usage: `<RadioGroup value={sel}\n  onChange={setSel}\n  options={[\n    { value: 'a', label: 'Option A' },\n  ]} />`,
    props: [['value', 'string'], ['options', 'RadioOption[]'], ['disabled', 'boolean']],
    callbacks: [['onChange', '(v: string) => void']],
  },
  {
    id: 'select', label: 'Select', pkg: 'core',
    desc: 'Dropdown select with keyboard navigation. Lua-owned open/close and hover.',
    usage: `<Select value={val}\n  onChange={setVal}\n  options={[\n    { value: 'a', label: 'Alpha' },\n  ]} />`,
    props: [['value', 'string'], ['options', 'SelectOption[]'], ['placeholder', 'string']],
    callbacks: [['onChange', '(v: string) => void']],
  },
  // ── Charts ──
  {
    id: 'barchart', label: 'BarChart', pkg: 'core',
    desc: 'Vertical bar chart with optional hover interaction and category labels.',
    usage: `<BarChart\n  data={[{ label: 'Jan', value: 42 }]}\n  width={300} height={200} />`,
    props: [['data', 'BarData[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color']],
    callbacks: [['onPress', '(item: BarData) => void']],
  },
  {
    id: 'linechart', label: 'LineChart', pkg: 'core',
    desc: 'Line chart with optional dots, area fill, and hover events.',
    usage: `<LineChart\n  data={[10, 20, 15, 30]}\n  width={300} height={200}\n  color="#3b82f6" />`,
    props: [['data', 'number[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color'], ['showDots', 'boolean'], ['showArea', 'boolean']],
    callbacks: [['onHover', '(index: number) => void']],
  },
  {
    id: 'piechart', label: 'PieChart', pkg: 'core',
    desc: 'Pie or donut chart with labeled segments and optional interactivity.',
    usage: `<PieChart\n  data={[\n    { label: 'A', value: 30 },\n    { label: 'B', value: 70 },\n  ]}\n  size={200} />`,
    props: [['data', 'PieData[]'], ['size', 'number'], ['donut', 'boolean']],
    callbacks: [['onSelect', '(item: PieData) => void']],
  },
  {
    id: 'radarchart', label: 'RadarChart', pkg: 'core',
    desc: 'Polygon radar/spider chart across N axes.',
    usage: `<RadarChart\n  axes={['Str', 'Dex', 'Int']}\n  data={[0.8, 0.5, 0.9]}\n  size={200} />`,
    props: [['axes', 'string[]'], ['data', 'number[]'], ['size', 'number'], ['color', 'Color']],
    callbacks: [],
  },
  {
    id: 'candlestick', label: 'Candlestick', pkg: 'core',
    desc: 'OHLC candlestick chart with overlay support for moving averages.',
    usage: `<CandlestickChart\n  data={candles}\n  width={400} height={250} />`,
    props: [['data', 'Candle[]'], ['width', 'number'], ['height', 'number'], ['overlays', 'Overlay[]']],
    callbacks: [['onPress', '(candle: Candle) => void']],
  },
  {
    id: 'orderbook', label: 'OrderBook', pkg: 'core',
    desc: 'Two-column bid/ask order book with depth bars and press selection.',
    usage: `<OrderBook\n  bids={bids} asks={asks}\n  width={300} />`,
    props: [['bids', 'BookLevel[]'], ['asks', 'BookLevel[]'], ['width', 'number'], ['precision', 'number']],
    callbacks: [['onSelect', '(level: BookLevel) => void']],
  },
  // ── More Controls ──
  {
    id: 'led', label: 'LEDIndicator', pkg: 'controls',
    desc: 'Glowing LED dot with on/off states and configurable color and glow radius.',
    usage: `import { LEDIndicator } from '@reactjit/controls';\n\n<LEDIndicator on color="#22c55e" />`,
    props: [['on', 'boolean'], ['color', 'Color'], ['size', 'number'], ['glow', 'number']],
    callbacks: [],
  },
  {
    id: 'padbutton', label: 'PadButton', pkg: 'controls',
    desc: 'MPC-style square pad with press/release callbacks and active state.',
    usage: `import { PadButton } from '@reactjit/controls';\n\n<PadButton\n  onPress={() => trigger(note)}\n  color="#ef4444" />`,
    props: [['color', 'Color'], ['size', 'number'], ['label', 'string']],
    callbacks: [['onPress', '() => void'], ['onRelease', '() => void']],
  },
  {
    id: 'stepsequencer', label: 'StepSequencer', pkg: 'controls',
    desc: 'Interactive step sequencer grid. Lua-owned drag-to-paint pattern editing.',
    usage: `import { StepSequencer } from '@reactjit/controls';\n\n<StepSequencer\n  steps={16} tracks={4}\n  pattern={pattern}\n  onChange={setPattern} />`,
    props: [['steps', 'number'], ['tracks', 'number'], ['pattern', 'boolean[][]'], ['activeStep', 'number']],
    callbacks: [['onChange', '(pattern: boolean[][]) => void']],
  },
  {
    id: 'transport', label: 'TransportBar', pkg: 'controls',
    desc: 'Play/stop/record transport controls with BPM and position display.',
    usage: `import { TransportBar } from '@reactjit/controls';\n\n<TransportBar\n  playing={isPlaying}\n  bpm={120}\n  onPlay={play}\n  onStop={stop} />`,
    props: [['playing', 'boolean'], ['recording', 'boolean'], ['bpm', 'number'], ['position', 'string']],
    callbacks: [['onPlay', '() => void'], ['onStop', '() => void'], ['onRecord', '() => void']],
  },
  {
    id: 'piano', label: 'PianoKeyboard', pkg: 'controls',
    desc: 'Lua-owned piano keyboard with glissando, hover, and MIDI note callbacks.',
    usage: `import { PianoKeyboard } from '@reactjit/controls';\n\n<PianoKeyboard\n  octaves={2} startOctave={3}\n  onNoteOn={play}\n  onNoteOff={stop} />`,
    props: [['octaves', 'number'], ['startOctave', 'number'], ['width', 'number'], ['height', 'number']],
    callbacks: [['onNoteOn', '(note: number) => void'], ['onNoteOff', '(note: number) => void']],
  },
  {
    id: 'xypad', label: 'XYPad', pkg: 'controls',
    desc: '2D XY control pad. Maps thumb position to two continuous parameters.',
    usage: `import { XYPad } from '@reactjit/controls';\n\n<XYPad x={0.5} y={0.5}\n  onChange={({ x, y }) => update(x, y)} />`,
    props: [['x', 'number (0-1)'], ['y', 'number (0-1)'], ['size', 'number'], ['color', 'Color']],
    callbacks: [['onChange', '({ x, y }) => void']],
  },
  {
    id: 'pitchwheel', label: 'PitchWheel', pkg: 'controls',
    desc: 'Vertical pitch wheel with optional spring-return to center.',
    usage: `import { PitchWheel } from '@reactjit/controls';\n\n<PitchWheel value={0}\n  onChange={setPitch}\n  springReturn />`,
    props: [['value', 'number (-1 to 1)'], ['springReturn', 'boolean'], ['height', 'number']],
    callbacks: [['onChange', '(v: number) => void']],
  },
  // ── Chemistry ──
  {
    id: 'periodictable', label: 'PeriodicTable', pkg: 'chemistry',
    desc: 'Full 118-element interactive periodic table with category color coding.',
    usage: `import { PeriodicTable } from '@reactjit/chemistry';\n\n<PeriodicTable\n  onSelect={setElement}\n  colorBy="category" />`,
    props: [['colorBy', "'category' | 'phase' | 'electronegativity'"], ['compact', 'boolean'], ['highlighted', 'number[]']],
    callbacks: [['onSelect', '(el: Element) => void']],
  },
  {
    id: 'moleculecard', label: 'MoleculeCard', pkg: 'chemistry',
    desc: 'Molecule summary with formula, molar mass, geometry, and composition.',
    usage: `import { MoleculeCard } from '@reactjit/chemistry';\n\n<MoleculeCard formula="H2O" />`,
    props: [['formula', 'string'], ['showBonds', 'boolean'], ['style', 'Style']],
    callbacks: [],
  },
  {
    id: 'electronshell', label: 'ElectronShell', pkg: 'chemistry',
    desc: 'Bohr model electron shell diagram with orbital rings and electron dots.',
    usage: `import { ElectronShell } from '@reactjit/chemistry';\n\n<ElectronShell element="Fe" />`,
    props: [['element', 'number | string'], ['animated', 'boolean'], ['style', 'Style']],
    callbacks: [],
  },
  {
    id: 'reactionview', label: 'ReactionView', pkg: 'chemistry',
    desc: 'Chemical equation renderer. Balances equations and shows reaction type/enthalpy.',
    usage: `import { ReactionView } from '@reactjit/chemistry';\n\n<ReactionView\n  equation="Fe + O2 -> Fe2O3" />`,
    props: [['equation', 'string'], ['animated', 'boolean'], ['showEnergy', 'boolean']],
    callbacks: [],
  },
  // ── Finance ──
  {
    id: 'tickertape', label: 'TickerTape', pkg: 'finance',
    desc: 'Horizontally scrolling live ticker tape with selectable symbols.',
    usage: `import { TickerTape } from '@reactjit/finance';\n\n<TickerTape\n  items={tickers}\n  speed={40} />`,
    props: [['items', 'TickerItem[]'], ['speed', 'number']],
    callbacks: [['onSelect', '(sym: string) => void']],
  },
  {
    id: 'portfoliocard', label: 'PortfolioCard', pkg: 'finance',
    desc: 'Portfolio summary card with holdings list, total value, and day P&L.',
    usage: `import { PortfolioCard } from '@reactjit/finance';\n\n<PortfolioCard\n  snapshot={portfolio} />`,
    props: [['snapshot', 'PortfolioSnapshot'], ['style', 'Style']],
    callbacks: [],
  },
  {
    id: 'rsigauge', label: 'RSIGauge', pkg: 'finance',
    desc: 'RSI indicator gauge with overbought/oversold zones.',
    usage: `import { RSIGauge } from '@reactjit/finance';\n\n<RSIGauge value={65} />`,
    props: [['value', 'number (0-100)'], ['width', 'number'], ['height', 'number']],
    callbacks: [],
  },
  {
    id: 'macdpanel', label: 'MACDPanel', pkg: 'finance',
    desc: 'MACD histogram + signal line panel for technical analysis.',
    usage: `import { MACDPanel } from '@reactjit/finance';\n\n<MACDPanel data={macdData}\n  width={400} height={150} />`,
    props: [['data', 'MACDPoint[]'], ['width', 'number'], ['height', 'number']],
    callbacks: [],
  },
  // ── Time ──
  {
    id: 'countdown', label: 'Countdown', pkg: 'time',
    desc: 'Self-contained countdown timer with start/pause/reset and onComplete.',
    usage: `import { Countdown } from '@reactjit/time';\n\n<Countdown\n  duration={60000}\n  onComplete={done} />`,
    props: [['duration', 'number (ms)'], ['autoStart', 'boolean'], ['showMs', 'boolean'], ['controls', 'boolean']],
    callbacks: [['onComplete', '() => void'], ['onTick', '(remaining: number) => void']],
  },
  // ── AI ──
  {
    id: 'minimalchat', label: 'MinimalChat', pkg: 'ai',
    desc: 'Bare-minimum self-contained AI chat. Messages + input, calls useChat internally.',
    usage: `import { MinimalChat } from '@reactjit/ai';\n\n<MinimalChat\n  model="claude-sonnet-4-6" />`,
    props: [['model', 'string'], ['systemPrompt', 'string'], ['placeholder', 'string']],
    callbacks: [],
  },
  // ── Data ──
  {
    id: 'spreadsheet', label: 'Spreadsheet', pkg: 'data',
    desc: 'Interactive spreadsheet with formula engine. SUM, IF, VLOOKUP, and more.',
    usage: `import { Spreadsheet } from '@reactjit/data';\n\n<Spreadsheet\n  rows={20} cols={8}\n  data={initial} />`,
    props: [['rows', 'number'], ['cols', 'number'], ['data', 'CellData[][]']],
    callbacks: [['onChange', '(data: CellData[][]) => void']],
  },
  // ── Search ──
  {
    id: 'commandpalette', label: 'CommandPalette', pkg: 'core',
    desc: 'Full-screen modal command launcher with fuzzy search, shortcuts, and groups.',
    usage: `<CommandPalette\n  commands={cmds}\n  onSelect={run}\n  visible={open} />`,
    props: [['commands', 'Command[]'], ['visible', 'boolean'], ['placeholder', 'string']],
    callbacks: [['onSelect', '(cmd: Command) => void'], ['onClose', '() => void']],
  },
  // ── APIs ──
  {
    id: 'statcard', label: 'StatCard', pkg: 'apis',
    desc: 'Metric card with label, value, optional sublabel and trend arrow.',
    usage: `import { StatCard } from '@reactjit/apis';\n\n<StatCard\n  label="Revenue" value="$12.4k"\n  trend="up" />`,
    props: [['label', 'string'], ['value', 'string'], ['sublabel', 'string'], ['trend', "'up' | 'down' | 'flat'"]],
    callbacks: [],
  },
  {
    id: 'nowplayingcard', label: 'NowPlayingCard', pkg: 'apis',
    desc: 'Album art + track/artist + progress bar card. Wires to Spotify/Last.fm.',
    usage: `import { NowPlayingCard } from '@reactjit/apis';\n\n<NowPlayingCard\n  track={nowPlaying} />`,
    props: [['track', 'NowPlaying'], ['style', 'Style']],
    callbacks: [['onPress', '() => void']],
  },
  {
    id: 'repocard', label: 'RepoCard', pkg: 'apis',
    desc: 'GitHub repository card with stars, language, and description.',
    usage: `import { RepoCard } from '@reactjit/apis';\n\n<RepoCard\n  repo={repoData} />`,
    props: [['repo', 'GitHubRepo'], ['style', 'Style']],
    callbacks: [['onPress', '() => void']],
  },
  // ── Image Gallery ──
  {
    id: 'imagegallery', label: 'ImageGallery', pkg: 'core',
    desc: 'Grid/column thumbnail gallery with click-to-open lightbox viewer.',
    usage: `<ImageGallery\n  images={urls}\n  columns={3} />`,
    props: [['images', 'string[] | GalleryImage[]'], ['columns', 'number'], ['gap', 'number']],
    callbacks: [['onSelect', '(index: number) => void']],
  },
  {
    id: 'contextmenu', label: 'ContextMenu', pkg: 'core',
    desc: 'Right-click context menu with keyboard nav and nested submenus.',
    usage: `<ContextMenu items={[\n  { id: 'copy', label: 'Copy' },\n  { id: 'paste', label: 'Paste' },\n]} onSelect={handle} />`,
    props: [['items', 'MenuItem[]'], ['visible', 'boolean'], ['x', 'number'], ['y', 'number']],
    callbacks: [['onSelect', '(id: string) => void'], ['onClose', '() => void']],
  },
  {
    id: 'math', label: 'Math', pkg: 'core',
    desc: 'LaTeX math typesetting. Lua parses and renders glyphs via Love2D.',
    usage: `<Math\n  tex="E = mc^2"\n  fontSize={18} />`,
    props: [['tex', 'string'], ['fontSize', 'number'], ['color', 'Color']],
    callbacks: [],
  },
  {
    id: 'messagelist', label: 'MessageList', pkg: 'core',
    desc: 'Scrollable container for chat messages with inverted scroll and empty state.',
    usage: `<MessageList\n  messages={msgs}\n  renderMessage={renderFn} />`,
    props: [['messages', 'Message[]'], ['inverted', 'boolean'], ['emptyText', 'string']],
    callbacks: [],
  },
  {
    id: 'actionbar', label: 'ActionBar', pkg: 'core',
    desc: 'Horizontal row of labeled action buttons (copy, delete, regenerate).',
    usage: `<ActionBar actions={[\n  { id: 'copy', label: 'Copy' },\n  { id: 'delete', label: 'Delete' },\n]} onAction={handle} />`,
    props: [['actions', 'Action[]']],
    callbacks: [['onAction', '(id: string) => void']],
  },
  {
    id: 'flatlist', label: 'FlatList', pkg: 'core',
    desc: 'Virtualized scrollable list. Only mounts visible items + buffer zone.',
    usage: `<FlatList\n  data={items}\n  renderItem={({ item }) => <Row item={item} />}\n  itemHeight={40} />`,
    props: [['data', 'T[]'], ['renderItem', '(info: { item: T }) => ReactNode'], ['itemHeight', 'number']],
    callbacks: [],
  },
];

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── GalleryStory ─────────────────────────────────────────

export function GalleryStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabsExpanded, setTabsExpanded] = useState(false);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];
  const pkgColor = PKG[tab.pkg];

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return TABS;
    const q = searchQuery.toLowerCase();
    return TABS.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.pkg.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const tabGridHeight = tabsExpanded ? 380 : 232;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header row 1: Gallery title ── */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, gap: 14,
      }}>
        <Image src="layout-grid" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Components'}</Text>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'Gallery'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Composed components, live and interactive'}</Text>
      </Box>

      {/* ── Header row 2: Component name + package badge ── */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, gap: 10,
      }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>{tab.label}</Text>
        {pkgColor ? (
          <Box style={{ backgroundColor: `${pkgColor}22`, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: pkgColor, fontSize: 10 }}>{`@reactjit/${tab.pkg}`}</Text>
          </Box>
        ) : (
          <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
          </Box>
        )}
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

      {/* ── Info row: description | usage | props ── */}
      <Box style={{
        height: 120, flexShrink: 0, flexDirection: 'row',
        borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.bgElevated, overflow: 'hidden',
      }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>{'DESCRIPTION'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{tab.desc}</Text>
        </Box>

        <VerticalDivider />

        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>{'USAGE'}</Text>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </Box>

        <VerticalDivider />

        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>{'PROPS'}</Text>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type]) => (
              <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
              </Box>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>{'CALLBACKS'}</Text>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig]) => (
                  <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                    <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* ── Preview area ── */}
      <Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
        {PREVIEWS[tab.id]?.(c)}
      </Box>

      {/* ── Divider bar: expand toggle + search ── */}
      <Pressable onPress={() => setTabsExpanded(!tabsExpanded)}>
        <Box style={{
          flexShrink: 0, flexDirection: 'row', alignItems: 'center',
          backgroundColor: c.bgElevated, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border,
          paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 10,
        }}>
          {/* Drag/expand handle */}
          <Box style={{ gap: 2 }}>
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
          </Box>
          <Image
            src={tabsExpanded ? 'chevron-down' : 'chevron-up'}
            style={{ width: 12, height: 12 }}
            tintColor={c.muted}
          />
          <Text style={{ color: c.muted, fontSize: 9 }}>
            {`${filteredTabs.length} component${filteredTabs.length !== 1 ? 's' : ''}`}
          </Text>

          <Box style={{ flexGrow: 1 }} />

          {/* Search input */}
          <Pressable onPress={(e: any) => { if (e && e.stopPropagation) e.stopPropagation(); }}>
            <Box style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border,
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              width: 180,
            }}>
              <Image src="search" style={{ width: 10, height: 10 }} tintColor={c.muted} />
              <Input
                placeholder="Filter components..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  flexGrow: 1, color: c.text, fontSize: 9,
                  backgroundColor: 'transparent', padding: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Image src="x" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                </Pressable>
              )}
            </Box>
          </Pressable>
        </Box>
      </Pressable>

      {/* ── Tab grid — thumbnail previews ── */}
      <ScrollView style={{
        height: tabGridHeight, flexShrink: 0,
        backgroundColor: c.bgElevated,
      }}>
        <Box style={{
          flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
          paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8, gap: 6,
        }}>
          {filteredTabs.map(comp => {
            const active = comp.id === activeId;
            const compPkgColor = PKG[comp.pkg];
            return (
              <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                <Box style={{
                  width: 68, height: 68,
                  backgroundColor: active ? C.selected : c.surface,
                  borderRadius: 6,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? C.accent : c.border,
                  overflow: 'hidden',
                }}>
                  <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
                    {THUMBS[comp.id]?.(c)}
                  </Box>
                  <Box style={{
                    flexShrink: 0, height: 14,
                    backgroundColor: active ? C.accentDim : 'rgba(0,0,0,0.3)',
                    justifyContent: 'center', alignItems: 'center',
                    flexDirection: 'row', gap: 3,
                  }}>
                    {compPkgColor && <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: compPkgColor }} />}
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 6 }}>{comp.label}</Text>
                  </Box>
                </Box>
              </Pressable>
            );
          })}
          {filteredTabs.length === 0 && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 11 }}>{`No components match "${searchQuery}"`}</Text>
            </Box>
          )}
        </Box>
      </ScrollView>

      {/* ── Footer — breadcrumbs + counter ── */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderTopWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Components'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="layout-grid" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{tab.pkg}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </Box>
  );
}
