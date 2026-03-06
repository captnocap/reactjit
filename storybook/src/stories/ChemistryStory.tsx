import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import {
  PeriodicTable, ElementCard, MoleculeCard, ElectronShell, ReactionView,
  ReagentTest, SpectrumView, PhaseDiagram,
  useElement, useMolecule, useReaction,
  usePubChemCompound,
  molarMass, massComposition, parseFormula, balanceEquation,
  searchCompounds, ELEMENTS, getAllTestedCompounds, REAGENT_INFO,
  massToMoles, molesToMass, molesToParticles,
  CONSTANTS,
} from '@reactjit/chemistry';
import type { Element, ReagentType } from '@reactjit/chemistry';

type Tab = 'table' | 'molecules' | 'reactions' | 'reagents' | 'spectra' | 'tools';

export function ChemistryStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<Tab>('table');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>
      {/* Tab bar */}
      <ScrollView style={{ height: 38 }} horizontal>
        <Box style={{ flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: c.border }}>
          {(['table', 'molecules', 'reactions', 'reagents', 'spectra', 'tools'] as Tab[]).map(t => {
            const labels: Record<Tab, string> = { table: 'Periodic Table', molecules: 'Molecules', reactions: 'Reactions', reagents: 'Reagents', spectra: 'Spectra', tools: 'Tools' };
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingLeft: 14,
                  paddingRight: 14,
                  backgroundColor: tab === t ? c.bgElevated : 'transparent',
                  borderBottomWidth: tab === t ? 2 : 0,
                  borderBottomColor: c.primary,
                }}
              >
                <Text style={{ fontSize: 12, color: tab === t ? c.primary : c.muted, fontWeight: tab === t ? 'bold' : 'normal' }}>
                  {labels[t]}
                </Text>
              </Pressable>
            );
          })}
        </Box>
      </ScrollView>

      {/* Content */}
      <Box style={{ flexGrow: 1 }}>
        {tab === 'table' && <TableTab />}
        {tab === 'molecules' && <MoleculesTab />}
        {tab === 'reactions' && <ReactionsTab />}
        {tab === 'reagents' && <ReagentsTab />}
        {tab === 'spectra' && <SpectraTab />}
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

// -- Reagents Tab -------------------------------------------------------------

const REAGENT_TYPES: ReagentType[] = ['marquis', 'mecke', 'mandelin', 'simons', 'ehrlich'];
const REAGENT_COMPOUNDS = ['MDMA', 'Amphetamine', 'Methamphetamine', 'LSD', 'Heroin', 'Cocaine', 'Psilocybin', 'DMT', 'Caffeine'];

function ReagentsTab() {
  const c = useThemeColors();
  const [compound, setCompound] = useState('MDMA');
  const [reagent, setReagent] = useState<ReagentType>('marquis');
  const [lastResult, setLastResult] = useState<string>('');

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>{'Reagent Spot Tests'}</Text>
        <Text style={{ fontSize: 11, color: c.muted }}>
          {'Color-change presumptive tests. Each reagent reacts differently — stack multiple for higher confidence.'}
        </Text>

        {/* Compound selector */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: c.muted }}>{'Sample Compound'}</Text>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {REAGENT_COMPOUNDS.map(cmp => (
              <Pressable
                key={cmp}
                onPress={() => setCompound(cmp)}
                style={{
                  paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8,
                  borderRadius: 4,
                  backgroundColor: compound === cmp ? c.primary : c.surface,
                }}
              >
                <Text style={{ fontSize: 11, color: compound === cmp ? '#fff' : c.text }}>{cmp}</Text>
              </Pressable>
            ))}
          </Box>
        </Box>

        {/* Multi-reagent test panel */}
        <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          {REAGENT_TYPES.map(r => (
            <Box key={r} style={{ alignItems: 'center', gap: 4 }}>
              <ReagentTest
                type={r}
                sample={compound}
                speed={1.5}
                onReactionComplete={(e) => setLastResult(`${r}: ${(e as any).description}`)}
                style={{ width: 80, height: 100 }}
              />
            </Box>
          ))}
        </Box>

        {/* Result */}
        {lastResult !== '' && (
          <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 10 }}>
            <Text style={{ fontSize: 12, color: c.text }}>{lastResult}</Text>
          </Box>
        )}

        {/* Reagent info */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: c.muted }}>{'Reagent selector'}</Text>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {REAGENT_TYPES.map(r => (
              <Pressable
                key={r}
                onPress={() => setReagent(r)}
                style={{
                  paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8,
                  borderRadius: 4,
                  backgroundColor: reagent === r ? c.primary : c.surface,
                }}
              >
                <Text style={{ fontSize: 10, color: reagent === r ? '#fff' : c.text }}>
                  {REAGENT_INFO[r].name}
                </Text>
              </Pressable>
            ))}
          </Box>
        </Box>

        <Box style={{ backgroundColor: c.bgElevated, borderRadius: 6, padding: 10, gap: 4 }}>
          <Text style={{ fontSize: 13, color: c.text, fontWeight: 'bold' }}>{REAGENT_INFO[reagent].name}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{REAGENT_INFO[reagent].formula}</Text>
          <Text style={{ fontSize: 11, color: c.text }}>{REAGENT_INFO[reagent].description}</Text>
        </Box>
      </Box>
    </ScrollView>
  );
}

