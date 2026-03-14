import React, { createContext, useState, useContext } from 'react';
import { useBridgeOptional } from '../../../packages/core/src/context';
import { useMount } from '../../../packages/core/src';

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

  const setVoice = (v: Voice) => {
    setVoiceState(v);
    if (bridge) {
      bridge.rpc('localstore:set', { namespace: 'voice', key: 'selected', value: v }).catch(() => {});
    }
  };

  useMount(() => {
    if (!bridge) return;
    bridge
      .rpc<string | null>('localstore:get', { namespace: 'voice', key: 'selected' })
      .then((stored) => {
        if (stored === 'shitpost' || stored === 'corpo') setVoiceState(stored);
      })
      .catch(() => {});
  });

  const value: VoiceContextValue = {
    voice,
    setVoice,
    v: (shitpost: string, corpo: string) => voice === 'shitpost' ? shitpost : corpo,
  };

  return React.createElement(VoiceContext.Provider, { value }, children);
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a <VoiceProvider>');
  return ctx;
}
