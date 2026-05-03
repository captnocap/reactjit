import { isDataStory, isThemeStory } from './types';
import type { GalleryGroup, GallerySection, GalleryStory } from './types';

export const GALLERY_GROUPS = {
  compositions: { id: 'compositions', title: 'Compositions', order: 10 },
  themes: { id: 'themes', title: 'Theme Systems', order: 20 },
  motion: { id: 'motion', title: 'Motion & Effects', order: 30 },
  controls: { id: 'controls', title: 'Controls & Cards', order: 40 },
  charts: { id: 'charts', title: 'Charts & Graphs', order: 50 },
  data: { id: 'data-shapes', title: 'Data Shapes', order: 60 },
  systems: { id: 'systems', title: 'Systems & Catalogs', order: 70 },
} satisfies Record<string, GalleryGroup>;

export const GALLERY_TAGS = [
  { id: 'header', label: 'Header', order: 10 },
  { id: 'footer', label: 'Footer', order: 20 },
  { id: 'button', label: 'Button', order: 30 },
  { id: 'input', label: 'Input', order: 40 },
  { id: 'selector', label: 'Selector', order: 50 },
  { id: 'slider', label: 'Slider', order: 60 },
  { id: 'badge', label: 'Badge', order: 70 },
  { id: 'card', label: 'Card', order: 80 },
  { id: 'panel', label: 'Panel', order: 90 },
  { id: 'chart', label: 'Chart', order: 100 },
  { id: 'graph', label: 'Graph', order: 110 },
  { id: 'table', label: 'Table', order: 120 },
  { id: 'data', label: 'Data', order: 130 },
  { id: 'theme', label: 'Theme', order: 140 },
  { id: 'motion', label: 'Motion', order: 150 },
] as const;

export type GalleryCanonicalTag = (typeof GALLERY_TAGS)[number]['id'];

const TAG_LABELS: Record<GalleryCanonicalTag, string> = GALLERY_TAGS.reduce(
  (acc, definition) => {
    acc[definition.id] = definition.label;
    return acc;
  },
  {} as Record<GalleryCanonicalTag, string>
);

const TAG_ORDERS: Record<GalleryCanonicalTag, number> = GALLERY_TAGS.reduce(
  (acc, definition) => {
    acc[definition.id] = definition.order;
    return acc;
  },
  {} as Record<GalleryCanonicalTag, number>
);

const GROUP_ALIASES: Record<string, GalleryGroup> = {
  compositions: GALLERY_GROUPS.compositions,
  themes: GALLERY_GROUPS.themes,
  'theme-systems': GALLERY_GROUPS.themes,
  'theme systems': GALLERY_GROUPS.themes,
  effects: GALLERY_GROUPS.motion,
  'effect-systems': GALLERY_GROUPS.motion,
  'effect systems': GALLERY_GROUPS.motion,
  indicators: GALLERY_GROUPS.motion,
  'indicators-motion': GALLERY_GROUPS.motion,
  'indicators & motion': GALLERY_GROUPS.motion,
  motion: GALLERY_GROUPS.motion,
  'motion-effects': GALLERY_GROUPS.motion,
  'motion & effects': GALLERY_GROUPS.motion,
  cards: GALLERY_GROUPS.controls,
  'cards-tiles': GALLERY_GROUPS.controls,
  'cards & tiles': GALLERY_GROUPS.controls,
  controls: GALLERY_GROUPS.controls,
  'controls-cards': GALLERY_GROUPS.controls,
  'controls & cards': GALLERY_GROUPS.controls,
  charts: GALLERY_GROUPS.charts,
  'charts-data': GALLERY_GROUPS.charts,
  'charts & data': GALLERY_GROUPS.charts,
  'charts-graphs': GALLERY_GROUPS.charts,
  'charts & graphs': GALLERY_GROUPS.charts,
  data: GALLERY_GROUPS.data,
  'data-shapes': GALLERY_GROUPS.data,
  'data shapes': GALLERY_GROUPS.data,
  systems: GALLERY_GROUPS.systems,
  'systems-catalogs': GALLERY_GROUPS.systems,
  'systems & catalogs': GALLERY_GROUPS.systems,
};

