/**
 * GalleryComponents — Thumbnail renderers and live preview renderers
 * for the Component Gallery story.
 *
 * Each component gets:
 *   - A Thumb* component (tiny visual for the tab cell, ~68×54px)
 *   - A Preview* component (full-size live demo for the main area)
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
  MessageList, ActionBar, FlatList,
} from '../../../packages/core/src';
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
  { name: 'ElementCard', pkg: 'chemistry', status: 'Stable' },
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

// ══════════════════════════════════════════════════════════
// THUMBNAILS — tiny previews for the tab bar cells
// ══════════════════════════════════════════════════════════

export function ThumbCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 50, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
        <Box style={{ paddingLeft: 4, paddingTop: 2, paddingBottom: 2, borderBottomWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 4, fontWeight: 'bold' }}>{'Title'}</Text>
        </Box>
        <Box style={{ padding: 3, gap: 2 }}>
          <Box style={{ width: 30, height: 2, backgroundColor: c.muted, borderRadius: 1 }} />
          <Box style={{ width: 20, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbBadge({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <Box style={{ flexDirection: 'row', gap: 2 }}>
        <Box style={{ backgroundColor: '#166534', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#bbf7d0', fontSize: 3.5 }}>{'OK'}</Text>
        </Box>
        <Box style={{ backgroundColor: '#854d0e', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#fef08a', fontSize: 3.5 }}>{'WARN'}</Text>
        </Box>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 2 }}>
        <Box style={{ backgroundColor: '#991b1b', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#fecaca', fontSize: 3.5 }}>{'ERR'}</Text>
        </Box>
        <Box style={{ backgroundColor: '#1e40af', borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          <Text style={{ color: '#bfdbfe', fontSize: 3.5 }}>{'INFO'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbTabs({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderBottomWidth: 2, borderColor: C.accent }}>
          <Text style={{ color: c.text, fontSize: 4 }}>{'Tab A'}</Text>
        </Box>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ color: c.muted, fontSize: 4 }}>{'Tab B'}</Text>
        </Box>
        <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ color: c.muted, fontSize: 4 }}>{'Tab C'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbNavPanel({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 36, backgroundColor: c.surface, borderRadius: 2, borderWidth: 1, borderColor: c.border, padding: 3, gap: 2 }}>
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
      </Box>
    </Box>
  );
}

export function ThumbToolbar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 2, backgroundColor: c.surface, borderRadius: 3, padding: 3, borderWidth: 1, borderColor: c.border }}>
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
        <Box style={{ width: 1, height: 8, backgroundColor: c.border }} />
        <Box style={{ width: 8, height: 8, backgroundColor: C.accentDim, borderRadius: 2 }} />
        <Box style={{ width: 8, height: 8, backgroundColor: c.border, borderRadius: 2 }} />
      </Box>
    </Box>
  );
}

export function ThumbBreadcrumbs({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Text style={{ color: c.muted, fontSize: 4 }}>{'Home'}</Text>
        <Text style={{ color: c.muted, fontSize: 4 }}>{'/'}</Text>
        <Text style={{ color: c.muted, fontSize: 4 }}>{'Docs'}</Text>
        <Text style={{ color: c.muted, fontSize: 4 }}>{'/'}</Text>
        <Text style={{ color: c.text, fontSize: 4 }}>{'API'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbTable({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 52, borderWidth: 1, borderColor: c.border, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ flexDirection: 'row', backgroundColor: c.surface, paddingLeft: 3, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ color: c.text, fontSize: 3, fontWeight: 'bold', width: 20 }}>{'Name'}</Text>
          <Text style={{ color: c.text, fontSize: 3, fontWeight: 'bold' }}>{'Val'}</Text>
        </Box>
        {[0, 1].map(i => (
          <Box key={i} style={{ flexDirection: 'row', paddingLeft: 3, paddingTop: 1, paddingBottom: 1, backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
            <Box style={{ width: 20, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
            <Box style={{ width: 10, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.3, marginLeft: 4 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ThumbProgressBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 6 }}>
      <Box style={{ width: 50, height: 4, backgroundColor: c.surface, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ width: '85%', height: 4, backgroundColor: C.accent, borderRadius: 2 }} />
      </Box>
      <Box style={{ width: 50, height: 4, backgroundColor: c.surface, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ width: '45%', height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }} />
      </Box>
      <Box style={{ width: 50, height: 4, backgroundColor: c.surface, borderRadius: 2, overflow: 'hidden' }}>
        <Box style={{ width: '92%', height: 4, backgroundColor: '#10b981', borderRadius: 2 }} />
      </Box>
    </Box>
  );
}

export function ThumbSparkline({ c }: { c: ThemeColors }) {
  const pts = [3, 5, 2, 7, 4, 8, 6, 9, 5, 7];
  const max = 9;
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'end', alignItems: 'center', paddingBottom: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 1, alignItems: 'end', height: 24 }}>
        {pts.map((v, i) => (
          <Box key={i} style={{ width: 3, height: (v / max) * 20 + 2, backgroundColor: '#10b981', borderRadius: 1, opacity: 0.6 + (v / max) * 0.4 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbMessageBubble({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', padding: 4, gap: 3 }}>
      <Box style={{ alignSelf: 'start', backgroundColor: '#1e293b', borderRadius: 4, borderTopLeftRadius: 1, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, maxWidth: 40 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 3.5 }}>{'Hello!'}</Text>
      </Box>
      <Box style={{ alignSelf: 'end', backgroundColor: '#2563eb', borderRadius: 4, borderTopRightRadius: 1, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, maxWidth: 40 }}>
        <Text style={{ color: '#fff', fontSize: 3.5 }}>{'Hi there'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbChatInput({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
      <Box style={{ flexDirection: 'row', width: 54, gap: 2, alignItems: 'center', backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border, padding: 3 }}>
        <Box style={{ flexGrow: 1, height: 6, backgroundColor: c.bg, borderRadius: 2 }}>
          <Text style={{ color: c.muted, fontSize: 3, paddingLeft: 2 }}>{'Type...'}</Text>
        </Box>
        <Box style={{ width: 10, height: 8, backgroundColor: '#3b82f6', borderRadius: 2, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 3 }}>{'>'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbSearchBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
      <Box style={{ flexDirection: 'row', width: 54, gap: 3, alignItems: 'center', backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border, padding: 3 }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: c.muted }} />
        <Box style={{ flexGrow: 1, height: 3, backgroundColor: c.muted, borderRadius: 1, opacity: 0.3 }} />
      </Box>
    </Box>
  );
}

export function ThumbCodeBlock({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
      <Box style={{ width: 52, backgroundColor: '#0d1117', borderRadius: 3, padding: 3, gap: 2, borderWidth: 1, borderColor: '#30363d' }}>
        <Box style={{ flexDirection: 'row', gap: 2 }}>
          <Box style={{ width: 12, height: 3, backgroundColor: '#ff7b72', borderRadius: 1 }} />
          <Box style={{ width: 16, height: 3, backgroundColor: '#79c0ff', borderRadius: 1 }} />
        </Box>
        <Box style={{ flexDirection: 'row', gap: 2, paddingLeft: 4 }}>
          <Box style={{ width: 10, height: 3, backgroundColor: '#7ee787', borderRadius: 1 }} />
          <Box style={{ width: 8, height: 3, backgroundColor: '#d2a8ff', borderRadius: 1 }} />
        </Box>
        <Box style={{ flexDirection: 'row', gap: 2 }}>
          <Box style={{ width: 6, height: 3, backgroundColor: '#ff7b72', borderRadius: 1 }} />
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbLoadingDots({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3 }} />
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3, opacity: 0.6 }} />
        <Box style={{ width: 6, height: 6, backgroundColor: C.accent, borderRadius: 3, opacity: 0.3 }} />
      </Box>
    </Box>
  );
}

export function ThumbElementCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 32, height: 36, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: '#10b981', padding: 2, gap: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#10b981', fontSize: 3 }}>{'26'}</Text>
        <Text style={{ color: c.text, fontSize: 8, fontWeight: 'bold' }}>{'Fe'}</Text>
        <Text style={{ color: c.muted, fontSize: 3 }}>{'55.84'}</Text>
      </Box>
    </Box>
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
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
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
    </Box>
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
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 20, height: trackH, position: 'relative' }}>
        {/* Inactive track */}
        <Box style={{ position: 'absolute', left: 9, top: 0, width: trackW, height: trackH, backgroundColor: '#1e1e1e', borderRadius: 1 }} />
        {/* Active fill (from bottom) */}
        <Box style={{ position: 'absolute', left: 9, bottom: 0, width: trackW, height: fillH, backgroundColor: '#f59e0b', borderRadius: 1 }} />
        {/* Thumb bar */}
        <Box style={{ position: 'absolute', left: (20 - thumbW) / 2, top: thumbY, width: thumbW, height: thumbH, backgroundColor: '#ccc', borderRadius: 1, borderWidth: 1, borderColor: '#666' }} />
      </Box>
    </Box>
  );
}

