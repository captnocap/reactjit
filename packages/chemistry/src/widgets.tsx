import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView, useSpring } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { ELEMENTS, getElement } from './elements';
import { valenceElectrons } from './utils';
import { useMolecule, useReaction } from './hooks';
import type {
  Element, PeriodicTableProps, ElementTileProps, ElementDetailProps, ElementCardProps, MoleculeCardProps,
  ElectronShellProps, ReactionViewProps,
} from './types';
import type { Style } from '@reactjit/core';

// -- Category colors ----------------------------------------------------------

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

const PHASE_COLORS: Record<string, string> = {
  solid: '#69db7c',
  liquid: '#4dabf7',
  gas: '#ffd43b',
  unknown: '#868e96',
};

function categoryColor(el: Element, colorBy: PeriodicTableProps['colorBy']): string {
  if (colorBy === 'phase') return PHASE_COLORS[el.phase] ?? '#868e96';
  if (colorBy === 'electronegativity') {
    if (el.electronegativity === null) return '#868e96';
    const t = el.electronegativity / 4.0;
    const r = Math.round(255 * t);
    const b = Math.round(255 * (1 - t));
    return `rgb(${r}, 80, ${b})`;
  }
  if (colorBy === 'density') {
    if (el.density === null) return '#868e96';
    const t = Math.min(el.density / 23, 1);
    const r = Math.round(255 * t);
    return `rgb(${r}, ${Math.round(100 * (1 - t))}, ${Math.round(200 * (1 - t))})`;
  }
  return CATEGORY_COLORS[el.category] ?? '#868e96';
}

// -- Periodic Table -----------------------------------------------------------

// Standard periodic table layout: [period][column] -> atomic number
// Gaps are 0 (empty cell). Lanthanides/actinides in rows 8-9.
const TABLE_LAYOUT: number[][] = [
  [1, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 2],
  [3, 4, 0,0,0,0,0,0,0,0,0,0, 5, 6, 7, 8, 9, 10],
  [11,12, 0,0,0,0,0,0,0,0,0,0, 13,14,15,16,17,18],
  [19,20, 21,22,23,24,25,26,27,28,29,30, 31,32,33,34,35,36],
  [37,38, 39,40,41,42,43,44,45,46,47,48, 49,50,51,52,53,54],
  [55,56, 0, 72,73,74,75,76,77,78,79,80, 81,82,83,84,85,86],
  [87,88, 0, 104,105,106,107,108,109,110,111,112, 113,114,115,116,117,118],
  [0, 0, 57,58,59,60,61,62,63,64,65,66,67,68,69,70,71, 0],
  [0, 0, 89,90,91,92,93,94,95,96,97,98,99,100,101,102,103, 0],
];

const TABLE_COLUMNS = 18;
const TILE_HEIGHT_RATIO = 36 / 32;

// Precompute occupied cells so placement is purely geometric and does not depend
// on flex row sizing or shrink behavior.
const TABLE_CELLS = TABLE_LAYOUT.flatMap((row, rowIndex) => (
  row.flatMap((atomicNumber, columnIndex) => (
    atomicNumber === 0
      ? []
      : [{ atomicNumber, rowIndex, columnIndex }]
  ))
));

export function PeriodicTable({
  onSelect,
  selected,
  tileSize = 40,
  style,
}: PeriodicTableProps) {
  const tileWidth = tileSize;
  const tileHeight = tileWidth * TILE_HEIGHT_RATIO;
  const gap = Math.max(1, Math.round(tileWidth / 20));
  const tableWidth = TABLE_COLUMNS * tileWidth + (TABLE_COLUMNS - 1) * gap;
  const tableHeight = TABLE_LAYOUT.length * tileHeight + (TABLE_LAYOUT.length - 1) * gap;

  return (
    <Box style={{
      ...style,
      width: tableWidth,
      height: tableHeight,
      position: 'relative',
      flexShrink: 0,
    }}>
      {TABLE_CELLS.map(({ atomicNumber, rowIndex, columnIndex }) => (
        <Box
          key={atomicNumber}
          style={{
            position: 'absolute',
            left: columnIndex * (tileWidth + gap),
            top: rowIndex * (tileHeight + gap),
            width: tileWidth,
            height: tileHeight,
          }}
        >
          <ElementTile
            element={atomicNumber}
            size={tileSize}
            selected={selected === atomicNumber}
            onPress={onSelect}
          />
        </Box>
      ))}
    </Box>
  );
}