const TAG_ALIASES: Partial<Record<string, GalleryCanonicalTag[]>> = {
  header: ['header'],
  footer: ['footer'],
  button: ['button'],
  buttons: ['button'],
  input: ['input'],
  field: ['input'],
  prompt: ['input'],
  search: ['input'],
  selector: ['selector'],
  selection: ['selector'],
  segmented: ['selector'],
  choice: ['selector'],
  radio: ['selector'],
  keycap: ['selector'],
  diode: ['selector'],
  pipe: ['selector'],
  stack: ['selector'],
  slider: ['slider'],
  fader: ['slider'],
  range: ['slider'],
  badge: ['badge'],
  card: ['card'],
  cards: ['card'],
  tile: ['card'],
  tiles: ['card'],
  panel: ['panel'],
  shell: ['panel'],
  surface: ['panel'],
  telemetry: ['panel'],
  transcript: ['panel'],
  console: ['panel'],
  chat: ['panel'],
  chart: ['chart'],
  charts: ['chart'],
  heatmap: ['chart'],
  boxplot: ['chart'],
  radar: ['chart'],
  waterfall: ['chart'],
  candlestick: ['chart'],
  pyramid: ['chart'],
  timeline: ['chart'],
  tracking: ['chart'],
  venn: ['chart'],
  graph: ['graph'],
  network: ['graph'],
  tree: ['graph'],
  spatial: ['graph'],
  diagram: ['graph'],
  table: ['table'],
  row: ['table'],
  column: ['table'],
  cell: ['table'],
  hierarchy: ['table'],
  contract: ['data'],
  'data-shape': ['data'],
  'demo-data': ['data'],
  'raw-event': ['data'],
  adapter: ['data'],
  catalog: ['data'],
  memory: ['data'],
  identity: ['data'],
  worker: ['data'],
  connection: ['data'],
  configuration: ['data'],
  prompt: ['input', 'data'],
  theme: ['theme'],
  classifier: ['theme'],
  'theme-system': ['theme'],
  palette: ['theme'],
  tokens: ['theme'],
  animation: ['motion'],
  hooks: ['motion'],
  effect: ['motion'],
  spinner: ['motion'],
  matrix: ['motion'],
  braille: ['motion'],
  projection: ['motion'],
  simulation: ['motion'],
  easing: ['motion'],
};

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getSourceName(source: string): string {
  const parts = source.split('/');
  return parts[parts.length - 1] || source;
}