export function ThumbMeter({ c }: { c: ThemeColors }) {
  const segs = [1, 1, 1, 1, 1, 0.6, 0.3, 0];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ gap: 1 }}>
        {segs.map((opacity, i) => {
          const color = i >= 6 ? '#ef4444' : i >= 4 ? '#f59e0b' : '#10b981';
          return (
            <Box key={i} style={{ width: 20, height: 3, backgroundColor: color, borderRadius: 1, opacity: opacity || 0.15 }} />
          );
        }).reverse()}
      </Box>
    </Box>
  );
}

export function ThumbTickerSymbol({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 5, fontWeight: 'bold' }}>{'AAPL'}</Text>
      <Text style={{ color: c.text, fontSize: 7 }}>{'$182.52'}</Text>
      <Text style={{ color: '#10b981', fontSize: 4 }}>{'+0.74%'}</Text>
    </Box>
  );
}

export function ThumbClock({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 9, fontWeight: 'bold' }}>{'12:34'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'PM'}</Text>
    </Box>
  );
}

export function ThumbStopwatch({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 7, fontWeight: 'bold' }}>{'02:45'}</Text>
      <Text style={{ color: '#06b6d4', fontSize: 4 }}>{'.320'}</Text>
    </Box>
  );
}

// ── New thumbnails ──────────────────────────────────────

export function ThumbSlider({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: 6 }}>
      <Box style={{ width: 50, height: 4, backgroundColor: c.surface, borderRadius: 2, position: 'relative' }}>
        <Box style={{ width: '60%', height: 4, backgroundColor: '#3b82f6', borderRadius: 2 }} />
        <Box style={{ position: 'absolute', left: 28, top: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff', borderWidth: 1, borderColor: '#3b82f6' }} />
      </Box>
    </Box>
  );
}