// -- Element Tile (compact periodic table cell, click to flip) ----------------

export function ElementTile({ element, selected, flipped: controlledFlip, size = 64, style, onPress }: ElementTileProps) {
  const c = useThemeColors();
  const el = typeof element === 'string' ? getElement(element) : getElement(element);
  if (!el) return null;

  const [internalFlip, setInternalFlip] = useState(false);
  const isFlipped = controlledFlip ?? internalFlip;
  const prog = useSpring(isFlipped ? 1 : 0, { stiffness: 200, damping: 18 });
  const scaleX = Math.abs(Math.cos(prog * Math.PI));
  const showBack = prog > 0.5;

  const bg = categoryColor(el, 'category');
  const s = size / 32;
  const h = size * TILE_HEIGHT_RATIO;
  const tiny = Math.max(2.5 * s, 6);

  const handlePress = () => {
    if (controlledFlip === undefined) setInternalFlip(f => !f);
    onPress?.(el);
  };

  return (
    <Pressable onPress={handlePress}>
      <Box style={{
        width: size,
        height: h,
        backgroundColor: showBack ? bg : c.surface,
        borderRadius: 3 * s,
        borderWidth: 1,
        borderColor: bg,
        padding: 2 * s,
        justifyContent: 'center',
        alignItems: 'center',
        transform: { scaleX: Math.max(0.01, scaleX) },
        ...style,
      }}>
        {showBack ? (
          <Box style={{ gap: 1, alignItems: 'center', width: '100%' }}>
            <Text style={{ color: '#000', fontSize: 3 * s, fontWeight: 'bold' }}>{el.symbol}</Text>
            <TileProp label="Grp" value={`${el.group}`} s={s} tiny={tiny} />
            <TileProp label="Per" value={`${el.period}`} s={s} tiny={tiny} />
            <TileProp label="Phase" value={el.phase} s={s} tiny={tiny} />
            {el.electronegativity !== null && (
              <TileProp label="EN" value={`${el.electronegativity}`} s={s} tiny={tiny} />
            )}
            <TileProp label="Mass" value={el.mass.toFixed(1)} s={s} tiny={tiny} />
          </Box>
        ) : (
          <Box style={{ gap: 1 * s, alignItems: 'center' }}>
            <Text style={{ color: bg, fontSize: 3 * s }}>{`${el.number}`}</Text>
            <Text style={{ color: c.text, fontSize: 8 * s, fontWeight: 'bold' }}>{el.symbol}</Text>
            <Text style={{ color: c.muted, fontSize: 3 * s }}>{el.mass.toFixed(2)}</Text>
          </Box>
        )}
      </Box>
    </Pressable>
  );
}

function TileProp({ label, value, s, tiny }: { label: string; value: string; s: number; tiny: number }) {
  return (
    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
      <Text style={{ color: 'rgba(0,0,0,0.5)', fontSize: tiny }}>{label}</Text>
      <Text style={{ color: '#000', fontSize: tiny }}>{value}</Text>
    </Box>
  );
}

// -- Element Card (full detail) -----------------------------------------------

