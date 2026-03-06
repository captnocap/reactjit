// @reactjit/wireguard -- Encrypted P2P networking
//
// Two tiers, same key format, user chooses their trust boundary:
//
// Tier 1: useWireGuard()    — real kernel WireGuard via `wg` CLI (root required)
// Tier 2: usePeerTunnel()   — userspace X25519 + XChaCha20-Poly1305 over UDP (no root)
//
// Lua-side:
//   lua/wireguard.lua     — wg/wg-quick subprocess management
//   lua/peer_tunnel.lua   — encrypted UDP tunnels via libsodium FFI
//   lua/stun.lua          — STUN NAT traversal (RFC 5389)

export type {
  KeyPair,
  WireGuardPeerConfig,
  WireGuardConfig,
  WireGuardPeerStatus,
  WireGuardStatus,
  UseWireGuardResult,
  PeerTunnelConfig,
  PeerInfo,
  TunnelInfo,
  PeerMessage,
  UsePeerTunnelResult,
} from './types';

export {
  useWireGuardIdentity,
  useWireGuard,
  usePeerTunnel,
} from './hooks';
