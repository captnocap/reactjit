import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface InspectorSettings {
  showTreeDiff: boolean;
  showGuideGutters: boolean;
  pollIntervalMs: number;
  logLevel: 'all' | 'log' | 'warn' | 'error';
}

const DEFAULTS: InspectorSettings = {
  showTreeDiff: true,
  showGuideGutters: true,
  pollIntervalMs: 250,
  logLevel: 'all',
};

interface InspectorCtx {
  settings: InspectorSettings;
  setSetting: <K extends keyof InspectorSettings>(key: K, value: InspectorSettings[K]) => void;
}

const Ctx = createContext<InspectorCtx | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<InspectorSettings>(DEFAULTS);

  const setSetting = useCallback(<K extends keyof InspectorSettings>(key: K, value: InspectorSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return <Ctx.Provider value={{ settings, setSetting }}>{children}</Ctx.Provider>;
}

export function useInspectorSettings(): InspectorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInspectorSettings must be inside InspectorProvider');
  return ctx;
}
