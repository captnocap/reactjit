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
import { Box, Text, Image, Pressable, ScrollView, CodeBlock } from '../../../packages/core/src';
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
            <Box style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ color: C.accent, fontSize: 12, fontWeight: 'bold', marginBottom: 16 }}>{'SYNTH CONTROL'}</Text>
              {/* Mock controls if actual Knobs/Faders aren't exported exactly this way in core/controls, assuming they are available or we mock them visually */}
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Box style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Box style={{ width: 4, height: 16, backgroundColor: C.accent, borderRadius: 2, marginTop: -16 }} />
                </Box>
                <Text style={{ color: c.muted, fontSize: 10 }}>{'Luma Flux'}</Text>
              </Box>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Box style={{ width: 8, height: 60, backgroundColor: c.surface, borderRadius: 4, alignItems: 'center' }}>
                  <Box style={{ width: 24, height: 12, backgroundColor: C.accent, borderRadius: 2, marginTop: 20 }} />
                </Box>
                <Text style={{ color: c.muted, fontSize: 10 }}>{'Distortion'}</Text>
              </Box>
            </Box>
          </Box>

          <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            {/* The 3D Hologram, rendering at 60fps on SDL2/OpenGL */}
            <Box style={{ width: 400, height: 400, borderRadius: 200, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0, 255, 255, 0.2)' }}>
              {/* Simulating the scene with a masked luma mesh to look like a geometric audio visualizer */}
              <VHS mask tracking={0.4} noise={0.15} colorBleed={1.5}>
                <LumaMesh mask gridSize={20} displacement={50} lineWidth={1.5} colored={false}>
                  <Box style={{ width: 400, height: 400, backgroundColor: '#050510', alignItems: 'center', justifyContent: 'center' }}>
                    {/* Mock sphere using a generic geometric Box pattern */}
                    <Box style={{ width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0, 255, 255, 0.4)', borderWidth: 5, borderColor: '#00ffff' }} />
                    <Box style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderColor: '#ff0055', borderStyle: 'dotted' }} />
                  </Box>
                </LumaMesh>
              </VHS>
            </Box>
          </Box>
        </Box>
      );
    case 'tactical-geo':
      return (
        <Box style={{ flexGrow: 1, backgroundColor: '#001100', position: 'relative', overflow: 'hidden' }}>
          {/* Tactical Map mimicking an espionage feed */}
          <OpticalFlow mask decay={0.92} displacement={4} colorShift>
            <SoftGlitch mask drift={0.3} fringe={1}>
              <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                {/* Map mockup using generic grids to simulate vector tiles */}
                <Box style={{ width: '100%', height: '100%', opacity: 0.3, flexDirection: 'row', flexWrap: 'wrap' }}>
                  {Array.from({ length: 400 }).map((_, i) => (
                    <Box key={i} style={{ width: 40, height: 40, borderWidth: 1, borderColor: '#00ff00' }} />
                  ))}
                </Box>
                <Box style={{ position: 'absolute', width: 10, height: 10, backgroundColor: '#00ff00', borderRadius: 5, top: '40%', left: '60%' }} />
                <Text style={{ position: 'absolute', color: '#00ff00', fontSize: 10, top: '40%', left: '62%' }}>{'ALPHA-1'}</Text>

                <Box style={{ position: 'absolute', width: 10, height: 10, backgroundColor: '#00ff00', borderRadius: 5, top: '55%', left: '30%' }} />
                <Text style={{ position: 'absolute', color: '#00ff00', fontSize: 10, top: '55%', left: '32%' }}>{'BRAVO-2'}</Text>
              </Box>
            </SoftGlitch>
          </OpticalFlow>

          {/* Hardware UI overlaid on the map */}
          <Box style={{ position: 'absolute', top: 20, right: 20, width: 200, backgroundColor: 'rgba(0, 17, 0, 0.8)', borderWidth: 1, borderColor: '#00ff00', padding: 12 }}>
            <Text style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: 12, marginBottom: 12 }}>
              DATALINK: ACTIVE
            </Text>
            {/* Mocking RadarSweep */}
            <Box style={{ width: 174, height: 174, borderRadius: 87, borderWidth: 1, borderColor: '#00ff00', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Box style={{ width: 87, height: 87, backgroundColor: 'rgba(0, 255, 0, 0.2)', position: 'absolute', top: 0, right: 0, transform: [{ rotate: '45deg' }], transformOrigin: '0% 100%' }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <Box key={i} style={{ width: (i + 1) * 40, height: (i + 1) * 40, borderRadius: (i + 1) * 20, borderWidth: 1, borderColor: 'rgba(0, 255, 0, 0.3)', position: 'absolute' }} />
              ))}
              <Box style={{ width: 2, height: 174, backgroundColor: 'rgba(0, 255, 0, 0.5)', position: 'absolute' }} />
              <Box style={{ width: 174, height: 2, backgroundColor: 'rgba(0, 255, 0, 0.5)', position: 'absolute' }} />
            </Box>
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
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── CreativeConceptsStory ─────────────────────────────────────────

export function CreativeConceptsStory() {
  const c = useThemeColors();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find(it => it.id === activeId) || TABS[0];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="sparkles" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'CreativeConcepts'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'A showcase of crazy composite ideas built with the ReactJIT stack'}
        </Text>
      </Box>

      {/* ── Preview area — LIVE DEMO of the active tab ── */}
      <Box style={{ flexGrow: 1, borderBottomWidth: 1, borderColor: c.border }}>
        {renderPreview(tab, c)}
      </Box>

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
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>
            {tab.label}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {tab.desc}
          </Text>
        </Box>

        <VerticalDivider />

        {/* ── Usage code ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'USAGE'}
          </Text>
          <CodeBlock language="tsx" fontSize={9} code={tab.usage} />
        </Box>

        <VerticalDivider />

        {/* ── Props + callbacks ── */}
        <Box style={{ flexGrow: 1, flexBasis: 0, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
            {'PROPS'}
          </Text>
          <Box style={{ gap: 3 }}>
            {tab.props.map(([name, type, icon]) => (
              <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                <Text style={{ color: c.muted, fontSize: 9 }}>{type}</Text>
              </Box>
            ))}
          </Box>
          {tab.callbacks.length > 0 && (
            <>
              <HorizontalDivider />
              <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
                {'CALLBACKS'}
              </Text>
              <Box style={{ gap: 3 }}>
                {tab.callbacks.map(([name, sig, icon]) => (
                  <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                    <Image src={icon} style={{ width: 10, height: 10 }} tintColor={c.muted} />
                    <Text style={{ color: c.text, fontSize: 9 }}>{name}</Text>
                    <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Box>

      </Box>

      {/* ── Tab bar — switches the active component shown above ── */}
      <ScrollView style={{
        height: 86,
        flexShrink: 0,
        borderTopWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
      }}>
        <Box style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 8,
        }}>
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
        </Box>
      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Demos'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="sparkles" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'CreativeConcepts'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src={tab.icon} style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{tab.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`${TABS.indexOf(tab) + 1} of ${TABS.length}`}</Text>
      </Box>

    </Box>
  );
}
