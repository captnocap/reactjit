/**
 * TailwindStory — Tailwind CSS compatibility layer
 *
 * Demonstrates tw() parser and className prop on Box.
 * Every section shows Tailwind classes producing identical results
 * to native ReactJIT style objects.
 */

import React from 'react';
import { Box, Row, Text, tw } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// ── Helpers ─────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ color: c.muted, fontSize: 9, width: '100%', textAlign: 'left' }}>
      {children}
    </Text>
  );
}

function Cell({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color,
      borderRadius: 6,
      padding: 8,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 36,
    }}>
      <Text style={{ color: '#fff', fontSize: 9 }}>{label}</Text>
    </Box>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function TailwindStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Tailwind'}
      </Text>
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'Tailwind CSS classes → ReactJIT Style objects. No install required.'}
      </Text>

      {/* 1. Spacing */}
      <StorySection index={1} title="Spacing">
        <Label>{'className="p-4 m-2"'}</Label>
        <Box className="p-4 m-2 bg-blue-500 rounded-lg" style={{ width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'p-4 m-2 (padding: 16, margin: 8)'}</Text>
        </Box>

        <Label>{'className="px-6 py-2"'}</Label>
        <Box className="px-6 py-2 bg-indigo-500 rounded-lg" style={{ width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'px-6 py-2 (paddingX: 24, paddingY: 8)'}</Text>
        </Box>

        <Label>{'className="p-8 gap-4 flex-col"'}</Label>
        <Box className="p-8 gap-4 flex-col bg-violet-600 rounded-lg" style={{ width: '100%' }}>
          <Box className="p-2 bg-violet-400 rounded">
            <Text style={{ color: '#fff', fontSize: 10 }}>{'Child A'}</Text>
          </Box>
          <Box className="p-2 bg-violet-400 rounded">
            <Text style={{ color: '#fff', fontSize: 10 }}>{'Child B'}</Text>
          </Box>
        </Box>
      </StorySection>

      {/* 2. Flex Layouts */}
      <StorySection index={2} title="Flex Layouts">
        <Label>{'className="flex-row gap-2 items-center justify-between"'}</Label>
        <Box className="flex-row gap-2 items-center justify-between p-3 bg-slate-800 rounded-lg" style={{ width: '100%' }}>
          <Box className="p-2 bg-blue-500 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'A'}</Text></Box>
          <Box className="p-2 bg-blue-500 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'B'}</Text></Box>
          <Box className="p-2 bg-blue-500 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'C'}</Text></Box>
        </Box>

        <Label>{'className="flex-row flex-wrap gap-2"'}</Label>
        <Box className="flex-row flex-wrap gap-2 p-3 bg-slate-800 rounded-lg" style={{ width: '100%' }}>
          <Box className="p-2 bg-emerald-500 rounded" style={{ width: '30%' }}>
            <Text style={{ color: '#fff', fontSize: 9 }}>{'30%'}</Text>
          </Box>
          <Box className="p-2 bg-emerald-500 rounded" style={{ width: '30%' }}>
            <Text style={{ color: '#fff', fontSize: 9 }}>{'30%'}</Text>
          </Box>
          <Box className="p-2 bg-emerald-500 rounded" style={{ width: '30%' }}>
            <Text style={{ color: '#fff', fontSize: 9 }}>{'30%'}</Text>
          </Box>
          <Box className="p-2 bg-emerald-500 rounded" style={{ width: '30%' }}>
            <Text style={{ color: '#fff', fontSize: 9 }}>{'wraps!'}</Text>
          </Box>
        </Box>

        <Label>{'flex-1 vs flex-none'}</Label>
        <Box className="flex-row gap-2 p-3 bg-slate-800 rounded-lg" style={{ width: '100%' }}>
          <Box className="flex-none p-2 bg-amber-500 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'fixed'}</Text></Box>
          <Box className="flex-1 p-2 bg-amber-600 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'flex-1 (grows)'}</Text></Box>
          <Box className="flex-none p-2 bg-amber-500 rounded"><Text style={{ color: '#fff', fontSize: 9 }}>{'fixed'}</Text></Box>
        </Box>
      </StorySection>

      {/* 3. Colors */}
      <StorySection index={3} title="Color Palette">
        <Label>{'Full Tailwind 3 palette — 22 families x 11 shades'}</Label>
        {(['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'] as const).map(color => (
          <Box key={color} className="flex-row gap-1" style={{ width: '100%' }}>
            {(['300', '500', '700', '900'] as const).map(shade => (
              <Box key={shade} style={{
                ...tw(`bg-${color}-${shade} rounded`),
                flexGrow: 1, height: 16, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 7 }}>{`${color[0]}${shade}`}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </StorySection>

      {/* 4. Typography */}
      <StorySection index={4} title="Typography">
        <Label>{'text-xs through text-4xl'}</Label>
        <Box className="gap-1" style={{ width: '100%' }}>
          <Text style={{ ...tw('text-xs text-slate-300') }}>{'text-xs (12px)'}</Text>
          <Text style={{ ...tw('text-sm text-slate-300') }}>{'text-sm (14px)'}</Text>
          <Text style={{ ...tw('text-base text-slate-300') }}>{'text-base (16px)'}</Text>
          <Text style={{ ...tw('text-lg text-slate-300') }}>{'text-lg (18px)'}</Text>
          <Text style={{ ...tw('text-xl text-slate-300') }}>{'text-xl (20px)'}</Text>
          <Text style={{ ...tw('text-2xl text-slate-300') }}>{'text-2xl (24px)'}</Text>
        </Box>

        <Label>{'font-normal, font-bold, font-black'}</Label>
        <Box className="gap-1" style={{ width: '100%' }}>
          <Text style={{ ...tw('text-base text-slate-300 font-normal') }}>{'font-normal'}</Text>
          <Text style={{ ...tw('text-base text-slate-300 font-bold') }}>{'font-bold'}</Text>
          <Text style={{ ...tw('text-base text-slate-300 font-black') }}>{'font-black (900)'}</Text>
        </Box>

        <Label>{'underline, line-through'}</Label>
        <Box className="flex-row gap-4" style={{ width: '100%' }}>
          <Text style={{ ...tw('text-sm text-slate-300 underline') }}>{'underline'}</Text>
          <Text style={{ ...tw('text-sm text-slate-300 line-through') }}>{'line-through'}</Text>
        </Box>
      </StorySection>

      {/* 5. Borders & Radius */}
      <StorySection index={5} title="Borders and Radius">
        <Label>{'border, border-2, border-4 with colors'}</Label>
        <Box className="flex-row gap-3" style={{ width: '100%' }}>
          <Box className="border border-blue-500 rounded p-3">
            <Text style={{ color: c.text, fontSize: 9 }}>{'border'}</Text>
          </Box>
          <Box className="border-2 border-emerald-500 rounded-md p-3">
            <Text style={{ color: c.text, fontSize: 9 }}>{'border-2'}</Text>
          </Box>
          <Box className="border-4 border-rose-500 rounded-lg p-3">
            <Text style={{ color: c.text, fontSize: 9 }}>{'border-4'}</Text>
          </Box>
        </Box>

        <Label>{'rounded-none through rounded-full'}</Label>
        <Box className="flex-row gap-3 items-center" style={{ width: '100%' }}>
          {(['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'] as const).map(r => (
            <Box key={r} style={{
              ...tw(`bg-sky-500 rounded-${r}`),
              width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 7 }}>{r}</Text>
            </Box>
          ))}
        </Box>
      </StorySection>

      {/* 6. Shadows & Opacity */}
      <StorySection index={6} title="Shadows and Opacity">
        <Label>{'shadow-sm through shadow-2xl'}</Label>
        <Box className="flex-row gap-3 flex-wrap" style={{ width: '100%' }}>
          {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map(s => (
            <Box key={s} style={{
              ...tw(`shadow-${s} bg-slate-700 rounded-lg p-3`),
              minWidth: 60, alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{`shadow-${s}`}</Text>
            </Box>
          ))}
        </Box>

        <Label>{'opacity-25, opacity-50, opacity-75, opacity-100'}</Label>
        <Box className="flex-row gap-3" style={{ width: '100%' }}>
          {([25, 50, 75, 100] as const).map(o => (
            <Box key={o} style={{
              ...tw(`opacity-${o} bg-blue-500 rounded-lg p-3`),
              flexGrow: 1, alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 9 }}>{`${o}%`}</Text>
            </Box>
          ))}
        </Box>
      </StorySection>

      {/* 7. Transforms */}
      <StorySection index={7} title="Transforms">
        <Label>{'rotate-12, rotate-45, rotate-90'}</Label>
        <Box className="flex-row gap-6 items-center justify-center p-4" style={{ width: '100%' }}>
          <Box style={{ ...tw('bg-purple-500 rounded rotate-12'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'12'}</Text>
          </Box>
          <Box style={{ ...tw('bg-purple-500 rounded rotate-45'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'45'}</Text>
          </Box>
          <Box style={{ ...tw('bg-purple-500 rounded rotate-90'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'90'}</Text>
          </Box>
        </Box>

        <Label>{'scale-75, scale-100, scale-125'}</Label>
        <Box className="flex-row gap-6 items-center justify-center p-4" style={{ width: '100%' }}>
          <Box style={{ ...tw('bg-teal-500 rounded scale-75'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'75'}</Text>
          </Box>
          <Box style={{ ...tw('bg-teal-500 rounded scale-100'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'100'}</Text>
          </Box>
          <Box style={{ ...tw('bg-teal-500 rounded scale-125'), width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 8 }}>{'125'}</Text>
          </Box>
        </Box>
      </StorySection>

      {/* 8. Gradients */}
      <StorySection index={8} title="Gradients">
        <Label>{'bg-gradient-to-r from-blue-500 to-purple-500'}</Label>
        <Box style={{ ...tw('bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-4'), width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'Horizontal gradient'}</Text>
        </Box>

        <Label>{'bg-gradient-to-b from-emerald-400 to-cyan-500'}</Label>
        <Box style={{ ...tw('bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-lg p-4'), width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'Vertical gradient'}</Text>
        </Box>

        <Label>{'bg-gradient-to-br from-rose-500 to-amber-500'}</Label>
        <Box style={{ ...tw('bg-gradient-to-br from-rose-500 to-amber-500 rounded-lg p-4'), width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'Diagonal gradient'}</Text>
        </Box>
      </StorySection>

      {/* 9. className + style merge precedence */}
      <StorySection index={9} title="Merge Precedence">
        <Label>{'className="p-8 bg-red-500" padding={4} → padding is 4 (shorthand wins)'}</Label>
        <Box className="p-8 bg-red-500 rounded-lg" padding={4} style={{ width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'padding=4 overrides p-8'}</Text>
        </Box>

        <Label>{'className="bg-red-500" style={{ backgroundColor: "#3b82f6" }} → blue wins'}</Label>
        <Box className="bg-red-500 rounded-lg p-4" style={{ backgroundColor: '#3b82f6', width: '100%' }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{'style={{ bg: blue }} overrides bg-red-500'}</Text>
        </Box>
      </StorySection>

      {/* 10. Equivalence Proof */}
      <StorySection index={10} title="Equivalence Proof">
        <Label>{'Tailwind classes (left) vs native style (right) — identical output'}</Label>
        <Row gap={8} style={{ width: '100%' }}>
          {/* Tailwind side */}
          <Box className="flex-1 gap-2">
            <Box className="bg-indigo-600 rounded-lg p-3 flex-row items-center justify-between" style={{ width: '100%' }}>
              <Text style={{ ...tw('text-sm text-white font-bold') }}>{'tw()'}</Text>
              <Box className="bg-indigo-400 rounded px-2 py-1">
                <Text style={{ color: '#fff', fontSize: 9 }}>{'badge'}</Text>
              </Box>
            </Box>
            <Box className="bg-slate-700 rounded-lg p-3 border border-slate-500" style={{ width: '100%' }}>
              <Text style={{ ...tw('text-xs text-slate-300') }}>{'Card body with Tailwind classes'}</Text>
            </Box>
          </Box>
          {/* Native side */}
          <Box style={{ flexGrow: 1, gap: 8 }}>
            <Box style={{
              backgroundColor: '#4f46e5', borderRadius: 8, padding: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            }}>
              <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{'style={{}}'}</Text>
              <Box style={{ backgroundColor: '#818cf8', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                <Text style={{ color: '#fff', fontSize: 9 }}>{'badge'}</Text>
              </Box>
            </Box>
            <Box style={{
              backgroundColor: '#334155', borderRadius: 8, padding: 12,
              borderWidth: 1, borderColor: '#64748b', width: '100%',
            }}>
              <Text style={{ fontSize: 12, color: '#cbd5e1' }}>{'Card body with native style'}</Text>
            </Box>
          </Box>
        </Row>
      </StorySection>
    </StoryPage>
  );
}
