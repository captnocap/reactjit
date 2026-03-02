/**
 * StyleStory — Visual style properties.
 *
 * Gradients, borders, shadows, transforms, position, overflow, transitions.
 * Everything that makes a Box look like more than a rectangle.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  red: '#ef4444', orange: '#f97316',
  green: '#22c55e', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  rose: '#f43f5e',
};

// ── Story ───────────────────────────────────────────────────────────

export function StyleStory() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);
  const [toggled, setToggled] = useState(false);

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Style'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Visual properties. Gradients, borders, shadows, transforms, position, transitions.'}
      </Text>

      {/* ──────────────────── 1. Gradients ──────────────────────────── */}
      <StorySection index={1} title="Gradients">
        <StyleDemo properties={[{
          property: 'backgroundGradient (horizontal)',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "horizontal", colors: ["#3b82f6", "#8b5cf6"] }'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Horizontal'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'backgroundGradient (vertical)',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "vertical", colors: ["#f97316", "#ef4444"] }'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'vertical', colors: ['#f97316', '#ef4444'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Vertical'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'backgroundGradient (diagonal)',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "diagonal", colors: ["#22c55e", "#06b6d4"] }'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'diagonal', colors: ['#22c55e', '#06b6d4'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{'Diagonal'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 2. Borders ─────────────────────────── */}
      <StorySection index={2} title="Borders">
        <StyleDemo properties={[{
          property: 'borderWidth + borderColor',
          ways: ways([
            ['style={}', 'borderWidth: 2, borderColor: "#3b82f6"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
            <Box style={{ borderWidth: 1, borderColor: P.blue, borderRadius: 4, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9, textAlign: 'center' }}>{'border: 1'}</Text>
            </Box>
            <Box style={{ borderWidth: 2, borderColor: P.green, borderRadius: 6, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9, textAlign: 'center' }}>{'border: 2'}</Text>
            </Box>
            <Box style={{ borderWidth: 4, borderColor: P.rose, borderRadius: 8, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9, textAlign: 'center' }}>{'border: 4'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'borderTopWidth (per-side)',
          ways: ways([
            ['style={}', 'borderTopWidth: 3, borderColor: "#ef4444"'],
            ['sides', 'borderTopWidth, borderRightWidth, borderBottomWidth, borderLeftWidth'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderTopWidth: 3, borderColor: P.red, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{'Top'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderRightWidth: 3, borderColor: P.blue, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{'Right'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderBottomWidth: 3, borderColor: P.green, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{'Bottom'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderLeftWidth: 3, borderColor: P.orange, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8, textAlign: 'center' }}>{'Left'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Shadows and Opacity ─────────────── */}
      <StorySection index={3} title="Shadows and Opacity">
        <StyleDemo properties={[{
          property: 'shadow (shadowColor + offsets + blur)',
          ways: ways([
            ['style={}', 'shadowColor: "#000", shadowOffsetY: 4, shadowBlur: 12'],
            ['presets', 'sm  md  lg  xl  2xl  none'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
            {([
              ['sm', { shadowColor: 'rgba(0,0,0,0.05)', shadowOffsetY: 1, shadowBlur: 2 }],
              ['md', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 4, shadowBlur: 6 }],
              ['lg', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 10, shadowBlur: 15 }],
              ['xl', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 20, shadowBlur: 25 }],
            ] as const).map(([name, shadow]) => (
              <Box key={name} style={{
                ...shadow, shadowOffsetX: 0,
                backgroundColor: c.surface, borderRadius: 8, padding: 10,
                minWidth: 60, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: c.text, fontSize: 9, textAlign: 'center' }}>{`shadow-${name}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'opacity',
          ways: ways([
            ['style={}', 'opacity: 0.5'],
            ['range', '0.0 (invisible) to 1.0 (fully opaque)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%', justifyContent: 'center' }}>
            {([1.0, 0.75, 0.5, 0.25, 0.1] as const).map(op => (
              <Box key={op} style={{
                flexGrow: 1, height: 40, borderRadius: 6,
                backgroundColor: P.blue, opacity: op,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{`${op}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 4. Transforms ─────────────────────────── */}
      <StorySection index={4} title="Transforms">
        <StyleDemo properties={[{
          property: 'transform.rotate',
          ways: ways([
            ['style={}', 'transform: { rotate: 45 }'],
            ['unit', 'Degrees (0-360)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            {[0, 15, 45, 90].map(deg => (
              <Box key={deg} style={{
                width: 40, height: 40, borderRadius: 6, backgroundColor: P.blue,
                transform: { rotate: deg }, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{`${deg}\u00b0`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'transform.scaleX / scaleY',
          ways: ways([
            ['style={}', 'transform: { scaleX: 1.25, scaleY: 1.25 }'],
            ['unit', 'Multiplier (1.0 = normal)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            {[0.5, 0.75, 1.0, 1.25].map(s => (
              <Box key={s} style={{
                width: 40, height: 40, borderRadius: 6, backgroundColor: P.green,
                transform: { scaleX: s, scaleY: s }, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{`${s}x`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'transform.translateX / translateY',
          ways: ways([
            ['style={}', 'transform: { translateX: 8, translateY: -5 }'],
            ['unit', 'Pixels'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            <Box style={{
              width: 40, height: 40, borderRadius: 6, backgroundColor: P.red,
              transform: { translateX: 8, translateY: -5 }, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 7, textAlign: 'center' }}>{'8,-5'}</Text>
            </Box>
            <Box style={{
              width: 40, height: 40, borderRadius: 6, backgroundColor: P.violet,
              transform: { rotate: 30, scaleX: 1.15, scaleY: 1.15, translateX: 4 },
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 7, textAlign: 'center' }}>{'combo'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 5. Position and Overflow ───────────── */}
      <StorySection index={5} title="Position and Overflow">
        <StyleDemo properties={[{
          property: 'position + zIndex',
          ways: ways([
            ['style={}', 'position: "absolute", top: 0, left: 30, zIndex: 3'],
            ['shorthand', 'z={3}  (zIndex only)'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center' }}>
            <Box style={{ width: 180, height: 100, position: 'relative' }}>
              <Box style={{
                position: 'absolute', top: 0, left: 0, width: 70, height: 70,
                borderRadius: 8, backgroundColor: P.red, zIndex: 1,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'z:1'}</Text>
              </Box>
              <Box style={{
                position: 'absolute', top: 15, left: 25, width: 70, height: 70,
                borderRadius: 8, backgroundColor: P.blue, zIndex: 3,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'z:3'}</Text>
              </Box>
              <Box style={{
                position: 'absolute', top: 30, left: 50, width: 70, height: 70,
                borderRadius: 8, backgroundColor: P.green, zIndex: 2,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 9, textAlign: 'center' }}>{'z:2'}</Text>
              </Box>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'overflow',
          ways: ways([
            ['style={}', 'overflow: "hidden"'],
            ['shorthand', 'scroll  (overflow: scroll)'],
            ['values', '"hidden"  "visible"  "scroll"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'center' }}>
            <Box style={{ width: 80, height: 60, overflow: 'hidden', borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Box style={{ width: 120, height: 80, backgroundColor: P.blue, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'clipped'}</Text>
              </Box>
            </Box>
            <Box style={{ width: 80, height: 60, overflow: 'visible', borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Box style={{ width: 120, height: 80, backgroundColor: P.orange, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 8, textAlign: 'center' }}>{'visible'}</Text>
              </Box>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 6. Spring Transitions ─────────────── */}
      <StorySection index={6} title="Spring Transitions">
        <StyleDemo properties={[{
          property: 'transition (width)',
          ways: ways([
            ['style={}', 'transition: { width: { duration: 600, easing: "spring" } }'],
            ['easings', '"spring"  "ease-in"  "ease-out"  "ease-in-out"  "linear"'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => setExpanded(v => !v)} style={{
              backgroundColor: c.primary, padding: 8, borderRadius: 6, alignItems: 'center', width: 100,
            }}>
              <Text style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>{expanded ? 'Collapse' : 'Expand'}</Text>
            </Pressable>
            <Box style={{
              width: expanded ? '100%' : 80,
              height: 40,
              backgroundColor: c.accent,
              borderRadius: 6,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              transition: { width: { duration: 600, easing: 'spring' } },
            }}>
              <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{expanded ? 'expanded' : '80px'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'transition (transform)',
          ways: ways([
            ['style={}', 'transition: { transform: { duration: 600, easing: "spring" } }'],
            ['note', 'translateX, scaleX, scaleY all animate together'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => setToggled(v => !v)} style={{
              backgroundColor: c.primary, padding: 8, borderRadius: 6, alignItems: 'center', width: 100,
            }}>
              <Text style={{ color: '#fff', fontSize: 11, textAlign: 'center' }}>{'Toggle'}</Text>
            </Pressable>
            <Box style={{
              width: 60, height: 60,
              backgroundColor: P.red,
              borderRadius: 30,
              transform: {
                translateX: toggled ? 160 : 0,
                scaleX: toggled ? 1.2 : 1,
                scaleY: toggled ? 1.2 : 1,
              },
              justifyContent: 'center',
              alignItems: 'center',
              transition: { transform: { duration: 600, easing: 'spring' } },
            }}>
              <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{toggled ? '160' : '0'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
