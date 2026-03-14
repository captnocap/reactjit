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

export function ThumbCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 50, borderRadius: 3, overflow: 'hidden' }}>
        <S.BorderBottom style={{ paddingLeft: 4, paddingTop: 2, paddingBottom: 2 }}>
          <S.BoldText style={{ fontSize: 4 }}>{'Title'}</S.BoldText>
        </S.BorderBottom>
        <Box style={{ padding: 3, gap: 2 }}>
          <Box style={{ width: 30, height: 2, backgroundColor: c.muted, borderRadius: 1 }} />
          <Box style={{ width: 20, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
        </Box>
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbBadge({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 3 }}>
      <S.RowG2>
        <Box style={{ backgroundColor: '#166534', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#bbf7d0', fontSize: 3.5 }}>{'OK'}</Text>
        </Box>
        <Box style={{ backgroundColor: '#854d0e', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#fef08a', fontSize: 3.5 }}>{'WARN'}</Text>
        </Box>
      </S.RowG2>
      <S.RowG2>
        <Box style={{ backgroundColor: '#991b1b', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#fecaca', fontSize: 3.5 }}>{'ERR'}</Text>
        </Box>
        <Box style={{ backgroundColor: '#1e40af', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#bfdbfe', fontSize: 3.5 }}>{'INFO'}</Text>
        </Box>
      </S.RowG2>
    </S.FullCenter>
  );
}

export function ThumbTabs({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderBottomWidth: 2, borderColor: C.accent }}>
          <Text style={{ color: c.text, fontSize: 4 }}>{'Tab A'}</Text>
        </Box>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
          <S.DimNano>{'Tab B'}</S.DimNano>
        </Box>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
          <S.DimNano>{'Tab C'}</S.DimNano>
        </Box>
      </Box>
    </S.FullCenter>
  );
}

export function ThumbNavPanel({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 36, borderRadius: 2, padding: 3, gap: 2 }}>
        <Text style={{ color: c.muted, fontSize: 3 }}>{'MENU'}</Text>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 2, paddingLeft: 3, paddingTop: 1, paddingBottom: 1, borderLeftWidth: 2, borderColor: C.accent }}>
          <Text style={{ color: c.text, fontSize: 3.5 }}>{'Home'}</Text>
        </Box>
        <Box style={{ paddingLeft: 3, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: c.muted, fontSize: 3.5 }}>{'Files'}</Text>
        </Box>
        <Box style={{ paddingLeft: 3, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: c.muted, fontSize: 3.5 }}>{'Config'}</Text>
        </Box>
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbToolbar({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ flexDirection: 'row', gap: 2, borderRadius: 3, padding: 3 }}>
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
        <S.VertDivider style={{ height: 8 }} />
        <Box style={{ width: 8, height: 8, backgroundColor: C.accentDim, borderRadius: 2 }} />
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbBreadcrumbs({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowCenter style={{ gap: 2 }}>
        <S.DimNano>{'Home'}</S.DimNano>
        <S.DimNano>{'/'}</S.DimNano>
        <S.DimNano>{'Docs'}</S.DimNano>
        <S.DimNano>{'/'}</S.DimNano>
        <Text style={{ color: c.text, fontSize: 4 }}>{'API'}</Text>
      </S.RowCenter>
    </S.FullCenter>
  );
}

export function ThumbTable({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.Bordered style={{ width: 52, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ flexDirection: 'row', backgroundColor: c.surface, paddingLeft: 3, paddingTop: 2, paddingBottom: 2 }}>
          <S.BoldText style={{ fontSize: 3, width: 20 }}>{'Name'}</S.BoldText>
          <S.BoldText style={{ fontSize: 3 }}>{'Val'}</S.BoldText>
        </Box>
        {[0, 1].map(i => (
          <Box key={i} style={{ flexDirection: 'row', paddingLeft: 3, paddingTop: 1, paddingBottom: 1, backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
            <Box style={{ width: 20, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
            <Box style={{ width: 10, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.3, marginLeft: 4 }} />
          </Box>
        ))}
      </S.Bordered>
    </S.FullCenter>
  );
}

export function ThumbProgressBar({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 4, padding: 6 }}>
      <S.StoryFill style={{ width: 50, backgroundColor: c.surface, overflow: 'hidden' }}>
        <Box style={{ width: '85%', height: 4, backgroundColor: C.accent, borderRadius: 2 }} />
      </S.StoryFill>
      <S.StoryFill style={{ width: 50, backgroundColor: c.surface, overflow: 'hidden' }}>
        <S.StoryFill style={{ width: '45%', backgroundColor: '#3b82f6' }} />
      </S.StoryFill>
      <S.StoryFill style={{ width: 50, backgroundColor: c.surface, overflow: 'hidden' }}>
        <S.StoryFill style={{ width: '92%', backgroundColor: '#10b981' }} />
      </S.StoryFill>
    </S.FullCenter>
  );
}

export function ThumbSparkline({ c }: { c: ThemeColors }) {
  const pts = [3, 5, 2, 7, 4, 8, 6, 9, 5, 7];
  const max = 9;
  return (
    <S.CenterW100 style={{ height: '100%', justifyContent: 'end', paddingBottom: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 1, alignItems: 'end', height: 24 }}>
        {pts.map((v, i) => (
          <Box key={i} style={{ width: 3, height: (v / max) * 20 + 2, backgroundColor: '#10b981', borderRadius: 1, opacity: 0.6 + (v / max) * 0.4 }} />
        ))}
      </Box>
    </S.CenterW100>
  );
}

export function ThumbMessageBubble({ c }: { c: ThemeColors }) {
  return (
    <S.FullSize style={{ justifyContent: 'center', padding: 4, gap: 3 }}>
      <Box style={{ alignSelf: 'start', backgroundColor: '#1e293b', borderRadius: 4, borderTopLeftRadius: 1, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, maxWidth: 40 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 3.5 }}>{'Hello!'}</Text>
      </Box>
      <Box style={{ alignSelf: 'end', backgroundColor: '#2563eb', borderRadius: 4, borderTopRightRadius: 1, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, maxWidth: 40 }}>
        <Text style={{ color: '#fff', fontSize: 3.5 }}>{'Hi there'}</Text>
      </Box>
    </S.FullSize>
  );
}

export function ThumbChatInput({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ padding: 4 }}>
      <S.RowCenterBorder style={{ width: 54, gap: 2, backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, padding: 3 }}>
        <Box style={{ flexGrow: 1, height: 6, backgroundColor: c.bg, borderRadius: 2 }}>
          <Text style={{ color: c.muted, fontSize: 3, paddingLeft: 2 }}>{'Type...'}</Text>
        </Box>
        <S.Center style={{ width: 10, height: 8, backgroundColor: '#3b82f6', borderRadius: 2 }}>
          <Text style={{ color: '#fff', fontSize: 3 }}>{'>'}</Text>
        </S.Center>
      </S.RowCenterBorder>
    </S.FullCenter>
  );
}

export function ThumbSearchBar({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ padding: 4 }}>
      <S.RowCenterBorder style={{ width: 54, gap: 3, backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, padding: 3 }}>
        <S.Dot6 style={{ width: 6, borderWidth: 1, borderColor: c.muted }} />
        <Box style={{ flexGrow: 1, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.3 }} />
      </S.RowCenterBorder>
    </S.FullCenter>
  );
}

export function ThumbCodeBlock({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ padding: 4 }}>
      <Box style={{ width: 52, backgroundColor: '#0d1117', borderRadius: 3, padding: 3, gap: 2, borderWidth: 1, borderColor: '#30363d' }}>
        <S.RowG2>
          <Box style={{ width: 12, height: 3, backgroundColor: '#ff7b72', borderRadius: 1 }} />
          <Box style={{ width: 16, height: 3, backgroundColor: '#79c0ff', borderRadius: 1 }} />
        </S.RowG2>
        <S.RowG2 style={{ paddingLeft: 4 }}>
          <Box style={{ width: 10, height: 3, backgroundColor: '#7ee787', borderRadius: 1 }} />
          <Box style={{ width: 8, height: 3, backgroundColor: '#d2a8ff', borderRadius: 1 }} />
        </S.RowG2>
        <S.RowG2>
          <Box style={{ width: 6, height: 3, backgroundColor: '#ff7b72', borderRadius: 1 }} />
        </S.RowG2>
      </Box>
    </S.FullCenter>
  );
}

export function ThumbLoadingDots({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowG4>
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3 }} />
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3, opacity: 0.6 }} />
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3, opacity: 0.3 }} />
      </S.RowG4>
    </S.FullCenter>
  );
}

export function ThumbElementTile({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.Center style={{ width: 32, height: 36, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: '#de9a9a', padding: 2, gap: 1 }}>
        <Text style={{ color: '#de9a9a', fontSize: 3 }}>{'26'}</Text>
        <S.BoldText style={{ fontSize: 8 }}>{'Fe'}</S.BoldText>
        <Text style={{ color: c.muted, fontSize: 3 }}>{'55.84'}</Text>
      </S.Center>
    </S.FullCenter>
  );
}

export function ThumbElementCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <Box style={{ width: 52, height: 44, backgroundColor: c.bgElevated, borderRadius: 4, borderWidth: 1, borderColor: '#de9a9a', padding: 3, gap: 1 }}>
        <S.RowCenter style={{ gap: 3 }}>
          <S.Center style={{ width: 12, height: 12, backgroundColor: '#de9a9a', borderRadius: 2 }}>
            <Text style={{ color: '#000', fontSize: 5, fontWeight: 'bold' }}>{'Au'}</Text>
          </S.Center>
          <S.BoldText style={{ fontSize: 5 }}>{'Gold'}</S.BoldText>
        </S.RowCenter>
        <S.RowSpaceBetween>
          <Text style={{ color: c.muted, fontSize: 3 }}>{'Mass'}</Text>
          <Text style={{ color: c.text, fontSize: 3 }}>{'196.97'}</Text>
        </S.RowSpaceBetween>
        <S.RowSpaceBetween>
          <Text style={{ color: c.muted, fontSize: 3 }}>{'Phase'}</Text>
          <Text style={{ color: c.text, fontSize: 3 }}>{'solid'}</Text>
        </S.RowSpaceBetween>
      </Box>
    </S.FullCenter>
  );
}

export function ThumbKnob({ c }: { c: ThemeColors }) {
  // Arc of dots (270° sweep, gap at bottom) + dark body + indicator
  const dotCount = 12;
  const radius = 12;
  const dotR = 1.2;
  const cx = 34;
  const cy = 22;
  const normalized = 0.7;
  const activeDots = Math.floor(normalized * (dotCount - 1) + 0.5) + 1;
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <Box style={{ width: 68, height: 30, position: 'relative' }}>
        {/* Arc dots */}
        {Array.from({ length: dotCount }).map((_, i) => {
          const t = i / (dotCount - 1);
          const angleDeg = 135 + t * 270;
          const rad = (angleDeg * Math.PI) / 180;
          const dx = Math.cos(rad) * radius;
          const dy = Math.sin(rad) * radius;
          const active = i < activeDots;
          return (
            <Box key={i} style={{
              position: 'absolute',
              left: cx + dx - dotR, top: cy + dy - dotR,
              width: dotR * 2, height: dotR * 2, borderRadius: dotR,
              backgroundColor: active ? '#f59e0b' : '#333',
            }} />
          );
        })}
        {/* Body */}
        <Box style={{
          position: 'absolute',
          left: cx - 8, top: cy - 8,
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444',
        }} />
        {/* Indicator line (pointing at ~70% angle) */}
        {(() => {
          const angle = 135 + normalized * 270;
          const rad = (angle * Math.PI) / 180;
          const len = 6;
          const ex = Math.cos(rad) * len;
          const ey = Math.sin(rad) * len;
          return (
            <Box style={{
              position: 'absolute',
              left: cx + ex - 1, top: cy + ey - 1,
              width: 2, height: 2, borderRadius: 1,
              backgroundColor: '#f59e0b',
            }} />
          );
        })()}
      </Box>
      <Text style={{ color: c.muted, fontSize: 3.5 }}>{'Gain'}</Text>
    </S.FullCenter>
  );
}

