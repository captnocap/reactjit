import { useMemo, useState } from 'react';
import { callHost } from '../../runtime/ffi';
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { COLORS, PAGE_SURFACE } from './surface';
import { gallerySections } from './registry';
import type { GallerySection, GalleryStory, GalleryVariant } from './types';

type StoryEntry = {
  section: GallerySection;
  story: GalleryStory;
};

type Selection = {
  storyId: string;
  variantId: string;
};

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
  for (const entry of stories) total += entry.story.variants.length;
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

function getStoryFile(entry: StoryEntry): string {
  const storySlug = entry.story.id.split('/')[0] || entry.section.id;
  return `cart/component-gallery/stories/${storySlug}.story.tsx`;
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getSearchText(entry: StoryEntry): string {
  const story = entry.story;
  const variants = story.variants.map((variant) => `${variant.name} ${variant.summary || ''}`).join(' ');
  const tags = story.tags ? story.tags.join(' ') : '';
  const storyFile = getStoryFile(entry);
  const raw = `${entry.section.id} ${entry.section.title} ${story.id} ${story.title} ${story.source} ${getSourceName(
    story.source
  )} ${storyFile} ${getSourceName(storyFile)} ${story.summary || ''} ${story.owner || ''} ${
    story.status || ''
  } ${tags} ${variants}`;
  return `${raw.toLowerCase()} ${normalizeSearch(raw)}`;
}

function filterStoryEntries(stories: StoryEntry[], query: string): StoryEntry[] {
  const rawQuery = query.trim().toLowerCase();
  const normalizedQuery = normalizeSearch(query);
  if (!rawQuery && !normalizedQuery) return stories;
  return stories.filter((entry) => {
    const text = getSearchText(entry);
    return (rawQuery && text.includes(rawQuery)) || (normalizedQuery && text.includes(normalizedQuery));
  });
}

function pickSelection(stories: StoryEntry[], selection: Selection | null): {
  entry: StoryEntry | null;
  variant: GalleryVariant | null;
} {
  if (stories.length === 0) return { entry: null, variant: null };

  const entry =
    (selection && stories.find((candidate) => candidate.story.id === selection.storyId)) || stories[0];
  const variant =
    (selection && entry.story.variants.find((candidate) => candidate.id === selection.variantId)) ||
    entry.story.variants[0] ||
    null;

  return { entry, variant };
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
  const status = entry.story.status || 'draft';
  const variantCount = entry.story.variants.length;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: '100%',
        height: 32,
        paddingLeft: 10,
        paddingRight: 10,
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
          <Text style={{ fontSize: 13, fontWeight: active ? 'bold' : 'normal', color: active ? COLORS.text : COLORS.muted }}>
            {entry.story.title}
          </Text>
        </Col>
        <Text style={{ width: 22, fontSize: 10, fontWeight: 'bold', color: active ? COLORS.accent : COLORS.faint }}>
          {String(index + 1)}
        </Text>
        <Text style={{ width: 26, fontSize: 10, color: variantCount > 1 ? COLORS.success : COLORS.faint }}>
          {variantCount > 1 ? `${variantCount}v` : status.slice(0, 1)}
        </Text>
      </Row>
    </Pressable>
  );
}

function ActiveFilePanel({ entry }: { entry: StoryEntry | null }) {
  return (
    <Col
      style={{
        width: '100%',
        minHeight: 42,
        padding: 8,
        gap: 3,
        borderRadius: 8,
        backgroundColor: COLORS.panelBg,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.text }}>
        {entry ? entry.story.title : 'No component selected'}
      </Text>
      <Text style={{ fontSize: 8, color: COLORS.muted }}>
        {entry ? getSourceName(entry.story.source) : 'component file'}
      </Text>
      <Text style={{ fontSize: 8, color: COLORS.faint }}>
        {entry ? getSourceName(getStoryFile(entry)) : 'story file'}
      </Text>
    </Col>
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
        No component stories registered
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

export default function ComponentGalleryApp() {
  const stories = useMemo(() => flattenStories(gallerySections), []);
  const navigationStories = useMemo(() => sortStoryEntries(stories), [stories]);
  const variantCount = useMemo(() => countVariants(stories), [stories]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [navQuery, setNavQuery] = useState('');
  const active = useMemo(() => pickSelection(stories, selection), [stories, selection]);
  const visibleStories = useMemo(() => filterStoryEntries(navigationStories, navQuery), [navigationStories, navQuery]);
  const activeNavIndex = active.entry
    ? visibleStories.findIndex((entry) => entry.story.id === active.entry!.story.id)
    : -1;

  const selectStory = (entry: StoryEntry) => {
    setSelection({
      storyId: entry.story.id,
      variantId: entry.story.variants[0]?.id || '',
    });
  };

  const navigateStories = (delta: number) => {
    if (visibleStories.length === 0) return;
    const current = activeNavIndex >= 0 ? activeNavIndex : delta > 0 ? -1 : 0;
    const nextIndex = (current + delta + visibleStories.length) % visibleStories.length;
    selectStory(visibleStories[nextIndex]);
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
            <Metric label="stories" value={String(stories.length)} tone={COLORS.accent} />
            <Metric label="variants" value={String(variantCount)} tone={COLORS.success} />
            <Metric label="surface" value={`${PAGE_SURFACE.width}px`} tone={COLORS.warning} />
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
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.faint }}>COMPONENTS</Text>
                <Text style={{ fontSize: 9, color: COLORS.muted }}>
                  {`${visibleStories.length} of ${stories.length} components`}
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
                onChangeText={setNavQuery}
                placeholder="Search title or file path"
                style={{
                  flexGrow: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                  color: COLORS.text,
                  fontSize: 12,
                  backgroundColor: COLORS.panelBg,
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

            <ActiveFilePanel entry={active.entry} />

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
              <ScrollView style={{ width: '100%', flexGrow: 1, flexBasis: 0 }}>
                <Col style={{ width: '100%', gap: 3 }}>
                  {visibleStories.map((entry, index) => (
                    <StoryNavItem
                      key={entry.story.id}
                      entry={entry}
                      active={active.entry?.story.id === entry.story.id}
                      index={index}
                      onPress={() => selectStory(entry)}
                    />
                  ))}
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
              </Col>

              {active.entry && active.entry.story.variants.length > 1 && (
                <Row style={{ width: '100%', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  {active.entry.story.variants.map((variant) => (
                    <VariantButton
                      key={variant.id}
                      variant={variant}
                      active={active.variant?.id === variant.id}
                      onPress={() =>
                        setSelection({
                          storyId: active.entry!.story.id,
                          variantId: variant.id,
                        })
                      }
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
                  <StoryStage>{active.variant ? active.variant.render() : <EmptyPreview />}</StoryStage>
                </Box>
              </Box>
            </ScrollView>
          </Col>
        </Row>
      </Col>
    </Box>
  );
}
