/**
 * TSLX Compare — Three-way comparison of the same ElementTile:
 *
 * 1. Hand-written Lua: Tree.declareChildren with Box/Text nodes in manual Lua
 * 2. Pure React TSX:   Box/Text/Pressable composed directly in React
 * 3. Compiled TSLX:    .tslx compiled to Lua Tree.declareChildren
 *
 * Same props, same elements — see the visual diff across all three approaches.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, classifiers as S } from '../../../packages/core/src';
import { Native } from '../../../packages/core/src/Native';
import { useThemeColors } from '../../../packages/theme/src';
import { getElement } from '../../../packages/chemistry/src/elements';

const SAMPLE_ELEMENTS = [
  { n: 1, sym: 'H' }, { n: 6, sym: 'C' }, { n: 7, sym: 'N' },
  { n: 8, sym: 'O' }, { n: 26, sym: 'Fe' }, { n: 29, sym: 'Cu' },
  { n: 47, sym: 'Ag' }, { n: 79, sym: 'Au' }, { n: 92, sym: 'U' },
];

const SIZES = [32, 48, 64, 80];

const C = {
  accent: '#10b981',
  accentDim: 'rgba(16, 185, 129, 0.12)',
  lua: '#3b82f6',
  react: '#a855f7',
  tslx: '#f59e0b',
};

const CATEGORY_COLORS: Record<string, string> = {
  'alkali-metal': '#7b6faa',
  'alkaline-earth': '#9a9cc4',
  'transition-metal': '#de9a9a',
  'post-transition-metal': '#8fbc8f',
  'metalloid': '#c8c864',
  'nonmetal': '#59b5e6',
  'halogen': '#d4a844',
  'noble-gas': '#c87e4a',
  'lanthanide': '#c45879',
  'actinide': '#d4879a',
};

/** Pure React ElementTile — Box + Text, no <Native>, no Lua capability */
function ReactElementTile({ element, selected, size }: { element: number; selected?: boolean; size: number }) {
  const el = getElement(element);
  if (!el) return null;
  const bg = CATEGORY_COLORS[el.category] || '#868e96';
  const s = size / 64;
  const numFont = Math.max(7, Math.round(10 * s));
  const symFont = Math.max(10, Math.round(16 * s));
  const massFont = Math.max(7, Math.round(9 * s));
  const pad = Math.max(1, Math.round(2 * s));
  const massStr = el.mass.toFixed(2);

  return (
    <Box style={{ width: size, height: size * 36 / 32 }}>
      <Box style={{
        flexGrow: 1,
        borderRadius: 3,
        backgroundColor: '#2a2a3a',
        borderWidth: selected ? 2 : 1,
        borderColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: pad,
        paddingBottom: pad,
        gap: 0,
        overflow: 'hidden',
      }}>
        <Text style={{ color: bg, fontSize: numFont }}>{`${el.number}`}</Text>
        <Text style={{ color: '#ffffff', fontSize: symFont }}>{el.symbol}</Text>
        <Text style={{ color: '#999999', fontSize: massFont }}>{massStr}</Text>
      </Box>
    </Box>
  );
}

function ColumnHeader({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color, fontSize: 11, fontWeight: 'bold' }}>{label}</Text>
      </Box>
      <Text style={{ color: '#666', fontSize: 8 }}>{desc}</Text>
    </>
  );
}

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
        <S.StoryMuted>{'Three approaches — same component, same props'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Controls */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8, gap: 10 }}>
        <S.StoryLabelText>{'Element'}</S.StoryLabelText>
        {SAMPLE_ELEMENTS.map(e => (
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

      {/* Three columns */}
      <S.RowGrow>
        {/* 1: Hand-written Lua (Tree.declareChildren) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <ColumnHeader color={C.lua} label={'Hand-written Lua'} desc={'Tree.declareChildren — manual Lua code'} />
          <Native type="HandLuaElementTile" element={selected} selected size={tileSize} />
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 12, paddingRight: 12 }}>
            {SAMPLE_ELEMENTS.map(e => (
              <Pressable key={e.n} onPress={() => setSelected(e.n)}>
                <Native type="HandLuaElementTile" element={e.n} selected={e.n === selected} size={32} />
              </Pressable>
            ))}
          </Box>
        </Box>

        <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />

        {/* 2: Pure React TSX (Box + Text) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <ColumnHeader color={C.react} label={'Pure React TSX'} desc={'Box + Text composed in React — no Lua'} />
          <ReactElementTile element={selected} selected size={tileSize} />
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 12, paddingRight: 12 }}>
            {SAMPLE_ELEMENTS.map(e => (
              <Pressable key={e.n} onPress={() => setSelected(e.n)}>
                <ReactElementTile element={e.n} selected={e.n === selected} size={32} />
              </Pressable>
            ))}
          </Box>
        </Box>

        <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />

        {/* 3: Compiled TSLX (Box + Text via Lua Tree) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <ColumnHeader color={C.tslx} label={'Compiled TSLX'} desc={'.tslx → lua/generated/element_tile.lua'} />
          <Native type="TslxElementTile" element={selected} selected size={tileSize} />
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center', paddingLeft: 12, paddingRight: 12 }}>
            {SAMPLE_ELEMENTS.map(e => (
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
