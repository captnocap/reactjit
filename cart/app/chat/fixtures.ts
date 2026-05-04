// v1 mock turns — directly transcribed from the concept-art panels.
// Replaced by real `useAssistantChat()` output once the connection
// router lands. Do not let this file grow into a content authoring
// surface; it's a fixture, not a CMS.

import type { AssistantTurn } from './types';

export const INITIAL_TURNS: AssistantTurn[] = [
  {
    id: 't1',
    author: 'asst',
    timestamp: '14:03:03',
    body: "yeah. i'll spin three readers — about 90s to first signal. want to kick it off, or configure first?",
    surface: {
      kind: 'audit',
      title: 'codebase audit',
      tag: 'READ-ONLY',
      command: '$ swarm audit --readers 3 --depth full',
      body: "i'll spin three readers. expect ~90s to first signal.",
      actions: [
        { id: 'run-audit',  label: 'run audit', primary: true },
        { id: 'configure',  label: 'configure' },
        { id: 'cancel',     label: 'cancel' },
      ],
    },
  },
  {
    id: 't2',
    author: 'user',
    timestamp: '14:03:30',
    body: 'show me the fleet first',
  },
  {
    id: 't3',
    author: 'asst',
    timestamp: '14:03:31',
    body: 'four active. frank-04 has been deviating from spec for six turns — probably worth killing before we audit.',
  },
  {
    id: 't4',
    author: 'asst',
    timestamp: '14:03:31',
    lift: true,
    body: '',
    surface: {
      kind: 'fleet',
      title: 'fleet · 4 active',
      members: [
        { id: 'frank-01', state: 'idle' },
        { id: 'frank-02', state: 'tool' },
        { id: 'frank-03', state: 'stuck' },
        { id: 'frank-04', state: 'rat' },
      ],
      note: 'frank-04 deviating for 6 turns. recommend kill.',
      actions: [
        { id: 'kill-frank-04', label: 'kill frank-04', primary: true },
        { id: 'inspect',       label: 'inspect' },
      ],
    },
  },
];
