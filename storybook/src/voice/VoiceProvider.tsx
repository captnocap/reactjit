import React, { createContext, useState, useCallback, useEffect, useMemo, useContext } from 'react';
import { useBridgeOptional } from '../../../packages/core/src/context';

export type Voice = 'shitpost' | 'corpo';

interface VoiceContextValue {
  voice: Voice;
  setVoice: (v: Voice) => void;
  /** Pick text based on active voice: v('casual version', 'corporate version') */
  v: (shitpost: string, corpo: string) => string;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const bridge = useBridgeOptional();
  const [voice, setVoiceState] = useState<Voice>('shitpost');

  const setVoice = useCallback((v: Voice) => {
    setVoiceState(v);
    if (bridge) {
      bridge.rpc('localstore:set', { namespace: 'voice', key: 'selected', value: v }).catch(() => {});
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    bridge
      .rpc<string | null>('localstore:get', { namespace: 'voice', key: 'selected' })
      .then((stored) => {
        if (stored === 'shitpost' || stored === 'corpo') setVoiceState(stored);
      })
      .catch(() => {});
  }, [bridge]);

  const value = useMemo<VoiceContextValue>(() => ({
    voice,
    setVoice,
    v: (shitpost: string, corpo: string) => voice === 'shitpost' ? shitpost : corpo,
  }), [voice, setVoice]);

  return React.createElement(VoiceContext.Provider, { value }, children);
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a <VoiceProvider>');
  return ctx;
}
