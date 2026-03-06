/**
 * ClassifierStory — test page for the classifier system.
 *
 * Three-row ElementTile comparison:
 *   1. Component — raw primitives with inline styles
 *   2. Partial — classifiers for structure, style still inline
 *   3. Classified Component — built entirely from classifiers, only dynamic values in JSX
 *
 * Classifiers are vocabulary (named primitives). Classified Components are
 * sentences (compositions of classifiers with logic). The classifier doesn't
 * replace the component — it's what the component is built from.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, classifier, classifiers, useSpring } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { ElementTile } from '../../../packages/chemistry/src';
import { getElement } from '../../../packages/chemistry/src/elements';

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

  // ElementTile v1 — half-committed (structural only, sizing still inline)
  ETile:      { type: 'Box', style: { justifyContent: 'center', alignItems: 'center', borderWidth: 1 } },
  EFront:     { type: 'Box', style: { gap: 2, alignItems: 'center' } },
  EBack:      { type: 'Box', style: { gap: 1, alignItems: 'center', width: '100%' } },
  ENumber:    { type: 'Text', size: 6 },
  ESymbol:    { type: 'Text', size: 16, bold: true },
  EMass:      { type: 'Text', size: 6 },
  EPropRow:   { type: 'Box', direction: 'row', style: { justifyContent: 'space-between', width: '100%' } },
  EPropLabel: { type: 'Text', size: 5, style: { color: 'rgba(0,0,0,0.5)' } },
  EPropValue: { type: 'Text', size: 5, color: '#000' },

  // ElementTile v2 — full commitment (complete default appearance for size=64)
  // s = 64/32 = 2, h = 64*36/32 = 72, tiny = max(2.5*2, 6) = 6
  Tile:       { type: 'Box', style: { width: 64, height: 72, borderRadius: 6, borderWidth: 1, padding: 4, justifyContent: 'center', alignItems: 'center' } },
  TileFront:  { type: 'Box', style: { gap: 2, alignItems: 'center' } },
  TileBack:   { type: 'Box', style: { gap: 1, alignItems: 'center', width: '100%' } },
  TileNumber: { type: 'Text', size: 6 },
  TileSymbol: { type: 'Text', size: 16, bold: true },
  TileMass:   { type: 'Text', size: 6 },
  TilePropRow:   { type: 'Box', direction: 'row', style: { justifyContent: 'space-between', width: '100%' } },
  TilePropLabel: { type: 'Text', size: 6, style: { color: 'rgba(0,0,0,0.5)' } },
  TilePropVal:   { type: 'Text', size: 6, color: '#000' },
  TileBackSym:   { type: 'Text', size: 6, bold: true, color: '#000' },
});

const C = classifiers;

// ── Category colors (same as chemistry package) ───────────

const CAT: Record<string, string> = {
  'alkali-metal': '#7b6faa', 'alkaline-earth': '#9a9cc4',
  'transition-metal': '#de9a9a', 'post-transition-metal': '#8fbc8f',
  'metalloid': '#c8c864', 'nonmetal': '#59b5e6',
  'halogen': '#d4a844', 'noble-gas': '#c87e4a',
  'lanthanide': '#c45879', 'actinide': '#d4879a',
};

// ── Partial: classifiers for structure, style still inline ──

function V1Tile({ element }: { element: string }) {
  const tc = useThemeColors();
  const el = getElement(element);
  if (!el) return null;

  const [flipped, setFlipped] = useState(false);
  const prog = useSpring(flipped ? 1 : 0, { stiffness: 200, damping: 18 });
  const scaleX = Math.abs(Math.cos(prog * Math.PI));
  const showBack = prog > 0.5;
  const bg = CAT[el.category] ?? '#868e96';

  return (
    <Pressable onPress={() => setFlipped(f => !f)}>
      <C.ETile style={{
        width: 64, height: 72,
        backgroundColor: showBack ? bg : tc.surface,
        borderRadius: 6, borderColor: bg, padding: 4,
        transform: { scaleX: Math.max(0.01, scaleX) },
      }}>
        {showBack ? (
          <C.EBack>
            <Text style={{ color: '#000', fontSize: 6, fontWeight: 'bold' }}>{el.symbol}</Text>
            <C.EPropRow><C.EPropLabel>{'Grp'}</C.EPropLabel><C.EPropValue>{`${el.group}`}</C.EPropValue></C.EPropRow>
            <C.EPropRow><C.EPropLabel>{'Per'}</C.EPropLabel><C.EPropValue>{`${el.period}`}</C.EPropValue></C.EPropRow>
            <C.EPropRow><C.EPropLabel>{'Phase'}</C.EPropLabel><C.EPropValue>{el.phase}</C.EPropValue></C.EPropRow>
            {el.electronegativity !== null && (
              <C.EPropRow><C.EPropLabel>{'EN'}</C.EPropLabel><C.EPropValue>{`${el.electronegativity}`}</C.EPropValue></C.EPropRow>
            )}
            <C.EPropRow><C.EPropLabel>{'Mass'}</C.EPropLabel><C.EPropValue>{el.mass.toFixed(1)}</C.EPropValue></C.EPropRow>
          </C.EBack>
        ) : (
          <C.EFront>
            <C.ENumber style={{ color: bg }}>{`${el.number}`}</C.ENumber>
            <C.ESymbol style={{ color: tc.text }}>{el.symbol}</C.ESymbol>
            <C.EMass style={{ color: tc.muted }}>{el.mass.toFixed(2)}</C.EMass>
          </C.EFront>
        )}
      </C.ETile>
    </Pressable>
  );
}

// ── Classified Component: built from classifiers, only dynamic in JSX

function V2Tile({ element }: { element: string }) {
  const tc = useThemeColors();
  const el = getElement(element);
  if (!el) return null;

  const [flipped, setFlipped] = useState(false);
  const prog = useSpring(flipped ? 1 : 0, { stiffness: 200, damping: 18 });
  const scaleX = Math.abs(Math.cos(prog * Math.PI));
  const showBack = prog > 0.5;
  const bg = CAT[el.category] ?? '#868e96';

  return (
    <Pressable onPress={() => setFlipped(f => !f)}>
      <C.Tile style={{
        backgroundColor: showBack ? bg : tc.surface,
        borderColor: bg,
        transform: { scaleX: Math.max(0.01, scaleX) },
      }}>
        {showBack ? (
          <C.TileBack>
            <C.TileBackSym>{el.symbol}</C.TileBackSym>
            <C.TilePropRow><C.TilePropLabel>{'Grp'}</C.TilePropLabel><C.TilePropVal>{`${el.group}`}</C.TilePropVal></C.TilePropRow>
            <C.TilePropRow><C.TilePropLabel>{'Per'}</C.TilePropLabel><C.TilePropVal>{`${el.period}`}</C.TilePropVal></C.TilePropRow>
            <C.TilePropRow><C.TilePropLabel>{'Phase'}</C.TilePropLabel><C.TilePropVal>{el.phase}</C.TilePropVal></C.TilePropRow>
            {el.electronegativity !== null && (
              <C.TilePropRow><C.TilePropLabel>{'EN'}</C.TilePropLabel><C.TilePropVal>{`${el.electronegativity}`}</C.TilePropVal></C.TilePropRow>
            )}
            <C.TilePropRow><C.TilePropLabel>{'Mass'}</C.TilePropLabel><C.TilePropVal>{el.mass.toFixed(1)}</C.TilePropVal></C.TilePropRow>
          </C.TileBack>
        ) : (
          <C.TileFront>
            <C.TileNumber color={bg}>{`${el.number}`}</C.TileNumber>
            <C.TileSymbol color={tc.text}>{el.symbol}</C.TileSymbol>
            <C.TileMass color={tc.muted}>{el.mass.toFixed(2)}</C.TileMass>
          </C.TileFront>
        )}
      </C.Tile>
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

// ── Three-row comparison ──────────────────────────────────

const SAMPLE = ['H', 'Li', 'Fe', 'Al', 'Si', 'Cl', 'Ne', 'Nd', 'Au', 'U'];

function TileRow({ label, badgeColor, desc, children }: { label: string; badgeColor: string; desc: string; children: React.ReactNode }) {
  return (
    <>
      <C.Row>
        <C.Badge style={{ backgroundColor: badgeColor }}>
          <Text size={11} bold color="#1e1e2e">{label}</Text>
        </C.Badge>
        <C.Caption>{desc}</C.Caption>
      </C.Row>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {children}
      </Box>
    </>
  );
}

function ElementTileComparison() {
  return (
    <C.Section>
      <C.Label>{'ElementTile — Component vs Partial vs Classified Component'}</C.Label>
      <C.Divider />

      <TileRow label="COMPONENT" badgeColor="#89b4fa" desc="Raw primitives with inline styles">
        {SAMPLE.map(sym => <ElementTile key={sym} element={sym} size={64} />)}
      </TileRow>

      <Box style={{ height: 8 }} />

      <TileRow label="PARTIAL" badgeColor="#f9e2af" desc="Classifiers for structure only — sizing and color still inline (wrong)">
        {SAMPLE.map(sym => <V1Tile key={sym} element={sym} />)}
      </TileRow>

      <Box style={{ height: 8 }} />

      <TileRow label="CLASSIFIED" badgeColor="#a6e3a1" desc="Classified Component — built from classifiers, only dynamic values in JSX">
        {SAMPLE.map(sym => <V2Tile key={sym} element={sym} />)}
      </TileRow>
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
    </C.Page>
  );
}
