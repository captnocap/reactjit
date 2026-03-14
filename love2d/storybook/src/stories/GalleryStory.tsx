/**
 * Gallery — Component showcase with live thumbnail tab bar.
 *
 * Structure:
 *   Header row 1 — Gallery title + badge
 *   Header row 2 — Component name + package badge + counter
 *   Info row     — description | code example | props/callbacks
 *   Preview      — LIVE DEMO of active component (flexGrow: 1)
 *   Divider bar  — drag handle + search input (expandable)
 *   Tab grid     — thumbnail previews (fills remaining space)
 *
 * All thumbnails and previews live in GalleryComponents.tsx.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, Input, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { getAll, PKG_COLORS, type GalleryEntry } from './galleryRegistry';
import './GalleryComponents'; // side-effect: registers all components

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// Package display order + labels for the grouped tab grid
const PKG_ORDER = ['core', 'controls', 'chemistry', 'finance', 'time', 'ai', 'data', 'apis'];
const PKG_LABELS: Record<string, string> = {
  core: 'Core',
  controls: 'Controls',
  chemistry: 'Chemistry',
  finance: 'Finance',
  time: 'Time',
  ai: 'AI',
  data: 'Data',
  apis: 'APIs',
};

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
}

// ── GalleryStory ─────────────────────────────────────────

export function GalleryStory() {
  const c = useThemeColors();
  const TABS = getAll();
  const [activeId, setActiveId] = useState(TABS[0]?.id ?? '');
  // Expose for test runner (rjit test)
  (globalThis as any).__galleryEntries = TABS.map(t => ({ id: t.id, label: t.label }));
  (globalThis as any).__gallerySetActive = setActiveId;
  const [searchQuery, setSearchQuery] = useState('');
  const [tabsExpanded, setTabsExpanded] = useState(false);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];
  const pkgColor = PKG_COLORS[tab?.pkg];

  const filteredTabs = (() => {
    if (!searchQuery) return TABS;
    const q = searchQuery.toLowerCase();
    return TABS.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.pkg.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q)
    );
  })();

  // Group filtered tabs by package in display order
  const groupedTabs = (() => {
    const byPkg: Record<string, GalleryEntry[]> = {};
    for (const t of filteredTabs) {
      if (!byPkg[t.pkg]) byPkg[t.pkg] = [];
      byPkg[t.pkg].push(t);
    }
    return PKG_ORDER.filter(p => byPkg[p] && byPkg[p].length > 0).map(p => ({
      pkg: p,
      label: PKG_LABELS[p] || p,
      color: PKG_COLORS[p],
      items: byPkg[p],
    }));
  })();

  const tabGridHeight = tabsExpanded ? 380 : 232;

  return (
    <S.StoryRoot testId="gallery-root">

      {/* ── Content area: everything above footer, clipped to fit ── */}
      <Box testId="gallery-content" style={{ flexGrow: 1, overflow: 'hidden' }}>

      {/* ── Header row 1: Gallery title ── */}
      <S.RowCenterBorder testId="gallery-header1" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, gap: 14 }}>
        <S.StoryHeaderIcon src="layout-grid" tintColor={C.accent} />
        <S.StoryTitle>{'Components'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'Gallery'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Composed components, live and interactive'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Header row 2: Component name + package badge ── */}
      <S.RowCenterBorder testId="gallery-header2" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, gap: 10 }}>
        <S.BoldText style={{ fontSize: 16 }}>{tab.label}</S.BoldText>
        {pkgColor ? (
          <Box style={{ backgroundColor: `${pkgColor}22`, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: pkgColor, fontSize: 10 }}>{`@reactjit/${tab.pkg}`}</Text>
          </Box>
        ) : (
          <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
          </Box>
        )}
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length} components`}</S.StoryCap>
      </S.RowCenterBorder>

      {/* ── Info row: description | usage | props ── */}
      <S.BorderBottom testId="gallery-info-row" style={{ height: 120, flexShrink: 0, flexDirection: 'row', backgroundColor: c.bgElevated, overflow: 'hidden' }}>
        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'DESCRIPTION'}</S.StoryLabelText>
          <S.StoryMuted>{tab.desc}</S.StoryMuted>
        </S.Half>

        <VerticalDivider />

        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'USAGE'}</S.StoryLabelText>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </S.Half>

        <VerticalDivider />

        <S.Half style={{ padding: 12, gap: 6 }}>
          <S.StoryLabelText>{'PROPS'}</S.StoryLabelText>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type]) => (
              <S.RowCenterG5 key={name}>
                <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                <S.StoryCap>{type}</S.StoryCap>
              </S.RowCenterG5>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <S.StoryLabelText>{'CALLBACKS'}</S.StoryLabelText>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig]) => (
                  <S.RowCenterG5 key={name}>
                    <S.StoryBreadcrumbActive>{name}</S.StoryBreadcrumbActive>
                    <S.StoryCap>{sig}</S.StoryCap>
                  </S.RowCenterG5>
                ))}
              </Box>
            </>
          )}
        </S.Half>
      </S.BorderBottom>

      {/* ── Preview area ── */}
      <S.BorderBottom testId="gallery-preview" style={{ flexGrow: 1 }}>
        {tab?.preview(c)}
      </S.BorderBottom>

      {/* ── Divider bar: expand toggle + search ── */}
      <Pressable onPress={() => setTabsExpanded(!tabsExpanded)}>
        <S.RowCenterBorder testId="gallery-divider-bar" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, borderBottomWidth: 1, paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, gap: 10 }}>
          {/* Drag/expand handle */}
          <Box style={{ gap: 2 }}>
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
            <Box style={{ width: 16, height: 2, backgroundColor: c.muted, borderRadius: 1, opacity: 0.5 }} />
          </Box>
          <S.DimIcon12 src={tabsExpanded ? 'chevron-down' : 'chevron-up'} />
          <S.StoryCap>
            {`${filteredTabs.length} component${filteredTabs.length !== 1 ? 's' : ''}`}
          </S.StoryCap>

          <Box style={{ flexGrow: 1 }} />

          {/* Search input */}
          <Pressable onPress={(e: any) => { if (e && e.stopPropagation) e.stopPropagation(); }}>
            <S.RowCenterG6 style={{ backgroundColor: c.surface, borderRadius: 4, borderWidth: 1, borderColor: c.border, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, width: 180 }}>
              <S.StorySectionIcon src="search" tintColor={c.muted} />
              <Input
                placeholder="Filter components..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  flexGrow: 1, color: c.text, fontSize: 9,
                  backgroundColor: 'transparent', padding: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <S.DimIcon8 src="x" />
                </Pressable>
              )}
            </S.RowCenterG6>
          </Pressable>
        </S.RowCenterBorder>
      </Pressable>

      {/* ── Tab grid — thumbnail previews grouped by package ── */}
      <ScrollView testId="gallery-tab-grid" style={{
        height: tabGridHeight, flexShrink: 0,
        backgroundColor: c.bgElevated,
      }}>
        <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 8, gap: 2 }}>
          {groupedTabs.map(group => (
            <Box key={group.pkg}>
              {/* Package section header */}
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingTop: 6, paddingBottom: 4 }}>
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: group.color || C.accent }} />
                <Text style={{ fontSize: 8, color: group.color || c.muted, fontWeight: 'bold', letterSpacing: 1 }}>
                  {`@reactjit/${group.pkg}`}
                </Text>
                <Box style={{ flexGrow: 1, height: 1, backgroundColor: group.color || c.border, opacity: 0.2 }} />
                <Text style={{ fontSize: 7, color: c.muted, paddingRight: 4 }}>{`${group.items.length}`}</Text>
              </Box>
              {/* Thumbnails row */}
              <S.RowG6 style={{ flexWrap: 'wrap', paddingLeft: 2, paddingRight: 2 }}>
                {group.items.map(comp => {
                  const active = comp.id === activeId;
                  return (
                    <Pressable key={comp.id} onPress={() => setActiveId(comp.id)}>
                      <Box style={{
                        width: 68, height: 68,
                        backgroundColor: active ? C.selected : c.surface,
                        borderRadius: 6,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? C.accent : c.border,
                        overflow: 'hidden',
                      }}>
                        <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
                          {comp.thumb(c)}
                        </Box>
                        <Box style={{
                          flexShrink: 0, height: 14,
                          backgroundColor: active ? C.accentDim : 'rgba(0,0,0,0.3)',
                          justifyContent: 'center', alignItems: 'center',
                          flexDirection: 'row', gap: 3,
                        }}>
                          <Text testId={`gallery-thumb-${comp.id}`} style={{ color: active ? c.text : c.muted, fontSize: 6 }}>{comp.label}</Text>
                        </Box>
                      </Box>
                    </Pressable>
                  );
                })}
              </S.RowG6>
            </Box>
          ))}
          {filteredTabs.length === 0 && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <S.DimBody11>{`No components match "${searchQuery}"`}</S.DimBody11>
            </Box>
          )}
        </Box>
      </ScrollView>

      </Box>{/* end gallery-content */}

      {/* ── Footer — breadcrumbs + counter ── */}
      <S.RowCenterBorder testId="gallery-footer-toolbar" style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Components'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.DimIcon12 src="layout-grid" />
        <S.StoryCap>{tab.pkg}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length} components`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
