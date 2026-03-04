/**
 * Scrape Story — useScrape hook demo.
 *
 * Shows both expert mode (CSS selectors) and guided mode (browse → pick by ID).
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView, Input } from '../../../packages/core/src';
import { useScrape } from '../../../packages/core/src/useScrape';
import type { ScrapeElement, PickMap } from '../../../packages/core/src/useScrape';
import { useIFTTT } from '../../../packages/core/src/useIFTTT';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const C = {
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  surface: '#313244',
};

// ── Demo: Guided mode (the star) ──────────────────────────

function GuidedDemo() {
  const c = useThemeColors();
  const [url, setUrlInput] = useState('https://example.com');
  const scrape = useScrape<Record<string, string>>(null);
  const [selected, setSelected] = useState<Record<string, number | { id: number; attr: string }>>({});
  const [fieldName, setFieldName] = useState('');
  const [pickAttr, setPickAttr] = useState('');

  const handleFetch = () => scrape.setUrl(url);
  const handlePick = (el: ScrapeElement) => {
    const name = fieldName || `field_${el.id}`;
    const target = pickAttr ? { id: el.id, attr: pickAttr } : el.id;
    const next = { ...selected, [name]: target };
    setSelected(next);
    scrape.pick(next);
    setFieldName('');
    setPickAttr('');
  };
  const handleClear = () => {
    setSelected({});
    scrape.pick({});
  };

  return (
    <Box style={{ gap: 12 }}>
      {/* Step 1: Enter URL */}
      <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 12, color: C.teal, fontWeight: 'normal' }}>{'Step 1: Enter a URL'}</Text>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ flexGrow: 1 }}>
            <Input value={url} onChangeText={setUrlInput} placeholder="https://..." style={{ fontSize: 12 }} />
          </Box>
          <Pressable onPress={handleFetch}>
            <Box style={{ backgroundColor: C.teal, borderRadius: 6, padding: 6, paddingLeft: 14, paddingRight: 14 }}>
              <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Fetch'}</Text>
            </Box>
          </Pressable>
        </Box>
        {scrape.loading ? (
          <Text style={{ fontSize: 11, color: C.yellow }}>{'Fetching...'}</Text>
        ) : scrape.error ? (
          <Text style={{ fontSize: 11, color: C.red }}>{`Error: ${scrape.error}`}</Text>
        ) : null}
      </Box>

      {/* Step 2: Browse tagged elements */}
      {scrape.elements.length > 0 ? (
        <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 12, color: C.teal, fontWeight: 'normal' }}>
            {'Step 2: Browse the page — tap any element to select it'}
          </Text>
          <Text style={{ fontSize: 10, color: c.textDim }}>
            {`${scrape.elements.length} elements found`}
          </Text>

          {/* Field name + attr input */}
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ width: 120 }}>
              <Input value={fieldName} onChangeText={setFieldName} placeholder="field name" style={{ fontSize: 11 }} />
            </Box>
            <Box style={{ width: 80 }}>
              <Input value={pickAttr} onChangeText={setPickAttr} placeholder="@attr" style={{ fontSize: 11 }} />
            </Box>
            <Text style={{ fontSize: 10, color: c.textDim }}>{'(optional)'}</Text>
          </Box>

          <ScrollView style={{ height: 280 }}>
            <Box style={{ gap: 2 }}>
              {scrape.elements.map(el => (
                <ElementRow
                  key={el.id}
                  el={el}
                  isSelected={Object.values(selected).some(
                    v => (typeof v === 'number' ? v : v.id) === el.id
                  )}
                  selectedAs={Object.entries(selected).find(
                    ([, v]) => (typeof v === 'number' ? v : v.id) === el.id
                  )?.[0]}
                  onPress={() => handlePick(el)}
                />
              ))}
            </Box>
          </ScrollView>
        </Box>
      ) : null}

      {/* Step 3: See your data */}
      {Object.keys(selected).length > 0 ? (
        <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: C.teal, fontWeight: 'normal' }}>
              {'Step 3: Your extracted data'}
            </Text>
            <Pressable onPress={handleClear}>
              <Box style={{ backgroundColor: c.surface2, borderRadius: 4, padding: 4, paddingLeft: 8, paddingRight: 8 }}>
                <Text style={{ fontSize: 10, color: c.textDim }}>{'Clear'}</Text>
              </Box>
            </Pressable>
          </Box>

          {/* Show pick map as code */}
          <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
            <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
              {'scrape.pick(' + JSON.stringify(selected, null, 2) + ')'}
            </Text>
          </Box>

          {/* Show extracted data */}
          {scrape.data ? (
            <Box style={{ gap: 4 }}>
              {Object.entries(scrape.data).map(([key, value]) => (
                <DataRow key={key} label={key} value={value as any} />
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function ElementRow({
  el, isSelected, selectedAs, onPress,
}: {
  el: ScrapeElement;
  isSelected: boolean;
  selectedAs?: string;
  onPress: () => void;
}) {
  const c = useThemeColors();

  // Build the display line
  let tag = el.tag;
  if (el.htmlId) tag += `#${el.htmlId}`;
  if (el.classes.length > 0) tag += '.' + el.classes.slice(0, 2).join('.');

  const attrStr = Object.entries(el.attrs)
    .slice(0, 2)
    .map(([k, v]) => `${k}="${v.length > 30 ? v.slice(0, 30) + '...' : v}"`)
    .join('  ');

  return (
    <Pressable onPress={onPress}>
      {({ hovered }: { hovered: boolean }) => (
        <Box style={{
          flexDirection: 'row',
          gap: 6,
          padding: 4,
          paddingLeft: 8 + el.depth * 8,
          paddingRight: 8,
          borderRadius: 4,
          backgroundColor: isSelected ? C.teal + '22'
            : hovered ? c.surface2
            : 'transparent',
        }}>
          {/* ID badge */}
          <Box style={{
            width: 28,
            backgroundColor: isSelected ? C.teal : c.surface2,
            borderRadius: 3,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 9, color: isSelected ? '#1e1e2e' : c.textDim }}>
              {String(el.id)}
            </Text>
          </Box>

          {/* Tag */}
          <Box style={{ width: 100 }}>
            <Text style={{ fontSize: 10, color: C.blue, fontFamily: 'monospace' }}>
              {tag.length > 16 ? tag.slice(0, 16) + '..' : tag}
            </Text>
          </Box>

          {/* Text preview */}
          <Box style={{ flexGrow: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 10, color: c.text }}>
              {el.text ? (el.text.length > 40 ? `"${el.text.slice(0, 40)}..."` : `"${el.text}"`) : ''}
            </Text>
          </Box>

          {/* Notable attrs */}
          {attrStr ? (
            <Text style={{ fontSize: 9, color: C.peach }}>{attrStr}</Text>
          ) : null}

          {/* Selected-as badge */}
          {selectedAs ? (
            <Box style={{ backgroundColor: C.green, borderRadius: 3, padding: 2, paddingLeft: 6, paddingRight: 6 }}>
              <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{selectedAs}</Text>
            </Box>
          ) : null}
        </Box>
      )}
    </Pressable>
  );
}

// ── Demo: Expert mode ─────────────────────────────────────

function ExpertDemo() {
  const c = useThemeColors();
  const { data, loading, error, refetch } = useScrape(
    'https://example.com',
    {
      title: 'h1',
      description: 'p:first',
      link: 'a@href',
    },
  );

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"useScrape('https://example.com', {\n  title: 'h1',\n  description: 'p:first',\n  link: 'a@href',\n})"}
        </Text>
      </Box>

      {loading ? (
        <Text style={{ fontSize: 11, color: C.yellow }}>{'Loading...'}</Text>
      ) : error ? (
        <Text style={{ fontSize: 11, color: C.red }}>{`Error: ${error}`}</Text>
      ) : data ? (
        <Box style={{ gap: 4 }}>
          <DataRow label="title" value={data.title} />
          <DataRow label="description" value={data.description} />
          <DataRow label="link" value={data.link} />
        </Box>
      ) : null}

      <Pressable onPress={refetch}>
        <Box style={{ backgroundColor: C.blue, borderRadius: 6, padding: 6, paddingLeft: 12, paddingRight: 12, alignSelf: 'start' }}>
          <Text style={{ fontSize: 11, color: '#1e1e2e' }}>{'Refetch'}</Text>
        </Box>
      </Pressable>
    </Box>
  );
}

// ── Demo: IFTTT combo ─────────────────────────────────────

function IFTTTComboDemo() {
  const c = useThemeColors();
  const [alerts, setAlerts] = useState<string[]>([]);

  const { data, loading } = useScrape(
    'https://example.com',
    { title: 'h1' },
  );

  useIFTTT(
    () => data?.title != null && typeof data.title === 'string' && data.title.includes('Example'),
    () => setAlerts(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] Title matched!`]),
  );

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 8 }}>
      <Box style={{ backgroundColor: '#1e1e2e', borderRadius: 6, padding: 8 }}>
        <Text style={{ fontSize: 10, color: C.mauve, fontFamily: 'monospace' }}>
          {"const { data } = useScrape(url, { title: 'h1' });\nuseIFTTT(() => data?.title?.includes('Example'), () => alert())"}
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: loading ? C.yellow : data ? C.green : C.red,
        }} />
        <Text style={{ fontSize: 12, color: c.text }}>
          {loading ? 'Scraping...' : data?.title ? `Title: "${data.title}"` : 'No data'}
        </Text>
      </Box>

      {alerts.length > 0 ? (
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 10, color: C.mauve }}>{'IFTTT alerts:'}</Text>
          {alerts.map((a, i) => (
            <Text key={i} style={{ fontSize: 10, color: C.peach }}>{a}</Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

// ── Demo: Selector reference ──────────────────────────────

function SelectorReference() {
  const c = useThemeColors();

  const rows = [
    { sel: "'h1'", desc: 'Tag name — text content' },
    { sel: "'.price'", desc: 'Class name' },
    { sel: "'#main'", desc: 'ID' },
    { sel: "'div.card'", desc: 'Tag + class' },
    { sel: "'.nav .link'", desc: 'Descendant' },
    { sel: "'a@href'", desc: 'Extract attribute' },
    { sel: "'img@src'", desc: 'Image source' },
    { sel: "'div@html'", desc: 'Inner HTML' },
    { sel: "'h1:first'", desc: 'Force single result' },
  ];

  return (
    <Box style={{ backgroundColor: c.surface1, borderRadius: 8, padding: 12, gap: 4 }}>
      {rows.map((r, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Box style={{ width: 140 }}>
            <Text style={{ fontSize: 10, color: C.teal, fontFamily: 'monospace' }}>{r.sel}</Text>
          </Box>
          <Text style={{ fontSize: 10, color: c.textDim }}>{r.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Shared ─────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string | string[] | null | undefined }) {
  const c = useThemeColors();
  const display = value == null
    ? 'null'
    : Array.isArray(value)
      ? `[${value.length}] ${value.slice(0, 3).join(', ')}${value.length > 3 ? '...' : ''}`
      : String(value).slice(0, 100);

  return (
    <Box style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ fontSize: 11, color: C.blue, width: 90 }}>{label}</Text>
      <Text style={{ fontSize: 11, color: value == null ? C.red : c.text, flexShrink: 1 }}>
        {display}
      </Text>
    </Box>
  );
}

// ── Main story ────────────────────────────────────────────

export function ScrapeStory() {
  return (
    <StoryPage title="useScrape" subtitle="Declarative web scraping — expert or guided">
      <StorySection
        title="Guided Mode"
        description="Don't know CSS? Just fetch, browse, and pick by ID"
      >
        <GuidedDemo />
      </StorySection>

      <StorySection title="Expert Mode" description="CSS selectors for those who know them">
        <ExpertDemo />
      </StorySection>

      <StorySection title="Selector Reference" description="CSS selector cheat sheet">
        <SelectorReference />
      </StorySection>

      <StorySection title="IFTTT Combo" description="Scrape + IFTTT = reactive automation">
        <IFTTTComboDemo />
      </StorySection>
    </StoryPage>
  );
}
