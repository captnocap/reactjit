// ============================================================================
// Shared types (both tiers use the same key format)
// ============================================================================

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

// ============================================================================
// Tier 1: Real WireGuard (kernel)
// ============================================================================

export interface WireGuardPeerConfig {
  publicKey: string;
  endpoint?: string;
  allowedIPs?: string;
  presharedKey?: string;
  keepalive?: number;
}

export interface WireGuardConfig {
  interface?: string;
  privateKey: string;
  listenPort?: number;
  address?: string;
  dns?: string;
  mtu?: number;
  peers?: WireGuardPeerConfig[];
}

export interface WireGuardPeerStatus {
  publicKey: string;
  endpoint?: string;
  allowedIPs: string;
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
  keepalive?: number;
}

export interface WireGuardStatus {
  interface: string;
  publicKey: string;
  listenPort: number;
  peers: WireGuardPeerStatus[];
}

export interface UseWireGuardResult {
  available: boolean;
  hasPrivilege: boolean;
  status: WireGuardStatus | null;
  up: (config: WireGuardConfig) => Promise<boolean>;
  down: () => Promise<boolean>;
  addPeer: (peer: WireGuardPeerConfig) => Promise<boolean>;
  removePeer: (publicKey: string) => Promise<boolean>;
  generateKeys: () => Promise<KeyPair>;
  error: string | null;
}

// ============================================================================
// Tier 2: Userspace P2P (application-layer)
// ============================================================================

export interface PeerTunnelConfig {
  privateKey: string;
  publicKey?: string;
  listenPort?: number;
  stunServer?: string;
  stunPort?: number;
  keepaliveInterval?: number;
}

export interface PeerInfo {
  publicKey: string;
  endpoint?: string;
  state: 'waiting' | 'handshaking' | 'established' | 'failed';
  lastSeen: number;
}

export interface TunnelInfo {
  tunnelId: number;
  publicKey: string;
  port: number;
  publicIP?: string;
  publicPort?: number;
  publicEndpoint?: string;
  peers: PeerInfo[];
}

export interface PeerMessage {
  publicKey: string;
  data: string;
}

export interface UsePeerTunnelResult {
  ready: boolean;
  tunnelInfo: TunnelInfo | null;
  peers: PeerInfo[];
  send: (publicKey: string, data: string) => void;
  broadcast: (data: string) => void;
  addPeer: (publicKey: string, endpoint?: string) => void;
  removePeer: (publicKey: string) => void;
  lastMessage: PeerMessage | null;
  error: string | null;
}
