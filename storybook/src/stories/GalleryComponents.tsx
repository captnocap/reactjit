/**
 * GalleryComponents — Thumbnail renderers and live preview renderers
 * for the Component Gallery story.
 *
 * Each component gets:
 *   - A Thumb* component (tiny visual for the tab cell, ~68×54px)
 *   - A Preview* component (full-size live demo for the main area)
 *
 * To add a new component:
 *   bash scripts/scaffold_gallery_component.sh <Name> [package]
 */

import React, { useState } from 'react';
import {
  Box, Text, Image, Pressable, ScrollView, CodeBlock,
  Badge, Card, ProgressBar, Table, Sparkline,
  ChatInput, MessageBubble, Tabs,
  NavPanel, Toolbar, Breadcrumbs,
  SearchBar, CommandPalette,
  LoadingDots,
  Slider, Switch, Checkbox, Radio, RadioGroup, Select,
  BarChart, LineChart, PieChart, RadarChart, CandlestickChart, OrderBook,
  ImageGallery, ContextMenu, Math as MathTex,
  MessageList, ActionBar, FlatList, classifiers as S} from '../../../packages/core/src';
import { ElementTile, ElementCard, PeriodicTable, MoleculeCard, ElectronShell, ReactionView } from '../../../packages/chemistry/src';
import { Knob, Fader, Meter, LEDIndicator, PadButton, StepSequencer, TransportBar, PianoKeyboard, XYPad, PitchWheel } from '../../../packages/controls/src';
import { TickerSymbol, TickerTape, PortfolioCard, RSIGauge, MACDPanel } from '../../../packages/finance/src';
import { Clock, Stopwatch, Countdown } from '../../../packages/time/src';
import { MinimalChat } from '../../../packages/ai/src';
import { Spreadsheet } from '../../../packages/data/src';
import { StatCard, NowPlayingCard, RepoCard } from '../../../packages/apis/src';

// ── Types ────────────────────────────────────────────────

export type ThemeColors = {
  text: string;
  bg: string;
  bgElevated: string;
  surface: string;
  border: string;
  muted: string;
  primary: string;
  [key: string]: string;
};

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
};

// ── Sample data ─────────────────────────────────────────

const SAMPLE_TABLE_COLS = [
  { key: 'name', title: 'Component', width: 100 },
  { key: 'pkg', title: 'Package', width: 70 },
  { key: 'status', title: 'Status', width: 60 },
];

const SAMPLE_TABLE_DATA = [
  { name: 'Card', pkg: 'core', status: 'Stable' },
  { name: 'Knob', pkg: 'controls', status: 'Stable' },
  { name: 'Clock', pkg: 'time', status: 'Stable' },
  { name: 'ElementTile', pkg: 'chemistry', status: 'Stable' },
];

const SAMPLE_CODE = `import { Card, Badge, Tabs } from '@reactjit/core';
import { Knob } from '@reactjit/controls';

function Dashboard() {
  return (
    <Card title="Status">
      <Badge label="Online" variant="success" />
      <Knob value={0.5} label="Volume" />
    </Card>
  );
}`;

import { register } from './galleryRegistry';

// ══════════════════════════════════════════════════════════
// Components are registered below via register() calls.
// To add a new one: bash scripts/scaffold_gallery_component.sh <Name> [pkg]
// ══════════════════════════════════════════════════════════
