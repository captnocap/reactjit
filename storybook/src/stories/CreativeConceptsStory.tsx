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
 * Fill in every TODO: marker below with real content from the package.
 */

import React, { useState } from 'react';
import { Box, Text, Image, Pressable, ScrollView, CodeBlock, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Map, TileLayer, Marker, Polyline } from '../../../packages/geo/src';
import { Knob, Fader, Meter, RadarSweep } from '../../../packages/controls/src';
import { Scene, Mesh, Camera, AmbientLight } from '../../../packages/3d/src';
import { useAnimation, useSpring, Easing, parallel } from '../../../packages/core/src';
import { LumaMesh, SoftGlitch, VHS, OpticalFlow } from '../../../packages/core/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  selected: 'rgba(139, 92, 246, 0.2)',
};

// ── Tabs ─────────────────────────────────────────────────
// Each tab represents one component/feature in the package.
// The tab bar at the bottom switches between them.
//
// TODO: Replace these placeholder tabs with real components
// from packages/creativeconcepts/src/. Read each component's source
// to get real props, types, callbacks, and usage examples.

interface TabDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  usage: string;
  props: [string, string, string][]; // [name, type, icon]
  callbacks: [string, string, string][];
}

const TABS: TabDef[] = [
  {
    id: 'holo-visualizer',
    label: 'Holographic Visualizer',
    icon: 'speaker',
    desc: 'A sci-fi, 3D audio-reactive control interface that bleeds into the UI using hardware-style controls and LumaMesh/VHS post-processing.',
    usage: `<HolographicAudioVisualizer />`,
    props: [],
    callbacks: [],
  },
  {
    id: 'tactical-geo',
    label: 'Tactical Geo Terminal',
    icon: 'map-pin',
    desc: 'An espionage satellite feed map using @reactjit/geo, hardware UI overlays, and OpticalFlow/SoftGlitch custom shaders.',
    usage: `<TacticalGeoTerminal />`,
    props: [],
    callbacks: [],
  },
];

// ── Preview renderer ─────────────────────────────────────
// Renders a LIVE DEMO for each tab. This fills the entire preview area.
// Every case MUST produce content that visually fills the space.
//
// IMPORTANT: The preview area is the LARGEST part of the story.
// It has flexGrow: 1 and takes all vertical space between the header
// and info row. Do NOT render a tiny icon centered in empty space.
// Render the ACTUAL COMPONENT being documented, filling the area.
//
// TODO: Replace every case with a live component demo.
// Use flexGrow: 1 or explicit sizing to fill the preview area.

