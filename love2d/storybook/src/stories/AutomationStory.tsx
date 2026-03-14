/**
 * Automation — Puppeteer for everything.
 *
 * Two automation paradigms in one story:
 *   1. rjit test / page.* — script the Love2D window itself
 *   2. useAndroidVM — script Android VMs via ADB
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, useAndroidVM, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#10b981',
  accentDim: 'rgba(16, 185, 129, 0.12)',
  callout: 'rgba(16, 185, 129, 0.06)',
  calloutBorder: 'rgba(16, 185, 129, 0.30)',
  rjitTest: '#3b82f6',
  android: '#ef5350',
  query: '#8b5cf6',
  input: '#ec4899',
  audit: '#f59e0b',
  system: '#06b6d4',
  file: '#84cc16',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `# No install needed — rjit test is built into the CLI
rjit build                     # build your app first
rjit test tests/my.test.ts     # run a spec`;

const RJIT_TEST_CODE = `// tests/my-app.test.ts
// Globals: test(), page, expect() — no import needed

test('submit button is visible', async () => {
  const btn = page.find('Pressable', { testId: 'submit' });
  await expect(btn).toBeVisible();
});

test('typing updates results', async () => {
  const input = page.find('TextInput', { testId: 'search' });
  await input.type('hello');
  await expect(
    page.find('Text', { testId: 'result-count' })
  ).toContainText('hello');
});

test('clicking toggles state', async () => {
  await page.find('Pressable', { testId: 'toggle' }).click();
  await expect(
    page.find('Text', { testId: 'status' })
  ).toHaveText('on');
});`;

const SELECTORS_CODE = `// By component type + prop
page.find('Pressable', { testId: 'submit' })

// Any Text node
page.find('Text')

// By any prop value
page.find('TextInput', { placeholder: 'Search...' })

// All matches (returns array)
const all = await page.find('Box').all()

// Component name matches debugName or raw type
// 'Pressable', 'Box', 'ScrollView', 'View', 'Text'`;

const ACTIONS_CODE = `// Mouse
await locator.click()        // press + release at center

// Keyboard
await locator.type('hello')  // click to focus + inject chars
await locator.key('return')  // keypressed/keyreleased

// Query
await locator.text()         // text content
await locator.rect()         // { x, y, w, h }
await locator.all()          // all matching nodes

// Page-level
await page.wait()            // wait 1 frame
await page.wait(3)           // wait N frames
await page.screenshot('/tmp/s.png')`;

const MATCHERS_CODE = `await expect(locator).toBeVisible()
// exists + non-zero size

await expect(locator).toBeFound()
// exists in tree

await expect(locator).toHaveText('exact')
// exact text match

await expect(locator).toContainText('sub')
// substring match

await expect(locator).toHaveRect({ x, y, w, h })
// pixel rect within +/-1px tolerance`;

const AUDIT_CODE = `// Layout audit — catches overflow, overlap, off-viewport
const violations = await page.audit();

// Text audit — text overlap, escape, truncation
const textIssues = await page.textAudit();

// Divider audit — text overlapping thin separators
const dividerIssues = await page.dividerAudit();

// Scroll diagnostics — contentH, viewportH, ratio
const scrollInfo = await page.scrollHeights();

// Window control
await page.resize(1024, 768);`;

const SWEEP_CODE = `// Real test: sweep all stories at multiple viewports
test('layout audit at all breakpoints', async () => {
  const viewports = [
    [800, 600], [1024, 768], [1280, 720],
    [1920, 1080], [2560, 1440], [3840, 2160]
  ];

  for (const [w, h] of viewports) {
    await page.resize(w, h);
    const violations = await page.audit({
      threshold: 2  // ignore <2px overlaps
    });
    expect(violations.length).toBe(0);
  }
});`;

const ANDROID_INSTALL_CODE = `import { useAndroidVM, Render } from '@reactjit/core'`;

const ANDROID_BASIC_CODE = `function AndroidApp() {
  const vm = useAndroidVM({ port: 5556, autoConnect: true })

  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Render source="bliss.iso" interactive vmMemory={4096} />
      <Pressable onPress={async () => {
        await vm.tap(500, 300)
        await vm.type("hello android")
        await vm.launch("com.android.chrome")
      }}>
        <Text>Control VM</Text>
      </Pressable>
    </Box>
  )
}`;

const ANDROID_INPUT_CODE = `const vm = useAndroidVM({ port: 5556 })

// Connection
await vm.connect()           // adb connect localhost:5556
await vm.disconnect()        // adb disconnect

// Touch input
await vm.tap(500, 300)       // input tap x y
await vm.longpress(500, 300) // hold at coords
await vm.swipe(0, 500, 0, 100, 300)  // scroll gesture

// Text input
await vm.type("hello world") // input text "hello world"
await vm.key("HOME")         // KEYCODE_HOME
await vm.key("BACK")         // KEYCODE_BACK
await vm.key("ENTER")        // KEYCODE_ENTER`;

const ANDROID_APPS_CODE = `// Launch by package name (uses monkey)
await vm.launch("com.android.chrome")

// Launch specific activity
await vm.launch("com.android.chrome",
  "com.google.android.apps.chrome.Main")

// Install APK from host filesystem
await vm.install("/path/to/app.apk")

// Uninstall
await vm.uninstall("com.example.app")

// List all installed packages
const { packages } = await vm.packages()`;

const ANDROID_SYSTEM_CODE = `// Run any shell command
const { output } = await vm.shell("getprop ro.build.version.release")
// => "14"

// Get specific property
const { value } = await vm.getprop("sys.boot_completed")
// => "1"

// Get all properties as table
const { properties } = await vm.getprop()

// Take screenshot (pull to host)
await vm.screenshot("/tmp/android.png")

// Wait for boot (polls every 2s)
await vm.waitBoot(120) // timeout 120s

// File transfer
await vm.push("/local/file.txt", "/sdcard/file.txt")
await vm.pull("/sdcard/photo.jpg", "/local/photo.jpg")`;

const ANDROID_FLOW_CODE = `// Automated UI flow: open browser, search, screenshot
async function automatedFlow(vm) {
  await vm.connect()
  await vm.waitBoot()

  // Open Chrome
  await vm.launch("com.android.chrome")
  await vm.key("ENTER")  // dismiss first-run

  // Tap address bar and type URL
  await vm.tap(540, 100)
  await vm.type("reactjit.dev")
  await vm.key("ENTER")

  // Wait for page load, take screenshot
  await vm.shell("sleep 3")
  await vm.screenshot("/tmp/result.png")
}`;

// ── Timing Model ──────────────────────────────────────────

const TIMING_CODE = `// Each await = one Love2D frame (bridge round-trip)
// click() and type() add an extra wait automatically

test('timing example', async () => {
  await page.find('Pressable').click();
  // ^ mouse press + release + 1 frame wait
  // React has re-rendered by now

  await expect(
    page.find('Text', { testId: 'counter' })
  ).toHaveText('1');
  // ^ query + assertion in same frame

  // For animations or async work:
  await page.wait(5); // wait 5 frames
});`;

// ── Live Demo: Android VM ─────────────────────────────────

function AndroidVMDemo() {
  const c = useThemeColors();
  const vm = useAndroidVM({ port: 5556 });
  const [log, setLog] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addLog = (msg: string) => {
    setLog(prev => [...prev.slice(-8), msg]);
  };

  const doConnect = async () => {
    addLog('adb connect localhost:5556...');
    const r = await vm.connect();
    if (r?.ok) { setIsConnected(true); addLog('Connected: ' + (r.serial || '')); }
    else addLog('Failed: ' + (r?.error || 'unknown'));
  };

  const doTap = async () => {
    addLog('input tap 540 960');
    await vm.tap(540, 960);
    addLog('OK');
  };

  const doHome = async () => {
    addLog('input keyevent KEYCODE_HOME');
    await vm.key('HOME');
    addLog('OK');
  };

  const doShell = async () => {
    addLog('shell getprop ro.build.version.release');
    const r = await vm.shell('getprop ro.build.version.release');
    addLog('=> ' + (r?.output || r?.error || '?'));
  };

  const doScreenshot = async () => {
    addLog('screencap -> /tmp/android_demo.png');
    const r = await vm.screenshot('/tmp/android_demo.png');
    if (r?.ok) addLog('Saved: ' + r.path);
    else addLog('Failed: ' + ((r as any)?.error || 'unknown'));
  };

  const doPackages = async () => {
    addLog('pm list packages');
    const r = await vm.packages();
    if (r?.packages) addLog(r.packages.length + ' packages installed');
    else addLog('Failed');
  };

  const buttons = [
    { label: 'Connect', fn: doConnect, color: C.accent, needsConn: false },
    { label: 'Tap Center', fn: doTap, color: C.input, needsConn: true },
    { label: 'HOME', fn: doHome, color: C.query, needsConn: true },
    { label: 'Shell', fn: doShell, color: C.system, needsConn: true },
    { label: 'Screenshot', fn: doScreenshot, color: C.android, needsConn: true },
    { label: 'Packages', fn: doPackages, color: C.file, needsConn: true },
  ];

  return (
    <S.CenterW100 style={{ gap: 8 }}>
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        <Tag text="useAndroidVM" color={C.android} />
        <Tag text="ADB" color={C.accent} />
        <Tag text="live" color={C.file} />
      </S.RowG6>

      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        {buttons.map(b => (
          <Pressable key={b.label} onPress={b.fn}>
            <Box style={{
              backgroundColor: (b.needsConn && !isConnected) ? c.surface : b.color + '22',
              paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 4,
            }}>
              <Text style={{ fontSize: 9, color: (b.needsConn && !isConnected) ? c.textDim : b.color }}>{b.label}</Text>
            </Box>
          </Pressable>
        ))}
      </S.RowG6>

      <Box style={{
        width: '100%', minHeight: 100, borderRadius: 6,
        backgroundColor: '#0a0a0a',
        borderWidth: 1, borderColor: C.accent + '33',
        paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
        gap: 2,
      }}>
        {log.length === 0 ? (
          <Text style={{ fontSize: 8, color: c.textDim, fontFamily: 'monospace' }}>{'// ADB command log — start a VM with <Render source="*.iso" /> first'}</Text>
        ) : log.map((line, i) => (
          <Text key={i} style={{ fontSize: 8, color: i === log.length - 1 ? C.accent : C.accent + 'aa', fontFamily: 'monospace' }}>{`> ${line}`}</Text>
        ))}
      </Box>

      <S.RowCenterG6>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isConnected ? C.accent : c.textDim }} />
        <Text style={{ fontSize: 9, color: isConnected ? C.accent : c.textDim }}>
          {isConnected ? 'ADB connected' : 'Not connected'}
        </Text>
      </S.RowCenterG6>
    </S.CenterW100>
  );
}

// ── API Catalog ───────────────────────────────────────────

const RJIT_API = [
  { label: 'page.find(type, props)', desc: 'Query nodes by component type and props', color: C.query },
  { label: 'locator.click()', desc: 'Mouse press + release at element center', color: C.input },
  { label: 'locator.type(text)', desc: 'Click to focus + inject characters', color: C.input },
  { label: 'locator.key(name)', desc: 'Inject keypressed/keyreleased event', color: C.input },
  { label: 'locator.text()', desc: 'Get text content of element', color: C.query },
  { label: 'locator.rect()', desc: 'Get { x, y, w, h } layout rect', color: C.query },
  { label: 'locator.all()', desc: 'Get array of all matching nodes', color: C.query },
  { label: 'page.wait(n)', desc: 'Wait N frames (default 1)', color: C.system },
  { label: 'page.screenshot(path)', desc: 'Capture current frame to PNG', color: C.system },
  { label: 'page.resize(w, h)', desc: 'Resize the Love2D window', color: C.system },
  { label: 'page.audit()', desc: 'Detect overflow, overlap, off-viewport', color: C.audit },
  { label: 'page.textAudit()', desc: 'Detect text overlap and escape', color: C.audit },
  { label: 'page.dividerAudit()', desc: 'Detect text overlapping separators', color: C.audit },
  { label: 'page.scrollHeights()', desc: 'Scroll container diagnostics', color: C.audit },
];

const ANDROID_API = [
  { label: 'vm.connect()', desc: 'ADB TCP connection to VM', color: C.accent },
  { label: 'vm.tap(x, y)', desc: 'Touch input at coordinates', color: C.input },
  { label: 'vm.longpress(x, y)', desc: 'Long press at coordinates', color: C.input },
  { label: 'vm.swipe(x1, y1, x2, y2)', desc: 'Swipe/scroll gesture', color: C.input },
  { label: 'vm.type(text)', desc: 'Text input injection', color: C.input },
  { label: 'vm.key(name)', desc: 'Keycode event (HOME, BACK, ENTER...)', color: C.input },
  { label: 'vm.launch(pkg)', desc: 'Launch app by package name', color: C.file },
  { label: 'vm.install(apk)', desc: 'Install APK from host filesystem', color: C.file },
  { label: 'vm.shell(cmd)', desc: 'Run arbitrary shell command', color: C.system },
  { label: 'vm.screenshot(path)', desc: 'Capture and pull screenshot', color: C.system },
  { label: 'vm.getprop(key)', desc: 'Read Android system properties', color: C.system },
  { label: 'vm.waitBoot(timeout)', desc: 'Poll until sys.boot_completed=1', color: C.system },
  { label: 'vm.push(local, remote)', desc: 'Upload file to device', color: C.file },
  { label: 'vm.pull(remote, local)', desc: 'Download file from device', color: C.file },
];

function APICatalog({ items }: { items: typeof RJIT_API }) {
  return (
    <Box style={{ gap: 4 }}>
      {items.map(item => (
        <Box key={item.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: item.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: item.color, fontFamily: 'monospace', width: 180, flexShrink: 0 }}>{item.label}</Text>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{item.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Helpers ───────────────────────────────────────────────

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

// ── AutomationStory ─────────────────────────────────────────

export function AutomationStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="cpu" tintColor={C.accent} />
        <S.StoryTitle>
          {'Automation'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'puppeteer'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Script anything — your own UI, Android VMs, X11 apps'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'Two puppeteer paradigms. rjit test scripts the Love2D window — tree queries, input injection, layout audits, screenshots. useAndroidVM scripts Android VMs via ADB — tap, type, launch apps, transfer files. Same idea, different targets.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Tests run inside the Love2D process with direct access to the instance tree. Each await is one frame. Android control runs via ADB over a forwarded TCP port. Both are async, both are composable, both feel like Playwright.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        {/* ═══════════════════════════════════════════════════════
            PART 1: rjit test — Love2D Window Automation
            ═══════════════════════════════════════════════════════ */}

        {/* ── Install: text | code ── */}
        <Band>
          <Half>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="rjit test" color={C.rjitTest} />
              <Tag text="Love2D" color={C.accent} />
              <Tag text="in-process" color={C.query} />
            </S.RowG6>
            <SectionLabel icon="terminal">{'RJIT TEST'}</SectionLabel>
            <S.StoryBody>
              {'Built into the CLI. No install, no browser, no ports. Tests run inside the same Love2D process that renders your app — direct access to the instance tree, layout results, and event system.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Globals test(), page, and expect() are injected automatically. No imports needed in test files.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="bash" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Writing Tests: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={RJIT_TEST_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="code">{'WRITING TESTS'}</SectionLabel>
            <S.StoryBody>
              {'Tests look like Playwright. page.find() queries the instance tree by component type and props. Locators expose click(), type(), key(), text(), and rect(). Matchers assert visibility, text content, and pixel-perfect geometry.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Add testId props to components you want to target. They flow through to the node tree automatically: <Box testId="sidebar">'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Selectors: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="search">{'SELECTORS'}</SectionLabel>
            <S.StoryBody>
              {'page.find(componentName, props?) returns a Locator. Component name matches debugName (Pressable, Box, ScrollView) or raw type (View, Text). Props match any prop value — testId, placeholder, disabled, etc.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SELECTORS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Actions + Matchers: code | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="mouse-pointer">{'ACTIONS'}</SectionLabel>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ACTIONS_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="check-circle">{'MATCHERS'}</SectionLabel>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MATCHERS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Timing: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="clock">{'TIMING MODEL'}</SectionLabel>
            <S.StoryBody>
              {'Each await call equals one Love2D frame — the bridge round-trip naturally provides a frame boundary. click() and type() add an extra wait so React has time to re-render before the next assertion. For animations or async work, use page.wait(N).'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TIMING_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Audits: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={AUDIT_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="shield">{'LAYOUT AUDITS'}</SectionLabel>
            <S.StoryBody>
              {'Four audit types validate your layout automatically. page.audit() catches child overflow, sibling overlap, and off-viewport elements. page.textAudit() catches text-specific issues. page.dividerAudit() finds text overlapping thin separators. page.scrollHeights() reports scroll container diagnostics.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The storybook test suite sweeps all 50+ stories at 6 viewport sizes, running full audits at each breakpoint. Real bugs found: text wrapping at wrong widths, footer overflow, gallery clipping.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Sweep: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="maximize">{'VIEWPORT SWEEPS'}</SectionLabel>
            <S.StoryBody>
              {'Combine resize + audit for responsive testing. Sweep every story at every breakpoint. The test runner resizes the actual Love2D window and waits 3 frames for layout to settle before auditing.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SWEEP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── rjit test API catalog ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 16, gap: 8 }}>
          <SectionLabel icon="list">{'RJIT TEST API'}</SectionLabel>
          <S.StoryCap>{'Every query, action, and audit method:'}</S.StoryCap>
          <APICatalog items={RJIT_API} />
        </Box>

        <Divider />

        {/* ── Callout: in-process ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Tests run inside the Love2D process — no WebSocket, no CDP, no browser. The test shim is eval\'d into QuickJS before your spec. Tree queries go directly through the Lua instance tree. Event injection goes directly through the Love2D event queue. Zero network overhead, frame-perfect timing.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ═══════════════════════════════════════════════════════
            PART 2: useAndroidVM — Android Puppeteer
            ═══════════════════════════════════════════════════════ */}

        {/* ── Android Install: text | code ── */}
        <Band>
          <Half>
            <S.RowG6 style={{ flexWrap: 'wrap' }}>
              <Tag text="useAndroidVM" color={C.android} />
              <Tag text="ADB" color={C.accent} />
              <Tag text="18 commands" color={C.system} />
            </S.RowG6>
            <SectionLabel icon="smartphone">{'ANDROID VM PUPPETEER'}</SectionLabel>
            <S.StoryBody>
              {'Programmatic control of Android VMs via ADB. Boot a VM with <Render source="bliss.iso" />, connect with useAndroidVM(), and script it — tap, type, swipe, launch apps, install APKs, take screenshots, transfer files. Puppeteer for Android.'}
            </S.StoryBody>
            <S.StoryCap>
              {'QEMU VMs spawned by Render automatically get ADB port forwarding. The Lua capability shells out to adb commands. 18 RPC handlers cover input, apps, system, and file transfer.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_INSTALL_CODE} />
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_BASIC_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Android Demo: demo | text ── */}
        <Band>
          <Half>
            <AndroidVMDemo />
          </Half>
          <Half>
            <SectionLabel icon="play">{'LIVE DEMO'}</SectionLabel>
            <S.StoryBody>
              {'Connect to a running Android VM and try the commands live. Start a VM with <Render source="*.iso" /> in the Render story or app-embed example first, then connect here.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Each button fires a real ADB command via bridge RPC. The log shows the command and result in real-time. All 18 commands work the same way — async functions that return promises.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Android Input: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="mouse-pointer">{'INPUT INJECTION'}</SectionLabel>
            <S.StoryBody>
              {'Touch, text, and key injection via ADB. Coordinates are in Android screen space. Key names map to KEYCODE_ constants automatically — pass "HOME" not "KEYCODE_HOME".'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_INPUT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Android Apps: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_APPS_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="grid">{'APP MANAGEMENT'}</SectionLabel>
            <S.StoryBody>
              {'Launch apps by package name (uses monkey for the launcher intent). Install APKs directly from the host filesystem. Uninstall by package name. List all installed packages.'}
            </S.StoryBody>
          </Half>
        </Band>

        <Divider />

        {/* ── Android System: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal">{'SYSTEM & FILES'}</SectionLabel>
            <S.StoryBody>
              {'Run any shell command, read system properties, take screenshots, wait for boot completion, and transfer files between host and device. vm.shell() is the escape hatch — anything adb shell can do, vm.shell() can do.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_SYSTEM_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Automated Flow: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={ANDROID_FLOW_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="zap">{'AUTOMATED FLOWS'}</SectionLabel>
            <S.StoryBody>
              {'Chain commands to build full UI automation flows. Open an app, navigate to a screen, interact with elements, verify results, capture proof. Same pattern as Playwright end-to-end tests but for a live Android VM rendered inside your React app.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Combine with <Render source="*.iso" /> to see the automation happen live. The VM framebuffer streams to your React layout while useAndroidVM scripts it from behind.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Android API catalog ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 16, gap: 8 }}>
          <SectionLabel icon="list">{'ANDROID VM API'}</SectionLabel>
          <S.StoryCap>{'Every async method on the vm object:'}</S.StoryCap>
          <APICatalog items={ANDROID_API} />
        </Box>

        <Divider />

        {/* ── Final callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Same idea, different scale. rjit test puppeteers your own React components at the frame level. useAndroidVM puppeteers an entire Android OS at the ADB level. Both run from the same process, both are async/await, both compose naturally. Script a button click and an Android swipe in the same test file.'}
          </S.StoryBody>
        </CalloutBand>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Dev'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="cpu" />
        <S.StoryBreadcrumbActive>{'Automation'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