export function ElementDetail({ element, style }: ElementDetailProps) {
  const c = useThemeColors();
  const el = typeof element === 'string' ? getElement(element) : getElement(element);
  if (!el) return <Box style={style}><Text style={{ color: c.muted }}>{'Unknown element'}</Text></Box>;

  const bg = categoryColor(el, 'category');
  const valence = valenceElectrons(el.number);

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      padding: 12,
      gap: 6,
      ...style,
    }}>
      <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Box style={{
          width: 56,
          height: 56,
          backgroundColor: bg,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 8, color: '#000', opacity: 0.6 }}>{`${el.number}`}</Text>
          <Text style={{ fontSize: 22, color: '#000', fontWeight: 'bold' }}>{el.symbol}</Text>
        </Box>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 16, color: c.text, fontWeight: 'bold' }}>{el.name}</Text>
          <Text style={{ fontSize: 11, color: c.muted }}>{`${el.mass} u`}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{el.category.replace(/-/g, ' ')}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
        <InfoChip label="Group" value={`${el.group}`} c={c} />
        <InfoChip label="Period" value={`${el.period}`} c={c} />
        <InfoChip label="Phase" value={el.phase} c={c} />
        <InfoChip label="Valence e-" value={`${valence}`} c={c} />
        {el.electronegativity !== null && (
          <InfoChip label="EN" value={`${el.electronegativity}`} c={c} />
        )}
        {el.meltingPoint !== null && (
          <InfoChip label="MP" value={`${el.meltingPoint} K`} c={c} />
        )}
        {el.boilingPoint !== null && (
          <InfoChip label="BP" value={`${el.boilingPoint} K`} c={c} />
        )}
        {el.density !== null && (
          <InfoChip label="Density" value={`${el.density} g/cm3`} c={c} />
        )}
      </Box>

      <Text style={{ fontSize: 10, color: c.muted, paddingTop: 2 }}>
        {el.electronConfig}
      </Text>
    </Box>
  );
}

function InfoChip({ label, value, c }: { label: string; value: string; c: any }) {
  return (
    <Box style={{
      backgroundColor: c.surface,
      borderRadius: 4,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
    }}>
      <Text style={{ fontSize: 8, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: 11, color: c.text }}>{value}</Text>
    </Box>
  );
}

// -- Element Card (full property view — everything at a glance) ---------------

function CardRow({ label, value, c, color }: { label: string; value: string; c: any; color?: string }) {
  return (
    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: c.muted }}>{label}</Text>
      <Text style={{ fontSize: 10, color: color ?? c.text }}>{value}</Text>
    </Box>
  );
}

export function ElementCard({ element, style }: ElementCardProps) {
  const c = useThemeColors();
  const el = typeof element === 'string' ? getElement(element) : getElement(element);
  if (!el) return <Box style={style}><Text style={{ color: c.muted }}>{'Unknown element'}</Text></Box>;

  const bg = categoryColor(el, 'category');
  const valence = valenceElectrons(el.number);

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: bg,
      padding: 12,
      gap: 2,
      ...style,
    }}>
      {/* Header: symbol badge + name */}
      <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingBottom: 4 }}>
        <Box style={{
          width: 44,
          height: 44,
          backgroundColor: bg,
          borderRadius: 6,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 6, color: '#000', opacity: 0.6 }}>{`${el.number}`}</Text>
          <Text style={{ fontSize: 20, color: '#000', fontWeight: 'bold' }}>{el.symbol}</Text>
        </Box>
        <Box style={{ gap: 1 }}>
          <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>{el.name}</Text>
          <Text style={{ fontSize: 9, color: c.muted }}>{el.category.replace(/-/g, ' ')}</Text>
        </Box>
      </Box>

      {/* Properties — every row follows the same label : value pattern */}
      <CardRow label="Atomic Mass" value={`${el.mass} u`} c={c} />
      <CardRow label="Group" value={`${el.group}`} c={c} />
      <CardRow label="Period" value={`${el.period}`} c={c} />
      <CardRow label="Phase" value={el.phase} c={c} color={PHASE_COLORS[el.phase]} />
      <CardRow label="Valence Electrons" value={`${valence}`} c={c} />
      <CardRow label="Electronegativity" value={el.electronegativity !== null ? `${el.electronegativity}` : '—'} c={c} />
      <CardRow label="Melting Point" value={el.meltingPoint !== null ? `${el.meltingPoint} K` : '—'} c={c} />
      <CardRow label="Boiling Point" value={el.boilingPoint !== null ? `${el.boilingPoint} K` : '—'} c={c} />
      <CardRow label="Density" value={el.density !== null ? `${el.density} g/cm\u00B3` : '—'} c={c} />
      <CardRow label="Electron Config" value={el.electronConfig} c={c} />
    </Box>
  );
}

