/**
 * StyleStory — Unified style reference.
 *
 * Every visual property in one place. Hover any demo element to see
 * ALL equivalent syntaxes: style={}, shorthand props, tw() classes,
 * HTML element compat, theme tokens, and Col grid props.
 */

import React, { useState } from 'react';
import { Box, Row, Col, Text, Pressable, tw, useBreakpoint } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Shared helpers ──────────────────────────────────────────────────

function Chip({ label, color, size = 36 }: { label: string; color: string; size?: number }) {
  return (
    <Box style={{
      width: size, height: size, backgroundColor: color,
      borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function GridCell({ label, color, h = 40 }: { label: string; color: string; h?: number }) {
  return (
    <Box style={{
      height: h, backgroundColor: color, borderRadius: 6,
      justifyContent: 'center', alignItems: 'center', width: '100%',
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

function Label({ children }: { children: string }) {
  const c = useThemeColors();
  // rjit-ignore-next-line
  return <Text style={{ color: c.muted, fontSize: 9, width: '100%', textAlign: 'left' }}>{children}</Text>;
}

// ── Palette ─────────────────────────────────────────────────────────

const P = {
  red: '#ef4444', orange: '#f97316', amber: '#eab308',
  green: '#22c55e', teal: '#14b8a6', cyan: '#06b6d4',
  blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6',
  pink: '#ec4899', rose: '#f43f5e', purple: '#a855f7',
};

// ── Story ───────────────────────────────────────────────────────────

export function StyleStory() {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Style Reference'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Every visual property. Hover any element to see all equivalent syntaxes.'}
      </Text>

      {/* ──────────────────── 1. Background Color ──────────────────── */}
      <StorySection index={1} title="Background Color">
        <StyleDemo properties={[{
          property: 'backgroundColor',
          ways: ways([
            ['style={}', 'backgroundColor: "#3b82f6"'],
            ['shorthand', 'bg="#3b82f6"'],
            ['tw()', 'className="bg-blue-500"'],
            ['HTML', '<div className="bg-blue-500">'],
            ['theme', 'bg="primary"  (via ThemeProvider)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
            <Box bg={P.blue} radius={6} style={{ flexGrow: 1, height: 40, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'style / shorthand / tw'}</Text>
            </Box>
            <Box style={{ flexGrow: 1, height: 40, borderRadius: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: [1, 0.8, 0, 1] }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'RGBA: [1, 0.8, 0, 1]'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <Label>{'Tailwind color families (hover for syntax)'}</Label>
        {(['red', 'orange', 'amber', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'purple', 'pink', 'rose'] as const).map(color => (
          <StyleDemo key={color} properties={[{
            property: 'backgroundColor',
            ways: ways([
              ['style={}', `backgroundColor: "${(tw as any)(`bg-${color}-500`).backgroundColor || `bg-${color}-500`}"`],
              ['shorthand', `bg="${(tw as any)(`bg-${color}-500`).backgroundColor || ''}"`],
              ['tw()', `className="bg-${color}-500"`],
              ['HTML', `<div className="bg-${color}-500">`],
            ]),
          }]}>
            <Box style={{ flexDirection: 'row', gap: 1, width: '100%' }}>
              {(['300', '500', '700'] as const).map(shade => (
                <Box key={shade} style={{
                  ...tw(`bg-${color}-${shade} rounded`),
                  flexGrow: 1, height: 14, justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 6 }}>{`${shade}`}</Text>
                </Box>
              ))}
            </Box>
          </StyleDemo>
        ))}
      </StorySection>

      {/* ──────────────────── 2. Gradients ──────────────────────────── */}
      <StorySection index={2} title="Gradients">
        <StyleDemo properties={[{
          property: 'backgroundGradient',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "horizontal", colors: ["#3b82f6", "#8b5cf6"] }'],
            ['tw()', 'className="bg-gradient-to-r from-blue-500 to-violet-500"'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'horizontal', colors: ['#3b82f6', '#8b5cf6'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{'Horizontal'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'backgroundGradient',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "vertical", colors: ["#f97316", "#ef4444"] }'],
            ['tw()', 'className="bg-gradient-to-b from-orange-500 to-red-500"'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'vertical', colors: ['#f97316', '#ef4444'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{'Vertical'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'backgroundGradient',
          ways: ways([
            ['style={}', 'backgroundGradient: { direction: "diagonal", colors: ["#22c55e", "#06b6d4"] }'],
            ['tw()', 'className="bg-gradient-to-br from-green-500 to-cyan-500"'],
          ]),
        }]}>
          <Box style={{
            width: '100%', height: 50, borderRadius: 8,
            justifyContent: 'center', alignItems: 'center',
            backgroundGradient: { direction: 'diagonal', colors: ['#22c55e', '#06b6d4'] },
          }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{'Diagonal'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 3. Spacing ────────────────────────────── */}
      <StorySection index={3} title="Spacing">
        <StyleDemo properties={[{
          property: 'padding',
          ways: ways([
            ['style={}', 'padding: 16'],
            ['shorthand', 'padding={16}'],
            ['tw()', 'className="p-4"'],
            ['HTML', '<div className="p-4">'],
          ]),
        }]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 16, width: '100%' }}>
            <Box bg={P.blue} radius={5} style={{ height: 28, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'padding: 16 (p-4)'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[
          { property: 'paddingLeft / paddingRight', ways: ways([
            ['style={}', 'paddingLeft: 24, paddingRight: 24'],
            ['shorthand', 'px={24}'],
            ['tw()', 'className="px-6"'],
          ]) },
          { property: 'paddingTop / paddingBottom', ways: ways([
            ['style={}', 'paddingTop: 8, paddingBottom: 8'],
            ['shorthand', 'py={8}'],
            ['tw()', 'className="py-2"'],
          ]) },
        ]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, width: '100%' }}>
            <Box bg={P.indigo} radius={5} style={{ height: 28, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'px-6 py-2'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'gap',
          ways: ways([
            ['style={}', 'gap: 16'],
            ['shorthand', 'gap={16}'],
            ['tw()', 'className="gap-4"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
            <Chip label="A" color={P.red} />
            <Chip label="B" color={P.orange} />
            <Chip label="C" color={P.amber} />
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'margin',
          ways: ways([
            ['style={}', 'marginLeft: 20'],
            ['tw()', 'className="ml-5"'],
            ['note', 'No shorthand prop for margin per-side'],
          ]),
        }]}>
          <Box style={{ backgroundColor: c.surface, borderRadius: 6, padding: 8, flexDirection: 'row', width: '100%' }}>
            <Box style={{ width: 36, height: 36, backgroundColor: P.red, borderRadius: 5 }} />
            <Box style={{ width: 36, height: 36, backgroundColor: P.orange, borderRadius: 5, marginLeft: 20 }} />
            <Box style={{ width: 36, height: 36, backgroundColor: P.amber, borderRadius: 5, marginLeft: 8 }} />
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 4. Flex Layout ────────────────────────── */}
      <StorySection index={4} title="Flex Layout">
        <StyleDemo properties={[{
          property: 'flexDirection + justifyContent',
          ways: ways([
            ['style={}', 'flexDirection: "row", justifyContent: "space-between"'],
            ['shorthand', 'direction="row" justify="space-between"'],
            ['tw()', 'className="flex-row justify-between"'],
          ]),
        }]}>
          <Box style={{ width: '100%', gap: 4 }}>
            {(['start', 'center', 'space-between', 'space-around'] as const).map(justify => (
              <Box key={justify} style={{
                width: '100%', flexDirection: 'row', justifyContent: justify,
                backgroundColor: c.surface, borderRadius: 6, padding: 6,
              }}>
                <Chip label="A" color={P.red} />
                <Chip label="B" color={P.orange} />
                <Chip label="C" color={P.amber} />
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'alignItems',
          ways: ways([
            ['style={}', 'alignItems: "center"'],
            ['shorthand', 'align="center"'],
            ['tw()', 'className="items-center"'],
          ]),
        }]}>
          <Box style={{ width: '100%', flexDirection: 'row', gap: 8 }}>
            {(['start', 'center', 'end'] as const).map(align => (
              <Box key={align} style={{
                flexGrow: 1, height: 80, backgroundColor: c.surface,
                borderRadius: 6, padding: 6, gap: 4, alignItems: align,
              }}>
                <Text style={{ color: c.muted, fontSize: 8 }}>{`align: ${align}`}</Text>
                <Box style={{ width: 40, height: 20, backgroundColor: P.blue, borderRadius: 4 }} />
                <Box style={{ width: 60, height: 20, backgroundColor: P.indigo, borderRadius: 4 }} />
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'flexWrap',
          ways: ways([
            ['style={}', 'flexWrap: "wrap"'],
            ['shorthand', 'wrap'],
            ['tw()', 'className="flex-wrap"'],
          ]),
        }]}>
          <Box style={{
            flexDirection: 'row', flexWrap: 'wrap', gap: 6,
            backgroundColor: c.surface, borderRadius: 6, padding: 8, width: '100%',
          }}>
            {[P.red, P.orange, P.amber, P.green, P.teal, P.cyan, P.blue, P.indigo].map((color, i) => (
              <Chip key={i} label={`${i + 1}`} color={color} size={32} />
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 5. Sizing ─────────────────────────────── */}
      <StorySection index={5} title="Sizing">
        <StyleDemo properties={[{
          property: 'width / height',
          ways: ways([
            ['style={}', 'width: 200, height: 60'],
            ['shorthand', 'w={200} h={60}'],
            ['tw()', 'className="w-[200] h-[60]"'],
          ]),
        }]}>
          <Box w={200} h={60} bg={P.blue} radius={6} style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 9 }}>{'200 x 60'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'fill (width + height 100%)',
          ways: ways([
            ['style={}', 'width: "100%", height: "100%"'],
            ['shorthand', 'fill'],
            ['tw()', 'className="w-full h-full"'],
          ]),
        }, {
          property: 'flexGrow',
          ways: ways([
            ['style={}', 'flexGrow: 1'],
            ['shorthand', 'grow'],
            ['tw()', 'className="flex-1" or "grow"'],
          ]),
        }]}>
          <Box style={{ width: '100%', flexDirection: 'row', gap: 6, height: 50 }}>
            <Box style={{ width: 60, height: 50, backgroundColor: P.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'fixed'}</Text>
            </Box>
            <Box grow bg={P.green} radius={6} style={{ height: 50, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'grow (fills remaining)'}</Text>
            </Box>
            <Box style={{ width: 60, height: 50, backgroundColor: P.red, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'fixed'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'aspectRatio',
          ways: ways([
            ['style={}', 'aspectRatio: 16 / 9'],
            ['tw()', 'className="aspect-video"'],
            ['note', 'Also: aspect-square (1:1)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <Box style={{ width: 60, aspectRatio: 1, backgroundColor: P.violet, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'1:1'}</Text>
            </Box>
            <Box style={{ width: 120, aspectRatio: 16 / 9, backgroundColor: P.blue, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'16:9'}</Text>
            </Box>
            <Box style={{ height: 40, aspectRatio: 2, backgroundColor: P.green, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 8 }}>{'2:1'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 6. Typography ─────────────────────────── */}
      <StorySection index={6} title="Typography">
        <StyleDemo properties={[{
          property: 'fontSize',
          ways: ways([
            ['style={}', 'fontSize: 14'],
            ['shorthand', '<Text size={14}>'],
            ['tw()', 'tw("text-sm")  →  fontSize: 14'],
            ['scale', 'xs=12  sm=14  base=16  lg=18  xl=20  2xl=24'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%' }}>
            <Text style={{ color: c.text, fontSize: 12 }}>{'text-xs (12px)'}</Text>
            <Text style={{ color: c.text, fontSize: 14 }}>{'text-sm (14px)'}</Text>
            <Text style={{ color: c.text, fontSize: 16 }}>{'text-base (16px)'}</Text>
            <Text style={{ color: c.text, fontSize: 20 }}>{'text-xl (20px)'}</Text>
            <Text style={{ color: c.text, fontSize: 24 }}>{'text-2xl (24px)'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'fontWeight',
          ways: ways([
            ['style={}', 'fontWeight: "bold"  or  fontWeight: 700'],
            ['shorthand', '<Text bold>'],
            ['tw()', 'className="font-bold"'],
            ['scale', 'thin=100  light=300  normal  medium=500  semibold=600  bold  black=900'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%' }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'normal' }}>{'font-normal'}</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'font-bold'}</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 900 }}>{'font-black (900)'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'textDecorationLine',
          ways: ways([
            ['style={}', 'textDecorationLine: "underline"'],
            ['tw()', 'className="underline"  or  "line-through"'],
          ]),
        }, {
          property: 'textAlign',
          ways: ways([
            ['style={}', 'textAlign: "center"'],
            ['shorthand', '<Text align="center">'],
            ['tw()', 'className="text-center"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <Text style={{ color: c.text, fontSize: 12, textDecorationLine: 'underline' }}>{'underline'}</Text>
            <Text style={{ color: c.text, fontSize: 12, textDecorationLine: 'line-through' }}>{'line-through'}</Text>
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center', flexGrow: 1 }}>{'text-center'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'letterSpacing',
          ways: ways([
            ['style={}', 'letterSpacing: 2'],
            ['tw()', 'className="tracking-wide"'],
            ['scale', 'tighter=-0.8  tight=-0.4  normal=0  wide=0.4  wider=0.8  widest=1.6'],
          ]),
        }, {
          property: 'lineHeight',
          ways: ways([
            ['style={}', 'lineHeight: 28'],
            ['tw()', 'className="leading-7"'],
          ]),
        }]}>
          <Box style={{ gap: 2, width: '100%' }}>
            <Text style={{ color: c.primary, fontSize: 12, letterSpacing: 2 }}>{'Letter spacing: 2 (tracking-wide)'}</Text>
            <Text style={{ color: c.warning, fontSize: 12, lineHeight: 28 }}>{'Line height: 28 (leading-7)'}</Text>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 7. Borders & Radius ──────────────────── */}
      <StorySection index={7} title="Borders and Radius">
        <StyleDemo properties={[{
          property: 'borderWidth + borderColor',
          ways: ways([
            ['style={}', 'borderWidth: 2, borderColor: "#3b82f6"'],
            ['tw()', 'className="border-2 border-blue-500"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <Box style={{ borderWidth: 1, borderColor: P.blue, borderRadius: 4, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9 }}>{'border'}</Text>
            </Box>
            <Box style={{ borderWidth: 2, borderColor: P.green, borderRadius: 6, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9 }}>{'border-2'}</Text>
            </Box>
            <Box style={{ borderWidth: 4, borderColor: P.rose, borderRadius: 8, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 9 }}>{'border-4'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'borderTopWidth (per-side)',
          ways: ways([
            ['style={}', 'borderTopWidth: 3, borderColor: "#ef4444"'],
            ['tw()', 'className="border-t-[3] border-red-500"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderTopWidth: 3, borderColor: P.red, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Top'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderRightWidth: 3, borderColor: P.blue, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Right'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderBottomWidth: 3, borderColor: P.green, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Bottom'}</Text>
            </Box>
            <Box style={{ width: 56, height: 56, backgroundColor: c.bg, borderLeftWidth: 3, borderColor: P.orange, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted, fontSize: 8 }}>{'Left'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'borderRadius',
          ways: ways([
            ['style={}', 'borderRadius: 8'],
            ['shorthand', 'radius={8}'],
            ['tw()', 'className="rounded-lg"  (lg=8)'],
            ['scale', 'none=0  sm=2  DEFAULT=4  md=6  lg=8  xl=12  2xl=16  full=9999'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
            {([['none', 0], ['sm', 2], ['md', 6], ['lg', 8], ['xl', 12], ['full', 9999]] as const).map(([name, r]) => (
              <Box key={name} style={{
                width: 36, height: 36, backgroundColor: P.cyan, borderRadius: r,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 7 }}>{`${name}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 8. Shadows & Opacity ─────────────────── */}
      <StorySection index={8} title="Shadows and Opacity">
        <StyleDemo properties={[{
          property: 'shadow (shadowColor + offsets + blur)',
          ways: ways([
            ['style={}', 'shadowColor: "#000", shadowOffsetY: 4, shadowBlur: 12'],
            ['tw()', 'className="shadow-lg"  (preset)'],
            ['presets', 'sm  DEFAULT  md  lg  xl  2xl  none'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', width: '100%' }}>
            {([
              ['sm', { shadowColor: 'rgba(0,0,0,0.05)', shadowOffsetY: 1, shadowBlur: 2 }],
              ['md', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 4, shadowBlur: 6 }],
              ['lg', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 10, shadowBlur: 15 }],
              ['xl', { shadowColor: 'rgba(0,0,0,0.1)', shadowOffsetY: 20, shadowBlur: 25 }],
            ] as const).map(([name, shadow]) => (
              <Box key={name} style={{
                ...shadow, shadowOffsetX: 0,
                backgroundColor: c.surface, borderRadius: 8, padding: 10,
                minWidth: 60, alignItems: 'center',
              }}>
                <Text style={{ color: c.text, fontSize: 9 }}>{`shadow-${name}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'opacity',
          ways: ways([
            ['style={}', 'opacity: 0.5'],
            ['tw()', 'className="opacity-50"  (0-100 scale)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
            {([1.0, 0.75, 0.5, 0.25, 0.1] as const).map(op => (
              <Box key={op} style={{
                flexGrow: 1, height: 40, borderRadius: 6,
                backgroundColor: P.blue, opacity: op,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 9 }}>{`${op}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 9. Transforms ─────────────────────────── */}
      <StorySection index={9} title="Transforms">
        <StyleDemo properties={[{
          property: 'transform.rotate',
          ways: ways([
            ['style={}', 'transform: { rotate: 45 }'],
            ['tw()', 'className="rotate-45"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            {[0, 15, 45, 90].map(deg => (
              <Box key={deg} style={{
                width: 40, height: 40, borderRadius: 6, backgroundColor: P.blue,
                transform: { rotate: deg }, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 8 }}>{`${deg}`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'transform.scaleX / scaleY',
          ways: ways([
            ['style={}', 'transform: { scaleX: 1.25, scaleY: 1.25 }'],
            ['tw()', 'className="scale-125"  (percent / 100)'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            {[0.5, 0.75, 1.0, 1.25].map(s => (
              <Box key={s} style={{
                width: 40, height: 40, borderRadius: 6, backgroundColor: P.green,
                transform: { scaleX: s, scaleY: s }, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 8 }}>{`${s}x`}</Text>
              </Box>
            ))}
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'transform.translateX / translateY',
          ways: ways([
            ['style={}', 'transform: { translateX: 8, translateY: -5 }'],
            ['tw()', 'className="translate-x-2 -translate-y-1"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', padding: 8, width: '100%' }}>
            <Box style={{
              width: 40, height: 40, borderRadius: 6, backgroundColor: P.red,
              transform: { translateX: 8, translateY: -5 }, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 7 }}>{'8,-5'}</Text>
            </Box>
            <Box style={{
              width: 40, height: 40, borderRadius: 6, backgroundColor: P.violet,
              transform: { rotate: 30, scaleX: 1.15, scaleY: 1.15, translateX: 4 },
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 7 }}>{'combo'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 10. Position & Overflow ───────────────── */}
      <StorySection index={10} title="Position and Overflow">
        <StyleDemo properties={[{
          property: 'position + zIndex',
          ways: ways([
            ['style={}', 'position: "absolute", top: 0, left: 30, zIndex: 3'],
            ['shorthand', 'z={3}  (zIndex only)'],
            ['tw()', 'className="absolute top-0 left-[30] z-[3]"'],
          ]),
        }]}>
          <Box style={{ width: 180, height: 100, position: 'relative' }}>
            <Box style={{
              position: 'absolute', top: 0, left: 0, width: 70, height: 70,
              borderRadius: 8, backgroundColor: P.red, zIndex: 1,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'z:1'}</Text>
            </Box>
            <Box style={{
              position: 'absolute', top: 15, left: 25, width: 70, height: 70,
              borderRadius: 8, backgroundColor: P.blue, zIndex: 3,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'z:3'}</Text>
            </Box>
            <Box style={{
              position: 'absolute', top: 30, left: 50, width: 70, height: 70,
              borderRadius: 8, backgroundColor: P.green, zIndex: 2,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{'z:2'}</Text>
            </Box>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'overflow',
          ways: ways([
            ['style={}', 'overflow: "hidden"'],
            ['shorthand', 'scroll  (overflow: scroll)'],
            ['tw()', 'className="overflow-hidden"'],
          ]),
        }]}>
          <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
            <Box style={{ width: 80, height: 60, overflow: 'hidden', borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Box style={{ width: 120, height: 80, backgroundColor: P.blue, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 8 }}>{'clipped'}</Text>
              </Box>
            </Box>
            <Box style={{ width: 80, height: 60, overflow: 'visible', borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Box style={{ width: 120, height: 80, backgroundColor: P.orange, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 8 }}>{'visible'}</Text>
              </Box>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 11. Responsive Grid ──────────────────── */}
      <StorySection index={11} title="Responsive Grid">
        <Label>{`Current breakpoint: ${useBreakpoint()}`}</Label>

        <StyleDemo properties={[{
          property: 'Col span (numeric)',
          ways: ways([
            ['numeric', '<Col span={4}>  →  4/12 = 33.3%'],
            ['semantic', '<Col span="third">  →  same result'],
            ['words', 'full  half  third  quarter  two-thirds  three-quarters'],
          ]),
        }]}>
          <Row wrap gap={6} style={{ width: '100%' }}>
            <Col span={4}><GridCell label="span={4}" color={P.indigo} /></Col>
            <Col span={4}><GridCell label="span={4}" color={P.cyan} /></Col>
            <Col span={4}><GridCell label="span={4}" color={P.rose} /></Col>
          </Row>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'Col responsive breakpoints',
          ways: ways([
            ['numeric', '<Col sm={12} md={6} lg={4}>'],
            ['semantic', '<Col sm="full" md="half" lg="third">'],
            ['auto', '<Col responsive>  →  sm=12 md=6 lg=4 xl=3'],
          ]),
        }]}>
          <Row wrap gap={6} style={{ width: '100%' }}>
            <Col responsive><GridCell label="1" color={P.indigo} h={32} /></Col>
            <Col responsive><GridCell label="2" color={P.cyan} h={32} /></Col>
            <Col responsive><GridCell label="3" color={P.rose} h={32} /></Col>
            <Col responsive><GridCell label="4" color={P.green} h={32} /></Col>
            <Col responsive><GridCell label="5" color={P.orange} h={32} /></Col>
            <Col responsive><GridCell label="6" color={P.violet} h={32} /></Col>
          </Row>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'Nested grid',
          ways: ways([
            ['pattern', '<Row><Col span={6}><Row>...</Row></Col></Row>'],
            ['note', 'Grids compose naturally inside Col children'],
          ]),
        }]}>
          <Row wrap gap={6} style={{ width: '100%' }}>
            <Col span={6}><GridCell label="Left (6)" color={P.indigo} /></Col>
            <Col span={6}>
              <Row wrap gap={4} style={{ width: '100%' }}>
                <Col span={6}><GridCell label="A" color={P.violet} h={30} /></Col>
                <Col span={6}><GridCell label="B" color={P.purple} h={30} /></Col>
              </Row>
            </Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 12. HTML Elements ────────────────────── */}
      <StorySection index={12} title="HTML Elements">
        <Label>{'Standard HTML elements remap to ReactJIT primitives automatically.'}</Label>

        <StyleDemo properties={[{
          property: 'div → View, span → Text',
          ways: ways([
            ['mapping', '<div> → View  |  <span> → Text  |  <img> → Image'],
            ['className', 'tw() parses className on all HTML elements'],
            ['style={}', 'style prop works unchanged'],
          ]),
        }]}>
          <div className="p-4 bg-gray-800 rounded-lg w-full gap-2">
            <span className="text-white text-sm">{'This is <span> inside <div>'}</span>
          </div>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'h1-h6 → Text (auto-sized, bold)',
          ways: ways([
            ['defaults', 'h1=32  h2=28  h3=24  h4=20  h5=18  h6=16'],
            ['bold', 'All headings get fontWeight: "bold" automatically'],
            ['override', 'style={{ fontSize: N }} overrides default size'],
          ]),
        }]}>
          <div className="p-3 bg-gray-800 rounded-lg w-full gap-1">
            <h1 style={{ color: '#FFFFFF' }}>{'h1 — 32px'}</h1>
            <h3 style={{ color: '#AAAAAA' }}>{'h3 — 24px'}</h3>
            <h5 style={{ color: '#666666' }}>{'h5 — 18px'}</h5>
          </div>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'button → View (onClick works)',
          ways: ways([
            ['mapping', '<button onClick={fn}> → View with click handler'],
            ['className', 'Tailwind classes work: "px-4 py-2 bg-blue-500"'],
            ['strong/b', '<strong> and <b> → Text with fontWeight: bold'],
          ]),
        }]}>
          <div className="p-3 bg-gray-800 rounded-lg w-full gap-2">
            <div className="flex-row gap-3 items-center">
              <button className="px-3 py-2 bg-blue-500 rounded-lg">
                <span className="text-white text-sm font-bold">{'<button>'}</span>
              </button>
              <strong style={{ color: '#FFFFFF' }}>{'<strong> bold'}</strong>
              <code style={{ color: '#22D3EE' }}>{'<code> mono'}</code>
            </div>
          </div>
        </StyleDemo>
      </StorySection>

      {/* ──────────────────── 13. Precedence ───────────────────────── */}
      <StorySection index={13} title="Merge Precedence">
        <Label>{'Priority: className (tw) < shorthand props < style={}'}</Label>

        <StyleDemo properties={[{
          property: 'className < shorthand',
          ways: ways([
            ['rule', 'className="p-8" + padding={4}  →  padding wins (4)'],
            ['why', 'Shorthand props override tw() classes'],
          ]),
        }]}>
          <Box className="p-8 bg-red-500 rounded-lg" padding={4} style={{ width: '100%' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{'padding=4 overrides className="p-8"'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'className < style={}',
          ways: ways([
            ['rule', 'className="bg-red-500" + style={{ bg: blue }}  →  blue wins'],
            ['why', 'style={{}} always has highest priority'],
          ]),
        }]}>
          <Box className="bg-red-500 rounded-lg p-4" style={{ backgroundColor: P.blue, width: '100%' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>{'style={{ bg: blue }} overrides className="bg-red-500"'}</Text>
          </Box>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'Equivalence proof',
          ways: ways([
            ['left', 'Tailwind classes via tw() / className'],
            ['right', 'Native style={{}} objects'],
            ['result', 'Identical visual output'],
          ]),
        }]}>
          <Row gap={8} style={{ width: '100%' }}>
            <Box className="flex-1 gap-2">
              <Box className="bg-indigo-600 rounded-lg p-3 flex-row items-center justify-between" style={{ width: '100%' }}>
                <Text style={{ ...tw('text-sm text-white font-bold') }}>{'tw()'}</Text>
                <Box className="bg-indigo-400 rounded px-2 py-1">
                  <Text style={{ color: '#fff', fontSize: 9 }}>{'badge'}</Text>
                </Box>
              </Box>
            </Box>
            <Box style={{ flexGrow: 1, gap: 8 }}>
              <Box style={{
                backgroundColor: '#4f46e5', borderRadius: 8, padding: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              }}>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{'style={}'}</Text>
                <Box style={{ backgroundColor: '#818cf8', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 9 }}>{'badge'}</Text>
                </Box>
              </Box>
            </Box>
          </Row>
        </StyleDemo>

        <StyleDemo properties={[{
          property: 'Spring transition',
          ways: ways([
            ['style={}', 'transition: { width: { duration: 600, easing: "spring" } }'],
            ['tw()', 'className="transition duration-600"  (no spring in tw)'],
            ['note', 'Spring easing is style={} only — tw supports ease-in/out/in-out'],
          ]),
        }]}>
          <Box style={{ width: '100%', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => setExpanded(v => !v)} style={{
              backgroundColor: c.primary, padding: 8, borderRadius: 6, alignItems: 'center', width: 100,
            }}>
              <Text style={{ color: '#fff', fontSize: 11 }}>{expanded ? 'Collapse' : 'Expand'}</Text>
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
              <Text style={{ color: '#fff', fontSize: 10 }}>{expanded ? 'expanded' : '80px'}</Text>
            </Box>
          </Box>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
