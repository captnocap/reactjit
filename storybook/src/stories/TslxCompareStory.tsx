/**
 * TSLX Compare — Side-by-side: TSX ElementTile (hand-written Lua) vs TSLX ElementTile (compiled Lua).
 *
 * Left panel: ElementTile from packages/chemistry (React → <Native type="ElementTile">)
 * Right panel: TslxElementTile from lua/generated (compiled from .tslx)
 *
 * Same props, same elements — lets you see the visual diff.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView, classifiers as S } from '../../../packages/core/src';
import { Native } from '../../../packages/core/src/Native';
import { useThemeColors } from '../../../packages/theme/src';
import { ElementTile } from '../../../packages/chemistry/src';

const ELEMENTS = [
  { n: 1, sym: 'H' }, { n: 6, sym: 'C' }, { n: 7, sym: 'N' },
  { n: 8, sym: 'O' }, { n: 26, sym: 'Fe' }, { n: 29, sym: 'Cu' },
  { n: 47, sym: 'Ag' }, { n: 79, sym: 'Au' }, { n: 92, sym: 'U' },
];

const SIZES = [32, 48, 64, 80];

const C = {
  accent: '#10b981',
  accentDim: 'rgba(16, 185, 129, 0.12)',
  tsx: '#3b82f6',
  tslx: '#f59e0b',
};

export function TslxCompareStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(26);
  const [tileSize, setTileSize] = useState(64);

  return (
    <S.StoryRoot>
      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, gap: 14 }}>
        <S.StoryHeaderIcon src="git-compare" tintColor={C.accent} />
        <S.StoryTitle>{'TSLX Compare'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'ElementTile'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Hand-written Lua vs compiled .tslx — same props, same elements'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Controls: element picker + size picker */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, gap: 10 }}>
        <S.StoryLabelText>{'Element'}</S.StoryLabelText>
        {ELEMENTS.map(e => (
          <Pressable key={e.n} onPress={() => setSelected(e.n)}>
            <Box style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: 4,
              backgroundColor: selected === e.n ? C.accent : c.surface,
              borderWidth: 1,
              borderColor: selected === e.n ? C.accent : c.border,
            }}>
              <Text style={{ fontSize: 10, color: selected === e.n ? '#000' : c.text }}>{e.sym}</Text>
            </Box>
          </Pressable>
        ))}

        <Box style={{ width: 1, height: 16, backgroundColor: c.border }} />

        <S.StoryLabelText>{'Size'}</S.StoryLabelText>
        {SIZES.map(s => (
          <Pressable key={s} onPress={() => setTileSize(s)}>
            <Box style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: 4,
              backgroundColor: tileSize === s ? C.accent : c.surface,
              borderWidth: 1,
              borderColor: tileSize === s ? C.accent : c.border,
            }}>
              <Text style={{ fontSize: 10, color: tileSize === s ? '#000' : c.text }}>{`${s}px`}</Text>
            </Box>
          </Pressable>
        ))}
      </S.RowCenterBorder>

      {/* Main: side by side */}
      <S.RowGrow>
        {/* Left: TSX (hand-written Lua) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.tsx }} />
            <Text style={{ color: C.tsx, fontSize: 12, fontWeight: 'bold' }}>{'TSX → <Native type="ElementTile">'}</Text>
          </Box>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'packages/chemistry → lua/capabilities/element_tile.lua'}</Text>

          {/* Single selected tile */}
          <ElementTile element={selected} selected size={tileSize} />

          {/* Row of all elements */}
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 20, paddingRight: 20 }}>
            {ELEMENTS.map(e => (
              <Pressable key={e.n} onPress={() => setSelected(e.n)}>
                <ElementTile element={e.n} selected={e.n === selected} size={32} />
              </Pressable>
            ))}
          </Box>
        </Box>

        {/* Divider */}
        <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />

        {/* Right: TSLX (compiled Lua) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.tslx }} />
            <Text style={{ color: C.tslx, fontSize: 12, fontWeight: 'bold' }}>{'TSLX → TslxElementTile'}</Text>
          </Box>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'examples/tslx-demo → lua/generated/element_tile.lua'}</Text>

          {/* Single selected tile */}
          <Native type="TslxElementTile" element={selected} selected size={tileSize} />

          {/* Row of all elements */}
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 20, paddingRight: 20 }}>
            {ELEMENTS.map(e => (
              <Pressable key={e.n} onPress={() => setSelected(e.n)}>
                <Native type="TslxElementTile" element={e.n} selected={e.n === selected} size={32} />
              </Pressable>
            ))}
          </Box>
        </Box>
      </S.RowGrow>

      {/* Footer */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Dev'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.StoryBreadcrumbActive>{'TSLX Compare'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{`Element ${selected} · ${tileSize}px tiles`}</S.StoryCap>
      </S.RowCenterBorder>
    </S.StoryRoot>
  );
}
