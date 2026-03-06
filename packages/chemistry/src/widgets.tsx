import React, { useMemo } from 'react';
import { Box, Text, Pressable, ScrollView } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { ELEMENTS, getElement } from './elements';
import { valenceElectrons } from './utils';
import { useMolecule, useReaction } from './hooks';
import type {
  Element, PeriodicTableProps, ElementCardProps, MoleculeCardProps,
  ElectronShellProps, ReactionViewProps,
} from './types';
import type { Style } from '@reactjit/core';

// -- Category colors ----------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  'alkali-metal': '#ff6b6b',
  'alkaline-earth': '#ffa94d',
  'transition-metal': '#ffd43b',
  'post-transition-metal': '#69db7c',
  'metalloid': '#38d9a9',
  'nonmetal': '#4dabf7',
  'halogen': '#748ffc',
  'noble-gas': '#cc5de8',
  'lanthanide': '#f06595',
  'actinide': '#e599f7',
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

function ElementCell({ el, isHighlighted, isSelected, colorBy, onPress, compact }: {
  el: Element;
  isHighlighted: boolean;
  isSelected: boolean;
  colorBy: PeriodicTableProps['colorBy'];
  onPress?: (el: Element) => void;
  compact?: boolean;
}) {
  const c = useThemeColors();
  const bg = categoryColor(el, colorBy);
  const opacity = isHighlighted ? 1.0 : 0.3;
  const cellSize = compact ? 28 : 40;

  return (
    <Pressable
      onPress={() => onPress?.(el)}
      style={{
        width: cellSize,
        height: cellSize,
        backgroundColor: bg,
        opacity,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: isSelected ? 2 : 0,
        borderColor: c.text,
      }}
    >
      {!compact && (
        <Text style={{ fontSize: 7, color: '#000', opacity: 0.6 }}>
          {`${el.number}`}
        </Text>
      )}
      <Text style={{ fontSize: compact ? 9 : 11, color: '#000', fontWeight: 'bold' }}>
        {el.symbol}
      </Text>
    </Pressable>
  );
}

function EmptyCell({ compact }: { compact?: boolean }) {
  const size = compact ? 28 : 40;
  return <Box style={{ width: size, height: size }} />;
}

export function PeriodicTable({
  onSelect,
  highlighted,
  colorBy = 'category',
  selected,
  compact = false,
  style,
}: PeriodicTableProps) {
  const c = useThemeColors();
  const highlightSet = useMemo(
    () => new Set(highlighted ?? ELEMENTS.map(el => el.number)),
    [highlighted],
  );
  const gap = compact ? 1 : 2;

  return (
    <Box style={{ gap: compact ? 4 : 8, ...style }}>
      {TABLE_LAYOUT.map((row, ri) => (
        <Box key={ri} style={{ flexDirection: 'row', gap }}>
          {row.map((num, ci) => {
            if (num === 0) return <EmptyCell key={ci} compact={compact} />;
            const el = getElement(num);
            if (!el) return <EmptyCell key={ci} compact={compact} />;
            return (
              <ElementCell
                key={num}
                el={el}
                isHighlighted={highlightSet.has(num)}
                isSelected={selected === num}
                colorBy={colorBy}
                onPress={onSelect}
                compact={compact}
              />
            );
          })}
        </Box>
      ))}
      {!compact && (
        <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <Box key={cat} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Box style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 2 }} />
              <Text style={{ fontSize: 9, color: c.muted }}>
                {cat.replace(/-/g, ' ')}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// -- Element Card -------------------------------------------------------------

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