export function ThumbFader({ c }: { c: ThemeColors }) {
  // Matches lua/fader.lua: thin center track + colored fill from bottom + wide thumb bar
  const trackH = 36;
  const trackW = 2;
  const thumbW = 16;
  const thumbH = 5;
  const ratio = 0.7;
  const fillH = trackH * ratio;
  const thumbY = trackH - fillH - thumbH / 2;
  return (
    <S.FullCenter>
      <Box style={{ width: 20, height: trackH, position: 'relative' }}>
        {/* Inactive track */}
        <Box style={{ position: 'absolute', left: 9, top: 0, width: trackW, height: trackH, backgroundColor: '#1e1e1e', borderRadius: 1 }} />
        {/* Active fill (from bottom) */}
        <Box style={{ position: 'absolute', left: 9, bottom: 0, width: trackW, height: fillH, backgroundColor: '#f59e0b', borderRadius: 1 }} />
        {/* Thumb bar */}
        <Box style={{ position: 'absolute', left: (20 - thumbW) / 2, top: thumbY, width: thumbW, height: thumbH, backgroundColor: '#ccc', borderRadius: 1, borderWidth: 1, borderColor: '#666' }} />
      </Box>
    </S.FullCenter>
  );
}

export function ThumbMeter({ c }: { c: ThemeColors }) {
  const segs = [1, 1, 1, 1, 1, 0.6, 0.3, 0];
  return (
    <S.FullCenter>
      <Box style={{ gap: 1 }}>
        {segs.map((opacity, i) => {
          const color = i >= 6 ? '#ef4444' : i >= 4 ? '#f59e0b' : '#10b981';
          return (
            <Box key={i} style={{ width: 20, height: 3, backgroundColor: color, borderRadius: 1, opacity: opacity || 0.15 }} />
          );
        }).reverse()}
      </Box>
    </S.FullCenter>
  );
}

export function ThumbTickerSymbol({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.BoldText style={{ fontSize: 5 }}>{'AAPL'}</S.BoldText>
      <Text style={{ color: c.text, fontSize: 7 }}>{'$182.52'}</Text>
      <Text style={{ color: '#10b981', fontSize: 4 }}>{'+0.74%'}</Text>
    </S.FullCenter>
  );
}

export function ThumbClock({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.StoryBreadcrumbActive style={{ fontWeight: 'bold' }}>{'12:34'}</S.StoryBreadcrumbActive>
      <S.DimNano>{'PM'}</S.DimNano>
    </S.FullCenter>
  );
}

export function ThumbStopwatch({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.BoldText style={{ fontSize: 7 }}>{'02:45'}</S.BoldText>
      <Text style={{ color: '#06b6d4', fontSize: 4 }}>{'.320'}</Text>
    </S.FullCenter>
  );
}

// ── New thumbnails ──────────────────────────────────────

export function ThumbSlider({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ padding: 6 }}>
      <S.StoryFill style={{ width: 50, backgroundColor: c.surface, position: 'relative' }}>
        <S.StoryFill style={{ width: '60%', backgroundColor: '#3b82f6' }} />
        <Box style={{ position: 'absolute', left: 28, top: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#3b82f6' }} />
      </S.StoryFill>
    </S.FullCenter>
  );
}

export function ThumbSwitch({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 3 }}>
      <Box style={{ width: 24, height: 12, backgroundColor: '#22c55e', borderRadius: 6, position: 'relative' }}>
        <Box style={{ position: 'absolute', right: 2, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
      </Box>
      <S.SurfaceR6 style={{ width: 24, height: 12, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 2, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#999' }} />
      </S.SurfaceR6>
    </S.FullCenter>
  );
}

export function ThumbCheckbox({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 3 }}>
      <S.RowCenter style={{ gap: 3 }}>
        <S.Center style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3b82f6' }}>
          <Text style={{ color: '#fff', fontSize: 5 }}>{'✓'}</Text>
        </S.Center>
        <Text style={{ color: c.text, fontSize: 4 }}>{'On'}</Text>
      </S.RowCenter>
      <S.RowCenter style={{ gap: 3 }}>
        <S.Bordered style={{ width: 8, height: 8, borderRadius: 2 }} />
        <S.DimNano>{'Off'}</S.DimNano>
      </S.RowCenter>
    </S.FullCenter>
  );
}

export function ThumbRadio({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 3 }}>
      {['A', 'B', 'C'].map((l, i) => (
        <S.RowCenter key={l} style={{ gap: 3 }}>
          <Box style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: i === 0 ? '#3b82f6' : c.border, justifyContent: 'center', alignItems: 'center' }}>
            {i === 0 && <Box style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#3b82f6' }} />}
          </Box>
          <Text style={{ color: i === 0 ? c.text : c.muted, fontSize: 4 }}>{l}</Text>
        </S.RowCenter>
      ))}
    </S.FullCenter>
  );
}

export function ThumbSelect({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowCenterBorder style={{ width: 44, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, padding: 3, justifyContent: 'space-between' }}>
        <Text style={{ color: c.text, fontSize: 4 }}>{'Option'}</Text>
        <Text style={{ color: c.muted, fontSize: 5 }}>{'▾'}</Text>
      </S.RowCenterBorder>
    </S.FullCenter>
  );
}

export function ThumbBarChart({ c }: { c: ThemeColors }) {
  const bars = [0.6, 0.9, 0.4, 0.7, 0.5];
  return (
    <S.CenterW100 style={{ height: '100%', justifyContent: 'end', paddingBottom: 6 }}>
      <S.RowG2 style={{ alignItems: 'end', height: 28 }}>
        {bars.map((v, i) => (
          <Box key={i} style={{ width: 6, height: v * 26, backgroundColor: '#3b82f6', borderRadius: 1 }} />
        ))}
      </S.RowG2>
    </S.CenterW100>
  );
}

export function ThumbLineChart({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <Box style={{ flexDirection: 'row', gap: 1, alignItems: 'end', height: 24 }}>
        {[4, 7, 3, 8, 5, 9, 6].map((v, i) => (
          <Box key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: '#3b82f6', marginBottom: v * 2 }} />
        ))}
      </Box>
    </S.FullCenter>
  );
}

export function ThumbPieChart({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <Box style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 4, borderColor: '#3b82f6', position: 'relative', overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, backgroundColor: '#10b981' }} />
        <Box style={{ position: 'absolute', bottom: 0, left: 0, width: 14, height: 8, backgroundColor: '#f59e0b' }} />
      </Box>
    </S.FullCenter>
  );
}

export function ThumbRadarChart({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.Center style={{ width: 30, height: 30, borderWidth: 1, borderColor: c.border, borderRadius: 15 }}>
        <S.Center style={{ width: 18, height: 18, borderWidth: 1, borderColor: c.border, borderRadius: 9 }}>
          <Box style={{ width: 8, height: 8, backgroundColor: 'rgba(59,130,246,0.3)', borderRadius: 4 }} />
        </S.Center>
      </S.Center>
    </S.FullCenter>
  );
}

export function ThumbCandlestick({ c }: { c: ThemeColors }) {
  const candles = [
    { h: 20, b: 8, y: 4, up: true },
    { h: 16, b: 10, y: 6, up: false },
    { h: 22, b: 6, y: 2, up: true },
    { h: 14, b: 8, y: 8, up: false },
    { h: 18, b: 7, y: 5, up: true },
  ];
  return (
    <S.FullCenter>
      <Box style={{ flexDirection: 'row', gap: 3, alignItems: 'end', height: 28 }}>
        {candles.map((c2, i) => (
          <Box key={i} style={{ width: 4, height: c2.h, backgroundColor: c2.up ? '#22c55e' : '#ef4444', borderRadius: 1 }} />
        ))}
      </Box>
    </S.FullCenter>
  );
}

export function ThumbOrderBook({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 1 }}>
      {[0.8, 0.6, 0.4].map((w, i) => (
        <Box key={`b${i}`} style={{ flexDirection: 'row', width: 44, gap: 1 }}>
          <Box style={{ width: 44 * w, height: 4, backgroundColor: 'rgba(34,197,94,0.3)', borderRadius: 1 }} />
        </Box>
      ))}
      {[0.5, 0.7, 0.9].map((w, i) => (
        <Box key={`a${i}`} style={{ flexDirection: 'row', width: 44, justifyContent: 'end', gap: 1 }}>
          <Box style={{ width: 44 * w, height: 4, backgroundColor: 'rgba(239,68,68,0.3)', borderRadius: 1 }} />
        </Box>
      ))}
    </S.FullCenter>
  );
}

export function ThumbLED({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 4 }}>
      <S.RowG6>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' }} />
      </S.RowG6>
    </S.FullCenter>
  );
}

export function ThumbPadButton({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowWrap style={{ width: 32, gap: 2 }}>
        {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map(col => (
          <Box key={col} style={{ width: 14, height: 14, backgroundColor: col, borderRadius: 2, opacity: 0.8 }} />
        ))}
      </S.RowWrap>
    </S.FullCenter>
  );
}

export function ThumbStepSequencer({ c }: { c: ThemeColors }) {
  const pattern = [1,0,1,0,0,1,0,1, 0,1,0,0,1,0,1,0];
  return (
    <S.FullCenter>
      <S.RowWrap style={{ width: 48, gap: 1 }}>
        {pattern.map((on, i) => (
          <Box key={i} style={{ width: 5, height: 5, backgroundColor: on ? '#f59e0b' : '#222', borderRadius: 1 }} />
        ))}
      </S.RowWrap>
    </S.FullCenter>
  );
}

export function ThumbTransport({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowCenterG4>
        <Box style={{ width: 0, height: 0, borderLeftWidth: 6, borderTopWidth: 4, borderBottomWidth: 4, borderColor: 'transparent', borderLeftColor: '#22c55e' }} />
        <Box style={{ width: 6, height: 8, backgroundColor: c.muted, borderRadius: 1 }} />
        <S.Dot6 style={{ width: 6, backgroundColor: '#ef4444' }} />
      </S.RowCenterG4>
    </S.FullCenter>
  );
}

export function ThumbPiano({ c }: { c: ThemeColors }) {
  return (
    <S.CenterW100 style={{ height: '100%', justifyContent: 'end', paddingBottom: 4 }}>
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        {[1,0,1,0,1,1,0,1,0,1,0,1].map((white, i) => (
          <Box key={i} style={{ width: white ? 4 : 3, height: white ? 20 : 13, backgroundColor: white ? '#eee' : '#222', borderRadius: 1 }} />
        ))}
      </Box>
    </S.CenterW100>
  );
}

export function ThumbXYPad({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 32, height: 32, borderRadius: 3, position: 'relative' }}>
        <S.Dot6 style={{ position: 'absolute', left: 18, top: 10, width: 6, backgroundColor: '#8b5cf6' }} />
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbPitchWheel({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 14, height: 30, borderRadius: 3, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 1, top: 12, width: 10, height: 6, backgroundColor: '#ccc', borderRadius: 2 }} />
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbPeriodicTable({ c }: { c: ThemeColors }) {
  const colors = ['#7b6faa', '#9a9cc4', '#de9a9a', '#8fbc8f', '#c8c864', '#59b5e6', '#d4a844', '#c87e4a'];
  return (
    <S.FullCenter>
      <S.RowWrap style={{ width: 48, gap: 1 }}>
        {colors.map((col, i) => (
          <Box key={i} style={{ width: 5, height: 5, backgroundColor: col, borderRadius: 1 }} />
        ))}
      </S.RowWrap>
    </S.FullCenter>
  );
}

export function ThumbMoleculeCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.BoldText style={{ fontSize: 8 }}>{'H₂O'}</S.BoldText>
      <S.DimNano>{'18.015 g/mol'}</S.DimNano>
    </S.FullCenter>
  );
}

export function ThumbElectronShell({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.Center style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.border }}>
        <S.Center style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
          <S.Dot6 style={{ width: 6, backgroundColor: '#f59e0b' }} />
        </S.Center>
      </S.Center>
    </S.FullCenter>
  );
}

export function ThumbReactionView({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 1 }}>
      <S.RowCenter style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 5 }}>{'A+B'}</Text>
        <Text style={{ color: '#10b981', fontSize: 6 }}>{'→'}</Text>
        <Text style={{ color: c.text, fontSize: 5 }}>{'C'}</Text>
      </S.RowCenter>
    </S.FullCenter>
  );
}

