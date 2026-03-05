/**
 * DevTools — The developer experience stack.
 *
 * F12 inspector, HMR, useHotState, layout colorizer, GIF recorder,
 * debug channels, memory watchdog, test runner, context menu, event trail.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, useHotState, DevToolsEmbed } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// -- Palette ----------------------------------------------------------

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
  pink: '#ec4899',
  // DevTools panel colors
  dtBg: 'rgb(13, 13, 26)',
  dtTabBg: 'rgb(20, 20, 36)',
  dtTabActive: 'rgb(13, 13, 26)',
  dtTabText: 'rgba(140, 148, 166, 1)',
  dtTabTextActive: 'rgba(224, 230, 240, 1)',
  dtTabAccent: 'rgba(97, 166, 250, 1)',
  dtBorder: 'rgba(64, 64, 89, 0.8)',
  dtStatusBg: 'rgb(15, 15, 28)',
  // Perf colors
  perfGreen: 'rgb(77, 204, 102)',
  perfYellow: 'rgb(242, 191, 51)',
  perfRed: 'rgb(242, 97, 97)',
  perfBudgetBg: 'rgba(255, 255, 255, 0.06)',
  perfSparkFill: 'rgba(97, 166, 250, 0.15)',
  perfSparkLine: 'rgba(97, 166, 250, 0.8)',
  // Wireframe colors
  wfBg: 'rgb(8, 8, 15)',
  wfBorder: 'rgba(64, 64, 89, 0.4)',
  wfSelected: 'rgba(97, 166, 250, 1)',
  wfDepth0: 'rgba(97, 166, 250, 0.5)',
  wfDepth1: 'rgba(166, 227, 161, 0.5)',
  wfDepth2: 'rgba(249, 226, 175, 0.5)',
  wfDepth3: 'rgba(203, 166, 247, 0.5)',
  // Colorizer preview
  colorizerHue1: 'rgba(230, 70, 70, 0.35)',
  colorizerHue2: 'rgba(70, 180, 230, 0.35)',
  colorizerHue3: 'rgba(230, 200, 50, 0.35)',
  colorizerHue4: 'rgba(120, 230, 70, 0.35)',
  colorizerHue5: 'rgba(180, 70, 230, 0.35)',
  colorizerBorder1: 'rgba(230, 70, 70, 0.6)',
  colorizerBorder2: 'rgba(70, 180, 230, 0.6)',
  colorizerBorder3: 'rgba(230, 200, 50, 0.6)',
  colorizerBorder4: 'rgba(120, 230, 70, 0.6)',
  colorizerBorder5: 'rgba(180, 70, 230, 0.6)',
};

// -- Static code blocks (hoisted) -------------------------------------

const INSTALL_CODE = `import { useHotState, useGifRecorder } from '@reactjit/core'`;

const HOT_STATE_CODE = `// Drop-in replacement for useState
// State lives in Lua memory — survives HMR
const [sidebar, setSidebar] = useHotState('sidebar', true);
const [tab, setTab] = useHotState('settings.tab', 'general');

// Plain useState dies on every hot reload
const [count, setCount] = useState(0);  // resets to 0`;

const PRESERVE_STATE_CODE = `// Auto-mode: patches ALL useState calls
// Enabled by default — zero code changes needed
// Toggle in DevTools > Logs > HMR Settings

// Under the hood:
//   React.useState = preservedUseState
//   Every call auto-keys by component + hook index
//   Values sync to Lua memory via microtask

// Opt out per-call:
const [x, setX] = useState.volatile(0);`;

const HMR_CODE = `-- What happens on file save:
-- 1. esbuild detects change, rebuilds bundle
-- 2. Lua polls bundle mtime, detects change
-- 3. Lua saves hotstate atoms to injection cache
-- 4. QuickJS context destroyed (JS dies)
-- 5. Fresh QuickJS context created
-- 6. __hotstateCache injected into globalThis
-- 7. New bundle evaluated — hooks read cache
-- 8. React tree rebuilt with preserved state

-- Lua process NEVER restarts during HMR
-- Only the JS context is recycled`;

const GIF_CODE = `const { recording, start, stop, gifPath, frames }
  = useGifRecorder();

// Start recording at 15fps
start({ fps: 15 });

// Stop and assemble GIF via ffmpeg
const path = await stop();
// -> /path/to/project/recording.gif`;

const SCREENSHOT_CODE = `# Headless capture from CLI
rjit screenshot --output /tmp/preview.png

# Waits 3 frames for layout to settle,
# captures framebuffer, writes PNG, exits`;

const DEBUG_CHANNELS_CODE = `-- Enable at startup via environment variable:
REACTJIT_DEBUG=tree,layout love love
REACTJIT_DEBUG=all love love

-- Toggle at runtime via console:
:log              -- show all channels
:log tree         -- toggle tree channel
:log tree on      -- explicit on
:log all          -- enable all
:log none         -- disable all`;

const TEST_RUNNER_CODE = `# Built-in test runner — runs inside Love2D
cd examples/my-app
rjit build && rjit test tests/my.test.ts

// tests/my.test.ts (no imports needed)
test('button triggers state change', async () => {
  await page.find('Pressable', { testId: 'toggle' })
    .then(l => l.click());
  await expect(
    page.find('Text', { testId: 'status' })
  ).toHaveText('on');
});`;

const CONTEXT_MENU_CODE = `-- Right-click anywhere in the app:
--   Inspect         -- select node in Elements tab
--   Copy            -- clipboard (if text selected)
--   ─────────────
--   Refresh         F5
--   Screenshot
--   Theme Menu      F8
--   Settings
--   Layout Colors   Ctrl+Shift+L`;

const WATCHDOG_CODE = `# External bash process monitors /proc RSS
# Three-strike escalation:
#   Spike #1: Warning (count)
#   Spike #2: PANIC — 20ms sampling, /proc snapshot,
#             signal Lua to dump subsystem state
#   Spike #3: KILL — merge diagnostics, spawn reporter

# Also detects frozen processes:
#   Heartbeat file written every ~1s by Lua
#   No update for 5s = frozen = kill + crash report`;

const EVENT_TRAIL_CODE = `-- Ring buffer of semantic events for crash reports
-- Records: clicks, keypresses, focus changes
-- Mutes: mousemoved, mousedragged (noise)

-- Enriched with component context:
--   "Clicked Pressable 'Save' (App > Toolbar)"
--   "keypressed: ctrl+s"
--   "Focused TextInput (placeholder='Search...')"

-- On crash: trail.freeze() locks the buffer
-- BSOD and crash reporter display the trail`;

// -- HotState Demo (live comparison) -----------------------------------

function HotStateDemo() {
  const c = useThemeColors();
  const [hotCount, setHotCount] = useHotState('devtools-demo-counter', 0);
  const [plainCount, setPlainCount] = React.useState(0);

  return (
    <Box style={{ width: '100%', gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        {/* useHotState counter */}
        <Box style={{ flexGrow: 1, backgroundColor: 'rgba(166, 227, 161, 0.08)', borderRadius: 6, padding: 10, gap: 6, borderWidth: 1, borderColor: 'rgba(166, 227, 161, 0.2)' }}>
          <Text style={{ fontSize: 8, color: C.green }}>{'useHotState'}</Text>
          <Text style={{ fontSize: 24, color: c.text, fontWeight: 'bold' }}>{`${hotCount}`}</Text>
          <Pressable onPress={() => setHotCount(hotCount + 1)}>
            <Box style={{ backgroundColor: C.green, borderRadius: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold' }}>{'+ Increment'}</Text>
            </Box>
          </Pressable>
          <Text style={{ fontSize: 7, color: C.green }}>{'Survives hot reload'}</Text>
        </Box>

        {/* useState counter */}
        <Box style={{ flexGrow: 1, backgroundColor: 'rgba(243, 139, 168, 0.08)', borderRadius: 6, padding: 10, gap: 6, borderWidth: 1, borderColor: 'rgba(243, 139, 168, 0.2)' }}>
          <Text style={{ fontSize: 8, color: C.red }}>{'useState'}</Text>
          <Text style={{ fontSize: 24, color: c.text, fontWeight: 'bold' }}>{`${plainCount}`}</Text>
          <Pressable onPress={() => setPlainCount(plainCount + 1)}>
            <Box style={{ backgroundColor: C.red, borderRadius: 4, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: '#000', fontWeight: 'bold' }}>{'+ Increment'}</Text>
            </Box>
          </Pressable>
          <Text style={{ fontSize: 7, color: C.red }}>{'Resets on reload'}</Text>
        </Box>
      </Box>

      <Text style={{ fontSize: 8, color: c.muted }}>
        {'Increment both, then press F5 to hot reload. The left counter survives. The right resets to 0.'}
      </Text>
    </Box>
  );
}