function getSourceLabel(source: string): string {
  const base = getSourceName(source).replace(/\.[^.]+$/, '');
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function sortTags(tags: Set<GalleryCanonicalTag>): GalleryCanonicalTag[] {
  return [...tags].sort((left, right) => TAG_ORDERS[left] - TAG_ORDERS[right]);
}

function pushMatchingTag(tags: Set<GalleryCanonicalTag>, hint: string, expression: RegExp, tag: GalleryCanonicalTag) {
  if (expression.test(hint)) tags.add(tag);
}

function buildStoryHint(section: GallerySection, story: GalleryStory): string {
  return [
    section.id,
    section.title,
    section.group?.id || '',
    section.group?.title || '',
    story.id,
    story.title,
    story.source,
    getSourceName(story.source),
    getSourceLabel(story.source),
    ...(story.tags || []),
    story.summary || '',
  ]
    .join(' ')
    .toLowerCase();
}

function buildSectionHint(section: GallerySection): string {
  return [
    section.id,
    section.title,
    section.group?.id || '',
    section.group?.title || '',
    ...section.stories.map((story) => `${story.title} ${story.source} ${(story.tags || []).join(' ')}`),
  ]
    .join(' ')
    .toLowerCase();
}

export function getRawStoryTags(story: GalleryStory): string[] {
  return [...new Set((story.tags || []).map((tag) => toSlug(tag)).filter(Boolean))];
}

export function getCanonicalStoryTags(section: GallerySection, story: GalleryStory): GalleryCanonicalTag[] {
  const tags = new Set<GalleryCanonicalTag>();
  const rawTags = getRawStoryTags(story);
  const hint = buildStoryHint(section, story);

  if (isThemeStory(story)) tags.add('theme');
  if (isDataStory(story)) tags.add('data');

  for (const rawTag of rawTags) {
    for (const mapped of TAG_ALIASES[rawTag] || []) {
      tags.add(mapped);
    }
  }

  pushMatchingTag(tags, hint, /\bheader\b/, 'header');
  pushMatchingTag(tags, hint, /\bfooter\b/, 'footer');
  pushMatchingTag(tags, hint, /\bbutton\b/, 'button');
  pushMatchingTag(tags, hint, /\b(input|field|search[- ]bar|search bar|prompt template)\b/, 'input');
  pushMatchingTag(tags, hint, /\b(selector|selection|segmented|choice|radio|keycap|diode|pipe|stack)\b/, 'selector');
  pushMatchingTag(tags, hint, /\b(slider|fader|range)\b/, 'slider');
  pushMatchingTag(tags, hint, /\bbadge\b/, 'badge');
  pushMatchingTag(tags, hint, /\b(card|tile)\b/, 'card');
  pushMatchingTag(tags, hint, /\b(panel|shell|surface|workbench|quilt)\b/, 'panel');
  pushMatchingTag(
    tags,
    hint,
    /\b(chart|heatmap|boxplot|scatterplot|radar|waterfall|candlestick|pyramid|timeline|tracking|venn|polar|spline|progress|fraction)\b/,
    'chart'
  );
  pushMatchingTag(tags, hint, /\b(graph|network|tree|spatial|flow-map|flow map|dependency|dag|diagram)\b/, 'graph');
  pushMatchingTag(tags, hint, /\b(table|column|row|cell|hierarchy|readout)\b/, 'table');
  pushMatchingTag(tags, hint, /\b(theme|classifier|palette|token)\b/, 'theme');
  pushMatchingTag(tags, hint, /\b(animation|effect|spinner|matrix|braille|projection|simulation|easing|motion)\b/, 'motion');

  if (tags.size === 0) {
    if (isDataStory(story)) tags.add('data');
    else if (isThemeStory(story)) tags.add('theme');
    else if (/\b(card|tile)\b/.test(hint)) tags.add('card');
    else if (/\b(panel|shell|surface)\b/.test(hint)) tags.add('panel');
  }

  return sortTags(tags);
}

export function formatCanonicalTagLabel(tag: GalleryCanonicalTag): string {
  return TAG_LABELS[tag] || tag;
}

export function getCanonicalTagOrder(tag: GalleryCanonicalTag): number {
  return TAG_ORDERS[tag] || 999;
}

export function resolveGalleryGroup(section: GallerySection): GalleryGroup {
  const rawKeys = [section.group?.id || '', section.group?.title || ''].map(toSlug).filter(Boolean);
  const hint = buildSectionHint(section);

  if (section.stories.some(isThemeStory)) return GALLERY_GROUPS.themes;
  if (section.stories.some(isDataStory)) return GALLERY_GROUPS.data;

  for (const rawKey of rawKeys) {
    const aliased = GROUP_ALIASES[rawKey];
    if (aliased && rawKey !== 'components') return aliased;
  }

  if (/\b(matrix|braille|effect|spinner|easing|projection|simulation|quilt|motion)\b/.test(hint)) {
    return GALLERY_GROUPS.motion;
  }

  if (
    /\b(chart|heatmap|boxplot|scatterplot|radar|waterfall|candlestick|pyramid|timeline|tracking|venn|polar|spline|progress|fraction|graph|network|flow-map|flow map)\b/.test(
      hint
    )
  ) {
    return GALLERY_GROUPS.charts;
  }

  if (section.kind === 'top-level') return GALLERY_GROUPS.compositions;

  if (
    /\b(card|tile|badge|slider|fader|selector|header|footer|input|button|panel|surface|tab|rail|crumb|choice|segmented|keycap|diode|pipe|readout|column)\b/.test(
      hint
    )
  ) {
    return GALLERY_GROUPS.controls;
  }

  if (rawKeys.includes('components')) return GALLERY_GROUPS.systems;

  return GALLERY_GROUPS.systems;
}