export function ThumbTickerTape({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowCenterG4>
        <Text style={{ color: '#22c55e', fontSize: 4 }}>{'AAPL↑'}</Text>
        <Text style={{ color: '#ef4444', fontSize: 4 }}>{'TSLA↓'}</Text>
      </S.RowCenterG4>
    </S.FullCenter>
  );
}

export function ThumbPortfolioCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.BoldText style={{ fontSize: 5 }}>{'$12.4k'}</S.BoldText>
      <Text style={{ color: '#22c55e', fontSize: 4 }}>{'+2.3%'}</Text>
    </S.FullCenter>
  );
}

export function ThumbRSIGauge({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.StoryFill style={{ width: 36, backgroundColor: c.surface, overflow: 'hidden', position: 'relative' }}>
        <S.StoryFill style={{ width: '65%', backgroundColor: '#f59e0b' }} />
      </S.StoryFill>
      <S.DimNano style={{ marginTop: 2 }}>{'RSI 65'}</S.DimNano>
    </S.FullCenter>
  );
}

export function ThumbMACDPanel({ c }: { c: ThemeColors }) {
  const bars = [3, 5, -2, -4, 1, 6, 4, -1];
  return (
    <S.FullCenter>
      <S.RowCenter style={{ gap: 1, height: 24 }}>
        {bars.map((v, i) => (
          <Box key={i} style={{ width: 3, height: Math.abs(v) * 2.5, backgroundColor: v >= 0 ? '#22c55e' : '#ef4444', borderRadius: 1, marginTop: v < 0 ? 0 : undefined, marginBottom: v >= 0 ? 0 : undefined }} />
        ))}
      </S.RowCenter>
    </S.FullCenter>
  );
}

export function ThumbCountdown({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <Text style={{ color: '#ef4444', fontSize: 8, fontWeight: 'bold' }}>{'0:30'}</Text>
      <S.DimNano>{'remaining'}</S.DimNano>
    </S.FullCenter>
  );
}

export function ThumbMinimalChat({ c }: { c: ThemeColors }) {
  return (
    <S.FullSize style={{ justifyContent: 'center', padding: 4, gap: 2 }}>
      <Box style={{ alignSelf: 'end', backgroundColor: '#2563eb', borderRadius: 3, paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ color: '#fff', fontSize: 3 }}>{'Hi'}</Text>
      </Box>
      <Box style={{ alignSelf: 'start', backgroundColor: '#1e293b', borderRadius: 3, paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 3 }}>{'Hello!'}</Text>
      </Box>
      <S.SurfaceBordered style={{ height: 6, borderRadius: 2 }} />
    </S.FullSize>
  );
}

export function ThumbSpreadsheet({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.Bordered style={{ borderRadius: 2, overflow: 'hidden' }}>
        {[0, 1, 2].map(r => (
          <Box key={r} style={{ flexDirection: 'row' }}>
            {[0, 1, 2].map(col => (
              <Box key={col} style={{ width: 14, height: 8, borderRightWidth: col < 2 ? 1 : 0, borderBottomWidth: r < 2 ? 1 : 0, borderColor: c.border, backgroundColor: r === 0 ? c.surface : 'transparent' }} />
            ))}
          </Box>
        ))}
      </S.Bordered>
    </S.FullCenter>
  );
}

export function ThumbCommandPalette({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 48, borderRadius: 3, padding: 3, gap: 2 }}>
        <S.Bordered style={{ height: 5, backgroundColor: c.bg, borderRadius: 2 }} />
        <Box style={{ height: 3, backgroundColor: C.accentDim, borderRadius: 1 }} />
        <Box style={{ height: 3, backgroundColor: 'transparent', borderRadius: 1 }} />
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbStatCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.DimNano>{'Revenue'}</S.DimNano>
      <S.BoldText style={{ fontSize: 8 }}>{'$12k'}</S.BoldText>
      <Text style={{ color: '#22c55e', fontSize: 4 }}>{'↑ 12%'}</Text>
    </S.FullCenter>
  );
}

export function ThumbNowPlaying({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <Box style={{ width: 20, height: 20, backgroundColor: c.surface, borderRadius: 3 }} />
      <Box style={{ width: 30, height: 2, backgroundColor: c.muted, borderRadius: 1 }} />
      <Box style={{ width: 36, height: 3, backgroundColor: '#22c55e', borderRadius: 1, overflow: 'hidden' }}>
        <Box style={{ width: '40%', height: 3, backgroundColor: '#22c55e' }} />
      </Box>
    </S.FullCenter>
  );
}

export function ThumbRepoCard({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      <S.BoldText style={{ fontSize: 5 }}>{'repo'}</S.BoldText>
      <Box style={{ flexDirection: 'row', gap: 3 }}>
        <Text style={{ color: '#f59e0b', fontSize: 4 }}>{'★ 2.1k'}</Text>
        <S.DimNano>{'TS'}</S.DimNano>
      </Box>
    </S.FullCenter>
  );
}

export function ThumbImageGallery({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowWrap style={{ width: 34, gap: 2 }}>
        {[c.surface, c.border, c.muted, c.surface].map((col, i) => (
          <Box key={i} style={{ width: 15, height: 12, backgroundColor: col, borderRadius: 2 }} />
        ))}
      </S.RowWrap>
    </S.FullCenter>
  );
}

export function ThumbContextMenu({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.SurfaceBordered style={{ width: 36, borderRadius: 3, padding: 2, gap: 1 }}>
        <Box style={{ height: 4, backgroundColor: C.accentDim, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: c.text, fontSize: 3 }}>{'Copy'}</Text>
        </Box>
        <Box style={{ height: 4, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: c.muted, fontSize: 3 }}>{'Paste'}</Text>
        </Box>
        <S.HorzDivider />
        <Box style={{ height: 4, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: '#ef4444', fontSize: 3 }}>{'Delete'}</Text>
        </Box>
      </S.SurfaceBordered>
    </S.FullCenter>
  );
}

export function ThumbMath({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.StoryBreadcrumbActive>{'E=mc²'}</S.StoryBreadcrumbActive>
    </S.FullCenter>
  );
}

export function ThumbMessageList({ c }: { c: ThemeColors }) {
  return (
    <S.FullSize style={{ justifyContent: 'center', padding: 4, gap: 2 }}>
      <Box style={{ alignSelf: 'start', width: 28, height: 5, backgroundColor: '#1e293b', borderRadius: 2 }} />
      <Box style={{ alignSelf: 'end', width: 22, height: 5, backgroundColor: '#2563eb', borderRadius: 2 }} />
      <Box style={{ alignSelf: 'start', width: 32, height: 5, backgroundColor: '#1e293b', borderRadius: 2 }} />
    </S.FullSize>
  );
}

export function ThumbActionBar({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter>
      <S.RowG2>
        {['Copy', 'Edit', 'Del'].map(l => (
          <S.SurfaceBordered key={l} style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
            <Text style={{ color: c.muted, fontSize: 3 }}>{l}</Text>
          </S.SurfaceBordered>
        ))}
      </S.RowG2>
    </S.FullCenter>
  );
}

export function ThumbFlatList({ c }: { c: ThemeColors }) {
  return (
    <S.FullCenter style={{ gap: 2 }}>
      {[1, 2, 3, 4].map(i => (
        <Box key={i} style={{ width: 40, height: 5, backgroundColor: c.surface, borderRadius: 1, opacity: i > 2 ? 0.4 : 1 }} />
      ))}
    </S.FullCenter>
  );
}

// ── Thumbnail registry ──────────────────────────────────

// ══════════════════════════════════════════════════════════
// Legacy THUMBS/PREVIEWS dicts — built from registry for backwards compat.
// New components should use register() from galleryRegistry.ts instead.
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// PREVIEWS — full-size live demos for the main area
// ══════════════════════════════════════════════════════════

export function PreviewCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Card title="System Status" subtitle="All services operational">
        <Box style={{ padding: 12, gap: 8 }}>
          {[
            { name: 'API Server', badge: 'Online', variant: 'success' as const },
            { name: 'Database', badge: 'Online', variant: 'success' as const },
            { name: 'CDN', badge: 'Degraded', variant: 'warning' as const },
          ].map(row => (
            <S.RowCenter key={row.name} style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontSize: 12 }}>{row.name}</Text>
              <Badge label={row.badge} variant={row.variant} />
            </S.RowCenter>
          ))}
        </Box>
      </Card>
    </S.GrowCenterAlign>
  );
}

export function PreviewBadge({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <S.RowWrap style={{ gap: 10, justifyContent: 'center' }}>
        <Badge label="Default" variant="default" />
        <Badge label="Success" variant="success" />
        <Badge label="Warning" variant="warning" />
        <Badge label="Error" variant="error" />
        <Badge label="Info" variant="info" />
      </S.RowWrap>
      <S.RowWrap style={{ gap: 10, justifyContent: 'center' }}>
        <Badge label="v2.1.0" variant="info" />
        <Badge label="Stable" variant="success" />
        <Badge label="Beta" variant="warning" />
        <Badge label="Deprecated" variant="error" />
      </S.RowWrap>
    </S.GrowCenterAlign>
  );
}

export function PreviewTabs({ c }: { c: ThemeColors }) {
  const [underlineTab, setUnderlineTab] = useState('overview');
  const [pillTab, setPillTab] = useState('all');
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ width: 320, gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Underline variant'}</S.StoryMuted>
          <Tabs
            tabs={[{ id: 'overview', label: 'Overview' }, { id: 'api', label: 'API' }, { id: 'examples', label: 'Examples' }]}
            activeId={underlineTab}
            onSelect={setUnderlineTab}
          />
        </Box>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Pill variant'}</S.StoryMuted>
          <Tabs
            tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'archived', label: 'Archived' }]}
            activeId={pillTab}
            onSelect={setPillTab}
            variant="pill"
          />
        </Box>
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewNavPanel({ c }: { c: ThemeColors }) {
  const [activeNav, setActiveNav] = useState('home');
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <NavPanel
        sections={[
          { title: 'Navigation', items: [{ id: 'home', label: 'Home' }, { id: 'explore', label: 'Explore' }, { id: 'search', label: 'Search' }] },
          { title: 'Settings', items: [{ id: 'profile', label: 'Profile' }, { id: 'prefs', label: 'Preferences' }] },
        ]}
        activeId={activeNav}
        onSelect={setActiveNav}
        width={180}
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewToolbar({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <Toolbar items={[
        { id: 'bold', icon: 'bold', label: 'Bold' },
        { id: 'italic', icon: 'italic', label: 'Italic' },
        { id: 'underline', icon: 'underline', label: 'Underline' },
        'divider',
        { id: 'link', icon: 'link', label: 'Link' },
        { id: 'image', icon: 'image', label: 'Image' },
        'divider',
        { id: 'code', icon: 'code', label: 'Code' },
      ]} />
    </S.GrowCenterAlign>
  );
}

export function PreviewBreadcrumbs({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Breadcrumbs items={[
        { id: 'home', label: 'Home' },
        { id: 'components', label: 'Components' },
        { id: 'navigation', label: 'Navigation' },
        { id: 'breadcrumbs', label: 'Breadcrumbs' },
      ]} />
      <Breadcrumbs items={[
        { id: 'root', label: 'ReactJIT' },
        { id: 'core', label: 'Core' },
        { id: 'gallery', label: 'Gallery' },
      ]} separator=">" />
    </S.GrowCenterAlign>
  );
}

export function PreviewTable({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <Box style={{ width: 340 }}>
        <Table columns={SAMPLE_TABLE_COLS} data={SAMPLE_TABLE_DATA} striped />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewProgressBar({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 300, gap: 14 }}>
        {[
          { label: 'Build progress', value: 0.85, color: C.accent },
          { label: 'Upload', value: 0.45, color: '#3b82f6' },
          { label: 'Tests passing', value: 0.92, color: '#10b981' },
          { label: 'Errors', value: 0.12, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <Box key={label} style={{ gap: 4 }}>
            <S.StoryMuted>{label}</S.StoryMuted>
            <ProgressBar value={value} color={color} height={8} />
          </Box>
        ))}
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewSparkline({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ gap: 16, width: 300 }}>
        {[
          { label: 'Revenue', data: [4, 7, 2, 8, 5, 9, 3, 6, 8, 10, 7, 11], color: '#10b981' },
          { label: 'Users', data: [10, 12, 8, 15, 11, 18, 14, 20, 17, 22, 19, 25], color: '#3b82f6' },
          { label: 'Errors', data: [5, 3, 7, 2, 4, 1, 6, 3, 2, 1, 4, 2], color: '#ef4444' },
        ].map(({ label, data, color }) => (
          <S.RowCenter key={label} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 13 }}>{label}</Text>
            <Sparkline data={data} width={120} height={28} color={color} />
          </S.RowCenter>
        ))}
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewMessageBubble({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenter style={{ padding: 20, gap: 8, width: 360, alignSelf: 'center' }}>
      <MessageBubble variant="left" label="Alice" timestamp="2:30 PM">
        {'Hey, have you seen the new component gallery?'}
      </MessageBubble>
      <MessageBubble variant="right" label="You" timestamp="2:31 PM">
        {'Yes! The thumbnail tabs are really cool.'}
      </MessageBubble>
      <MessageBubble variant="left" label="Alice" timestamp="2:31 PM">
        {'Agreed. Much better than icons.'}
      </MessageBubble>
      <MessageBubble variant="center" timestamp="2:32 PM">
        {'Bob joined the conversation'}
      </MessageBubble>
    </S.GrowCenter>
  );
}

export function PreviewChatInput({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 360, gap: 12 }}>
        <ChatInput placeholder="Type a message..." sendColor="#3b82f6" />
        <ChatInput placeholder="Disabled while loading..." disabled sendColor="#3b82f6" />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewSearchBar({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 320, gap: 12 }}>
        <SearchBar placeholder="Search components..." />
        <SearchBar placeholder="Search with custom debounce..." debounce={500} />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewCodeBlock({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, padding: 20 }}>
      <CodeBlock language="tsx" fontSize={11} code={SAMPLE_CODE} />
    </Box>
  );
}

