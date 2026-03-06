/**
 * React hooks for WireGuard P2P networking.
 *
 * Two tiers — same key format, same signaling, different trust boundaries:
 *
 * Tier 1: useWireGuard()    — real kernel WireGuard via `wg` CLI
 * Tier 2: usePeerTunnel()   — userspace encrypted P2P via libsodium
 *
 * Lua-side:
 *   lua/wireguard.lua     — wg/wg-quick subprocess management
 *   lua/peer_tunnel.lua   — X25519 + XChaCha20-Poly1305 over UDP
 *   lua/stun.lua          — STUN NAT traversal
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@reactjit/core';
import type {
  KeyPair,
  WireGuardConfig,
  WireGuardPeerConfig,
  WireGuardStatus,
  UseWireGuardResult,
  PeerTunnelConfig,
  PeerInfo,
  TunnelInfo,
  PeerMessage,
  UsePeerTunnelResult,
} from './types';

// ============================================================================
// useWireGuardIdentity — shared key generation (works with both tiers)
// ============================================================================

/**
 * Generate or load a persistent X25519 identity for P2P.
 * Works with both useWireGuard (Tier 1) and usePeerTunnel (Tier 2).
 *
 * @example
 * const { publicKey, privateKey, generate } = useWireGuardIdentity();
 */
export function useWireGuardIdentity(): {
  publicKey: string | null;
  privateKey: string | null;
  generate: () => Promise<KeyPair>;
  ready: boolean;
} {
  const [keys, setKeys] = useState<KeyPair | null>(null);
  const generateRpc = useLoveRPC('peer_tunnel:generate_identity');

  const generate = useCallback(async () => {
    const result = await generateRpc({}) as KeyPair;
    setKeys(result);
    return result;
  }, [generateRpc]);

  return {
    publicKey: keys?.publicKey ?? null,
    privateKey: keys?.privateKey ?? null,
    generate,
    ready: keys !== null,
  };
}

// ============================================================================
// useWireGuard — Tier 1: Real kernel WireGuard
// ============================================================================

/**
 * Manage a real WireGuard tunnel via the `wg` CLI.
 * Requires wireguard-tools installed and root/sudo for interface management.
 * Keys are held by the kernel — never in Lua/JS process memory.
 *
 * @example
 * const wg = useWireGuard('wg-rjit0');
 *
 * // Check availability first
 * if (!wg.available) return <Text>Install wireguard-tools</Text>;
 * if (!wg.hasPrivilege) return <Text>Needs sudo</Text>;
 *
 * // Generate keys and bring up tunnel
 * const keys = await wg.generateKeys();
 * await wg.up({
 *   privateKey: keys.privateKey,
 *   listenPort: 51820,
 *   address: '10.0.0.1/24',
 *   peers: [{
 *     publicKey: peerKey,
 *     endpoint: '1.2.3.4:51820',
 *     allowedIPs: '10.0.0.2/32',
 *     keepalive: 25,
 *   }],
 * });
 */
