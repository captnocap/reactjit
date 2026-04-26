import { useEffect, useMemo, useState } from 'react';
import './components.cls';
import { callHost } from '../../runtime/ffi';
import { TooltipRoot } from '../shared/tooltip/Tooltip';
import {
  useFuzzySearch,
  type FuzzyMode,
  type FuzzySearchCandidate,
  type FuzzySearchOptions,
  type FuzzySearchResult,
} from '../../runtime/hooks/useFuzzySearch';
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { Route, Router, useNavigate } from '../../runtime/router';
import { findGalleryThemeOption, useGalleryTheme } from './gallery-theme';
import { gallerySections } from './registry';
import { COLORS, PAGE_SURFACE } from './surface';
import {
  formatCanonicalTagLabel,
  getCanonicalStoryTags,
  getCanonicalTagOrder,
  getRawStoryTags,
  resolveGalleryGroup,
} from './taxonomy';
import { countThemeTokens, mergeThemeTokenCategories } from './theme-system';
import {
  getDataStoryReferences,
  getDataStoryStorage,
  getStoryVariants,
  getThemeStoryClassifiers,
  getThemeStoryVariants,
  isDataStory,
  isThemeStory,
} from './types';
import type { GalleryCanonicalTag } from './taxonomy';
import type {
  GalleryDataStorage,
  GalleryDataStory,
  GalleryDataReferenceKind,
  GalleryGroup,
  GallerySection,
  GallerySectionKind,
  GalleryStory,
  GalleryThemeClassifierKind,
  GalleryThemeStory,
  GalleryThemeTokenValue,
  GalleryThemeVariant,
  GalleryVariant,
} from './types';

type StoryEntry = {
  section: GallerySection;
  story: GalleryStory;
};

type StoryNavCategoryId = 'tokens' | 'data' | 'components' | 'atoms';

type StoryNavCategory = {
  id: StoryNavCategoryId;
  title: string;
  order: number;
  entries: StoryEntry[];
};

type FilterOption = {
  id: string;
  label: string;
  order?: number;
};

type SearchCandidate = FuzzySearchCandidate;

const NAV_SEARCH_MODE: FuzzyMode = 'strict';

type NavigationFilters = {
  kind: 'all' | GallerySectionKind;
  groupId: 'all' | string;
  tag: 'all' | string;
};

type Selection = {
  storyId: string;
  variantId: string;
};

const KIND_TITLES: Record<GallerySectionKind, string> = {
  'top-level': 'Top-Level',
  atom: 'Atoms',
};

const NAV_CATEGORY_META: Record<StoryNavCategoryId, { title: string; order: number }> = {
  tokens: { title: 'Tokens', order: 10 },
  data: { title: 'Data Shapes', order: 20 },
  atoms: { title: 'Atoms', order: 30 },
  components: { title: 'Components', order: 40 },
};

const STORAGE_TITLES: Record<GalleryDataStorage, string> = {
  localstore: 'Localstore',
  'sqlite-document': 'SQLite Document',
  'sqlite-table': 'SQLite Table',
  'json-file': 'JSON File',
  'atomic-file-to-db': 'Atomic File -> DB',
};

const DATA_REFERENCE_TITLES: Record<GalleryDataReferenceKind, string> = {
  references: 'References',
  'belongs-to': 'Belongs To',
  'has-many': 'Has Many',
  dimension: 'Dimension',
};

const THEME_CLASSIFIER_TITLES: Record<GalleryThemeClassifierKind, string> = {
  theme: 'Theme Classifier',
  style: 'Style Classifier',
  variant: 'Variant Classifier',
  breakpoint: 'Breakpoint Classifier',
};

const COMPOSITION_PREVIEW_LIMIT = 6;
const COMPOSITION_SCROLL_HEIGHT = 220;
const GALLERY_ROUTER_HOT_KEY = 'component-gallery:route';
const ROUTE_DEFAULT_VARIANT = 'overview';
const CHIP_RADIUS = 6;

function flattenStories(sections: GallerySection[]): StoryEntry[] {
  const entries: StoryEntry[] = [];
  for (const section of sections) {
    for (const story of section.stories) {
      entries.push({ section, story });
    }
  }
  return entries;
}

function countVariants(stories: StoryEntry[]): number {
  let total = 0;
  for (const entry of stories) total += getStoryVariants(entry.story).length;
  return total;
}

function getDefaultVariantId(entry: StoryEntry): string {
  return getStoryVariants(entry.story)[0]?.id || ROUTE_DEFAULT_VARIANT;
}

function storyRoutePath(entry: StoryEntry, variantId?: string): string {
  return `/stories/${encodeURIComponent(entry.story.id)}/${encodeURIComponent(variantId || getDefaultVariantId(entry))}`;
}

function routeSelection(storyId: string | undefined, variantId: string | undefined): Selection | null {
  if (!storyId) return null;
  return {
    storyId,
    variantId: variantId || ROUTE_DEFAULT_VARIANT,
  };
}

function getTextInputValue(value: any): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.value === 'string') return value.value;
    if (typeof value.target?.value === 'string') return value.target.value;
    return '';
  }
  return String(value);
}

function initialGalleryRoutePath(): string {
  const first = flattenStories(gallerySections)[0];
  return first ? storyRoutePath(first) : '/';
}

function countStoriesByKind(stories: StoryEntry[], kind: GallerySectionKind): number {
  let total = 0;
  for (const entry of stories) {
    if (getSectionKind(entry.section) === kind) total += 1;
  }
  return total;
}

function sortStoryEntries(stories: StoryEntry[]): StoryEntry[] {
  const baseTitles = new Set(
    stories
      .map((entry) => entry.story.title.toLowerCase())
      .filter((title) => !title.includes(' '))
  );
  const sortKey = (entry: StoryEntry): string => {
    const title = entry.story.title.toLowerCase();
    const words = title.split(/\s+/);
    const last = words[words.length - 1] || title;
    if (words.length > 1 && baseTitles.has(last)) {
      return `${last} ${words.slice(0, -1).join(' ')}`;
    }
    return title;
  };
  return [...stories].sort((a, b) => {
    const byKey = sortKey(a).localeCompare(sortKey(b));
    return byKey !== 0 ? byKey : a.story.title.localeCompare(b.story.title);
  });
}

function getSourceName(source: string): string {
  const parts = source.split('/');
  return parts[parts.length - 1] || source;
}

