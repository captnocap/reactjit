/**
 * Render — Package documentation page (Layout2 zigzag narrative).
 *
 * Live demos for screen capture, webcam, HDMI, window capture, VMs,
 * virtual displays, and interactive mode. FFmpeg + XShm + QEMU via Lua.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Render, Libretro, Input, Window, useLocalStore, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(139, 92, 246, 0.06)',
  calloutBorder: 'rgba(139, 92, 246, 0.30)',
  screen: '#4fc3f7',
  webcam: '#66bb6a',
  hdmi: '#ffa726',
  window: '#ab47bc',
  vm: '#ef5350',
  display: '#26c6da',
  interactive: '#ec4899',
  libretro: '#f9a825',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { Render } from '@reactjit/core'`;

const SCREEN_CODE = `<Render source="screen:0" />

// Custom FPS and resolution
<Render
  source="screen:0"
  fps={60}
  resolution="1920x1080"
  style={{ flexGrow: 1 }}
/>`;

const WEBCAM_CODE = `<Render source="cam:0" fps={30} />

// Direct v4l2 device path
<Render source="/dev/video2" />`;

const HDMI_CODE = `<Render source="hdmi:0" />

// With custom resolution
<Render
  source="hdmi:0"
  resolution="1920x1080"
  fps={60}
/>`;

const WINDOW_CODE = `<Render source="window:Firefox" />

// Capture by partial title match
<Render
  source="window:Visual Studio"
  fps={15}
  style={{ flexGrow: 1 }}
/>`;

const VM_CODE = `// Boot from ISO — one line
<Render source="debian.iso" interactive />

// Disk image with custom resources
<Render
  source="vm:myserver.qcow2"
  vmMemory={4096}
  vmCpus={4}
  interactive
  style={{ flexGrow: 1 }}
/>`;

const DISPLAY_CODE = `<Render
  source="display"
  resolution="1920x1080"
  interactive
  onReady={({ displayNumber }) => {
    // DISPLAY=:N firefox
  }}
/>`;

const INTERACTIVE_CODE = `// Interactive screen control
<Render
  source="screen:0"
  interactive
  objectFit="contain"
  style={{ flexGrow: 1 }}
/>

// VMs default to interactive={true}
<Render source="debian.iso" />`;

const LIBRETRO_CODE = `// Any libretro-compatible core
<Libretro
  core="/usr/lib/libretro/snes9x_libretro.so"
  rom="zelda.sfc"
  running
  volume={0.8}
  style={{ flexGrow: 1 }}
/>

// GBA with speed control
<Libretro
  core="cores/mgba_libretro.so"
  rom="pokemon.gba"
  speed={2}
  onLoaded={(e) => console.log(e.coreName)}
/>`;

const LIBRETRO_CONTROLS_CODE = `// Keyboard: Arrows=D-Pad, Z=A, X=B,
//   A=X, S=Y, Enter=Start, RShift=Select
//   Q/W=L/R, F5=Save, F9=Load, F6=Reset
// Gamepads: mapped automatically via Love2D`;

const EVENTS_CODE = `<Render
  source="screen:0"
  onReady={() => console.log('Capture started')}
  onError={(e) => console.log('Error:', e.message)}
  onFrame={(e) => console.log('Frame', e.frameNumber)}
/>`;

// ── Hoisted data arrays ─────────────────────────────────

const SOURCES = [
  { label: 'screen:N', desc: 'Full screen capture via XShm (<1ms) or x11grab', color: C.screen },
  { label: 'cam:N', desc: 'Webcam feed via v4l2 (default 30fps @ 1280x720)', color: C.webcam },
  { label: 'hdmi:N', desc: 'HDMI capture card input via v4l2 pipeline', color: C.hdmi },
  { label: 'window:Title', desc: 'Capture specific window by title substring (X11)', color: C.window },
  { label: '/dev/videoN', desc: 'Direct v4l2 device path (webcam or capture card)', color: C.webcam },
  { label: 'display', desc: 'Virtual monitor — other apps render to your ReactJIT window', color: C.display },
  { label: 'file.iso', desc: 'Boot a QEMU VM from ISO (KVM auto-detected)', color: C.vm },
  { label: 'vm:path.qcow2', desc: 'Boot a VM from disk image (.qcow2, .vmdk, .vdi, .vhd)', color: C.vm },
  { label: '<Libretro>', desc: 'Run any libretro emulator core — NES, SNES, GBA, Genesis, N64, PS1, and more', color: C.libretro },
];

const PROPS = [
  { label: 'source', desc: 'Source identifier (see catalog above)', color: C.accent },
  { label: 'fps', desc: 'Capture framerate (default: 30)', color: C.screen },
  { label: 'resolution', desc: 'Capture resolution e.g. "1920x1080" (default: "1280x720")', color: C.screen },
  { label: 'interactive', desc: 'Enable mouse/keyboard input forwarding (default: false for capture, true for VM/display)', color: C.interactive },
  { label: 'muted', desc: 'Suppress audio from source (default: true)', color: C.hdmi },
  { label: 'objectFit', desc: '"fill" | "contain" | "cover" (default: "contain")', color: C.window },
  { label: 'vmMemory', desc: 'VM RAM in MB (default: 2048) — VM sources only', color: C.vm },
  { label: 'vmCpus', desc: 'VM CPU count (default: 2) — VM sources only', color: C.vm },
  { label: 'onReady', desc: 'Fires when capture starts producing frames', color: C.webcam },
  { label: 'onError', desc: 'Fires if capture fails ({ message: string })', color: C.vm },
  { label: 'onFrame', desc: 'Fires on each new frame ({ frameNumber })', color: C.display },
];

// ── Live Demo: Screen Capture ────────────────────────────

function ScreenCaptureDemo() {
  const c = useThemeColors();
  const [active, setActive] = useState(false);

  return (
    <Box style={{ gap: 8, alignItems: 'center', width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag text="screen:0" color={C.screen} />
        <Tag text="XShm" color={C.accent} />
      </Box>

      {active ? (
        <Box style={{ width: 280, height: 180, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.screen + '44' }}>
          <Render source="screen:0" fps={15} objectFit="contain" style={{ flexGrow: 1 }} />
        </Box>
      ) : (
        <Pressable onPress={() => setActive(true)}>
          <Box style={{
            width: 280, height: 180, borderRadius: 6, overflow: 'hidden',
            borderWidth: 1, borderColor: C.screen + '44',
            backgroundColor: c.surface,
            justifyContent: 'center', alignItems: 'center', gap: 8,
          }}>
            <Image src="monitor" style={{ width: 24, height: 24 }} tintColor={C.screen} />
            <Text style={{ fontSize: 11, color: C.screen }}>{'Start Screen Capture'}</Text>
            <S.StoryTiny>{'Captures this display via XShm'}</S.StoryTiny>
          </Box>
        </Pressable>
      )}

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? C.webcam : c.textDim }} />
        <Text style={{ fontSize: 9, color: active ? C.webcam : c.textDim }}>
          {active ? 'Capturing at 15 fps' : 'Tap to start capture'}
        </Text>
      </Box>
    </Box>
  );
}

// ── Live Demo: Window Capture ────────────────────────────

function WindowCaptureDemo() {
  const c = useThemeColors();
  const [target, setTarget] = useState('');
  const [active, setActive] = useState(false);

  const titles = ['Firefox', 'Code', 'Terminal', 'Chromium'];

  const startCapture = useCallback((title: string) => {
    setTarget(title);
    setActive(true);
  }, []);

  return (
    <Box style={{ gap: 8, alignItems: 'center', width: '100%' }}>
      <Tag text="window:Title" color={C.window} />

      {active ? (
        <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
          <Box style={{ width: 280, height: 160, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.window + '44' }}>
            <Render source={`window:${target}`} fps={10} objectFit="contain" style={{ flexGrow: 1 }} />
          </Box>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.window }} />
            <Text style={{ fontSize: 9, color: C.window }}>{`Capturing window: ${target}`}</Text>
          </Box>
          <Pressable onPress={() => setActive(false)}>
            <Box style={{ backgroundColor: C.vm + '33', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
              <Text style={{ fontSize: 9, color: C.vm }}>{'Stop'}</Text>
            </Box>
          </Pressable>
        </Box>
      ) : (
        <Box style={{ gap: 6, width: '100%' }}>
          <S.StoryCap>{'Pick a window to capture:'}</S.StoryCap>
          <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {titles.map(t => (
              <Pressable key={t} onPress={() => startCapture(t)}>
                <Box style={{ backgroundColor: C.window + '22', paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: C.window }}>{t}</Text>
                </Box>
              </Pressable>
            ))}
          </Box>
          <S.StoryTiny>{'Matches by partial window title via X11'}</S.StoryTiny>
        </Box>
      )}
    </Box>
  );
}

// ── Live Demo: Libretro ──────────────────────────────────

function LibretroDemo() {
  const c = useThemeColors();
  const [corePath, setCorePath] = useLocalStore<string>('libretro:core', '');
  const [romPath, setRomPath] = useLocalStore<string>('libretro:rom', '');
  const [status, setStatus] = useState('Set core + ROM paths');
  const [active, setActive] = useState(false);
  const [running, setRunning] = useState(true);

  const hasInputs = corePath.length > 0 && romPath.length > 0;

  const onLoaded = useCallback((e: any) => {
    setStatus(`${e.coreName} v${e.coreVersion}`);
    setActive(true);
  }, []);

  const onError = useCallback((e: any) => {
    setStatus(`Error: ${e.message}`);
    setActive(false);
  }, []);

  return (
    <Box style={{ gap: 8, alignItems: 'center', width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag text="Libretro" color={C.libretro} />
        <Tag text="FFI" color={C.accent} />
      </Box>

      {/* Core + ROM inputs */}
      <Box style={{ gap: 4, width: '100%' }}>
        <S.StoryTiny>{'Core .so path'}</S.StoryTiny>
        <Input
          value={corePath}
          placeholder="/usr/lib/libretro/snes9x_libretro.so"
          onChangeText={(t: string) => setCorePath(t)}
          style={{ height: 22, fontSize: 9, backgroundColor: c.surface, borderRadius: 4, paddingLeft: 6, paddingRight: 6, color: c.text, borderWidth: 1, borderColor: c.border }}
        />
        <S.StoryTiny>{'ROM path'}</S.StoryTiny>
        <Input
          value={romPath}
          placeholder="game.sfc"
          onChangeText={(t: string) => setRomPath(t)}
          style={{ height: 22, fontSize: 9, backgroundColor: c.surface, borderRadius: 4, paddingLeft: 6, paddingRight: 6, color: c.text, borderWidth: 1, borderColor: c.border }}
        />
      </Box>

      {/* Viewport */}
      {hasInputs ? (
        <Box style={{ width: 280, height: 200, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.libretro + '44', backgroundColor: '#000' }}>
          <Libretro
            core={corePath}
            rom={romPath}
            running={running}
            onLoaded={onLoaded}
            onError={onError}
            style={{ flexGrow: 1 }}
          />
        </Box>
      ) : (
        <Box style={{
          width: 280, height: 200, borderRadius: 6,
          backgroundColor: c.surface,
          borderWidth: 1, borderColor: C.libretro + '33',
          justifyContent: 'center', alignItems: 'center', gap: 8,
        }}>
          <Image src="cpu" style={{ width: 24, height: 24 }} tintColor={C.libretro} />
          <Text style={{ fontSize: 9, color: C.libretro }}>{'Libretro Core'}</Text>
          <S.StoryTiny>{'Enter a core + ROM path above'}</S.StoryTiny>
        </Box>
      )}

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? C.webcam : c.textDim }} />
        <Text style={{ fontSize: 9, color: active ? C.libretro : c.textDim }}>{status}</Text>
        {active && (
          <Pressable onPress={() => setRunning(!running)}>
            <Box style={{ backgroundColor: C.libretro + '22', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: C.libretro }}>{running ? 'Pause' : 'Resume'}</Text>
            </Box>
          </Pressable>
        )}
      </Box>
    </Box>
  );
}

