/**
 * Hook Gallery — Grid of every hook with detail panel.
 *
 * Structure:
 *   Header        — title + search bar
 *   Category tabs — filter by hook category
 *   Main area     — grid (left, scrollable) + detail panel (right)
 *   Footer        — breadcrumbs + "N of M" counter
 *
 * Grid cards show surface-type thumbnails. Clicking a card
 * selects it and shows signature, description, usage, and
 * return type in the detail panel.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, Input, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { HOOKS, getThumb } from './HookDemos';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

const PKG: Record<string, string> = {
  core: '#8b5cf6',
  theme: '#f59e0b',
  math: '#3b82f6',
  time: '#06b6d4',
  apis: '#6366f1',
  ai: '#ec4899',
  audio: '#f97316',
  chemistry: '#14b8a6',
  router: '#06b6d4',
  geo: '#84cc16',
  physics: '#ef4444',
  imaging: '#a855f7',
  server: '#64748b',
  crypto: '#eab308',
  convert: '#0ea5e9',
  data: '#8b5cf6',
  finance: '#10b981',
};

const CATEGORIES = ['All', 'State', 'UI', 'Animation', 'Time', 'Text', 'Data', 'System', 'Math', 'APIs'];

// ── Helpers ──────────────────────────────────────────────

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── HookGalleryStory ─────────────────────────────────────

export function HookGalleryStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(HOOKS[0].id);
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const hook = HOOKS.find(h => h.id === activeId) || HOOKS[0];
  const pkgColor = PKG[hook.pkg] || C.accent;

  const filtered = (() => {
    let list = HOOKS;
    if (activeCat !== 'All') {
      list = list.filter(h => h.cat === activeCat);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(h =>
        h.id.toLowerCase().includes(q) ||
        h.pkg.toLowerCase().includes(q) ||
        h.desc.toLowerCase().includes(q) ||
        h.cat.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, gap: 14 }}>
        <S.StoryHeaderIcon src="cpu" tintColor={C.accent} />
        <S.StoryTitle>{'Hooks'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'Gallery'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />

        {/* Search */}
        <S.RowCenterG6 style={{ backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, width: 200 }}>
          <S.StorySectionIcon src="search" tintColor={c.muted} />
          <Input
            placeholder="Filter hooks..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flexGrow: 1, color: c.text, fontSize: 9, backgroundColor: 'transparent', padding: 0 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <S.DimIcon8 src="x" />
            </Pressable>
          )}
        </S.RowCenterG6>
      </S.RowCenterBorder>

      {/* ── Category tabs ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 4 }}>
        {CATEGORIES.map(cat => {
          const active = cat === activeCat;
          const count = cat === 'All' ? HOOKS.length : HOOKS.filter(h => h.cat === cat).length;
          return (
            <Pressable key={cat} onPress={() => setActiveCat(cat)}>
              <Box style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
                backgroundColor: active ? C.selected : 'transparent',
                borderRadius: 4, borderWidth: active ? 1 : 0, borderColor: C.accent,
              }}>
                <Text style={{ color: active ? c.text : c.muted, fontSize: 9 }}>{cat}</Text>
                <S.DimMicro>{`${count}`}</S.DimMicro>
              </Box>
            </Pressable>
          );
        })}
      </S.RowCenterBorder>

      {/* ── Main area: grid + detail panel ── */}
      <S.RowGrow>

        {/* Grid */}
        <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
          <S.RowG8 style={{ flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
            {filtered.map(h => {
              const active = h.id === activeId;
              const hPkgColor = PKG[h.pkg] || c.muted;
              return (
                <Pressable key={h.id} onPress={() => setActiveId(h.id)}>
                  <Box style={{
                    width: 88, height: 88,
                    backgroundColor: active ? C.selected : c.surface,
                    borderRadius: 6,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? C.accent : c.border,
                    overflow: 'hidden',
                  }}>
                    <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
                      {getThumb(h.surface, c)}
                    </Box>
                    <Box style={{
                      flexShrink: 0, height: 16,
                      backgroundColor: active ? C.accentDim : 'rgba(0,0,0,0.3)',
                      justifyContent: 'center', alignItems: 'center',
                      flexDirection: 'row', gap: 2,
                    }}>
                      <Box style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: hPkgColor }} />
                      <Text style={{ color: active ? c.text : c.muted, fontSize: 5 }}>{h.id.replace('use', '')}</Text>
                    </Box>
                  </Box>
                </Pressable>
              );
            })}
            {filtered.length === 0 && (
              <Box style={{ padding: 20, alignItems: 'center' }}>
                <S.DimBody11>{`No hooks match "${searchQuery}"`}</S.DimBody11>
              </Box>
            )}
          </S.RowG8>
        </ScrollView>

        <VerticalDivider />

        {/* Detail panel */}
        <ScrollView style={{ width: 280, flexShrink: 0, backgroundColor: c.bgElevated }}>
          <Box style={{ padding: 16, gap: 14 }}>

            {/* Hook name + package */}
            <Box style={{ gap: 6 }}>
              <S.BoldText style={{ fontSize: 16 }}>{hook.id}</S.BoldText>
              <S.RowCenterG6>
                <Box style={{ backgroundColor: `${pkgColor}22`, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                  <Text style={{ color: pkgColor, fontSize: 8 }}>{`@reactjit/${hook.pkg}`}</Text>
                </Box>
                <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                  <Text style={{ color: C.accent, fontSize: 8 }}>{hook.cat}</Text>
                </Box>
              </S.RowCenterG6>
            </Box>

            {/* Description */}
            <Box style={{ gap: 4 }}>
              <S.StoryLabelText>{'DESCRIPTION'}</S.StoryLabelText>
              <S.StoryBody>{hook.desc}</S.StoryBody>
            </Box>

            {/* Signature */}
            <Box style={{ gap: 4 }}>
              <S.StoryLabelText>{'SIGNATURE'}</S.StoryLabelText>
              <S.Bordered style={{ backgroundColor: c.surface, borderRadius: 4, padding: 8 }}>
                <Text style={{ color: C.accent, fontSize: 9 }}>{`${hook.id}${hook.sig}`}</Text>
              </S.Bordered>
            </Box>

            {/* Returns */}
            <Box style={{ gap: 4 }}>
              <S.StoryLabelText>{'RETURNS'}</S.StoryLabelText>
              <S.Bordered style={{ backgroundColor: c.surface, borderRadius: 4, padding: 8 }}>
                <S.StoryBreadcrumbActive>{hook.returns}</S.StoryBreadcrumbActive>
              </S.Bordered>
            </Box>

            {/* Usage */}
            <Box style={{ gap: 4 }}>
              <S.StoryLabelText>{'USAGE'}</S.StoryLabelText>
              <CodeBlock language="tsx" fontSize={8} code={hook.usage} />
            </Box>

          </Box>
        </ScrollView>

      </S.RowGrow>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Hooks'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryCap>{hook.cat}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{hook.id}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${filtered.indexOf(hook) + 1} of ${filtered.length}`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
