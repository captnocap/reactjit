/**
 * Render — Tabbed multi-component showcase (Layout3).
 *
 * Structure:
 *   Header   — package title + badge + description
 *   Preview  — LIVE DEMO of the active tab's component (flexGrow: 1)
 *   Info row — horizontal strip: description | code example | props
 *   Tab bar  — clickable tabs (one per source type)
 *   Footer   — breadcrumbs with "N of M" counter
 *
 * The TABS array drives the info row, tab bar, and footer.
 * The renderPreview function drives the preview area — one case per tab.
 * Clicking a tab swaps everything: preview, description, usage, and props.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, Render } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// ── Tabs ─────────────────────────────────────────────────
// Each tab represents one source type / usage mode of <Render>.

interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
}

const TABS: TabDef[] = [
  {
    id: 'screen',
    label: 'Screen',
    icon: 'monitor',
    desc: 'Full screen capture via XShm (<1ms) or x11grab. Pass "screen:N" where N is the display index. Sub-millisecond latency on Linux with shared memory fast path.',
    usage: `<Render source="screen:0" />

// Custom FPS and resolution
<Render
  source="screen:0"
  fps={60}
  resolution="1920x1080"
  style={{ flexGrow: 1 }}
/>`,
    props: [
      ['source', '"screen:N"', 'monitor'],
      ['fps', 'number', 'clock'],
      ['resolution', 'string', 'maximize'],
      ['objectFit', 'enum', 'maximize'],
      ['muted', 'boolean', 'volume-x'],
      ['style', 'Style', 'layout'],
    ],
    callbacks: [
      ['onReady', '() => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
      ['onFrame', '(e) => void', 'film'],
    ],
  },
  {
    id: 'webcam',
    label: 'Webcam',
    icon: 'camera',
    desc: 'Webcam feed via v4l2. Pass "cam:N" for device index or a direct path like "/dev/video2". Defaults to 30fps at 1280x720.',
    usage: `<Render source="cam:0" fps={30} />

// Direct v4l2 device path
<Render source="/dev/video2" />`,
    props: [
      ['source', '"cam:N" | path', 'camera'],
      ['fps', 'number', 'clock'],
      ['resolution', 'string', 'maximize'],
      ['objectFit', 'enum', 'maximize'],
      ['muted', 'boolean', 'volume-x'],
    ],
    callbacks: [
      ['onReady', '() => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
    ],
  },
  {
    id: 'hdmi',
    label: 'HDMI',
    icon: 'tv',
    desc: 'HDMI capture card input. Uses the same v4l2 pipeline as webcam but targets capture card devices. Pass "hdmi:N" for device index.',
    usage: `<Render source="hdmi:0" />

// With custom resolution
<Render
  source="hdmi:0"
  resolution="1920x1080"
  fps={60}
/>`,
    props: [
      ['source', '"hdmi:N"', 'tv'],
      ['fps', 'number', 'clock'],
      ['resolution', 'string', 'maximize'],
      ['objectFit', 'enum', 'maximize'],
      ['muted', 'boolean', 'volume-x'],
    ],
    callbacks: [
      ['onReady', '() => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
    ],
  },
  {
    id: 'window',
    label: 'Window',
    icon: 'layout',
    desc: 'Capture a specific window by its title. Uses X11 window matching. Pass "window:Title" where Title is a substring of the target window name.',
    usage: `<Render source="window:Firefox" />

// Capture by partial title match
<Render
  source="window:Visual Studio"
  fps={15}
  style={{ flexGrow: 1 }}
/>`,
    props: [
      ['source', '"window:Title"', 'layout'],
      ['fps', 'number', 'clock'],
      ['resolution', 'string', 'maximize'],
      ['objectFit', 'enum', 'maximize'],
    ],
    callbacks: [
      ['onReady', '() => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
      ['onFrame', '(e) => void', 'film'],
    ],
  },
  {
    id: 'vm',
    label: 'VM',
    icon: 'server',
    desc: 'Boot a QEMU VM from an ISO or disk image. Framebuffer streamed over VNC, input forwarded automatically. KVM auto-detected for near-native speed. Supports .iso, .img, .qcow2, .vmdk, .vdi, .vhd.',
    usage: `// Boot from ISO — one line
<Render source="debian.iso" interactive />

// Disk image with custom resources
<Render
  source="vm:myserver.qcow2"
  vmMemory={4096}
  vmCpus={4}
  interactive
  style={{ flexGrow: 1 }}
/>`,
    props: [
      ['source', 'path | "vm:path"', 'hard-drive'],
      ['vmMemory', 'number (MB)', 'cpu'],
      ['vmCpus', 'number', 'cpu'],
      ['interactive', 'boolean', 'mouse-pointer'],
      ['fps', 'number', 'clock'],
      ['resolution', 'string', 'maximize'],
      ['muted', 'boolean', 'volume-x'],
    ],
    callbacks: [
      ['onReady', '(e: {vmInfo}) => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
    ],
  },
  {
    id: 'display',
    label: 'Display',
    icon: 'airplay',
    desc: 'Create a virtual monitor that other apps can render to. Your ReactJIT window becomes Display :N. When the app closes, the virtual monitor disconnects cleanly. Requires Xephyr or Xvfb.',
    usage: `<Render
  source="display"
  resolution="1920x1080"
  interactive
  onReady={({ displayNumber }) => {
    // DISPLAY=:N firefox
  }}
/>`,
    props: [
      ['source', '"display"', 'airplay'],
      ['resolution', 'string', 'maximize'],
      ['interactive', 'boolean', 'mouse-pointer'],
      ['fps', 'number', 'clock'],
    ],
    callbacks: [
      ['onReady', '(e: {displayNumber}) => void', 'check-circle'],
      ['onError', '(e) => void', 'alert-circle'],
    ],
  },
  {
    id: 'interactive',
    label: 'Interactive',
    icon: 'mouse-pointer',
    desc: 'When interactive is true, mouse clicks and keyboard input are forwarded to the source. VMs use VNC protocol (zero-latency). Screen/window uses xdotool. VMs and displays default to interactive=true.',
    usage: `// Interactive screen control
<Render
  source="screen:0"
  interactive
  objectFit="contain"
  style={{ flexGrow: 1 }}
/>

// VMs default to interactive={true}
<Render source="debian.iso" />`,
    props: [
      ['interactive', 'boolean', 'mouse-pointer'],
      ['objectFit', 'enum', 'maximize'],
      ['source', 'string', 'monitor'],
      ['style', 'Style', 'layout'],
    ],
    callbacks: [
      ['onClick', '(e: LoveEvent) => void', 'mouse-pointer'],
      ['onReady', '() => void', 'check-circle'],
    ],
  },
];

// ── Preview renderer ─────────────────────────────────────

function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  switch (tab.id) {
    case 'screen':
      return <Render source="screen:0" style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'webcam':
      return <Render source="cam:0" fps={30} style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'hdmi':
      return <Render source="hdmi:0" style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'window':
      return <Render source="window:Firefox" fps={15} style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'vm':
      return <Render source="debian.iso" interactive style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'display':
      return <Render source="display" resolution="1920x1080" interactive style={{ flexGrow: 1 }} objectFit="contain" />;
    case 'interactive':
      return <Render source="screen:0" interactive objectFit="contain" style={{ flexGrow: 1 }} />;
    default:
      return null;
  }
}

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── RenderStory ─────────────────────────────────────────

export function RenderStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

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
        <Image src="monitor" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Render'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Capture screens, run VMs, and create virtual displays — like OBS + QEMU as a React component'}
        </Text>
      </Box>

      {/* ── Preview area — LIVE DEMO of the active tab ── */}
      <Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
        {renderPreview(tab, c)}
      </Box>

      {/* ── Info row — description | code | props ── */}
      <Box style={{
        height: 120,
        flexShrink: 0,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        overflow: 'hidden',
      }}>

        {/* ── Description ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>
            {tab.label}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {tab.desc}
          </Text>
        </Box>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'USAGE'}
          </Text>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </Box>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'PROPS'}
          </Text>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
              </Box>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
                {'CALLBACKS'}
              </Text>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
                  <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                    <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                    <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
          <Box style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 8,
          }}>
            {TABS.map(comp => {
              const active = comp.id === activeId;
              return (
                <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                  <Box style={{
                    width: 50,
                    height: 50,
                    backgroundColor: active ? C.selected : c.surface,
                    borderRadius: 6,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? C.accent : c.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active ? C.accent : c.muted} />
                    <Text style={{ color: active ? c.text : c.muted, fontSize: 7 }}>
                      {comp.label}
                    </Text>
                  </Box>
                </Pressable>
              );
            })}
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
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="monitor" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Render'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </Box>
  );
}