export function PreviewLoadingDots({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 24, padding: 20 }}>
      <Box style={{ gap: 16, alignItems: 'center' }}>
        <S.RowCenterG8>
          <Text style={{ color: c.text, fontSize: 14 }}>{'Loading'}</Text>
          <LoadingDots color={C.accent} />
        </S.RowCenterG8>
        <S.RowCenterG8>
          <Text style={{ color: c.muted, fontSize: 12 }}>{'Thinking'}</Text>
          <LoadingDots color="#3b82f6" />
        </S.RowCenterG8>
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewElementTile({ c }: { c: ThemeColors }) {
  const reps = ['H', 'Fe', 'Au', 'Ne', 'U'];
  const sz = 120;
  const th = Math.floor(sz * (36 / 32));
  return (
    <S.GrowCenterAlign style={{ padding: 16 }}>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {reps.map(sym => (
          <ElementTile key={sym} element={sym} size={sz} style={{ width: sz, height: th }} />
        ))}
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewElementCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 16 }}>
      <S.RowWrap style={{ gap: 12, justifyContent: 'center' }}>
        <ElementCard element="Fe" style={{ width: 220 }} />
        <ElementCard element="Au" style={{ width: 220 }} />
      </S.RowWrap>
    </S.GrowCenterAlign>
  );
}

export function PreviewKnob({ c }: { c: ThemeColors }) {
  const [gain, setGain] = useState(0.7);
  const [pan, setPan] = useState(0.5);
  const [reverb, setReverb] = useState(0.3);
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <S.RowCenter style={{ gap: 40 }}>
        <Knob value={gain} onChange={setGain} label="Gain" color="#f59e0b" size={80} />
        <Knob value={pan} onChange={setPan} label="Pan" color="#3b82f6" size={80} />
        <Knob value={reverb} onChange={setReverb} label="Reverb" color="#10b981" size={80} />
      </S.RowCenter>
    </S.GrowCenterAlign>
  );
}

export function PreviewFader({ c }: { c: ThemeColors }) {
  const [ch1, setCh1] = useState(0.7);
  const [ch2, setCh2] = useState(0.5);
  const [ch3, setCh3] = useState(0.85);
  const [master, setMaster] = useState(0.6);
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 28, alignItems: 'end' }}>
        <Fader value={ch1} onChange={setCh1} label="Ch 1" color="#f59e0b" height={140} />
        <Fader value={ch2} onChange={setCh2} label="Ch 2" color="#3b82f6" height={140} />
        <Fader value={ch3} onChange={setCh3} label="Ch 3" color="#10b981" height={140} />
        <Fader value={master} onChange={setMaster} label="Master" color="#ef4444" height={140} />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewMeter({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 24, alignItems: 'end' }}>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <Meter value={0.72} peak={0.85} orientation="vertical" height={140} />
          <S.StoryMuted>{'L'}</S.StoryMuted>
        </Box>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <Meter value={0.58} peak={0.7} orientation="vertical" height={140} />
          <S.StoryMuted>{'R'}</S.StoryMuted>
        </Box>
      </Box>
      <Box style={{ width: 300, gap: 8 }}>
        <S.StoryMuted>{'Horizontal'}</S.StoryMuted>
        <Meter value={0.65} orientation="horizontal" width={280} />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewTickerSymbol({ c }: { c: ThemeColors }) {
  const tickers = [
    { symbol: 'AAPL', price: 182.52, change: 0.74, sparkline: [175, 178, 180, 179, 181, 183, 182, 182.5] },
    { symbol: 'GOOGL', price: 141.80, change: -1.49, sparkline: [145, 144, 143, 142, 141, 140, 141, 141.8] },
    { symbol: 'TSLA', price: 248.42, change: 2.33, sparkline: [240, 242, 244, 243, 246, 247, 249, 248.4] },
    { symbol: 'NVDA', price: 875.30, change: 1.12, sparkline: [860, 862, 870, 868, 872, 875, 874, 875.3] },
  ];
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <Box style={{ width: 340, gap: 8 }}>
        {tickers.map(t => (
          <TickerSymbol key={t.symbol} item={t} />
        ))}
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewClock({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'Time only'}</S.StoryMuted>
        <Clock format="time" />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'Date + time'}</S.StoryMuted>
        <Clock format="datetime" />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'Date only'}</S.StoryMuted>
        <Clock format="date" />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewStopwatch({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'With controls + milliseconds'}</S.StoryMuted>
        <Stopwatch showMs controls />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'Auto-start, no controls'}</S.StoryMuted>
        <Stopwatch autoStart controls={false} showMs />
      </Box>
    </S.GrowCenterAlign>
  );
}

// ── New previews ────────────────────────────────────────

export function PreviewSlider({ c }: { c: ThemeColors }) {
  const [v1, setV1] = useState(0.5);
  const [v2, setV2] = useState(0.3);
  const [v3, setV3] = useState(0.8);
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ width: 300, gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Volume'}</S.StoryMuted>
          <Slider value={v1} onChange={setV1} color="#3b82f6" />
        </Box>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Brightness'}</S.StoryMuted>
          <Slider value={v2} onChange={setV2} color="#f59e0b" />
        </Box>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Saturation'}</S.StoryMuted>
          <Slider value={v3} onChange={setV3} color="#10b981" />
        </Box>
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewSwitch({ c }: { c: ThemeColors }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [d, setD] = useState(true);
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 240, gap: 12 }}>
        {[
          { label: 'Notifications', val: a, set: setA },
          { label: 'Dark mode', val: b, set: setB },
          { label: 'Auto-save', val: d, set: setD },
        ].map(s => (
          <S.RowCenter key={s.label} style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: c.text, fontSize: 13 }}>{s.label}</Text>
            <Switch value={s.val} onChange={s.set} />
          </S.RowCenter>
        ))}
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewCheckbox({ c }: { c: ThemeColors }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [d, setD] = useState(true);
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ gap: 10 }}>
        <Checkbox checked={a} onChange={setA} label="Accept terms of service" />
        <Checkbox checked={b} onChange={setB} label="Subscribe to newsletter" />
        <Checkbox checked={d} onChange={setD} label="Remember me" />
        <Checkbox checked={false} onChange={() => {}} label="Disabled option" disabled />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewRadio({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState('medium');
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <RadioGroup
        value={val}
        onChange={setVal}
        options={[
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
          { value: 'xl', label: 'Extra Large' },
        ]}
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewSelect({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState('tsx');
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 260, gap: 12 }}>
        <Select
          value={val}
          onChange={setVal}
          options={[
            { value: 'tsx', label: 'TypeScript (TSX)' },
            { value: 'lua', label: 'Lua' },
            { value: 'rust', label: 'Rust' },
            { value: 'python', label: 'Python' },
          ]}
        />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewBarChart({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <BarChart
        data={[
          { label: 'Jan', value: 42 },
          { label: 'Feb', value: 68 },
          { label: 'Mar', value: 55 },
          { label: 'Apr', value: 91 },
          { label: 'May', value: 73 },
          { label: 'Jun', value: 85 },
        ]}
        width={340}
        height={220}
        color="#3b82f6"
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewLineChart({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <LineChart
        data={[10, 25, 18, 32, 28, 45, 38, 52, 48, 60, 55, 70]}
        width={360}
        height={220}
        color="#10b981"
        showDots
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewPieChart({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <PieChart
        data={[
          { label: 'React', value: 40, color: '#3b82f6' },
          { label: 'Lua', value: 30, color: '#f59e0b' },
          { label: 'OpenGL', value: 20, color: '#10b981' },
          { label: 'Other', value: 10, color: '#8b5cf6' },
        ]}
        size={220}
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewRadarChart({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <RadarChart
        axes={['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma', 'Constitution']}
        data={[0.8, 0.6, 0.9, 0.7, 0.5, 0.75]}
        size={240}
        color="#8b5cf6"
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewCandlestick({ c }: { c: ThemeColors }) {
  const candles = [
    { open: 100, high: 110, low: 95, close: 108 },
    { open: 108, high: 115, low: 105, close: 103 },
    { open: 103, high: 112, low: 100, close: 111 },
    { open: 111, high: 118, low: 108, close: 106 },
    { open: 106, high: 114, low: 102, close: 113 },
    { open: 113, high: 120, low: 110, close: 117 },
    { open: 117, high: 122, low: 112, close: 115 },
    { open: 115, high: 119, low: 109, close: 118 },
  ];
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <CandlestickChart data={candles} width={380} height={240} />
    </S.GrowCenterAlign>
  );
}

export function PreviewOrderBook({ c }: { c: ThemeColors }) {
  const bids = [
    { price: 182.50, size: 120 },
    { price: 182.45, size: 85 },
    { price: 182.40, size: 200 },
    { price: 182.35, size: 150 },
    { price: 182.30, size: 95 },
  ];
  const asks = [
    { price: 182.55, size: 100 },
    { price: 182.60, size: 175 },
    { price: 182.65, size: 60 },
    { price: 182.70, size: 130 },
    { price: 182.75, size: 210 },
  ];
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <OrderBook bids={bids} asks={asks} width={320} />
    </S.GrowCenterAlign>
  );
}

export function PreviewLED({ c }: { c: ThemeColors }) {
  const [on1, setOn1] = useState(true);
  const [on2, setOn2] = useState(false);
  const [on3, setOn3] = useState(true);
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 24 }}>
        {[
          { on: on1, set: setOn1, color: '#22c55e', label: 'Power' },
          { on: on2, set: setOn2, color: '#ef4444', label: 'Error' },
          { on: on3, set: setOn3, color: '#3b82f6', label: 'Status' },
        ].map(led => (
          <Pressable key={led.label} onPress={() => led.set(!led.on)}>
            <Box style={{ alignItems: 'center', gap: 8 }}>
              <LEDIndicator on={led.on} color={led.color} />
              <S.StoryMuted>{led.label}</S.StoryMuted>
            </Box>
          </Pressable>
        ))}
      </Box>
      <S.StoryCap>{'Click to toggle'}</S.StoryCap>
    </S.GrowCenterAlign>
  );
}

export function PreviewPadButton({ c }: { c: ThemeColors }) {
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <S.RowG8 style={{ flexWrap: 'wrap', width: 280, justifyContent: 'center' }}>
        {colors.map((col, i) => (
          <PadButton key={i} color={col} size={60} label={`${i + 1}`} />
        ))}
      </S.RowG8>
    </S.GrowCenterAlign>
  );
}

export function PreviewStepSequencer({ c }: { c: ThemeColors }) {
  const initialPattern: boolean[][] = [];
  for (let t = 0; t < 4; t++) {
    initialPattern.push(Array.from({ length: 16 }, (_, i) => (t === 0 && i % 4 === 0) || (t === 1 && i % 8 === 4)));
  }
  const [pattern, setPattern] = useState(initialPattern);
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <StepSequencer steps={16} tracks={4} pattern={pattern} onChange={setPattern} />
    </S.GrowCenterAlign>
  );
}

export function PreviewTransport({ c }: { c: ThemeColors }) {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <TransportBar
        playing={playing}
        recording={recording}
        bpm={120}
        position="001:01:000"
        onPlay={() => setPlaying(!playing)}
        onStop={() => { setPlaying(false); setRecording(false); }}
        onRecord={() => setRecording(!recording)}
      />
    </S.GrowCenterAlign>
  );
}

const GALLERY_PIANO_WHITES = [
  { id: 'C3', label: 'C', note: 48 }, { id: 'D3', label: 'D', note: 50 },
  { id: 'E3', label: 'E', note: 52 }, { id: 'F3', label: 'F', note: 53 },
  { id: 'G3', label: 'G', note: 55 }, { id: 'A3', label: 'A', note: 57 },
  { id: 'B3', label: 'B', note: 59 }, { id: 'C4', label: 'C', note: 60 },
  { id: 'D4', label: 'D', note: 62 }, { id: 'E4', label: 'E', note: 64 },
  { id: 'F4', label: 'F', note: 65 }, { id: 'G4', label: 'G', note: 67 },
  { id: 'A4', label: 'A', note: 69 }, { id: 'B4', label: 'B', note: 71 },
];
const GALLERY_PIANO_BLACKS = [
  { id: 'Cs3', label: 'C#', note: 49 }, { id: 'Ds3', label: 'D#', note: 51 },
  { id: 'Fs3', label: 'F#', note: 54 }, { id: 'Gs3', label: 'G#', note: 56 },
  { id: 'As3', label: 'A#', note: 58 }, { id: 'Cs4', label: 'C#', note: 61 },
  { id: 'Ds4', label: 'D#', note: 63 }, { id: 'Fs4', label: 'F#', note: 66 },
  { id: 'Gs4', label: 'G#', note: 68 }, { id: 'As4', label: 'A#', note: 70 },
];
const GALLERY_PIANO_BLACK_AFTER = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];

export function PreviewPiano({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <PianoKeyboard
        whites={GALLERY_PIANO_WHITES}
        blacks={GALLERY_PIANO_BLACKS}
        blackAfter={GALLERY_PIANO_BLACK_AFTER}
        whiteKeyWidth={28}
        whiteKeyHeight={80}
      />
    </S.GrowCenterAlign>
  );
}

export function PreviewXYPad({ c }: { c: ThemeColors }) {
  const [x, setX] = useState(0.5);
  const [y, setY] = useState(0.5);
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <XYPad x={x} y={y} onChange={({ x: nx, y: ny }: { x: number; y: number }) => { setX(nx); setY(ny); }} size={200} color="#8b5cf6" />
      <S.StoryMuted>{`X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}`}</S.StoryMuted>
    </S.GrowCenterAlign>
  );
}

