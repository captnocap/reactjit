/**
 * Shared React hooks for Love2D communication.
 * These consume IBridge via context — they work identically
 * whether the transport is Module.FS (web) or QuickJS FFI (native).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useBridge } from './context';
import type { LoveEvent } from './types';

/**
 * Returns the current window/viewport dimensions.
 * Updates reactively on window resize.
 *
 * @example
 * const { width, height } = useWindowDimensions();
 * const isWide = width > 800;
 */
// Cache last known viewport so remounts (e.g. tab switches) pick it up
// instantly without waiting for a new resize event from Lua.
let _lastViewport = { width: 0, height: 0 };

export function useWindowDimensions(): { width: number; height: number } {
  const bridge = useBridge();
  const [dims, setDims] = useState(_lastViewport);

  useEffect(() => {
    return bridge.subscribe('viewport', (payload: { width: number; height: number }) => {
      _lastViewport = payload;
      setDims(payload);
    });
  }, [bridge]);

  return dims;
}

/**
 * Declaratively set the main window size from a component.
 * When the component mounts (or width/height change), the window resizes.
 *
 * @example
 * useWindowSize(800, 600);
 * useWindowSize(800, 600, { animate: true });
 * useWindowSize(800, 600, { animate: true, duration: 500 });
 * useWindowSize(800, 600, { revert: true });
 */
export function useWindowSize(
  width: number,
  height: number,
  options?: { animate?: boolean; duration?: number; revert?: boolean },
): void {
  const bridge = useBridge();
  const animate = options?.animate ?? false;
  const duration = options?.duration;
  const revert = options?.revert ?? false;

  useEffect(() => {
    let prevSize: { width: number; height: number } | null = null;
    if (revert) {
      prevSize = { ..._lastViewport };
    }

    bridge.rpc('window:setSize', { width, height, animate, duration });

    return () => {
      if (revert && prevSize) {
        bridge.rpc('window:setSize', {
          width: prevSize.width,
          height: prevSize.height,
          animate,
          duration,
        });
      }
    };
  }, [bridge, width, height, animate, duration, revert]);
}

/**
 * Subscribe to a Love2D event and get a send function.
 *
 * @example
 * const [gameState, send] = useLove('game:state', { ready: false });
 * send('player:move', { x: 100, y: 200 });
 */
export function useLove<T>(
  eventType: string,
  initialState: T
): [T, (cmd: string, payload?: any) => void] {
  const bridge = useBridge();
  const [state, setState] = useState<T>(initialState);

  useEffect(() => {
    return bridge.subscribe(eventType, (payload: T) => setState(payload));
  }, [bridge, eventType]);

  const send = useCallback(
    (cmd: string, payload?: any) => bridge.send(cmd, payload),
    [bridge]
  );

  return [state, send];
}

/**
 * Fire-and-forget event listener.
 *
 * @example
 * useLoveEvent('entity:spawned', (data) => console.log('Spawned:', data));
 */
export function useLoveEvent(
  eventType: string,
  handler: (payload: any) => void
) {
  const bridge = useBridge();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return bridge.subscribe(eventType, (payload) =>
      handlerRef.current(payload)
    );
  }, [bridge, eventType]);
}

/**
 * Call a Lua RPC method, await the result.
 *
 * @example
 * const getNearby = useLoveRPC<Entity[]>('getNearby');
 * const nearby = await getNearby({ x: 100, y: 200, range: 500 });
 */
export function useLoveRPC<T = any>(method: string) {
  const bridge = useBridge();
  return useCallback(
    (args?: any, timeoutMs?: number) =>
      bridge.rpc<T>(method, args, timeoutMs),
    [bridge, method]
  );
}

/**
 * Bidirectional shared state between React and Lua.
 *
 * @example
 * const [health, setHealth] = useLoveState('player.health', 100);
 */
export function useLoveState<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const bridge = useBridge();
  const [value, setLocal] = useState<T>(initialValue);

  useEffect(() => {
    return bridge.subscribe(`state:${key}`, (payload: T) =>
      setLocal(payload)
    );
  }, [bridge, key]);

  const setValue = useCallback(
    (newValue: T) => {
      setLocal(newValue);
      bridge.setState(key, newValue);
    },
    [bridge, key]
  );

  return [value, setValue];
}

