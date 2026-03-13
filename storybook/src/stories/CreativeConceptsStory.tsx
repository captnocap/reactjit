/**
 * CreativeConcepts — Tabbed multi-component showcase (Layout3).
 *
 * Structure:
 *   Header   — package title + badge + description
 *   Preview  — LIVE DEMO of the active tab's component (flexGrow: 1)
 *   Info row — horizontal strip: description | code example | props
 *   Tab bar  — clickable tabs (one per component)
 *   Footer   — breadcrumbs with "N of M" counter
 *
 * The TABS array drives the info row, tab bar, and footer.
 * The renderPreview function drives the preview area — one case per tab.
 * Clicking a tab swaps everything: preview, description, usage, and props.
 *
 * Tabs: Response Card, Model Selector, Dashboard Stats, Widget Grid
 * Each tab is a detailed, visually rich mock of an AI chat application widget.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView, CodeBlock, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#EA580C',
  accentDim: 'rgba(234, 88, 12, 0.12)',
  selected: 'rgba(234, 88, 12, 0.2)',
  green: '#10B981',
  blue: '#3B82F6',
  amber: '#F59E0B',
  purple: '#8B5CF6',
  pink: '#EC4899',
  teal: '#06B6D4',
  red: '#EF4444',
  cardBg: '#0d0d0d',
  cardBorder: 'rgba(255,255,255,0.08)',
  elevatedBg: '#1a1a1a',
  mutedText: 'rgba(255,255,255,0.4)',
  dimText: 'rgba(255,255,255,0.6)',
};

// ── Tabs ─────────────────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][];
  callbacks: [string, string, string][];
}

const TABS: TabDef[] = [
  {
    id: 'response-card',
    label: 'Response Card',
    icon: 'message-square',
    desc: 'A full AI model response card with reasoning section, content, code block, token stats, and streaming progress bar.',
    usage: `<ResponseCard\n  model="claude-3-opus"\n  status="complete"\n  reasoning={true}\n/>`,
    props: [
      ['model', 'string', 'cpu'],
      ['status', '"streaming" | "complete"', 'check'],
      ['reasoning', 'boolean', 'eye'],
    ],
    callbacks: [
      ['onRetry', '() => void', 'refresh-cw'],
      ['onCopy', '() => void', 'clipboard'],
    ],
  },
  {
    id: 'model-selector',
    label: 'Model Selector',
    icon: 'layers',
    desc: 'Model selection dropdown with search, filter chips, capability badges, and provider grouping.',
    usage: `<ModelSelector\n  selected="claude-3-opus"\n  onSelect={setModel}\n/>`,
    props: [
      ['selected', 'string', 'check-circle'],
      ['filter', 'string[]', 'filter'],
      ['search', 'string', 'search'],
    ],
    callbacks: [
      ['onSelect', '(id: string) => void', 'pointer'],
    ],
  },
  {
    id: 'dashboard-stats',
    label: 'Dashboard Stats',
    icon: 'bar-chart-2',
    desc: 'Analytics dashboard with lifetime stats, session counters, recent images, active projects, and research context.',
    usage: `<DashboardStats\n  user="Siah"\n  session={currentSession}\n/>`,
    props: [
      ['user', 'string', 'user'],
      ['session', 'SessionData', 'activity'],
    ],
    callbacks: [],
  },
  {
    id: 'widget-grid',
    label: 'Widget Grid',
    icon: 'grid',
    desc: 'Customizable widget grid with swappable panels, shortcut labels, and a widget picker overlay.',
    usage: `<WidgetGrid\n  layout={gridConfig}\n  onSwap={handleSwap}\n/>`,
    props: [
      ['layout', 'GridLayout', 'layout'],
      ['editable', 'boolean', 'edit'],
    ],
    callbacks: [
      ['onSwap', '(slot: string, widget: string) => void', 'refresh-cw'],
    ],
  },
];

// ── Shared small components ──────────────────────────────

/** Small colored dot indicator */
function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Box style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

/** Pill badge with text */
function Pill({ label, bg, fg, borderColor }: { label: string; bg: string; fg: string; borderColor?: string }) {
  return (
    <Box style={{
      backgroundColor: bg,
      borderRadius: 4,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 2,
      paddingBottom: 2,
      borderWidth: borderColor ? 1 : 0,
      borderColor: borderColor || 'transparent',
    }}>
      <Text style={{ color: fg, fontSize: 9, fontWeight: 'bold' }}>{label}</Text>
    </Box>
  );
}