export function PreviewPitchWheel({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState(0);
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <S.RowCenter style={{ gap: 32 }}>
        <Box style={{ alignItems: 'center', gap: 8 }}>
          <S.StoryMuted>{'Spring return'}</S.StoryMuted>
          <PitchWheel value={val} onChange={setVal} springReturn height={140} />
        </Box>
        <Box style={{ alignItems: 'center', gap: 8 }}>
          <S.StoryMuted>{'Free'}</S.StoryMuted>
          <PitchWheel value={0.3} onChange={() => {}} height={140} />
        </Box>
      </S.RowCenter>
    </S.GrowCenterAlign>
  );
}

export function PreviewPeriodicTable({ c }: { c: ThemeColors }) {
  const [selected, setSelected] = useState<number | undefined>(26);
  return (
    <S.GrowCenterAlign style={{ padding: 8 }}>
      <PeriodicTable onSelect={(el: any) => setSelected(el.number)} selected={selected} tileSize={28} />
    </S.GrowCenterAlign>
  );
}

export function PreviewMoleculeCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <S.RowWrap style={{ gap: 12, justifyContent: 'center' }}>
        <MoleculeCard formula="H2O" style={{ width: 220 }} />
        <MoleculeCard formula="C6H12O6" style={{ width: 220 }} />
        <MoleculeCard formula="NaCl" style={{ width: 220 }} />
      </S.RowWrap>
    </S.GrowCenterAlign>
  );
}

export function PreviewElectronShell({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <S.RowCenter style={{ gap: 20 }}>
        <ElectronShell element="C" />
        <ElectronShell element="Fe" />
        <ElectronShell element="Ne" />
      </S.RowCenter>
    </S.GrowCenterAlign>
  );
}

export function PreviewReactionView({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 16, padding: 20 }}>
      <Box style={{ width: 400, gap: 12 }}>
        <ReactionView equation="Fe + O2 -> Fe2O3" />
        <ReactionView equation="H2 + O2 -> H2O" />
        <ReactionView equation="NaOH + HCl -> NaCl + H2O" />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewTickerTape({ c }: { c: ThemeColors }) {
  const items = [
    { symbol: 'AAPL', price: 182.52, change: 0.74 },
    { symbol: 'GOOGL', price: 141.80, change: -1.49 },
    { symbol: 'TSLA', price: 248.42, change: 2.33 },
    { symbol: 'MSFT', price: 415.20, change: 0.42 },
    { symbol: 'NVDA', price: 875.30, change: 1.12 },
  ];
  return (
    <S.GrowCenter style={{ padding: 20 }}>
      <TickerTape items={items} speed={40} />
    </S.GrowCenter>
  );
}

export function PreviewPortfolioCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <PortfolioCard snapshot={{
        totalValue: 52480.75,
        dayChange: 1240.30,
        dayChangePercent: 2.42,
        holdings: [
          { symbol: 'AAPL', quantity: 50, costBasis: 150.00, currentPrice: 182.52 },
          { symbol: 'GOOGL', quantity: 30, costBasis: 120.00, currentPrice: 141.80 },
          { symbol: 'TSLA', quantity: 20, costBasis: 200.00, currentPrice: 248.42 },
        ],
      }} />
    </S.GrowCenterAlign>
  );
}

export function PreviewRSIGauge({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <Box style={{ gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Overbought (RSI 78)'}</S.StoryMuted>
          <RSIGauge value={78} width={300} />
        </Box>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Neutral (RSI 52)'}</S.StoryMuted>
          <RSIGauge value={52} width={300} />
        </Box>
        <Box style={{ gap: 4 }}>
          <S.StoryMuted>{'Oversold (RSI 22)'}</S.StoryMuted>
          <RSIGauge value={22} width={300} />
        </Box>
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewMACDPanel({ c }: { c: ThemeColors }) {
  const data = [
    { macd: 0.5, signal: 0.3, histogram: 0.2 },
    { macd: 0.8, signal: 0.5, histogram: 0.3 },
    { macd: 1.2, signal: 0.8, histogram: 0.4 },
    { macd: 0.9, signal: 0.9, histogram: 0.0 },
    { macd: 0.4, signal: 0.8, histogram: -0.4 },
    { macd: -0.2, signal: 0.4, histogram: -0.6 },
    { macd: -0.5, signal: 0.0, histogram: -0.5 },
    { macd: -0.3, signal: -0.2, histogram: -0.1 },
    { macd: 0.1, signal: -0.2, histogram: 0.3 },
    { macd: 0.6, signal: 0.1, histogram: 0.5 },
  ];
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <MACDPanel data={data} width={380} height={180} />
    </S.GrowCenterAlign>
  );
}

export function PreviewCountdown({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <S.StoryMuted>{'60 second countdown'}</S.StoryMuted>
        <Countdown duration={60000} controls showMs />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewMinimalChat({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, padding: 20 }}>
      <MinimalChat model="claude-sonnet-4-6" placeholder="Ask anything..." />
    </Box>
  );
}

export function PreviewSpreadsheet({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, padding: 12 }}>
      <Spreadsheet rows={10} cols={6} />
    </Box>
  );
}

export function PreviewCommandPalette({ c }: { c: ThemeColors }) {
  const [open, setOpen] = useState(true);
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <Pressable onPress={() => setOpen(true)}>
        <S.SurfaceBordered style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 6 }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{'Open Command Palette'}</Text>
        </S.SurfaceBordered>
      </Pressable>
      {open && (
        <CommandPalette
          commands={[
            { id: 'newfile', label: 'New File', group: 'File' },
            { id: 'open', label: 'Open...', group: 'File', shortcut: 'Ctrl+O' },
            { id: 'save', label: 'Save', group: 'File', shortcut: 'Ctrl+S' },
            { id: 'find', label: 'Find', group: 'Edit', shortcut: 'Ctrl+F' },
            { id: 'replace', label: 'Replace', group: 'Edit', shortcut: 'Ctrl+H' },
            { id: 'terminal', label: 'Toggle Terminal', group: 'View' },
            { id: 'sidebar', label: 'Toggle Sidebar', group: 'View' },
          ]}
          visible={open}
          onSelect={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      )}
    </S.GrowCenterAlign>
  );
}

export function PreviewStatCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <S.RowWrap style={{ gap: 12, justifyContent: 'center' }}>
        <StatCard label="Revenue" value="$12.4k" sublabel="vs $10.2k last month" trend="up" />
        <StatCard label="Users" value="1,284" sublabel="vs 1,150 last month" trend="up" />
        <StatCard label="Errors" value="23" sublabel="vs 12 last month" trend="down" />
        <StatCard label="Uptime" value="99.9%" sublabel="30 day average" trend="flat" />
      </S.RowWrap>
    </S.GrowCenterAlign>
  );
}

export function PreviewNowPlaying({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <NowPlayingCard track={{
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up, We\'re Dreaming',
        artUrl: '',
        progress: 0.4,
        duration: 243000,
      }} />
    </S.GrowCenterAlign>
  );
}

export function PreviewRepoCard({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 12, padding: 20 }}>
      <Box style={{ width: 340, gap: 12 }}>
        <RepoCard repo={{ name: 'reactjit', fullName: 'user/reactjit', description: 'React rendering framework on Love2D', language: 'TypeScript', stars: 2100, forks: 180 }} />
        <RepoCard repo={{ name: 'love2d', fullName: 'love2d/love', description: 'LÖVE - Free 2D Game Engine', language: 'C++', stars: 4500, forks: 420 }} />
      </Box>
    </S.GrowCenterAlign>
  );
}

export function PreviewImageGallery({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{'ImageGallery requires image URLs — pass images={[...]} to populate'}</Text>
    </S.GrowCenterAlign>
  );
}

export function PreviewContextMenu({ c }: { c: ThemeColors }) {
  const [vis, setVis] = useState(true);
  return (
    <S.GrowCenterAlign style={{ padding: 20 }}>
      <Pressable onPress={() => setVis(true)}>
        <S.SurfaceBordered style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 6 }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{'Right-click area (click to show)'}</Text>
        </S.SurfaceBordered>
      </Pressable>
      {vis && (
        <ContextMenu
          items={[
            { id: 'copy', label: 'Copy' },
            { id: 'cut', label: 'Cut' },
            { id: 'paste', label: 'Paste' },
            { id: 'sep1', type: 'separator' },
            { id: 'delete', label: 'Delete', destructive: true },
          ]}
          visible={vis}
          x={200}
          y={150}
          onSelect={() => setVis(false)}
          onClose={() => setVis(false)}
        />
      )}
    </S.GrowCenterAlign>
  );
}

export function PreviewMath({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <MathTex tex="E = mc^2" fontSize={24} />
      <MathTex tex="\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}" fontSize={18} />
      <MathTex tex="\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}" fontSize={18} />
    </S.GrowCenterAlign>
  );
}

