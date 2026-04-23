import type { ReactNode } from 'react';

export type GalleryStoryStatus = 'draft' | 'ready' | 'deprecated';

export type GalleryVariant = {
  id: string;
  name: string;
  render: () => ReactNode;
  summary?: string;
};

export type GalleryStory = {
  id: string;
  title: string;
  source: string;
  variants: GalleryVariant[];
  summary?: string;
  owner?: string;
  status?: GalleryStoryStatus;
  tags?: string[];
};

export type GallerySection = {
  id: string;
  title: string;
  stories: GalleryStory[];
};

export function defineGalleryStory(story: GalleryStory): GalleryStory {
  return story;
}

export function defineGallerySection(section: GallerySection): GallerySection {
  return section;
}
