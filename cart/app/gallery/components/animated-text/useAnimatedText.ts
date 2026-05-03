import { useEffect, useMemo, useRef, useState } from 'react';

function useRafTime(running: boolean): number {
  const [t, setT] = useState(0);
  const rafRef = useRef<any>(null);
  useEffect(() => {
    if (!running) return;
    const g: any = globalThis;
    const raf = g.requestAnimationFrame ? (fn: any) => g.requestAnimationFrame(fn) : (fn: any) => setTimeout(fn, 16);
    const caf = g.cancelAnimationFrame || clearTimeout;
    const start = Date.now();
    const tick = () => {
      setT(Date.now() - start);
      rafRef.current = raf(tick);
    };
    rafRef.current = raf(tick);
    return () => { if (rafRef.current != null) { try { caf(rafRef.current); } catch {} } };
  }, [running]);
  return t;
}

export interface TypewriterOptions {
  cps?: number;
  startDelayMs?: number;
  loop?: boolean;
  loopHoldMs?: number;
  cursor?: string;
  cursorBlinkMs?: number;
}

export interface TypewriterResult {
  text: string;
  done: boolean;
  progress: number;
}

export function useTypewriter(target: string, opts: TypewriterOptions = {}): TypewriterResult {
  const cps = opts.cps ?? 24;
  const delay = opts.startDelayMs ?? 0;
  const loop = !!opts.loop;
  const hold = opts.loopHoldMs ?? 1200;
  const cursor = opts.cursor ?? '';
  const blink = opts.cursorBlinkMs ?? 500;

  const t = useRafTime(true);
  const startedAt = useRef(Date.now());
  useEffect(() => { startedAt.current = Date.now() + delay; }, [target, delay]);

  return useMemo(() => {
    const elapsed = Math.max(0, t - delay);
    const totalMs = (target.length / cps) * 1000;
    const cycleMs = totalMs + hold;
    const phase = loop ? elapsed % cycleMs : Math.min(elapsed, totalMs);
    const charsShown = Math.min(target.length, Math.floor((phase / 1000) * cps));
    const visible = target.slice(0, charsShown);
    const done = !loop && charsShown >= target.length;
    const showCursor = cursor && (done ? Math.floor(t / blink) % 2 === 0 : true);
    return {
      text: visible + (showCursor ? cursor : ''),
      done,
      progress: target.length === 0 ? 1 : charsShown / target.length,
    };
  }, [t, target, cps, delay, loop, hold, cursor, blink]);
}

export interface StreamingOptions {
  wordsPerSec?: number;
  jitter?: number;
  loop?: boolean;
  loopHoldMs?: number;
}

export function useStreamingText(target: string, opts: StreamingOptions = {}): string {
  const wps = opts.wordsPerSec ?? 6;
  const jitter = opts.jitter ?? 0.4;
  const loop = !!opts.loop;
  const hold = opts.loopHoldMs ?? 1500;

  const segments = useMemo(() => {
    const parts: string[] = [];
    const re = /(\s+|\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(target)) !== null) parts.push(m[0]);
    return parts;
  }, [target]);

  const wordIndices = useMemo(() => segments
    .map((s, i) => (/\S/.test(s) ? i : -1))
    .filter((i) => i >= 0), [segments]);

  const offsets = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    let seed = 1;
    for (let k = 0; k < wordIndices.length; k++) {
      seed = (seed * 9301 + 49297) % 233280;
      const r = seed / 233280;
      const base = 1000 / wps;
      const delta = base * (1 + (r - 0.5) * 2 * jitter);
      acc += Math.max(20, delta);
      out.push(acc);
    }
    return out;
  }, [wordIndices.length, wps, jitter]);

  const totalMs = offsets.length ? offsets[offsets.length - 1] : 0;
  const t = useRafTime(true);
  const elapsed = loop ? t % (totalMs + hold) : Math.min(t, totalMs);

  let revealedWords = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (elapsed >= offsets[i]) revealedWords = i + 1;
    else break;
  }
  if (revealedWords === 0) return '';
  const lastWordIdx = wordIndices[revealedWords - 1];
  return segments.slice(0, lastWordIdx + 1).join('');
}

export interface GradientWaveOptions {
  speed?: number;
  spread?: number;
  hueStart?: number;
  hueEnd?: number;
  saturation?: number;
  lightness?: number;
}

export interface GradientCharacter {
  ch: string;
  color: string;
  index: number;
}

export function useGradientWave(text: string, opts: GradientWaveOptions = {}): GradientCharacter[] {
  const speed = opts.speed ?? 1;
  const spread = opts.spread ?? 0.18;
  const hueStart = opts.hueStart ?? 280;
  const hueEnd = opts.hueEnd ?? 50;
  const sat = opts.saturation ?? 80;
  const light = opts.lightness ?? 65;

  const t = useRafTime(true);
  const phase = (t / 1000) * speed;

  return useMemo(() => {
    const out: GradientCharacter[] = [];
    for (let i = 0; i < text.length; i++) {
      const u = (Math.sin(i * spread - phase) + 1) / 2;
      const hue = hueStart + (hueEnd - hueStart) * u;
      out.push({ ch: text[i], color: `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`, index: i });
    }
    return out;
  }, [text, phase, spread, hueStart, hueEnd, sat, light]);
}

export interface ScrambleOptions {
  durationMs?: number;
  glyphs?: string;
  loop?: boolean;
  loopHoldMs?: number;
  scrambleChance?: number;
}

const DEFAULT_GLYPHS = '!@#$%^&*()_+-={}[]|:;<>,.?/~`abcdefghijklmnopqrstuvwxyz0123456789';

export function useScramble(target: string, opts: ScrambleOptions = {}): string {
  const dur = opts.durationMs ?? 1400;
  const glyphs = opts.glyphs ?? DEFAULT_GLYPHS;
  const loop = !!opts.loop;
  const hold = opts.loopHoldMs ?? 1600;
  const scrambleChance = opts.scrambleChance ?? 0.7;

  const t = useRafTime(true);
  const phase = loop ? t % (dur + hold) : Math.min(t, dur);
  const settleAt = useMemo(() => {
    const arr: number[] = [];
    let seed = 7;
    for (let i = 0; i < target.length; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      arr.push((seed / 233280) * dur);
    }
    return arr;
  }, [target, dur]);

  const tick = Math.floor(t / 60);
  return useMemo(() => {
    let out = '';
    let r = (tick * 2654435761) >>> 0;
    for (let i = 0; i < target.length; i++) {
      const ch = target[i];
      if (ch === ' ' || ch === '\n') { out += ch; continue; }
      if (phase >= settleAt[i]) { out += ch; continue; }
      r = (r * 1664525 + 1013904223) >>> 0;
      if (r / 0xffffffff < scrambleChance) {
        const g = (r >>> 8) % glyphs.length;
        out += glyphs[g];
      } else {
        out += ch;
      }
    }
    return out;
  }, [target, phase, settleAt, glyphs, scrambleChance, tick]);
}
