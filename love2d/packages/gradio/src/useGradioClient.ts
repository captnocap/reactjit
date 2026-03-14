/**
 * useGradioClient — Hook that manages communication with a Gradio server.
 *
 * Uses the fetch() polyfill which routes through Lua's http.lua workers.
 * Responses arrive via pushEvent → http:response → NativeBridge subscriber,
 * which properly triggers React re-renders through the event dispatch path.
 */

import { useState, useCallback, useRef } from 'react';
import { useMount } from '@reactjit/core';
import type {
  GradioConfig,
  GradioComponentState,
  GradioDependency,
} from './types';

interface GradioClient {
  config: GradioConfig | null;
  components: Map<number, GradioComponentState>;
  loading: boolean;
  error: string | null;
  setValue: (id: number, value: any) => void;
  trigger: (componentId: number, eventName: string) => void;
  isPredicting: (fnIndex: number) => boolean;
}

function generateSessionHash(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 12; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

function resolveValue(val: any, baseUrl: string): any {
  if (val && typeof val === 'object' && val.url) {
    const fileUrl: string = val.url;
    if (fileUrl.startsWith('http')) return fileUrl;
    return `${baseUrl}${fileUrl}`;
  }
  return val;
}

export function useGradioClient(
  url: string,
  options?: {
    apiKey?: string;
    sessionHash?: string;
    onConfigLoaded?: (config: GradioConfig) => void;
    onPrediction?: (fnIndex: number, data: any[]) => void;
  },
): GradioClient {
  const baseUrl = url.replace(/\/$/, '');

  const [config, setConfig] = useState<GradioConfig | null>(null);
  const [components, setComponents] = useState<Map<number, GradioComponentState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predicting, setPredicting] = useState<Set<number>>(new Set());

  const sessionHash = useRef(options?.sessionHash ?? generateSessionHash());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Fetch config on mount via fetch() polyfill ──────────────

  useMount(() => {
    const configUrl = `${baseUrl}/config`;
    console.log('[gradio] Fetching config:', configUrl);

    fetch(configUrl)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((rawConfig: GradioConfig) => {
        console.log('[gradio] Config loaded:', rawConfig.components?.length, 'components');

        rawConfig.root = baseUrl;
        const comps = new Map<number, GradioComponentState>();
        for (const comp of rawConfig.components) {
          comps.set(comp.id, {
            id: comp.id,
            type: comp.type,
            value: comp.props.value ?? null,
            props: comp.props,
            loading: false,
            error: null,
          });
        }

        setConfig(rawConfig);
        setComponents(comps);
        setLoading(false);
        optionsRef.current?.onConfigLoaded?.(rawConfig);
      })
      .catch((err: any) => {
        console.log('[gradio] Config fetch error:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  });

  // ── Set value (user input) ────────────────────────────

  const setValue = useCallback((id: number, value: any) => {
    setComponents(prev => {
      const next = new Map(prev);
      const comp = next.get(id);
      if (comp) next.set(id, { ...comp, value });
      return next;
    });
  }, []);

  // ── Find dependencies (v6 format) ─────────────────────

  const findDeps = useCallback((
    componentId: number,
    eventName: string,
    cfg: GradioConfig,
  ): GradioDependency[] => {
    return cfg.dependencies.filter(dep => {
      if (Array.isArray(dep.targets)) {
        return dep.targets.some(t => {
          if (Array.isArray(t)) return t[0] === componentId && t[1] === eventName;
          return t === componentId && dep.trigger === eventName;
        });
      }
      return false;
    });
  }, []);

  // ── Execute prediction (v6 event-based protocol) ──────

  const executePrediction = useCallback(async (
    dep: GradioDependency,
    fnIndex: number,
    comps: Map<number, GradioComponentState>,
    root: string,
    apiPrefix: string,
  ) => {
    const inputData = dep.inputs.map(id => {
      const comp = comps.get(id);
      return comp?.value ?? null;
    });

    // Mark outputs as loading
    setPredicting(prev => { const s = new Set(prev); s.add(fnIndex); return s; });
    setComponents(prev => {
      const next = new Map(prev);
      for (const outId of dep.outputs) {
        const comp = next.get(outId);
        if (comp) next.set(outId, { ...comp, loading: true, error: null });
      }
      return next;
    });

    try {
      const apiName = dep.api_name ?? 'predict';
      const callUrl = `${root}${apiPrefix}/call/${apiName}`;

      // Step 1: POST to get event_id
      const callRes = await fetch(callUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: inputData,
          session_hash: sessionHash.current,
        }),
      });

      if (!callRes.ok) {
        throw new Error(`POST failed: HTTP ${callRes.status}`);
      }

      const callBody = await callRes.json();
      const eventId = callBody.event_id;

      // Step 2: GET SSE stream for result
      const streamUrl = `${callUrl}/${eventId}`;
      const streamRes = await fetch(streamUrl);

      if (!streamRes.ok) {
        throw new Error(`Stream failed: HTTP ${streamRes.status}`);
      }

      const text = await streamRes.text();

      // Parse SSE events
      let resultData: any[] = [];
      const lines = text.split('\n');
      let foundComplete = false;
      for (const line of lines) {
        if (line.startsWith('event: complete')) {
          foundComplete = true;
        } else if (foundComplete && line.startsWith('data: ')) {
          try { resultData = JSON.parse(line.slice(6)); } catch {}
          break;
        } else if (line.startsWith('event: error')) {
          foundComplete = false;
          const idx = lines.indexOf(line) + 1;
          if (idx < lines.length && lines[idx].startsWith('data: ')) {
            throw new Error(lines[idx].slice(6));
          }
        }
      }

      const resolvedData = resultData.map(v => resolveValue(v, root));

      // Update outputs
      setPredicting(prev => { const s = new Set(prev); s.delete(fnIndex); return s; });
      setComponents(prev => {
        const next = new Map(prev);
        dep.outputs.forEach((outId, i) => {
          const comp = next.get(outId);
          if (comp) {
            next.set(outId, {
              ...comp,
              value: i < resolvedData.length ? resolvedData[i] : comp.value,
              loading: false,
              error: null,
            });
          }
        });
        return next;
      });

      optionsRef.current?.onPrediction?.(fnIndex, resolvedData);
    } catch (err) {
      setPredicting(prev => { const s = new Set(prev); s.delete(fnIndex); return s; });
      setComponents(prev => {
        const next = new Map(prev);
        for (const outId of dep.outputs) {
          const comp = next.get(outId);
          if (comp) {
            next.set(outId, {
              ...comp,
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return next;
      });
    }
  }, []);

  // ── Trigger ───────────────────────────────────────────

  const trigger = useCallback((componentId: number, eventName: string) => {
    if (!config) return;
    const deps = findDeps(componentId, eventName, config);
    const root = config.root ?? baseUrl;
    const apiPrefix = config.api_prefix ?? '/gradio_api';

    for (const dep of deps) {
      if (dep.backend_fn === false) continue;
      const fnIndex = config.dependencies.indexOf(dep);
      executePrediction(dep, fnIndex, components, root, apiPrefix);
    }
  }, [config, components, baseUrl, findDeps, executePrediction]);

  const isPredicting = useCallback((fnIndex: number) => {
    return predicting.has(fnIndex);
  }, [predicting]);

  return {
    config,
    components,
    loading,
    error,
    setValue,
    trigger,
    isPredicting,
  };
}
