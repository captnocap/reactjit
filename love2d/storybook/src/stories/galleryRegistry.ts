/**
 * galleryRegistry.ts — Single-point registration for the Component Gallery.
 *
 * Instead of maintaining 3 parallel data structures (TABS, THUMBS, PREVIEWS),
 * each component calls register() once with all its metadata + visuals.
 * GalleryStory just calls getAll() to get everything.
 *
 * Usage (in GalleryComponents.tsx or any file):
 *   import { register } from './galleryRegistry';
 *   register({
 *     id: 'card', label: 'Card', pkg: 'core',
 *     desc: 'Container with title...',
 *     usage: `<Card title="Settings">...</Card>`,
 *     props: [['title', 'string']],
 *     callbacks: [],
 *     thumb: (c) => <ThumbCard c={c} />,
 *     preview: (c) => <PreviewCard c={c} />,
 *   });
 */

import type React from 'react';

export interface GalleryEntry {
  id: string;
  label: string;
  pkg: string;
  desc: string;
  usage: string;
  props: [string, string][];
  callbacks: [string, string][];
  thumb: (c: Record<string, string>) => React.ReactNode;
  preview: (c: Record<string, string>) => React.ReactNode;
}

const registry: GalleryEntry[] = [];
const ids = new Set<string>();

export function register(entry: GalleryEntry): void {
  if (ids.has(entry.id)) return; // idempotent — safe to re-require
  ids.add(entry.id);
  registry.push(entry);
}

export function getAll(): GalleryEntry[] {
  return registry;
}

/** Package color mapping — shared between gallery and thumbnails */
export const PKG_COLORS: Record<string, string | undefined> = {
  core: undefined,
  controls: '#f59e0b',
  chemistry: '#10b981',
  finance: '#3b82f6',
  time: '#06b6d4',
  ai: '#ec4899',
  data: '#a855f7',
  apis: '#f97316',
};