// -- Spectra Tab --------------------------------------------------------------

function SpectraTab() {
  const c = useThemeColors();
  const [specType, setSpecType] = useState<'ir' | 'uv-vis' | 'mass-spec'>('ir');
  const [compound, setCompound] = useState('C2H5OH');
  const [pubchemQuery, setPubchemQuery] = useState('');
  const pubchem = usePubChemCompound(pubchemQuery || null);

  const specCompounds: Record<string, string[]> = {
    'ir': ['H2O', 'C2H5OH', 'C3H6O'],
    'uv-vis': ['C6H6'],
    'mass-spec': ['C8H10N4O2'],
  };

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>{'Spectrometry'}</Text>

        {/* Spectrum type */}
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {(['ir', 'uv-vis', 'mass-spec'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => { setSpecType(t); setCompound(specCompounds[t][0] ?? ''); }}
              style={{
                paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
                borderRadius: 4,
                backgroundColor: specType === t ? c.primary : c.surface,
              }}
            >
              <Text style={{ fontSize: 11, color: specType === t ? '#fff' : c.text }}>
                {t === 'ir' ? 'IR' : t === 'uv-vis' ? 'UV-Vis' : 'Mass Spec'}
              </Text>
            </Pressable>
          ))}
        </Box>

        {/* Compound selector */}
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {(specCompounds[specType] ?? []).map(cmp => (
            <Pressable
              key={cmp}
              onPress={() => setCompound(cmp)}
              style={{
                paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8,
                borderRadius: 4,
                backgroundColor: compound === cmp ? c.primary : c.surface,
              }}
            >
              <Text style={{ fontSize: 10, color: compound === cmp ? '#fff' : c.text }}>{cmp}</Text>
            </Pressable>
          ))}
        </Box>

        {/* Spectrum view */}
        <SpectrumView
          spectrumType={specType}
          compound={compound}
          style={{ height: 280 }}
        />

        {/* Phase diagram */}
        <Text style={{ fontSize: 16, color: c.text, fontWeight: 'bold', paddingTop: 8 }}>{'Phase Diagrams'}</Text>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Box style={{ flexGrow: 1 }}>
            <PhaseDiagram compound="H2O" style={{ height: 260 }} />
          </Box>
          <Box style={{ flexGrow: 1 }}>
            <PhaseDiagram compound="CO2" style={{ height: 260 }} />
          </Box>
        </Box>

        {/* PubChem live lookup */}
        <Text style={{ fontSize: 16, color: c.text, fontWeight: 'bold', paddingTop: 8 }}>{'PubChem Lookup'}</Text>
        <TextInput
          placeholder="Search PubChem (aspirin, caffeine, glucose...)"
          value={pubchemQuery}
          onSubmit={() => {}}
          onChangeText={setPubchemQuery}
          style={{
            backgroundColor: c.surface, borderRadius: 6, padding: 10, fontSize: 13, color: c.text,
          }}
        />
        {pubchem.loading && <Text style={{ fontSize: 11, color: c.muted }}>{'Loading from PubChem...'}</Text>}
        {pubchem.error && <Text style={{ fontSize: 11, color: '#e03838' }}>{pubchem.error}</Text>}
        {pubchem.data && (
          <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6 }}>
            <Text style={{ fontSize: 14, color: c.text, fontWeight: 'bold' }}>
              {`CID ${pubchem.data.cid}: ${pubchem.data.iupacName ?? pubchemQuery}`}
            </Text>
            <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {pubchem.data.molecularFormula && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'Formula'}</Text>
                  <Text style={{ fontSize: 12, color: c.text }}>{pubchem.data.molecularFormula}</Text>
                </Box>
              )}
              {pubchem.data.molecularWeight && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'MW'}</Text>
                  <Text style={{ fontSize: 12, color: c.text }}>{`${pubchem.data.molecularWeight} g/mol`}</Text>
                </Box>
              )}
              {pubchem.data.canonicalSmiles && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'SMILES'}</Text>
                  <Text style={{ fontSize: 10, color: c.text }}>{pubchem.data.canonicalSmiles}</Text>
                </Box>
              )}
              {pubchem.data.xlogp !== undefined && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'XLogP'}</Text>
                  <Text style={{ fontSize: 12, color: c.text }}>{`${pubchem.data.xlogp}`}</Text>
                </Box>
              )}
              {pubchem.data.hbondDonorCount !== undefined && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'H-bond donors'}</Text>
                  <Text style={{ fontSize: 12, color: c.text }}>{`${pubchem.data.hbondDonorCount}`}</Text>
                </Box>
              )}
              {pubchem.data.topologicalPolarSurfaceArea !== undefined && (
                <Box style={{ gap: 1 }}>
                  <Text style={{ fontSize: 8, color: c.muted }}>{'TPSA'}</Text>
                  <Text style={{ fontSize: 12, color: c.text }}>{`${pubchem.data.topologicalPolarSurfaceArea}`}</Text>
                </Box>
              )}
            </Box>
            {pubchem.data.inchiKey && (
              <Text style={{ fontSize: 9, color: c.muted }}>{`InChIKey: ${pubchem.data.inchiKey}`}</Text>
            )}
          </Box>
        )}
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