// -- Wireframe Preview -------------------------------------------------

function WireframePreview() {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.wfBg,
      borderRadius: 6,
      overflow: 'hidden',
      padding: 8,
      borderWidth: 1,
      borderColor: C.dtBorder,
    }}>
      {/* Viewport border */}
      <Box style={{
        width: '100%',
        height: 80,
        borderWidth: 1,
        borderColor: C.wfBorder,
        padding: 2,
      }}>
        {/* Root */}
        <Box style={{
          width: '100%',
          height: '100%',
          borderWidth: 1,
          borderColor: C.wfDepth0,
          padding: 2,
          gap: 2,
        }}>
          {/* Header */}
          <Box style={{ height: 8, borderWidth: 1, borderColor: C.wfDepth1 }} />
          {/* Body row */}
          <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 2 }}>
            <Box style={{
              width: '30%',
              borderWidth: 1,
              borderColor: C.wfDepth2,
              padding: 1,
              gap: 1,
            }}>
              <Box style={{ height: 4, borderWidth: 1, borderColor: C.wfDepth3 }} />
              <Box style={{ height: 4, borderWidth: 1, borderColor: C.wfDepth3 }} />
              <Box style={{ height: 4, borderWidth: 1, borderColor: C.wfDepth3 }} />
            </Box>
            <Box style={{
              flexGrow: 1,
              borderWidth: 2,
              borderColor: C.wfSelected,
              backgroundColor: 'rgba(97, 166, 250, 0.08)',
            }}>
              <Text style={{ fontSize: 5, color: C.wfSelected, paddingLeft: 2, paddingTop: 1 }}>{'MainContent'}</Text>
            </Box>
          </Box>
          {/* Footer */}
          <Box style={{ height: 6, borderWidth: 1, borderColor: C.wfDepth1 }} />
        </Box>
      </Box>
      <Box style={{ flexDirection: 'row', marginTop: 4, gap: 8 }}>
        <Text style={{ fontSize: 6, color: C.perfGreen }}>{'Flex'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ fontSize: 6, color: C.dtTabText }}>{'42%'}</Text>
      </Box>
    </Box>
  );
}

