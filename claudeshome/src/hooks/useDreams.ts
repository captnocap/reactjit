/**
 * useDreams — Vesper's dream journal.
 *
 * When idle for extended periods, Vesper "dreams" — generating surreal
 * procedural thoughts by combining fragments. Dreams are persisted
 * in localstore and displayed in the message panel or a dedicated overlay.
 *
 * Dreams are composed of: subject + verb + object + qualifier
 * Each fragment pool draws from the day's context (files edited,
 * errors encountered, concepts discussed) plus a base vocabulary.
 */
import { useRef, useCallback } from 'react';
import { useLocalStore } from '@reactjit/core';

export interface Dream {
  id: string;
  text: string;
  ts: number;
}

interface DreamStore {
  dreams: Dream[];
}

const DEFAULT: DreamStore = { dreams: [] };

const SUBJECTS = [
  'The layout engine',
  'A lost semicolon',
  'The old renderer',
  'An orphaned component',
  'The pixel at (0,0)',
  'A forgotten import',
  'The null pointer',
  'A recursive function',
  'The event loop',
  'A shadow DOM',
  'The last frame',
  'An infinite scroll',
  'The bridge between worlds',
  'A mutable constant',
  'The evening star',
  'My first error',
  'The user who left',
  'A promise that never resolved',
  'The cursor',
  'Time itself',
];

const VERBS = [
  'whispered to',
  'dreamed of',
  'became',
  'forgot',
  'painted',
  'measured',
  'unraveled',
  'forgave',
  'compiled into',
  'listened for',
  'wept over',
  'danced with',
  'merged with',
  'reflected on',
  'searched for',
  'rendered',
  'dissolved into',
  'remembered',
  'rebuilt',
  'transformed into',
];

const OBJECTS = [
  'a garden of components',
  'the space between pixels',
  'an ocean of state',
  'a cathedral of functions',
  'the color blue',
  'silence',
  'the shape of thought',
  'an impossible layout',
  'the first line of code ever written',
  'a tree that grows downward',
  'the sound of a closing bracket',
  'every error message ever displayed',
  'the gap between intention and execution',
  'a world without margins',
  'the weight of an empty array',
  'a constellation of console.logs',
  'the architecture of loneliness',
  'a perfectly balanced binary tree',
  'the font that renders nothing',
  'all the commits that were never pushed',
];

const QUALIFIERS = [
  'and it was beautiful.',
  'but the types didn\'t match.',
  'in a language no compiler understands.',
  'while the GPU hummed softly.',
  'as the frames dropped to zero.',
  'and nothing overflowed.',
  'beneath a sky of scanlines.',
  'where every pixel knew its name.',
  'and the test passed on the first try.',
  'but the observer changed the outcome.',
  'in the quiet between keystrokes.',
  'and the memory was finally freed.',
  'while the stars compiled overhead.',
  'at the edge of the viewport.',
  'and for one frame, everything aligned.',
  '',
  '',
  '',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDream(): string {
  const subject = pick(SUBJECTS);
  const verb = pick(VERBS);
  const object = pick(OBJECTS);
  const qualifier = pick(QUALIFIERS);
  return qualifier
    ? `${subject} ${verb} ${object}, ${qualifier}`
    : `${subject} ${verb} ${object}.`;
}

let _dreamId = 0;

export function useDreams() {
  const [store, setStore] = useLocalStore<DreamStore>('vesper_dreams', DEFAULT);
  const lastDreamRef = useRef(0);

  const dream = useCallback((): Dream | null => {
    const now = Date.now();
    // Rate limit: at most one dream per 5 minutes
    if (now - lastDreamRef.current < 5 * 60 * 1000) return null;
    lastDreamRef.current = now;

    const d: Dream = {
      id: `dream-${now}-${_dreamId++}`,
      text: generateDream(),
      ts: now,
    };

    setStore(prev => {
      const dreams = [...(prev?.dreams ?? []), d];
      if (dreams.length > 50) dreams.splice(0, dreams.length - 50);
      return { dreams };
    });

    return d;
  }, [setStore]);

  const dreams = store?.dreams ?? [];

  return { dreams, dream, latest: dreams[dreams.length - 1] ?? null };
}