export function ThumbSwitch({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <Box style={{ width: 24, height: 12, backgroundColor: '#22c55e', borderRadius: 6, position: 'relative' }}>
        <Box style={{ position: 'absolute', right: 2, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
      </Box>
      <Box style={{ width: 24, height: 12, backgroundColor: c.surface, borderRadius: 6, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 2, top: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#999' }} />
      </Box>
    </Box>
  );
}

export function ThumbCheckbox({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <Box style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 5 }}>{'✓'}</Text>
        </Box>
        <Text style={{ color: c.text, fontSize: 4 }}>{'On'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 2, borderWidth: 1, borderColor: c.border }} />
        <Text style={{ color: c.muted, fontSize: 4 }}>{'Off'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbRadio({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      {['A', 'B', 'C'].map((l, i) => (
        <Box key={l} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
          <Box style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: i === 0 ? '#3b82f6' : c.border, justifyContent: 'center', alignItems: 'center' }}>
            {i === 0 && <Box style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: '#3b82f6' }} />}
          </Box>
          <Text style={{ color: i === 0 ? c.text : c.muted, fontSize: 4 }}>{l}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function ThumbSelect({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', width: 44, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, padding: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text, fontSize: 4 }}>{'Option'}</Text>
        <Text style={{ color: c.muted, fontSize: 5 }}>{'▾'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbBarChart({ c }: { c: ThemeColors }) {
  const bars = [0.6, 0.9, 0.4, 0.7, 0.5];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'end', alignItems: 'center', paddingBottom: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 2, alignItems: 'end', height: 28 }}>
        {bars.map((v, i) => (
          <Box key={i} style={{ width: 6, height: v * 26, backgroundColor: '#3b82f6', borderRadius: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbLineChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 1, alignItems: 'end', height: 24 }}>
        {[4, 7, 3, 8, 5, 9, 6].map((v, i) => (
          <Box key={i} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: '#3b82f6', marginBottom: v * 2 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbPieChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 4, borderColor: '#3b82f6', position: 'relative', overflow: 'hidden' }}>
        <Box style={{ position: 'absolute', top: 0, right: 0, width: 14, height: 14, backgroundColor: '#10b981' }} />
        <Box style={{ position: 'absolute', bottom: 0, left: 0, width: 14, height: 8, backgroundColor: '#f59e0b' }} />
      </Box>
    </Box>
  );
}

export function ThumbRadarChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 30, height: 30, borderWidth: 1, borderColor: c.border, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }}>
        <Box style={{ width: 18, height: 18, borderWidth: 1, borderColor: c.border, borderRadius: 9, justifyContent: 'center', alignItems: 'center' }}>
          <Box style={{ width: 8, height: 8, backgroundColor: 'rgba(59,130,246,0.3)', borderRadius: 4 }} />
        </Box>
      </Box>
    </Box>
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
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 3, alignItems: 'end', height: 28 }}>
        {candles.map((c2, i) => (
          <Box key={i} style={{ width: 4, height: c2.h, backgroundColor: c2.up ? '#22c55e' : '#ef4444', borderRadius: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbOrderBook({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
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
    </Box>
  );
}

export function ThumbLED({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#333' }} />
      </Box>
    </Box>
  );
}

export function ThumbPadButton({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 32, gap: 2 }}>
        {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].map(col => (
          <Box key={col} style={{ width: 14, height: 14, backgroundColor: col, borderRadius: 2, opacity: 0.8 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbStepSequencer({ c }: { c: ThemeColors }) {
  const pattern = [1,0,1,0,0,1,0,1, 0,1,0,0,1,0,1,0];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 48, gap: 1 }}>
        {pattern.map((on, i) => (
          <Box key={i} style={{ width: 5, height: 5, backgroundColor: on ? '#f59e0b' : '#222', borderRadius: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbTransport({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Box style={{ width: 0, height: 0, borderLeftWidth: 6, borderTopWidth: 4, borderBottomWidth: 4, borderColor: 'transparent', borderLeftColor: '#22c55e' }} />
        <Box style={{ width: 6, height: 8, backgroundColor: c.muted, borderRadius: 1 }} />
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
      </Box>
    </Box>
  );
}

export function ThumbPiano({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'end', alignItems: 'center', paddingBottom: 4 }}>
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        {[1,0,1,0,1,1,0,1,0,1,0,1].map((white, i) => (
          <Box key={i} style={{ width: white ? 4 : 3, height: white ? 20 : 13, backgroundColor: white ? '#eee' : '#222', borderRadius: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbXYPad({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 32, height: 32, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 18, top: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: '#8b5cf6' }} />
      </Box>
    </Box>
  );
}

export function ThumbPitchWheel({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 14, height: 30, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, position: 'relative' }}>
        <Box style={{ position: 'absolute', left: 1, top: 12, width: 10, height: 6, backgroundColor: '#ccc', borderRadius: 2 }} />
      </Box>
    </Box>
  );
}

export function ThumbPeriodicTable({ c }: { c: ThemeColors }) {
  const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#cc5de8'];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 48, gap: 1 }}>
        {colors.map((col, i) => (
          <Box key={i} style={{ width: 5, height: 5, backgroundColor: col, borderRadius: 1 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbMoleculeCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 8, fontWeight: 'bold' }}>{'H₂O'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'18.015 g/mol'}</Text>
    </Box>
  );
}

export function ThumbElectronShell({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
        <Box style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbReactionView({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
      <Box style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Text style={{ color: c.text, fontSize: 5 }}>{'A+B'}</Text>
        <Text style={{ color: '#10b981', fontSize: 6 }}>{'→'}</Text>
        <Text style={{ color: c.text, fontSize: 5 }}>{'C'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbTickerTape({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Text style={{ color: '#22c55e', fontSize: 4 }}>{'AAPL↑'}</Text>
        <Text style={{ color: '#ef4444', fontSize: 4 }}>{'TSLA↓'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbPortfolioCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 5, fontWeight: 'bold' }}>{'$12.4k'}</Text>
      <Text style={{ color: '#22c55e', fontSize: 4 }}>{'+2.3%'}</Text>
    </Box>
  );
}

export function ThumbRSIGauge({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 36, height: 4, backgroundColor: c.surface, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <Box style={{ width: '65%', height: 4, backgroundColor: '#f59e0b', borderRadius: 2 }} />
      </Box>
      <Text style={{ color: c.muted, fontSize: 4, marginTop: 2 }}>{'RSI 65'}</Text>
    </Box>
  );
}

export function ThumbMACDPanel({ c }: { c: ThemeColors }) {
  const bars = [3, 5, -2, -4, 1, 6, 4, -1];
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', height: 24 }}>
        {bars.map((v, i) => (
          <Box key={i} style={{ width: 3, height: Math.abs(v) * 2.5, backgroundColor: v >= 0 ? '#22c55e' : '#ef4444', borderRadius: 1, marginTop: v < 0 ? 0 : undefined, marginBottom: v >= 0 ? 0 : undefined }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbCountdown({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: '#ef4444', fontSize: 8, fontWeight: 'bold' }}>{'0:30'}</Text>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'remaining'}</Text>
    </Box>
  );
}

export function ThumbMinimalChat({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', padding: 4, gap: 2 }}>
      <Box style={{ alignSelf: 'end', backgroundColor: '#2563eb', borderRadius: 3, paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ color: '#fff', fontSize: 3 }}>{'Hi'}</Text>
      </Box>
      <Box style={{ alignSelf: 'start', backgroundColor: '#1e293b', borderRadius: 3, paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ color: '#e2e8f0', fontSize: 3 }}>{'Hello!'}</Text>
      </Box>
      <Box style={{ height: 6, backgroundColor: c.surface, borderRadius: 2, borderWidth: 1, borderColor: c.border }} />
    </Box>
  );
}

export function ThumbSpreadsheet({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ borderWidth: 1, borderColor: c.border, borderRadius: 2, overflow: 'hidden' }}>
        {[0, 1, 2].map(r => (
          <Box key={r} style={{ flexDirection: 'row' }}>
            {[0, 1, 2].map(col => (
              <Box key={col} style={{ width: 14, height: 8, borderRightWidth: col < 2 ? 1 : 0, borderBottomWidth: r < 2 ? 1 : 0, borderColor: c.border, backgroundColor: r === 0 ? c.surface : 'transparent' }} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ThumbCommandPalette({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 48, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, padding: 3, gap: 2 }}>
        <Box style={{ height: 5, backgroundColor: c.bg, borderRadius: 2, borderWidth: 1, borderColor: c.border }} />
        <Box style={{ height: 3, backgroundColor: C.accentDim, borderRadius: 1 }} />
        <Box style={{ height: 3, backgroundColor: 'transparent', borderRadius: 1 }} />
      </Box>
    </Box>
  );
}

export function ThumbStatCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 4 }}>{'Revenue'}</Text>
      <Text style={{ color: c.text, fontSize: 8, fontWeight: 'bold' }}>{'$12k'}</Text>
      <Text style={{ color: '#22c55e', fontSize: 4 }}>{'↑ 12%'}</Text>
    </Box>
  );
}

export function ThumbNowPlaying({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Box style={{ width: 20, height: 20, backgroundColor: c.surface, borderRadius: 3 }} />
      <Box style={{ width: 30, height: 2, backgroundColor: c.muted, borderRadius: 1 }} />
      <Box style={{ width: 36, height: 3, backgroundColor: '#22c55e', borderRadius: 1, overflow: 'hidden' }}>
        <Box style={{ width: '40%', height: 3, backgroundColor: '#22c55e' }} />
      </Box>
    </Box>
  );
}

export function ThumbRepoCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.text, fontSize: 5, fontWeight: 'bold' }}>{'repo'}</Text>
      <Box style={{ flexDirection: 'row', gap: 3 }}>
        <Text style={{ color: '#f59e0b', fontSize: 4 }}>{'★ 2.1k'}</Text>
        <Text style={{ color: c.muted, fontSize: 4 }}>{'TS'}</Text>
      </Box>
    </Box>
  );
}

export function ThumbImageGallery({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 34, gap: 2 }}>
        {[c.surface, c.border, c.muted, c.surface].map((col, i) => (
          <Box key={i} style={{ width: 15, height: 12, backgroundColor: col, borderRadius: 2 }} />
        ))}
      </Box>
    </Box>
  );
}

export function ThumbContextMenu({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ width: 36, backgroundColor: c.surface, borderRadius: 3, borderWidth: 1, borderColor: c.border, padding: 2, gap: 1 }}>
        <Box style={{ height: 4, backgroundColor: C.accentDim, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: c.text, fontSize: 3 }}>{'Copy'}</Text>
        </Box>
        <Box style={{ height: 4, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: c.muted, fontSize: 3 }}>{'Paste'}</Text>
        </Box>
        <Box style={{ height: 1, backgroundColor: c.border }} />
        <Box style={{ height: 4, borderRadius: 1, paddingLeft: 2 }}>
          <Text style={{ color: '#ef4444', fontSize: 3 }}>{'Delete'}</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function ThumbMath({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: c.text, fontSize: 9 }}>{'E=mc²'}</Text>
    </Box>
  );
}

export function ThumbMessageList({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', padding: 4, gap: 2 }}>
      <Box style={{ alignSelf: 'start', width: 28, height: 5, backgroundColor: '#1e293b', borderRadius: 2 }} />
      <Box style={{ alignSelf: 'end', width: 22, height: 5, backgroundColor: '#2563eb', borderRadius: 2 }} />
      <Box style={{ alignSelf: 'start', width: 32, height: 5, backgroundColor: '#1e293b', borderRadius: 2 }} />
    </Box>
  );
}

export function ThumbActionBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 2 }}>
        {['Copy', 'Edit', 'Del'].map(l => (
          <Box key={l} style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1, backgroundColor: c.surface, borderRadius: 2, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.muted, fontSize: 3 }}>{l}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function ThumbFlatList({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4].map(i => (
        <Box key={i} style={{ width: 40, height: 5, backgroundColor: c.surface, borderRadius: 1, opacity: i > 2 ? 0.4 : 1 }} />
      ))}
    </Box>
  );
}

// ── Thumbnail registry ──────────────────────────────────

export const THUMBS: Record<string, (c: ThemeColors) => React.ReactNode> = {
  card: (c) => <ThumbCard c={c} />,
  badge: (c) => <ThumbBadge c={c} />,
  tabs: (c) => <ThumbTabs c={c} />,
  navpanel: (c) => <ThumbNavPanel c={c} />,
  toolbar: (c) => <ThumbToolbar c={c} />,
  breadcrumbs: (c) => <ThumbBreadcrumbs c={c} />,
  table: (c) => <ThumbTable c={c} />,
  progressbar: (c) => <ThumbProgressBar c={c} />,
  sparkline: (c) => <ThumbSparkline c={c} />,
  messagebubble: (c) => <ThumbMessageBubble c={c} />,
  chatinput: (c) => <ThumbChatInput c={c} />,
  searchbar: (c) => <ThumbSearchBar c={c} />,
  codeblock: (c) => <ThumbCodeBlock c={c} />,
  loadingdots: (c) => <ThumbLoadingDots c={c} />,
  elementcard: (c) => <ThumbElementCard c={c} />,
  knob: (c) => <ThumbKnob c={c} />,
  fader: (c) => <ThumbFader c={c} />,
  meter: (c) => <ThumbMeter c={c} />,
  tickersymbol: (c) => <ThumbTickerSymbol c={c} />,
  clock: (c) => <ThumbClock c={c} />,
  stopwatch: (c) => <ThumbStopwatch c={c} />,
  slider: (c) => <ThumbSlider c={c} />,
  switch: (c) => <ThumbSwitch c={c} />,
  checkbox: (c) => <ThumbCheckbox c={c} />,
  radio: (c) => <ThumbRadio c={c} />,
  select: (c) => <ThumbSelect c={c} />,
  barchart: (c) => <ThumbBarChart c={c} />,
  linechart: (c) => <ThumbLineChart c={c} />,
  piechart: (c) => <ThumbPieChart c={c} />,
  radarchart: (c) => <ThumbRadarChart c={c} />,
  candlestick: (c) => <ThumbCandlestick c={c} />,
  orderbook: (c) => <ThumbOrderBook c={c} />,
  led: (c) => <ThumbLED c={c} />,
  padbutton: (c) => <ThumbPadButton c={c} />,
  stepsequencer: (c) => <ThumbStepSequencer c={c} />,
  transport: (c) => <ThumbTransport c={c} />,
  piano: (c) => <ThumbPiano c={c} />,
  xypad: (c) => <ThumbXYPad c={c} />,
  pitchwheel: (c) => <ThumbPitchWheel c={c} />,
  periodictable: (c) => <ThumbPeriodicTable c={c} />,
  moleculecard: (c) => <ThumbMoleculeCard c={c} />,
  electronshell: (c) => <ThumbElectronShell c={c} />,
  reactionview: (c) => <ThumbReactionView c={c} />,
  tickertape: (c) => <ThumbTickerTape c={c} />,
  portfoliocard: (c) => <ThumbPortfolioCard c={c} />,
  rsigauge: (c) => <ThumbRSIGauge c={c} />,
  macdpanel: (c) => <ThumbMACDPanel c={c} />,
  countdown: (c) => <ThumbCountdown c={c} />,
  minimalchat: (c) => <ThumbMinimalChat c={c} />,
  spreadsheet: (c) => <ThumbSpreadsheet c={c} />,
  commandpalette: (c) => <ThumbCommandPalette c={c} />,
  statcard: (c) => <ThumbStatCard c={c} />,
  nowplayingcard: (c) => <ThumbNowPlaying c={c} />,
  repocard: (c) => <ThumbRepoCard c={c} />,
  imagegallery: (c) => <ThumbImageGallery c={c} />,
  contextmenu: (c) => <ThumbContextMenu c={c} />,
  math: (c) => <ThumbMath c={c} />,
  messagelist: (c) => <ThumbMessageList c={c} />,
  actionbar: (c) => <ThumbActionBar c={c} />,
  flatlist: (c) => <ThumbFlatList c={c} />,
};

// ══════════════════════════════════════════════════════════
// PREVIEWS — full-size live demos for the main area
// ══════════════════════════════════════════════════════════

export function PreviewCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Card title="System Status" subtitle="All services operational">
        <Box style={{ padding: 12, gap: 8 }}>
          {[
            { name: 'API Server', badge: 'Online', variant: 'success' as const },
            { name: 'Database', badge: 'Online', variant: 'success' as const },
            { name: 'CDN', badge: 'Degraded', variant: 'warning' as const },
          ].map(row => (
            <Box key={row.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 12 }}>{row.name}</Text>
              <Badge label={row.badge} variant={row.variant} />
            </Box>
          ))}
        </Box>
      </Card>
    </Box>
  );
}

export function PreviewBadge({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        <Badge label="Default" variant="default" />
        <Badge label="Success" variant="success" />
        <Badge label="Warning" variant="warning" />
        <Badge label="Error" variant="error" />
        <Badge label="Info" variant="info" />
      </Box>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        <Badge label="v2.1.0" variant="info" />
        <Badge label="Stable" variant="success" />
        <Badge label="Beta" variant="warning" />
        <Badge label="Deprecated" variant="error" />
      </Box>
    </Box>
  );
}

export function PreviewTabs({ c }: { c: ThemeColors }) {
  const [underlineTab, setUnderlineTab] = useState('overview');
  const [pillTab, setPillTab] = useState('all');
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ width: 320, gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Underline variant'}</Text>
          <Tabs
            tabs={[{ id: 'overview', label: 'Overview' }, { id: 'api', label: 'API' }, { id: 'examples', label: 'Examples' }]}
            activeId={underlineTab}
            onSelect={setUnderlineTab}
          />
        </Box>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Pill variant'}</Text>
          <Tabs
            tabs={[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'archived', label: 'Archived' }]}
            activeId={pillTab}
            onSelect={setPillTab}
            variant="pill"
          />
        </Box>
      </Box>
    </Box>
  );
}

export function PreviewNavPanel({ c }: { c: ThemeColors }) {
  const [activeNav, setActiveNav] = useState('home');
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <NavPanel
        sections={[
          { title: 'Navigation', items: [{ id: 'home', label: 'Home' }, { id: 'explore', label: 'Explore' }, { id: 'search', label: 'Search' }] },
          { title: 'Settings', items: [{ id: 'profile', label: 'Profile' }, { id: 'prefs', label: 'Preferences' }] },
        ]}
        activeId={activeNav}
        onSelect={setActiveNav}
        width={180}
      />
    </Box>
  );
}

export function PreviewToolbar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </Box>
  );
}

export function PreviewBreadcrumbs({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
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
    </Box>
  );
}

export function PreviewTable({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Box style={{ width: 340 }}>
        <Table columns={SAMPLE_TABLE_COLS} data={SAMPLE_TABLE_DATA} striped />
      </Box>
    </Box>
  );
}

export function PreviewProgressBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ width: 300, gap: 14 }}>
        {[
          { label: 'Build progress', value: 0.85, color: C.accent },
          { label: 'Upload', value: 0.45, color: '#3b82f6' },
          { label: 'Tests passing', value: 0.92, color: '#10b981' },
          { label: 'Errors', value: 0.12, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <Box key={label} style={{ gap: 4 }}>
            <Text style={{ color: c.muted, fontSize: 10 }}>{label}</Text>
            <ProgressBar value={value} color={color} height={8} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PreviewSparkline({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ gap: 16, width: 300 }}>
        {[
          { label: 'Revenue', data: [4, 7, 2, 8, 5, 9, 3, 6, 8, 10, 7, 11], color: '#10b981' },
          { label: 'Users', data: [10, 12, 8, 15, 11, 18, 14, 20, 17, 22, 19, 25], color: '#3b82f6' },
          { label: 'Errors', data: [5, 3, 7, 2, 4, 1, 6, 3, 2, 1, 4, 2], color: '#ef4444' },
        ].map(({ label, data, color }) => (
          <Box key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 13 }}>{label}</Text>
            <Sparkline data={data} width={120} height={28} color={color} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PreviewMessageBubble({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 8, width: 360, alignSelf: 'center' }}>
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
    </Box>
  );
}

export function PreviewChatInput({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ width: 360, gap: 12 }}>
        <ChatInput placeholder="Type a message..." sendColor="#3b82f6" />
        <ChatInput placeholder="Disabled while loading..." disabled sendColor="#3b82f6" />
      </Box>
    </Box>
  );
}

export function PreviewSearchBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ width: 320, gap: 12 }}>
        <SearchBar placeholder="Search components..." />
        <SearchBar placeholder="Search with custom debounce..." debounce={500} />
      </Box>
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 }}>
      <Box style={{ gap: 16, alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: c.text, fontSize: 14 }}>{'Loading'}</Text>
          <LoadingDots color={C.accent} />
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{'Thinking'}</Text>
          <LoadingDots color="#3b82f6" />
        </Box>
      </Box>
    </Box>
  );
}

