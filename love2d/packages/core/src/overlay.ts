import { useState, useEffect, useCallback, useRef } from 'react';
import { useBridge } from './context';

export type OverlayMode = 'interactive' | 'passthrough' | 'hidden';

export interface OverlayState {
  enabled: boolean;
  mode: OverlayMode;
  opacity: number;
  hotkey: string;
  hasX11: boolean;
  setMode: (mode: OverlayMode) => void;
  setOpacity: (opacity: number) => void;
  toggle: () => void;
}

const POLL_INTERVAL = 500;

export function useOverlay(): OverlayState {
  const bridge = useBridge();
  const [state, setState] = useState({
    enabled: false,
    mode: 'passthrough' as OverlayMode,
    opacity: 0.9,
    hotkey: 'f6',
    hasX11: false,
  });
  const rpcRef = useRef(bridge.rpc.bind(bridge));

  // rjit-ignore-next-line — Dep-driven: syncs rpcRef when bridge changes
  useEffect(() => {
    rpcRef.current = bridge.rpc.bind(bridge);
  }, [bridge]);

  // rjit-ignore-next-line — Mount-once polling for overlay state (setInterval should migrate to useLuaInterval)
  useEffect(() => {
    const poll = () => {
      rpcRef.current('overlay:state', {}).then((result: any) => {
        if (result && result.enabled) {
          setState({
            enabled: result.enabled,
            mode: result.mode,
            opacity: result.opacity,
            hotkey: result.hotkey,
            hasX11: result.hasX11,
          });
        }
      }).catch(() => {});
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const setMode = useCallback((mode: OverlayMode) => {
    bridge.rpc('overlay:setMode', { mode });
  }, [bridge]);

  const setOpacity = useCallback((opacity: number) => {
    bridge.rpc('overlay:setOpacity', { opacity });
  }, [bridge]);

  const toggle = useCallback(() => {
    bridge.rpc('overlay:toggle', {});
  }, [bridge]);

  return { ...state, setMode, setOpacity, toggle };
}