/**
 * Returns true when the Love2D bridge is initialized and ready.
 */
export function useLoveReady(): boolean {
  const bridge = useBridge();
  const [ready, setReady] = useState(bridge.isReady());

  useEffect(() => {
    if (!ready) bridge.onReady(() => setReady(true));
  }, [bridge, ready]);

  return ready;
}

/**
 * Returns just the send function for fire-and-forget commands.
 */
export function useLoveSend() {
  const bridge = useBridge();
  return useCallback(
    (type: string, payload?: any) => bridge.send(type, payload),
    [bridge]
  );
}

/**
 * Fetch data from a URL or local file path with loading/error state.
 * Works across all targets — in Love2D it uses the fetch() polyfill
 * which routes to LuaSocket (HTTP) or love.filesystem (local files).
 *
 * @example
 * const { data, loading, error } = useFetch<User[]>('https://api.example.com/users');
 * const { data: config } = useFetch<Config>('data/config.json');
 */
export function useFetch<T = any>(
  url: string | null,
  options?: RequestInit
): { data: T | null; error: Error | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(url != null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (url == null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url, optionsRef.current)
      .then((res: any) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: T) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  return { data, error, loading };
}

/**
 * Persistent WebSocket connection with auto-reconnect.
 * Works across all targets — in Love2D it uses the WebSocket polyfill
 * which routes to lua-websocket via the bridge.
 *
 * @example
 * const { status, send, lastMessage, error } = useWebSocket('ws://localhost:9050');
 * send('hello');
 */
export type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket(
  url: string | null
): {
  status: WebSocketStatus;
  send: (data: string) => void;
  lastMessage: string | null;
  error: string | null;
} {
  const [status, setStatus] = useState<WebSocketStatus>(url ? 'connecting' : 'closed');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus('closed');
      setLastMessage(null);
      setError(null);
      return;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');
    setError(null);

    ws.onopen = () => setStatus('open');
    ws.onmessage = (e: any) => setLastMessage(typeof e.data === 'string' ? e.data : String(e.data));
    ws.onerror = (e: any) => {
      setError(e.message || 'WebSocket error');
      setStatus('error');
    };
    ws.onclose = () => setStatus('closed');

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [url]);

  const send = useCallback((data: string) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(data);
    }
  }, []);

  return { status, send, lastMessage, error };
}

/**
 * Host a WebSocket server for P2P connections.
 * Peers connect to this server, and messages can be sent/broadcast to them.
 *
 * @example
 * const server = usePeerServer(8080);
 * // server.peers — connected client IDs
 * // server.broadcast('hello') — send to all
 * // server.send(clientId, 'hi') — send to one
 * // server.lastMessage — { clientId, data }
 */
export interface PeerMessage {
  clientId: number;
  data: string;
}

export function usePeerServer(
  port: number | null
): {
  ready: boolean;
  peers: number[];
  broadcast: (data: string) => void;
  send: (clientId: number, data: string) => void;
  lastMessage: PeerMessage | null;
  error: string | null;
} {
  const [ready, setReady] = useState(false);
  const [peers, setPeers] = useState<number[]>([]);
  const [lastMessage, setLastMessage] = useState<PeerMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const serverIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (port == null) {
      setReady(false);
      setPeers([]);
      setLastMessage(null);
      setError(null);
      return;
    }

    const serverId = 'server_' + port + '_' + Date.now();
    serverIdRef.current = serverId;

    const g = globalThis as any;
    if (!g.__wsListen) return;

    g.__wsListen(serverId, port, {
      onready: () => setReady(true),
      onerror: (evt: any) => setError(evt.error || 'Server error'),
      onconnect: (clientId: number) => {
        setPeers(prev => [...prev, clientId]);
      },
      onmessage: (clientId: number, data: string) => {
        setLastMessage({ clientId, data });
      },
      ondisconnect: (clientId: number) => {
        setPeers(prev => prev.filter(id => id !== clientId));
      },
    });

    return () => {
      if (g.__wsStopServer) {
        g.__wsStopServer(serverId);
      }
      serverIdRef.current = null;
    };
  }, [port]);

  const broadcast = useCallback((data: string) => {
    const g = globalThis as any;
    if (serverIdRef.current && g.__wsBroadcast) {
      g.__wsBroadcast(serverIdRef.current, data);
    }
  }, []);

  const send = useCallback((clientId: number, data: string) => {
    const g = globalThis as any;
    if (serverIdRef.current && g.__wsSendToClient) {
      g.__wsSendToClient(serverIdRef.current, clientId, data);
    }
  }, []);

  return { ready, peers, broadcast, send, lastMessage, error };
}