export function PreviewElementCard({ c }: { c: ThemeColors }) {
  // One representative element from each category group
  const representatives = [
    'H',   // nonmetal
    'Li',  // alkali metal
    'Be',  // alkaline earth
    'Fe',  // transition metal
    'Al',  // post-transition metal
    'Si',  // metalloid
    'Cl',  // halogen
    'Ne',  // noble gas
    'Nd',  // lanthanide
    'U',   // actinide
  ];
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 16 }}>
      {/* Compact tile grid — one per category */}
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {representatives.map(sym => (
          <ElementTile
            key={sym}
            element={sym}
            size={64}
            selected={selected === sym}
            onPress={() => setSelected(prev => prev === sym ? null : sym)}
          />
        ))}
      </Box>
      {/* Detail card flips open below when a tile is selected */}
      {selected && (
        <ElementCard element={selected} style={{ width: 280 }} />
      )}
    </Box>
  );
}

export function PreviewKnob({ c }: { c: ThemeColors }) {
  const [gain, setGain] = useState(0.7);
  const [pan, setPan] = useState(0.5);
  const [reverb, setReverb] = useState(0.3);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 40, alignItems: 'center' }}>
        <Knob value={gain} onChange={setGain} label="Gain" color="#f59e0b" size={80} />
        <Knob value={pan} onChange={setPan} label="Pan" color="#3b82f6" size={80} />
        <Knob value={reverb} onChange={setReverb} label="Reverb" color="#10b981" size={80} />
      </Box>
    </Box>
  );
}