export function PreviewMessageList({ c }: { c: ThemeColors }) {
  return (
    <S.GrowG8 style={{ padding: 20 }}>
      <MessageBubble variant="left" label="Alice" timestamp="2:30 PM">
        {'Hey, how is the gallery coming along?'}
      </MessageBubble>
      <MessageBubble variant="right" label="You" timestamp="2:31 PM">
        {'Great! Just added 30 more components.'}
      </MessageBubble>
      <MessageBubble variant="left" label="Alice" timestamp="2:31 PM">
        {'Nice, are they all interactive?'}
      </MessageBubble>
      <MessageBubble variant="right" label="You" timestamp="2:32 PM">
        {'Every single one.'}
      </MessageBubble>
    </S.GrowG8>
  );
}

export function PreviewActionBar({ c }: { c: ThemeColors }) {
  return (
    <S.GrowCenterAlign style={{ gap: 20, padding: 20 }}>
      <ActionBar items={[
        { key: 'copy', label: 'Copy' },
        { key: 'edit', label: 'Edit' },
        { key: 'share', label: 'Share' },
        { key: 'delete', label: 'Delete' },
      ]} onAction={() => {}} />
    </S.GrowCenterAlign>
  );
}

export function PreviewFlatList({ c }: { c: ThemeColors }) {
  const data = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, label: `Item ${i + 1}`, desc: `Description for item ${i + 1}` }));
  return (
    <Box style={{ flexGrow: 1, padding: 12 }}>
      <FlatList
        data={data}
        renderItem={({ item }: { item: { id: string; label: string; desc: string } }) => (
          <S.RowCenterBorder style={{ justifyContent: 'space-between', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1 }}>
            <Text style={{ color: c.text, fontSize: 12 }}>{item.label}</Text>
            <S.StoryMuted>{item.desc}</S.StoryMuted>
          </S.RowCenterBorder>
        )}
        itemHeight={36}
      />
    </Box>
  );
}