// -- Molecule Card ------------------------------------------------------------

export function MoleculeCard({ formula, showBonds = false, style }: MoleculeCardProps) {
  const c = useThemeColors();
  const mol = useMolecule(formula);
  const composition = useMemo(() => {
    if (!mol || mol.molarMass === 0) return {};
    const result: Record<string, number> = {};
    for (const a of mol.atoms) {
      const el = getElement(a.symbol);
      if (el) result[a.symbol] = Math.round((el.mass * a.count / mol.molarMass) * 10000) / 100;
    }
    return result;
  }, [mol]);

  if (!mol) {
    return (
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, ...style }}>
        <Text style={{ color: c.muted }}>{'Loading...'}</Text>
      </Box>
    );
  }

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      padding: 12,
      gap: 8,
      ...style,
    }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 20, color: c.text, fontWeight: 'bold' }}>{mol.formula}</Text>
        {mol.name && (
          <Text style={{ fontSize: 13, color: c.muted }}>{mol.name}</Text>
        )}
      </Box>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <InfoChip label="Molar Mass" value={`${mol.molarMass} g/mol`} c={c} />
        {mol.geometry && <InfoChip label="Geometry" value={mol.geometry} c={c} />}
        {mol.polarity && <InfoChip label="Polarity" value={mol.polarity} c={c} />}
        <InfoChip label="Atoms" value={`${mol.atoms.reduce((s, a) => s + a.count, 0)}`} c={c} />
      </Box>

      {/* Atom composition */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 10, color: c.muted }}>{'Composition by mass'}</Text>
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(composition).map(([sym, pct]) => {
            const el = getElement(sym);
            return (
              <Box key={sym} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                <Box style={{
                  width: 12,
                  height: 12,
                  backgroundColor: el?.cpkColor ?? '#888',
                  borderRadius: 6,
                }} />
                <Text style={{ fontSize: 10, color: c.text }}>{`${sym} ${pct}%`}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {mol.iupac && (
        <Text style={{ fontSize: 9, color: c.muted }}>{`IUPAC: ${mol.iupac}`}</Text>
      )}
    </Box>
  );
}

// -- Electron Shell -----------------------------------------------------------

export function ElectronShell({ element, animated = false, style }: ElectronShellProps) {
  const c = useThemeColors();
  const el = typeof element === 'string' ? getElement(element) : getElement(element);
  if (!el) return <Box style={style}><Text style={{ color: c.muted }}>{'Unknown element'}</Text></Box>;

  const maxShell = el.shells.length;
  const ringSpacing = 18;
  const centerSize = 32;
  const totalSize = centerSize + maxShell * ringSpacing * 2 + 16;

  return (
    <Box style={{
      width: totalSize,
      height: totalSize,
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}>
      {/* Nucleus */}
      <Box style={{
        position: 'absolute',
        width: centerSize,
        height: centerSize,
        borderRadius: centerSize / 2,
        backgroundColor: el.cpkColor,
        alignItems: 'center',
        justifyContent: 'center',
        left: (totalSize - centerSize) / 2,
        top: (totalSize - centerSize) / 2,
      }}>
        <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{el.symbol}</Text>
      </Box>

      {/* Shells (rings) */}
      {el.shells.map((electrons, i) => {
        const radius = (i + 1) * ringSpacing + centerSize / 2;
        const diameter = radius * 2;
        return (
          <Box key={i} style={{
            position: 'absolute',
            width: diameter,
            height: diameter,
            borderRadius: radius,
            borderWidth: 1,
            borderColor: c.border,
            left: (totalSize - diameter) / 2,
            top: (totalSize - diameter) / 2,
          }}>
            {/* Electron count label */}
            <Box style={{
              position: 'absolute',
              left: diameter / 2 - 8,
              top: -6,
            }}>
              <Text style={{ fontSize: 9, color: c.primary, fontWeight: 'bold' }}>
                {`${electrons}`}
              </Text>
            </Box>

            {/* Electron dots */}
            {Array.from({ length: electrons }, (_, j) => {
              const angle = (j / electrons) * Math.PI * 2 - Math.PI / 2;
              const dotX = radius + Math.cos(angle) * radius - 3;
              const dotY = radius + Math.sin(angle) * radius - 3;
              return (
                <Box key={j} style={{
                  position: 'absolute',
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: c.primary,
                  left: dotX,
                  top: dotY,
                }} />
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}

// -- Reaction View ------------------------------------------------------------

export function ReactionView({ equation, animated = false, showEnergy = true, style }: ReactionViewProps) {
  const c = useThemeColors();
  const reaction = useReaction(equation);

  if (!reaction) {
    return (
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, ...style }}>
        <Text style={{ color: c.muted }}>{'Balancing...'}</Text>
      </Box>
    );
  }

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      padding: 12,
      gap: 8,
      ...style,
    }}>
      {/* Balanced equation */}
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {reaction.reactants.map((r, i) => (
          <React.Fragment key={`r${i}`}>
            {i > 0 && <Text style={{ fontSize: 16, color: c.muted }}>{'+'}</Text>}
            <FormulaDisplay coefficient={r.coefficient} formula={r.formula} c={c} />
          </React.Fragment>
        ))}
        <Text style={{ fontSize: 16, color: c.primary, fontWeight: 'bold' }}>
          {'\u2192'}
        </Text>
        {reaction.products.map((p, i) => (
          <React.Fragment key={`p${i}`}>
            {i > 0 && <Text style={{ fontSize: 16, color: c.muted }}>{'+'}</Text>}
            <FormulaDisplay coefficient={p.coefficient} formula={p.formula} c={c} />
          </React.Fragment>
        ))}
      </Box>

      {/* Metadata row */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Box style={{
          backgroundColor: reaction.isBalanced ? '#2b8a3e22' : '#e0383822',
          borderRadius: 4,
          paddingTop: 2,
          paddingBottom: 2,
          paddingLeft: 6,
          paddingRight: 6,
        }}>
          <Text style={{ fontSize: 10, color: reaction.isBalanced ? '#2b8a3e' : '#e03838' }}>
            {reaction.isBalanced ? 'Balanced' : 'Unbalanced'}
          </Text>
        </Box>
        {reaction.type && (
          <InfoChip label="Type" value={reaction.type} c={c} />
        )}
        {showEnergy && reaction.enthalpy !== undefined && (
          <Box style={{
            backgroundColor: reaction.enthalpy < 0 ? '#1864ab22' : '#c9210022',
            borderRadius: 4,
            paddingTop: 2,
            paddingBottom: 2,
            paddingLeft: 6,
            paddingRight: 6,
          }}>
            <Text style={{ fontSize: 8, color: c.muted }}>
              {reaction.enthalpy < 0 ? 'Exothermic' : 'Endothermic'}
            </Text>
            <Text style={{ fontSize: 11, color: c.text }}>
              {`\u0394H = ${reaction.enthalpy} kJ/mol`}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function FormulaDisplay({ coefficient, formula, c }: { coefficient: number; formula: string; c: any }) {
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      {coefficient > 1 && (
        <Text style={{ fontSize: 14, color: c.primary, fontWeight: 'bold' }}>
          {`${coefficient}`}
        </Text>
      )}
      <Text style={{ fontSize: 16, color: c.text }}>{formula}</Text>
    </Box>
  );
}