export function PreviewFader({ c }: { c: ThemeColors }) {
  const [ch1, setCh1] = useState(0.7);
  const [ch2, setCh2] = useState(0.5);
  const [ch3, setCh3] = useState(0.85);
  const [master, setMaster] = useState(0.6);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 28, alignItems: 'end' }}>
        <Fader value={ch1} onChange={setCh1} label="Ch 1" color="#f59e0b" height={140} />
        <Fader value={ch2} onChange={setCh2} label="Ch 2" color="#3b82f6" height={140} />
        <Fader value={ch3} onChange={setCh3} label="Ch 3" color="#10b981" height={140} />
        <Fader value={master} onChange={setMaster} label="Master" color="#ef4444" height={140} />
      </Box>
    </Box>
  );
}

export function PreviewMeter({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 24, alignItems: 'end' }}>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <Meter value={0.72} peak={0.85} orientation="vertical" height={140} />
          <Text style={{ color: c.muted, fontSize: 10 }}>{'L'}</Text>
        </Box>
        <Box style={{ alignItems: 'center', gap: 6 }}>
          <Meter value={0.58} peak={0.7} orientation="vertical" height={140} />
          <Text style={{ color: c.muted, fontSize: 10 }}>{'R'}</Text>
        </Box>
      </Box>
      <Box style={{ width: 300, gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Horizontal'}</Text>
        <Meter value={0.65} orientation="horizontal" width={280} />
      </Box>
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ width: 340, gap: 8 }}>
        {tickers.map(t => (
          <TickerSymbol key={t.symbol} item={t} />
        ))}
      </Box>
    </Box>
  );
}

