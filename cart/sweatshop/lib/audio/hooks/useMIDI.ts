// useMIDI — initializes the MIDI bus on mount, exposes inputs/outputs and a
// subscribe handle for message-driven components.

const React: any = require('react');
const { useState, useEffect, useCallback } = React;

import { midiBus, type MidiMessage, type MidiPort } from '../midi';

export interface MIDIApi {
  ready: boolean;
  error: string | null;
  inputs: MidiPort[];
  outputs: MidiPort[];
  lastMessage: MidiMessage | null;
  subscribe: (fn: (m: MidiMessage, port: MidiPort) => void) => () => void;
  send: (portId: string, raw: number[]) => boolean;
  inject: (raw: number[]) => void;
}

export function useMIDI(autoInit: boolean = true): MIDIApi {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ports, setPorts] = useState<{ inputs: MidiPort[]; outputs: MidiPort[] }>({ inputs: [], outputs: [] });
  const [last, setLast] = useState<MidiMessage | null>(null);

  useEffect(() => {
    if (!autoInit) return;
    let cancelled = false;
    midiBus.init().then((res: { ok: boolean; reason?: string }) => {
      if (cancelled) return;
      setReady(res.ok);
      setError(res.ok ? null : (res.reason || 'midi unavailable'));
      setPorts({ inputs: midiBus.inputs.slice(), outputs: midiBus.outputs.slice() });
    });
    const unsub = midiBus.subscribe((m: MidiMessage) => {
      setLast(m);
      setPorts({ inputs: midiBus.inputs.slice(), outputs: midiBus.outputs.slice() });
    });
    return () => { cancelled = true; unsub(); };
  }, [autoInit]);

  const subscribe = useCallback((fn: (m: MidiMessage, port: MidiPort) => void) => midiBus.subscribe(fn), []);
  const send = useCallback((portId: string, raw: number[]) => midiBus.send(portId, raw), []);
  const inject = useCallback((raw: number[]) => midiBus.inject(raw), []);

  return {
    ready, error,
    inputs: ports.inputs, outputs: ports.outputs,
    lastMessage: last,
    subscribe, send, inject,
  };
}
