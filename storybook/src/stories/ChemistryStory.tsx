import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import {
  PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView,
  useElement, useMolecule, useReaction,
  molarMass, massComposition, parseFormula, balanceEquation,
  searchCompounds, ELEMENTS,
  massToMoles, molesToMass, molesToParticles,
  CONSTANTS,
} from '@reactjit/chemistry';
import type { Element } from '@reactjit/chemistry';

type Tab = 'table' | 'molecules' | 'reactions' | 'tools';

export function ChemistryStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<Tab>('table');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {(['table', 'molecules', 'reactions', 'tools'] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 16,
              paddingRight: 16,
              backgroundColor: tab === t ? c.bgElevated : 'transparent',
              borderBottomWidth: tab === t ? 2 : 0,
              borderBottomColor: c.primary,
            }}
          >
            <Text style={{ fontSize: 13, color: tab === t ? c.primary : c.muted, fontWeight: tab === t ? 'bold' : 'normal' }}>
              {t === 'table' ? 'Periodic Table' : t === 'molecules' ? 'Molecules' : t === 'reactions' ? 'Reactions' : 'Tools'}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1 }}>
        {tab === 'table' && <TableTab />}
        {tab === 'molecules' && <MoleculesTab />}
        {tab === 'reactions' && <ReactionsTab />}
        {tab === 'tools' && <ToolsTab />}
      </Box>
    </Box>
  );
}

// -- Periodic Table Tab -------------------------------------------------------

function TableTab() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<number | null>(null);
  const [colorBy, setColorBy] = useState<'category' | 'phase' | 'electronegativity'>('category');
  const el = useElement(selected ?? 1);

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        {/* Color mode selector */}
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {(['category', 'phase', 'electronegativity'] as const).map(mode => (
            <Pressable
              key={mode}
              onPress={() => setColorBy(mode)}
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 10,
                paddingRight: 10,
                borderRadius: 4,
                backgroundColor: colorBy === mode ? c.primary : c.surface,
              }}
            >
              <Text style={{ fontSize: 11, color: colorBy === mode ? '#fff' : c.text }}>
                {mode}
              </Text>
            </Pressable>
          ))}
        </Box>

        <PeriodicTable
          onSelect={(el) => setSelected(el.number)}
          selected={selected}
          colorBy={colorBy}
          compact
        />

        {/* Selected element detail */}
        {el && (
          <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <ElementCard element={el.number} style={{ flexGrow: 1 }} />
            <ElectronShell element={el.number} />
          </Box>
        )}
      </Box>
    </ScrollView>
  );
}

// -- Molecules Tab ------------------------------------------------------------

const DEMO_FORMULAS = ['H2O', 'CO2', 'C6H12O6', 'C8H10N4O2', 'NaCl', 'CH4', 'NH3', 'C2H5OH', 'H2SO4', 'C6H6'];

function MoleculesTab() {
  const c = useThemeColors();
  const [search, setSearch] = useState('');
  const [selectedFormula, setSelectedFormula] = useState('H2O');

  const results = useMemo(() => {
    if (!search) return [];
    return searchCompounds(search);
  }, [search]);

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>{'Molecule Explorer'}</Text>

        {/* Search */}
        <TextInput
          placeholder="Search compounds (water, glucose, caffeine...)"
          value={search}
          onChangeText={setSearch}
          style={{
            backgroundColor: c.surface,
            borderRadius: 6,
            padding: 10,
            fontSize: 13,
            color: c.text,
          }}
        />

        {/* Search results */}
        {results.length > 0 && (
          <Box style={{ gap: 4 }}>
            {results.slice(0, 8).map(r => (
              <Pressable
                key={r.formula}
                onPress={() => { setSelectedFormula(r.formula); setSearch(''); }}
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  padding: 6,
                  backgroundColor: c.surface,
                  borderRadius: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: c.primary, fontWeight: 'bold' }}>{r.formula}</Text>
                <Text style={{ fontSize: 12, color: c.muted }}>{r.name}</Text>
              </Pressable>
            ))}
          </Box>
        )}

        {/* Quick pick buttons */}
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {DEMO_FORMULAS.map(f => (
            <Pressable
              key={f}
              onPress={() => setSelectedFormula(f)}
              style={{
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 8,
                paddingRight: 8,
                borderRadius: 4,
                backgroundColor: selectedFormula === f ? c.primary : c.surface,
              }}
            >
              <Text style={{ fontSize: 11, color: selectedFormula === f ? '#fff' : c.text }}>{f}</Text>
            </Pressable>
          ))}
        </Box>

        {/* Selected molecule card */}
        <MoleculeCard formula={selectedFormula} />
      </Box>
    </ScrollView>
  );
}

// -- Reactions Tab ------------------------------------------------------------

