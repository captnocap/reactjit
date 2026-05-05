import { useState } from 'react';
import { Box, Row, Text, Pressable, Render } from '@reactjit/runtime/primitives';

const VM_ISO = '/home/siah/creative/reactjit/love2d/examples/app-embed/cbpp-12.1-amd64-20240201.iso';
const KITTY_CMD = 'app:kitty -o remember_window_size=no -o initial_window_width=900 -o initial_window_height=600';

type Mode = 'kitty' | 'vm' | 'split';

export default function App() {
  const [mode, setMode] = useState<Mode>('split');
  const [kittySuspended, setKittySuspended] = useState(false);
  const [vmSuspended, setVmSuspended] = useState(false);

  // Both panes stay mounted regardless of mode. We toggle visibility via
  // flex-grow only so paintSurface keeps marking each feed active and the
  // engine never tears down qemu/Xvfb/kitty. State is preserved across
  // mode toggles indefinitely.
  //
  // Suspend goes a step further: SIGSTOPs the underlying qemu/Xvfb so they
  // consume zero CPU. Last-rendered pixels stay on the texture so the pane
  // still paints (frozen frame). Resume = SIGCONT, instant restore.
  const kittyVisible = mode === 'kitty' || mode === 'split';
  const vmVisible = mode === 'vm' || mode === 'split';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a', flexDirection: 'column' }}>
      <Row style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, gap: 8, backgroundColor: '#181825', alignItems: 'center' }}>
        <Text style={{ color: '#cdd6f4', fontSize: 13, fontWeight: 'bold' }}>render-test</Text>
        <Text style={{ color: '#6c7086', fontSize: 11 }}>·</Text>
        <ModeButton label="split" active={mode === 'split'} onPress={() => setMode('split')} />
        <ModeButton label="kitty only" active={mode === 'kitty'} onPress={() => setMode('kitty')} />
        <ModeButton label="vm only" active={mode === 'vm'} onPress={() => setMode('vm')} />
      </Row>

      <Row style={{ flexGrow: 1, gap: 4, padding: 4 }}>
        <Pane
          title="kitty"
          src={KITTY_CMD}
          visible={kittyVisible}
          suspended={kittySuspended}
          onToggleSuspend={() => setKittySuspended((s) => !s)}
        />
        <Pane
          title={`vm: ${VM_ISO.split('/').pop()}`}
          src={`vm:${VM_ISO}`}
          visible={vmVisible}
          suspended={vmSuspended}
          onToggleSuspend={() => setVmSuspended((s) => !s)}
        />
      </Row>
    </Box>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
        borderRadius: 4,
        backgroundColor: active ? '#89b4fa' : '#2a2a4a',
      }}>
      <Text style={{ color: active ? '#0f0f1a' : '#cdd6f4', fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}

function Pane({
  title,
  src,
  visible,
  suspended,
  onToggleSuspend,
}: {
  title: string;
  src: string;
  visible: boolean;
  suspended: boolean;
  onToggleSuspend: () => void;
}) {
  return (
    <Box style={{
      flexGrow: visible ? 1 : 0,
      flexBasis: 0,
      width: visible ? undefined : 0,
      borderWidth: visible ? 1 : 0,
      borderColor: '#2a2a4a',
      borderRadius: 4,
      overflow: 'hidden',
      flexDirection: 'column',
    }}>
      <Row style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, backgroundColor: '#181825', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', flexGrow: 1 }}>{title}</Text>
        <Pressable
          onPress={onToggleSuspend}
          style={{
            paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8,
            borderRadius: 3,
            backgroundColor: suspended ? '#f9e2af' : '#2a2a4a',
          }}>
          <Text style={{ color: suspended ? '#0f0f1a' : '#cdd6f4', fontSize: 10 }}>
            {suspended ? 'resume' : 'suspend'}
          </Text>
        </Pressable>
      </Row>
      <Box style={{ flexGrow: 1, width: '100%', backgroundColor: '#ff00ff', justifyContent: 'center', alignItems: 'center' }}>
        <Render renderSrc={src} renderSuspended={suspended} style={{ flexGrow: 1, width: '100%' }} />
      </Box>
    </Box>
  );
}