function getSourceLabel(source: string): string {
  const base = getSourceName(source).replace(/\.[^.]+$/, '');
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

function getSectionGroup(section: GallerySection): GalleryGroup {
  return resolveGalleryGroup(section);
}

function getSectionKind(section: GallerySection): GallerySectionKind {
  return section.kind || 'atom';
}

function getComposedOf(section: GallerySection): string[] {
  return (section.composedOf || []).map((part) => part.trim()).filter(Boolean);
}

function getThemeCount(story: GalleryStory): number {
  return getThemeStoryVariants(story).length;
}

function formatStorageLabel(storage: GalleryDataStorage): string {
  return STORAGE_TITLES[storage] || storage;
}

function formatDataReferenceLabel(kind: GalleryDataReferenceKind): string {
  return DATA_REFERENCE_TITLES[kind] || kind;
}

function formatThemeClassifierLabel(kind: GalleryThemeClassifierKind): string {
  return THEME_CLASSIFIER_TITLES[kind] || kind;
}

function getStoryTags(section: GallerySection, story: GalleryStory): GalleryCanonicalTag[] {
  return getCanonicalStoryTags(section, story);
}

function getStoryTypeLabel(entry: StoryEntry): string {
  if (isThemeStory(entry.story)) return 'Theme System';
  if (isDataStory(entry.story)) return 'Data Shape';
  return KIND_TITLES[getSectionKind(entry.section)];
}

function getTagTone(tag: GalleryCanonicalTag): string {
  if (tag === 'theme') return COLORS.accent;
  if (tag === 'data') return COLORS.success;
  if (tag === 'motion') return COLORS.warning;
  return COLORS.muted;
}

function pushSearchCandidate(
  candidates: SearchCandidate[],
  seen: Set<string>,
  text: string,
  weight: number,
  mode: FuzzyMode
): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const key = `${mode}:${trimmed.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ text: trimmed, weight, mode });
}

function getDataStorySearchKeys(story: GalleryStory): string[] {
  if (!isDataStory(story)) return [];

  const schemaKeys =
    story.schema && typeof story.schema === 'object' && !Array.isArray(story.schema)
      ? Object.keys(story.schema)
      : [];
  const propertyKeys =
    story.schema &&
    typeof story.schema === 'object' &&
    !Array.isArray(story.schema) &&
    story.schema.properties &&
    typeof story.schema.properties === 'object' &&
    !Array.isArray(story.schema.properties)
      ? Object.keys(story.schema.properties as Record<string, unknown>)
      : [];
  const mockKeys =
    story.mockData && typeof story.mockData === 'object' && !Array.isArray(story.mockData)
      ? Object.keys(story.mockData as Record<string, unknown>)
      : [];
  const referenceKeys = getDataStoryReferences(story).flatMap((reference) => [
    reference.label,
    formatDataReferenceLabel(reference.kind),
    reference.targetSource,
    getSourceName(reference.targetSource),
    getSourceLabel(reference.targetSource),
    reference.sourceField || '',
    reference.targetField || '',
    reference.summary || '',
  ]);

  return [...new Set([...schemaKeys, ...propertyKeys, ...mockKeys, ...referenceKeys].map((key) => key.trim()).filter(Boolean))];
}

function getThemeStorySearchKeys(story: GalleryStory): string[] {
  if (!isThemeStory(story)) return [];

  const keys: string[] = [];
  for (const classifier of getThemeStoryClassifiers(story)) {
    if (classifier.label) keys.push(classifier.label);
    keys.push(formatThemeClassifierLabel(classifier.kind));
    keys.push(getSourceName(classifier.source));
    keys.push(getSourceLabel(classifier.source));
  }

  for (const category of story.globalTokens) {
    keys.push(category.title);
    keys.push(...Object.keys(category.tokens || {}));
  }

  for (const theme of story.themes) {
    keys.push(theme.id, theme.title);
    if (theme.summary) keys.push(theme.summary);
    for (const category of theme.tokens) {
      keys.push(category.title);
      keys.push(...Object.keys(category.tokens || {}));
    }
  }

  return [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
}

function getSearchCandidates(entry: StoryEntry): SearchCandidate[] {
  const story = entry.story;
  const group = getSectionGroup(entry.section);
  const candidates: SearchCandidate[] = [];
  const seen = new Set<string>();

  pushSearchCandidate(candidates, seen, story.title, 1, NAV_SEARCH_MODE);
  pushSearchCandidate(candidates, seen, getSourceLabel(story.source), 0.95, NAV_SEARCH_MODE);
  pushSearchCandidate(candidates, seen, getSourceName(story.source), 0.9, NAV_SEARCH_MODE);
  pushSearchCandidate(candidates, seen, entry.section.title, 0.8, NAV_SEARCH_MODE);
  pushSearchCandidate(candidates, seen, group.title, 0.7, NAV_SEARCH_MODE);
  pushSearchCandidate(candidates, seen, getSectionKind(entry.section) === 'top-level' ? 'Top-Level' : 'Atom', 0.5, NAV_SEARCH_MODE);

  for (const tag of getStoryTags(entry.section, story)) {
    pushSearchCandidate(candidates, seen, tag, 0.75, NAV_SEARCH_MODE);
    pushSearchCandidate(candidates, seen, formatCanonicalTagLabel(tag), 0.7, NAV_SEARCH_MODE);
  }

  for (const rawTag of getRawStoryTags(story)) {
    pushSearchCandidate(candidates, seen, rawTag, 0.45, NAV_SEARCH_MODE);
  }

  for (const storage of getDataStoryStorage(story)) {
    pushSearchCandidate(candidates, seen, formatStorageLabel(storage), 0.65, NAV_SEARCH_MODE);
  }

  for (const variant of getStoryVariants(story)) {
    pushSearchCandidate(candidates, seen, variant.name, 0.65, NAV_SEARCH_MODE);
  }

  for (const atomPath of getComposedOf(entry.section)) {
    pushSearchCandidate(candidates, seen, getSourceLabel(atomPath), 0.6, NAV_SEARCH_MODE);
    pushSearchCandidate(candidates, seen, getSourceName(atomPath), 0.55, NAV_SEARCH_MODE);
  }

  for (const key of getDataStorySearchKeys(story)) {
    pushSearchCandidate(candidates, seen, key, 0.6, NAV_SEARCH_MODE);
  }

  for (const key of getThemeStorySearchKeys(story)) {
    pushSearchCandidate(candidates, seen, key, 0.7, NAV_SEARCH_MODE);
  }

  return candidates;
}

function collectGroupFilters(stories: StoryEntry[]): FilterOption[] {
  const groups = new Map<string, FilterOption>();
  for (const entry of stories) {
    const group = getSectionGroup(entry.section);
    if (!groups.has(group.id)) {
      groups.set(group.id, {
        id: group.id,
        label: group.title,
        order: group.order ?? 999,
      });
    }
  }

  return [...groups.values()].sort((left, right) => {
    const byOrder = (left.order ?? 999) - (right.order ?? 999);
    return byOrder !== 0 ? byOrder : left.label.localeCompare(right.label);
  });
}

function collectTagFilters(stories: StoryEntry[]): FilterOption[] {
  const tags = new Map<string, FilterOption>();
  for (const entry of stories) {
    for (const tag of getStoryTags(entry.section, entry.story)) {
      if (!tags.has(tag)) {
        tags.set(tag, {
          id: tag,
          label: formatCanonicalTagLabel(tag),
          order: getCanonicalTagOrder(tag),
        });
      }
    }
  }

  return [...tags.values()].sort((left, right) => {
    const byOrder = (left.order ?? 1000) - (right.order ?? 1000);
    return byOrder !== 0 ? byOrder : left.label.localeCompare(right.label);
  });
}

function filterStoryEntriesByFilters(stories: StoryEntry[], filters: NavigationFilters): StoryEntry[] {
  return stories.filter((entry) => {
    if (filters.kind !== 'all' && getSectionKind(entry.section) !== filters.kind) return false;
    if (filters.groupId !== 'all' && getSectionGroup(entry.section).id !== filters.groupId) return false;
    if (
      filters.tag !== 'all' &&
      !getStoryTags(entry.section, entry.story).some((tag) => tag === filters.tag)
    ) {
      return false;
    }
    return true;
  });
}

function pickSelection(
  stories: StoryEntry[],
  selection: Selection | null
): { entry: StoryEntry | null; variant: GalleryVariant | null } {
  if (stories.length === 0) return { entry: null, variant: null };

  const entry =
    (selection && stories.find((candidate) => candidate.story.id === selection.storyId)) || stories[0];
  const variants = getStoryVariants(entry.story);
  const variant =
    (selection && variants.find((candidate) => candidate.id === selection.variantId)) ||
    variants[0] ||
    null;

  return { entry, variant };
}

function pickRoutedSelection(
  stories: StoryEntry[],
  selection: Selection | null
): { entry: StoryEntry | null; variant: GalleryVariant | null } {
  if (!selection || stories.length === 0) return { entry: null, variant: null };

  const entry = stories.find((candidate) => candidate.story.id === selection.storyId) || null;
  if (!entry) return { entry: null, variant: null };

  const variants = getStoryVariants(entry.story);
  const variant =
    variants.find((candidate) => candidate.id === selection.variantId) ||
    variants[0] ||
    null;

  return { entry, variant };
}

function getNavigationCategory(entry: StoryEntry): StoryNavCategoryId {
  const group = getSectionGroup(entry.section);
  if (isDataStory(entry.story)) return 'data';
  if (isThemeStory(entry.story) || group.id === 'themes') return 'tokens';
  if (getSectionKind(entry.section) === 'top-level') return 'components';
  return 'atoms';
}

function groupVisibleStories(stories: StoryEntry[], preserveRank = false): StoryNavCategory[] {
  const categories = new Map<StoryNavCategoryId, StoryEntry[]>();
  for (const entry of stories) {
    const category = getNavigationCategory(entry);
    const entries = categories.get(category) || [];
    entries.push(entry);
    categories.set(category, entries);
  }

  const orderedCategories = [...categories.entries()];
  if (!preserveRank) {
    orderedCategories.sort((left, right) => NAV_CATEGORY_META[left[0]].order - NAV_CATEGORY_META[right[0]].order);
  }

  return orderedCategories.map(([id, entries]) => ({
    id,
    title: NAV_CATEGORY_META[id].title,
    order: NAV_CATEGORY_META[id].order,
    entries: preserveRank ? entries : sortStoryEntries(entries),
  }));
}

function windowMinimize() {
  callHost<void>('__window_minimize', undefined as any);
}

function windowMaximize() {
  callHost<void>('__window_maximize', undefined as any);
}

function windowClose() {
  callHost<void>('__window_close', undefined as any);
}

function WindowButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress: () => void;
  tone: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: tone }}>{label}</Text>
    </Pressable>
  );
}

function TitleBar() {
  return (
    <Row
      windowDrag={true}
      style={{
        width: '100%',
        height: 42,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 8,
        backgroundColor: COLORS.railBg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 0 }}>
        <Box
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            backgroundColor: COLORS.accent,
            borderWidth: 1,
            borderColor: COLORS.borderStrong,
          }}
        />
        <Col style={{ gap: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>Component Gallery</Text>
          <Text style={{ fontSize: 9, color: COLORS.faint }}>cart/component-gallery</Text>
        </Col>
      </Row>

      <Row style={{ alignItems: 'center', gap: 6 }}>
        <WindowButton label="-" onPress={windowMinimize} tone={COLORS.warning} />
        <WindowButton label="[]" onPress={windowMaximize} tone={COLORS.success} />
        <WindowButton label="x" onPress={windowClose} tone="#ff7a72" />
      </Row>
    </Row>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Col
      style={{
        width: 112,
        height: 48,
        justifyContent: 'center',
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 8,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: 'bold', color: tone }}>{value}</Text>
      <Text style={{ fontSize: 10, color: COLORS.muted }}>{label}</Text>
    </Col>
  );
}

function GalleryThemeToggle({
  label,
  activeLabel,
  disabled,
  onPrevious,
  onNext,
}: {
  label: string;
  activeLabel: string;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <Row
      style={{
        width: 248,
        height: 48,
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: 8,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 9, color: COLORS.muted }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{activeLabel}</Text>
      </Col>
      <Row style={{ gap: 6 }}>
        <NavActionButton label="Prev" disabled={disabled} onPress={onPrevious} />
        <NavActionButton label="Next" disabled={disabled} onPress={onNext} />
      </Row>
    </Row>
  );
}

function NavActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={{
        height: 30,
        flexGrow: 1,
        flexBasis: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        backgroundColor: disabled ? COLORS.railBg : COLORS.panelBg,
        borderWidth: 1,
        borderColor: disabled ? COLORS.border : COLORS.borderStrong,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: disabled ? COLORS.faint : COLORS.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 24,
        paddingLeft: 8,
        paddingRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: CHIP_RADIUS,
        backgroundColor: active ? COLORS.accent : COLORS.panelBg,
        borderWidth: 1,
        borderColor: active ? COLORS.accent : COLORS.border,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: active ? COLORS.accentInk : COLORS.muted }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MetaBadge({
  label,
  tone,
  background,
}: {
  label: string;
  tone: string;
  background: string;
}) {
  return (
    <Box
      style={{
        height: 22,
        paddingLeft: 8,
        paddingRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: CHIP_RADIUS,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: tone,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: tone }}>{label}</Text>
    </Box>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: any;
}) {
  return (
    <Col style={{ width: '100%', gap: 4 }}>
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.faint }}>{label}</Text>
      <Row style={{ width: '100%', gap: 6, flexWrap: 'wrap' }}>{children}</Row>
    </Col>
  );
}

function StoryNavGroupHeader({
  title,
  count,
  collapsed,
  onPress,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%',
        minHeight: 36,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 8,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}>{title}</Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            {`${count} ${count === 1 ? 'entry' : 'entries'}`}
          </Text>
        </Col>
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.faint }}>{collapsed ? '+' : '-'}</Text>
      </Row>
    </Pressable>
  );
}

function StoryNavItem({
  entry,
  active,
  index,
  onPress,
}: {
  entry: StoryEntry;
  active: boolean;
  index: number;
  onPress: () => void;
}) {
  const kind = getSectionKind(entry.section);
  const dataStory = isDataStory(entry.story);
  const themeStory = isThemeStory(entry.story);
  const kindLabel = themeStory ? 'THEME' : dataStory ? 'DATA' : kind === 'top-level' ? 'TOP' : 'ATOM';
  const kindTone = themeStory
    ? COLORS.accent
    : dataStory
      ? COLORS.success
      : kind === 'top-level'
        ? COLORS.compose
        : COLORS.faint;
  const tagSummary = getStoryTags(entry.section, entry.story)
    .slice(0, 2)
    .map(formatCanonicalTagLabel)
    .join(' · ');
  const status = entry.story.status || 'draft';
  const variantCount = getStoryVariants(entry.story).length;
  const themeCount = getThemeCount(entry.story);
  const detailLabel = themeStory
    ? themeCount > 1
      ? `${themeCount}t`
      : 'TOK'
    : dataStory
      ? 'JSON'
      : variantCount > 1
        ? `${variantCount}v`
        : status.slice(0, 1).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%',
        minHeight: tagSummary ? 42 : 32,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 4,
        paddingBottom: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: active ? COLORS.panelRaised : COLORS.railBg,
        borderWidth: 1,
        borderColor: active ? COLORS.accent : COLORS.border,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: active ? 'bold' : 'normal',
              color: active ? COLORS.text : COLORS.muted,
            }}
          >
            {entry.story.title}
          </Text>
          {tagSummary ? (
            <Text style={{ fontSize: 8, color: active ? COLORS.accent : COLORS.faint }}>{tagSummary}</Text>
          ) : null}
        </Col>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Text
            style={{ width: 22, fontSize: 10, fontWeight: 'bold', color: active ? COLORS.accent : COLORS.faint }}
          >
            {String(index + 1)}
          </Text>
          <Text style={{ width: 30, fontSize: 9, fontWeight: 'bold', color: active ? COLORS.text : kindTone }}>
            {kindLabel}
          </Text>
          <Text
            style={{
              width: 34,
              fontSize: 10,
              fontWeight: dataStory || themeStory ? 'bold' : 'normal',
              color: themeStory
                ? COLORS.accent
                : dataStory
                  ? COLORS.success
                  : variantCount > 1
                    ? COLORS.success
                    : COLORS.faint,
            }}
          >
            {detailLabel}
          </Text>
        </Row>
      </Row>
    </Pressable>
  );
}

function VariantButton({
  variant,
  active,
  onPress,
}: {
  variant: GalleryVariant;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 96,
        height: 34,
        paddingLeft: 12,
        paddingRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: active ? COLORS.accent : COLORS.panelBg,
        borderWidth: 1,
        borderColor: active ? COLORS.accent : COLORS.border,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: 'bold',
          color: active ? COLORS.accentInk : COLORS.text,
        }}
      >
        {variant.name}
      </Text>
    </Pressable>
  );
}

function EmptyPreview() {
  return (
    <Col
      style={{
        flexGrow: 1,
        flexBasis: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>
        No gallery stories registered
      </Text>
      <Text style={{ fontSize: 12, color: PAGE_SURFACE.mutedTextColor }}>cart/component-gallery</Text>
    </Col>
  );
}

function StoryStage({ children }: { children: any }) {
  return (
    <Col
      style={{
        width: '100%',
        minHeight: PAGE_SURFACE.minHeight - PAGE_SURFACE.padding * 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Col>
  );
}

function CompositionPanel({
  entry,
  atomStoriesBySource,
  onSelectAtom,
}: {
  entry: StoryEntry;
  atomStoriesBySource: Map<string, StoryEntry>;
  onSelectAtom: (entry: StoryEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const kind = getSectionKind(entry.section);
  if (kind !== 'top-level') return null;

  const atoms = getComposedOf(entry.section);
  if (atoms.length === 0) return null;

  const canCollapse = atoms.length > COMPOSITION_PREVIEW_LIMIT;
  const visibleAtoms = expanded || !canCollapse ? atoms : atoms.slice(0, COMPOSITION_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, atoms.length - visibleAtoms.length);

  const renderAtomRow = (atomPath: string) => {
    const atomEntry = atomStoriesBySource.get(atomPath) || null;

    if (!atomEntry) {
      return (
        <Box
          key={atomPath}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: CHIP_RADIUS,
            backgroundColor: COLORS.panelBg,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            {`${getSourceLabel(atomPath)} · missing`}
          </Text>
        </Box>
      );
    }

    return (
      <Pressable
        key={atomPath}
        onPress={() => onSelectAtom(atomEntry)}
        style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: CHIP_RADIUS,
          backgroundColor: COLORS.panelBg,
          borderWidth: 1,
          borderColor: COLORS.accent,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.text }}>
          {atomEntry.story.title}
        </Text>
      </Pressable>
    );
  };

  return (
    <Col
      style={{
        width: '100%',
        marginTop: 10,
        padding: 10,
        gap: 5,
        borderRadius: 8,
        backgroundColor: COLORS.railBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, gap: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.text }}>
            {`Composed of ${atoms.length} atoms`}
          </Text>
          <Text style={{ fontSize: 8, color: COLORS.muted }}>
            {expanded
              ? 'Scroll the references or jump straight to an atom page.'
              : canCollapse
                ? `Showing ${visibleAtoms.length} of ${atoms.length}`
                : 'Linked atom pages'}
          </Text>
        </Col>
        {canCollapse && (
          <Pressable
            onPress={() => setExpanded((current) => !current)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: CHIP_RADIUS,
              backgroundColor: COLORS.panelBg,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.text }}>
              {expanded ? 'Show less' : `Show all ${atoms.length}`}
            </Text>
          </Pressable>
        )}
      </Row>

      {expanded ? (
        <ScrollView
          style={{
            width: '100%',
            maxHeight: COMPOSITION_SCROLL_HEIGHT,
          }}
          showScrollbar
        >
          <Row style={{ width: '100%', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
            {visibleAtoms.map(renderAtomRow)}
          </Row>
        </ScrollView>
      ) : (
        <Row style={{ width: '100%', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
          {visibleAtoms.map(renderAtomRow)}
        </Row>
      )}

      {!expanded && hiddenCount > 0 && (
        <Pressable
          onPress={() => setExpanded(true)}
          style={{
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 7,
            paddingBottom: 7,
            borderRadius: 6,
            backgroundColor: COLORS.panelBg,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.accent }}>
            {`${hiddenCount} more atoms`}
          </Text>
        </Pressable>
      )}
    </Col>
  );
}

function describeJsonValue(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  if (value && typeof value === 'object') {
    const count = Object.keys(value as Record<string, unknown>).length;
    return `${count} ${count === 1 ? 'field' : 'fields'}`;
  }
  if (value === null) return 'null';
  return typeof value;
}

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || (value !== null && typeof value === 'object' && Object.prototype.toString.call(value) === '[object Object]');
}

function formatJsonPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  return String(value);
}

function formatJsonContainerOpen(value: Record<string, unknown> | unknown[]): string {
  return Array.isArray(value) ? '[' : '{';
}

function formatJsonContainerClose(value: Record<string, unknown> | unknown[]): string {
  return Array.isArray(value) ? ']' : '}';
}

function getJsonChildren(value: Record<string, unknown> | unknown[]): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }
  try {
    return Object.entries(value);
  } catch {
    return [];
  }
}

function shouldCollapseJsonNodeByDefault(depth: number): boolean {
  return depth >= 1;
}

function hasJsonNodeState(collapsed: Record<string, boolean>, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(collapsed, path);
}

function getJsonNodeCollapsedState(
  collapsed: Record<string, boolean>,
  path: string,
  depth: number
): boolean {
  return hasJsonNodeState(collapsed, path) ? collapsed[path] : shouldCollapseJsonNodeByDefault(depth);
}

const JSON_TREE_MAX_DEPTH = 64;

function JsonTreeNode({
  name,
  value,
  path,
  depth,
  collapsed,
  onToggle,
}: {
  name?: string;
  value: unknown;
  path: string;
  depth: number;
  collapsed: Record<string, boolean>;
  onToggle: (path: string, depth: number) => void;
}) {
  if (depth > JSON_TREE_MAX_DEPTH) {
    return (
      <Row style={{ width: '100%', minHeight: 20, alignItems: 'flex-start', paddingLeft: depth * 14, gap: 6 }}>
        {name ? <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>{`${name}:`}</Text> : null}
        <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.mutedTextColor }}>{'[max depth exceeded]'}</Text>
      </Row>
    );
  }

  const indent = depth * 14;
  const container = isJsonContainer(value);

  if (!container) {
    return (
      <Row
        style={{
          width: '100%',
          minHeight: 20,
          alignItems: 'flex-start',
          paddingLeft: indent,
          gap: 6,
        }}
      >
        {name ? (
          <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>
            {`${name}:`}
          </Text>
        ) : null}
        <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>
          {formatJsonPrimitive(value)}
        </Text>
      </Row>
    );
  }

  const isCollapsed = getJsonNodeCollapsedState(collapsed, path, depth);
  const children = getJsonChildren(value);
  const open = formatJsonContainerOpen(value);
  const close = formatJsonContainerClose(value);
  const canToggle = children.length > 0;

  return (
    <Col style={{ width: '100%', gap: 2 }}>
      <Pressable
        onPress={() => {
          if (canToggle) onToggle(path, depth);
        }}
        style={{
          width: '100%',
          minHeight: 22,
          justifyContent: 'center',
          paddingLeft: indent,
          paddingTop: 1,
          paddingBottom: 1,
          borderRadius: 6,
        }}
      >
        <Row style={{ width: '100%', alignItems: 'center', gap: 6 }}>
          <Text style={{ width: 12, fontFamily: 'monospace', fontSize: 10, color: PAGE_SURFACE.mutedTextColor }}>
            {canToggle ? (isCollapsed ? '▸' : '▾') : ' '}
          </Text>
          {name ? (
            <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>
              {`${name}:`}
            </Text>
          ) : null}
          <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>
            {open}
          </Text>
          <Text
            style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.mutedTextColor }}
          >
            {describeJsonValue(value)}
          </Text>
          {isCollapsed ? (
            <Text
              style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}
            >
              {close}
            </Text>
          ) : null}
        </Row>
      </Pressable>

      {!isCollapsed && canToggle ? (
        <Col style={{ width: '100%', gap: 2 }}>
          {children.map(([childName, childValue]) => (
            <JsonTreeNode
              key={`${path}:${childName}`}
              name={childName}
              value={childValue}
              path={`${path}.${childName}`}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
          <Row
            style={{
              width: '100%',
              minHeight: 20,
              alignItems: 'center',
              paddingLeft: indent + 18,
            }}
          >
            <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.textColor }}>
              {close}
            </Text>
          </Row>
        </Col>
      ) : null}
    </Col>
  );
}

function JsonDataPanel({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: unknown;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const setAllNested = (nextCollapsed: boolean) => {
    const nextState: Record<string, boolean> = {};

    const visit = (node: unknown, path: string, depth: number) => {
      if (!isJsonContainer(node)) return;
      nextState[path] = depth === 0 ? false : nextCollapsed;
      for (const [childName, childValue] of getJsonChildren(node)) {
        visit(childValue, `${path}.${childName}`, depth + 1);
      }
    };

    visit(value, 'root', 0);
    setCollapsed(nextState);
  };

  return (
    <Col
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        gap: 8,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: tone }}>{label}</Text>
          <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>{describeJsonValue(value)}</Text>
        </Row>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => setAllNested(false)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: CHIP_RADIUS,
              borderWidth: 1,
              borderColor: PAGE_SURFACE.borderColor,
              backgroundColor: PAGE_SURFACE.backgroundColor,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>Expand all</Text>
          </Pressable>
          <Pressable
            onPress={() => setAllNested(true)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: CHIP_RADIUS,
              borderWidth: 1,
              borderColor: PAGE_SURFACE.borderColor,
              backgroundColor: PAGE_SURFACE.backgroundColor,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>Collapse all</Text>
          </Pressable>
        </Row>
      </Row>
      <Box
        style={{
          width: '100%',
          borderRadius: 10,
          backgroundColor: PAGE_SURFACE.backgroundColor,
          borderWidth: 1,
          borderColor: PAGE_SURFACE.borderColor,
        }}
      >
        <ScrollView
          style={{
            width: '100%',
            maxHeight: 540,
            padding: 12,
          }}
          showScrollbar
        >
          {value != null ? (
            <JsonTreeNode
              value={value}
              path="root"
              depth={0}
              collapsed={collapsed}
              onToggle={(path, depth) => {
                setCollapsed((prev) => ({
                  ...prev,
                  [path]: !getJsonNodeCollapsedState(prev, path, depth),
                }));
              }}
            />
          ) : (
            <Text style={{ fontFamily: 'monospace', fontSize: 10, lineHeight: 16, color: PAGE_SURFACE.mutedTextColor }}>
              null
            </Text>
          )}
        </ScrollView>
      </Box>
    </Col>
  );
}

function DataReferencePanel({
  story,
  dataStoriesBySource,
  onSelectReference,
}: {
  story: GalleryDataStory;
  dataStoriesBySource: Map<string, StoryEntry>;
  onSelectReference: (entry: StoryEntry) => void;
}) {
  const references = getDataStoryReferences(story);
  if (references.length === 0) return null;

  return (
    <Col
      style={{
        width: '100%',
        padding: 12,
        gap: 8,
        borderRadius: 10,
        backgroundColor: PAGE_SURFACE.backgroundColor,
        borderWidth: 1,
        borderColor: PAGE_SURFACE.borderColor,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>LINKED SHAPES</Text>
        <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
          {`${references.length} ${references.length === 1 ? 'reference' : 'references'}`}
        </Text>
      </Row>

      <Col style={{ width: '100%', gap: 8 }}>
        {references.map((reference) => {
          const linkedStory = dataStoriesBySource.get(reference.targetSource) || null;
          const mapping =
            reference.sourceField && reference.targetField
              ? `${reference.sourceField} -> ${reference.targetField}`
              : reference.sourceField
                ? reference.sourceField
                : reference.targetField || '';

          const content = (
            <Col
              style={{
                width: '100%',
                padding: 10,
                gap: 4,
                borderRadius: 8,
                backgroundColor: PAGE_SURFACE.backgroundColor,
                borderWidth: 1,
                borderColor: PAGE_SURFACE.borderColor,
              }}
            >
              <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>
                  {reference.label}
                </Text>
                <MetaBadge
                  label={formatDataReferenceLabel(reference.kind)}
                  tone={COLORS.accent}
                  background={PAGE_SURFACE.backgroundColor}
                />
              </Row>
              <Text style={{ fontSize: 10, color: PAGE_SURFACE.mutedTextColor }}>
                {linkedStory ? linkedStory.story.title : getSourceLabel(reference.targetSource)}
              </Text>
              <Text style={{ fontFamily: 'monospace', fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
                {reference.targetSource}
              </Text>
              {mapping ? (
                <Text style={{ fontFamily: 'monospace', fontSize: 9, color: PAGE_SURFACE.textColor }}>
                  {mapping}
                </Text>
              ) : null}
              {reference.summary ? (
                <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>{reference.summary}</Text>
              ) : null}
              <Text style={{ fontSize: 8, color: linkedStory ? COLORS.accent : PAGE_SURFACE.mutedTextColor }}>
                {linkedStory ? 'Open linked shape' : 'No linked shape page yet'}
              </Text>
            </Col>
          );

          return linkedStory ? (
            <Pressable
              key={`${reference.kind}:${reference.targetSource}:${reference.label}`}
              onPress={() => onSelectReference(linkedStory)}
            >
              {content}
            </Pressable>
          ) : (
            <Box key={`${reference.kind}:${reference.targetSource}:${reference.label}`}>{content}</Box>
          );
        })}
      </Col>
    </Col>
  );
}

function DataStoryPreview({
  story,
  dataStoriesBySource,
  onSelectReference,
}: {
  story: GalleryDataStory;
  dataStoriesBySource: Map<string, StoryEntry>;
  onSelectReference: (entry: StoryEntry) => void;
}) {
  const storage = getDataStoryStorage(story);

  return (
    <Col
      style={{
        width: '100%',
        gap: 16,
        alignItems: 'stretch',
      }}
    >
      {story.summary ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: PAGE_SURFACE.mutedTextColor }}>{story.summary}</Text>
      ) : null}

      {storage.length > 0 ? (
        <Col
          style={{
            width: '100%',
            padding: 12,
            gap: 8,
            borderRadius: 10,
            backgroundColor: PAGE_SURFACE.backgroundColor,
            borderWidth: 1,
            borderColor: PAGE_SURFACE.borderColor,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>STORAGE TARGET</Text>
          <Row style={{ width: '100%', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {storage.map((entry) => (
              <MetaBadge
                key={entry}
                label={formatStorageLabel(entry)}
                tone={PAGE_SURFACE.textColor}
                background={PAGE_SURFACE.backgroundColor}
              />
            ))}
          </Row>
        </Col>
      ) : null}

      <DataReferencePanel
        story={story}
        dataStoriesBySource={dataStoriesBySource}
        onSelectReference={onSelectReference}
      />

      <Row style={{ width: '100%', gap: 16, alignItems: 'flex-start' }}>
        <JsonDataPanel label="JSON Schema" tone={COLORS.warning} value={story.schema} />
        <JsonDataPanel label="Mock Data" tone={COLORS.success} value={story.mockData} />
      </Row>
    </Col>
  );
}

function isColorTokenValue(value: GalleryThemeTokenValue): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    /^#([0-9a-f]{3,8})$/i.test(trimmed) ||
    /^rgba?\(/i.test(trimmed) ||
    /^hsla?\(/i.test(trimmed) ||
    /^oklch\(/i.test(trimmed) ||
    /^oklab\(/i.test(trimmed)
  );
}

function formatThemeTokenValue(value: GalleryThemeTokenValue): string {
  return typeof value === 'string' ? value : String(value);
}

function ThemeTokenRow({
  name,
  value,
  scope,
}: {
  name: string;
  value: GalleryThemeTokenValue;
  scope?: 'global' | 'local';
}) {
  const colorToken = isColorTokenValue(value);

  return (
    <Row
      style={{
        width: '100%',
        minHeight: 34,
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: 6,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderTopColor: PAGE_SURFACE.borderColor,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
        {colorToken ? (
          <Box
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: String(value),
              borderWidth: 1,
              borderColor: PAGE_SURFACE.borderColor,
            }}
          />
        ) : (
          <Box
            style={{
              minWidth: 18,
              height: 18,
              paddingLeft: 5,
              paddingRight: 5,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              backgroundColor: PAGE_SURFACE.backgroundColor,
              borderWidth: 1,
              borderColor: PAGE_SURFACE.borderColor,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>123</Text>
          </Box>
        )}
        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: PAGE_SURFACE.textColor }}>{name}</Text>
      </Row>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        {scope ? (
          <MetaBadge
            label={scope === 'local' ? 'Local' : 'Global'}
            tone={scope === 'local' ? COLORS.accent : PAGE_SURFACE.mutedTextColor}
            background={PAGE_SURFACE.backgroundColor}
          />
        ) : null}
        <Text style={{ fontFamily: 'monospace', fontSize: 10, color: PAGE_SURFACE.mutedTextColor }}>
          {formatThemeTokenValue(value)}
        </Text>
      </Row>
    </Row>
  );
}

function ThemeTokenCategoryPanel({
  title,
  tokens,
  scope,
}: {
  title: string;
  tokens: Array<{ name: string; value: GalleryThemeTokenValue; scope?: 'global' | 'local' }>;
  scope?: 'global' | 'local';
}) {
  return (
    <Col
      style={{
        width: '100%',
        padding: 12,
        gap: 2,
        borderRadius: 10,
        backgroundColor: PAGE_SURFACE.backgroundColor,
        borderWidth: 1,
        borderColor: PAGE_SURFACE.borderColor,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>{title}</Text>
        <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
          {`${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}`}
        </Text>
      </Row>
      <Col style={{ width: '100%' }}>
        {tokens.map((token) => (
          <ThemeTokenRow
            key={`${title}:${token.name}`}
            name={token.name}
            value={token.value}
            scope={token.scope || scope}
          />
        ))}
      </Col>
    </Col>
  );
}

function ThemeClassifierPanel({ story }: { story: GalleryThemeStory }) {
  const classifiers = getThemeStoryClassifiers(story);

  return (
    <Col
      style={{
        width: '100%',
        padding: 12,
        gap: 8,
        borderRadius: 10,
        backgroundColor: PAGE_SURFACE.backgroundColor,
        borderWidth: 1,
        borderColor: PAGE_SURFACE.borderColor,
      }}
    >
      <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>CLASSIFIER FILES</Text>
        <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
          {`${classifiers.length} ${classifiers.length === 1 ? 'file' : 'files'}`}
        </Text>
      </Row>
      <Col style={{ width: '100%', gap: 8 }}>
        {classifiers.map((classifier) => (
          <Col
            key={`${classifier.kind}:${classifier.source}`}
            style={{
              width: '100%',
              padding: 10,
              gap: 4,
              borderRadius: 8,
              backgroundColor: PAGE_SURFACE.backgroundColor,
              borderWidth: 1,
              borderColor: PAGE_SURFACE.borderColor,
            }}
          >
            <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>
                {classifier.label || formatThemeClassifierLabel(classifier.kind)}
              </Text>
              <MetaBadge
                label={formatThemeClassifierLabel(classifier.kind)}
                tone={COLORS.accent}
                background={PAGE_SURFACE.backgroundColor}
              />
            </Row>
            <Text style={{ fontFamily: 'monospace', fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
              {classifier.source}
            </Text>
          </Col>
        ))}
      </Col>
    </Col>
  );
}

function ThemeVariantPanel({
  theme,
  globalTokens,
  active,
  onApply,
}: {
  theme: GalleryThemeVariant;
  globalTokens: GalleryThemeStory['globalTokens'];
  active?: boolean;
  onApply?: (() => void) | null;
}) {
  const mergedCategories = mergeThemeTokenCategories(globalTokens, theme.tokens);

  return (
    <Col
      style={{
        width: '100%',
        padding: 14,
        gap: 12,
        borderRadius: 10,
        backgroundColor: PAGE_SURFACE.backgroundColor,
        borderWidth: 1,
        borderColor: PAGE_SURFACE.borderColor,
      }}
    >
      <Col style={{ gap: 4 }}>
        <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Row style={{ alignItems: 'center', gap: 8, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>{theme.title}</Text>
            {active ? (
              <MetaBadge label="Active" tone={COLORS.accent} background={PAGE_SURFACE.backgroundColor} />
            ) : null}
          </Row>
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 9, color: PAGE_SURFACE.mutedTextColor }}>
              {`${countThemeTokens(theme.tokens)} local override${countThemeTokens(theme.tokens) === 1 ? '' : 's'}`}
            </Text>
            {onApply ? (
              <Pressable
                onPress={onApply}
                style={{
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderRadius: CHIP_RADIUS,
                  borderWidth: 1,
                  borderColor: active ? COLORS.accent : PAGE_SURFACE.borderColor,
                  backgroundColor: PAGE_SURFACE.backgroundColor,
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: active ? COLORS.accent : PAGE_SURFACE.textColor }}>
                  {active ? 'Applied' : 'Apply Globally'}
                </Text>
              </Pressable>
            ) : null}
          </Row>
        </Row>
        {theme.summary ? (
          <Text style={{ fontSize: 10, color: PAGE_SURFACE.mutedTextColor }}>{theme.summary}</Text>
        ) : null}
      </Col>

      <Col style={{ width: '100%', gap: 10 }}>
        {mergedCategories.map((category) => (
          <ThemeTokenCategoryPanel key={category.id} title={category.title} tokens={category.tokens} />
        ))}
      </Col>
    </Col>
  );
}

function ThemeStoryPreview({
  story,
  activeThemeId,
  onApplyTheme,
}: {
  story: GalleryThemeStory;
  activeThemeId: string;
  onApplyTheme: (id: string) => void;
}) {
  const globalTokenCount = countThemeTokens(story.globalTokens);
  const themeVariants = getThemeStoryVariants(story);

  return (
    <Col
      style={{
        width: '100%',
        gap: 16,
        alignItems: 'stretch',
      }}
    >
      {story.summary ? (
        <Text style={{ fontSize: 12, lineHeight: 18, color: PAGE_SURFACE.mutedTextColor }}>{story.summary}</Text>
      ) : null}

      <Row style={{ width: '100%', gap: 12, alignItems: 'stretch' }}>
        <Col
          style={{
            flexGrow: 1,
            flexBasis: 0,
            padding: 12,
            gap: 4,
            borderRadius: 10,
            backgroundColor: PAGE_SURFACE.backgroundColor,
            borderWidth: 1,
            borderColor: PAGE_SURFACE.borderColor,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>GLOBAL TOKENS</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>{String(globalTokenCount)}</Text>
        </Col>
        <Col
          style={{
            flexGrow: 1,
            flexBasis: 0,
            padding: 12,
            gap: 4,
            borderRadius: 10,
            backgroundColor: PAGE_SURFACE.backgroundColor,
            borderWidth: 1,
            borderColor: PAGE_SURFACE.borderColor,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>THEME VARIANTS</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>{String(themeVariants.length)}</Text>
        </Col>
        <Col
          style={{
            flexGrow: 1,
            flexBasis: 0,
            padding: 12,
            gap: 4,
            borderRadius: 10,
            backgroundColor: PAGE_SURFACE.backgroundColor,
            borderWidth: 1,
            borderColor: PAGE_SURFACE.borderColor,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: PAGE_SURFACE.mutedTextColor }}>CLASSIFIER FILES</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>
            {String(getThemeStoryClassifiers(story).length)}
          </Text>
        </Col>
      </Row>

      <ThemeClassifierPanel story={story} />

      <Col style={{ width: '100%', gap: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>Shared Global Tokens</Text>
        {story.globalTokens.map((category) => (
          <ThemeTokenCategoryPanel
            key={category.id}
            title={category.title}
            scope="global"
            tokens={Object.entries(category.tokens || {}).map(([name, value]) => ({ name, value }))}
          />
        ))}
      </Col>

      <Col style={{ width: '100%', gap: 12 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: PAGE_SURFACE.textColor }}>Theme Variants</Text>
        {themeVariants.map((theme) => {
          const option = findGalleryThemeOption(story.source, theme.id);
          return (
            <ThemeVariantPanel
              key={theme.id}
              theme={theme}
              globalTokens={story.globalTokens}
              active={option ? option.id === activeThemeId : false}
              onApply={option ? () => onApplyTheme(option.id) : null}
            />
          );
        })}
      </Col>
    </Col>
  );
}

function ComponentGalleryShell({ selection }: { selection: Selection | null }) {
  const galleryTheme = useGalleryTheme();
  const nav = useNavigate();
  const stories = useMemo(() => flattenStories(gallerySections), []);
  const navigationStories = useMemo(() => sortStoryEntries(stories), [stories]);
  const allGroupFilters = useMemo(() => collectGroupFilters(stories), [stories]);
  const allTagFilters = useMemo(() => collectTagFilters(stories), [stories]);
  const variantCount = useMemo(() => countVariants(stories), [stories]);
  const topLevelCount = useMemo(() => countStoriesByKind(stories, 'top-level'), [stories]);
  const activeGalleryThemeIndex = useMemo(
    () => galleryTheme.options.findIndex((option) => option.id === galleryTheme.activeThemeId),
    [galleryTheme.activeThemeId, galleryTheme.options]
  );
  const [navQuery, setNavQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | GallerySectionKind>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | string>('all');
  const [tagFilter, setTagFilter] = useState<'all' | string>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const updateNavQuery = (value: any) => {
    setNavQuery(getTextInputValue(value));
  };
  const filters = useMemo<NavigationFilters>(
    () => ({
      kind: kindFilter,
      groupId: groupFilter,
      tag: tagFilter,
    }),
    [groupFilter, kindFilter, tagFilter]
  );
  const storyFuzzyOptions = useMemo<FuzzySearchOptions<StoryEntry>>(
    () => ({
      mode: NAV_SEARCH_MODE,
      getCandidates: getSearchCandidates,
      sort: (left: FuzzySearchResult<StoryEntry>, right: FuzzySearchResult<StoryEntry>) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.item.story.title.localeCompare(right.item.story.title);
      },
    }),
    []
  );
  const visibleStoryBase = useMemo(
    () => filterStoryEntriesByFilters(navigationStories, filters),
    [filters, navigationStories]
  );
  const kindScopedStoryBase = useMemo(
    () =>
      filterStoryEntriesByFilters(navigationStories, {
        kind: 'all',
        groupId: groupFilter,
        tag: tagFilter,
      }),
    [groupFilter, navigationStories, tagFilter]
  );
  const groupScopedStoryBase = useMemo(
    () =>
      filterStoryEntriesByFilters(navigationStories, {
        kind: kindFilter,
        groupId: 'all',
        tag: tagFilter,
      }),
    [kindFilter, navigationStories, tagFilter]
  );
  const tagScopedStoryBase = useMemo(
    () =>
      filterStoryEntriesByFilters(navigationStories, {
        kind: kindFilter,
        groupId: groupFilter,
        tag: 'all',
      }),
    [groupFilter, kindFilter, navigationStories]
  );
  const visibleStoryMatches = useFuzzySearch(visibleStoryBase, navQuery, storyFuzzyOptions);
  const kindScopedStoryMatches = useFuzzySearch(kindScopedStoryBase, navQuery, storyFuzzyOptions);
  const groupScopedStoryMatches = useFuzzySearch(groupScopedStoryBase, navQuery, storyFuzzyOptions);
  const tagScopedStoryMatches = useFuzzySearch(tagScopedStoryBase, navQuery, storyFuzzyOptions);
  const visibleStories = useMemo(() => visibleStoryMatches.map((match) => match.item), [visibleStoryMatches]);
  const kindScopedStories = useMemo(() => kindScopedStoryMatches.map((match) => match.item), [kindScopedStoryMatches]);
  const groupScopedStories = useMemo(() => groupScopedStoryMatches.map((match) => match.item), [groupScopedStoryMatches]);
  const tagScopedStories = useMemo(() => tagScopedStoryMatches.map((match) => match.item), [tagScopedStoryMatches]);
  const kindFilterOptions = useMemo(
    () =>
      ([
        { id: 'top-level' as const, label: 'Top-Level', count: countStoriesByKind(kindScopedStories, 'top-level') },
        { id: 'atom' as const, label: 'Atoms', count: countStoriesByKind(kindScopedStories, 'atom') },
      ]).filter((option) => option.count > 0 || kindFilter === option.id),
    [kindFilter, kindScopedStories]
  );
  const groupFilters = useMemo(() => collectGroupFilters(groupScopedStories), [groupScopedStories]);
  const tagFilters = useMemo(() => collectTagFilters(tagScopedStories), [tagScopedStories]);
  const fallbackStories = visibleStories.length > 0 ? visibleStories : stories;
  const routedActive = useMemo(() => pickRoutedSelection(stories, selection), [stories, selection]);
  const fallbackActive = useMemo(() => pickSelection(fallbackStories, null), [fallbackStories]);
  const active = routedActive.entry ? routedActive : fallbackActive;
  const trimmedNavQuery = navQuery.trim();
  const visibleNavCategories = useMemo(
    () => groupVisibleStories(visibleStories, trimmedNavQuery.length > 0),
    [trimmedNavQuery, visibleStories]
  );
  const navListKey = `nav:${trimmedNavQuery.toLowerCase()}:${kindFilter}:${groupFilter}:${tagFilter}`;
  const visibleCategoryCount = useMemo(
    () => visibleNavCategories.length,
    [visibleNavCategories]
  );
  const navIndexes = useMemo(() => {
    const indexes: Record<string, number> = {};
    visibleStories.forEach((entry, index) => {
      indexes[entry.story.id] = index;
    });
    return indexes;
  }, [visibleStories]);
  const atomStoriesBySource = useMemo(() => {
    const entries = new Map<string, StoryEntry>();
    for (const entry of stories) {
      if (getSectionKind(entry.section) !== 'atom') continue;
      if (!entries.has(entry.story.source)) entries.set(entry.story.source, entry);
    }
    return entries;
  }, [stories]);
  const dataStoriesBySource = useMemo(() => {
    const entries = new Map<string, StoryEntry>();
    for (const entry of stories) {
      if (!isDataStory(entry.story)) continue;
      if (!entries.has(entry.story.source)) entries.set(entry.story.source, entry);
    }
    return entries;
  }, [stories]);
  const activeNavIndex = active.entry
    ? visibleStories.findIndex((entry) => entry.story.id === active.entry!.story.id)
    : -1;
  const hasActiveFilters = kindFilter !== 'all' || groupFilter !== 'all' || tagFilter !== 'all';
  const activeFilterCount = (kindFilter !== 'all' ? 1 : 0) + (groupFilter !== 'all' ? 1 : 0) + (tagFilter !== 'all' ? 1 : 0);
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (kindFilter !== 'all') parts.push(KIND_TITLES[kindFilter]);
    if (groupFilter !== 'all') {
      const selectedGroup = allGroupFilters.find((group) => group.id === groupFilter);
      if (selectedGroup) parts.push(selectedGroup.label);
    }
    if (tagFilter !== 'all') {
      const selectedTag = allTagFilters.find((tag) => tag.id === tagFilter);
      if (selectedTag) parts.push(selectedTag.label);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Kind, group, and tag';
  }, [allGroupFilters, allTagFilters, groupFilter, kindFilter, tagFilter]);

  useEffect(() => {
    if (groupFilter === 'all') return;
    if (!groupFilters.some((group) => group.id === groupFilter)) {
      setGroupFilter('all');
    }
  }, [groupFilter, groupFilters]);

  useEffect(() => {
    if (tagFilter === 'all') return;
    if (!tagFilters.some((tag) => tag.id === tagFilter)) {
      setTagFilter('all');
    }
  }, [tagFilter, tagFilters]);

  const selectStory = (entry: StoryEntry, variantId?: string) => {
    nav.push(storyRoutePath(entry, variantId));
  };

  const navigateStories = (delta: number) => {
    if (visibleStories.length === 0) return;
    const current = activeNavIndex >= 0 ? activeNavIndex : delta > 0 ? -1 : 0;
    const nextIndex = (current + delta + visibleStories.length) % visibleStories.length;
    selectStory(visibleStories[nextIndex]);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  };

  const clearFilters = () => {
    setKindFilter('all');
    setGroupFilter('all');
    setTagFilter('all');
  };

  const cycleGalleryTheme = (delta: number) => {
    if (galleryTheme.options.length === 0) return;
    const currentIndex = activeGalleryThemeIndex >= 0 ? activeGalleryThemeIndex : 0;
    const nextIndex = (currentIndex + delta + galleryTheme.options.length) % galleryTheme.options.length;
    galleryTheme.setTheme(galleryTheme.options[nextIndex].id);
  };

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg }}>
      <Col style={{ width: '100%', height: '100%' }}>
        <TitleBar />
        <Row
          style={{
            height: 76,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 24,
            paddingRight: 24,
            backgroundColor: COLORS.railBg,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
          }}
        >
          <Col style={{ gap: 4 }}>
            <Text style={{ fontSize: 19, fontWeight: 'bold', color: COLORS.text }}>Component Gallery</Text>
            <Text style={{ fontSize: 11, color: COLORS.muted }}>cart/component-gallery</Text>
          </Col>
          <Row style={{ gap: 10, alignItems: 'center' }}>
            {galleryTheme.options.length > 0 ? (
              <GalleryThemeToggle
                label="File Theme"
                activeLabel={galleryTheme.active?.label || 'Unassigned'}
                disabled={galleryTheme.options.length <= 1}
                onPrevious={() => cycleGalleryTheme(-1)}
                onNext={() => cycleGalleryTheme(1)}
              />
            ) : null}
            <Metric label="stories" value={String(stories.length)} tone={COLORS.accent} />
            <Metric label="top-level" value={String(topLevelCount)} tone={COLORS.compose} />
            <Metric label="variants" value={String(variantCount)} tone={COLORS.success} />
          </Row>
        </Row>

        <Row style={{ flexGrow: 1, flexBasis: 0 }}>
          <Col
            style={{
              width: 320,
              height: '100%',
              padding: 12,
              gap: 8,
              backgroundColor: COLORS.railBg,
              borderRightWidth: 1,
              borderRightColor: COLORS.border,
            }}
          >
            <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Col style={{ gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.faint }}>NAVIGATION</Text>
                <Text style={{ fontSize: 9, color: COLORS.muted }}>
                  {`${visibleStories.length} of ${stories.length} stories in ${visibleCategoryCount} categories`}
                </Text>
              </Col>
              <Row style={{ width: 130, gap: 6 }}>
                <NavActionButton
                  label="Prev"
                  disabled={visibleStories.length === 0}
                  onPress={() => navigateStories(-1)}
                />
                <NavActionButton
                  label="Next"
                  disabled={visibleStories.length === 0}
                  onPress={() => navigateStories(1)}
                />
              </Row>
            </Row>

            <Row
              style={{
                width: '100%',
                height: 32,
                alignItems: 'center',
                gap: 8,
                paddingLeft: 10,
                paddingRight: 8,
                borderRadius: 8,
                backgroundColor: COLORS.panelBg,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ width: 28, fontSize: 10, fontWeight: 'bold', color: COLORS.faint }}>Find</Text>
              <TextInput
                value={navQuery}
                onChangeText={updateNavQuery}
                placeholder="Search title, tag, group, file, atom, or data key"
                fontSize={12}
                color={COLORS.text}
                style={{
                  height: 22,
                  flexGrow: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                  backgroundColor: COLORS.panelBg,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: COLORS.text,
                }}
              />
              {navQuery.length > 0 && (
                <Pressable
                  onPress={() => setNavQuery('')}
                  style={{
                    width: 46,
                    height: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    backgroundColor: COLORS.railBg,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.muted }}>Clear</Text>
                </Pressable>
              )}
            </Row>

            {trimmedNavQuery ? (
              <Text style={{ fontSize: 9, color: COLORS.muted }}>
                {`${visibleStories.length} ${visibleStories.length === 1 ? 'match' : 'matches'} for "${trimmedNavQuery}"`}
              </Text>
            ) : null}

            <Col
              style={{
                width: '100%',
                padding: 10,
                gap: filtersExpanded ? 8 : 6,
                borderRadius: 8,
                backgroundColor: COLORS.panelBg,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Row style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.faint }}>FILTERS</Text>
                  <Text style={{ fontSize: 8, color: hasActiveFilters ? COLORS.accent : COLORS.muted }}>
                    {filterSummary}
                  </Text>
                </Col>
                <Row style={{ alignItems: 'center', gap: 6 }}>
                  {hasActiveFilters && (
                    <Pressable
                      onPress={clearFilters}
                      style={{
                        height: 22,
                        paddingLeft: 8,
                        paddingRight: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: CHIP_RADIUS,
                        backgroundColor: COLORS.railBg,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                      }}
                    >
                      <Text style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.muted }}>
                        {activeFilterCount > 1 ? `Clear ${activeFilterCount}` : 'Clear'}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setFiltersExpanded((current) => !current)}
                    style={{
                      height: 22,
                      paddingLeft: 8,
                      paddingRight: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: CHIP_RADIUS,
                      backgroundColor: COLORS.railBg,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.text }}>
                      {filtersExpanded ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </Row>
              </Row>

              {filtersExpanded && (
                <Col style={{ width: '100%', gap: 8 }}>
                  <FilterSection label="Kind">
                    <FilterChip label="All" active={kindFilter === 'all'} onPress={() => setKindFilter('all')} />
                    {kindFilterOptions.map((option) => (
                      <FilterChip
                        key={option.id}
                        label={option.label}
                        active={kindFilter === option.id}
                        onPress={() => setKindFilter(option.id)}
                      />
                    ))}
                  </FilterSection>

                  <FilterSection label="Group">
                    <FilterChip label="All" active={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
                    {groupFilters.map((group) => (
                      <FilterChip
                        key={group.id}
                        label={group.label}
                        active={groupFilter === group.id}
                        onPress={() => setGroupFilter(group.id)}
                      />
                    ))}
                  </FilterSection>

                  {tagFilters.length > 0 && (
                    <FilterSection label="Tag">
                      <FilterChip label="All" active={tagFilter === 'all'} onPress={() => setTagFilter('all')} />
                      {tagFilters.map((tag) => (
                        <FilterChip
                          key={tag.id}
                          label={tag.label}
                          active={tagFilter === tag.id}
                          onPress={() => setTagFilter(tag.id)}
                        />
                      ))}
                    </FilterSection>
                  )}
                </Col>
              )}
            </Col>

            {stories.length === 0 ? (
              <Box
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: COLORS.panelBg,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.muted }}>No stories yet</Text>
              </Box>
            ) : visibleStories.length === 0 ? (
              <Box
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: COLORS.panelBg,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.text }}>No matches</Text>
                <Text style={{ fontSize: 10, color: COLORS.muted }}>{navQuery}</Text>
              </Box>
            ) : (
              <ScrollView
                key={navListKey}
                showScrollbar
                style={{ width: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}
              >
                <Col style={{ width: '100%', gap: 8 }}>
                  {visibleNavCategories.map((category) => {
                    const groupKey = `category:${category.id}`;
                    const hasActiveStory = category.entries.some(
                      (entry) => entry.story.id === active.entry?.story.id
                    );
                    const collapsed = navQuery.length === 0 && !hasActiveStory && !!collapsedGroups[groupKey];

                    return (
                      <Col key={category.id} style={{ width: '100%', gap: 3 }}>
                        <StoryNavGroupHeader
                          title={category.title}
                          count={category.entries.length}
                          collapsed={collapsed}
                          onPress={() => toggleGroup(groupKey)}
                        />
                        {!collapsed && (
                          <Col style={{ width: '100%', gap: 3, paddingLeft: 10 }}>
                            {category.entries.map((entry) => (
                              <StoryNavItem
                                key={entry.story.id}
                                entry={entry}
                                active={active.entry?.story.id === entry.story.id}
                                index={navIndexes[entry.story.id] ?? 0}
                                onPress={() => selectStory(entry)}
                              />
                            ))}
                          </Col>
                        )}
                      </Col>
                    );
                  })}
                </Col>
              </ScrollView>
            )}
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
            <Col
              style={{
                minHeight: 74,
                justifyContent: 'center',
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 8,
                paddingBottom: 8,
                backgroundColor: COLORS.panelBg,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border,
              }}
            >
              <Col style={{ gap: 3, width: '100%' }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.text }}>
                  {active.entry ? active.entry.story.title : PAGE_SURFACE.label}
                </Text>
                <Text style={{ fontSize: 10, color: COLORS.muted }}>
                  {active.entry ? active.entry.story.source : 'cart/component-gallery'}
                </Text>
                {active.entry && (
                  <Row
                    style={{
                      width: '100%',
                      gap: 8,
                      marginTop: 6,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <MetaBadge
                      label={getStoryTypeLabel(active.entry)}
                      tone={
                        isThemeStory(active.entry.story)
                          ? COLORS.accent
                          : isDataStory(active.entry.story)
                          ? COLORS.success
                          : getSectionKind(active.entry.section) === 'top-level'
                            ? COLORS.warning
                            : COLORS.text
                      }
                      background={
                        isThemeStory(active.entry.story)
                          ? COLORS.railBg
                          : isDataStory(active.entry.story)
                          ? COLORS.railBg
                          : getSectionKind(active.entry.section) === 'top-level'
                          ? COLORS.panelRaised
                          : COLORS.railBg
                      }
                    />
                    <MetaBadge
                      label={getSectionGroup(active.entry.section).title}
                      tone={COLORS.accent}
                      background={COLORS.railBg}
                    />
                    {getDataStoryStorage(active.entry.story).map((storage) => (
                      <MetaBadge
                        key={storage}
                        label={formatStorageLabel(storage)}
                        tone={COLORS.success}
                        background={COLORS.railBg}
                      />
                    ))}
                    {getStoryTags(active.entry.section, active.entry.story).map((tag) => (
                        <MetaBadge
                          key={tag}
                          label={formatCanonicalTagLabel(tag)}
                          tone={getTagTone(tag)}
                          background={COLORS.railBg}
                        />
                      ))}
                    {getSectionKind(active.entry.section) === 'top-level' && (
                      <Text style={{ fontSize: 10, color: COLORS.muted }}>
                        {`${getComposedOf(active.entry.section).length} atom references`}
                      </Text>
                    )}
                    {isDataStory(active.entry.story) && getDataStoryReferences(active.entry.story).length > 0 && (
                      <Text style={{ fontSize: 10, color: COLORS.muted }}>
                        {`${getDataStoryReferences(active.entry.story).length} linked shapes`}
                      </Text>
                    )}
                    {isThemeStory(active.entry.story) && (
                      <Text style={{ fontSize: 10, color: COLORS.muted }}>
                        {`${getThemeStoryVariants(active.entry.story).length} theme variants · ${countThemeTokens(active.entry.story.globalTokens)} global tokens`}
                      </Text>
                    )}
                  </Row>
                )}
              </Col>

              {active.entry && (
                <CompositionPanel
                  key={active.entry.story.id}
                  entry={active.entry}
                  atomStoriesBySource={atomStoriesBySource}
                  onSelectAtom={selectStory}
                />
              )}

              {active.entry && getStoryVariants(active.entry.story).length > 1 && (
                <Row style={{ width: '100%', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {getStoryVariants(active.entry.story).map((variant) => (
                    <VariantButton
                      key={variant.id}
                      variant={variant}
                      active={active.variant?.id === variant.id}
                      onPress={() => selectStory(active.entry!, variant.id)}
                    />
                  ))}
                </Row>
              )}
            </Col>

            <ScrollView
              style={{
                flexGrow: 1,
                flexBasis: 0,
                backgroundColor: COLORS.previewBg,
              }}
              showScrollbar
            >
              <Box
                style={{
                  width: '100%',
                  minHeight: 760,
                  alignItems: 'center',
                  padding: 28,
                }}
              >
                <Box
                  style={{
                    width: PAGE_SURFACE.width,
                    minHeight: PAGE_SURFACE.minHeight,
                    padding: PAGE_SURFACE.padding,
                    borderRadius: PAGE_SURFACE.radius,
                    backgroundColor: PAGE_SURFACE.backgroundColor,
                    borderWidth: 1,
                    borderColor: PAGE_SURFACE.borderColor,
                  }}
                >
                  {active.entry ? (
                    isDataStory(active.entry.story) ? (
                      <DataStoryPreview
                        story={active.entry.story}
                        dataStoriesBySource={dataStoriesBySource}
                        onSelectReference={selectStory}
                      />
                    ) : isThemeStory(active.entry.story) ? (
                      <ThemeStoryPreview
                        story={active.entry.story}
                        activeThemeId={galleryTheme.activeThemeId}
                        onApplyTheme={galleryTheme.setTheme}
                      />
                    ) : (
                      <StoryStage>{active.variant ? active.variant.render() : <EmptyPreview />}</StoryStage>
                    )
                  ) : (
                    <StoryStage>
                      <EmptyPreview />
                    </StoryStage>
                  )}
                </Box>
              </Box>
            </ScrollView>
          </Col>
        </Row>
      </Col>
    </Box>
  );
}

function ComponentGalleryRoutes() {
  return (
    <>
      <Route path="/stories/:storyId/:variantId">
        {(params: any) => (
          <ComponentGalleryShell selection={routeSelection(params.storyId, params.variantId)} />
        )}
      </Route>
      <Route path="/stories/:storyId">
        {(params: any) => (
          <ComponentGalleryShell selection={routeSelection(params.storyId, ROUTE_DEFAULT_VARIANT)} />
        )}
      </Route>
      <Route path="/">
        <ComponentGalleryShell selection={null} />
      </Route>
      <Route fallback>
        <ComponentGalleryShell selection={null} />
      </Route>
    </>
  );
}

export default function ComponentGalleryApp() {
  return (
    <TooltipRoot>
      <Router initialPath={initialGalleryRoutePath()} hotKey={GALLERY_ROUTER_HOT_KEY}>
        <ComponentGalleryRoutes />
      </Router>
    </TooltipRoot>
  );
}