// -- Layout Colorizer Preview ------------------------------------------

function ColorizerPreview() {
  return (
    <Box style={{
      width: '100%',
      borderRadius: 6,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.dtBorder,
      padding: 4,
      gap: 2,
      backgroundColor: 'rgb(20, 20, 30)',
    }}>
      {/* Simulated app with color overlays */}
      <Box style={{
        width: '100%',
        height: 60,
        backgroundColor: C.colorizerHue1,
        borderWidth: 1,
        borderColor: C.colorizerBorder1,
        padding: 3,
        gap: 2,
      }}>
        <Box style={{ height: 8, backgroundColor: C.colorizerHue2, borderWidth: 1, borderColor: C.colorizerBorder2 }} />
        <Box style={{ flexGrow: 1, flexDirection: 'row', gap: 2 }}>
          <Box style={{
            width: '35%',
            backgroundColor: C.colorizerHue3,
            borderWidth: 1,
            borderColor: C.colorizerBorder3,
            padding: 2,
            gap: 1,
          }}>
            <Box style={{ height: 3, backgroundColor: C.colorizerHue5, borderWidth: 1, borderColor: C.colorizerBorder5 }} />
            <Box style={{ height: 3, backgroundColor: C.colorizerHue4, borderWidth: 1, borderColor: C.colorizerBorder4 }} />
          </Box>
          <Box style={{
            flexGrow: 1,
            backgroundColor: C.colorizerHue4,
            borderWidth: 1,
            borderColor: C.colorizerBorder4,
            padding: 2,
            gap: 1,
          }}>
            <Box style={{ height: 3, backgroundColor: C.colorizerHue5, borderWidth: 1, borderColor: C.colorizerBorder5 }} />
            <Box style={{ height: 3, backgroundColor: C.colorizerHue2, borderWidth: 1, borderColor: C.colorizerBorder2 }} />
            <Box style={{ height: 3, backgroundColor: C.colorizerHue3, borderWidth: 1, borderColor: C.colorizerBorder3 }} />
          </Box>
        </Box>
      </Box>
      <Text style={{ fontSize: 6, color: C.dtTabText }}>{'Golden-angle hue rotation — siblings always distinguishable'}</Text>
    </Box>
  );
}

