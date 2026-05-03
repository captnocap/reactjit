import type { ReactNode } from 'react';

export type GalleryStoryStatus = 'draft' | 'ready' | 'deprecated';
export type GalleryStoryFormat = 'component' | 'data' | 'theme';
export type GalleryDataStorage =
  | 'localstore'
  | 'sqlite-document'
  | 'sqlite-table'
  | 'json-file'
  | 'atomic-file-to-db';
export type GalleryDataReferenceKind = 'references' | 'belongs-to' | 'has-many' | 'dimension';
export type GalleryThemeClassifierKind = 'theme' | 'style' | 'variant' | 'breakpoint';
export type GalleryThemeTokenValue = string | number;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type GalleryGroup = {
  id: string;
  title: string;
  order?: number;
};

export type GallerySectionKind = 'atom' | 'top-level';

export type GalleryVariant = {
  id: string;
  name: string;
  render: () => ReactNode;
  summary?: string;
};

export type GalleryStoryBase = {
  id: string;
  title: string;
  source: string;
  summary?: string;
  owner?: string;
  status?: GalleryStoryStatus;
  tags?: string[];
};

export type GalleryComponentStory = GalleryStoryBase & {
  format?: 'component';
  variants: GalleryVariant[];
};

export type GalleryDataStory = GalleryStoryBase & {
  format: 'data';
  storage: GalleryDataStorage[];
  references?: GalleryDataReference[];
  schema: JsonObject;
  mockData: JsonValue;
};

export type GalleryDataReference = {
  kind: GalleryDataReferenceKind;
  label: string;
  targetSource: string;
  sourceField?: string;
  targetField?: string;
  summary?: string;
};

export type GalleryThemeTokenCategory = {
  id: string;
  title: string;
  tokens: Record<string, GalleryThemeTokenValue>;
};

export type GalleryThemeClassifierFile = {
  kind: GalleryThemeClassifierKind;
  source: string;
  label?: string;
};

export type GalleryThemeVariant = {
  id: string;
  title: string;
  summary?: string;
  tokens: GalleryThemeTokenCategory[];
};

export type GalleryThemeStory = GalleryStoryBase & {
  format: 'theme';
  classifiers: GalleryThemeClassifierFile[];
  globalTokens: GalleryThemeTokenCategory[];
  themes: GalleryThemeVariant[];
};

export type GalleryStory = GalleryComponentStory | GalleryDataStory | GalleryThemeStory;

export type GallerySection = {
  id: string;
  title: string;
  group?: GalleryGroup;
  kind?: GallerySectionKind;
  composedOf?: string[];
  stories: GalleryStory[];
};

export function isDataStory(story: GalleryStory): story is GalleryDataStory {
  return story.format === 'data';
}

export function isThemeStory(story: GalleryStory): story is GalleryThemeStory {
  return story.format === 'theme';
}

export function getStoryVariants(story: GalleryStory): GalleryVariant[] {
  return isDataStory(story) || isThemeStory(story) ? [] : story.variants;
}

export function getDataStoryStorage(story: GalleryStory): GalleryDataStorage[] {
  return isDataStory(story) ? story.storage : [];
}

export function getDataStoryReferences(story: GalleryStory): GalleryDataReference[] {
  return isDataStory(story) ? story.references || [] : [];
}

export function getThemeStoryClassifiers(story: GalleryStory): GalleryThemeClassifierFile[] {
  return isThemeStory(story) ? story.classifiers : [];
}

export function getThemeStoryVariants(story: GalleryStory): GalleryThemeVariant[] {
  return isThemeStory(story) ? story.themes : [];
}

export function defineGalleryStory<TStory extends GalleryStory>(story: TStory): TStory {
  return story;
}

export function defineGalleryDataStory<TStory extends GalleryDataStory>(story: TStory): TStory {
  return story;
}

export function defineGalleryDataReference<TReference extends GalleryDataReference>(
  reference: TReference
): TReference {
  return reference;
}

export function defineGalleryThemeStory<TStory extends GalleryThemeStory>(story: TStory): TStory {
  return story;
}

export function defineGallerySection(section: GallerySection): GallerySection {
  return section;
}