/** Small action button with border */
function ActionButton({ label, borderColor, fg }: { label: string; borderColor: string; fg: string }) {
  return (
    <Box style={{
      borderWidth: 1,
      borderColor,
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 4,
      paddingBottom: 4,
    }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
    </Box>
  );
}

// ── Response Card Preview ────────────────────────────────

function ResponseCardPreview() {
  const c = useThemeColors();

  return (
    <ScrollView style={{ flexGrow: 1, backgroundColor: C.cardBg }}>
      <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 14 }}>

        {/* ── Header section ── */}
        <Box style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* CRT-style model logo */}
          <Box style={{
            width: 48,
            height: 48,
            backgroundColor: '#0a0a0a',
            borderWidth: 1,
            borderColor: 'rgba(251,146,60,0.4)',
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: '#FB923C', fontSize: 24, fontWeight: 'bold' }}>{'A'}</Text>
          </Box>

          {/* Model info column */}
          <Box style={{ flexGrow: 1, gap: 4 }}>
            {/* Name row with green dot */}
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>{'Claude 3 Opus'}</Text>
              <Dot color={C.green} size={8} />
            </Box>

            {/* Subtitle row */}
            <Text style={{ color: C.mutedText, fontSize: 10 }}>
              {'claude-3-opus-20240229  via OpenRouter  2:00 AM'}
            </Text>

            {/* Experience bar — colored segments */}
            <Box style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
              <Box style={{ height: 4, width: 40, backgroundColor: '#4A90D9', borderRadius: 2 }} />
              <Box style={{ height: 4, width: 30, backgroundColor: '#06B6D4', borderRadius: 2 }} />
              <Box style={{ height: 4, width: 50, backgroundColor: '#10B981', borderRadius: 2 }} />
              <Box style={{ height: 4, width: 25, backgroundColor: '#F59E0B', borderRadius: 2 }} />
              <Box style={{ height: 4, width: 20, backgroundColor: '#EA580C', borderRadius: 2 }} />
              <Box style={{ height: 4, width: 15, backgroundColor: '#DC2626', borderRadius: 2 }} />
            </Box>
          </Box>

          {/* COMPLETE badge */}
          <Box style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderRadius: 4,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Text style={{ color: C.green, fontSize: 10, fontWeight: 'bold' }}>{'✓ COMPLETE'}</Text>
          </Box>
        </Box>

        {/* ── Reasoning section ── */}
        <Box style={{
          backgroundColor: 'rgba(251,146,60,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(251,146,60,0.3)',
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 6,
        }}>
          {/* Reasoning header row */}
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#FB923C', fontSize: 10, fontWeight: 'bold' }}>{'REASONING'}</Text>
            <Text style={{ color: '#FB923C', fontSize: 12 }}>{'⟳'}</Text>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: '#FB923C', fontSize: 10, fontWeight: 'bold' }}>{'EXPAND'}</Text>
          </Box>

          {/* Fading preview lines */}
          <Text style={{ color: C.dimText, fontSize: 11, opacity: 1.0 }}>
            {'Let me analyze this request for a Cyberpunk Oni character concept...'}
          </Text>
          <Text style={{ color: C.dimText, fontSize: 11, opacity: 0.6 }}>
            {'Let me analyze a Cyberpunk Olinsonacter concept...'}
          </Text>
          <Text style={{ color: C.dimText, fontSize: 11, opacity: 0.3 }}>
            {'I\'ve created the tech design autetlizations and optical augmentars...'}
          </Text>

          {/* Timer right-aligned */}
          <Box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Text style={{ color: C.mutedText, fontSize: 10 }}>{'3.2s'}</Text>
          </Box>
        </Box>

        {/* ── Content section ── */}
        <Box style={{ gap: 8 }}>
          <Text style={{ color: '#ffffff', fontSize: 13 }}>
            {'I\'ve created a concept for the Cyberpunk Oni character. The design fuses traditional Japanese demon aesthetics with high-tech augmentation:'}
          </Text>
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>
            {'Visual Elements:'}
          </Text>
          <Text style={{ color: C.dimText, fontSize: 13 }}>
            {'- Glowing red optical implants replacing traditional oni eyes, with HUD overlay projections visible through translucent corneal displays'}
          </Text>

          {/* Image placeholder */}
          <Box style={{
            width: '100%',
            height: 180,
            backgroundColor: '#1a1a1a',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(251,146,60,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: C.mutedText, fontSize: 14 }}>{'🎭 Cyberpunk Oni Concept'}</Text>
          </Box>
        </Box>

        {/* ── Code block section ── */}
        <Box style={{ gap: 4 }}>
          {/* Code header row */}
          <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pill label="tsx" bg="rgba(255,255,255,0.06)" fg={C.mutedText} />
            <Text style={{ color: C.mutedText, fontSize: 10, fontWeight: 'bold' }}>{'COPY'}</Text>
          </Box>
          <CodeBlock
            language="tsx"
            fontSize={10}
            code={`const CyberpunkOni = ({ glowColor = '#ff0000' }) => {\n  const [augmented, setAugmented] = useState(true);\n  return (\n    <Box style={{ position: 'relative' }}>\n      <OniMask glow={glowColor} />\n      <HUDOverlay active={augmented} />\n    </Box>\n  );\n};`}
          />
        </Box>

        {/* ── Footer section ── */}
        <Box style={{ gap: 8 }}>
          {/* Tetris payload mini-viz */}
          <Box style={{ gap: 2 }}>
            <Box style={{ flexDirection: 'row', gap: 1 }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <Box key={`t1-${i}`} style={{ width: 4, height: 4, backgroundColor: C.blue, borderRadius: 1 }} />
              ))}
            </Box>
            <Box style={{ flexDirection: 'row', gap: 1 }}>
              {[C.teal, C.teal, C.green, C.green, C.amber, C.teal, C.green, C.amber, C.teal, C.green, C.green, C.teal, C.amber, C.green, C.teal, C.teal].map((col, i) => (
                <Box key={`t2-${i}`} style={{ width: 4, height: 4, backgroundColor: col, borderRadius: 1 }} />
              ))}
            </Box>
          </Box>

          {/* Token stats */}
          <Box style={{ gap: 3 }}>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: C.green, fontSize: 10, fontWeight: 'bold' }}>{'↑38K'}</Text>
              <Text style={{ color: C.mutedText, fontSize: 10 }}>{'/'}</Text>
              <Text style={{ color: C.dimText, fontSize: 10 }}>{'245 tokens'}</Text>
              <Text style={{ color: C.mutedText, fontSize: 10 }}>{'•'}</Text>
              <Text style={{ color: C.dimText, fontSize: 10 }}>{'2134ms'}</Text>
              <Text style={{ color: C.mutedText, fontSize: 10 }}>{'•'}</Text>
              <Text style={{ color: C.dimText, fontSize: 10 }}>{'$0.0042'}</Text>
            </Box>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.mutedText, fontSize: 10 }}>{'↓245K'}</Text>
              <Text style={{ color: C.mutedText, fontSize: 10 }}>{'If streaming, token rate: 114.8 tok/s'}</Text>
            </Box>
          </Box>

          {/* Action buttons row */}
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActionButton label="COPY" borderColor="rgba(255,255,255,0.3)" fg="#ffffff" />
            <ActionButton label="RETRY" borderColor={C.accent} fg={C.accent} />
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: C.mutedText, fontSize: 14 }}>{'✕'}</Text>
          </Box>

          {/* Streaming progress bar */}
          <Box style={{ width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
            <Box style={{ width: '60%', height: 2, backgroundColor: C.accent, borderRadius: 1 }} />
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
}

// ── Model Selector Preview ───────────────────────────────

/** Single model row in the selector list */
function ModelRow({ name, provider, providerColor, contextWindow, selected, capabilities }: {
  name: string;
  provider: string;
  providerColor: string;
  contextWindow: string;
  selected: boolean;
  capabilities: string[];
}) {
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: selected ? 'rgba(234, 88, 12, 0.08)' : 'transparent',
      borderLeftWidth: selected ? 3 : 0,
      borderLeftColor: selected ? C.accent : 'transparent',
    }}>
      {/* Provider icon circle */}
      <Box style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderWidth: 1,
        borderColor: providerColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color: providerColor, fontSize: 12, fontWeight: 'bold' }}>
          {provider.charAt(0).toUpperCase()}
        </Text>
      </Box>

      {/* Model name */}
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Text style={{ color: '#ffffff', fontSize: 12 }}>{name}</Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {capabilities.map((cap) => (
            <Dot key={cap} color={providerColor} size={5} />
          ))}
        </Box>
      </Box>

      {/* Context window badge */}
      <Pill label={contextWindow} bg="rgba(255,255,255,0.06)" fg={C.dimText} />

      {/* Selection indicator */}
      <Box style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: selected ? C.accent : 'rgba(255,255,255,0.2)',
        backgroundColor: selected ? C.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {selected && <Text style={{ color: '#ffffff', fontSize: 10 }}>{'✓'}</Text>}
      </Box>
    </Box>
  );
}

