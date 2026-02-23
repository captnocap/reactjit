import React, { useState } from 'react';
import {
  Box, Text, Pressable, Tabs, Slider,
  Scanlines, CRT, VHS, Dither, Ascii,
  Spirograph, Constellation, Voronoi, Mycelium, Rings, FlowParticles,
  TextEffect,
} from '../../../packages/core/src';
import type { Tab } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ---------------------------------------------------------------------------
// Mask definitions
// ---------------------------------------------------------------------------

const masks = [
  { name: 'Scanlines', Component: Scanlines },
  { name: 'CRT', Component: CRT },
  { name: 'VHS', Component: VHS },
  { name: 'Dither', Component: Dither },
  { name: 'Ascii', Component: Ascii },
] as const;

const backgrounds = [
  { name: 'None', Component: null },
  { name: 'Spirograph', Component: Spirograph },
  { name: 'Constellation', Component: Constellation },
  { name: 'Voronoi', Component: Voronoi },
  { name: 'Mycelium', Component: Mycelium },
  { name: 'Rings', Component: Rings },
  { name: 'FlowParticles', Component: FlowParticles },
] as const;

// ---------------------------------------------------------------------------
// Story
// ---------------------------------------------------------------------------

export function MasksStory() {
  const c = useThemeColors();
  const [maskIdx, setMaskIdx] = useState(0);
  const [bgIdx, setBgIdx] = useState(1);
  const [intensity, setIntensity] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);

  const selectedMask = masks[maskIdx];
  const MaskComponent = selectedMask.Component;
  const selectedBg = backgrounds[bgIdx];
  const BgComponent = selectedBg.Component;

  const maskTabs: Tab[] = masks.map((m, i) => ({ id: String(i), label: m.name }));
  const bgTabs: Tab[] = backgrounds.map((b, i) => ({ id: String(i), label: b.name }));

  return (
    <Box style={{ width: '100%', height: '100%', padding: 6, gap: 6, minHeight: 0, overflow: 'hidden' }}>
      {/* Controls */}
      <Box style={{
        width: '100%',
        gap: 5,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'start', width: '100%', gap: 10 }}>
          <Box style={{ flexGrow: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: 'bold' }}>Masks</Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              Post-processing filters composited on top of rendered content
            </Text>
          </Box>
        </Box>

        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Mask</Text>
          <Tabs
            tabs={maskTabs}
            activeId={String(maskIdx)}
            onSelect={(id) => setMaskIdx(Number(id))}
            variant="pill"
            style={{ padding: 3, gap: 3 }}
          />
        </Box>

        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Background Effect</Text>
          <Tabs
            tabs={bgTabs}
            activeId={String(bgIdx)}
            onSelect={(id) => setBgIdx(Number(id))}
            variant="pill"
            style={{ flexWrap: 'wrap', padding: 3, gap: 3 }}
          />
        </Box>

        <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Intensity</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={intensity} min={0} max={1} onValueChange={setIntensity} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 30 }}>{intensity.toFixed(2)}</Text>
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Speed</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={speed} min={0.1} max={3} onValueChange={setSpeed} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 30 }}>{speed.toFixed(1)}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Main content: two panels side by side */}
      <Box style={{ flexDirection: 'row', gap: 6, flexGrow: 1, minHeight: 0 }}>
        {/* Left: Standalone mask demo */}
        <Box style={{ flexGrow: 1, flexBasis: 0, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
            {selectedMask.name} Mask
          </Text>
          <Box style={{
            flexGrow: 1,
            minHeight: 0,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
          }}>
            {/* Content with optional background + mask on top */}
            {BgComponent && <BgComponent background speed={speed * 0.7} />}
            <Box style={{
              position: 'absolute',
              left: 0, top: 0,
              width: '100%', height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}>
              <Box style={{
                padding: 16,
                borderRadius: 10,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                gap: 6,
              }}>
                <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold' }}>
                  {selectedMask.name}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  Post-processing mask active
                </Text>
              </Box>
            </Box>
            <MaskComponent mask intensity={intensity} speed={speed} />
          </Box>
        </Box>

        {/* Right: Full compositing stack demo */}
        <Box style={{ width: 240, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
            Full Compositing Stack
          </Text>

          {/* Card 1: background + text effect + mask */}
          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            flexGrow: 1,
            minHeight: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Spirograph background speed={0.6} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0,
              width: '100%', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.25)',
            }} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0,
              width: '100%', height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}>
              <TextEffect
                type="neon"
                text="REACTJIT"
                style={{ width: 200, height: 50 }}
              />
              <Box style={{
                paddingLeft: 10, paddingRight: 10,
                paddingTop: 4, paddingBottom: 4,
                borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)',
              }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>
                  BG + Text FX + Mask
                </Text>
              </Box>
            </Box>
            <MaskComponent mask intensity={intensity * 0.7} speed={speed} />
          </Box>

          {/* Card 2: different bg + different mask */}
          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            height: 120,
            flexShrink: 0,
          }}>
            <Constellation background speed={0.8} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0,
              width: '100%', height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>
                Constellation + CRT
              </Text>
            </Box>
            <CRT mask intensity={intensity * 0.6} speed={speed} />
          </Box>

          {/* Card 3: VHS tape look */}
          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            height: 100,
            flexShrink: 0,
          }}>
            <Voronoi background speed={0.5} />
            <Box style={{
              position: 'absolute',
              left: 0, top: 0,
              width: '100%', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <TextEffect
                type="typewriter"
                text="PLAY"
                style={{ width: 120, height: 36 }}
                speed={0.8}
              />
            </Box>
            <VHS mask tracking={intensity * 0.8} speed={speed} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
