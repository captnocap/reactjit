/**
 * ClassifierStory — test page for the classifier system.
 *
 * Registers classifiers globally, then uses them to build a page entirely
 * from classified primitives. Includes a side-by-side comparison of the
 * real ElementTile component vs a classifier-only rebuild.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, classifier, classifiers, useSpring } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { ElementTile } from '../../../packages/chemistry/src';
import { getElement, ELEMENTS } from '../../../packages/chemistry/src/elements';

// ── Register classifiers (global, once) ───────────────────

classifier({
  // Layout
  Page:       { type: 'Box', fill: true, padding: 24, gap: 24 },
  Section:    { type: 'Box', gap: 12, padding: 20, radius: 12, style: { backgroundColor: '#1e1e2e' } },
  Row:        { type: 'Row', gap: 12, align: 'center' },
  Spacer:     { type: 'Box', grow: true },

  // Typography
  Title:      { type: 'Text', size: 32, bold: true, color: '#cdd6f4' },
  Subtitle:   { type: 'Text', size: 18, color: '#a6adc8' },
  Label:      { type: 'Text', size: 14, bold: true, color: '#bac2de' },
  Body:       { type: 'Text', size: 14, color: '#cdd6f4' },
  Caption:    { type: 'Text', size: 11, color: '#6c7086' },
  Code:       { type: 'Text', size: 13, color: '#a6e3a1', font: 'monospace' },

  // Surfaces
  Card:       { type: 'Box', padding: 16, radius: 10, gap: 8, style: { backgroundColor: '#313244' } },
  Chip:       { type: 'Box', direction: 'row', padding: 6, px: 12, radius: 12, style: { backgroundColor: '#45475a' } },
  Divider:    { type: 'Box', style: { height: 1, backgroundColor: '#45475a' } },
  Badge:      { type: 'Box', px: 8, py: 2, radius: 6, style: { backgroundColor: '#f38ba8' } },
  Well:       { type: 'Box', padding: 12, radius: 8, style: { backgroundColor: '#181825', borderWidth: 1, borderColor: '#313244' } },

  // ElementTile classifiers — single-primitive building blocks
  ETile:      { type: 'Box', style: { justifyContent: 'center', alignItems: 'center', borderWidth: 1 } },
  EFront:     { type: 'Box', style: { gap: 2, alignItems: 'center' } },
  EBack:      { type: 'Box', style: { gap: 1, alignItems: 'center', width: '100%' } },
  ENumber:    { type: 'Text', size: 6 },
  ESymbol:    { type: 'Text', size: 16, bold: true },
  EMass:      { type: 'Text', size: 6 },
  EPropRow:   { type: 'Box', direction: 'row', style: { justifyContent: 'space-between', width: '100%' } },
  EPropLabel: { type: 'Text', size: 5, style: { color: 'rgba(0,0,0,0.5)' } },
  EPropValue: { type: 'Text', size: 5, color: '#000' },
});

const C = classifiers;

// ── Category colors (same as chemistry package) ───────────

const CATEGORY_COLORS: Record<string, string> = {
  'alkali-metal': '#7b6faa',
  'alkaline-earth': '#9a9cc4',
  'transition-metal': '#de9a9a',
  'post-transition-metal': '#8fbc8f',
  'metalloid': '#c8c864',
  'nonmetal': '#59b5e6',
  'halogen': '#d4a844',
  'noble-gas': '#c87e4a',
  'lanthanide': '#c45879',
  'actinide': '#d4879a',
};

// ── Classifier-based ElementTile ──────────────────────────

function ClassifiedElementTile({ element, size = 64 }: { element: string; size?: number }) {
  const tc = useThemeColors();
  const el = getElement(element);
  if (!el) return null;

  const [flipped, setFlipped] = useState(false);
  const prog = useSpring(flipped ? 1 : 0, { stiffness: 200, damping: 18 });
  const scaleX = Math.abs(Math.cos(prog * Math.PI));
  const showBack = prog > 0.5;

  const bg = CATEGORY_COLORS[el.category] ?? '#868e96';
  const s = size / 32;
  const h = size * 36 / 32;

  return (
    <Pressable onPress={() => setFlipped(f => !f)}>
      <C.ETile style={{
        width: size,
        height: h,
        backgroundColor: showBack ? bg : tc.surface,
        borderRadius: 3 * s,
        borderColor: bg,
        padding: 2 * s,
        transform: { scaleX: Math.max(0.01, scaleX) },
      }}>
        {showBack ? (
          <C.EBack>
            <Text style={{ color: '#000', fontSize: 3 * s, fontWeight: 'bold' }}>{el.symbol}</Text>
            <C.EPropRow>
              <C.EPropLabel style={{ fontSize: Math.max(2.5 * s, 6) }}>{'Grp'}</C.EPropLabel>
              <C.EPropValue style={{ fontSize: Math.max(2.5 * s, 6) }}>{`${el.group}`}</C.EPropValue>
            </C.EPropRow>
            <C.EPropRow>
              <C.EPropLabel style={{ fontSize: Math.max(2.5 * s, 6) }}>{'Per'}</C.EPropLabel>
              <C.EPropValue style={{ fontSize: Math.max(2.5 * s, 6) }}>{`${el.period}`}</C.EPropValue>
            </C.EPropRow>
            <C.EPropRow>
              <C.EPropLabel style={{ fontSize: Math.max(2.5 * s, 6) }}>{'Phase'}</C.EPropLabel>
              <C.EPropValue style={{ fontSize: Math.max(2.5 * s, 6) }}>{el.phase}</C.EPropValue>
            </C.EPropRow>
            {el.electronegativity !== null && (
              <C.EPropRow>
                <C.EPropLabel style={{ fontSize: Math.max(2.5 * s, 6) }}>{'EN'}</C.EPropLabel>
                <C.EPropValue style={{ fontSize: Math.max(2.5 * s, 6) }}>{`${el.electronegativity}`}</C.EPropValue>
              </C.EPropRow>
            )}
            <C.EPropRow>
              <C.EPropLabel style={{ fontSize: Math.max(2.5 * s, 6) }}>{'Mass'}</C.EPropLabel>
              <C.EPropValue style={{ fontSize: Math.max(2.5 * s, 6) }}>{el.mass.toFixed(1)}</C.EPropValue>
            </C.EPropRow>
          </C.EBack>
        ) : (
          <C.EFront style={{ gap: 1 * s }}>
            <C.ENumber style={{ fontSize: 3 * s, color: bg }}>{`${el.number}`}</C.ENumber>
            <C.ESymbol style={{ fontSize: 8 * s, color: tc.text }}>{el.symbol}</C.ESymbol>
            <C.EMass style={{ fontSize: 3 * s, color: tc.muted }}>{el.mass.toFixed(2)}</C.EMass>
          </C.EFront>
        )}
      </C.ETile>
    </Pressable>
  );
}

// ── Demo sections ─────────────────────────────────────────

function TypographyDemo() {
  return (
    <C.Section>
      <C.Label>{'Typography'}</C.Label>
      <C.Divider />
      <C.Title>{'The quick brown fox'}</C.Title>
      <C.Subtitle>{'Jumps over the lazy dog'}</C.Subtitle>
      <C.Body>{'Body text — 14px, standard weight, readable color. This is what most content looks like when rendered through a classifier.'}</C.Body>
      <C.Caption>{'Caption — small, muted, for metadata and timestamps'}</C.Caption>
      <C.Code>{'const x = classifier("Box", { padding: 16 })'}</C.Code>
    </C.Section>
  );
}

function CardDemo() {
  return (
    <C.Section>
      <C.Label>{'Cards'}</C.Label>
      <C.Divider />
      <C.Row>
        <C.Card style={{ flexGrow: 1 }}>
          <C.Label>{'Metrics'}</C.Label>
          <C.Title>{'1,247'}</C.Title>
          <C.Caption>{'Active users today'}</C.Caption>
        </C.Card>
        <C.Card style={{ flexGrow: 1 }}>
          <C.Label>{'Uptime'}</C.Label>
          <C.Title>{'99.9%'}</C.Title>
          <C.Caption>{'Last 30 days'}</C.Caption>
        </C.Card>
        <C.Card style={{ flexGrow: 1 }}>
          <C.Label>{'Latency'}</C.Label>
          <C.Title>{'12ms'}</C.Title>
          <C.Caption>{'p95 response time'}</C.Caption>
        </C.Card>
      </C.Row>
    </C.Section>
  );
}

function ChipDemo() {
  const tags = ['classifier', 'global', 'single-primitive', 'no-duplicates', 'user-wins'];
  return (
    <C.Section>
      <C.Label>{'Chips & Badges'}</C.Label>
      <C.Divider />
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <C.Chip key={tag}>
            <C.Caption>{tag}</C.Caption>
          </C.Chip>
        ))}
      </Box>
      <C.Row>
        <C.Badge><Text size={11} bold color="#1e1e2e">{'NEW'}</Text></C.Badge>
        <C.Badge style={{ backgroundColor: '#a6e3a1' }}><Text size={11} bold color="#1e1e2e">{'PASS'}</Text></C.Badge>
        <C.Badge style={{ backgroundColor: '#f9e2af' }}><Text size={11} bold color="#1e1e2e">{'WARN'}</Text></C.Badge>
      </C.Row>
    </C.Section>
  );
}

function OverrideDemo() {
  const [count, setCount] = useState(0);
  return (
    <C.Section>
      <C.Label>{'Override test — user props win'}</C.Label>
      <C.Divider />
      <C.Row>
        <C.Card style={{ backgroundColor: '#89b4fa', flexGrow: 1 }}>
          <C.Label color="#1e1e2e">{'Card with overridden bg'}</C.Label>
          <C.Body color="#313244">{'style={{ backgroundColor: "#89b4fa" }}'}</C.Body>
        </C.Card>
        <C.Card style={{ flexGrow: 1, borderWidth: 2, borderColor: '#f38ba8' }}>
          <C.Label>{'Card with added border'}</C.Label>
          <C.Body>{'Default bg preserved, border added'}</C.Body>
        </C.Card>
      </C.Row>
      <C.Well>
        <C.Row>
          <C.Body>{`Count: ${count}`}</C.Body>
          <C.Spacer />
          <Pressable onClick={() => setCount((c) => c + 1)}>
            <C.Chip style={{ backgroundColor: '#89b4fa' }}>
              <C.Caption color="#1e1e2e">{'Increment'}</C.Caption>
            </C.Chip>
          </Pressable>
          <Pressable onClick={() => setCount(0)}>
            <C.Chip>
              <C.Caption>{'Reset'}</C.Caption>
            </C.Chip>
          </Pressable>
        </C.Row>
      </C.Well>
    </C.Section>
  );
}

// ── Side-by-side ElementTile comparison ───────────────────

const SAMPLE_ELEMENTS = ['H', 'Li', 'Fe', 'Al', 'Si', 'Cl', 'Ne', 'Nd', 'Au', 'U'];

function ElementTileComparison() {
  return (
    <C.Section>
      <C.Label>{'ElementTile — Component vs Classifier (side by side)'}</C.Label>
      <C.Divider />

      <C.Row>
        <C.Badge style={{ backgroundColor: '#89b4fa' }}>
          <Text size={11} bold color="#1e1e2e">{'COMPONENT'}</Text>
        </C.Badge>
        <C.Caption>{'Original ElementTile from @reactjit/chemistry'}</C.Caption>
      </C.Row>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {SAMPLE_ELEMENTS.map(sym => (
          <ElementTile key={sym} element={sym} size={64} />
        ))}
      </Box>

      <Box style={{ height: 16 }} />

      <C.Row>
        <C.Badge style={{ backgroundColor: '#a6e3a1' }}>
          <Text size={11} bold color="#1e1e2e">{'CLASSIFIER'}</Text>
        </C.Badge>
        <C.Caption>{'Rebuilt using only classifiers — zero component imports'}</C.Caption>
      </C.Row>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {SAMPLE_ELEMENTS.map(sym => (
          <ClassifiedElementTile key={sym} element={sym} size={64} />
        ))}
      </Box>
    </C.Section>
  );
}

// ── Main ──────────────────────────────────────────────────

export function ClassifierStory() {
  return (
    <C.Page style={{ backgroundColor: '#11111b' }}>
      <C.Row>
        <C.Title>{'Classifier'}</C.Title>
        <C.Spacer />
        <C.Caption>{`${Object.keys(classifiers).length} classifiers registered`}</C.Caption>
      </C.Row>
      <C.Subtitle>{'Global named primitives — one name, one definition, project-wide'}</C.Subtitle>
      <ElementTileComparison />
      <TypographyDemo />
      <CardDemo />
      <ChipDemo />
      <OverrideDemo />
    </C.Page>
  );
}