function ModelSelectorPreview() {
  const c = useThemeColors();

  // Filter chip data
  const chips = ['Vision', 'Tools', 'Reasoning', 'Search', 'Code', 'Files'];

  return (
    <Box style={{ flexGrow: 1, backgroundColor: C.cardBg, gap: 0 }}>

      {/* Header */}
      <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 14, paddingBottom: 10, gap: 10 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: 'bold' }}>{'All Models'}</Text>
          <Pill label="524 models" bg="rgba(255,255,255,0.06)" fg={C.mutedText} />
        </Box>

        {/* Search input mock */}
        <Box style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          borderRadius: 6,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
        }}>
          <Text style={{ color: C.mutedText, fontSize: 12 }}>{'Search models...'}</Text>
        </Box>

        {/* Filter chips row */}
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {chips.map((chip) => (
            <Box key={chip} style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
            }}>
              <Dot color={C.dimText} size={5} />
              <Text style={{ color: C.dimText, fontSize: 10 }}>{chip}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Model list */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 0 }}>

          {/* Anthropic group */}
          <Box style={{
            borderLeftWidth: 3,
            borderLeftColor: '#FB923C',
            paddingLeft: 12,
            paddingTop: 6,
            paddingBottom: 4,
            backgroundColor: 'rgba(251,146,60,0.04)',
          }}>
            <Text style={{ color: '#FB923C', fontSize: 9, fontWeight: 'bold' }}>{'ANTHROPIC'}</Text>
          </Box>
          <ModelRow name="claude-3-opus" provider="Anthropic" providerColor="#FB923C" contextWindow="200k" selected={true} capabilities={['vision', 'tools', 'reasoning']} />
          <ModelRow name="claude-3.5-sonnet" provider="Anthropic" providerColor="#FB923C" contextWindow="200k" selected={false} capabilities={['vision', 'tools', 'reasoning', 'code']} />

          {/* OpenAI group */}
          <Box style={{
            borderLeftWidth: 3,
            borderLeftColor: C.teal,
            paddingLeft: 12,
            paddingTop: 6,
            paddingBottom: 4,
            backgroundColor: 'rgba(6,182,212,0.04)',
          }}>
            <Text style={{ color: C.teal, fontSize: 9, fontWeight: 'bold' }}>{'OPENAI'}</Text>
          </Box>
          <ModelRow name="gpt-4-turbo" provider="OpenAI" providerColor={C.teal} contextWindow="128k" selected={false} capabilities={['vision', 'tools', 'code']} />
          <ModelRow name="gpt-4o" provider="OpenAI" providerColor={C.teal} contextWindow="128k" selected={false} capabilities={['vision', 'tools', 'reasoning', 'code', 'search']} />

          {/* Google group */}
          <Box style={{
            borderLeftWidth: 3,
            borderLeftColor: C.blue,
            paddingLeft: 12,
            paddingTop: 6,
            paddingBottom: 4,
            backgroundColor: 'rgba(59,130,246,0.04)',
          }}>
            <Text style={{ color: C.blue, fontSize: 9, fontWeight: 'bold' }}>{'GOOGLE'}</Text>
          </Box>
          <ModelRow name="gemini-exp-1206" provider="Google" providerColor={C.blue} contextWindow="2M" selected={false} capabilities={['vision', 'tools', 'reasoning', 'code', 'search']} />

          {/* DeepSeek group */}
          <Box style={{
            borderLeftWidth: 3,
            borderLeftColor: C.purple,
            paddingLeft: 12,
            paddingTop: 6,
            paddingBottom: 4,
            backgroundColor: 'rgba(139,92,246,0.04)',
          }}>
            <Text style={{ color: C.purple, fontSize: 9, fontWeight: 'bold' }}>{'DEEPSEEK'}</Text>
          </Box>
          <ModelRow name="deepseek-chat" provider="DeepSeek" providerColor={C.purple} contextWindow="64k" selected={false} capabilities={['tools', 'reasoning', 'code']} />
          <ModelRow name="deepseek-reasoner" provider="DeepSeek" providerColor={C.purple} contextWindow="64k" selected={false} capabilities={['reasoning', 'code']} />
        </Box>
      </ScrollView>

      {/* Footer */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
      }}>
        <Text style={{ color: C.dimText, fontSize: 11 }}>{'1 selected'}</Text>
        <Text style={{ color: C.accent, fontSize: 11, fontWeight: 'bold' }}>{'Clear all'}</Text>
      </Box>
    </Box>
  );
}