/**
 * Position DOM overlays based on Love2D entity coordinates.
 * Only meaningful in web mode where React controls the DOM.
 */
export interface Overlay {
  id: string;
  nx: number;
  ny: number;
  px: number;
  py: number;
  domX?: number;
  domY?: number;
  [key: string]: any;
}

export function useLoveOverlays(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): Overlay[] {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(() => {
      if (canvasRef.current)
        setRect(canvasRef.current.getBoundingClientRect());
    });
    observer.observe(canvasRef.current);
    setRect(canvasRef.current.getBoundingClientRect());
    return () => observer.disconnect();
  }, [canvasRef.current]);

  useLoveEvent('overlays', (data: Overlay[]) => setOverlays(data));

  if (!rect) return [];

  return overlays.map((o) => ({
    ...o,
    domX: o.nx * rect.width,
    domY: o.ny * rect.height,
  }));
}

// ── Hotkey combo parser ──────────────────────────────────────

interface ParsedCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split('+').map(s => s.trim());
  const result: ParsedCombo = { ctrl: false, shift: false, alt: false, meta: false, key: '' };

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') result.ctrl = true;
    else if (part === 'shift') result.shift = true;
    else if (part === 'alt') result.alt = true;
    else if (part === 'meta' || part === 'cmd' || part === 'gui') result.meta = true;
    else result.key = part;
  }

  return result;
}

function matchesCombo(event: LoveEvent, parsed: ParsedCombo): boolean {
  if (!!event.ctrl !== parsed.ctrl) return false;
  if (!!event.shift !== parsed.shift) return false;
  if (!!event.alt !== parsed.alt) return false;
  if (!!event.meta !== parsed.meta) return false;
  return (event.key ?? '').toLowerCase() === parsed.key;
}

/**
 * Register a global keyboard shortcut.
 * Works even when a TextEditor is focused (for unhandled combos like Ctrl+Z).
 *
 * @example
 * useHotkey('ctrl+z', () => undo());
 * useHotkey('ctrl+shift+s', () => saveAs());
 * useHotkey('escape', () => close(), { enabled: isOpen });
 */
export function useHotkey(
  combo: string,
  handler: (event: LoveEvent) => void,
  options?: { enabled?: boolean },
): void {
  const bridge = useBridge();
  const parsed = useMemo(() => parseCombo(combo), [combo]);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    return bridge.subscribe('keydown', (payload: LoveEvent) => {
      if (matchesCombo(payload, parsed)) {
        handlerRef.current(payload);
      }
    });
  }, [bridge, parsed, enabled]);
}

/**
 * Read/write the system clipboard.
 * Returns copy/paste functions and a `copied` feedback boolean.
 *
 * @example
 * const { copy, paste, copied } = useClipboard();
 * <Pressable onPress={() => copy(text)}>
 *   <Text fontSize={14}>{copied ? 'Copied!' : 'Copy'}</Text>
 * </Pressable>
 */
export function useClipboard(): {
  copy: (text: string) => Promise<void>;
  paste: () => Promise<string>;
  copied: boolean;
} {
  const bridge = useBridge();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (text: string) => {
    await bridge.rpc('clipboard:write', { text });
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [bridge]);

  const paste = useCallback(async (): Promise<string> => {
    return bridge.rpc<string>('clipboard:read');
  }, [bridge]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { copy, paste, copied };
}
