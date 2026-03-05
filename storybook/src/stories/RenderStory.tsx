import React, { useState } from 'react';
import { Box, Text, Render, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { CodeBlock } from '../../../packages/core/src';

const C = {
  screen: '#1a1a2e',
  cam: '#16213e',
  interactive: '#0f3460',
  accent: '#e94560',
  muted: '#666680',
  dim: '#333355',
  vm: '#1a2e1a',
  display: '#2e1a2e',
};

const BASIC_CODE = `// Capture your screen
<Render source="screen:0" />

// Webcam feed
<Render source="cam:0" fps={30} />

// HDMI capture card
<Render source="hdmi:0" />

// Specific window by title
<Render source="window:Firefox" />

// Direct v4l2 device
<Render source="/dev/video2" />`;

const VM_CODE = `// Boot a VM from an ISO — one line
<Render source="debian.iso" interactive />

// Disk image with custom resources
<Render
  source="vm:myserver.qcow2"
  vmMemory={4096}
  vmCpus={4}
  interactive
  style={{ flexGrow: 1 }}
/>

// Detected by extension: .iso .img .qcow2 .vmdk .vdi .vhd
// Or explicit prefix: vm:path/to/image`;

const DISPLAY_CODE = `// Virtual display — other apps can render to it
<Render
  source="display"
  resolution="1920x1080"
  interactive
  onReady={({ displayNumber }) => {
    // Launch apps on the virtual display:
    // DISPLAY=:displayNumber firefox
  }}
/>

// The window IS a display. When your app closes,
// the virtual monitor disconnects cleanly.`;

const INTERACTIVE_CODE = `// Interactive mode: mouse + keyboard forwarded
<Render
  source="screen:0"
  interactive
  objectFit="contain"
  style={{ flexGrow: 1 }}
/>

// VMs and displays default to interactive={true}
// Screen/window capture defaults to interactive={false}`;

const PROPS_CODE = `interface RenderProps {
  source: string;         // see Source Types above
  fps?: number;           // default: 30
  resolution?: string;    // default: "1280x720"
  interactive?: boolean;  // default: false (true for vm/display)
  muted?: boolean;        // default: true
  objectFit?: 'fill' | 'contain' | 'cover';

  // VM-only props
  vmMemory?: number;      // RAM in MB (default: 2048)
  vmCpus?: number;        // CPU count (default: 2)

  // Events
  onReady?: (e?: { displayNumber?, vmInfo? }) => void;
  onError?: (e: { message: string }) => void;
}`;

function SourceCard({ source, label, description }: {
  source: string;
  label: string;
  description: string;
}) {
  const c = useThemeColors();
  const [status, setStatus] = useState('idle');

  return (
    <Box style={{
      width: '100%',
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    }}>
      <Render
        source={source}
        fps={15}
        onReady={() => setStatus('live')}
        onError={() => setStatus('unavailable')}
        style={{ width: '100%', height: 180 }}
      />
      <Box style={{ padding: 10, gap: 4 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* rjit-ignore-next-line */}
          <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>
            {label}
          </Text>
          {/* rjit-ignore-next-line */}
          <Text style={{
            color: status === 'live' ? '#4caf50' : status === 'unavailable' ? C.accent : C.muted,
            fontSize: 9,
          }}>
            {status === 'live' ? 'LIVE' : status === 'unavailable' ? 'NO DEVICE' : 'CONNECTING...'}
          </Text>
        </Box>
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {description}
        </Text>
        <Text style={{ color: C.dim, fontSize: 8 }}>
          {`source="${source}"`}
        </Text>
      </Box>
    </Box>
  );
}

export function RenderStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* Header */}
      <Box style={{ gap: 4, marginBottom: 8 }}>
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Render'}
        </Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>
          {'Capture screens, run VMs, and create virtual displays. Like OBS + QEMU, but as a React component.'}
        </Text>
      </Box>

      {/* Section 1: Source Types */}
      <StorySection index={1} title="Capture Sources">
        <Box style={{ width: '100%', gap: 10 }}>
          <Box style={{ flexDirection: 'row', gap: 10 }}>
            <Box style={{ flexGrow: 1 }}>
              <SourceCard
                source="screen:0"
                label="Screen Capture"
                description="Full screen via XShm (<1ms) or x11grab"
              />
            </Box>
            <Box style={{ flexGrow: 1 }}>
              <SourceCard
                source="cam:0"
                label="Webcam"
                description="v4l2 device /dev/video0"
              />
            </Box>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 10 }}>
            <Box style={{ flexGrow: 1 }}>
              <SourceCard
                source="hdmi:0"
                label="HDMI Capture"
                description="Capture card input"
              />
            </Box>
            <Box style={{ flexGrow: 1 }}>
              <SourceCard
                source="window:Firefox"
                label="Window Capture"
                description="Specific window by title"
              />
            </Box>
          </Box>
        </Box>
      </StorySection>

      {/* Section 2: VM Sources */}
      <StorySection index={2} title="VM Sources">
        <Text style={{ color: c.text, fontSize: 10 }}>
          {'Pass an ISO or disk image as the source and ReactJIT boots a QEMU VM, captures its display over VNC, and forwards your keyboard and mouse. Alt-tab between VMs inside your app.'}
        </Text>
        <CodeBlock language="tsx" fontSize={9} code={VM_CODE} />
        <Box style={{ width: '100%', gap: 6, marginTop: 4 }}>
          {[
            { flag: 'KVM', desc: 'Auto-detected via /dev/kvm for near-native speed' },
            { flag: 'VNC', desc: 'Headless — no visible QEMU window, framebuffer streamed over VNC' },
            { flag: 'USB tablet', desc: 'Absolute mouse positioning (no grab required)' },
          ].map((item) => (
            <Box key={item.flag} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {/* rjit-ignore-next-line */}
              <Text style={{ color: '#4caf50', fontSize: 9, fontWeight: 'bold', width: 70 }}>
                {item.flag}
              </Text>
              <Text style={{ color: c.muted, fontSize: 9 }}>
                {item.desc}
              </Text>
            </Box>
          ))}
        </Box>
      </StorySection>

      {/* Section 3: Virtual Display */}
      <StorySection index={3} title="Virtual Display">
        <Text style={{ color: c.text, fontSize: 10 }}>
          {'Create a virtual monitor that other apps can render to. Your ReactJIT window becomes Display N. When the app closes, the virtual monitor disconnects and your OS cleans up.'}
        </Text>
        <CodeBlock language="tsx" fontSize={9} code={DISPLAY_CODE} />
        <Text style={{ color: C.dim, fontSize: 9, marginTop: 4 }}>
          {'Requires: apt install xserver-xephyr (or xvfb)'}
        </Text>
      </StorySection>

      {/* Section 4: Interactive Mode */}
      <StorySection index={4} title="Interactive Mode">
        <Text style={{ color: c.text, fontSize: 10 }}>
          {'When interactive, mouse clicks and keyboard input are forwarded to the source. VMs use VNC protocol (zero-latency). Screen/window capture uses xdotool. Virtual displays use DISPLAY=:N xdotool.'}
        </Text>
        <CodeBlock language="tsx" fontSize={9} code={INTERACTIVE_CODE} />
      </StorySection>

      {/* Section 5: Basic Usage */}
      <StorySection index={5} title="Basic Usage">
        <CodeBlock language="tsx" fontSize={9} code={BASIC_CODE} />
      </StorySection>

      {/* Section 6: Props Reference */}
      <StorySection index={6} title="Props">
        <CodeBlock language="tsx" fontSize={9} code={PROPS_CODE} />
      </StorySection>

      {/* Section 7: Requirements */}
      <StorySection index={7} title="Requirements">
        <Box style={{ width: '100%', gap: 6 }}>
          {[
            { pkg: 'ffmpeg', desc: 'Frame capture and transcoding (all sources)' },
            { pkg: 'xdotool', desc: 'Input forwarding (screen/window/display sources)' },
            { pkg: 'v4l-utils', desc: 'Webcam / HDMI capture card support' },
            { pkg: 'qemu-system-x86_64', desc: 'VM sources (ISO, disk images)' },
            { pkg: 'xserver-xephyr', desc: 'Virtual display (source="display")' },
          ].map((req) => (
            <Box key={req.pkg} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {/* rjit-ignore-next-line */}
              <Text style={{ color: C.accent, fontSize: 10, fontWeight: 'bold', width: 130 }}>
                {req.pkg}
              </Text>
              <Text style={{ color: c.muted, fontSize: 10 }}>
                {req.desc}
              </Text>
            </Box>
          ))}
          <Text style={{ color: C.dim, fontSize: 9, marginTop: 4 }}>
            {'apt install ffmpeg xdotool v4l-utils qemu-system-x86_64 xserver-xephyr'}
          </Text>
        </Box>
      </StorySection>
    </StoryPage>
  );
}