// ── Dashboard Stats Preview ──────────────────────────────

/** Single stat card for the analytics grid */
function StatCard({ title, value, subtitle, accentColor }: {
  title: string;
  value: string;
  subtitle: string;
  accentColor: string;
}) {
  return (
    <Box style={{
      flexGrow: 1,
      flexBasis: 0,
      backgroundColor: C.cardBg,
      borderRadius: 8,
      borderLeftWidth: 2,
      borderLeftColor: accentColor,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 4,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow circle top-right */}
      <Box style={{
        position: 'absolute',
        top: -8,
        right: -8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: accentColor,
        opacity: 0.08,
      }} />
      <Text style={{ color: C.mutedText, fontSize: 8, fontWeight: 'bold' }}>{title}</Text>
      <Text style={{ color: accentColor, fontSize: 20, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: C.mutedText, fontSize: 9 }}>{subtitle}</Text>
    </Box>
  );
}

function DashboardStatsPreview() {
  const c = useThemeColors();

  return (
    <ScrollView style={{ flexGrow: 1, backgroundColor: C.cardBg }}>
      <Box style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, gap: 16 }}>

        {/* Greeting header */}
        <Box style={{ gap: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: 'bold' }}>{'Good evening, Siah'}</Text>
          <Text style={{ color: C.mutedText, fontSize: 13 }}>{'What would you like to do today?'}</Text>
        </Box>

        {/* Lifetime Analytics section */}
        <Box style={{ gap: 10 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: C.mutedText, fontSize: 9, fontWeight: 'bold' }}>{'LIFETIME ANALYTICS'}</Text>
          </Box>

          {/* Stats grid — 5 cards in a row */}
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <StatCard title="TOTAL TOKENS" value="2.4M" subtitle="1.2M in / 1.2M out" accentColor={C.green} />
            <StatCard title="MESSAGES" value="1,847" subtitle="42 conversations" accentColor={C.blue} />
            <StatCard title="TOTAL COST" value="$12.84" subtitle="~1.3K tok/msg avg" accentColor={C.amber} />
            <StatCard title="GEN TIME" value="4h 12m" subtitle="2m assembly" accentColor={C.purple} />
            <StatCard title="CONTEXT" value="156" subtitle="48 mem / 12 rss" accentColor={C.pink} />
          </Box>
        </Box>

        {/* Session stats row */}
        <Box style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(16, 185, 129, 0.06)',
          borderRadius: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          borderWidth: 1,
          borderColor: 'rgba(16, 185, 129, 0.15)',
          flexWrap: 'wrap',
        }}>
          <Dot color={C.green} size={6} />
          <Text style={{ color: C.dimText, fontSize: 10 }}>{'Session: 47 requests'}</Text>
          <Text style={{ color: C.mutedText, fontSize: 10 }}>{'|'}</Text>
          <Text style={{ color: C.dimText, fontSize: 10 }}>{'Uptime: 2h 14m'}</Text>
          <Text style={{ color: C.mutedText, fontSize: 10 }}>{'|'}</Text>
          <Text style={{ color: C.dimText, fontSize: 10 }}>{'Avg TPS: 42.3'}</Text>
          <Text style={{ color: C.mutedText, fontSize: 10 }}>{'|'}</Text>
          <Text style={{ color: C.dimText, fontSize: 10 }}>{'TTFT: 340ms'}</Text>
        </Box>

        {/* Three-column section */}
        <Box style={{ flexDirection: 'row', gap: 10 }}>

          {/* Left: Recent Images */}
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8 }}>
            <Text style={{ color: C.mutedText, fontSize: 9, fontWeight: 'bold' }}>{'RECENT IMAGES'}</Text>
            <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['Oni Concept', 'Mech Design', 'UI Mockup', 'Landscape'].map((label) => (
                <Box key={label} style={{
                  width: '48%',
                  height: 60,
                  backgroundColor: C.elevatedBg,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: C.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: C.mutedText, fontSize: 8 }}>{label}</Text>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Center: Active Code Projects */}
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8 }}>
            <Text style={{ color: C.mutedText, fontSize: 9, fontWeight: 'bold' }}>{'ACTIVE CODE PROJECTS'}</Text>
            <Box style={{ gap: 6 }}>
              {[
                { name: 'reactjit', tasks: 12 },
                { name: 'oni-generator', tasks: 4 },
                { name: 'llm-studio', tasks: 7 },
              ].map((proj) => (
                <Box key={proj.name} style={{
                  backgroundColor: C.elevatedBg,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: C.cardBorder,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Text style={{ color: C.teal, fontSize: 11 }}>{'>'}</Text>
                  <Text style={{ color: '#ffffff', fontSize: 11 }}>{proj.name}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Text style={{ color: C.mutedText, fontSize: 9 }}>{`${proj.tasks} tasks`}</Text>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right: Research & Context */}
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8 }}>
            <Text style={{ color: C.mutedText, fontSize: 9, fontWeight: 'bold' }}>{'RESEARCH & CONTEXT'}</Text>
            <Box style={{ gap: 6 }}>
              {/* Research topic card */}
              <Box style={{
                backgroundColor: 'rgba(139,92,246,0.08)',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.2)',
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 6,
                paddingBottom: 6,
                gap: 3,
              }}>
                <Text style={{ color: C.purple, fontSize: 9, fontWeight: 'bold' }}>{'ACTIVE RESEARCH'}</Text>
                <Text style={{ color: '#ffffff', fontSize: 11 }}>{'Custom React Reconciler Patterns'}</Text>
                <Text style={{ color: C.mutedText, fontSize: 9 }}>{'12 sources indexed'}</Text>
              </Box>

              {/* Memory entries */}
              {['Layout engine invariants', 'TSLX compiler progress'].map((mem) => (
                <Box key={mem} style={{
                  backgroundColor: C.elevatedBg,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: C.cardBorder,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 5,
                  paddingBottom: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Dot color={C.blue} size={4} />
                  <Text style={{ color: C.dimText, fontSize: 10 }}>{mem}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
}

// ── Widget Grid Preview ──────────────────────────────────

/** Single widget slot in the grid */
function WidgetSlot({ shortcut, name, action, active }: {
  shortcut: string;
  name: string;
  action: string;
  active?: boolean;
}) {
  return (
    <Box style={{
      flexGrow: 1,
      flexBasis: 0,
      backgroundColor: C.elevatedBg,
      borderRadius: 8,
      borderWidth: active ? 2 : 1,
      borderColor: active ? C.accent : C.cardBorder,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 8,
      justifyContent: 'space-between',
    }}>
      <Text style={{ color: C.mutedText, fontSize: 9, fontWeight: 'bold' }}>{shortcut}</Text>
      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>{name}</Text>
      <Text style={{ color: C.mutedText, fontSize: 9 }}>{action}</Text>
    </Box>
  );
}

/** Widget picker item in the overlay */
function PickerItem({ name, desc }: { name: string; desc: string }) {
  return (
    <Box style={{
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: 4,
    }}>
      <Text style={{ color: '#ffffff', fontSize: 11 }}>{name}</Text>
      <Text style={{ color: C.mutedText, fontSize: 9 }}>{desc}</Text>
    </Box>
  );
}

function WidgetGridPreview() {
  const c = useThemeColors();

  return (
    <Box style={{ flexGrow: 1, backgroundColor: C.cardBg, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, position: 'relative' }}>
      <Box style={{ gap: 10, flexGrow: 1 }}>

        {/* Top row: F1, F2, F3 */}
        <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1 }}>
          <WidgetSlot shortcut="F1" name="Memory Blocks" action="select widget" active={true} />
          <WidgetSlot shortcut="F2" name="Tetris Payload" action="click to swap" />
          <WidgetSlot shortcut="F3" name="Feature Toggles" action="click to swap" />
        </Box>

        {/* Bottom row: G1, G2, G3 */}
        <Box style={{ flexDirection: 'row', gap: 10, flexGrow: 1 }}>
          <WidgetSlot shortcut="G1" name="Recent Files" action="click to swap" />
          <WidgetSlot shortcut="G2" name="Quick Responses" action="click to swap" />
          <WidgetSlot shortcut="G3" name="Mini Bash" action="click to swap" />
        </Box>
      </Box>

      {/* Widget picker overlay — positioned as dropdown from F1 */}
      <Box style={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 280,
        backgroundColor: '#111111',
        borderWidth: 1,
        borderColor: 'rgba(234, 88, 12, 0.4)',
        borderRadius: 8,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10,
        gap: 4,
      }}>
        {/* Picker header */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: C.accent, fontSize: 10, fontWeight: 'bold' }}>{'F1 WIDGET'}</Text>
          <Text style={{ color: C.mutedText, fontSize: 12 }}>{'✕'}</Text>
        </Box>

        {/* Widget options */}
        <PickerItem name="Prompt Selector" desc="System prompt management" />
        <PickerItem name="Feature Toggles" desc="Reasoning, web search, image gen toggles" />
        <PickerItem name="Quick Responses" desc="Predefined message buttons" />
        <PickerItem name="Recent Files" desc="Quick re-attach recent files" />
        <PickerItem name="Mini Bash" desc="Tiny terminal with variable insert" />
        <PickerItem name="RSS Headlines" desc="Recent headlines from your feeds" />

        {/* Section header */}
        <Box style={{ marginTop: 4, marginBottom: 2 }}>
          <Text style={{ color: C.mutedText, fontSize: 8, fontWeight: 'bold' }}>{'VISUALIZERS'}</Text>
        </Box>
        <PickerItem name="Tetris Payload" desc="Token block visualizer" />
        <PickerItem name="Memory Blocks" desc="Context memory usage map" />
      </Box>
    </Box>
  );
}

// ── Preview renderer ─────────────────────────────────────

function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  switch (tab.id) {
    case 'response-card':
      return <ResponseCardPreview />;
    case 'model-selector':
      return <ModelSelectorPreview />;
    case 'dashboard-stats':
      return <DashboardStatsPreview />;
    case 'widget-grid':
      return <WidgetGridPreview />;
    default:
      return null;
  }
}

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  return <S.StoryDivider />;
}

