/**
 * WireGuard — Package documentation page (Layout2 zigzag narrative).
 *
 * Two-tier encrypted P2P networking:
 *   Tier 1: useWireGuard()    — real kernel WireGuard via `wg` CLI
 *   Tier 2: usePeerTunnel()   — userspace X25519 + XChaCha20-Poly1305 over UDP
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React from 'react';
import { Box, Text, ScrollView, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#10b981',
  accentDim: 'rgba(16, 185, 129, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  warn: 'rgba(245, 158, 11, 0.08)',
  warnBorder: 'rgba(245, 158, 11, 0.25)',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  teal: '#94e2d5',
  green: '#a6e3a1',
  kernel: '#6366f1',
  userspace: '#10b981',
};

// ── Static code blocks ───────────────────────────────────

const IMPORT_CODE = `import {
  useWireGuard,        // Tier 1: real kernel WireGuard
  usePeerTunnel,       // Tier 2: userspace encrypted P2P
  useWireGuardIdentity // Shared X25519 key generation
} from '@reactjit/wireguard'`;

const IDENTITY_CODE = `const { publicKey, privateKey, generate } = useWireGuardIdentity()

// Generate a new identity (X25519 keypair)
const keys = await generate()
// keys.publicKey  — share with peers
// keys.privateKey — keep secret`;

const TIER1_CODE = `const wg = useWireGuard('wg-rjit0')

// Check system requirements
if (!wg.available) return <Text>Install wireguard-tools</Text>
if (!wg.hasPrivilege) return <Text>Needs sudo</Text>

// Generate keys (via wg genkey — never touches JS/Lua memory)
const keys = await wg.generateKeys()

// Bring up a real WireGuard tunnel
await wg.up({
  privateKey: keys.privateKey,
  listenPort: 51820,
  address: '10.0.0.1/24',
  peers: [{
    publicKey: peerKey,
    endpoint: '1.2.3.4:51820',
    allowedIPs: '10.0.0.2/32',
    keepalive: 25,
  }],
})

// wg.status — live interface stats (polls every 5s)
// wg.addPeer() / wg.removePeer() — hot-swap peers
// wg.down() — tear down the interface`;

const TIER2_CODE = `const tunnel = usePeerTunnel({
  privateKey: myKey,
  stunServer: 'stun.l.google.com',
  stunPort: 19302,
})

// tunnel.tunnelInfo.publicEndpoint — your STUN-resolved address
// Share this + your publicKey via signaling (WebSocket, QR, etc.)

// Add a peer after signaling exchange
tunnel.addPeer(theirPublicKey, '1.2.3.4:9000')

// Send encrypted data (XChaCha20-Poly1305)
tunnel.send(theirPublicKey, 'hello encrypted world')

// Broadcast to all connected peers
tunnel.broadcast(JSON.stringify({ type: 'move', x: 10, y: 20 }))

// Receive messages
if (tunnel.lastMessage) {
  const { publicKey, data } = tunnel.lastMessage
}`;

const SIGNALING_CODE = `// Peer A: create tunnel, get public endpoint via STUN
const tunnel = usePeerTunnel({ privateKey: keyA, stunServer: 'stun.l.google.com' })
const ws = useWebSocket('wss://signal.example.com')

// Send our info to the signaling server
ws.send(JSON.stringify({
  publicKey: tunnel.tunnelInfo?.publicKey,
  endpoint: tunnel.tunnelInfo?.publicEndpoint,
  room: 'my-game',
}))

// When we receive peer info, add them
useEffect(() => {
  if (!ws.lastMessage) return
  const peer = JSON.parse(ws.lastMessage)
  tunnel.addPeer(peer.publicKey, peer.endpoint)
}, [ws.lastMessage])`;

const THREAT_CODE = `// Tier 1: useWireGuard() — kernel trust boundary
// - Keys held by kernel, never in process memory
// - OS routing enforces tunnel (no accidental bypass)
// - Survives app crash (interface persists)
// - Requires: wireguard-tools, sudo/root

// Tier 2: usePeerTunnel() — process trust boundary
// - Same crypto (X25519 + XChaCha20-Poly1305)
// - Keys live in Lua heap (ptrace-visible)
// - App crash = tunnel gone
// - Requires: libsodium only (already bundled)

// Both tiers protect against:
// - Passive network observers (ISP, WiFi sniffers)
// - MITM without key compromise

// Only Tier 1 protects against:
// - Local process-level attackers
// - Memory forensics
// - Application bugs leaking plaintext`;

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

// ── Band layout helpers ─────────────────────────────────

const BAND_STYLE = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const TEXT_SIDE = {
  flexGrow: 1,
  flexBasis: 0,
  gap: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const CODE_SIDE = { flexGrow: 1, flexBasis: 0 };

// ── Visual diagrams ──────────────────────────────────────

function TierDiagram() {
  const c = useThemeColors();
  const boxStyle = (color: string) => ({
    paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
    borderRadius: 4, backgroundColor: color,
  });
  const labelStyle = { fontSize: 9, color: '#fff', fontWeight: 'bold' as const };
  const arrowStyle = { fontSize: 10, color: c.muted };

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>
        {`Tier 1: Kernel WireGuard`}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={boxStyle(C.blue)}>
          <Text style={labelStyle}>{`React`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle(C.mauve)}>
          <Text style={labelStyle}>{`Lua RPC`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle(C.kernel)}>
          <Text style={labelStyle}>{`wg CLI`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle('#1e1e2e')}>
          <Text style={labelStyle}>{`Kernel wg0`}</Text>
        </Box>
      </Box>

      <Box style={{ height: 8 }} />
      <Text style={{ fontSize: 10, color: c.text, fontWeight: 'bold' }}>
        {`Tier 2: Userspace P2P`}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={boxStyle(C.blue)}>
          <Text style={labelStyle}>{`React`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle(C.mauve)}>
          <Text style={labelStyle}>{`Lua RPC`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle(C.userspace)}>
          <Text style={labelStyle}>{`libsodium`}</Text>
        </Box>
        <Text style={arrowStyle}>{`->`}</Text>
        <Box style={boxStyle(C.teal)}>
          <Text style={labelStyle}>{`UDP socket`}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function PeerStateIndicator({ state }: { state: string }) {
  const color = state === 'established' ? C.green
    : state === 'handshaking' ? C.yellow
    : state === 'waiting' ? C.blue
    : C.red;
  return (
    <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 9, color }}>{state}</Text>
    </Box>
  );
}

// ── Main story ───────────────────────────────────────────

export function WireGuardStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 0 }}>
          {/* Header */}
          <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 24, paddingBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: c.text }}>
              {`@reactjit/wireguard`}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted, paddingTop: 4 }}>
              {`Encrypted P2P networking. Two tiers — same key format, you choose the trust boundary.`}
            </Text>
          </Box>
          <Divider />

          {/* Band 1: Import */}
          <Box style={BAND_STYLE}>
            <Box style={TEXT_SIDE}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`Install`}</Text>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Three hooks, two tiers. Import what you need.`}
              </Text>
            </Box>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{IMPORT_CODE}</CodeBlock>
            </Box>
          </Box>
          <Divider />

          {/* Band 2: Architecture diagram */}
          <Box style={BAND_STYLE}>
            <Box style={CODE_SIDE}>
              <TierDiagram />
            </Box>
            <Box style={TEXT_SIDE}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`Architecture`}</Text>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Tier 1 delegates crypto to the kernel via wg CLI. Keys never enter process memory. Tier 2 runs the same primitives in userspace via libsodium FFI — zero system deps, works everywhere.`}
              </Text>
            </Box>
          </Box>
          <Divider />

          {/* Band 3: Identity */}
          <Box style={BAND_STYLE}>
            <Box style={TEXT_SIDE}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`Identity`}</Text>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Both tiers use X25519 keypairs. Generate once, persist with useLocalStore, share the public key.`}
              </Text>
            </Box>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{IDENTITY_CODE}</CodeBlock>
            </Box>
          </Box>
          <Divider />

          {/* Band 4: Tier 1 — Real WireGuard */}
          <Box style={{ ...BAND_STYLE, backgroundColor: 'rgba(99, 102, 241, 0.04)' }}>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{TIER1_CODE}</CodeBlock>
            </Box>
            <Box style={TEXT_SIDE}>
              <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{
                  paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 3, backgroundColor: C.kernel,
                }}>
                  <Text style={{ fontSize: 8, color: '#fff', fontWeight: 'bold' }}>{`TIER 1`}</Text>
                </Box>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`useWireGuard()`}</Text>
              </Box>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Real kernel WireGuard. Creates a wg0 interface, routes traffic through it. Keys generated by wg genkey — they go straight from CLI stdout to the config file, never touching Lua/JS. Requires wireguard-tools and sudo.`}
              </Text>
              <Box style={{
                paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                borderRadius: 4, backgroundColor: C.warn, borderWidth: 1, borderColor: C.warnBorder,
              }}>
                <Text style={{ fontSize: 9, color: C.yellow }}>
                  {`Requires: wireguard-tools + root/sudo for interface management`}
                </Text>
              </Box>
            </Box>
          </Box>
          <Divider />

          {/* Band 5: Tier 2 — Userspace P2P */}
          <Box style={{ ...BAND_STYLE, backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
            <Box style={TEXT_SIDE}>
              <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Box style={{
                  paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 3, backgroundColor: C.userspace,
                }}>
                  <Text style={{ fontSize: 8, color: '#fff', fontWeight: 'bold' }}>{`TIER 2`}</Text>
                </Box>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`usePeerTunnel()`}</Text>
              </Box>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Userspace encrypted P2P over UDP. X25519 key agreement + XChaCha20-Poly1305 AEAD. STUN for NAT traversal, UDP hole punching for direct connectivity. No root, no system deps.`}
              </Text>
              <Box style={{ flexDirection: 'row', gap: 8 }}>
                <PeerStateIndicator state="established" />
                <PeerStateIndicator state="handshaking" />
                <PeerStateIndicator state="waiting" />
                <PeerStateIndicator state="failed" />
              </Box>
            </Box>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{TIER2_CODE}</CodeBlock>
            </Box>
          </Box>
          <Divider />

          {/* Band 6: Signaling */}
          <Box style={BAND_STYLE}>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{SIGNALING_CODE}</CodeBlock>
            </Box>
            <Box style={TEXT_SIDE}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`Signaling`}</Text>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Peers need to exchange public keys and endpoints before they can connect. Use any channel — WebSocket, QR code, manual copy-paste. The signaling server sees public keys and endpoints but never the tunnel traffic.`}
              </Text>
            </Box>
          </Box>
          <Divider />

          {/* Band 7: Threat model */}
          <Box style={BAND_STYLE}>
            <Box style={TEXT_SIDE}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: c.text }}>{`Threat Model`}</Text>
              <Text style={{ fontSize: 10, color: c.muted }}>
                {`Both tiers encrypt identically on the wire. The difference is where the trust boundary sits. Choose based on your attacker model, not convenience.`}
              </Text>
              <Box style={{
                paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                borderRadius: 4, backgroundColor: C.callout, borderWidth: 1, borderColor: C.calloutBorder,
              }}>
                <Text style={{ fontSize: 9, color: C.blue }}>
                  {`We ship both so you make the decision, not us.`}
                </Text>
              </Box>
            </Box>
            <Box style={CODE_SIDE}>
              <CodeBlock language="typescript" fontSize={9}>{THREAT_CODE}</CodeBlock>
            </Box>
          </Box>

          {/* Footer spacing */}
          <Box style={{ height: 40 }} />
        </Box>
      </ScrollView>
    </Box>
  );
}