// ── Live Demo: CartridgeOS VM ────────────────────────────

const CARTRIDGE_ISO = '/home/siah/creative/reactjit/experiments/cartridge-os/dist/cartridge-os.iso';

function CartridgeOSDemo() {
  const c = useThemeColors();
  const [active, setActive] = useState(false);
  const [poppedOut, setPoppedOut] = useState(false);
  const [vncPort, setVncPort] = useState(0);
  const [status, setStatus] = useState('Boot CartridgeOS');

  const onReady = useCallback((e: any) => {
    setStatus('VM running');
    if (e.vmInfo?.vncPort) setVncPort(e.vmInfo.vncPort);
  }, []);
  const onError = useCallback((e: any) => setStatus(`Error: ${e.message}`), []);

  return (
    <Box style={{ gap: 8, alignItems: 'center', width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Tag text="QEMU" color={C.vm} />
        <Tag text="virtio-vga" color={C.vm} />
        <Tag text="VNC" color={C.vm} />
      </Box>

      {/* VM Render — always in the same tree position when active */}
      {active && (
        <Box style={poppedOut
          ? { width: 0, height: 0, overflow: 'hidden' }
          : { width: '100%', height: 280, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.vm + '44', backgroundColor: '#000' }
        }>
          <Render source={CARTRIDGE_ISO} interactive vmMemory={2048} vmCpus={2} objectFit="contain" style={{ flexGrow: 1 }} onReady={onReady} onError={onError} />
        </Box>
      )}
      {/* Boot button when inactive */}
      {!active && (
        <Pressable onPress={() => setActive(true)}>
          <Box style={{
            width: '100%', height: 200, borderRadius: 6, overflow: 'hidden',
            borderWidth: 1, borderColor: C.vm + '44',
            backgroundColor: '#1a0a0a',
            justifyContent: 'center', alignItems: 'center', gap: 8,
          }}>
            <Image src="server" style={{ width: 24, height: 24 }} tintColor={C.vm} />
            <Text style={{ fontSize: 11, color: C.vm }}>{'Boot CartridgeOS'}</Text>
            <S.StoryTiny>{'Recursive: ReactJIT rendering a VM running ReactJIT'}</S.StoryTiny>
          </Box>
        </Pressable>
      )}
      {/* Popped out placeholder */}
      {active && poppedOut && (
        <Box style={{
          width: '100%', height: 200, borderRadius: 6,
          borderWidth: 1, borderColor: C.vm + '44',
          backgroundColor: '#1a0a0a',
          justifyContent: 'center', alignItems: 'center', gap: 6,
        }}>
          <Image src="external-link" style={{ width: 20, height: 20 }} tintColor={C.vm} />
          <Text style={{ fontSize: 10, color: C.vm }}>{'Popped out to own window'}</Text>
        </Box>
      )}

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? C.webcam : c.textDim }} />
        <Text style={{ fontSize: 9, color: active ? C.vm : c.textDim }}>{status}</Text>
        {active && vncPort > 0 && (
          <Pressable onPress={() => setPoppedOut(p => !p)}>
            <Box style={{ backgroundColor: C.accent + '22', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: C.accent }}>{poppedOut ? 'Pop in' : 'Pop out'}</Text>
            </Box>
          </Pressable>
        )}
        {active && (
          <Pressable onPress={() => { setActive(false); setPoppedOut(false); setVncPort(0); }}>
            <Box style={{ backgroundColor: C.vm + '22', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 8, color: C.vm }}>{'Stop'}</Text>
            </Box>
          </Pressable>
        )}
      </Box>

      {poppedOut && vncPort > 0 && (
        <Box style={{ width: 0, height: 0, overflow: 'hidden' }}>
          <Window title="CartridgeOS" width={1280} height={720} onClose={() => setPoppedOut(false)}>
            <Box style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
              <Render source={`vnc:localhost:${vncPort}`} interactive objectFit="contain" style={{ flexGrow: 1 }} />
            </Box>
          </Window>
        </Box>
      )}
    </Box>
  );
}