function VerticalDivider() {
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── CreativeConceptsStory ─────────────────────────────────────────

export function CreativeConceptsStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="sparkles" tintColor={C.accent} />
        <S.StoryTitle>
          {'CreativeConcepts'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/creativeconcepts'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'AI chat application widget mockups built with ReactJIT primitives'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Preview area — LIVE DEMO of the active tab ── */}
      <S.BorderBottom style={{ flexGrow: 1 }}>
        {renderPreview(tab, c)}
      </S.BorderBottom>

      {/* ── Info row — description | code | props ── */}
      <Box style={{
        height: 120,
        flexShrink: 0,
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        overflow: 'hidden',
      }}>

        {/* ── Description ── */}
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.BoldText style={{ fontSize: 14 }}>
            {tab.label}
          </S.BoldText>
          <S.StoryMuted>
            {tab.desc}
          </S.StoryMuted>
        </S.Half>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>
            {'USAGE'}
          </S.StoryLabelText>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </S.Half>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>
            {'PROPS'}
          </S.StoryLabelText>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <S.RowCenterG5 key={name}>
                <S.StorySectionIcon src={icon} tintColor={c.muted} />
                <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                <S.StoryCap>{type}</S.StoryCap>
              </S.RowCenterG5>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <S.StoryLabelText>
                {'CALLBACKS'}
              </S.StoryLabelText>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
                  <S.RowCenterG5 key={name}>
                    <S.StorySectionIcon src={icon} tintColor={c.muted} />
                    <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                    <S.StoryCap>{sig}</S.StoryCap>
                  </S.RowCenterG5>
                ))}
              </Box>
            </>
          )}
        </S.Half>

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
        <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }}>
          {TABS.map(comp => {
            const active = comp.id === activeId;
            return (
              <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                <Box style={{
                  width: 90,
                  height: 50,
                  backgroundColor: active ? C.selected : c.surface,
                  borderRadius: 6,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? C.accent : c.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Text style={{ color: active ? C.accent : c.muted, fontSize: 9, fontWeight: active ? 'bold' : 'normal' }}>
                    {comp.label}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </S.RowG8>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Demos'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.DimIcon12 src="sparkles" />
        <S.StoryCap>{'CreativeConcepts'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