export function useWireGuard(interfaceName?: string): UseWireGuardResult {
  const ifname = interfaceName ?? 'wg-rjit0';
  const [available, setAvailable] = useState(false);
  const [hasPrivilege, setHasPrivilege] = useState(false);
  const [status, setStatus] = useState<WireGuardStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ifRef = useRef(ifname);
  ifRef.current = ifname;

  const availableRpc = useLoveRPC('wireguard:available');
  const upRpc = useLoveRPC('wireguard:up');
  const downRpc = useLoveRPC('wireguard:down');
  const addPeerRpc = useLoveRPC('wireguard:add_peer');
  const removePeerRpc = useLoveRPC('wireguard:remove_peer');
  const statusRpc = useLoveRPC('wireguard:status');
  const genKeysRpc = useLoveRPC('wireguard:generate_keys');

  // Check availability on mount
  useEffect(() => {
    availableRpc({}).then((result: any) => {
      setAvailable(result.available);
      setHasPrivilege(result.hasPrivilege ?? false);
      if (!result.available) setError(result.error);
    }).catch((err: any) => setError(String(err)));
  }, []);

  // Poll status when tunnel is up
  useEffect(() => {
    if (!available) return;
    const interval = setInterval(() => {
      statusRpc({ interface: ifRef.current }).then((result: any) => {
        if (result && !result.error) {
          setStatus(result as WireGuardStatus);
        } else {
          setStatus(null);
        }
      }).catch(() => setStatus(null));
    }, 5000);
    return () => clearInterval(interval);
  }, [available, statusRpc]);

  const up = useCallback(async (config: WireGuardConfig): Promise<boolean> => {
    setError(null);
    const result: any = await upRpc({ ...config, interface: ifRef.current });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    // Fetch initial status
    const s: any = await statusRpc({ interface: ifRef.current });
    if (s && !s.error) setStatus(s as WireGuardStatus);
    return true;
  }, [upRpc, statusRpc]);

  const down = useCallback(async (): Promise<boolean> => {
    const result: any = await downRpc({ interface: ifRef.current });
    setStatus(null);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, [downRpc]);

  const addPeer = useCallback(async (peer: WireGuardPeerConfig): Promise<boolean> => {
    const result: any = await addPeerRpc({ ...peer, interface: ifRef.current });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, [addPeerRpc]);

  const removePeer = useCallback(async (publicKey: string): Promise<boolean> => {
    const result: any = await removePeerRpc({ interface: ifRef.current, publicKey });
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    return true;
  }, [removePeerRpc]);

  const generateKeys = useCallback(async (): Promise<KeyPair> => {
    return await genKeysRpc({}) as KeyPair;
  }, [genKeysRpc]);

  return {
    available,
    hasPrivilege,
    status,
    up,
    down,
    addPeer,
    removePeer,
    generateKeys,
    error,
  };
}

// ============================================================================
// usePeerTunnel — Tier 2: Userspace encrypted P2P
// ============================================================================

/**
 * Encrypted P2P data channel over UDP using X25519 + XChaCha20-Poly1305.
 * No root needed, no system deps beyond libsodium. Works everywhere Love2D runs.
 *
 * Same crypto primitives as WireGuard but application-layer only — keys live
 * in process memory. For kernel-level isolation, use useWireGuard() instead.
 *
 * @example
 * const tunnel = usePeerTunnel({
 *   privateKey: myKey,
 *   stunServer: 'stun.l.google.com',
 *   stunPort: 19302,
 * });
 *
 * // After signaling exchange:
 * tunnel.addPeer(theirPublicKey, '1.2.3.4:9000');
 *
 * // Send encrypted data
 * tunnel.send(theirPublicKey, 'hello');
 *
 * // Receive
 * useEffect(() => {
 *   if (tunnel.lastMessage) {
 *     console.log(tunnel.lastMessage.publicKey, tunnel.lastMessage.data);
 *   }
 * }, [tunnel.lastMessage]);
 */
export function usePeerTunnel(config: PeerTunnelConfig | null): UsePeerTunnelResult {
  const [ready, setReady] = useState(false);
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [lastMessage, setLastMessage] = useState<PeerMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tunnelIdRef = useRef<number | null>(null);

  const createRpc = useLoveRPC('peer_tunnel:create');
  const addPeerRpc = useLoveRPC('peer_tunnel:add_peer');
  const setEndpointRpc = useLoveRPC('peer_tunnel:set_endpoint');
  const sendRpc = useLoveRPC('peer_tunnel:send');
  const broadcastRpc = useLoveRPC('peer_tunnel:broadcast');
  const removePeerRpc = useLoveRPC('peer_tunnel:remove_peer');
  const infoRpc = useLoveRPC('peer_tunnel:info');
  const destroyRpc = useLoveRPC('peer_tunnel:destroy');

  // Create tunnel on mount
  useEffect(() => {
    if (!config) {
      setReady(false);
      setTunnelInfo(null);
      setPeers([]);
      setError(null);
      return;
    }

    createRpc(config).then((result: any) => {
      if (result && result.tunnelId) {
        tunnelIdRef.current = result.tunnelId;
        setTunnelInfo(result as TunnelInfo);
        setReady(true);
      } else {
        setError(result?.error ?? 'Failed to create tunnel');
      }
    }).catch((err: any) => setError(String(err)));

    return () => {
      if (tunnelIdRef.current !== null) {
        destroyRpc({ tunnelId: tunnelIdRef.current }).catch(() => {});
        tunnelIdRef.current = null;
        setReady(false);
        setTunnelInfo(null);
        setPeers([]);
      }
    };
  }, [config?.privateKey]);

  // Listen for tunnel events
  useLoveEvent('peer_tunnel', (payload: any) => {
    if (!tunnelIdRef.current) return;
    if (payload.tunnelId !== tunnelIdRef.current) return;

    switch (payload.type) {
      case 'peer:ready':
        setPeers(prev => {
          const existing = prev.find(p => p.publicKey === payload.publicKey);
          if (existing) {
            return prev.map(p => p.publicKey === payload.publicKey
              ? { ...p, state: 'established' as const, endpoint: payload.endpoint }
              : p);
          }
          return [...prev, {
            publicKey: payload.publicKey,
            endpoint: payload.endpoint,
            state: 'established' as const,
            lastSeen: Date.now(),
          }];
        });
        break;

      case 'peer:message':
        setLastMessage({ publicKey: payload.publicKey, data: payload.data });
        break;

      case 'peer:error':
        setError(`Peer ${payload.publicKey.slice(0, 8)}...: ${payload.error}`);
        break;

      case 'stun:resolved':
        setTunnelInfo(prev => prev ? {
          ...prev,
          publicIP: payload.publicIP,
          publicPort: payload.publicPort,
          publicEndpoint: `${payload.publicIP}:${payload.publicPort}`,
        } : prev);
        break;

      case 'stun:error':
        setError(`STUN: ${payload.error}`);
        break;
    }
  });

  // Poll tunnel info periodically for peer state updates
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      if (tunnelIdRef.current === null) return;
      infoRpc({ tunnelId: tunnelIdRef.current }).then((result: any) => {
        if (result && result.peers) {
          setPeers(result.peers as PeerInfo[]);
          setTunnelInfo(result as TunnelInfo);
        }
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [ready, infoRpc]);

  const addPeer = useCallback((publicKey: string, endpoint?: string) => {
    if (tunnelIdRef.current === null) return;
    addPeerRpc({ tunnelId: tunnelIdRef.current, publicKey, endpoint }).catch(
      (err: any) => setError(String(err))
    );
    setPeers(prev => [...prev, {
      publicKey,
      endpoint,
      state: endpoint ? 'handshaking' as const : 'waiting' as const,
      lastSeen: 0,
    }]);
  }, [addPeerRpc]);

  const send = useCallback((publicKey: string, data: string) => {
    if (tunnelIdRef.current === null) return;
    sendRpc({ tunnelId: tunnelIdRef.current, publicKey, data }).catch(
      (err: any) => setError(String(err))
    );
  }, [sendRpc]);

  const broadcast = useCallback((data: string) => {
    if (tunnelIdRef.current === null) return;
    broadcastRpc({ tunnelId: tunnelIdRef.current, data }).catch(
      (err: any) => setError(String(err))
    );
  }, [broadcastRpc]);

  const removePeer = useCallback((publicKey: string) => {
    if (tunnelIdRef.current === null) return;
    removePeerRpc({ tunnelId: tunnelIdRef.current, publicKey }).catch(() => {});
    setPeers(prev => prev.filter(p => p.publicKey !== publicKey));
  }, [removePeerRpc]);

  return {
    ready,
    tunnelInfo,
    peers,
    send,
    broadcast,
    addPeer,
    removePeer,
    lastMessage,
    error,
  };
}