// ── Source Catalog ───────────────────────────────────────

function SourceCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {SOURCES.map(s => (
        <Box key={s.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 10, color: c.text, width: 110, flexShrink: 0 }}>{s.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{s.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Props Catalog ───────────────────────────────────────

function PropsCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {PROPS.map(p => (
        <Box key={p.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 10, color: c.text, width: 100, flexShrink: 0 }}>{p.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{p.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Helpers ──────────────────────────────────────────────

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <Box style={{ backgroundColor: color + '22', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
      <Text style={{ color, fontSize: 8, fontFamily: 'monospace' }}>{text}</Text>
    </Box>
  );
}

// ── RenderStory ─────────────────────────────────────────

export function RenderStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

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
          {'I cant find anything this cant render tbh'}
        </Text>
      </Box>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Capture screens, webcams, windows, and HDMI. Boot VMs from ISO. Create virtual displays. Run emulator cores. One component family.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'<Render> wraps FFmpeg, XShm, v4l2, QEMU, and Xephyr into a single declarative component. <Libretro> loads any libretro-compatible emulator core via LuaJIT FFI. Pass a source string and get live video. Interactive mode forwards mouse and keyboard. VMs use VNC, screen capture uses XShm, emulator cores run at native framerate.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── Install: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One import. The source prop determines the capture backend. Everything runs in Lua — React just declares the layout.'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Screen Capture: demo | text + code ── */}
        <Band>
          <Half>
            <ScreenCaptureDemo />
          </Half>
          <Half>
            <SectionLabel icon="monitor">{'SCREEN CAPTURE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Full screen capture via XShm shared memory — sub-millisecond latency on Linux. Falls back to x11grab (FFmpeg) on systems without XShm. Pass "screen:N" where N is the display index.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The XShm fast path maps the X11 framebuffer directly into Love2D texture memory. No pixel copies, no format conversion.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SCREEN_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Webcam: text + code | demo placeholder ── */}
        <Band>
          <Half>
            <SectionLabel icon="camera">{'WEBCAM'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Webcam feed via v4l2. Pass "cam:N" for device index or a direct path like "/dev/video2". Defaults to 30fps at 1280x720. Multiple cameras supported simultaneously.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Uses the same FFmpeg pipeline as HDMI but auto-negotiates resolution with the camera driver.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={WEBCAM_CODE} />
          </Half>
          <Half>
            <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
              <Tag text="cam:0" color={C.webcam} />
              <Box style={{
                width: 200, height: 130, borderRadius: 6,
                backgroundColor: c.surface,
                borderWidth: 1, borderColor: C.webcam + '33',
                justifyContent: 'center', alignItems: 'center', gap: 6,
              }}>
                <Image src="camera" style={{ width: 20, height: 20 }} tintColor={C.webcam} />
                <Text style={{ fontSize: 9, color: C.webcam }}>{'v4l2 device feed'}</Text>
              </Box>
              <Text style={{ fontSize: 8, color: c.textDim }}>{'Default: 30fps @ 1280x720'}</Text>
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── HDMI: code | text ── */}
        <Band>
          <Half>
            <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
              <Tag text="hdmi:0" color={C.hdmi} />
              <Box style={{
                width: 200, height: 130, borderRadius: 6,
                backgroundColor: c.surface,
                borderWidth: 1, borderColor: C.hdmi + '33',
                justifyContent: 'center', alignItems: 'center', gap: 6,
              }}>
                <Image src="tv" style={{ width: 20, height: 20 }} tintColor={C.hdmi} />
                <Text style={{ fontSize: 9, color: C.hdmi }}>{'Capture card input'}</Text>
              </Box>
              <Text style={{ fontSize: 8, color: c.textDim }}>{'Same v4l2 pipeline as webcam'}</Text>
            </Box>
          </Half>
          <Half>
            <SectionLabel icon="tv">{'HDMI CAPTURE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'HDMI capture card input. Uses the same v4l2 pipeline as webcam but targets capture card devices. Pass "hdmi:N" for device index. Supports 1080p60 and 4K30 depending on hardware.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={HDMI_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Window Capture: demo | text + code ── */}
        <Band>
          <Half>
            <WindowCaptureDemo />
          </Half>
          <Half>
            <SectionLabel icon="layout">{'WINDOW CAPTURE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Capture a specific window by its title. Uses X11 window matching — pass "window:Title" where Title is a substring of the target window name. Great for embedding other apps inside your ReactJIT layout.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={WINDOW_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: everything runs in Lua ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All capture, VM management, and input forwarding runs in Lua. React never touches frame data or event queues — the capability tick function blits frames directly to Love2D textures. Zero bridge overhead per frame.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── VM: text + code | visual ── */}
        <Band>
          <Half>
            <SectionLabel icon="server">{'VIRTUAL MACHINES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Boot a QEMU VM from an ISO or disk image. Framebuffer streamed over VNC, input forwarded automatically. KVM auto-detected for near-native speed. Supports .iso, .img, .qcow2, .vmdk, .vdi, .vhd.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'VMs default to interactive=true. Mouse clicks and keyboard input are forwarded via VNC protocol with zero additional latency.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={VM_CODE} />
          </Half>
          <Half>
            <CartridgeOSDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Virtual Display: code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={DISPLAY_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="airplay">{'VIRTUAL DISPLAY'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Create a virtual monitor that other apps can render to. Your ReactJIT window becomes Display :N. Launch apps targeting that display and see their output live. Requires Xephyr or Xvfb.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The onReady callback receives the display number so you can launch apps targeting it. When your Render component unmounts, the virtual monitor disconnects cleanly.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Interactive Mode: text + code | visual ── */}
        <Band>
          <Half>
            <SectionLabel icon="mouse-pointer">{'INTERACTIVE MODE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'When interactive is true, mouse clicks and keyboard input are forwarded to the source. VMs use VNC protocol (zero-latency). Screen and window capture use xdotool. VMs and displays default to interactive=true.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Input forwarding coordinates are transformed from the Render element bounds to the source resolution — clicks land exactly where you expect regardless of objectFit scaling.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INTERACTIVE_CODE} />
          </Half>
          <Half>
            <Box style={{ gap: 6, alignItems: 'center', width: '100%' }}>
              <Tag text="interactive" color={C.interactive} />
              <Box style={{
                width: 200, height: 120, borderRadius: 6,
                backgroundColor: c.surface,
                borderWidth: 1, borderColor: C.interactive + '33',
                justifyContent: 'center', alignItems: 'center', gap: 8,
              }}>
                <Image src="mouse-pointer" style={{ width: 20, height: 20 }} tintColor={C.interactive} />
                <Text style={{ fontSize: 9, color: C.interactive }}>{'Mouse + keyboard forwarding'}</Text>
              </Box>
              <Box style={{ gap: 3 }}>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.vm }} />
                  <Text style={{ fontSize: 9, color: c.text }}>{'VM/Display'}</Text>
                  <Text style={{ fontSize: 9, color: c.muted }}>{'interactive=true by default'}</Text>
                </Box>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.screen }} />
                  <Text style={{ fontSize: 9, color: c.text }}>{'Screen/Window'}</Text>
                  <Text style={{ fontSize: 9, color: c.muted }}>{'interactive=false by default'}</Text>
                </Box>
              </Box>
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Libretro: demo | text + code ── */}
        <Band>
          <Half>
            <LibretroDemo />
          </Half>
          <Half>
            <SectionLabel icon="cpu">{'LIBRETRO CORES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Run any libretro-compatible emulator core as a React component. NES, SNES, GBA, Genesis, N64, PS1 — hundreds of cores available. Loads .so dynamically via LuaJIT FFI. Video, audio, input, save states, and SRAM persistence all handled automatically.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Cores run at their native framerate via a time accumulator. Pixel format conversion (XRGB8888, RGB565, 0RGB1555) happens in a tight LuaJIT loop. Audio streams through a QueueableSource. Gamepads work out of the box.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={LIBRETRO_CODE} />
            <Text style={{ color: c.muted, fontSize: 9, marginTop: 4 }}>
              {'Controls: Arrows=D-Pad, Z/X=A/B, A/S=X/Y, Enter=Start, RShift=Select, Q/W=L/R. F5=Save, F9=Load, F6=Reset. Gamepads mapped automatically.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Events: text | code ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap">{'EVENTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three lifecycle events. onReady fires when the first frame arrives — for VMs this includes vmInfo with PID and VNC port, for displays it includes displayNumber. onError fires on capture failure. onFrame fires per frame (throttled).'}
            </Text>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={EVENTS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Source catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 16,
          gap: 8,
        }}>
          <SectionLabel icon="list">{'SOURCE TYPES'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Every source string <Render> accepts:'}</Text>
          <SourceCatalog />
        </Box>

        <Divider />

        {/* ── Props catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="settings">{'PROPS & EVENTS'}</SectionLabel>
          <PropsCatalog />
        </Box>

        <Divider />

        {/* ── Callout: one-liner philosophy ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Screen capture, webcam feed, HDMI input, window grab, VM boot, virtual display, emulator cores — all declarative, all one-liners. The source string or core path is the only thing that changes.'}
          </Text>
        </CalloutBand>

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
        <Image src="monitor" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Render'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </S.StoryRoot>
  );
}
