const React: any = require('react');
const { useState, useCallback } = React;

import { nanoGenerate, probeNanoDiffusion, type NanoParams } from '../lib/image-gen/nano';

export type NanoDiffusionState =
  | { kind: 'idle' }
  | { kind: 'generating'; progress: number }
  | { kind: 'done'; pngPath: string }
  | { kind: 'error'; message: string };

export function useNanoDiffusion() {
  const [state, setState] = useState<NanoDiffusionState>({ kind: 'idle' });
  const [installed, setInstalled] = useState<boolean | null>(null);

  const probe = useCallback(() => {
    const result = probeNanoDiffusion();
    setInstalled(result.found);
    return result;
  }, []);

  const generate = useCallback((params: NanoParams) => {
    setState({ kind: 'generating', progress: 0 });
    const result = nanoGenerate(params);

    if (result.error) {
      setState({ kind: 'error', message: result.error });
      return;
    }

    if (result.pngPath) {
      setState({ kind: 'done', pngPath: result.pngPath });
    } else {
      setState({ kind: 'error', message: 'No image returned' });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  return { state, installed, probe, generate, reset };
}