export function PreviewClock({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Time only'}</Text>
        <Clock format="time" />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Date + time'}</Text>
        <Clock format="datetime" />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Date only'}</Text>
        <Clock format="date" />
      </Box>
    </Box>
  );
}

export function PreviewStopwatch({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'With controls + milliseconds'}</Text>
        <Stopwatch showMs controls />
      </Box>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'Auto-start, no controls'}</Text>
        <Stopwatch autoStart controls={false} showMs />
      </Box>
    </Box>
  );
}

// ── New previews ────────────────────────────────────────

export function PreviewSlider({ c }: { c: ThemeColors }) {
  const [v1, setV1] = useState(0.5);
  const [v2, setV2] = useState(0.3);
  const [v3, setV3] = useState(0.8);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ width: 300, gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Volume'}</Text>
          <Slider value={v1} onChange={setV1} color="#3b82f6" />
        </Box>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Brightness'}</Text>
          <Slider value={v2} onChange={setV2} color="#f59e0b" />
        </Box>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Saturation'}</Text>
          <Slider value={v3} onChange={setV3} color="#10b981" />
        </Box>
      </Box>
    </Box>
  );
}

export function PreviewSwitch({ c }: { c: ThemeColors }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [d, setD] = useState(true);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ width: 240, gap: 12 }}>
        {[
          { label: 'Notifications', val: a, set: setA },
          { label: 'Dark mode', val: b, set: setB },
          { label: 'Auto-save', val: d, set: setD },
        ].map(s => (
          <Box key={s.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 13 }}>{s.label}</Text>
            <Switch value={s.val} onChange={s.set} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function PreviewCheckbox({ c }: { c: ThemeColors }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [d, setD] = useState(true);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ gap: 10 }}>
        <Checkbox checked={a} onChange={setA} label="Accept terms of service" />
        <Checkbox checked={b} onChange={setB} label="Subscribe to newsletter" />
        <Checkbox checked={d} onChange={setD} label="Remember me" />
        <Checkbox checked={false} onChange={() => {}} label="Disabled option" disabled />
      </Box>
    </Box>
  );
}

export function PreviewRadio({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState('medium');
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
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
    </Box>
  );
}

export function PreviewSelect({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState('tsx');
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
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
    </Box>
  );
}

export function PreviewBarChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </Box>
  );
}

export function PreviewLineChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <LineChart
        data={[10, 25, 18, 32, 28, 45, 38, 52, 48, 60, 55, 70]}
        width={360}
        height={220}
        color="#10b981"
        showDots
      />
    </Box>
  );
}

export function PreviewPieChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <PieChart
        data={[
          { label: 'React', value: 40, color: '#3b82f6' },
          { label: 'Lua', value: 30, color: '#f59e0b' },
          { label: 'OpenGL', value: 20, color: '#10b981' },
          { label: 'Other', value: 10, color: '#8b5cf6' },
        ]}
        size={220}
      />
    </Box>
  );
}

