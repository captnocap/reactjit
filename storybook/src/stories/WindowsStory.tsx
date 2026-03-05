/**
 * Windows — Multi-window IPC, notifications, and crash recovery.
 *
 * Three systems, one story:
 * - <Window> component: child OS windows sharing one React tree
 * - <Notification> component: OS notification windows with accent colors
 * - Crash screens: three-layer error recovery (in-process BSOD, love.errorhandler, external reporter)
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Window, Notification } from '../../../packages/core/src';
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
  // BSOD colors (match lua/bsod.lua + lua/errors.lua)
  bsodBg: 'rgb(15, 10, 20)',
  bsodAccent: 'rgb(217, 51, 64)',
  bsodText: 'rgb(235, 230, 224)',
  bsodDim: 'rgb(140, 133, 128)',
  bsodTrace: 'rgb(191, 140, 128)',
  bsodTrail: 'rgb(128, 153, 191)',
  bsodGreen: 'rgb(77, 204, 102)',
  bsodBar: 'rgb(20, 15, 26)',
  // Crash report colors (match lua/crashreport/main.lua)
  crBg: 'rgb(20, 20, 26)',
  crRed: 'rgb(255, 77, 77)',
  crDim: 'rgb(128, 128, 153)',
  crText: 'rgb(230, 230, 230)',
  // Normal error overlay (match lua/errors.lua)
  overlayBg: 'rgba(219, 38, 38, 0.92)',
  overlayText: 'rgb(254, 242, 242)',
  overlayDim: 'rgba(252, 165, 165, 0.7)',
};

// -- Static code blocks (hoisted) -------------------------------------

const INSTALL_CODE = `import { Window, Notification } from '@reactjit/core'`;

const WINDOW_CODE = `<Window
  title="Inspector"
  width={400}
  height={300}
  onClose={() => setOpen(false)}
  onFocus={() => log('focused')}
>
  <MyPanel />   {/* same React tree */}
</Window>`;

const NOTIFICATION_CODE = `// Text-only (fast path — no React, no bridge)
<Notification
  title="Build Complete"
  body="All tests passed"
  accent="#a6e3a1"
  onDismiss={() => setShow(false)}
/>

// Rich content (full React tree in notification window)
<Notification duration={8} accent="#89b4fa">
  <Box style={{ padding: 12, gap: 6 }}>
    <Text style={{ fontWeight: 'bold' }}>Custom UI</Text>
    <Image src="chart.png" />
  </Box>
</Notification>`;

const WINDOW_PROPS_CODE = `<Window
  title="Panel"        -- OS window title
  width={400}          -- initial width
  height={300}         -- initial height
  x={100}              -- initial x position
  y={100}              -- initial y position
  onClose={() => {}}   -- window close button
  onFocus={() => {}}   -- window gained focus
  onBlur={() => {}}    -- window lost focus
>`;

const CRASH_LAYERS_CODE = `-- Layer 1: crashRecoveryMode (in-process)
--   pcall wraps update()/draw()/safeCall()
--   errors.drawBSOD() renders over the app
--   HMR polling continues -- save code to reload

-- Layer 2: love.errorhandler (last resort)
--   replaces Love2D blue screen
--   own run loop, own event pump
--   HMR polling for auto-reload

