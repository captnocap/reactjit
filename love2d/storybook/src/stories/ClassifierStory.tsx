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

const S = classifiers;

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
      <S.ETile style={{
        width: 64, height: 72,
        backgroundColor: showBack ? bg : tc.surface,
        borderRadius: 6, borderColor: bg, padding: 4,
        transform: { scaleX: Math.max(0.01, scaleX) },
      }}>
        {showBack ? (
          <S.EBack>
            <Text style={{ color: '#000', fontSize: 6, fontWeight: 'bold' }}>{el.symbol}</Text>
            <S.EPropRow><S.EPropLabel>{'Grp'}</S.EPropLabel><S.EPropValue>{`${el.group}`}</S.EPropValue></S.EPropRow>
            <S.EPropRow><S.EPropLabel>{'Per'}</S.EPropLabel><S.EPropValue>{`${el.period}`}</S.EPropValue></S.EPropRow>
            <S.EPropRow><S.EPropLabel>{'Phase'}</S.EPropLabel><S.EPropValue>{el.phase}</S.EPropValue></S.EPropRow>
            {el.electronegativity !== null && (
              <S.EPropRow><S.EPropLabel>{'EN'}</S.EPropLabel><S.EPropValue>{`${el.electronegativity}`}</S.EPropValue></S.EPropRow>
            )}
            <S.EPropRow><S.EPropLabel>{'Mass'}</S.EPropLabel><S.EPropValue>{el.mass.toFixed(1)}</S.EPropValue></S.EPropRow>
          </S.EBack>
        ) : (
          <S.EFront>
            <S.ENumber style={{ color: bg }}>{`${el.number}`}</S.ENumber>
            <S.ESymbol style={{ color: tc.text }}>{el.symbol}</S.ESymbol>
            <S.EMass style={{ color: tc.muted }}>{el.mass.toFixed(2)}</S.EMass>
          </S.EFront>
        )}
      </S.ETile>
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
      <S.Tile style={{
        backgroundColor: showBack ? bg : tc.surface,
        borderColor: bg,
        transform: { scaleX: Math.max(0.01, scaleX) },
      }}>
        {showBack ? (
          <S.TileBack>
            <S.TileBackSym>{el.symbol}</S.TileBackSym>
            <S.TilePropRow><S.TilePropLabel>{'Grp'}</S.TilePropLabel><S.TilePropVal>{`${el.group}`}</S.TilePropVal></S.TilePropRow>
            <S.TilePropRow><S.TilePropLabel>{'Per'}</S.TilePropLabel><S.TilePropVal>{`${el.period}`}</S.TilePropVal></S.TilePropRow>
            <S.TilePropRow><S.TilePropLabel>{'Phase'}</S.TilePropLabel><S.TilePropVal>{el.phase}</S.TilePropVal></S.TilePropRow>
            {el.electronegativity !== null && (
              <S.TilePropRow><S.TilePropLabel>{'EN'}</S.TilePropLabel><S.TilePropVal>{`${el.electronegativity}`}</S.TilePropVal></S.TilePropRow>
            )}
            <S.TilePropRow><S.TilePropLabel>{'Mass'}</S.TilePropLabel><S.TilePropVal>{el.mass.toFixed(1)}</S.TilePropVal></S.TilePropRow>
          </S.TileBack>
        ) : (
          <S.TileFront>
            <S.TileNumber color={bg}>{`${el.number}`}</S.TileNumber>
            <S.TileSymbol color={tc.text}>{el.symbol}</S.TileSymbol>
            <S.TileMass color={tc.muted}>{el.mass.toFixed(2)}</S.TileMass>
          </S.TileFront>
        )}
      </S.Tile>
    </Pressable>
  );
}

// ── Demo sections ─────────────────────────────────────────

function TypographyDemo() {
  return (
    <S.Section>
      <S.Label>{'Typography'}</S.Label>
      <S.Divider />
      <S.Title>{'The quick brown fox'}</S.Title>
      <S.Subtitle>{'Jumps over the lazy dog'}</S.Subtitle>
      <S.Body>{'Body text — 14px, standard weight, readable color. This is what most content looks like when rendered through a classifier.'}</S.Body>
      <S.Caption>{'Caption — small, muted, for metadata and timestamps'}</S.Caption>
      <S.Code>{'const x = classifier("Box", { padding: 16 })'}</S.Code>
    </S.Section>
  );
}

function CardDemo() {
  return (
    <S.Section>
      <S.Label>{'Cards'}</S.Label>
      <S.Divider />
      <S.Row>
        <S.Card style={{ flexGrow: 1 }}>
          <S.Label>{'Metrics'}</S.Label>
          <S.Title>{'1,247'}</S.Title>
          <S.Caption>{'Active users today'}</S.Caption>
        </S.Card>
        <S.Card style={{ flexGrow: 1 }}>
          <S.Label>{'Uptime'}</S.Label>
          <S.Title>{'99.9%'}</S.Title>
          <S.Caption>{'Last 30 days'}</S.Caption>
        </S.Card>
        <S.Card style={{ flexGrow: 1 }}>
          <S.Label>{'Latency'}</S.Label>
          <S.Title>{'12ms'}</S.Title>
          <S.Caption>{'p95 response time'}</S.Caption>
        </S.Card>
      </S.Row>
    </S.Section>
  );
}

// ── Three-row comparison ──────────────────────────────────

const SAMPLE = ['H', 'Li', 'Fe', 'Al', 'Si', 'Cl', 'Ne', 'Nd', 'Au', 'U'];

function TileRow({ label, badgeColor, desc, children }: { label: string; badgeColor: string; desc: string; children: React.ReactNode }) {
  return (
    <>
      <S.Row>
        <S.Badge style={{ backgroundColor: badgeColor }}>
          <Text size={11} bold color="#1e1e2e">{label}</Text>
        </S.Badge>
        <S.Caption>{desc}</S.Caption>
      </S.Row>
      <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {children}
      </S.RowG8>
    </>
  );
}

function ElementTileComparison() {
  return (
    <S.Section>
      <S.Label>{'ElementTile — Component vs Partial vs Classified Component'}</S.Label>
      <S.Divider />

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
    </S.Section>
  );
}

// ── Main ──────────────────────────────────────────────────

export function ClassifierStory() {
  return (
    <S.Page style={{ backgroundColor: '#11111b' }}>
      <S.Row>
        <S.Title>{'Classifier'}</S.Title>
        <S.Spacer />
        <S.Caption>{`${Object.keys(classifiers).length} classifiers registered`}</S.Caption>
      </S.Row>
      <S.Subtitle>{'Global named primitives — one name, one definition, project-wide'}</S.Subtitle>
      <ElementTileComparison />
      <TypographyDemo />
      <CardDemo />
    </S.Page>
  );
}
