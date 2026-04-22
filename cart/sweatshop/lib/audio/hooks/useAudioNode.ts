// useAudioNode — subscribes a single module to an AudioRackApi so controls
// (Knob, Fader, etc.) can write params without dragging the whole rack api
// through props. Returns a live view of the module + stable setters.

const React: any = require('react');
const { useMemo, useCallback } = React;

import type { AudioRackApi } from './useAudioRack';
import type { Module, ParamSpec } from '../types';

export interface AudioNodeApi {
  module: Module | null;
  params: ParamSpec[];
  set: (paramId: string, value: number | string | boolean) => void;
  get: (paramId: string, fallback?: any) => any;
  bypass: boolean;
  toggleBypass: () => void;
  remove: () => void;
  revision: number;
}

export function useAudioNode(rackApi: AudioRackApi, moduleId: string): AudioNodeApi {
  // revision in the key forces a recompute whenever the rack mutates.
  const module = useMemo(() => rackApi.rack.modules.find((m) => m.id === moduleId) || null,
    [rackApi.rack, rackApi.revision, moduleId]);

  const set = useCallback((paramId: string, value: number | string | boolean) => {
    rackApi.setParam(moduleId, paramId, value);
  }, [rackApi, moduleId]);

  const get = useCallback((paramId: string, fallback?: any) => {
    const m = rackApi.rack.modules.find((mm) => mm.id === moduleId);
    if (!m) return fallback;
    const v = m.values[paramId];
    if (v !== undefined) return v;
    const p = m.params.find((pp) => pp.id === paramId);
    return p ? p.defaultValue : fallback;
  }, [rackApi, moduleId]);

  const toggleBypass = useCallback(() => {
    const m = rackApi.rack.modules.find((mm) => mm.id === moduleId);
    if (!m) return;
    rackApi.setBypass(moduleId, !m.bypass);
  }, [rackApi, moduleId]);

  const remove = useCallback(() => rackApi.removeModule(moduleId), [rackApi, moduleId]);

  return {
    module,
    params: module ? module.params : [],
    set, get,
    bypass: !!module?.bypass,
    toggleBypass,
    remove,
    revision: rackApi.revision,
  };
}