export function PreviewRadarChart({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <RadarChart
        axes={['Strength', 'Dexterity', 'Intelligence', 'Wisdom', 'Charisma', 'Constitution']}
        data={[0.8, 0.6, 0.9, 0.7, 0.5, 0.75]}
        size={240}
        color="#8b5cf6"
      />
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <CandlestickChart data={candles} width={380} height={240} />
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <OrderBook bids={bids} asks={asks} width={320} />
    </Box>
  );
}

export function PreviewLED({ c }: { c: ThemeColors }) {
  const [on1, setOn1] = useState(true);
  const [on2, setOn2] = useState(false);
  const [on3, setOn3] = useState(true);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 24 }}>
        {[
          { on: on1, set: setOn1, color: '#22c55e', label: 'Power' },
          { on: on2, set: setOn2, color: '#ef4444', label: 'Error' },
          { on: on3, set: setOn3, color: '#3b82f6', label: 'Status' },
        ].map(led => (
          <Pressable key={led.label} onPress={() => led.set(!led.on)}>
            <Box style={{ alignItems: 'center', gap: 8 }}>
              <LEDIndicator on={led.on} color={led.color} />
              <Text style={{ color: c.muted, fontSize: 10 }}>{led.label}</Text>
            </Box>
          </Pressable>
        ))}
      </Box>
      <Text style={{ color: c.muted, fontSize: 9 }}>{'Click to toggle'}</Text>
    </Box>
  );
}

export function PreviewPadButton({ c }: { c: ThemeColors }) {
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', width: 280, gap: 8, justifyContent: 'center' }}>
        {colors.map((col, i) => (
          <PadButton key={i} color={col} size={60} label={`${i + 1}`} />
        ))}
      </Box>
    </Box>
  );
}

export function PreviewStepSequencer({ c }: { c: ThemeColors }) {
  const [pattern, setPattern] = useState(() => {
    const p: boolean[][] = [];
    for (let t = 0; t < 4; t++) {
      p.push(Array.from({ length: 16 }, (_, i) => (t === 0 && i % 4 === 0) || (t === 1 && i % 8 === 4)));
    }
    return p;
  });
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <StepSequencer steps={16} tracks={4} pattern={pattern} onChange={setPattern} />
    </Box>
  );
}

export function PreviewTransport({ c }: { c: ThemeColors }) {
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <TransportBar
        playing={playing}
        recording={recording}
        bpm={120}
        position="001:01:000"
        onPlay={() => setPlaying(!playing)}
        onStop={() => { setPlaying(false); setRecording(false); }}
        onRecord={() => setRecording(!recording)}
      />
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <PianoKeyboard
        whites={GALLERY_PIANO_WHITES}
        blacks={GALLERY_PIANO_BLACKS}
        blackAfter={GALLERY_PIANO_BLACK_AFTER}
        whiteKeyWidth={28}
        whiteKeyHeight={80}
      />
    </Box>
  );
}

export function PreviewXYPad({ c }: { c: ThemeColors }) {
  const [x, setX] = useState(0.5);
  const [y, setY] = useState(0.5);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <XYPad x={x} y={y} onChange={({ x: nx, y: ny }: { x: number; y: number }) => { setX(nx); setY(ny); }} size={200} color="#8b5cf6" />
      <Text style={{ color: c.muted, fontSize: 10 }}>{`X: ${x.toFixed(2)}  Y: ${y.toFixed(2)}`}</Text>
    </Box>
  );
}

export function PreviewPitchWheel({ c }: { c: ThemeColors }) {
  const [val, setVal] = useState(0);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 32, alignItems: 'center' }}>
        <Box style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Spring return'}</Text>
          <PitchWheel value={val} onChange={setVal} springReturn height={140} />
        </Box>
        <Box style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Free'}</Text>
          <PitchWheel value={0.3} onChange={() => {}} height={140} />
        </Box>
      </Box>
    </Box>
  );
}

export function PreviewPeriodicTable({ c }: { c: ThemeColors }) {
  const [selected, setSelected] = useState<number | undefined>(26);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
      <PeriodicTable onSelect={(el: any) => setSelected(el.number)} selected={selected} compact />
    </Box>
  );
}

export function PreviewMoleculeCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        <MoleculeCard formula="H2O" style={{ width: 220 }} />
        <MoleculeCard formula="C6H12O6" style={{ width: 220 }} />
        <MoleculeCard formula="NaCl" style={{ width: 220 }} />
      </Box>
    </Box>
  );
}

export function PreviewElectronShell({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
        <ElectronShell element="C" />
        <ElectronShell element="Fe" />
        <ElectronShell element="Ne" />
      </Box>
    </Box>
  );
}

export function PreviewReactionView({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 20 }}>
      <Box style={{ width: 400, gap: 12 }}>
        <ReactionView equation="Fe + O2 -> Fe2O3" />
        <ReactionView equation="H2 + O2 -> H2O" />
        <ReactionView equation="NaOH + HCl -> NaCl + H2O" />
      </Box>
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
      <TickerTape items={items} speed={40} />
    </Box>
  );
}

export function PreviewPortfolioCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
    </Box>
  );
}

export function PreviewRSIGauge({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <Box style={{ gap: 16 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Overbought (RSI 78)'}</Text>
          <RSIGauge value={78} width={300} />
        </Box>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Neutral (RSI 52)'}</Text>
          <RSIGauge value={52} width={300} />
        </Box>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'Oversold (RSI 22)'}</Text>
          <RSIGauge value={22} width={300} />
        </Box>
      </Box>
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <MACDPanel data={data} width={380} height={180} />
    </Box>
  );
}

export function PreviewCountdown({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 }}>
      <Box style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{'60 second countdown'}</Text>
        <Countdown duration={60000} controls showMs />
      </Box>
    </Box>
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Pressable onPress={() => setOpen(true)}>
        <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{'Open Command Palette'}</Text>
        </Box>
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
    </Box>
  );
}

export function PreviewStatCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        <StatCard label="Revenue" value="$12.4k" sublabel="vs $10.2k last month" trend="up" />
        <StatCard label="Users" value="1,284" sublabel="vs 1,150 last month" trend="up" />
        <StatCard label="Errors" value="23" sublabel="vs 12 last month" trend="down" />
        <StatCard label="Uptime" value="99.9%" sublabel="30 day average" trend="flat" />
      </Box>
    </Box>
  );
}

export function PreviewNowPlaying({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <NowPlayingCard track={{
        title: 'Midnight City',
        artist: 'M83',
        album: 'Hurry Up, We\'re Dreaming',
        artUrl: '',
        progress: 0.4,
        duration: 243000,
      }} />
    </Box>
  );
}

