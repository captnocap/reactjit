import React, { useState } from 'react';
import { SpotifyClone } from './SpotifyClone';
import { TwitterClone } from './TwitterClone';
import { SlackClone } from './SlackClone';
import { NotionClone } from './NotionClone';

const clones = [
  { id: 'spotify', label: 'Spotify', color: 'bg-green-500', Component: SpotifyClone },
  { id: 'twitter', label: 'Twitter/X', color: 'bg-blue-500', Component: TwitterClone },
  { id: 'slack', label: 'Slack', color: 'bg-purple-500', Component: SlackClone },
  { id: 'notion', label: 'Notion', color: 'bg-gray-100', Component: NotionClone },
];

export function App() {
  const [active, setActive] = useState<string | null>(null);

  if (active) {
    const clone = clones.find(c => c.id === active)!;
    return (
      <div className="w-full h-full">
        <button
          className="absolute top-2 right-2 z-50 px-3 py-1 bg-red-600 rounded-lg"
          onClick={() => setActive(null)}
        >
          <span className="text-white text-xs font-bold">{'✕ Back'}</span>
        </button>
        <clone.Component />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-950 items-center justify-center gap-8">
      <h1 className="text-white">{'Div Soup Stress Test'}</h1>
      <p className="text-gray-400 text-sm">
        {'8,000+ lines of React+Tailwind div soup. Written by AI agents with zero ReactJIT knowledge.'}
      </p>
      <div className="flex-row gap-4">
        {clones.map(c => (
          <button
            key={c.id}
            className={`${c.color} px-6 py-4 rounded-xl gap-1 items-center`}
            onClick={() => setActive(c.id)}
          >
            <span className={`font-bold text-lg ${c.id === 'notion' ? 'text-black' : 'text-white'}`}>
              {c.label}
            </span>
            <span className={`text-xs ${c.id === 'notion' ? 'text-gray-600' : 'text-white/70'}`}>
              {'2,000+ lines'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