function renderPreview(tab: TabDef, c: ReturnType<typeof useThemeColors>) {
  switch (tab.id) {
    case 'holo-visualizer':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: '#050510', position: 'relative', overflow: 'hidden' }}>
          {/* Hardware Transport & Synthesis Controls */}
          <Box style={{ position: 'absolute', top: 20, left: 20, width: 150, gap: 16, zIndex: 10 }}>
            <S.Bordered style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 16, borderRadius: 12 }}>
              <Text style={{ color: C.accent, fontSize: 12, fontWeight: 'bold', marginBottom: 16 }}>{'SYNTH CONTROL'}</Text>
              {/* Mock controls if actual Knobs/Faders aren't exported exactly this way in core/controls, assuming they are available or we mock them visually */}
              <S.RowCenter style={{ gap: 10, marginBottom: 12 }}>
                <Box style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Box style={{ width: 4, height: 16, backgroundColor: C.accent, borderRadius: 2, marginTop: -16 }} />
                </Box>
                <S.StoryMuted>{'Luma Flux'}</S.StoryMuted>
              </S.RowCenter>
              <S.RowCenter style={{ gap: 10, marginBottom: 12 }}>
                <Box style={{ width: 8, height: 60, backgroundColor: c.surface, borderRadius: 4, alignItems: 'center' }}>
                  <Box style={{ width: 24, height: 12, backgroundColor: C.accent, borderRadius: 2, marginTop: 20 }} />
                </Box>
                <S.StoryMuted>{'Distortion'}</S.StoryMuted>
              </S.RowCenter>
            </S.Bordered>
          </Box>

          <S.GrowCenterAlign>
            {/* The 3D Hologram, rendering at 60fps on SDL2/OpenGL */}
            <Box style={{ width: 400, height: 400, borderRadius: 200, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0, 255, 255, 0.2)' }}>
              {/* Simulating the scene with a masked luma mesh to look like a geometric audio visualizer */}
              <VHS mask tracking={0.4} noise={0.15} colorBleed={1.5}>
                <LumaMesh mask gridSize={20} displacement={50} lineWidth={1.5} colored={false}>
                  <S.Center style={{ width: 400, height: 400, backgroundColor: '#050510' }}>
                    {/* Mock sphere using a generic geometric Box pattern */}
                    <Box style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0, 255, 255, 0.4)', borderWidth: 5, borderColor: '#00ffff' }} />
                    <Box style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderColor: '#ff0055', opacity: 0.6 }} />
                  </S.Center>
                </LumaMesh>
              </VHS>
            </Box>
          </S.GrowCenterAlign>
        </Box>
      );
    case 'tactical-geo':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: '#001100', position: 'relative', overflow: 'hidden' }}>
          {/* Tactical Map mimicking an espionage feed */}
          <OpticalFlow mask decay={0.92} displacement={4} colorShift>
            <SoftGlitch mask drift={0.3} fringe={1}>
              <S.GrowCenterAlign>
                {/* Map mockup using generic grids to simulate vector tiles */}
                <S.RowWrap style={{ width: '100%', height: '100%', opacity: 0.3 }}>
                  {Array.from({ length: 400 }).map((_, i) => (
                    <Box key={i} style={{ width: 40, height: 40, borderWidth: 1, borderColor: '#00ff00' }} />
                  ))}
                </S.RowWrap>
                <Box style={{ position: 'absolute', width: 10, height: 10, backgroundColor: '#00ff00', borderRadius: 5, top: '40%', left: '60%' }} />
                <Text style={{ position: 'absolute', color: '#00ff00', fontSize: 10, top: '40%', left: '62%' }}>{'ALPHA-1'}</Text>

                <Box style={{ position: 'absolute', width: 10, height: 10, backgroundColor: '#00ff00', borderRadius: 5, top: '55%', left: '30%' }} />
                <Text style={{ position: 'absolute', color: '#00ff00', fontSize: 10, top: '55%', left: '32%' }}>{'BRAVO-2'}</Text>
              </S.GrowCenterAlign>
            </SoftGlitch>
          </OpticalFlow>

          {/* Hardware UI overlaid on the map */}
          <Box style={{ position: 'absolute', top: 20, right: 20, width: 200, backgroundColor: 'rgba(0, 17, 0, 0.8)', borderWidth: 1, borderColor: '#00ff00', padding: 12 }}>
            <Text style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}>
              DATALINK: ACTIVE
            </Text>
            {/* Mocking RadarSweep */}
            <S.Center style={{ width: 174, height: 174, borderRadius: 87, borderWidth: 1, borderColor: '#00ff00', overflow: 'hidden' }}>
              <Box style={{ width: 87, height: 87, backgroundColor: 'rgba(0, 255, 0, 0.2)', position: 'absolute', top: 0, right: 0, transform: [{ rotate: '45deg' }] }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <Box key={i} style={{ width: (i + 1) * 40, height: (i + 1) * 40, borderRadius: (i + 1) * 20, borderWidth: 1, borderColor: 'rgba(0, 255, 0, 0.3)', position: 'absolute' }} />
              ))}
              <Box style={{ width: 2, height: 174, backgroundColor: 'rgba(0, 255, 0, 0.5)', position: 'absolute' }} />
              <Box style={{ width: 174, height: 2, backgroundColor: 'rgba(0, 255, 0, 0.5)', position: 'absolute' }} />
            </S.Center>
          </Box>
        </Box>
      );
    default:
      return null;
  }
}

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
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
          {'A showcase of crazy composite ideas built with the ReactJIT stack'}
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
                  width: 50,
                  height: 50,
                  backgroundColor: active ? C.selected : c.surface,
                  borderRadius: 6,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? C.accent : c.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <Image src={comp.icon} style={{ width: 16, height: 16 }} tintColor={active ? C.accent : c.muted} />
                  <Text style={{ color: active ? c.text : c.muted, fontSize: 7 }}>
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
        <S.TextIcon12 src={tab.icon} />
        <S.StoryBreadcrumbActive>{tab.label}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