export function PreviewRepoCard({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 }}>
      <Box style={{ width: 340, gap: 12 }}>
        <RepoCard repo={{ name: 'reactjit', fullName: 'user/reactjit', description: 'React rendering framework on Love2D', language: 'TypeScript', stars: 2100, forks: 180 }} />
        <RepoCard repo={{ name: 'love2d', fullName: 'love2d/love', description: 'LÖVE - Free 2D Game Engine', language: 'C++', stars: 4500, forks: 420 }} />
      </Box>
    </Box>
  );
}

export function PreviewImageGallery({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ color: c.muted, fontSize: 12 }}>{'ImageGallery requires image URLs — pass images={[...]} to populate'}</Text>
    </Box>
  );
}

export function PreviewContextMenu({ c }: { c: ThemeColors }) {
  const [vis, setVis] = useState(true);
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Pressable onPress={() => setVis(true)}>
        <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{'Right-click area (click to show)'}</Text>
        </Box>
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
    </Box>
  );
}

export function PreviewMath({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <MathTex tex="E = mc^2" fontSize={24} />
      <MathTex tex="\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}" fontSize={18} />
      <MathTex tex="\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}" fontSize={18} />
    </Box>
  );
}

export function PreviewMessageList({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, padding: 20, gap: 8 }}>
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
    </Box>
  );
}

export function PreviewActionBar({ c }: { c: ThemeColors }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 20, padding: 20 }}>
      <ActionBar actions={[
        { id: 'copy', label: 'Copy' },
        { id: 'edit', label: 'Edit' },
        { id: 'share', label: 'Share' },
        { id: 'delete', label: 'Delete' },
      ]} onAction={() => {}} />
    </Box>
  );
}

export function PreviewFlatList({ c }: { c: ThemeColors }) {
  const data = Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, label: `Item ${i + 1}`, desc: `Description for item ${i + 1}` }));
  return (
    <Box style={{ flexGrow: 1, padding: 12 }}>
      <FlatList
        data={data}
        renderItem={({ item }: { item: { id: string; label: string; desc: string } }) => (
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 12 }}>{item.label}</Text>
            <Text style={{ color: c.muted, fontSize: 10 }}>{item.desc}</Text>
          </Box>
        )}
        itemHeight={36}
      />
    </Box>
  );
}

// ── Preview registry ────────────────────────────────────

export const PREVIEWS: Record<string, (c: ThemeColors) => React.ReactNode> = {
  card: (c) => <PreviewCard c={c} />,
  badge: (c) => <PreviewBadge c={c} />,
  tabs: (c) => <PreviewTabs c={c} />,
  navpanel: (c) => <PreviewNavPanel c={c} />,
  toolbar: (c) => <PreviewToolbar c={c} />,
  breadcrumbs: (c) => <PreviewBreadcrumbs c={c} />,
  table: (c) => <PreviewTable c={c} />,
  progressbar: (c) => <PreviewProgressBar c={c} />,
  sparkline: (c) => <PreviewSparkline c={c} />,
  messagebubble: (c) => <PreviewMessageBubble c={c} />,
  chatinput: (c) => <PreviewChatInput c={c} />,
  searchbar: (c) => <PreviewSearchBar c={c} />,
  codeblock: (c) => <PreviewCodeBlock c={c} />,
  loadingdots: (c) => <PreviewLoadingDots c={c} />,
  elementcard: (c) => <PreviewElementCard c={c} />,
  knob: (c) => <PreviewKnob c={c} />,
  fader: (c) => <PreviewFader c={c} />,
  meter: (c) => <PreviewMeter c={c} />,
  tickersymbol: (c) => <PreviewTickerSymbol c={c} />,
  clock: (c) => <PreviewClock c={c} />,
  stopwatch: (c) => <PreviewStopwatch c={c} />,
  slider: (c) => <PreviewSlider c={c} />,
  switch: (c) => <PreviewSwitch c={c} />,
  checkbox: (c) => <PreviewCheckbox c={c} />,
  radio: (c) => <PreviewRadio c={c} />,
  select: (c) => <PreviewSelect c={c} />,
  barchart: (c) => <PreviewBarChart c={c} />,
  linechart: (c) => <PreviewLineChart c={c} />,
  piechart: (c) => <PreviewPieChart c={c} />,
  radarchart: (c) => <PreviewRadarChart c={c} />,
  candlestick: (c) => <PreviewCandlestick c={c} />,
  orderbook: (c) => <PreviewOrderBook c={c} />,
  led: (c) => <PreviewLED c={c} />,
  padbutton: (c) => <PreviewPadButton c={c} />,
  stepsequencer: (c) => <PreviewStepSequencer c={c} />,
  transport: (c) => <PreviewTransport c={c} />,
  piano: (c) => <PreviewPiano c={c} />,
  xypad: (c) => <PreviewXYPad c={c} />,
  pitchwheel: (c) => <PreviewPitchWheel c={c} />,
  periodictable: (c) => <PreviewPeriodicTable c={c} />,
  moleculecard: (c) => <PreviewMoleculeCard c={c} />,
  electronshell: (c) => <PreviewElectronShell c={c} />,
  reactionview: (c) => <PreviewReactionView c={c} />,
  tickertape: (c) => <PreviewTickerTape c={c} />,
  portfoliocard: (c) => <PreviewPortfolioCard c={c} />,
  rsigauge: (c) => <PreviewRSIGauge c={c} />,
  macdpanel: (c) => <PreviewMACDPanel c={c} />,
  countdown: (c) => <PreviewCountdown c={c} />,
  minimalchat: (c) => <PreviewMinimalChat c={c} />,
  spreadsheet: (c) => <PreviewSpreadsheet c={c} />,
  commandpalette: (c) => <PreviewCommandPalette c={c} />,
  statcard: (c) => <PreviewStatCard c={c} />,
  nowplayingcard: (c) => <PreviewNowPlaying c={c} />,
  repocard: (c) => <PreviewRepoCard c={c} />,
  imagegallery: (c) => <PreviewImageGallery c={c} />,
  contextmenu: (c) => <PreviewContextMenu c={c} />,
  math: (c) => <PreviewMath c={c} />,
  messagelist: (c) => <PreviewMessageList c={c} />,
  actionbar: (c) => <PreviewActionBar c={c} />,
  flatlist: (c) => <PreviewFlatList c={c} />,
};
