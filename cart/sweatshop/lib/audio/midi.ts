// MIDI I/O — thin wrapper over Web MIDI. Degrades to a no-op bus when the
// host doesn't expose navigator.requestMIDIAccess; synthetic events can still
// be pushed through the bus (fake keyboard -> listener chain).

export type MidiMessageKind = 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'program' | 'aftertouch' | 'clock' | 'start' | 'stop' | 'continue' | 'unknown';

export interface MidiMessage {
  kind: MidiMessageKind;
  channel: number;        // 0..15
  note?: number;          // noteOn/noteOff/aftertouch
  velocity?: number;      // 0..127
  cc?: number;            // controller number
  value?: number;         // controller value or raw value
  bend?: number;          // -1..1
  t: number;              // host timestamp ms
  raw: number[];
}

export interface MidiPort { id: string; name: string; manufacturer?: string; state: 'connected' | 'disconnected'; }

type Listener = (msg: MidiMessage, port: MidiPort) => void;

class MidiBus {
  private listeners = new Set<Listener>();
  inputs: MidiPort[] = [];
  outputs: MidiPort[] = [];
  access: any = null;

  async init(): Promise<{ ok: boolean; reason?: string }> {
    const g: any = globalThis as any;
    const nav = g.navigator;
    if (!nav || typeof nav.requestMIDIAccess !== 'function') {
      return { ok: false, reason: 'navigator.requestMIDIAccess unavailable' };
    }
    try {
      this.access = await nav.requestMIDIAccess({ sysex: false });
      this.refreshPorts();
      this.access.onstatechange = () => this.refreshPorts();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, reason: String(err && err.message || err) };
    }
  }

  private refreshPorts() {
    this.inputs = [];
    this.outputs = [];
    if (!this.access) return;
    this.access.inputs.forEach((p: any) => {
      this.inputs.push({ id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state });
      p.onmidimessage = (ev: any) => this.handle(ev.data, { id: p.id, name: p.name, state: p.state });
    });
    this.access.outputs.forEach((p: any) => {
      this.outputs.push({ id: p.id, name: p.name, manufacturer: p.manufacturer, state: p.state });
    });
  }

  private handle(raw: number[], port: MidiPort) {
    const msg = parseMessage(raw);
    this.listeners.forEach((fn) => { try { fn(msg, port); } catch (_) {} });
  }

  inject(raw: number[], port?: MidiPort) {
    const p = port || { id: 'virtual', name: 'virtual', state: 'connected' as const };
    this.handle(raw, p);
  }

  send(portId: string, raw: number[]) {
    if (!this.access) return false;
    let ok = false;
    this.access.outputs.forEach((p: any) => {
      if (p.id === portId) { try { p.send(raw); ok = true; } catch (_) {} }
    });
    return ok;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
}

export const midiBus = new MidiBus();

export function parseMessage(raw: number[]): MidiMessage {
  const status = raw[0] || 0;
  const cmd = status & 0xf0;
  const ch = status & 0x0f;
  const t = Date.now();
  if (cmd === 0x90 && (raw[2] ?? 0) > 0) return { kind: 'noteOn',  channel: ch, note: raw[1], velocity: raw[2], t, raw };
  if (cmd === 0x80 || cmd === 0x90)       return { kind: 'noteOff', channel: ch, note: raw[1], velocity: raw[2] || 0, t, raw };
  if (cmd === 0xb0)                        return { kind: 'cc',     channel: ch, cc: raw[1], value: raw[2], t, raw };
  if (cmd === 0xe0) {
    const v = ((raw[2] << 7) | raw[1]) - 8192;
    return { kind: 'pitchBend', channel: ch, bend: v / 8192, t, raw };
  }
  if (cmd === 0xc0)                        return { kind: 'program', channel: ch, value: raw[1], t, raw };
  if (cmd === 0xa0 || cmd === 0xd0)        return { kind: 'aftertouch', channel: ch, note: raw[1], value: raw[2], t, raw };
  if (status === 0xf8)                     return { kind: 'clock',    channel: 0, t, raw };
  if (status === 0xfa)                     return { kind: 'start',    channel: 0, t, raw };
  if (status === 0xfc)                     return { kind: 'stop',     channel: 0, t, raw };
  if (status === 0xfb)                     return { kind: 'continue', channel: 0, t, raw };
  return { kind: 'unknown', channel: ch, t, raw };
}

export function noteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}