-- Layer 3: crashreport subprocess
--   separate Love2D process
--   survives parent death
--   auto-closes when parent is gone`;

const RECOVERY_CODE = `-- In crash recovery mode:
-- update() only polls HMR (no app logic)
-- draw() renders errors.drawBSOD()
-- safeCall() routes input to crash screen
-- Keyboard: R=reboot, Esc=quit, Ctrl+C=copy
-- Mouse: clickable Reboot/Copy/Quit buttons
-- Auto-reload: save your code, HMR picks it up`;

// -- Shared button helper ---------------------------------------------

function Btn({ label, onPress, color, small }: { label: string; onPress: () => void; color: string; small?: boolean }) {
  return (
    <Pressable onPress={onPress}>
      <Box style={{
        backgroundColor: color,
        borderRadius: 4,
        paddingLeft: small ? 8 : 12,
        paddingRight: small ? 8 : 12,
        paddingTop: small ? 3 : 5,
        paddingBottom: small ? 3 : 5,
      }}>
        <Text style={{ fontSize: small ? 9 : 10, color: '#000', fontWeight: 'normal' }}>{label}</Text>
      </Box>
    </Pressable>
  );
}

// -- Window Demo (controls only — Window nodes rendered at story root) --

function WindowDemoControls({ showPanel, showLog, counter, events, onTogglePanel, onToggleLog, onIncrement, onDecrement }: {
  showPanel: boolean; showLog: boolean; counter: number; events: string[];
  onTogglePanel: () => void; onToggleLog: () => void; onIncrement: () => void; onDecrement: () => void;
}) {
  const c = useThemeColors();
  return (
    <>
      <Text style={{ fontSize: 9, color: c.muted }}>{'Click to spawn real OS windows. State syncs across all of them.'}</Text>

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Btn
          label={showPanel ? 'Close Panel' : 'Open Panel Window'}
          onPress={onTogglePanel}
          color={showPanel ? C.red : C.green}
        />
        <Btn
          label={showLog ? 'Close Log' : 'Open Log Window'}
          onPress={onToggleLog}
          color={showLog ? C.red : C.blue}
        />
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: c.text }}>{'Shared counter:'}</Text>
        <Btn label="-" onPress={onDecrement} color={C.peach} small />
        <Text style={{ fontSize: 12, color: C.accent, fontWeight: 'bold' }}>{String(counter)}</Text>
        <Btn label="+" onPress={onIncrement} color={C.green} small />
      </Box>

      {events.length > 0 && (
        <Box style={{ backgroundColor: c.bg, borderRadius: 4, padding: 4, gap: 1 }}>
          {events.map((e, i) => (
            <Text key={i} style={{ fontSize: 8, color: c.muted }}>{e}</Text>
          ))}
        </Box>
      )}
    </>
  );
}

// -- Notification Demo (controls only — Notification nodes at root) ----

const NOTIF_PRESETS = [
  { title: 'Build Complete', body: 'All 47 tests passed.', accent: '#a6e3a1', pos: 'top-right' as const },
  { title: 'Connection Lost', body: 'Retrying in 3s...', accent: '#f38ba8', pos: 'top-right' as const },
  { title: 'New Message', body: 'Hey, check this out!', accent: '#89b4fa', pos: 'top-left' as const },
  { title: 'Deploy Started', body: 'Pushing to production...', accent: '#f9e2af', pos: 'bottom-right' as const },
];

function NotificationDemoControls({ onFire, onFireAll, onFireRich }: { onFire: (idx: number) => void; onFireAll: () => void; onFireRich: () => void }) {
  const c = useThemeColors();
  return (
    <>
      <Text style={{ fontSize: 9, color: c.muted }}>{'Each button spawns a real OS notification window. They stack and auto-dismiss.'}</Text>

      <Box style={{ gap: 4 }}>
        {NOTIF_PRESETS.map((n, i) => (
          <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Btn label={'Fire'} onPress={() => onFire(i)} color={n.accent} small />
            <Text style={{ fontSize: 9, color: c.text }}>{n.title}</Text>
            <Text style={{ fontSize: 8, color: c.muted }}>{n.body}</Text>
          </Box>
        ))}
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Btn label="Fire All at Once" onPress={onFireAll} color={C.accent} />
        <Btn label="Fire Rich Notification" onPress={onFireRich} color={C.mauve} />
      </Box>

      <Text style={{ fontSize: 8, color: c.muted }}>
        {'Rich notifications render a full React tree in the notification window \u2014 not just text.'}
      </Text>
    </>
  );
}

// -- BSOD Preview (scaled crash screen mockup) ------------------------

function BSODPreview() {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.bsodBg,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <Box style={{ height: 3, backgroundColor: C.bsodAccent }} />
      <Box style={{ padding: 10, gap: 4 }}>
        <Text style={{ fontSize: 11, color: C.bsodAccent, fontWeight: 'bold' }}>{'ReactJIT crashed'}</Text>
        <Text style={{ fontSize: 7, color: C.bsodDim }}>{'19:26:14  |  painter.paint'}</Text>
        <Text style={{ fontSize: 8, color: C.bsodText }}>{'lua: attempt to index nil value (local \'node\')'}</Text>
        <Box style={{ height: 1, backgroundColor: 'rgba(217, 51, 64, 0.3)', marginTop: 2, marginBottom: 2 }} />
        <Text style={{ fontSize: 6, color: C.bsodDim }}>{'TRACEBACK'}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrace }}>{'  lua/painter.lua:142: in function \'paintNode\''}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrace }}>{'  lua/painter.lua:89: in function \'paint\''}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrace }}>{'  lua/init.lua:3372: in function \'draw\''}</Text>
        <Box style={{ height: 1, backgroundColor: 'rgba(217, 51, 64, 0.3)', marginTop: 2, marginBottom: 2 }} />
        <Text style={{ fontSize: 6, color: C.bsodDim }}>{'EVENT TRAIL (3 events)'}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrail }}>{'  0.016s  keypressed  key=s ctrl=true'}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrail }}>{'  0.008s  textinput   s'}</Text>
        <Text style={{ fontSize: 6, color: C.bsodTrail }}>{'  0.000s  mousemoved  412, 308'}</Text>
      </Box>
      <Box style={{
        backgroundColor: C.bsodBar,
        borderTopWidth: 1,
        borderColor: 'rgba(217, 51, 64, 0.3)',
        paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 7, color: C.bsodGreen }}>{'| Watching for code changes...'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <Box style={{ backgroundColor: C.bsodAccent, borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 6, color: C.bsodText }}>{'Reboot'}</Text>
          </Box>
          <Box style={{ backgroundColor: 'rgba(64, 77, 102, 0.6)', borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 6, color: C.bsodTrail }}>{'Copy'}</Text>
          </Box>
          <Box style={{ backgroundColor: 'rgba(77, 71, 89, 0.6)', borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 6, color: C.bsodDim }}>{'Quit'}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// -- Error Overlay Preview (non-fatal overlay) -------------------------

function ErrorOverlayPreview() {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', borderRadius: 6, overflow: 'hidden' }}>
      <Box style={{ backgroundColor: c.bgElevated, padding: 8, gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Box style={{ width: 30, height: 6, backgroundColor: c.border, borderRadius: 2 }} />
          <Box style={{ width: 50, height: 6, backgroundColor: c.border, borderRadius: 2 }} />
          <Box style={{ flexGrow: 1 }} />
          <Box style={{ width: 20, height: 6, backgroundColor: c.border, borderRadius: 2 }} />
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Box style={{ width: 40, height: 20, backgroundColor: c.surface, borderRadius: 3 }} />
          <Box style={{ flexGrow: 1, height: 20, backgroundColor: c.surface, borderRadius: 3 }} />
        </Box>
      </Box>
      <Box style={{ backgroundColor: C.overlayBg, padding: 8, gap: 3 }}>
        <Text style={{ fontSize: 9, color: C.overlayText, fontWeight: 'bold' }}>{'ERROR  --  ReactJIT.update'}</Text>
        <Text style={{ fontSize: 7, color: C.overlayText }}>{'js: Cannot read property \'map\' of undefined'}</Text>
        <Text style={{ fontSize: 6, color: 'rgba(252, 165, 165, 1)' }}>{'  at App.tsx:42'}</Text>
        <Text style={{ fontSize: 6, color: 'rgba(252, 165, 165, 1)' }}>{'  at renderList (utils.ts:18)'}</Text>
        <Text style={{ fontSize: 6, color: C.overlayDim, marginTop: 4 }}>{'click to dismiss'}</Text>
      </Box>
    </Box>
  );
}

// -- Crash Report Preview (external subprocess) ------------------------

function CrashReportPreview() {
  return (
    <Box style={{ width: '100%', backgroundColor: C.crBg, borderRadius: 6, overflow: 'hidden' }}>
      <Box style={{ padding: 10, gap: 4 }}>
        <Text style={{ fontSize: 11, color: C.crRed, fontWeight: 'bold' }}>{'Process Crashed'}</Text>
        <Text style={{ fontSize: 7, color: C.crDim }}>{'2026-03-04 19:26:14'}</Text>
        <Text style={{ fontSize: 7, color: 'rgb(153, 153, 179)' }}>{'Context: ReactJIT.update (budget exceeded)'}</Text>
        <Box style={{ marginTop: 2 }}>
          <Text style={{ fontSize: 7, color: 'rgb(255, 217, 217)' }}>{'[BUDGET] layout pass exceeded 10000 node limit'}</Text>
        </Box>
        <Box style={{ height: 1, backgroundColor: 'rgb(64, 64, 77)', marginTop: 4, marginBottom: 4 }} />
        <Text style={{ fontSize: 7, color: 'rgb(153, 153, 179)' }}>{'Subsystem Snapshot'}</Text>
        <Box style={{ gap: 1, paddingLeft: 6 }}>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 6, color: C.crDim, width: 70 }}>{'Lua heap'}</Text>
            <Text style={{ fontSize: 6, color: C.crText }}>{'142.3 MB'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 6, color: C.crDim, width: 70 }}>{'Tree nodes'}</Text>
            <Text style={{ fontSize: 6, color: C.crText }}>{'12847'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 6, color: C.crDim, width: 70 }}>{'Draw calls'}</Text>
            <Text style={{ fontSize: 6, color: C.crText }}>{'3201'}</Text>
          </Box>
        </Box>
      </Box>
      <Box style={{
        backgroundColor: 'rgb(31, 31, 38)',
        borderTopWidth: 1, borderColor: 'rgba(217, 51, 64, 0.3)',
        paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 7, color: C.crDim }}>{'Esc close    Ctrl+C copy    R reboot'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Box style={{ backgroundColor: 'rgb(51, 115, 230)', borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ fontSize: 6, color: '#fff' }}>{'Reboot'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// -- Crash Layer Catalog -----------------------------------------------

const CRASH_LAYERS = [
  { label: 'Layer 1: In-process BSOD', desc: 'pcall catches errors in update()/draw()/safeCall(). Renders errors.drawBSOD() over the app. HMR continues.', color: C.yellow },
  { label: 'Layer 2: love.errorhandler', desc: 'Last resort. Own run loop, own event pump. Replaces Love2D blue screen. Still watches for code changes.', color: C.peach },
  { label: 'Layer 3: Crash report process', desc: 'Separate Love2D process. Shows diagnostics, /proc data, event trail. Auto-closes when parent dies.', color: C.red },
  { label: 'Error overlay (non-fatal)', desc: 'Bottom 40% panel over the running app. Click to dismiss. App keeps running underneath.', color: C.blue },
  { label: 'Memory watchdog', desc: 'External bash process monitors /proc RSS. Kills runaway allocations within 200ms. Spawns crash reporter.', color: C.mauve },
];

function CrashLayerCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {CRASH_LAYERS.map(l => (
        <Box key={l.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: l.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 160, flexShrink: 0 }}>{l.label}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{l.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// -- WindowsStory ------------------------------------------------------

export function WindowsStory() {
  const c = useThemeColors();

  // -- Window demo state (lifted so <Window> renders at root) --
  const [showPanel, setShowPanel] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [counter, setCounter] = useState(0);
  const [winEvents, setWinEvents] = useState<string[]>([]);

  const logWin = useCallback((msg: string) => {
    setWinEvents(prev => [...prev.slice(-6), msg]);
  }, []);

  // -- Notification demo state (lifted so <Notification> renders at root) --
  const [activeNotifs, setActiveNotifs] = useState<{ id: number; preset: number }[]>([]);
  const [richNotifs, setRichNotifs] = useState<{ id: number }[]>([]);
  const [nextNotifId, setNextNotifId] = useState(1);

  const fireNotif = useCallback((presetIdx: number) => {
    setActiveNotifs(prev => [...prev, { id: nextNotifId, preset: presetIdx }]);
    setNextNotifId(n => n + 1);
  }, [nextNotifId]);

  const fireRichNotif = useCallback(() => {
    setRichNotifs(prev => [...prev, { id: nextNotifId }]);
    setNextNotifId(n => n + 1);
  }, [nextNotifId]);

  const fireAllNotifs = useCallback(() => {
    const base = nextNotifId;
    setActiveNotifs(prev => [
      ...prev,
      ...NOTIF_PRESETS.map((_, i) => ({ id: base + i, preset: i })),
    ]);
    setNextNotifId(n => n + NOTIF_PRESETS.length);
  }, [nextNotifId]);

  const dismissNotif = useCallback((notifId: number) => {
    setActiveNotifs(prev => prev.filter(n => n.id !== notifId));
  }, []);

  const dismissRichNotif = useCallback((notifId: number) => {
    setRichNotifs(prev => prev.filter(n => n.id !== notifId));
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* Header */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bgElevated, borderBottomWidth: 1, borderColor: c.border,
        paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14,
      }}>
        <Image src="layout" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>{'Windows'}</Text>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>{'More than 11 of them'}</Text>
      </Box>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* Hero */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'One React tree. Many OS windows. Three layers of crash recovery.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'<Window> spawns a child Love2D process connected over TCP. State flows via props \u2014 click in window 1, window 2 reacts. <Notification> pops OS-level notification windows with accent colors and auto-dismiss. When things go wrong, three crash screens stack from gentle overlay to nuclear subprocess, each one watching for your code fix.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* Band 1: MULTI-WINDOW — live demo | code */}
        <Band>
          <Half>
            <SectionLabel icon="layout" accentColor={C.accent}>{'MULTI-WINDOW'}</SectionLabel>
            <WindowDemoControls
              showPanel={showPanel}
              showLog={showLog}
              counter={counter}
              events={winEvents}
              onTogglePanel={() => { setShowPanel(p => !p); logWin(showPanel ? 'Panel closed' : 'Panel opened'); }}
              onToggleLog={() => { setShowLog(p => !p); logWin(showLog ? 'Log closed' : 'Log opened'); }}
              onIncrement={() => setCounter(n => n + 1)}
              onDecrement={() => setCounter(n => n - 1)}
            />
          </Half>
          <Half>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Wrap any subtree in <Window> and it renders in a separate OS window. The component stays in the same React tree \u2014 props, state, and callbacks flow naturally. No IPC boilerplate.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={WINDOW_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Band 2: WINDOW PROPS — code | text */}
        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={9} code={WINDOW_PROPS_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'WINDOW PROPS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Position, size, title, and lifecycle callbacks. onClose fires when the user clicks the OS close button \u2014 you control whether the window actually unmounts.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Focus/blur events let you dim inactive panels or pause expensive rendering. The window manager tracks all child processes and cleans up on quit.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 3: NOTIFICATIONS — live demo | code */}
        <Band>
          <Half>
            <SectionLabel icon="bell" accentColor={C.teal}>{'NOTIFICATIONS'}</SectionLabel>
            <NotificationDemoControls
              onFire={fireNotif}
              onFireAll={fireAllNotifs}
              onFireRich={fireRichNotif}
            />
          </Half>
          <Half>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'<Notification> spawns a real OS notification window \u2014 not a DOM overlay, not a toast inside the app. It is a separate window with its own accent color, title, body, and auto-dismiss timer.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={NOTIFICATION_CODE} />
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Stack multiple notifications and they arrange themselves. Each one is a real Love2D child process, same as <Window>.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Callout: never frozen */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'The crash screen must never freeze. All three layers cache fonts on init (not per-frame), use pcall for content rendering, and keep the bottom control bar outside the pcall so buttons always render even if the error display itself errors.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* Band 4: ERROR OVERLAY — preview | text */}
        <Band>
          <Half>
            <ErrorOverlayPreview />
          </Half>
          <Half>
            <SectionLabel icon="alert-triangle" accentColor={C.yellow}>{'ERROR OVERLAY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Non-fatal errors show as a red overlay on the bottom 40% of the screen. The app keeps running underneath. Click to dismiss, or cycle through multiple errors.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Cascade protection: if multiple errors fire in sequence, the overlay pins to the first one (the root cause) and ignores subsequent noise from corrupted state.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 5: IN-PROCESS BSOD — text + code | preview */}
        <Band>
          <Half>
            <SectionLabel icon="shield" accentColor={C.peach}>{'IN-PROCESS BSOD'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'When an error escapes pcall in update() or draw(), the app enters crash recovery mode. The full-screen BSOD replaces the app with traceback, event trail, and an inline code editor.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'HMR keeps polling. Save your code and the app reloads automatically. Reboot, Copy, and Quit buttons are always clickable \u2014 the bottom bar renders outside the content pcall.'}
            </Text>
            <CodeBlock language="lua" fontSize={8} code={RECOVERY_CODE} />
          </Half>
          <Half>
            <BSODPreview />
          </Half>
        </Band>

        <Divider />

        {/* Band 6: CRASH REPORTER — preview | text */}
        <Band>
          <Half>
            <CrashReportPreview />
          </Half>
          <Half>
            <SectionLabel icon="monitor" accentColor={C.red}>{'CRASH REPORTER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'For budget errors and runaway allocations, a separate Love2D process spawns to display the full crash report. It survives the parent dying \u2014 but auto-closes after 30 seconds once the parent process is gone.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Shows subsystem snapshot (node count, memory, draw calls), /proc diagnostics, crisis analysis, event trail, and dmesg output. Reboot button re-launches the original app.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* Band 7: CRASH ARCHITECTURE — text | code */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'CRASH ARCHITECTURE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three layers of defense, each catching what the previous one missed. Layer 1 handles most crashes in-process with HMR recovery. Layer 2 catches errors that escape the pcall wrappers entirely. Layer 3 survives even if the Love2D process is killed.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={CRASH_LAYERS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* Full-width: crash layer catalog */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 8 }}>
          <SectionLabel icon="list" accentColor={C.accent}>{'RECOVERY CATALOG'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Every crash recovery mechanism in the stack:'}</Text>
          <CrashLayerCatalog />
        </Box>

        <Divider />

        {/* Callout: font caching */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'love.graphics.newFont() allocates GPU memory. Calling it every frame in a crash screen will eventually exhaust the GPU and freeze \u2014 the one thing a crash screen must never do. All three layers cache fonts once on init.'}
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
        <Image src="layout" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Windows'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

      {/* Window/Notification nodes — zero-size container so they don't eat layout */}
      <Box style={{ width: 0, height: 0, overflow: 'hidden' }}>
      {showPanel && (
        <Window
          title="Synced Panel"
          width={280}
          height={220}
          onClose={() => { setShowPanel(false); logWin('Panel closed via X'); }}
          onFocus={() => logWin('Panel focused')}
          onBlur={() => logWin('Panel blurred')}
        >
          <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 14, color: c.text, fontWeight: 'normal' }}>{'Synced Panel'}</Text>
            <Text style={{ fontSize: 10, color: c.muted }}>{'This counter is shared with the main window:'}</Text>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Btn label="-" onPress={() => setCounter(n => n - 1)} color={C.peach} small />
              <Text style={{ fontSize: 18, color: C.accent, fontWeight: 'bold' }}>{String(counter)}</Text>
              <Btn label="+" onPress={() => setCounter(n => n + 1)} color={C.green} small />
            </Box>
            <Text style={{ fontSize: 9, color: c.muted }}>{'Click +/- here or in the main window. Both update.'}</Text>
          </Box>
        </Window>
      )}

      {showLog && (
        <Window
          title="Event Log"
          width={320}
          height={200}
          onClose={() => { setShowLog(false); logWin('Log closed via X'); }}
        >
          <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg, padding: 16, gap: 6 }}>
            <Text style={{ fontSize: 14, color: c.text, fontWeight: 'normal' }}>{'Live Events'}</Text>
            <Text style={{ fontSize: 9, color: c.muted }}>{'Every action across all windows shows up here in real time.'}</Text>
            <Box style={{ flexGrow: 1, backgroundColor: c.surface, borderRadius: 4, padding: 6, gap: 2 }}>
              {winEvents.length === 0 && <Text style={{ fontSize: 9, color: c.muted }}>{'No events yet'}</Text>}
              {winEvents.map((e, i) => (
                <Text key={i} style={{ fontSize: 9, color: c.text }}>{e}</Text>
              ))}
            </Box>
          </Box>
        </Window>
      )}

      {activeNotifs.map(notif => {
        const n = NOTIF_PRESETS[notif.preset];
        return (
          <Notification
            key={notif.id}
            title={n.title}
            body={n.body}
            accent={n.accent}
            position={n.pos}
            duration={5}
            onDismiss={() => dismissNotif(notif.id)}
          />
        );
      })}

      {richNotifs.map(notif => (
        <Notification
          key={`rich-${notif.id}`}
          duration={8}
          accent="#cba6f7"
          position="top-right"
          width={320}
          height={180}
          onDismiss={() => dismissRichNotif(notif.id)}
        >
          <Box style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e', padding: 16, gap: 8 }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Box style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.mauve }} />
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>{'Rich Notification'}</Text>
                <Text style={{ fontSize: 9, color: '#888' }}>{'Full React tree rendering'}</Text>
              </Box>
            </Box>
            <Box style={{ height: 1, backgroundColor: 'rgba(203, 166, 247, 0.2)' }} />
            <Text style={{ fontSize: 10, color: '#ccc' }}>
              {'This notification renders a full React subtree via IPC \u2014 not just text. Any component works here.'}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
              <Text style={{ fontSize: 9, color: C.green }}>{'Live from child process'}</Text>
            </Box>
          </Box>
        </Notification>
      ))}
      </Box>

    </Box>
  );
}