const DEMO_REACTIONS = [
  'H2 + O2 -> H2O',
  'CH4 + O2 -> CO2 + H2O',
  'N2 + H2 -> NH3',
  'Fe2O3 + CO -> Fe + CO2',
  'C3H8 + O2 -> CO2 + H2O',
  'Na + Cl2 -> NaCl',
  'CaCO3 -> CaO + CO2',
  'C6H12O6 + O2 -> CO2 + H2O',
];

function ReactionsTab() {
  const c = useThemeColors();
  const [customEq, setCustomEq] = useState('');
  const [equations, setEquations] = useState(DEMO_REACTIONS.slice(0, 4));

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>{'Reaction Balancer'}</Text>

        {/* Custom equation input */}
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="Enter equation: H2 + O2 -> H2O"
            value={customEq}
            onChangeText={setCustomEq}
            onSubmit={() => {
              if (customEq.trim()) {
                setEquations(prev => [customEq.trim(), ...prev]);
                setCustomEq('');
              }
            }}
            style={{
              flexGrow: 1,
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 10,
              fontSize: 13,
              color: c.text,
            }}
          />
          <Pressable
            onPress={() => {
              if (customEq.trim()) {
                setEquations(prev => [customEq.trim(), ...prev]);
                setCustomEq('');
              }
            }}
            style={{
              backgroundColor: c.primary,
              borderRadius: 6,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <Text style={{ fontSize: 13, color: '#fff' }}>{'Balance'}</Text>
          </Pressable>
        </Box>

        {/* Quick reaction buttons */}
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {DEMO_REACTIONS.map(eq => (
            <Pressable
              key={eq}
              onPress={() => setEquations(prev => prev.includes(eq) ? prev : [eq, ...prev])}
              style={{
                paddingTop: 3,
                paddingBottom: 3,
                paddingLeft: 6,
                paddingRight: 6,
                borderRadius: 3,
                backgroundColor: c.surface,
              }}
            >
              <Text style={{ fontSize: 9, color: c.muted }}>{eq}</Text>
            </Pressable>
          ))}
        </Box>

        {/* Reaction cards */}
        <Box style={{ gap: 8 }}>
          {equations.map((eq, i) => (
            <ReactionView key={`${eq}-${i}`} equation={eq} />
          ))}
        </Box>
      </Box>
    </ScrollView>
  );
}

// -- Tools Tab ----------------------------------------------------------------

function ToolsTab() {
  const c = useThemeColors();
  const [formula, setFormula] = useState('H2O');
  const [mass, setMass] = useState('18');

  const mm = useMemo(() => molarMass(formula), [formula]);
  const composition = useMemo(() => massComposition(formula), [formula]);
  const massNum = parseFloat(mass) || 0;
  const moles = useMemo(() => massToMoles(massNum, formula), [massNum, formula]);
  const particles = useMemo(() => molesToParticles(moles), [moles]);

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>{'Chemistry Tools'}</Text>

        {/* Molar mass calculator */}
        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>{'Molar Mass Calculator'}</Text>
          <TextInput
            placeholder="Enter formula (e.g. C6H12O6)"
            value={formula}
            onChangeText={setFormula}
            style={{
              backgroundColor: c.surface,
              borderRadius: 6,
              padding: 8,
              fontSize: 13,
              color: c.text,
            }}
          />
          <Text style={{ fontSize: 16, color: c.primary }}>{`${mm} g/mol`}</Text>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(composition).map(([sym, pct]) => (
              <Text key={sym} style={{ fontSize: 11, color: c.muted }}>{`${sym}: ${pct}%`}</Text>
            ))}
          </Box>
        </Box>

        {/* Mass to moles converter */}
        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>{'Mass \u2194 Moles \u2194 Particles'}</Text>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="Mass (g)"
              value={mass}
              onChangeText={setMass}
              style={{
                flexGrow: 1,
                backgroundColor: c.surface,
                borderRadius: 6,
                padding: 8,
                fontSize: 13,
                color: c.text,
              }}
            />
            <Text style={{ fontSize: 13, color: c.muted, paddingTop: 8 }}>{`g of ${formula}`}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: c.muted }}>{'Moles'}</Text>
              <Text style={{ fontSize: 14, color: c.text }}>{moles.toFixed(6)}</Text>
            </Box>
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: c.muted }}>{'Particles'}</Text>
              <Text style={{ fontSize: 14, color: c.text }}>{particles.toExponential(4)}</Text>
            </Box>
          </Box>
        </Box>

        {/* Physical constants reference */}
        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6 }}>
          <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>{'Physical Constants'}</Text>
          {Object.entries(CONSTANTS).map(([name, value]) => (
            <Box key={name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: c.muted }}>{name.replace(/_/g, ' ')}</Text>
              <Text style={{ fontSize: 11, color: c.text, fontVariant: 'tabular-nums' }}>
                {typeof value === 'number' && value < 0.001 ? value.toExponential(6) : `${value}`}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </ScrollView>
  );
}