register({ id: 'card', label: 'Card', pkg: 'core',
  desc: 'Container with title, subtitle, border, and rounded corners. Separates header and body regions for grouped content panels.',
  usage: `<Card title="Settings" subtitle="App config">\n  <Text>Card body content</Text>\n</Card>`,
  props: [['title', 'string'], ['subtitle', 'string'], ['style', 'Style'], ['headerStyle', 'Style'], ['bodyStyle', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbCard c={c} />, preview: (c) => <PreviewCard c={c} />,
});
register({ id: 'badge', label: 'Badge', pkg: 'core',
  desc: 'Status label with semantic color variants. Five built-in variants: default, success, warning, error, info.',
  usage: `<Badge label="Active" variant="success" />\n<Badge label="Warning" variant="warning" />`,
  props: [['label', 'string'], ['variant', "'default' | 'success' | 'warning' | 'error' | 'info'"], ['style', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbBadge c={c} />, preview: (c) => <PreviewBadge c={c} />,
});
register({ id: 'tabs', label: 'Tabs', pkg: 'core',
  desc: 'Tab switcher with underline and pill variants. Lua-owned keyboard navigation and active state tracking.',
  usage: `<Tabs\n  tabs={[{ id: 'a', label: 'Tab A' }]}\n  activeId={active}\n  onSelect={setActive}\n/>`,
  props: [['tabs', 'Tab[]'], ['activeId', 'string'], ['variant', "'underline' | 'pill'"], ['style', 'Style']],
  callbacks: [['onSelect', '(id: string) => void']],
  thumb: (c) => <ThumbTabs c={c} />, preview: (c) => <PreviewTabs c={c} />,
});
register({ id: 'navpanel', label: 'NavPanel', pkg: 'core',
  desc: 'Sidebar navigation with grouped sections and active state highlighting. Fixed-width panel with scrollable content.',
  usage: `<NavPanel\n  sections={[{\n    title: 'Main',\n    items: [{ id: 'home', label: 'Home' }],\n  }]}\n  activeId="home"\n/>`,
  props: [['sections', 'NavSection[]'], ['activeId', 'string'], ['width', 'number'], ['header', 'ReactNode']],
  callbacks: [['onSelect', '(id: string) => void']],
  thumb: (c) => <ThumbNavPanel c={c} />, preview: (c) => <PreviewNavPanel c={c} />,
});
register({ id: 'toolbar', label: 'Toolbar', pkg: 'core',
  desc: 'Horizontal action bar with icon buttons and divider support. Use for editor toolbars and command rows.',
  usage: `<Toolbar items={[\n  { id: 'bold', icon: 'bold' },\n  'divider',\n  { id: 'link', icon: 'link' },\n]} onAction={handleAction} />`,
  props: [['items', "(ToolbarItem | 'divider')[]"], ['style', 'Style']],
  callbacks: [['onAction', '(id: string) => void']],
  thumb: (c) => <ThumbToolbar c={c} />, preview: (c) => <PreviewToolbar c={c} />,
});
register({ id: 'breadcrumbs', label: 'Breadcrumbs', pkg: 'core',
  desc: 'Navigation breadcrumb trail with clickable segments and customizable separator.',
  usage: `<Breadcrumbs\n  items={[\n    { id: 'home', label: 'Home' },\n    { id: 'api', label: 'API' },\n  ]}\n/>`,
  props: [['items', 'BreadcrumbItem[]'], ['separator', 'string'], ['style', 'Style']],
  callbacks: [['onSelect', '(id: string) => void']],
  thumb: (c) => <ThumbBreadcrumbs c={c} />, preview: (c) => <PreviewBreadcrumbs c={c} />,
});
register({ id: 'table', label: 'Table', pkg: 'core',
  desc: 'Columnar data display with configurable headers, column widths, alignment, and striped rows.',
  usage: `<Table\n  columns={[{ key: 'name', title: 'Name' }]}\n  data={[{ name: 'Alice' }]}\n  striped\n/>`,
  props: [['columns', 'TableColumn[]'], ['data', 'T[]'], ['striped', 'boolean'], ['borderless', 'boolean']],
  callbacks: [],
  thumb: (c) => <ThumbTable c={c} />, preview: (c) => <PreviewTable c={c} />,
});
register({ id: 'progressbar', label: 'ProgressBar', pkg: 'core',
  desc: 'Linear progress indicator with configurable colors, height, and optional percentage label.',
  usage: `<ProgressBar value={0.65}\n  color="#3b82f6" height={8} />`,
  props: [['value', 'number (0-1)'], ['color', 'Color'], ['trackColor', 'Color'], ['height', 'number'], ['showLabel', 'boolean']],
  callbacks: [],
  thumb: (c) => <ThumbProgressBar c={c} />, preview: (c) => <PreviewProgressBar c={c} />,
});
register({ id: 'sparkline', label: 'Sparkline', pkg: 'core',
  desc: 'Tiny inline chart for at-a-glance trends. Renders a mini line, area, or dot chart.',
  usage: `<Sparkline\n  data={[4, 7, 2, 8, 5, 9]}\n  width={80} height={24}\n  color="#10b981"\n/>`,
  props: [['data', 'number[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color']],
  callbacks: [],
  thumb: (c) => <ThumbSparkline c={c} />, preview: (c) => <PreviewSparkline c={c} />,
});
register({ id: 'messagebubble', label: 'MessageBubble', pkg: 'core',
  desc: 'Chat message bubble with left/right/center alignment. Includes optional label and timestamp.',
  usage: `<MessageBubble variant="right"\n  label="You" timestamp="2:30 PM">\n  Hello there!\n</MessageBubble>`,
  props: [['variant', "'left' | 'right' | 'center'"], ['label', 'string'], ['timestamp', 'string'], ['bg', 'Color']],
  callbacks: [],
  thumb: (c) => <ThumbMessageBubble c={c} />, preview: (c) => <PreviewMessageBubble c={c} />,
});
register({ id: 'chatinput', label: 'ChatInput', pkg: 'core',
  desc: 'Message input bar with send button and left/right slots. Handles Enter-to-send and disabled state.',
  usage: `<ChatInput\n  onSend={(msg) => send(msg)}\n  placeholder="Type a message..."\n/>`,
  props: [['placeholder', 'string'], ['disabled', 'boolean'], ['sendLabel', 'string'], ['sendColor', 'Color']],
  callbacks: [['onSend', '(text: string) => void'], ['onChangeText', '(text: string) => void']],
  thumb: (c) => <ThumbChatInput c={c} />, preview: (c) => <PreviewChatInput c={c} />,
});
register({ id: 'searchbar', label: 'SearchBar', pkg: 'core',
  desc: 'Debounced search input with magnifier icon and clear button. Zero per-keystroke bridge traffic.',
  usage: `<SearchBar\n  onSearch={setQuery}\n  placeholder="Search..."\n  debounce={300}\n/>`,
  props: [['placeholder', 'string'], ['debounce', 'number'], ['value', 'string'], ['autoFocus', 'boolean']],
  callbacks: [['onSearch', '(query: string) => void'], ['onSubmit', '(query: string) => void']],
  thumb: (c) => <ThumbSearchBar c={c} />, preview: (c) => <PreviewSearchBar c={c} />,
});
register({ id: 'codeblock', label: 'CodeBlock', pkg: 'core',
  desc: 'Syntax-highlighted code display. Lua-owned tokenizer for 60fps rendering.',
  usage: `<CodeBlock language="tsx"\n  fontSize={12}\n  code={\`const x = 42;\`}\n/>`,
  props: [['code', 'string'], ['language', 'string'], ['fontSize', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbCodeBlock c={c} />, preview: (c) => <PreviewCodeBlock c={c} />,
});
register({ id: 'loadingdots', label: 'LoadingDots', pkg: 'core',
  desc: 'Animated ellipsis loading indicator. Cycles through dot patterns.',
  usage: `<LoadingDots color="#8b5cf6" size={12} />`,
  props: [['color', 'Color'], ['size', 'number'], ['count', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbLoadingDots c={c} />, preview: (c) => <PreviewLoadingDots c={c} />,
});
register({ id: 'elementtile', label: 'ElementTile', pkg: 'chemistry',
  desc: 'Periodic table tile with click-to-flip. Front shows number, symbol, mass. Back shows group, period, phase, EN.',
  usage: `import { ElementTile } from '@reactjit/chemistry';\n\n<ElementTile element="Fe" size={64} />`,
  props: [['element', 'number | string'], ['size', 'number'], ['selected', 'boolean'], ['flipped', 'boolean'], ['style', 'Style']],
  callbacks: [['onPress', '(element: Element) => void']],
  thumb: (c) => <ThumbElementTile c={c} />, preview: (c) => <PreviewElementTile c={c} />,
});
register({ id: 'elementcard', label: 'ElementCard', pkg: 'chemistry',
  desc: 'Full element detail card — all properties visible at a glance, no interaction needed.',
  usage: `import { ElementCard } from '@reactjit/chemistry';\n\n<ElementCard element="Fe" />`,
  props: [['element', 'number | string'], ['style', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbElementCard c={c} />, preview: (c) => <PreviewElementCard c={c} />,
});
register({ id: 'knob', label: 'Knob', pkg: 'controls',
  desc: 'Rotary knob with drag interaction. Lua-owned drawing for 60fps response.',
  usage: `import { Knob } from '@reactjit/controls';\n\n<Knob value={0.5} onChange={setVal}\n  label="Gain" color="#f59e0b" />`,
  props: [['value', 'number (0-1)'], ['label', 'string'], ['color', 'Color'], ['size', 'number']],
  callbacks: [['onChange', '(v: number) => void']],
  thumb: (c) => <ThumbKnob c={c} />, preview: (c) => <PreviewKnob c={c} />,
});
register({ id: 'fader', label: 'Fader', pkg: 'controls',
  desc: 'Vertical or horizontal fader slider. Hardware-style control with Lua-owned drag.',
  usage: `import { Fader } from '@reactjit/controls';\n\n<Fader value={0.7} onChange={setLevel}\n  orientation="vertical" />`,
  props: [['value', 'number (0-1)'], ['orientation', "'vertical' | 'horizontal'"], ['color', 'Color']],
  callbacks: [['onChange', '(v: number) => void']],
  thumb: (c) => <ThumbFader c={c} />, preview: (c) => <PreviewFader c={c} />,
});
register({ id: 'meter', label: 'Meter', pkg: 'controls',
  desc: 'Segmented level meter with peak hold. Color zones: green, yellow, red.',
  usage: `import { Meter } from '@reactjit/controls';\n\n<Meter value={0.72} peak={0.85}\n  orientation="vertical" />`,
  props: [['value', 'number (0-1)'], ['peak', 'number (0-1)'], ['orientation', "'vertical' | 'horizontal'"], ['segments', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbMeter c={c} />, preview: (c) => <PreviewMeter c={c} />,
});
register({ id: 'tickersymbol', label: 'TickerSymbol', pkg: 'finance',
  desc: 'Stock/crypto ticker display. Shows symbol, price, change percentage, optional sparkline.',
  usage: `import { TickerSymbol } from '@reactjit/finance';\n\n<TickerSymbol symbol="AAPL"\n  price={182.52} change={1.34} />`,
  props: [['symbol', 'string'], ['price', 'number'], ['change', 'number'], ['changePercent', 'number']],
  callbacks: [['onPress', '() => void']],
  thumb: (c) => <ThumbTickerSymbol c={c} />, preview: (c) => <PreviewTickerSymbol c={c} />,
});
register({ id: 'clock', label: 'Clock', pkg: 'time',
  desc: 'Live updating clock. Shows time, date, or both. Supports timezone selection.',
  usage: `import { Clock } from '@reactjit/time';\n\n<Clock format="time"\n  timezone="America/New_York" />`,
  props: [['format', "'time' | 'date' | 'datetime'"], ['timezone', 'string'], ['fontSize', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbClock c={c} />, preview: (c) => <PreviewClock c={c} />,
});
register({ id: 'stopwatch', label: 'Stopwatch', pkg: 'time',
  desc: 'Self-contained stopwatch with play/pause/reset. Lua-side high-resolution timer.',
  usage: `import { Stopwatch } from '@reactjit/time';\n\n<Stopwatch showMs fontSize={24} />`,
  props: [['showMs', 'boolean'], ['fontSize', 'number'], ['autoStart', 'boolean']],
  callbacks: [['onLap', '(time: number) => void']],
  thumb: (c) => <ThumbStopwatch c={c} />, preview: (c) => <PreviewStopwatch c={c} />,
});
register({ id: 'slider', label: 'Slider', pkg: 'core',
  desc: 'Lua-owned drag slider with zero-latency interaction. Track, fill, and thumb painted at 60fps.',
  usage: `<Slider value={0.5}\n  onChange={setVal}\n  color="#3b82f6" />`,
  props: [['value', 'number'], ['min', 'number'], ['max', 'number'], ['step', 'number'], ['color', 'Color']],
  callbacks: [['onChange', '(v: number) => void']],
  thumb: (c) => <ThumbSlider c={c} />, preview: (c) => <PreviewSlider c={c} />,
});
register({ id: 'switch', label: 'Switch', pkg: 'core',
  desc: 'Toggle switch with animated thumb. Lua-owned on/off state.',
  usage: `<Switch value={on}\n  onChange={setOn} />`,
  props: [['value', 'boolean'], ['disabled', 'boolean'], ['color', 'Color']],
  callbacks: [['onChange', '(v: boolean) => void']],
  thumb: (c) => <ThumbSwitch c={c} />, preview: (c) => <PreviewSwitch c={c} />,
});
register({ id: 'checkbox', label: 'Checkbox', pkg: 'core',
  desc: 'Toggleable checkbox with optional label. Lua-owned state.',
  usage: `<Checkbox checked={val}\n  onChange={setVal}\n  label="Accept terms" />`,
  props: [['checked', 'boolean'], ['label', 'string'], ['disabled', 'boolean']],
  callbacks: [['onChange', '(v: boolean) => void']],
  thumb: (c) => <ThumbCheckbox c={c} />, preview: (c) => <PreviewCheckbox c={c} />,
});
register({ id: 'radio', label: 'RadioGroup', pkg: 'core',
  desc: 'Mutually exclusive radio buttons. Lua-owned selection state.',
  usage: `<RadioGroup value={sel}\n  onChange={setSel}\n  options={[\n    { value: 'a', label: 'Option A' },\n  ]} />`,
  props: [['value', 'string'], ['options', 'RadioOption[]'], ['disabled', 'boolean']],
  callbacks: [['onChange', '(v: string) => void']],
  thumb: (c) => <ThumbRadio c={c} />, preview: (c) => <PreviewRadio c={c} />,
});
register({ id: 'select', label: 'Select', pkg: 'core',
  desc: 'Dropdown select with keyboard navigation. Lua-owned open/close and hover.',
  usage: `<Select value={val}\n  onChange={setVal}\n  options={[\n    { value: 'a', label: 'Alpha' },\n  ]} />`,
  props: [['value', 'string'], ['options', 'SelectOption[]'], ['placeholder', 'string']],
  callbacks: [['onChange', '(v: string) => void']],
  thumb: (c) => <ThumbSelect c={c} />, preview: (c) => <PreviewSelect c={c} />,
});
register({ id: 'barchart', label: 'BarChart', pkg: 'core',
  desc: 'Vertical bar chart with optional hover interaction and category labels.',
  usage: `<BarChart\n  data={[{ label: 'Jan', value: 42 }]}\n  width={300} height={200} />`,
  props: [['data', 'BarData[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color']],
  callbacks: [['onPress', '(item: BarData) => void']],
  thumb: (c) => <ThumbBarChart c={c} />, preview: (c) => <PreviewBarChart c={c} />,
});
register({ id: 'linechart', label: 'LineChart', pkg: 'core',
  desc: 'Line chart with optional dots, area fill, and hover events.',
  usage: `<LineChart\n  data={[10, 20, 15, 30]}\n  width={300} height={200}\n  color="#3b82f6" />`,
  props: [['data', 'number[]'], ['width', 'number'], ['height', 'number'], ['color', 'Color'], ['showDots', 'boolean'], ['showArea', 'boolean']],
  callbacks: [['onHover', '(index: number) => void']],
  thumb: (c) => <ThumbLineChart c={c} />, preview: (c) => <PreviewLineChart c={c} />,
});
register({ id: 'piechart', label: 'PieChart', pkg: 'core',
  desc: 'Pie or donut chart with labeled segments and optional interactivity.',
  usage: `<PieChart\n  data={[\n    { label: 'A', value: 30 },\n    { label: 'B', value: 70 },\n  ]}\n  size={200} />`,
  props: [['data', 'PieData[]'], ['size', 'number'], ['donut', 'boolean']],
  callbacks: [['onSelect', '(item: PieData) => void']],
  thumb: (c) => <ThumbPieChart c={c} />, preview: (c) => <PreviewPieChart c={c} />,
});
register({ id: 'radarchart', label: 'RadarChart', pkg: 'core',
  desc: 'Polygon radar/spider chart across N axes.',
  usage: `<RadarChart\n  axes={['Str', 'Dex', 'Int']}\n  data={[0.8, 0.5, 0.9]}\n  size={200} />`,
  props: [['axes', 'string[]'], ['data', 'number[]'], ['size', 'number'], ['color', 'Color']],
  callbacks: [],
  thumb: (c) => <ThumbRadarChart c={c} />, preview: (c) => <PreviewRadarChart c={c} />,
});
register({ id: 'candlestick', label: 'Candlestick', pkg: 'core',
  desc: 'OHLC candlestick chart with overlay support for moving averages.',
  usage: `<CandlestickChart\n  data={candles}\n  width={400} height={250} />`,
  props: [['data', 'Candle[]'], ['width', 'number'], ['height', 'number'], ['overlays', 'Overlay[]']],
  callbacks: [['onPress', '(candle: Candle) => void']],
  thumb: (c) => <ThumbCandlestick c={c} />, preview: (c) => <PreviewCandlestick c={c} />,
});
register({ id: 'orderbook', label: 'OrderBook', pkg: 'core',
  desc: 'Two-column bid/ask order book with depth bars and press selection.',
  usage: `<OrderBook\n  bids={bids} asks={asks}\n  width={300} />`,
  props: [['bids', 'BookLevel[]'], ['asks', 'BookLevel[]'], ['width', 'number'], ['precision', 'number']],
  callbacks: [['onSelect', '(level: BookLevel) => void']],
  thumb: (c) => <ThumbOrderBook c={c} />, preview: (c) => <PreviewOrderBook c={c} />,
});
register({ id: 'led', label: 'LEDIndicator', pkg: 'controls',
  desc: 'Glowing LED dot with on/off states and configurable color and glow radius.',
  usage: `import { LEDIndicator } from '@reactjit/controls';\n\n<LEDIndicator on color="#22c55e" />`,
  props: [['on', 'boolean'], ['color', 'Color'], ['size', 'number'], ['glow', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbLED c={c} />, preview: (c) => <PreviewLED c={c} />,
});
register({ id: 'padbutton', label: 'PadButton', pkg: 'controls',
  desc: 'MPC-style square pad with press/release callbacks and active state.',
  usage: `import { PadButton } from '@reactjit/controls';\n\n<PadButton\n  onPress={() => trigger(note)}\n  color="#ef4444" />`,
  props: [['color', 'Color'], ['size', 'number'], ['label', 'string']],
  callbacks: [['onPress', '() => void'], ['onRelease', '() => void']],
  thumb: (c) => <ThumbPadButton c={c} />, preview: (c) => <PreviewPadButton c={c} />,
});
register({ id: 'stepsequencer', label: 'StepSequencer', pkg: 'controls',
  desc: 'Interactive step sequencer grid. Lua-owned drag-to-paint pattern editing.',
  usage: `import { StepSequencer } from '@reactjit/controls';\n\n<StepSequencer\n  steps={16} tracks={4}\n  pattern={pattern}\n  onChange={setPattern} />`,
  props: [['steps', 'number'], ['tracks', 'number'], ['pattern', 'boolean[][]'], ['activeStep', 'number']],
  callbacks: [['onChange', '(pattern: boolean[][]) => void']],
  thumb: (c) => <ThumbStepSequencer c={c} />, preview: (c) => <PreviewStepSequencer c={c} />,
});
register({ id: 'transport', label: 'TransportBar', pkg: 'controls',
  desc: 'Play/stop/record transport controls with BPM and position display.',
  usage: `import { TransportBar } from '@reactjit/controls';\n\n<TransportBar\n  playing={isPlaying}\n  bpm={120}\n  onPlay={play}\n  onStop={stop} />`,
  props: [['playing', 'boolean'], ['recording', 'boolean'], ['bpm', 'number'], ['position', 'string']],
  callbacks: [['onPlay', '() => void'], ['onStop', '() => void'], ['onRecord', '() => void']],
  thumb: (c) => <ThumbTransport c={c} />, preview: (c) => <PreviewTransport c={c} />,
});
register({ id: 'piano', label: 'PianoKeyboard', pkg: 'controls',
  desc: 'Lua-owned piano keyboard with glissando, hover, and MIDI note callbacks.',
  usage: `import { PianoKeyboard } from '@reactjit/controls';\n\n<PianoKeyboard\n  octaves={2} startOctave={3}\n  onNoteOn={play}\n  onNoteOff={stop} />`,
  props: [['octaves', 'number'], ['startOctave', 'number'], ['width', 'number'], ['height', 'number']],
  callbacks: [['onNoteOn', '(note: number) => void'], ['onNoteOff', '(note: number) => void']],
  thumb: (c) => <ThumbPiano c={c} />, preview: (c) => <PreviewPiano c={c} />,
});
register({ id: 'xypad', label: 'XYPad', pkg: 'controls',
  desc: '2D XY control pad. Maps thumb position to two continuous parameters.',
  usage: `import { XYPad } from '@reactjit/controls';\n\n<XYPad x={0.5} y={0.5}\n  onChange={({ x, y }) => update(x, y)} />`,
  props: [['x', 'number (0-1)'], ['y', 'number (0-1)'], ['size', 'number'], ['color', 'Color']],
  callbacks: [['onChange', '({ x, y }) => void']],
  thumb: (c) => <ThumbXYPad c={c} />, preview: (c) => <PreviewXYPad c={c} />,
});
register({ id: 'pitchwheel', label: 'PitchWheel', pkg: 'controls',
  desc: 'Vertical pitch wheel with optional spring-return to center.',
  usage: `import { PitchWheel } from '@reactjit/controls';\n\n<PitchWheel value={0}\n  onChange={setPitch}\n  springReturn />`,
  props: [['value', 'number (-1 to 1)'], ['springReturn', 'boolean'], ['height', 'number']],
  callbacks: [['onChange', '(v: number) => void']],
  thumb: (c) => <ThumbPitchWheel c={c} />, preview: (c) => <PreviewPitchWheel c={c} />,
});
register({ id: 'periodictable', label: 'PeriodicTable', pkg: 'chemistry',
  desc: 'Grid of 118 ElementTiles in the standard periodic table layout.',
  usage: `import { PeriodicTable } from '@reactjit/chemistry';\n\n<PeriodicTable\n  onSelect={setElement}\n  tileSize={32} />`,
  props: [['tileSize', 'number'], ['selected', 'number | null'], ['style', 'Style']],
  callbacks: [['onSelect', '(el: Element) => void']],
  thumb: (c) => <ThumbPeriodicTable c={c} />, preview: (c) => <PreviewPeriodicTable c={c} />,
});
register({ id: 'moleculecard', label: 'MoleculeCard', pkg: 'chemistry',
  desc: 'Molecule summary with formula, molar mass, geometry, and composition.',
  usage: `import { MoleculeCard } from '@reactjit/chemistry';\n\n<MoleculeCard formula="H2O" />`,
  props: [['formula', 'string'], ['showBonds', 'boolean'], ['style', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbMoleculeCard c={c} />, preview: (c) => <PreviewMoleculeCard c={c} />,
});
register({ id: 'electronshell', label: 'ElectronShell', pkg: 'chemistry',
  desc: 'Bohr model electron shell diagram with orbital rings and electron dots.',
  usage: `import { ElectronShell } from '@reactjit/chemistry';\n\n<ElectronShell element="Fe" />`,
  props: [['element', 'number | string'], ['animated', 'boolean'], ['style', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbElectronShell c={c} />, preview: (c) => <PreviewElectronShell c={c} />,
});
register({ id: 'reactionview', label: 'ReactionView', pkg: 'chemistry',
  desc: 'Chemical equation renderer. Balances equations and shows reaction type/enthalpy.',
  usage: `import { ReactionView } from '@reactjit/chemistry';\n\n<ReactionView\n  equation="Fe + O2 -> Fe2O3" />`,
  props: [['equation', 'string'], ['animated', 'boolean'], ['showEnergy', 'boolean']],
  callbacks: [],
  thumb: (c) => <ThumbReactionView c={c} />, preview: (c) => <PreviewReactionView c={c} />,
});
register({ id: 'tickertape', label: 'TickerTape', pkg: 'finance',
  desc: 'Horizontally scrolling live ticker tape with selectable symbols.',
  usage: `import { TickerTape } from '@reactjit/finance';\n\n<TickerTape\n  items={tickers}\n  speed={40} />`,
  props: [['items', 'TickerItem[]'], ['speed', 'number']],
  callbacks: [['onSelect', '(sym: string) => void']],
  thumb: (c) => <ThumbTickerTape c={c} />, preview: (c) => <PreviewTickerTape c={c} />,
});
register({ id: 'portfoliocard', label: 'PortfolioCard', pkg: 'finance',
  desc: 'Portfolio summary card with holdings list, total value, and day P&L.',
  usage: `import { PortfolioCard } from '@reactjit/finance';\n\n<PortfolioCard\n  snapshot={portfolio} />`,
  props: [['snapshot', 'PortfolioSnapshot'], ['style', 'Style']],
  callbacks: [],
  thumb: (c) => <ThumbPortfolioCard c={c} />, preview: (c) => <PreviewPortfolioCard c={c} />,
});
register({ id: 'rsigauge', label: 'RSIGauge', pkg: 'finance',
  desc: 'RSI indicator gauge with overbought/oversold zones.',
  usage: `import { RSIGauge } from '@reactjit/finance';\n\n<RSIGauge value={65} />`,
  props: [['value', 'number (0-100)'], ['width', 'number'], ['height', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbRSIGauge c={c} />, preview: (c) => <PreviewRSIGauge c={c} />,
});
register({ id: 'macdpanel', label: 'MACDPanel', pkg: 'finance',
  desc: 'MACD histogram + signal line panel for technical analysis.',
  usage: `import { MACDPanel } from '@reactjit/finance';\n\n<MACDPanel data={macdData}\n  width={400} height={150} />`,
  props: [['data', 'MACDPoint[]'], ['width', 'number'], ['height', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbMACDPanel c={c} />, preview: (c) => <PreviewMACDPanel c={c} />,
});
register({ id: 'countdown', label: 'Countdown', pkg: 'time',
  desc: 'Self-contained countdown timer with start/pause/reset and onComplete.',
  usage: `import { Countdown } from '@reactjit/time';\n\n<Countdown\n  duration={60000}\n  onComplete={done} />`,
  props: [['duration', 'number (ms)'], ['autoStart', 'boolean'], ['showMs', 'boolean'], ['controls', 'boolean']],
  callbacks: [['onComplete', '() => void'], ['onTick', '(remaining: number) => void']],
  thumb: (c) => <ThumbCountdown c={c} />, preview: (c) => <PreviewCountdown c={c} />,
});
register({ id: 'minimalchat', label: 'MinimalChat', pkg: 'ai',
  desc: 'Bare-minimum self-contained AI chat. Messages + input, calls useChat internally.',
  usage: `import { MinimalChat } from '@reactjit/ai';\n\n<MinimalChat\n  model="claude-sonnet-4-6" />`,
  props: [['model', 'string'], ['systemPrompt', 'string'], ['placeholder', 'string']],
  callbacks: [],
  thumb: (c) => <ThumbMinimalChat c={c} />, preview: (c) => <PreviewMinimalChat c={c} />,
});
register({ id: 'spreadsheet', label: 'Spreadsheet', pkg: 'data',
  desc: 'Interactive spreadsheet with formula engine. SUM, IF, VLOOKUP, and more.',
  usage: `import { Spreadsheet } from '@reactjit/data';\n\n<Spreadsheet\n  rows={20} cols={8}\n  data={initial} />`,
  props: [['rows', 'number'], ['cols', 'number'], ['data', 'CellData[][]']],
  callbacks: [['onChange', '(data: CellData[][]) => void']],
  thumb: (c) => <ThumbSpreadsheet c={c} />, preview: (c) => <PreviewSpreadsheet c={c} />,
});
register({ id: 'commandpalette', label: 'CommandPalette', pkg: 'core',
  desc: 'Full-screen modal command launcher with fuzzy search, shortcuts, and groups.',
  usage: `<CommandPalette\n  commands={cmds}\n  onSelect={run}\n  visible={open} />`,
  props: [['commands', 'Command[]'], ['visible', 'boolean'], ['placeholder', 'string']],
  callbacks: [['onSelect', '(cmd: Command) => void'], ['onClose', '() => void']],
  thumb: (c) => <ThumbCommandPalette c={c} />, preview: (c) => <PreviewCommandPalette c={c} />,
});
register({ id: 'statcard', label: 'StatCard', pkg: 'apis',
  desc: 'Metric card with label, value, optional sublabel and trend arrow.',
  usage: `import { StatCard } from '@reactjit/apis';\n\n<StatCard\n  label="Revenue" value="$12.4k"\n  trend="up" />`,
  props: [['label', 'string'], ['value', 'string'], ['sublabel', 'string'], ['trend', "'up' | 'down' | 'flat'"]],
  callbacks: [],
  thumb: (c) => <ThumbStatCard c={c} />, preview: (c) => <PreviewStatCard c={c} />,
});
register({ id: 'nowplayingcard', label: 'NowPlayingCard', pkg: 'apis',
  desc: 'Album art + track/artist + progress bar card. Wires to Spotify/Last.fm.',
  usage: `import { NowPlayingCard } from '@reactjit/apis';\n\n<NowPlayingCard\n  track={nowPlaying} />`,
  props: [['track', 'NowPlaying'], ['style', 'Style']],
  callbacks: [['onPress', '() => void']],
  thumb: (c) => <ThumbNowPlaying c={c} />, preview: (c) => <PreviewNowPlaying c={c} />,
});
register({ id: 'repocard', label: 'RepoCard', pkg: 'apis',
  desc: 'GitHub repository card with stars, language, and description.',
  usage: `import { RepoCard } from '@reactjit/apis';\n\n<RepoCard\n  repo={repoData} />`,
  props: [['repo', 'GitHubRepo'], ['style', 'Style']],
  callbacks: [['onPress', '() => void']],
  thumb: (c) => <ThumbRepoCard c={c} />, preview: (c) => <PreviewRepoCard c={c} />,
});
register({ id: 'imagegallery', label: 'ImageGallery', pkg: 'core',
  desc: 'Grid/column thumbnail gallery with click-to-open lightbox viewer.',
  usage: `<ImageGallery\n  images={urls}\n  columns={3} />`,
  props: [['images', 'string[] | GalleryImage[]'], ['columns', 'number'], ['gap', 'number']],
  callbacks: [['onSelect', '(index: number) => void']],
  thumb: (c) => <ThumbImageGallery c={c} />, preview: (c) => <PreviewImageGallery c={c} />,
});
register({ id: 'contextmenu', label: 'ContextMenu', pkg: 'core',
  desc: 'Right-click context menu with keyboard nav and nested submenus.',
  usage: `<ContextMenu items={[\n  { id: 'copy', label: 'Copy' },\n  { id: 'paste', label: 'Paste' },\n]} onSelect={handle} />`,
  props: [['items', 'MenuItem[]'], ['visible', 'boolean'], ['x', 'number'], ['y', 'number']],
  callbacks: [['onSelect', '(id: string) => void'], ['onClose', '() => void']],
  thumb: (c) => <ThumbContextMenu c={c} />, preview: (c) => <PreviewContextMenu c={c} />,
});
register({ id: 'math', label: 'Math', pkg: 'core',
  desc: 'LaTeX math typesetting. Lua parses and renders glyphs via Love2D.',
  usage: `<Math\n  tex="E = mc^2"\n  fontSize={18} />`,
  props: [['tex', 'string'], ['fontSize', 'number'], ['color', 'Color']],
  callbacks: [],
  thumb: (c) => <ThumbMath c={c} />, preview: (c) => <PreviewMath c={c} />,
});
register({ id: 'messagelist', label: 'MessageList', pkg: 'core',
  desc: 'Scrollable container for chat messages with inverted scroll and empty state.',
  usage: `<MessageList\n  messages={msgs}\n  renderMessage={renderFn} />`,
  props: [['messages', 'Message[]'], ['inverted', 'boolean'], ['emptyText', 'string']],
  callbacks: [],
  thumb: (c) => <ThumbMessageList c={c} />, preview: (c) => <PreviewMessageList c={c} />,
});
register({ id: 'actionbar', label: 'ActionBar', pkg: 'core',
  desc: 'Horizontal row of labeled action buttons (copy, delete, regenerate).',
  usage: `<ActionBar items={[\n  { key: 'copy', label: 'Copy' },\n  { key: 'delete', label: 'Delete' },\n]} onAction={handle} />`,
  props: [['items', 'ActionBarItem[]']],
  callbacks: [['onAction', '(id: string) => void']],
  thumb: (c) => <ThumbActionBar c={c} />, preview: (c) => <PreviewActionBar c={c} />,
});
register({ id: 'flatlist', label: 'FlatList', pkg: 'core',
  desc: 'Virtualized scrollable list. Only mounts visible items + buffer zone.',
  usage: `<FlatList\n  data={items}\n  renderItem={({ item }) => <Row item={item} />}\n  itemHeight={40} />`,
  props: [['data', 'T[]'], ['renderItem', '(info: { item: T }) => ReactNode'], ['itemHeight', 'number']],
  callbacks: [],
  thumb: (c) => <ThumbFlatList c={c} />, preview: (c) => <PreviewFlatList c={c} />,
});