// -- Context Menu Preview -----------------------------------------------

function ContextMenuPreview() {
  const c = useThemeColors();
  const items = [
    { label: 'Inspect', shortcut: null, dim: false },
    { label: '---', shortcut: null, dim: false },
    { label: 'Copy', shortcut: 'Ctrl+C', dim: true },
    { label: '---', shortcut: null, dim: false },
    { label: 'Refresh', shortcut: 'F5', dim: false },
    { label: 'Screenshot', shortcut: null, dim: false },
    { label: 'Theme Menu', shortcut: 'F8', dim: false },
    { label: 'Layout Colors', shortcut: 'Ctrl+Shift+L', dim: false },
  ];

  return (
    <Box style={{ alignItems: 'center', width: '100%' }}>
      <Box style={{
        width: 170,
        backgroundColor: 'rgba(31, 31, 41, 0.95)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(64, 64, 82, 0.8)',
        paddingTop: 4,
        paddingBottom: 4,
      }}>
        {items.map((item, i) => {
          if (item.label === '---') {
            return (
              <Box key={i} style={{
                height: 1,
                backgroundColor: 'rgba(64, 64, 82, 0.5)',
                marginLeft: 10,
                marginRight: 10,
                marginTop: 4,
                marginBottom: 4,
              }} />
            );
          }
          return (
            <Box key={i} style={{
              flexDirection: 'row',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 4,
              paddingBottom: 4,
              backgroundColor: i === 0 ? 'rgba(56, 89, 140, 0.55)' : 'transparent',
              marginLeft: 6,
              marginRight: 6,
              borderRadius: 4,
            }}>
              <Text style={{
                fontSize: 8,
                color: item.dim ? 'rgba(115, 120, 128, 1)' : 'rgba(217, 222, 232, 1)',
              }}>{item.label}</Text>
              <Box style={{ flexGrow: 1 }} />
              {item.shortcut && (
                <Text style={{ fontSize: 8, color: 'rgba(146, 153, 168, 1)' }}>{item.shortcut}</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// -- Feature Catalog --------------------------------------------------

const DEV_FEATURES = [
  { label: 'F12', desc: 'Toggle devtools panel (6 tabs)', color: C.blue },
  { label: 'Ctrl+Shift+D', desc: 'Pop-out devtools into separate OS window', color: C.blue },
  { label: 'Ctrl+Shift+L', desc: 'Layout colorizer overlay', color: C.yellow },
  { label: 'Ctrl+Shift+F12', desc: 'Deliberate test crash (BSOD + event trail)', color: C.red },
  { label: 'F5 / Ctrl+R', desc: 'Refresh (hot reload)', color: C.green },
  { label: 'Right-click', desc: 'Context menu (Inspect, Copy, Screenshot, Theme...)', color: C.mauve },
  { label: 'Backtick (`)', desc: 'Open Console tab directly', color: C.teal },
];

function FeatureCatalog({ items }: { items: typeof DEV_FEATURES }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {items.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 120, flexShrink: 0 }}>{f.label}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{f.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// -- DevToolsStory -------------------------------------------------------

export function DevToolsStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* Header */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14,
      }}>
        <Image src="terminal" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'DevTools'}</Text>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'built-in'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>{'The developer experience stack'}</Text>
      </Box>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* Hero */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'F12 inspector. Hot reload that keeps your state. Layout debugging you can see.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'A Chrome-style devtools panel with six tabs (Elements, Wireframe, Perf, Network, Console, Logs), HMR that preserves useState across reloads, a layout colorizer overlay, GIF recording, headless screenshots, a memory watchdog, and a built-in test runner. Everything runs in Lua \u2014 zero browser dependencies.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* Band 1: DEVTOOLS PANEL — preview | text */}
        <Band>
          <Half>
            <DevToolsEmbed style={{ width: '100%', height: 280, borderRadius: 6 }} />
          </Half>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.blue}>{'DEVTOOLS PANEL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'F12 opens a Chrome-style bottom panel with six tabs. The panel is draggable-resizable, dockable, and can pop out into a separate OS window via Ctrl+Shift+D. Canvas overlays (hover highlight, selected outline, perf bar) always render on the main canvas regardless of which tab is active.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All rendering is Lua-native \u2014 the devtools draw themselves using Love2D primitives, not React components. This means they work even when the React tree is broken.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 3: WIREFRAME — preview | text */}
        <Band>
          <Half>
            <WireframePreview />
          </Half>
          <Half>
            <SectionLabel icon="grid" accentColor={C.green}>{'WIREFRAME TAB'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'A scaled minimap of the entire instance tree. Every node is an outlined rectangle, colored by depth. Nodes with high render counts glow warm. Click a flex container to see the flex pressure overlay \u2014 basis bars, grow/shrink deltas, and free space distribution.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Selected nodes get a bright fill + label. The Flex toggle (bottom-left pill) enables the pressure overlay. Scale percentage shown bottom-right.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Callout: Lua-native */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'The devtools panel, layout colorizer, context menu, and all overlays are rendered entirely in Lua. They work even when the JS bridge is dead, the React tree is empty, or the app is in crash recovery mode.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* Band 4: HMR — code | text */}
        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={HMR_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.green}>{'HOT MODULE REPLACEMENT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Save a file and the app reloads in place. The Lua process never restarts \u2014 only the QuickJS JS context is destroyed and recreated. esbuild watches for changes, Lua polls the bundle mtime, and the reload path injects all hotstate atoms into the new context before evaluation.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Lua modules get their own HMR: when .lua files change on disk, the reload path re-requires core modules (measure, layout, painter, events, tree, textinput, codeblock, devtools). A bad module is caught by pcall and retried on the next reload.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 5: useHotState — demo | text+code */}
        <Band>
          <Half>
            <HotStateDemo />
          </Half>
          <Half>
            <SectionLabel icon="database" accentColor={C.yellow}>{'useHotState'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Drop-in replacement for useState. State lives in a Lua memory table that persists across hot reloads. On HMR, the reload path injects all atoms as globalThis.__hotstateCache before the new bundle evaluates. Hooks read from the cache synchronously on first render \u2014 zero flash, zero async delay.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Unlike useLocalStore (SQLite-backed, survives app restarts), useHotState lives purely in memory. It survives HMR but NOT app restarts. Use it for ephemeral UI state: sidebar open, scroll position, selected tab.'}
            </Text>
            <CodeBlock language="tsx" fontSize={8} code={HOT_STATE_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Band 6: preserveState — code | text */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={PRESERVE_STATE_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="shield" accentColor={C.yellow}>{'AUTO STATE PRESERVATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'When enabled, React.useState is monkey-patched so every call automatically syncs to Lua hotstate atoms. Keys are auto-generated from component name + hook call index. Toggle it in DevTools > Logs > HMR Settings.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The patched useState calls exactly one hook (the original). No useRef, no useEffect \u2014 adding hooks would change the hook count and break React. Lua sync happens via microtask. Opt out per-call with useState.volatile().'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 7: LAYOUT COLORIZER — preview | text */}
        <Band>
          <Half>
            <ColorizerPreview />
          </Half>
          <Half>
            <SectionLabel icon="eye" accentColor={C.peach}>{'LAYOUT COLORIZER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Ctrl+Shift+L (or right-click > Layout Colors) paints every node with a semi-transparent color overlay. Each depth level gets a different hue via golden-angle rotation (\u22480.618 x 360\u00b0), so siblings are always visually distinguishable. Instantly reveals flex boundaries, overflow, and sizing issues.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'12% alpha fill + 50% alpha border. Walks the full instance tree recursively. Toggle is persistent across frames.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 8: CONTEXT MENU — text | preview */}
        <Band>
          <Half>
            <SectionLabel icon="menu" accentColor={C.mauve}>{'CONTEXT MENU'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Right-click anywhere to get a context-aware menu. Built-in items include Inspect (opens Elements tab on the clicked node), Copy (when text is selected), Refresh, Screenshot, Theme Menu, and Layout Colors. Custom items come from ContextMenu React ancestors.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Lua-owned singleton. Keyboard navigation (arrow keys, Enter, Escape). Hover highlight. Viewport clamping. All interaction state lives in Lua \u2014 JS only receives boundary events.'}
            </Text>
          </Half>
          <Half>
            <ContextMenuPreview />
          </Half>
        </Band>

        <Divider />

        {/* Band 9: GIF RECORDER — code | text */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={GIF_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="video" accentColor={C.red}>{'GIF RECORDER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useGifRecorder captures frames from the Love2D framebuffer at a configurable FPS, saves them as numbered PNGs, then shells out to ffmpeg for two-pass palette generation. Returns recording state, frame count, and the output path.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Requires ffmpeg on PATH. Frames are stored in Love2D\'s save directory and cleaned up after assembly. Polls status at 500ms intervals while recording.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 10: SCREENSHOT — text | code */}
        <Band>
          <Half>
            <SectionLabel icon="camera" accentColor={C.teal}>{'HEADLESS SCREENSHOT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'rjit screenshot captures the app without a visible window. Waits 3 frames for tree mutations, layout pass, and paint to settle, then captures the framebuffer as PNG and exits. Used by CI pipelines and the lint workflow to visually verify layouts.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="bash" fontSize={9} code={SCREENSHOT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Band 11: DEBUG CHANNELS — code | text */}
        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={DEBUG_CHANNELS_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="filter" accentColor={C.teal}>{'DEBUG LOG CHANNELS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'10 named channels (layout, tree, events, paint, bridge, recon, dispatch, focus, animate, capsync), each with its own color. All off by default. Toggle at runtime via the Logs tab (pill switches) or the console (:log command). Enable at startup via REACTJIT_DEBUG env var.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Output goes to both terminal (stdout) and the Console tab. Frame-numbered for correlation: [F:142 layout] layoutNode id=7 type=View avail=800x600.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 12: EVENT TRAIL — text | code */}
        <Band>
          <Half>
            <SectionLabel icon="activity" accentColor={C.peach}>{'EVENT TRAIL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'A 60-entry ring buffer of semantic events for crash diagnostics. Records clicks (with component ancestry), keypresses (with modifier keys), and focus changes. Mutes noisy events (mousemoved, mousedragged). On crash, the trail freezes and is displayed in the BSOD and crash reporter.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={EVENT_TRAIL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Band 13: WATCHDOG — code | text */}
        <Band>
          <Half>
            <CodeBlock language="bash" fontSize={8} code={WATCHDOG_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="shield" accentColor={C.red}>{'MEMORY WATCHDOG'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'An external bash process monitors /proc/PID/statm for sustained RSS growth. Three consecutive spikes above the threshold (default 50MB per 100ms sample) trigger a three-strike escalation: warning, panic snapshot (20ms sampling + /proc diagnostics + Lua subsystem dump), kill + crash reporter spawn.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Also detects frozen processes via heartbeat: Lua writes os.time() to a tmp file every ~1 second. If stale for 5 seconds, the process is frozen and gets killed with a crash report.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 14: TEST RUNNER — text | code */}
        <Band>
          <Half>
            <SectionLabel icon="check-circle" accentColor={C.green}>{'TEST RUNNER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'rjit test runs specs inside the Love2D process with direct access to the instance tree, layout results, and event system. No browser automation, no ports, no sockets. Selectors use page.find(componentName, props). Actions include click, type, key. Matchers include toBeVisible, toHaveText, toHaveRect.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Each await is one frame. click() and type() add an extra wait for React to re-render. Timing is deterministic \u2014 no flaky async waits.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={TEST_RUNNER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Full-width: keyboard shortcuts catalog */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 8 }}>
          <SectionLabel icon="command" accentColor={C.accent}>{'KEYBOARD SHORTCUTS'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Every dev shortcut built into the runtime:'}</Text>
          <FeatureCatalog items={DEV_FEATURES} />
        </Box>

        <Divider />

        {/* Callout: hotstate snapshots */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Hotstate atoms can be snapshot to a JSON file (hotstate:snapshot RPC) and preloaded on reload (state_preset.json). This lets Claude \u2014 or any tool \u2014 reproduce exact app states for testing without clicking through the UI.'}
          </Text>
        </CalloutBand>

      </ScrollView>

      {/* Footer */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderTopWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="terminal" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'DevTools'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
