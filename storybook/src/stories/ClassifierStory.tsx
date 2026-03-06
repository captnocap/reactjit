/**
 * ClassifierStory — test page for the classifier system.
 *
 * Registers a set of classifiers globally, then uses them to build
 * a page entirely from classified primitives. No raw Box/Text — everything
 * goes through the registry.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, classifier, classifiers } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

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
});

// ── Convenience alias ─────────────────────────────────────

const C = classifiers;

// ── Demo components (built entirely from classifiers) ─────

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

function NestingDemo() {
  return (
    <C.Section>
      <C.Label>{'Nesting — classifiers compose naturally'}</C.Label>
      <C.Divider />
      <C.Card>
        <C.Row>
          <C.Badge><Text size={11} bold color="#1e1e2e">{'1'}</Text></C.Badge>
          <C.Body>{'Card > Row > Badge + Body'}</C.Body>
        </C.Row>
        <C.Divider />
        <C.Well>
          <C.Row>
            <C.Chip>
              <C.Caption>{'nested chip'}</C.Caption>
            </C.Chip>
            <C.Caption>{'Card > Well > Row > Chip + Caption'}</C.Caption>
          </C.Row>
        </C.Well>
      </C.Card>
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
      <TypographyDemo />
      <CardDemo />
      <ChipDemo />
      <OverrideDemo />
      <NestingDemo />
    </C.Page>
  );
}
